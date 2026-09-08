import { reviewedClaim, validDate } from './evidenceContract.js';

// Final output is one accounting boundary. Upstream sales, issuer shortfalls
// and overlapping sector estimates are alternative views, never extra damage.
export function chainLossAccounts(data, asOf) {
  const ids = new Set(), estimates = [], rejected = [];
  for (const r of data.sectorEstimates || []) {
    if (!r.id || ids.has(r.id)) throw new Error('Duplicate or missing sector estimate ID');
    ids.add(r.id);
    if (!reviewedClaim(r, asOf) || !validDate(r.periodStart) || !validDate(r.periodEnd)
      || r.periodStart > r.periodEnd || r.source.publicationDate < r.periodEnd
      || r.kind !== 'external_retrospective_estimate' || !Number.isFinite(r.value) || r.value < 0
      || !['approximately','greater_than'].includes(r.qualifier)
      || !r.scopeId || !r.metric || !r.units || !r.causeScope || !r.estimator
      || r.accountingBoundary !== 'final_vehicle_output') { rejected.push(r.id); continue; }
    estimates.push(r);
  }
  return { asOf, estimates, rejected, allIndustryLoss: null, upstreamAllocation: null,
    coverage: [
      { scope: 'global_light_vehicles', status: estimates.length ? 'external_sector_estimates_available' : 'unavailable' },
      { scope: 'other_semiconductor_end_markets', status: 'unavailable' },
      { scope: 'supplier_and_plant_loss_allocation', status: 'unavailable' },
    ],
    aggregate(selectedIds) {
      if (!selectedIds.length || new Set(selectedIds).size !== selectedIds.length) throw new Error('Empty or duplicate selection');
      const selected = selectedIds.map(id => estimates.find(r => r.id === id));
      if (selected.some(r => !r)) throw new Error('Only available sector estimates may be selected; issuer records cannot be added');
      const first = selected[0];
      if (selected.some(r => ['scopeId','metric','units','causeScope','accountingBoundary','estimator'].some(k => r[k] !== first[k]))) throw new Error('Incompatible accounting scopes');
      for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) {
        if (selected[i].periodStart <= selected[j].periodEnd && selected[j].periodStart <= selected[i].periodEnd) throw new Error('Overlapping periods would double-count losses');
      }
      const threshold = selected.reduce((s,r) => s + r.value, 0);
      // Approximate terms prevent treating a combined threshold as a rigorous bound.
      return { scopeId: first.scopeId, metric: first.metric, units: first.units,
        selectedRecordIds: selectedIds, reportedValueSum: threshold,
        qualifier: selected.length === 1 ? first.qualifier : selected.every(r => r.qualifier === 'approximately') ? 'approximately' : 'mixed_reported_precision',
        exactTotal: null, confidenceInterval: null, independentValidation: false,
        interpretation: 'Combination of published sector estimates for the selected non-overlapping periods; not measured all-industry loss.' };
    } };
}
