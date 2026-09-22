import { readFileSync } from 'node:fs';
import { verifyChainLoss } from '../../app/src/engine/chainLossVerification.js';
import { writeAtomicJson } from '../src/atomic-json.js';
const root = new URL('../../', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(`docs/reference/${name}.json`,root)));
const report = verifyChainLoss({ verification:read('chain-loss-verification'), reconciliation:read('loss-reconciliations'),
  allocation:read('supplier-loss-allocations'), followup:read('semiconductor-loss-followup') }, new Date().toISOString().slice(0,10));
writeAtomicJson(new URL('docs/benchmarks/chain-loss-verification.json',root),report);
console.log(JSON.stringify({duplicateCheck:report.duplicateCharge.status,recoveryCheck:report.recoveryCheck.status,selectedNetCharge:report.selectedNetCharge,
  kioxiaRecoveryCheck:report.kioxiaCheck.status,kioxiaSelectedNetCharge:report.kioxiaCheck.selectedNetCharge,
  receiptCheck:report.recoveryCheck.quarterReceiptStatus,availabilityForecast:report.operationalCheck.selectedAvailabilityForecast?.value,
  photoresistCheck:report.photoresistCheck.status,chainWideLoss:report.chainWideLoss}));
console.log(JSON.stringify({ producerAccounts: report.producerScope.costAccounts.length,
  excludedDemandCosts: report.producerScope.otherCauseCosts.length, salesContext: report.producerScope.salesContext.status,
  observedSalesChange: report.producerScope.salesContext.change, incidentSalesLoss: report.producerScope.salesContext.incidentSalesLoss }));
console.log(JSON.stringify({ customerTransactions: report.customerEvidence.transactions.length,
  customerLoss: report.customerEvidence.customerLoss, affectedCustomerCount: report.customerEvidence.affectedCustomerCount,
  buyerScopeCheck: report.customerEvidence.counterpartyCheck.groupStatus, sellerBuyerDifference: report.customerEvidence.counterpartyCheck.sellerMinusBuyer }));
console.log(JSON.stringify({ inventoryScopes: report.customerEvidence.inventoryCheck.scopes.length,
  inventoryIncidentLoss: report.customerEvidence.inventoryCheck.incidentLoss }));
if (report.duplicateCharge.status !== 'consistent_duplicate_representations' || report.recoveryCheck.status !== 'reported_amounts_agree'
  || report.kioxiaCheck.status !== 'agrees_within_reported_precision' || report.kioxiaCheck.chargeStatus !== 'corroborated_same_charge'
  || report.recoveryCheck.quarterReceiptStatus !== 'receipt_reported_payment_medium_unspecified'
  || report.operationalCheck.status !== 'issuer_forecast_only' || report.chargePeriodCheck.status !== 'reported_periods_reconcile'
  || report.historicalRecoveryCheck.status !== 'historical_amount_corroborated_not_additive'
  || report.photoresistCheck.status !== 'issuer_estimates_agree'
  || report.producerScope.costAccounts.length !== 2 || report.producerScope.otherCauseCosts.length !== 2
  || report.producerScope.salesContext.status !== 'reported_sales_change_mixed_causes'
  || report.customerEvidence.transactions.length !== 3
  || report.customerEvidence.inventoryCheck.scopes.length !== 4
  || report.customerEvidence.counterpartyCheck.groupStatus !== 'reported_scopes_reconcile'
  || report.customerEvidence.counterpartyCheck.sellerMinusBuyer === null) process.exitCode = 1;
