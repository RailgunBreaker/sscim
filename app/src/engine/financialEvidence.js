import { reviewedClaim, validDate } from './evidenceContract.js';

const key = row => [row.incidentId, row.companyId, row.periodStart, row.periodEnd, row.metric, row.units, row.measurementBasis].join('|');
const availableAt = row => [row.source.publicationDate, row.source.informationAvailableDate].sort().at(-1);
export function buildFinancialEvidence(records = [], asOf) {
  const rejected = [], accepted = [], counts = new Map();
  for (const r of records) counts.set(r.id, (counts.get(r.id) || 0) + 1);
  for (const r of records) {
    if (!r.id || counts.get(r.id) !== 1 || !reviewedClaim(r, asOf)
      || !r.companyId || !r.incidentId || !r.metric || !r.units || !r.measurementBasis
      || !validDate(r.periodStart) || !validDate(r.periodEnd) || r.periodStart > r.periodEnd
      || !Number.isFinite(r.amount) || !Number.isFinite(r.roundingUnit) || r.roundingUnit <= 0
      || !['reported_outcome', 'issuer_forecast'].includes(r.kind)
      || (r.kind === 'reported_outcome' && (r.periodEnd > asOf || r.source.publicationDate < r.periodEnd))
      || (r.kind === 'issuer_forecast' && availableAt(r) >= r.periodEnd)) {
      rejected.push({ id: r.id, reason: 'invalid_or_unavailable_financial_record' }); continue;
    }
    accepted.push(r);
  }
  const outcomes = accepted.filter(r => r.kind === 'reported_outcome');
  const forecasts = accepted.filter(r => r.kind === 'issuer_forecast');
  const comparisons = forecasts.flatMap(forecast => {
    const matches = outcomes.filter(actual => key(actual) === key(forecast)
      && actual.source.publicationDate > availableAt(forecast));
    // Competing versions require adjudication; do not silently select one.
    if (matches.length !== 1) return [];
    const actual = matches[0];
    const absoluteError = Math.abs(forecast.amount - actual.amount);
    const roundingRadius = (forecast.roundingUnit + actual.roundingUnit) / 2;
    return [{ forecastId: forecast.id, outcomeId: actual.id, incidentId: actual.incidentId,
      companyId: actual.companyId, metric: actual.metric, units: actual.units,
      periodEnd: actual.periodEnd, forecast: forecast.amount, actual: actual.amount,
      error: forecast.amount - actual.amount, absoluteError,
      // Bounds reflect source rounding only, not sampling or causal uncertainty.
      absoluteErrorRoundingBounds: { low: Math.max(0, absoluteError - roundingRadius), high: absoluteError + roundingRadius },
      forecastPublishedAt: forecast.source.publicationDate, outcomePublishedAt: actual.source.publicationDate,
      forecastSource: forecast.source.url, outcomeSource: actual.source.url }];
  });
  return { outcomes, forecasts, comparisons, rejected,
    independentOutcomeIncidents: new Set(outcomes.map(r => r.incidentId)).size,
    comparedIncidents: new Set(comparisons.map(r => r.incidentId)).size,
    modelValidated: false, reason: 'Historical issuer forecasts versus reported outcomes; these are not SSCIM model predictions. Currency, metric and accounting basis are never pooled.' };
}

// Validate external model predictions against the same target contract. Forecast
// issuance must precede target completion and outcome publication. A retrospective
// reconstruction cannot establish prospective accuracy merely by supplying a date.
export function scoreFinancialPredictions(records, predictions, { asOf, modelId, trainingIncidentIds = [] }) {
  const evidence = buildFinancialEvidence(records, asOf);
  const ids = new Set(), scores = [], unscored = [];
  for (const p of predictions) {
    if (!p.id || ids.has(p.id) || p.modelId !== modelId || !modelId) throw new Error('Duplicate prediction or model mismatch');
    ids.add(p.id);
    if (trainingIncidentIds.includes(p.incidentId)) throw new Error('Incident leakage');
    if (!validDate(p.issuedAt) || !Number.isFinite(p.amount)) throw new Error('Invalid prediction');
    const matches = evidence.outcomes.filter(r => key(r) === key(p));
    if (matches.length !== 1) { unscored.push({ id: p.id, reason: 'No unique matching outcome with identical target definition' }); continue; }
    const r = matches[0];
    if (p.issuedAt >= r.periodEnd || p.issuedAt >= r.source.publicationDate) throw new Error('Prediction issued after target completion or outcome disclosure');
    scores.push({ id: p.id, outcomeId: r.id, incidentId: r.incidentId, metric: r.metric, units: r.units,
      predicted: p.amount, actual: r.amount, absoluteError: Math.abs(p.amount - r.amount) });
  }
  return { modelId, scores, unscored, independentIncidents: new Set(scores.map(r => r.incidentId)).size,
    status: scores.length ? 'retrospective_evaluation' : 'no_matching_predictions', prospectiveValidityEstablished: false };
}
