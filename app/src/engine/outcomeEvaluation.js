import { reviewedClaim, validDate } from './evidenceContract.js';

// A small, explicitly scoped challenge to the exponential capacity-recovery
// assumption. Fits use one incident; evaluation uses different incidents.
// No severity, trade-flow or chain-wide production-loss target is manufactured.
const daysBetween = (a, b) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;
const restore = (age, halfLife) => 1 - 2 ** (-age / halfLife);
export function intervalDistance(value, bounds) {
  return Math.max(0, bounds.low - value, value - bounds.high);
}
export function evaluateRecoveryOutcomes(observations, { trainingIncidentIds, holdoutIncidentIds, asOf, baseHalfLife = 14, allowCrossMetricDiagnostic = false }) {
  if (trainingIncidentIds.some(id => holdoutIncidentIds.includes(id))) throw new Error('Incident leakage');
  const allowed = ['production_capacity_restored', 'wafer_input_capacity_restored'];
  const rows = observations.filter(r => reviewedClaim(r, asOf) && r.kind === 'observed'
    && allowed.includes(r.metric) && validDate(r.incidentDate) && validDate(r.observedAt)
    && r.observedAt >= r.incidentDate && r.observedAt <= asOf
    && Number.isFinite(r.value?.low) && Number.isFinite(r.value?.high));
  const train = rows.filter(r => trainingIncidentIds.includes(r.incidentId));
  const test = rows.filter(r => holdoutIncidentIds.includes(r.incidentId));
  if (!train.length || !test.length) return { status: 'insufficient_data', candidateHalfLifeDays: null };
  if (new Set([...train, ...test].map(r => r.metric)).size !== 1 && !allowCrossMetricDiagnostic) {
    return { status: 'incompatible_recovery_targets', candidateHalfLifeDays: null, calibratedParameters: [],
      reason: 'Production capacity and wafer-input capacity are different targets. Cross-metric arithmetic is available only as an explicit diagnostic.' };
  }
  const firstHoldout = test.reduce((a, r) => r.incidentDate < a ? r.incidentDate : a, test[0].incidentDate);
  if (train.some(r => r.source.publicationDate >= firstHoldout || r.source.informationAvailableDate >= firstHoldout)) {
    throw new Error('Training outcome was unavailable before the holdout incident');
  }
  const loss = h => train.reduce((s, r) => s + intervalDistance(restore(daysBetween(r.incidentDate, r.observedAt), h), r.value) ** 2, 0);
  let best = 1;
  for (let h = 1.1; h <= 365; h += .1) if (loss(h) < loss(best)) best = h;
  const predictions = test.map(r => {
    const ageDays = daysBetween(r.incidentDate, r.observedAt);
    const baseline = restore(ageDays, baseHalfLife), candidate = restore(ageDays, best);
    return { id: r.id, incidentId: r.incidentId, scope: r.scope, metric: r.metric, ageDays, observed: r.value,
      baseline, candidate, baselineError: intervalDistance(baseline, r.value), candidateError: intervalDistance(candidate, r.value), sourceUrl: r.source.url };
  });
  const average = key => predictions.reduce((s, r) => s + r[key], 0) / predictions.length;
  return { status: 'exploratory_external_evaluation', candidateHalfLifeDays: best, baseHalfLifeDays: baseHalfLife,
    trainingRecords: train.length, trainingIncidentIds, holdoutRecords: test.length, holdoutIncidentIds,
    trainingSSE: loss(best), baselineMAE: average('baselineError'), candidateMAE: average('candidateError'), predictions,
    calibratedParameters: [],
    limitation: 'Purposive, tiny cross-incident sample. Capacity definitions and hazards differ; errors challenge the universal curve, not validate chain impact. No registry parameter is promoted.' };
}
