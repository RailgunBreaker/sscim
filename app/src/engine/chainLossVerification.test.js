import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { verifyChainLoss } from './chainLossVerification.js';
import { kioxiaAnnualDocument, kioxiaAnnualObservations } from '../../../server/src/kioxia-annual-review.js';
import { producerLossObservations } from '../../../server/src/producer-loss-review.js';
import { phisonAnnualDocument, customerLossObservations } from '../../../server/src/customer-loss-review.js';
import { apacerAnnualDocument, apacerCounterpartyObservations } from '../../../server/src/apacer-counterparty-review.js';
import { customerInventoryObservations } from '../../../server/src/customer-inventory-review.js';
const read = name => JSON.parse(readFileSync(new URL(`../../../docs/reference/${name}.json`,import.meta.url)));
const data = { verification:read('chain-loss-verification'),reconciliation:read('loss-reconciliations'),allocation:read('supplier-loss-allocations'),followup:read('semiconductor-loss-followup') };
const run = d => verifyChainLoss(d,'2026-09-18');
it('retains inventory expenses by year and overlapping accounting scope without summing them', () => {
  const r = verifyChainLoss(data, '2026-09-22'), inventory = r.customerEvidence.inventoryCheck;
  expect(inventory.scopes.map(s => [s.scopeId, s.current.value, s.prior.value])).toEqual([
    ['phison_consolidated', 1711889, 135888], ['phison_parent', 1671654, 135858],
    ['apacer_consolidated', 203606, 161105], ['apacer_parent', 191000, 155000],
  ]);
  expect(inventory.scopes.every(s => !s.includedInIncidentAccount && !s.calibrationEligible)).toBe(true);
  expect(inventory.combinedExpense).toBeNull();
  expect(inventory.cashLoss).toBeNull();
  expect(inventory.incidentLoss).toBeNull();
  expect(inventory.calibrationEligible).toBe(false);
  expect(r.chainWideLoss).toBeNull();
});
it('rejects wrong inventory scope, metric, amount, units, period and unsupported attribution', () => {
  for (const patch of [{scopeId:'phison_parent'}, {companyId:'apacer'}, {metric:'inventory_balance'}, {value:-1},
    {value:NaN}, {units:'TWD million'}, {periodEnd:'2023-12-31'}, {accountingBasis:'deferred_tax_asset'},
    {attributionStatus:'incident_only'}, {incidentId:'nand_contamination_2022'}, {incidentLoss:0},
    {affectedInventoryLots:[]}, {cashLoss:1711889}, {claimStatus:'unreviewed'}]) {
    const d = structuredClone(data);
    Object.assign(d.verification.customerInventoryEvidence[0], patch);
    const c = verifyChainLoss(d, '2026-09-22').customerEvidence.inventoryCheck;
    expect(c.scopes[0].current).toBeNull();
    expect(c.scopes[0].prior.value).toBe(135888);
  }
  const d = structuredClone(data);
  d.verification.customerInventoryEvidence.push(structuredClone(d.verification.customerInventoryEvidence[0]));
  expect(verifyChainLoss(d, '2026-09-22').customerEvidence.inventoryCheck.scopes[0].current).toBeNull();
});
it('does not turn annual inventory expense changes into contamination losses or validation outcomes', () => {
  const d = structuredClone(data);
  d.verification.customerInventoryEvidence.forEach(r => { r.value = r.periodStart.startsWith('2022') ? r.value * 100 : 0; });
  const r = verifyChainLoss(d, '2026-09-22');
  expect(r.customerEvidence.inventoryCheck.incidentLoss).toBeNull();
  expect(r.customerEvidence.customerLoss).toBeNull();
  expect(r.customerEvidence.calibrationEligible).toBe(false);
  expect(r.selectedNetCharge).toBe(170);
  expect(r.kioxiaCheck.selectedNetCharge).toBe(25.6);
  expect(r.chainWideLoss).toBeNull();
});
it('withholds unavailable inventory reviews and missing prior periods instead of filling zeros', () => {
  expect(verifyChainLoss(data, '2026-09-21').customerEvidence.inventoryCheck.scopes).toEqual([]);
  const d = structuredClone(data);
  d.verification.customerInventoryEvidence = d.verification.customerInventoryEvidence.filter(r => r.periodStart === '2022-01-01');
  expect(verifyChainLoss(d, '2026-09-22').customerEvidence.inventoryCheck.scopes.every(s => s.prior === null)).toBe(true);
});
it('reproduces inventory observations from unique pinned primary documents', () => {
  expect(customerInventoryObservations(data.verification.documents).customerInventoryEvidence).toEqual(data.verification.customerInventoryEvidence);
  const docs = structuredClone(data.verification.documents);
  const phison = docs.find(d => d.id === phisonAnnualDocument.id);
  phison.sha256 = 'changed';
  expect(() => customerInventoryObservations(docs)).toThrow('reviewed annual reports');
  expect(() => customerInventoryObservations([...data.verification.documents, data.verification.documents.find(d => d.id === phisonAnnualDocument.id)]))
    .toThrow('reviewed annual reports');
  expect(() => customerInventoryObservations([])).toThrow('reviewed annual reports');
});
it('reconciles buyer reporting scopes while retaining the seller-buyer discrepancy', () => {
  const c = verifyChainLoss(data, '2026-09-21').customerEvidence.counterpartyCheck;
  expect(c.parent.value).toBe(1073281);
  expect(c.subsidiary.value).toBe(130914);
  expect(c.group.value).toBe(1204195);
  expect(c.groupResidual).toBe(0);
  expect(c.groupStatus).toBe('reported_scopes_reconcile');
  expect(c.consolidation.consolidationStartDate).toBe('2022-08-01');
  expect(c.parentStatus).toBe('same_parent_amount_corroborated');
  expect(c.counterpartyStatus).toBe('unreconciled_difference');
  expect(c.sellerMinusBuyer).toBe(918);
  expect(c.differenceExplanation).toBeNull();
  expect(c.lossFromDifference).toBeNull();
  expect(c.combinedTransactionTotal).toBeNull();
});
it('blocks a buyer comparison with wrong scope, supplier, dates, units or incident attribution', () => {
  for (const patch of [{buyerScopeId:'apacer_consolidated'}, {supplierId:'kioxia'}, {units:'TWD million'},
    {periodStart:'2021-01-01'}, {incidentId:'nand_contamination_2022'}, {value:1073282}, {claimStatus:'unreviewed'}]) {
    const d = structuredClone(data);
    Object.assign(d.verification.counterpartyPurchaseEvidence[0], patch);
    const c = verifyChainLoss(d, '2026-09-21').customerEvidence.counterpartyCheck;
    expect(c.sellerMinusBuyer).toBeNull();
    expect(c.groupResidual).toBeNull();
  }
  const d = structuredClone(data);
  d.verification.counterpartyPurchaseEvidence.push(structuredClone(d.verification.counterpartyPurchaseEvidence[0]));
  expect(verifyChainLoss(d, '2026-09-21').customerEvidence.counterpartyCheck.sellerMinusBuyer).toBeNull();
});
it('separates a group residual from a comparable parent transaction difference', () => {
  const d = structuredClone(data);
  d.verification.counterpartyPurchaseEvidence.find(x => x.buyerScopeId === 'apacer_consolidated').value += 100;
  const c = verifyChainLoss(d, '2026-09-21').customerEvidence.counterpartyCheck;
  expect(c.groupStatus).toBe('unreconciled_scope_difference');
  expect(c.groupResidual).toBe(100);
  expect(c.sellerMinusBuyer).toBe(918);
  expect(c.lossFromDifference).toBeNull();
});
it('requires the subsidiary consolidation boundary before reconciling the group', () => {
  const d = structuredClone(data);
  d.verification.counterpartyConsolidationEvidence = [];
  const c = verifyChainLoss(d, '2026-09-22').customerEvidence.counterpartyCheck;
  expect(c.groupResidual).toBeNull();
  expect(c.sellerMinusBuyer).toBe(918);
});
it('does not equate matched commercial amounts with zero incident loss', () => {
  const d = structuredClone(data);
  const seller = d.verification.customerTransactions.find(x => x.id === 'phison_sale_apacer_2022');
  seller.value = 1073281; seller.sourceSignedValue = -1073281;
  const r = verifyChainLoss(d, '2026-09-21');
  expect(r.customerEvidence.counterpartyCheck.counterpartyStatus).toBe('reported_amounts_agree');
  expect(r.customerEvidence.counterpartyCheck.lossFromDifference).toBeNull();
  expect(r.customerEvidence.customerLoss).toBeNull();
  expect(r.chainWideLoss).toBeNull();
});
it('withholds unavailable buyer evidence and reproduces it only from reviewed bytes', () => {
  const early = verifyChainLoss(data, '2026-09-20').customerEvidence.counterpartyCheck;
  expect(early.parent).toBeNull();
  expect(early.groupResidual).toBeNull();
  expect(early.sellerMinusBuyer).toBeNull();
  const doc = data.verification.documents.find(x => x.id === apacerAnnualDocument.id);
  expect(apacerCounterpartyObservations(doc).counterpartyPurchaseEvidence).toEqual(data.verification.counterpartyPurchaseEvidence);
  expect(() => apacerCounterpartyObservations({...doc, sha256:'changed'})).toThrow('reviewed annual report');
});
it('retains legal counterparties, transaction signs and denominators without deriving loss', () => {
  const r = verifyChainLoss(data, '2026-09-21'), c = r.customerEvidence;
  expect(c.transactions.map(x => [x.supplierId, x.customerId, x.value, x.sharePercent])).toEqual([
    ['kioxia_taiwan', 'phison', 11413643, 32], ['phison', 'kioxia', 1640541, 3], ['phison', 'apacer', 1074199, 2],
  ]);
  expect(c.transactions[0].shareBasis).toBe('Phison parent-company total purchases');
  expect(c.transactions[1].shareBasis).toBe('Phison parent-company total sales');
  expect(c.transactions[1].sourceSignedValue).toBe(-1640541);
  expect(c.transactions.every(x => x.units === 'TWD thousand' && x.propagationWeight === null && !x.includedInLossTotal)).toBe(true);
  expect(c.supplierAssessment.incidentLoss).toBeNull();
  expect(c.customerLoss).toBeNull();
  expect(c.affectedCustomerCount).toBeNull();
  expect(c.coverageFraction).toBeNull();
  expect(c.completePopulationVerified).toBe(false);
  expect(r.chainWideLoss).toBeNull();
});
it('does not backdate the migrated customer source to its printed date', () => {
  const r = verifyChainLoss(data, '2026-09-20');
  expect(r.customerEvidence.transactions).toEqual([]);
  expect(r.customerEvidence.supplierAssessment).toBeNull();
  expect(r.documents.some(x => x.id === phisonAnnualDocument.id)).toBe(false);
});
it('blocks wrong transaction direction, signs, units, periods, denominators and incident attribution', () => {
  for (const patch of [{supplierId:'kioxia'}, {customerId:'apacer'}, {transactionType:'sale'}, {sourceSignedValue:-11413643},
    {units:'TWD million'}, {periodStart:'2023-01-01'}, {reportingScope:'consolidated_group'},
    {shareBasis:'NAND bit purchases'}, {sourceSignedSharePercent:-32}, {sharePercent:132},
    {incidentId:'nand_contamination_2022'}, {supplierFacilityId:'kioxia_yokkaichi'}, {inputVolumeShare:0.32},
    {incidentLoss:0}, {claimStatus:'unreviewed'}]) {
    const changed = structuredClone(data);
    Object.assign(changed.verification.customerTransactions[0], patch);
    expect(verifyChainLoss(changed, '2026-09-21').customerEvidence.transactions).toHaveLength(2);
  }
  const changed = structuredClone(data);
  changed.verification.customerTransactions.push(structuredClone(changed.verification.customerTransactions[0]));
  expect(verifyChainLoss(changed, '2026-09-21').customerEvidence.transactions).toHaveLength(2);
});
it('does not turn commercial magnitude or a stable-supply statement into a loss estimate', () => {
  const changed = structuredClone(data);
  changed.verification.customerTransactions.forEach(x => { x.value *= 10; x.sourceSignedValue *= 10; });
  const r = verifyChainLoss(changed, '2026-09-21');
  expect(r.selectedNetCharge).toBe(170);
  expect(r.kioxiaCheck.selectedNetCharge).toBe(25.6);
  expect(r.customerEvidence.customerLoss).toBeNull();
  expect(r.customerEvidence.calibrationEligible).toBe(false);
  changed.verification.customerSupplyStatements[0].incidentLoss = 0;
  expect(verifyChainLoss(changed, '2026-09-21').customerEvidence.supplierAssessment).toBeNull();
});
it('reconstructs customer observations only from the reviewed issuer source', () => {
  const doc = data.verification.documents.find(x => x.id === phisonAnnualDocument.id);
  const rebuilt = customerLossObservations(doc);
  expect(rebuilt.customerTransactions).toEqual(data.verification.customerTransactions);
  expect(rebuilt.customerSupplyStatements).toEqual(data.verification.customerSupplyStatements);
  expect(() => customerLossObservations({...doc, sha256:'changed'})).toThrow('reviewed annual report');
  expect(() => customerLossObservations({...doc, url:'https://example.com'})).toThrow('reviewed annual report');
});
it('matches producer classifications to existing charges without adding or dividing them', () => {
  const r = run(data), p = r.producerScope;
  expect(p.costAccounts.map(x => [x.companyId, x.value, x.accountingLine]))
    .toEqual([['wdc', 207, 'cost_of_revenue'], ['kioxia', 33.2, 'cost_of_sales']]);
  expect(p.costAccounts[0].components).toHaveLength(3);
  expect(p.costAccounts.every(x => x.componentTotal === null && !x.componentAllocationVerified && !x.includedAsAdditionalCharge)).toBe(true);
  expect(p.combinedProducerLoss).toBeNull();
  expect(p.physicalDamage).toBeNull();
  expect(r.selectedNetCharge).toBe(170);
});
it('rejects producer classifications with a conflicting parent, boundary or invented component amount', () => {
  for (const patch of [{value:208}, {units:'JPY billion'}, {incidentId:'another_incident'},
    {accountingLine:'sales'}, {periodEnd:'2022-07-02'}, {relatedRecordId:'unrelated'},
    {components:[{id:'scrap', label:'Scrap', value:207}]}]) {
    const changed = structuredClone(data);
    Object.assign(changed.verification.producerCostEvidence[0], patch);
    expect(run(changed).producerScope.costAccounts.map(x => x.companyId)).toEqual(['kioxia']);
  }
  const changed = structuredClone(data);
  changed.reconciliation.records.find(x => x.id === 'wdc_contamination_fy2022').value = 208;
  expect(run(changed).producerScope.costAccounts.map(x => x.companyId)).toEqual(['kioxia']);
  changed.verification.producerCostEvidence.push(structuredClone(changed.verification.producerCostEvidence[1]));
  expect(run(changed).producerScope.costAccounts).toEqual([]);
});
it('retains observed sales changes without treating mixed causes as incident losses', () => {
  const r = run(data), s = r.producerScope.salesContext;
  expect(s.status).toBe('reported_sales_change_mixed_causes');
  expect(s.before.value).toBe(393.8);
  expect(s.after.value).toBe(367.3);
  expect(s.change).toBe(-26.5);
  expect(s.attribution.bitGrowthValue).toBeNull();
  expect(s.attribution.reportedBitGrowth).toBe('Low-20% decrease');
  expect(s.incidentSalesLoss).toBeNull();
  expect(s.customerLoss).toBeNull();
  expect(s.calibrationEligible).toBe(false);
  expect(r.kioxiaCheck.selectedNetCharge).toBe(25.6);
});
it('excludes later demand-related costs regardless of magnitude', () => {
  const r = run(data);
  expect(r.producerScope.otherCauseCosts.map(x => [x.value, x.includedInIncidentAccount])).toEqual([[286, false], [249, false]]);
  const changed = structuredClone(data);
  changed.verification.otherCauseCosts.forEach(x => { x.value *= 100; });
  expect(run(changed).selectedNetCharge).toBe(r.selectedNetCharge);
  expect(run(changed).chainWideLoss).toBeNull();
  changed.verification.otherCauseCosts[0].incidentId = 'nand_contamination_2022';
  expect(run(changed).producerScope.otherCauseCosts).toHaveLength(1);
});
it('rejects sales comparisons with missing, overlapping, future or conflicting evidence', () => {
  expect(verifyChainLoss(data, '2022-08-09').producerScope.salesContext.change).toBeNull();
  expect(verifyChainLoss(data, '2024-08-19').producerScope.costAccounts).toEqual([]);
  for (const patch of [{periodStart:'2022-03-01'}, {units:'USD billion'}, {claimStatus:'unreviewed'}, {value:null}]) {
    const changed = structuredClone(data);
    Object.assign(changed.verification.companySalesEvidence[1], patch);
    expect(run(changed).producerScope.salesContext.change).toBeNull();
  }
  const changed = structuredClone(data);
  changed.verification.companySalesEvidence.push(structuredClone(changed.verification.companySalesEvidence[1]));
  expect(run(changed).producerScope.salesContext.change).toBeNull();
  changed.verification.companySalesEvidence.pop();
  changed.verification.salesAttributionEvidence[0].causeScope = 'incident_only';
  const s = run(changed).producerScope.salesContext;
  expect(s.status).toBe('missing_or_incompatible_evidence');
  expect(s.incidentSalesLoss).toBeNull();
  expect(s.attribution).toBeNull();
});
it('rebuilds producer observations only from their reviewed document hashes', () => {
  const rebuilt = producerLossObservations(data.verification.documents);
  for (const key of Object.keys(rebuilt)) expect(rebuilt[key]).toEqual(data.verification[key]);
  const changed = structuredClone(data.verification.documents);
  changed.find(x => x.id === 'wdc_2024').sha256 = 'changed';
  expect(() => producerLossObservations(changed)).toThrow('reviewed producer source missing or changed');
});
it('keeps later unattributed insurance and voting rights out of incident losses', () => {
  const r = run(data);
  expect(r.unattributedRecoveries.map(x => [x.periodEnd, x.value, x.units, x.includedInIncidentAccount]))
    .toEqual([['2025-03-31', 2695, 'JPY million', false], ['2026-03-31', 188, 'JPY million', false]]);
  expect(r.governanceEvidence[0].votingRightsShare).toBe(0.501);
  expect(r.governanceEvidence[0].incidentCostAllocation).toBeNull();
  expect(r.boundaryEvidence[0].recognizedAccountShare).toBe(0.5);
  const altered = structuredClone(data);
  altered.verification.unattributedRecoveries.forEach(x => { x.value *= 100; });
  const next = run(altered);
  expect(next.kioxiaCheck.selectedNetCharge).toBe(r.kioxiaCheck.selectedNetCharge);
  expect(next.selectedNetCharge).toBe(r.selectedNetCharge);
  expect(next.chainWideLoss).toBeNull();
  expect(next.completionRequirements.every(x => x.status === 'open')).toBe(true);
});
it('withholds unavailable, conflicting or wrongly attributed insurance observations', () => {
  expect(verifyChainLoss(data, '2026-06-23').unattributedRecoveries).toEqual([]);
  expect(verifyChainLoss(data, '2026-06-23').governanceEvidence).toEqual([]);
  for (const patch of [{ claimStatus: 'unreviewed' }, { incidentId: 'nand_contamination_2022' },
    { units: 'USD million' }, { periodEnd: '2027-03-31' }, { value: -1 }, { attributionStatus: 'incident_verified' }]) {
    const changed = structuredClone(data);
    Object.assign(changed.verification.unattributedRecoveries[0], patch);
    expect(run(changed).unattributedRecoveries).toHaveLength(1);
    expect(run(changed).kioxiaCheck.selectedNetCharge).toBe(25.6);
  }
  const duplicate = structuredClone(data);
  duplicate.verification.unattributedRecoveries.push({ ...duplicate.verification.unattributedRecoveries[0], value: 999 });
  expect(run(duplicate).unattributedRecoveries).toHaveLength(1);
  duplicate.verification.governanceEvidence[0].incidentCostAllocation = 0.501;
  expect(run(duplicate).governanceEvidence).toEqual([]);
});
it('does not close loss requirements when source evidence is missing', () => {
  const r = verifyChainLoss({}, '2026-09-20');
  expect(r.unattributedRecoveries).toEqual([]);
  expect(r.governanceEvidence).toEqual([]);
  expect(r.chainWideLoss).toBeNull();
  expect(r.completionRequirements.map(x => x.status)).toEqual(['open', 'open', 'open']);
});
it('requires the reviewed PDF hash when rebuilding the annual observations', () => {
  expect(() => kioxiaAnnualObservations({ ...kioxiaAnnualDocument, sha256: 'changed' })).toThrow('reviewed source bytes');
  const rebuilt = kioxiaAnnualObservations({ ...kioxiaAnnualDocument, sha256: kioxiaAnnualDocument.expectedSha256 });
  expect(rebuilt.unattributedRecoveries).toEqual(data.verification.unattributedRecoveries);
  expect(rebuilt.governanceEvidence).toEqual(data.verification.governanceEvidence);
});
it('counts one charge and cross-checks recovery vintages without closing the whole chain',()=>{
  const r=run(data);
  expect(r.duplicateCharge.acceptedCharge).toBe(207);
  expect(r.duplicateCharge.representations).toHaveLength(3);
  expect(r.recoveryCheck.status).toBe('reported_amounts_agree');
  expect(r.recoveryCheck.unassignedQuarter.value).toBe(1);
  expect(r.recoveryCheck.materialSupplierId).toBeNull();
  expect(r.selectedNetCharge).toBe(170);
  expect(r.chainWideLoss).toBeNull();
  expect(r.independentlyValidated).toBe(false);
  expect(r.recoveryCheck.fullPeriodPartitionVerified).toBe(false);
});
it('blocks conflicting duplicate amounts, currencies, incidents and accounting bases',()=>{
  for(const patch of [{value:208},{units:'JPY million'},{incidentId:'different'},{accountingBasis:'cash_loss'}]) {
    const changed=structuredClone(data);
    Object.assign(changed.allocation.accounts.find(r=>r.id==='wdc_contamination_linked'),patch);
    const r=run(changed);
    expect(r.duplicateCharge.status).toBe('conflicting_representations');
    expect(r.selectedNetCharge).toBeNull();
  }
});
it('blocks missing, changed, overlapping or unrecognized recovery evidence',()=>{
  for(const mutate of [d=>d.verification.records=d.verification.records.filter(r=>r.id!=='wdc_recovery_2024_nine_months'),d=>d.verification.records[1].value=2,
    d=>d.verification.records[1].periodStart='2023-12-01',
    d=>d.followup.recoveries[0].measure='cash_received']) {
    const changed=structuredClone(data);mutate(changed);
    expect(run(changed).selectedNetCharge).toBeNull();
  }
});
it('counts the precise and rounded Kioxia recovery once and retains the limited accounting boundary',()=>{
  const r=run(data), k=r.kioxiaCheck;
  expect(k.status).toBe('agrees_within_reported_precision');
  expect(k.chargeStatus).toBe('corroborated_same_charge');
  expect(k.preciseRecovery.value).toBe(7.571);
  expect(k.roundedRecovery.value).toBe(7.6);
  expect(k.recoveriesCounted).toBe(1);
  expect(k.selectedNetCharge).toBe(25.6);
  expect(k.roundingRange).toEqual({lower:25.5785,upper:25.6795});
  expect(k.materialSupplierAllocation).toBeNull();
  expect(k.finalSettlementVerified).toBe(false);
  expect(r.boundaryEvidence[0].recognizedAccountShare).toBe(0.5);
  expect(r.boundaryEvidence[0].incidentCostAllocation).toBeNull();
  expect(r.periodObservations[0].value).toBeNull();
  expect(r.chainWideLoss).toBeNull();
});
it('blocks mismatched Kioxia recovery boundaries, duplicate IDs and unsupported precision',()=>{
  for(const patch of [{value:8},{units:'USD billion'},{companyId:'wdc'},{incidentId:'another'},
    {metric:'cash_received'},{periodEnd:'2024-03-30'},{counterpartyClass:'material_supplier'},
    {accountingBasis:'cash'},{roundingUnit:0},{roundingUnit:null},{claimStatus:'unreviewed'}]) {
    const d=structuredClone(data);
    Object.assign(d.verification.records.find(r=>r.id==='kioxia_recovery_fy2023_rounded'),patch);
    expect(run(d).kioxiaCheck.selectedNetCharge).toBeNull();
  }
  const d=structuredClone(data);
  d.verification.records.push({...d.verification.records.find(r=>r.id==='kioxia_recovery_fy2023_precise'),value:8});
  expect(run(d).kioxiaCheck.selectedNetCharge).toBeNull();
});
it('does not backdate Kioxia incident attribution or allow an inconsistent original charge',()=>{
  const early=verifyChainLoss(data,'2024-06-01');
  expect(early.kioxiaCheck.preciseRecovery).toBeNull();
  expect(early.kioxiaCheck.roundedRecovery).toBeNull();
  expect(early.kioxiaCheck.selectedNetCharge).toBeNull();
  expect(early.boundaryEvidence).toEqual([]);
  const d=structuredClone(data);
  d.allocation.accounts.find(r=>r.id==='kioxia_contamination_fy2021').value=34;
  expect(run(d).kioxiaCheck.selectedNetCharge).toBeNull();
});
it('does not expose the later annual recovery before its source became available',()=>{
  const r=verifyChainLoss(data,'2024-05-01');
  expect(r.recoveryCheck.annualRecovery).toBeNull();
  expect(r.selectedNetCharge).toBeNull();
  expect(r.documents.every(d=>d.publicationDate<='2024-05-01')).toBe(true);
});
it('uses the later receipt narrative without fabricating cash or supplier attribution',()=>{
  const r=run(data);
  expect(r.recoveryCheck.quarterReceiptStatus).toBe('receipt_reported_payment_medium_unspecified');
  expect(r.recoveryCheck.quarterReceiptEvidence.value).toBeNull();
  expect(r.recoveryCheck.cashFromUnassignedCounterparty).toBeNull();
  expect(r.recoveryCheck.materialSupplierId).toBeNull();
  expect(r.selectedNetCharge).toBe(170);
  expect(verifyChainLoss(data,'2024-10-06').recoveryCheck.quarterReceiptEvidence).toBeNull();
  for(const patch of [{companyId:'sandisk'},{periodEnd:'2023-12-29'},{incidentId:'other'},
    {relatedRecordId:'different'},{kind:'issuer_forecast'},{reportedReceipt:false}]) {
    const d=structuredClone(data);Object.assign(d.verification.receiptEvidence[0],patch);
    expect(run(d).recoveryCheck.quarterReceiptEvidence).toBeNull();
  }
});
it('selects forecast revisions by availability date without adding them or turning them into outcomes',()=>{
  expect(verifyChainLoss(data,'2022-02-08').operationalCheck.selectedAvailabilityForecast).toBeNull();
  const early=verifyChainLoss(data,'2022-02-10').operationalCheck;
  expect(early.selectedAvailabilityForecast.value).toBe(6.5);
  expect(early.selectedAvailabilityForecast.qualifier).toBe('at_least');
  expect(early.availabilityHistory).toHaveLength(1);
  expect(early.restoration).toBeNull();
  const latest=run(data).operationalCheck;
  expect(latest.selectedAvailabilityForecast.value).toBe(7);
  expect(latest.availabilityHistory).toHaveLength(2);
  expect(latest.finalMeasuredAvailabilityLoss).toBeNull();
  expect(latest.customerLoss).toBeNull();
  expect(latest.monetizedLoss).toBeNull();
  expect(latest.calibrationEligible).toBe(false);
  expect(latest.restoration.exactDate).toBeNull();
  expect(latest.restoration.fullOutputRestored).toBeNull();
  expect(latest.mixedAdjustmentForecast.contaminationOnlyAmount).toBeNull();
});
it('rejects forecast revisions with wrong units, scope, outcome type or predecessor',()=>{
  for(const patch of [{units:'USD million'},{scopeId:'all_jv_output'},{kind:'reported_outcome'},
    {supersedesId:'unrelated'},{qualifier:'exact'},{value:-1},{claimStatus:'unreviewed'}]) {
    const d=structuredClone(data);Object.assign(d.verification.operationalEvidence[1],patch);
    expect(run(d).operationalCheck.selectedAvailabilityForecast).toBeNull();
  }
  const d=structuredClone(data);d.verification.operationalEvidence.push({...d.verification.operationalEvidence[1],value:8});
  expect(run(d).operationalCheck.selectedAvailabilityForecast).toBeNull();
});
it('reconciles disjoint charge periods without adding the annual total twice',()=>{
  const r=run(data), p=r.chargePeriodCheck;
  expect(p.status).toBe('reported_periods_reconcile');
  expect(p.nineMonths.value).toBe(203);
  expect(p.finalQuarter.value).toBe(4);
  expect(p.annualValue).toBe(207);
  expect(p.residual).toBe(0);
  expect(p.reportedYearCovered).toBe(true);
  expect(p.finalIncidentLossVerified).toBe(false);
  expect(r.selectedNetCharge).toBe(170);
  expect(verifyChainLoss(data,'2022-08-04').chargePeriodCheck.finalQuarter).toBeNull();
});
it('blocks a net charge when its new period reconciliation contains overlaps, gaps or conflicting amounts',()=>{
  for(const patch of [{value:5},{periodStart:'2022-04-01'},{periodStart:'2022-04-03'},
    {periodEnd:'2022-06-30'},{units:'JPY million'},{metric:'recognized_recovery'},{accountingBasis:'cash'},
    {kind:'issuer_forecast'},{companyId:'sandisk'}]) {
    const d=structuredClone(data);Object.assign(d.verification.records.find(r=>r.id==='wdc_charge_2022q4'),patch);
    expect(run(d).chargePeriodCheck.reportedYearCovered).toBe(false);
    expect(run(d).selectedNetCharge).toBeNull();
  }
});
it('requires both the historical recovery and the documented carve-out relationship',()=>{
  const h=run(data).historicalRecoveryCheck;
  expect(h.status).toBe('historical_amount_corroborated_not_additive');
  expect(h.historicalDisclosure.value).toBe(36);
  expect(h.includedAsAdditionalRecovery).toBe(false);
  expect(h.matchedOriginalId).toBe('wdc_recovery_2024q2_insurer');
  expect(h.supplierAllocation).toBeNull();
  expect(verifyChainLoss(data,'2025-05-11').historicalRecoveryCheck.historicalDisclosure).toBeNull();
  for(const mutate of [d=>d.verification.reportingRelationships=[],
    d=>d.verification.reportingRelationships[0].fromCompanyId='kioxia',
    d=>d.verification.reportingRelationships[0].separationDate='2023-01-01',
    d=>d.verification.records.find(r=>r.id==='sandisk_historical_insurance_2024').value=37,
    d=>d.verification.records.find(r=>r.id==='sandisk_historical_insurance_2024').periodEnd='2023-12-01']) {
    const d=structuredClone(data);mutate(d);
    expect(run(d).historicalRecoveryCheck.status).toBe('missing_or_incompatible_evidence');
  }
});
it('retains product revenue context without manufacturing a catch-up or customer-loss estimate',()=>{
  const r=run(data);
  expect(r.productEvidence).toHaveLength(2);
  expect(r.productEvidence[0].value).toBeNull();
  expect(r.productEvidence[1].value).toBe(38);
  for(const p of r.productEvidence) {
    expect(p.externalCustomerLoss).toBeNull();
    expect(p.catchupAmount).toBeNull();
    expect(p.permanentLoss).toBeNull();
  }
  expect(verifyChainLoss(data,'2022-05-03').productEvidence).toEqual([]);
  expect(r.chainWideLoss).toBeNull();
});
it('compares one issuer forecast with its later attribution without claiming model validation',()=>{
  const p=run(data).photoresistCheck;
  expect(p.status).toBe('issuer_estimates_agree');
  expect(p.marginForecast.value).toBe(2.6);
  expect(p.marginReported.value).toBe(2.6);
  expect(p.reportedDifference).toBe(0);
  expect(p.independentOutcome).toBe(false);
  expect(p.modelValidationEligible).toBe(false);
  expect(p.recognizedCharge.value).toBe(3400);
  expect(p.revenueShortfallForecast.value).toBe(550);
  expect(p.replacementRevenueForecast.value).toBe(550);
  expect(p.mixedRevenueUpliftForecast.value).toBe(230);
  expect(p.q2MarginForecast.value).toBe(1.5);
  expect(p.q2MixedMarginReported.value).toBe(1.7);
  for(const key of ['q2IncidentOnlyDifference','realizedCatchupRevenue','permanentRevenueLoss','supplierReimbursement','supplierCompanyId','downstreamCustomerLoss']) expect(p[key]).toBeNull();
});
it('keeps photoresist outcomes unavailable before publication and distinguishes approximation from agreement',()=>{
  expect(verifyChainLoss(data,'2019-02-14').photoresistCheck.marginForecast).toBeNull();
  const early=verifyChainLoss(data,'2019-04-17').photoresistCheck;
  expect(early.marginForecast.value).toBe(2.6);
  expect(early.marginReported).toBeNull();
  expect(early.reportedDifference).toBeNull();
  expect(verifyChainLoss(data,'2019-07-17').photoresistCheck.q2MixedMarginReported).toBeNull();
  const d=structuredClone(data);
  d.verification.photoresistEvidence.find(r=>r.id==='tsmc_q1_margin_reported').value=2.7;
  expect(run(d).photoresistCheck.status).toBe('issuer_estimates_differ');
  expect(run(d).photoresistCheck.reportedDifference).toBe(0.1);
  expect(run(d).photoresistCheck.modelValidationEligible).toBe(false);
});
it('rejects mismatched, postdated and duplicate photoresist comparisons',()=>{
  for(const patch of [{units:'percent'},{periodEnd:'2019-06-30'},{metric:'total_gross_margin_change_qoq'},
    {causeScope:'mixed'},{companyId:'wdc'},{incidentId:'another'},{kind:'issuer_forecast'},
    {scopeId:'customer_margin'},{accountingBasis:'cash'},{qualifier:'exact'},{direction:'increase'},{value:-1},{value:null}]) {
    const d=structuredClone(data);Object.assign(d.verification.photoresistEvidence.find(r=>r.id==='tsmc_q1_margin_reported'),patch);
    expect(run(d).photoresistCheck.reportedDifference).toBeNull();
  }
  const d=structuredClone(data);
  d.verification.photoresistEvidence.find(r=>r.id==='tsmc_q1_margin_forecast').source.informationAvailableDate='2019-04-18';
  expect(run(d).photoresistCheck.reportedDifference).toBeNull();
  const dup=structuredClone(data);
  dup.verification.photoresistEvidence.push({...dup.verification.photoresistEvidence.find(r=>r.id==='tsmc_q1_margin_reported'),claimStatus:'unreviewed'});
  expect(run(dup).photoresistCheck.reportedDifference).toBeNull();
});
it('cannot turn replacement forecasts, mixed outcomes or unrelated charges into verified recoveries',()=>{
  for(const [id,patch,key] of [
    ['tsmc_q2_replacement_forecast',{kind:'reported_outcome'},'replacementRevenueForecast'],
    ['tsmc_q1_mixed_uplift_forecast',{causeScope:'incident_only'},'mixedRevenueUpliftForecast'],
    ['tsmc_q2_margin_reported',{metric:'incident_gross_margin_improvement'},'q2MixedMarginReported']]) {
    const d=structuredClone(data);Object.assign(d.verification.photoresistEvidence.find(r=>r.id===id),patch);
    expect(run(d).photoresistCheck[key]).toBeNull();
    expect(run(d).photoresistCheck.realizedCatchupRevenue).toBeNull();
  }
  const d=structuredClone(data);d.followup.bases.find(r=>r.id==='tsmc_photoresist_charge').units='USD million';
  expect(run(d).photoresistCheck.recognizedCharge).toBeNull();
});
it('blocks duplicate WDC charge and recovery IDs even when one copy is unreviewed',()=>{
  for(const [group,key,id] of [
    ['reconciliation','records','wdc_contamination_fy2022'],['allocation','accounts','wdc_contamination_linked'],
    ['followup','bases','wdc_contamination_charge'],['followup','recoveries','wdc_contamination_recovery_fy2024'],
    ['verification','records','wdc_recovery_2024q2_insurer'],['verification','records','wdc_recovery_2024q3_unassigned'],
    ['verification','records','wdc_recovery_2024_nine_months']]) {
    for(const patch of [{value:999},{claimStatus:'unreviewed'}]) {
      const d=structuredClone(data), rows=d[group][key];
      rows.push({...rows.find(r=>r.id===id),...patch});
      expect(run(d).selectedNetCharge).toBeNull();
      rows.reverse();
      expect(run(d).selectedNetCharge).toBeNull();
    }
  }
  const d=structuredClone(data);
  d.verification.records.find(r=>r.id==='wdc_recovery_2024q3_unassigned').periodStart='2023-12-31';
  expect(run(d).selectedNetCharge).toBeNull();
});
