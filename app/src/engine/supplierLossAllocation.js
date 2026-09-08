import { reviewedClaim, validDate } from './evidenceContract.js';

const boundary = ['costBoundaryId','incidentId','units','metric','causeScope','scopeType','accountingBasis','perspectiveId','snapshotDate','periodStart','periodEnd'];
const present = value => typeof value === 'string' && value.trim().length > 0;
const number = value => Number.isFinite(value) && value >= 0;
const tidy = value => Number(value.toPrecision(12));

// Allocation changes who bears a declared cost. It does not create another loss.
export function supplierLossAllocation(data, asOf) {
  const accounts = [], rules = [], rejected = [], ids = new Set();
  function unique(row) {
    if (!row.id || ids.has(row.id)) throw new Error('Missing or duplicate allocation evidence ID');
    ids.add(row.id);
  }
  for (const a of data.accounts || []) {
    unique(a);
    let reason;
    if (!reviewedClaim(a, asOf)) reason = 'Unreviewed or unavailable source';
    else if (!number(a.value) || !validDate(a.snapshotDate) || a.snapshotDate > asOf
      || !['reported_outcome','issuer_retrospective_estimate'].includes(a.kind)
      || ['companyId','costBoundaryId','incidentId','units','accountingBasis','perspectiveId','metric','sector','causeScope'].some(k => !present(a[k]))) reason = 'Invalid loss base';
    else if (a.scopeType === 'accounting_period') {
      if (!validDate(a.periodStart) || !validDate(a.periodEnd) || a.periodStart > a.periodEnd || a.periodEnd > a.source.publicationDate) reason = 'Invalid accounting period';
    } else if (a.scopeType !== 'recall_population' || a.periodStart !== null || a.periodEnd !== null) reason = 'Unspecified cost boundary';
    if (reason) rejected.push({id:a.id, reason}); else accounts.push(a);
  }
  for (const r of data.rules || []) {
    unique(r);
    const a = accounts.find(a => a.id === r.baseId);
    let reason;
    if (!reviewedClaim(r, asOf)) reason = 'Unreviewed or unavailable allocation evidence';
    else if (!a || boundary.some(k => !(k in r) || r[k] !== a[k])) reason = 'Mismatched loss boundary, period, currency or perspective';
    else if (!present(r.supplierCompanyId) || r.supplierCompanyId === a.companyId || r.customerCompanyId !== a.companyId) reason = 'Invalid supplier/customer attribution';
    else if (!/^\d{4}-\d{2}$/.test(r.effectiveMonth || '') || !validDate(r.effectiveMonth + '-01') || r.effectiveMonth > asOf.slice(0,7)) reason = 'Agreement not effective';
    else if (!number(r.value) || !['fixed_amount','cost_share'].includes(r.type)
      || (r.type === 'cost_share' && (r.value > 1 || r.kind !== 'disclosed_contract'))
      || (r.type === 'fixed_amount' && !['issuer_retrospective_estimate','reported_outcome'].includes(r.kind))
      || !present(r.settlementStatus)) reason = 'Not a quantified incident cost allocation';
    if (reason) rejected.push({id:r.id, baseId:r.baseId, reason}); else rules.push(r);
  }
  const results = accounts.map(a => {
    const selected = rules.filter(r => r.baseId === a.id);
    const invalid = rejected.some(r => r.baseId === a.id);
    const suppliers = new Set(selected.map(r => r.supplierCompanyId));
    const amounts = selected.map(r => ({ruleId:r.id, supplierCompanyId:r.supplierCompanyId,
      amount:tidy(r.type === 'fixed_amount' ? r.value : a.value*r.value), units:a.units,
      method:r.type, qualifier:r.qualifier || a.qualifier || null, settlementStatus:r.settlementStatus,
      derived:r.type === 'cost_share', source:r.source, cashPaid:null}));
    const sum = tidy(amounts.reduce((s,r) => s+r.amount,0));
    const error = invalid ? 'Rejected allocation evidence for this base' : suppliers.size !== selected.length ? 'Duplicate supplier allocation would double-count'
      : sum > a.value ? 'Allocation exceeds its loss base' : null;
    const active = selected.length > 0 && !error;
    return {...a, status:error ? 'invalid_allocation' : active ? 'allocated_for_disclosed_base' : 'supplier_allocation_unknown',
      reason:error, allocations:error ? [] : amounts, allocatedAmount:active ? sum : null,
      remainder:active ? tidy(a.value-sum) : null,
      remainderMeaning:'Portion of the disclosed base outside the named supplier allocation; not a measured final cash burden.',
      conservationResidual:active ? tidy(a.value-sum-tidy(a.value-sum)) : null,
      allocationIsEstimate:active ? a.kind !== 'reported_outcome' || selected.some(r => r.kind === 'issuer_retrospective_estimate') : null,
      finalCashLoss:null, allIndustryLoss:null};
  });
  return {asOf,accounts:results,rules,rejected,scopeGaps:data.scopeGaps || [],entities:data.entities || [],
    coverage:{disclosedBases:accounts.length,allocatedBases:results.filter(r => r.status === 'allocated_for_disclosed_base').length,
      unknownSupplierBases:results.filter(r => r.status === 'supplier_allocation_unknown').length,
      invalidBases:results.filter(r => r.status === 'invalid_allocation').length},
    allIndustryLoss:null, crossAccountTotal:null,
    limitation:'Different perspectives may describe the same cost. No cross-account total or extrapolation from ownership, output or purchasing shares is computed.'};
}
