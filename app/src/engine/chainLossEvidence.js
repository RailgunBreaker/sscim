import { reviewedClaim, validDate } from './evidenceContract.js';
export function chainLossEvidence(data, asOf) {
  const seen = new Set(), records = [], rejected = [];
  for (const row of data.records || []) {
    if (!row.id || seen.has(row.id)) throw new Error('Duplicate or missing loss record ID');
    seen.add(row.id);
    if (!reviewedClaim(row, asOf) || !validDate(row.periodStart) || !validDate(row.periodEnd)
      || row.periodStart > row.periodEnd || !Number.isFinite(row.value) || row.value < 0
      || !row.companyId || !row.incidentId || !row.units || !row.metric
      || !['reported_outcome', 'issuer_forecast'].includes(row.kind)
      || (row.units === 'fraction' && row.value > 1)
      || (row.kind === 'reported_outcome' && row.source.publicationDate < row.periodEnd)
      || (row.kind === 'issuer_forecast' && row.source.informationAvailableDate >= row.periodEnd)) {
      rejected.push(row.id); continue;
    }
    records.push(row);
  }
  const transmission = (data.transmissionEvidence || []).filter(r => reviewedClaim(r, asOf));
  return { asOf, records, rejected, transmission, chainWideLoss: null,
    reason: 'No complete chain denominator or identified allocation of downstream loss to individual upstream disruptions.',
    attributedEffects(incidentId) {
      return transmission.filter(r => r.incidentId === incidentId).map(r => ({ ...r,
        downstreamRecords: records.filter(o => o.companyId === r.customerCompanyId && o.incidentId === r.downstreamIncidentId),
        allocatedLoss: null }));
    },
    reportedSubtotal(ids) {
      if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Empty or duplicate subtotal selection');
      const chosen = ids.map(id => records.find(r => r.id === id));
      if (chosen.some(r => !r || r.kind !== 'reported_outcome')) throw new Error('Subtotal requires available reported outcomes');
      const first = chosen[0];
      if (first.units === 'fraction' || chosen.some(r => r.metric !== first.metric || r.units !== first.units || r.measurementBasis !== first.measurementBasis || r.causeScope !== first.causeScope)) throw new Error('Nonadditive or incompatible metrics');
      for (let i = 0; i < chosen.length; i++) for (let j = i + 1; j < chosen.length; j++) {
        const a = chosen[i], b = chosen[j];
        if (a.companyId === b.companyId && a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd) throw new Error('Overlapping company periods double-count losses');
      }
      return { value: chosen.reduce((s, r) => s + r.value, 0), units: first.units, metric: first.metric,
        selectedRecordIds: ids, scope: 'Selected non-overlapping issuer-reported shortfalls only', chainWide: false, precision: 'Approximate as reported; not a statistical lower bound' };
    } };
}
