import { reviewedClaim, validDate } from './evidenceContract.js';
const same = (a,b, keys) => keys.every(k => a[k] === b[k]);
const boundary = ['companyId','incidentId','metric','units','periodStart','periodEnd','accountingBasis'];
const eligible = (r,asOf) => r && reviewedClaim(r,asOf) && r.kind === 'reported_outcome' && Number.isFinite(r.value) && r.value >= 0
  && validDate(r.periodStart) && validDate(r.periodEnd) && r.periodStart <= r.periodEnd && r.periodEnd <= r.source.publicationDate;
function oneReviewed(rows, id, asOf, predicate) {
  const matches = (rows || []).filter(r => r.id === id);
  return matches.length === 1 && reviewedClaim(matches[0], asOf) && predicate(matches[0]) ? matches[0] : null;
}
function verifyPhotoresist(verification, followup, asOf) {
  const select = (id, metric, kind, quarter, units, causeScope, direction) => oneReviewed(verification.photoresistEvidence, id, asOf,
    r => r.companyId === 'tsmc' && r.incidentId === 'photoresist_contamination_2019' && r.metric === metric && r.kind === kind
      && r.units === units && r.causeScope === causeScope && r.direction === direction && Number.isFinite(r.value) && r.value >= 0
      && r.periodStart === (quarter === 1 ? '2019-01-01' : '2019-04-01') && r.periodEnd === (quarter === 1 ? '2019-03-31' : '2019-06-30')
      && (kind === 'issuer_forecast' ? r.source.informationAvailableDate < r.periodEnd : r.periodEnd <= r.source.publicationDate));
  const forecast = select('tsmc_q1_margin_forecast', 'incident_gross_margin_reduction', 'issuer_forecast', 1, 'percentage points', 'incident_only', 'decrease');
  const reported = select('tsmc_q1_margin_reported', 'incident_gross_margin_reduction', 'reported_outcome', 1, 'percentage points', 'incident_only', 'decrease');
  const compatible = forecast && reported && same(forecast, reported, [...boundary, 'scopeId', 'direction'])
    && forecast.scopeId === 'company_gross_margin' && forecast.accountingBasis === 'issuer_attributed_margin_effect'
    && forecast.qualifier === 'approximately' && reported.qualifier === 'approximately'
    && forecast.source.informationAvailableDate < reported.source.informationAvailableDate;
  const charge = oneReviewed(followup.bases, 'tsmc_photoresist_charge', asOf, r => eligible(r, asOf)
    && r.companyId === 'tsmc' && r.incidentId === 'photoresist_contamination_2019' && r.units === 'TWD million'
    && r.metric === 'cost_of_revenue_charge' && r.accountingBasis === 'IFRS_cost_of_revenue'
    && r.periodStart === '2019-01-01' && r.periodEnd === '2019-03-31');
  return {
    status: !compatible ? 'missing_or_incompatible_evidence' : forecast.value === reported.value ? 'issuer_estimates_agree' : 'issuer_estimates_differ',
    marginForecast: forecast, marginReported: reported,
    reportedDifference: compatible ? Number((reported.value - forecast.value).toFixed(6)) : null,
    comparisonUnits: 'percentage points', independentOutcome: false, modelValidationEligible: false,
    comparisonLimitation: 'The same issuer supplied the forecast and retrospective attribution, both approximate. Agreement is not independent causal validation or a test of this app model.',
    revenueShortfallForecast: select('tsmc_q1_revenue_shortfall_forecast', 'incident_revenue_reduction', 'issuer_forecast', 1, 'USD million', 'incident_only', 'decrease'),
    replacementRevenueForecast: select('tsmc_q2_replacement_forecast', 'replacement_revenue', 'issuer_forecast', 2, 'USD million', 'incident_only', 'increase'),
    mixedRevenueUpliftForecast: select('tsmc_q1_mixed_uplift_forecast', 'additional_revenue', 'issuer_forecast', 1, 'USD million', 'mixed', 'increase'),
    q2MarginForecast: select('tsmc_q2_margin_forecast', 'incident_gross_margin_improvement', 'issuer_forecast', 2, 'percentage points', 'incident_only', 'increase'),
    q2MixedMarginReported: select('tsmc_q2_margin_reported', 'total_gross_margin_change_qoq', 'reported_outcome', 2, 'percentage points', 'mixed', 'increase'),
    recognizedCharge: charge, q2IncidentOnlyDifference: null, realizedCatchupRevenue: null, permanentRevenueLoss: null,
    supplierReimbursement: null, supplierCompanyId: null, downstreamCustomerLoss: null, finalIncidentLossVerified: false,
    lossLimitation: 'Revenue shortfall and replacement sales are forecasts, not realized losses or payments. The mixed Q1 uplift cannot be assigned entirely to mitigation. Q2 total margin improvement includes foreign exchange and cannot score the incident-only forecast. The TWD accounting charge is a different measure and cannot be added to USD revenue or percentage-point margin effects.',
  };
}
function verifyChargePeriods(verification, annual, asOf) {
  const beforeQ4 = oneReviewed(verification.records, 'wdc_charge_2022_nine_months', asOf, r => eligible(r, asOf));
  const q4 = oneReviewed(verification.records, 'wdc_charge_2022q4', asOf, r => eligible(r, asOf));
  const compatible = eligible(annual, asOf) && beforeQ4 && q4
    && [beforeQ4, q4].every(r => same(r, annual, ['companyId','incidentId','metric','units','accountingBasis']))
    && beforeQ4.periodStart === annual.periodStart && q4.periodEnd === annual.periodEnd
    && Date.parse(q4.periodStart) - Date.parse(beforeQ4.periodEnd) === 86400000;
  const residual = compatible ? annual.value - beforeQ4.value - q4.value : null;
  return { status: !compatible ? 'missing_or_incompatible_periods' : residual === 0 ? 'reported_periods_reconcile' : 'conflicting_reported_amounts',
    nineMonths: beforeQ4, finalQuarter: q4, annualValue: eligible(annual, asOf) ? annual.value : null,
    residual, units: 'USD million', reportedYearCovered: Boolean(compatible && residual === 0),
    finalIncidentLossVerified: false,
    limitation: 'The nine-month and final-quarter disclosures cover one fiscal year without overlap. The Q4 amount comes from a preliminary earnings release. This checks reported charges, not final incident losses or predictive accuracy.' };
}
function verifyHistoricalRecovery(verification, insurerQuarter, asOf) {
  const historical = oneReviewed(verification.records, 'sandisk_historical_insurance_2024', asOf, r => eligible(r, asOf));
  const relationship = oneReviewed(verification.reportingRelationships, 'sandisk_pre_separation_accounts', asOf,
    r => r.type === 'historical_carveout' && r.fromCompanyId === 'wdc' && r.toCompanyId === 'sandisk' && validDate(r.separationDate));
  const compatible = historical && insurerQuarter && relationship && historical.companyId === relationship.toCompanyId
    && insurerQuarter.companyId === relationship.fromCompanyId && relationship.relatedRecordId === historical.id
    && relationship.parentRecordId === insurerQuarter.id && same(historical, insurerQuarter, ['incidentId','metric','units','counterpartyClass'])
    && historical.counterpartyClass === 'insurer' && historical.accountingBasis === 'historical_flash_business_carveout'
    && historical.periodEnd < relationship.separationDate && historical.periodStart <= insurerQuarter.periodStart
    && historical.periodEnd >= insurerQuarter.periodEnd && historical.value === insurerQuarter.value;
  return { status: compatible ? 'historical_amount_corroborated_not_additive' : 'missing_or_incompatible_evidence',
    historicalDisclosure: historical, reportingRelationship: relationship, matchedOriginalId: compatible ? insurerQuarter.id : null,
    includedAsAdditionalRecovery: false, supplierAllocation: null,
    limitation: 'A later filing of the former flash business repeats a pre-separation recovery. It does not document an additional payment or allocate the difference between insurer recovery and WDC total recovery.' };
}
function verifyOperationalEvidence(verification, asOf) {
  const all = verification.operationalEvidence || [];
  const forecastValid = r => r.kind === 'issuer_forecast' && r.companyId === 'wdc' && r.incidentId === 'nand_contamination_2022'
    && r.metric === 'flash_availability_reduction' && r.units === 'exabytes' && r.scopeId === 'wdc_own_flash_availability'
    && Number.isFinite(r.value) && r.value >= 0;
  const initial = oneReviewed(all, 'wdc_flash_availability_initial', asOf, r => forecastValid(r) && r.qualifier === 'at_least' && r.supersedesId === null);
  const update = oneReviewed(all, 'wdc_flash_availability_update', asOf, r => forecastValid(r) && r.qualifier === 'approximately');
  const updateDue = all.some(r => r.id === 'wdc_flash_availability_update' && validDate(r.source?.publicationDate) && r.source.publicationDate <= asOf);
  const revisionValid = initial && update && update.supersedesId === initial.id && initial.source.informationAvailableDate < update.source.informationAvailableDate;
  const selected = updateDue ? (revisionValid ? update : null) : initial;
  const restoration = oneReviewed(all, 'kioxia_operations_restored', asOf, r => r.companyId === 'kioxia'
    && r.incidentId === 'nand_contamination_2022' && r.kind === 'reported_outcome' && r.metric === 'normal_operations_restored');
  const mixed = oneReviewed(all, 'wdc_q3_mixed_adjustment_forecast', asOf, r => r.companyId === 'wdc'
    && r.incidentId === 'nand_contamination_2022' && r.kind === 'issuer_forecast' && r.metric === 'non_gaap_gross_margin_adjustments'
    && r.causeScope === 'mixed' && r.units === 'USD million' && Number.isFinite(r.lower) && Number.isFinite(r.upper) && r.lower <= r.upper);
  return { status: selected ? 'issuer_forecast_only' : 'missing_or_incompatible_evidence',
    availabilityHistory: [initial, update].filter(Boolean), selectedAvailabilityForecast: selected, restoration, mixedAdjustmentForecast: mixed,
    finalMeasuredAvailabilityLoss: null, customerLoss: null, monetizedLoss: null, calibrationEligible: false,
    limitation: 'The availability estimates are revisions of one WDC forecast. Restart is not full-output or backlog recovery. No final measured flash shortfall or customer-level loss is established.',
    excludedComparison: 'The mixed quarterly outlook adjustment cannot be validated against the annual contamination-only charge.' };
}
function verifyKioxia(verification, allocation, asOf) {
  // Select by ID without allowing conflicting copies to disappear behind find().
  const one = id => {
    const matches = (verification.records || []).filter(r => r.id === id);
    return matches.length === 1 && eligible(matches[0], asOf) ? matches[0] : null;
  };
  const precise = one('kioxia_recovery_fy2023_precise');
  const rounded = one('kioxia_recovery_fy2023_rounded');
  const charge = one('kioxia_charge_fy2021_corroboration');
  const originals = (allocation.accounts || []).filter(r => r.id === 'kioxia_contamination_fy2021');
  const original = originals.length === 1 ? originals[0] : null;
  const precisionValid = r => r && Number.isFinite(r.roundingUnit) && r.roundingUnit > 0;
  const recoveryCompatible = precise && rounded && same(precise, rounded, boundary)
    && precise.companyId === 'kioxia' && precise.incidentId === 'nand_contamination_2022'
    && precise.metric === 'recognized_recovery' && precise.accountingBasis === 'IFRS_operating_income_effect'
    && precise.units === 'JPY billion' && [precise, rounded].every(r => r.counterpartyClass === 'insurer' && precisionValid(r));
  const tolerance = recoveryCompatible ? (precise.roundingUnit + rounded.roundingUnit) / 2 : null;
  const recoveryAgrees = recoveryCompatible && Math.abs(precise.value - rounded.value) <= tolerance;
  const chargeAgrees = charge && eligible(original, asOf) && precisionValid(charge)
    && same(charge, original, boundary.filter(k => k !== 'accountingBasis')) && charge.value === original.value
    && charge.accountingBasis === 'IFRS_operating_income_effect' && original.accountingBasis === 'IFRS_operating_income_charge';
  const netAllowed = chargeAgrees && recoveryAgrees && same(charge, precise, ['companyId','incidentId','units','accountingBasis'])
    && charge.metric === 'operating_income_reduction' && charge.periodEnd < precise.periodStart;
  const arithmetic = netAllowed ? charge.value - precise.value : null;
  const roundingRadius = netAllowed ? (charge.roundingUnit + precise.roundingUnit) / 2 : null;
  return {
    status: !recoveryCompatible ? 'missing_or_incompatible_evidence' : recoveryAgrees ? 'agrees_within_reported_precision' : 'conflicting_recovery_amounts',
    chargeStatus: chargeAgrees ? 'corroborated_same_charge' : 'missing_or_conflicting_charge',
    charge: charge || null, preciseRecovery: precise, roundedRecovery: rounded, recoveryRoundingTolerance: tolerance,
    selectedNetCharge: netAllowed ? Number(arithmetic.toFixed(1)) : null, units: 'JPY billion',
    roundingRange: netAllowed ? { lower: Number((arithmetic - roundingRadius).toFixed(4)), upper: Number((arithmetic + roundingRadius).toFixed(4)) } : null,
    netLabel: 'Approximate Kioxia FY2021 charge less the selected FY2023 insurance income; incomplete company account, not final cash loss.',
    roundingLimitation: 'Range reflects only published rounding, assuming nearest-unit rounding; it is not a confidence interval or a bound on undisclosed losses.',
    recoveriesCounted: recoveryAgrees ? 1 : 0, materialSupplierAllocation: null, finalSettlementVerified: false,
  };
}
function verifyProducerScope(verification, wdcCharge, kioxiaCharge, asOf) {
  const costAccounts = [
    ['wdc_contamination_cost_scope', wdcCharge, 'cost_of_revenue'],
    ['kioxia_contamination_cost_scope', kioxiaCharge, 'cost_of_sales'],
  ].map(([id, parent, line]) => oneReviewed(verification.producerCostEvidence, id, asOf, r => eligible(r, asOf)
    && parent && same(r, parent, boundary) && r.value === parent.value && r.relatedRecordId === parent.id
    && r.accountingLine === line && Array.isArray(r.components)
    && ['principal_categories_not_exhaustive', 'not_itemized'].includes(r.componentCoverage)
    && r.components.every(c => typeof c.id === 'string' && typeof c.label === 'string' && c.value === null)
    && new Set(r.components.map(c => c.id)).size === r.components.length))
    .filter(Boolean).map(r => ({ ...r, status: 'reported_charge_scope_corroborated', componentTotal: null,
      componentAllocationVerified: false, includedAsAdditionalCharge: false }));
  const otherCauseCosts = ['wdc_demand_utilization_2023', 'wdc_demand_utilization_2024']
    .map(id => oneReviewed(verification.otherCauseCosts, id, asOf, r => eligible(r, asOf)
      && r.companyId === 'wdc' && r.incidentId === null && r.causeScope === 'demand_alignment'
      && r.metric === 'underutilization_cost' && r.units === 'USD million' && r.accountingBasis === 'reported_accounting_amount'))
    .filter(Boolean).map(r => ({ ...r, includedInIncidentAccount: false }));
  const sales = id => oneReviewed(verification.companySalesEvidence, id, asOf, r => eligible(r, asOf)
    && r.companyId === 'kioxia' && r.incidentId === null && r.metric === 'company_sales'
    && r.units === 'JPY billion' && r.accountingBasis === 'IFRS_company_sales' && r.roundingUnit === 0.1);
  const before = sales('kioxia_sales_calendar_2022q1'), after = sales('kioxia_sales_calendar_2022q2');
  const consecutive = before && after && same(before, after, ['companyId', 'metric', 'units', 'accountingBasis'])
    && before.periodStart === '2022-01-01' && before.periodEnd === '2022-03-31'
    && after.periodStart === '2022-04-01' && after.periodEnd === '2022-06-30';
  const attribution = oneReviewed(verification.salesAttributionEvidence, 'kioxia_sales_2022q2_mixed_causes', asOf,
    r => after && r.companyId === 'kioxia' && r.incidentId === 'nand_contamination_2022' && r.kind === 'reported_outcome'
      && r.metric === 'shipment_disruption_attribution' && same(r, after, ['periodStart', 'periodEnd'])
      && r.causeScope === 'mixed' && Array.isArray(r.components)
      && ['manufacturing_contamination', 'covid_assembly_test_logistics'].every(c => r.components.includes(c))
      && r.bitGrowthValue === null && r.incidentSalesLoss === null && r.customerLoss === null && r.catchupAmount === null);
  return {
    costAccounts, otherCauseCosts,
    salesContext: { status: consecutive && attribution ? 'reported_sales_change_mixed_causes' : 'missing_or_incompatible_evidence',
      before, after, attribution, change: consecutive ? Number((after.value - before.value).toFixed(1)) : null,
      units: 'JPY billion', incidentSalesLoss: null, customerLoss: null, calibrationEligible: false,
      limitation: 'The quarter-to-quarter difference is observed company sales, not a no-incident counterfactual. Shipment disruption has multiple causes; pricing and currency also change revenue. No portion is allocated to contamination or downstream customers.' },
    physicalDamage: null, combinedProducerLoss: null,
    limitation: 'Source-reconciled accounting charges remain separate company accounts. Components, intercompany eliminations and lost value added are insufficient to establish a combined economic loss.',
  };
}
function verifyCounterpartyPurchases(verification, transactions, asOf) {
  const select = (id, scope) => oneReviewed(verification.counterpartyPurchaseEvidence, id, asOf, r => eligible(r, asOf)
    && r.companyId === 'apacer' && r.supplierId === 'phison' && r.buyerScopeId === scope
    && r.incidentId === null && r.incidentLoss === null && r.units === 'TWD thousand' && r.roundingUnit === 1
    && r.metric === 'related_party_purchases' && r.accountingBasis === 'reported_2022_consolidation_scope'
    && r.periodStart === '2022-01-01' && r.periodEnd === '2022-12-31');
  const parent = select('apacer_parent_phison_purchases_2022', 'apacer_parent');
  const parentNote = select('apacer_parent_phison_purchases_note_2022', 'apacer_parent');
  const subsidiary = select('apacer_udinfo_phison_purchases_2022', 'udinfo_in_apacer_consolidation');
  const group = select('apacer_group_phison_purchases_2022', 'apacer_consolidated');
  const consolidation = oneReviewed(verification.counterpartyConsolidationEvidence, 'apacer_udinfo_consolidation_2022', asOf,
    r => r.kind === 'reported_consolidation_scope' && r.companyId === 'apacer' && r.includedCompanyId === 'udinfo'
      && r.groupScopeId === group?.buyerScopeId && r.componentScopeId === subsidiary?.buyerScopeId
      && validDate(r.consolidationStartDate) && r.consolidationStartDate === r.controlObtainedDate
      && r.consolidationStartDate >= group.periodStart && r.consolidationStartDate <= group.periodEnd);
  const corroborated = parent && parentNote && parent.value === parentNote.value;
  const residual = corroborated && subsidiary && group && consolidation ? group.value - parent.value - subsidiary.value : null;
  const seller = transactions.find(r => r.id === 'phison_sale_apacer_2022') || null;
  const comparable = corroborated && seller && same(parent, seller, ['periodStart', 'periodEnd', 'units'])
    && seller.supplierId === parent.supplierId && seller.customerId === 'apacer' && seller.transactionType === 'sale';
  const difference = comparable ? seller.value - parent.value : null;
  return { parent, parentNote, subsidiary, group, consolidation, seller, units: 'TWD thousand',
    parentStatus: !parent || !parentNote ? 'missing_evidence' : corroborated ? 'same_parent_amount_corroborated' : 'conflicting_parent_amounts',
    groupStatus: residual === null ? 'missing_or_incompatible_evidence' : residual === 0 ? 'reported_scopes_reconcile' : 'unreconciled_scope_difference',
    groupResidual: residual,
    counterpartyStatus: difference === null ? 'missing_or_incompatible_evidence' : difference === 0 ? 'reported_amounts_agree' : 'unreconciled_difference',
    sellerMinusBuyer: difference, differenceExplanation: null, lossFromDifference: null, combinedTransactionTotal: null,
    limitation: 'Compare the group total with its parent and UD INFO components within the reported consolidation scope. A seller/buyer difference requires a transaction bridge; timing, returns and other adjustments have not been established. It is not an incident loss, and seller revenue cannot be added to buyer purchases.',
  };
}
function verifyCustomerInventory(verification, asOf) {
  const scopes = ['phison', 'apacer'].flatMap(companyId => ['consolidated', 'parent'].map(scope => {
    const scopeId = `${companyId}_${scope}`;
    const select = year => oneReviewed(verification.customerInventoryEvidence, `${scopeId}_inventory_expense_${year}`, asOf,
      r => eligible(r, asOf) && r.companyId === companyId && r.scopeId === scopeId
        && r.metric === 'inventory_valuation_expense' && r.units === 'TWD thousand' && r.roundingUnit === 1
        && r.periodStart === `${year}-01-01` && r.periodEnd === `${year}-12-31`
        && r.accountingBasis === 'expense_in_cost_of_revenue' && r.attributionStatus === 'incident_unspecified'
        && r.incidentId === null && r.incidentLoss === null && r.affectedInventoryLots === null && r.cashLoss === null);
    const current = select(2022), prior = select(2021);
    return { scopeId, current, prior, includedInIncidentAccount: false, calibrationEligible: false };
  })).filter(s => s.current || s.prior);
  return { status: scopes.length ? 'reported_expenses_without_incident_attribution' : 'missing_or_incompatible_evidence',
    scopes, incidentLoss: null, cashLoss: null, combinedExpense: null, calibrationEligible: false,
    limitation: 'Parent and consolidated scopes overlap and must not be added. The 2021 amounts are historical context, not a no-incident counterfactual. Changing group composition also prevents treating the year-to-year difference as an incident effect. These expenses are not verified contamination losses or cash payments.',
    nextEvidence: 'A source-backed bridge from affected inventory lots to the booked expense, separating pricing and obsolescence from contamination, with reversals, recoveries and consolidation eliminations. Shipment shortfalls, replacement premiums and later catch-up require separate evidence.',
  };
}
function verifyCustomerEvidence(verification, asOf) {
  const definitions = [
    ['phison_purchase_kioxia_taiwan_2022', 'purchase', 'kioxia_taiwan', 'phison'],
    ['phison_sale_kioxia_2022', 'sale', 'phison', 'kioxia'],
    ['phison_sale_apacer_2022', 'sale', 'phison', 'apacer'],
  ];
  const transactions = definitions.map(([id, type, supplier, customer]) => oneReviewed(verification.customerTransactions, id, asOf,
    r => eligible(r, asOf) && r.companyId === 'phison' && r.incidentId === null
      && r.metric === 'commercial_transaction' && r.reportingScope === 'phison_parent_company'
      && r.accountingBasis === 'related_party_commercial_transactions' && r.units === 'TWD thousand'
      && r.transactionType === type && r.supplierId === supplier && r.customerId === customer
      && r.periodStart === '2022-01-01' && r.periodEnd === '2022-12-31'
      && r.sourceSignedValue === (type === 'sale' ? -r.value : r.value)
      && Number.isFinite(r.sharePercent) && r.sharePercent > 0 && r.sharePercent <= 100
      && r.sourceSignedSharePercent === (type === 'sale' ? -r.sharePercent : r.sharePercent)
      && r.percentageRoundingUnit === 1
      && r.shareBasis === `Phison parent-company total ${type === 'sale' ? 'sales' : 'purchases'}`
      && r.supplierFacilityId === null && r.affectedShipments === null && r.incidentLoss === null && r.inputVolumeShare === null))
    .filter(Boolean).map(r => ({ ...r, includedInLossTotal: false, propagationWeight: null }));
  const supplierAssessment = oneReviewed(verification.customerSupplyStatements, 'phison_supplier_concentration_2022_report', asOf,
    r => r.companyId === 'phison' && r.supplierId === 'kioxia_taiwan' && r.incidentId === null
      && r.kind === 'issuer_qualitative_assessment' && validDate(r.statementAsOf) && r.statementAsOf <= r.source.publicationDate
      && r.incidentLoss === null && r.outageDays === null && r.mitigationEffect === null);
  return { status: transactions.length ? 'commercial_relationships_only' : 'missing_or_incompatible_evidence',
    counterpartyCheck: verifyCounterpartyPurchases(verification, transactions, asOf),
    inventoryCheck: verifyCustomerInventory(verification, asOf),
    transactions, supplierAssessment, customerLoss: null, affectedCustomerCount: null, coverageFraction: null,
    completePopulationVerified: false, calibrationEligible: false,
    limitation: 'These selected related-party transactions establish commercial relationships, not affected shipments. The table is thresholded and is not a complete customer population. Annual spending and sales percentages cannot allocate contamination loss.',
    nextEvidence: 'Incident-specific shipment shortfalls, substitute purchases, inventory use, catch-up and incremental costs for the named trading partners.',
  };
}
export function verifyChainLoss({ verification = {}, reconciliation = {}, allocation = {}, followup = {} }, asOf) {
  const representations = [
    ['loss-reconciliations', oneReviewed(reconciliation.records, 'wdc_contamination_fy2022', asOf, r => eligible(r, asOf))],
    ['supplier-loss-allocations', oneReviewed(allocation.accounts, 'wdc_contamination_linked', asOf, r => eligible(r, asOf))],
    ['semiconductor-loss-followup', oneReviewed(followup.bases, 'wdc_contamination_charge', asOf, r => eligible(r, asOf))],
  ];
  const rows = representations.map(([,r]) => r);
  const valid = rows.every(r => eligible(r,asOf));
  const consistent = valid && rows.every(r => same(r,rows[0],boundary) && r.value === rows[0].value);
  const duplicateCharge = { status: !valid ? 'missing_or_unavailable_evidence' : consistent ? 'consistent_duplicate_representations' : 'conflicting_representations',
    representations: representations.map(([dataset,r]) => ({ dataset, id:r?.id || null, value:eligible(r,asOf) ? r.value : null, sourceUrl:r?.source?.url || null })),
    acceptedCharge: consistent ? rows[0].value : null, units: 'USD million',
    interpretation: 'These records describe one WDC charge. Adding them would count the same charge three times.' };
  const selectRecovery = id => oneReviewed(verification.records, id, asOf, r => eligible(r, asOf));
  const q2 = selectRecovery('wdc_recovery_2024q2_insurer');
  const q3 = selectRecovery('wdc_recovery_2024q3_unassigned');
  const ytd = selectRecovery('wdc_recovery_2024_nine_months');
  const annual = oneReviewed(followup.recoveries, 'wdc_contamination_recovery_fy2024', asOf, r => eligible(r, asOf));
  const compatible = [q2,q3,ytd,annual].every(r => eligible(r,asOf))
    && [q2,q3,annual].every(r => same(r,ytd,['companyId','incidentId','units','accountingBasis']))
    && [q2,q3,ytd].every(r => r.metric === 'recognized_recovery') && annual.measure === 'recognized_recovery'
    && q2.periodStart >= ytd.periodStart && Date.parse(q3.periodStart) - Date.parse(q2.periodEnd) === 86400000 && q3.periodEnd === ytd.periodEnd
    && annual.periodStart === ytd.periodStart && annual.periodEnd >= ytd.periodEnd;
  const residual = compatible ? ytd.value - q2.value - q3.value : null;
  const agrees = compatible && residual === 0 && annual.value === ytd.value;
  const chargePeriodCheck = verifyChargePeriods(verification, consistent ? rows[0] : null, asOf);
  const receipt = oneReviewed(verification.receiptEvidence, 'wdc_march2024_receipt', asOf, r => q3
    && same(r, q3, ['companyId','incidentId','periodStart','periodEnd']) && r.relatedRecordId === q3.id
    && r.metric === 'recovery_receipt_disclosure' && r.kind === 'reported_outcome' && r.reportedReceipt === true
    && validDate(r.periodStart) && validDate(r.periodEnd) && r.periodStart <= r.periodEnd && r.periodEnd <= r.source.publicationDate);
  const recoveryCheck = { status: !compatible ? 'incompatible_or_unavailable' : agrees ? 'reported_amounts_agree' : 'amounts_do_not_agree',
    insurerQuarter: q2 || null, unassignedQuarter: q3 || null, nineMonths: ytd || null,
    annualRecovery: eligible(annual,asOf) ? annual.value : null, residual, units:'USD million',
    cashFromUnassignedCounterparty:null, materialSupplierId:null, fullPeriodPartitionVerified:false,
    quarterReceiptStatus: receipt ? 'receipt_reported_payment_medium_unspecified' : 'receipt_not_verified', quarterReceiptEvidence: receipt,
    limitation: 'Amounts reconcile at published precision. No complete first-quarter account or counterparty identification is inferred.' };
  const unattributedRecoveries = [...new Set((verification.unattributedRecoveries || []).map(r => r.id))]
    .map(id => oneReviewed(verification.unattributedRecoveries, id, asOf, r => eligible(r, asOf)
      && r.companyId === 'kioxia' && r.incidentId === null && r.attributionStatus === 'incident_unspecified'
      && r.metric === 'insurance_claim_income' && r.units === 'JPY million' && r.accountingBasis === 'IFRS_other_income'))
    .filter(Boolean).map(r => ({ ...r, includedInIncidentAccount: false }));
  const governanceEvidence = [...new Set((verification.governanceEvidence || []).map(r => r.id))]
    .map(id => oneReviewed(verification.governanceEvidence, id, asOf, r => r.companyId === 'kioxia' && r.incidentId === null
      && validDate(r.asOfDate) && r.asOfDate <= r.source.publicationDate && Number.isFinite(r.votingRightsShare)
      && r.votingRightsShare >= 0 && r.votingRightsShare <= 1 && r.controlBasis === 'equal_decision_making'
      && r.accountingTreatment === 'IFRS joint operations' && r.incidentCostAllocation === null))
    .filter(Boolean);
  const kioxiaCheck = verifyKioxia(verification, allocation, asOf);
  return { asOf, duplicateCharge, recoveryCheck, chargePeriodCheck, historicalRecoveryCheck: verifyHistoricalRecovery(verification, q2, asOf), kioxiaCheck,
    producerScope: verifyProducerScope(verification, consistent ? rows[0] : null,
      kioxiaCheck.chargeStatus === 'corroborated_same_charge' ? kioxiaCheck.charge : null, asOf),
    customerEvidence: verifyCustomerEvidence(verification, asOf),
    unattributedRecoveries, governanceEvidence,
    operationalCheck: verifyOperationalEvidence(verification, asOf),
    photoresistCheck: verifyPhotoresist(verification, followup, asOf),
    boundaryEvidence: (verification.boundaryEvidence || []).filter(r => reviewedClaim(r, asOf)),
    periodObservations: (verification.periodObservations || []).filter(r => reviewedClaim(r, asOf)
      && validDate(r.periodStart) && validDate(r.periodEnd) && r.periodStart <= r.periodEnd && r.periodEnd <= r.source.publicationDate),
    productEvidence: (verification.productEvidence || []).filter(r => reviewedClaim(r, asOf) && r.kind === 'reported_outcome'
      && r.companyId === 'wdc' && r.incidentId === 'nand_contamination_2022' && validDate(r.periodStart) && validDate(r.periodEnd)
      && r.periodStart <= r.periodEnd && r.periodEnd <= r.source.publicationDate),
    selectedNetCharge: consistent && agrees && chargePeriodCheck.reportedYearCovered ? rows[0].value - annual.value : null,
    selectedNetLabel: 'WDC charge less the selected FY2024 recognized recovery; not final cash loss',
    documents: (verification.documents || []).filter(d => d.publicationDate <= asOf && (!d.informationAvailableDate || d.informationAvailableDate <= asOf)),
    chainWideLoss: null, independentlyValidated: false,
    completionRequirements: [
      { id: 'incident_attribution_and_settlement', scope: 'Company net cost and supplier allocation', status: 'open',
        needed: 'An incident-specific bridge from recognized recoveries to counterparties, cash receipts and final claims disposition, including whether later insurance income relates to this incident.',
        likelySource: 'Issuer claim schedules, insurer settlement notices or supplier settlement disclosures',
        blocks: 'Final company net cost and who bears it; transfers alone do not measure physical economic damage.' },
      { id: 'disjoint_producer_accounts', scope: 'Producer and joint-venture losses', status: 'open',
        needed: 'Incident costs split into destroyed inputs, incremental recovery costs and lost value added, with intercompany eliminations, consistent periods and a documented currency basis.',
        likelySource: 'Issuer and joint-venture incident cost reconciliations',
        blocks: 'A comparable producer subtotal without counting the same wafers or internal transactions twice.' },
      { id: 'customer_outcomes_and_population', scope: 'Complete chain-wide economic loss', status: 'open',
        needed: 'A defined affected supplier/customer population, observed output and catch-up, and an evidence-based counterfactual that separates deferred activity from permanent losses through an explicit end date.',
        likelySource: 'Matched supplier/customer production and order records or incident-specific public disclosures',
        blocks: 'Downstream loss, completeness of coverage and a defensible chain-wide total.' },
    ],
    completionOutlook: 'No reliable completion date: these requirements depend on incident-specific evidence that may not be public. More filings or software changes alone cannot close them.',
    unresolved: [
      'Identity and cash settlement of the USD 1 million quarterly recovery',
      'Final recovery or settlement of the remaining contamination claims',
      'Disjoint economic components across WDC, Kioxia and their joint ventures',
      'Customer-level lost output, catch-up production and permanently lost demand',
      'A complete population and consistent value-added accounting boundary across the chain',
    ],
    excludedCombinations: [
      'Repeated USD 207 million WDC records are one charge, not separate losses.',
      'The USD 203 million nine-month and USD 4 million final-quarter amounts partition the USD 207 million annual charge; do not add them to the annual total.',
      'Sandisk historical insurer recovery derives from WDC accounts and is not an additional recovery.',
      'The USD 36 million insurer amount and USD 1 million quarterly recovery are not additional to the USD 37 million total.',
      'Kioxia JPY 7.571 billion and JPY 7.6 billion disclosures represent one insurance recovery at different precision.',
      'WDC flash-availability forecasts of at least 6.5 and approximately 7 exabytes are revisions; they are not additive or measured downstream losses.',
      'Kioxia operating-income effects and WDC cost charges use different currencies, periods and accounting perspectives; no combined total is supported.',
      'Supplier or insurer payments redistribute the burden; they do not create or erase the same amount of physical chain-wide damage.',
    ] };
}
