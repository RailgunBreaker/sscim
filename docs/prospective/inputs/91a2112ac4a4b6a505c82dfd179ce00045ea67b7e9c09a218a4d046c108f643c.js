import { monthIndex, validateRevenueRows, logErrorRadius } from './revenuePrediction.js';
import { validDate } from './evidenceContract.js';
export function lagTwoRevenue(history, target) {
  validateRevenueRows(history);
  const n = history.length;
  if (n < 15 || monthIndex(history.at(-1).period) !== monthIndex(target) - 2) throw new Error('Lag-two model requires contiguous history ending two months before target');
  const growth = [0, 1, 2].reduce((s, j) => s + Math.log(history[n - 1 - j].amount / history[n - 13 - j].amount), 0) / 3;
  return history[n - 11].amount * Math.exp(growth);
}
export function prepareProspectiveNowcast(data, protocol, capturedAt) {
  if (!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(capturedAt) || !Number.isFinite(Date.parse(capturedAt))) throw new Error('Invalid actual capture timestamp');
  if (data.companyId !== 'tsmc' || data.metric !== 'consolidated_monthly_revenue' || data.units !== 'TWD million'
    || !data.historicalVintagesVerified) throw new Error('Wrong or unverified target');
  if (protocol.informationLagMonths !== 2 || protocol.growthWindow !== 3 || protocol.nominalCoverage !== .8) throw new Error('Unsupported protocol');
  const target = capturedAt.slice(0, 7), captureDate = capturedAt.slice(0, 10);
  if (target < protocol.prospectiveStart) throw new Error('Before prospective protocol start');
  validateRevenueRows(data.records);
  const history = data.records.filter(r => monthIndex(r.period) <= monthIndex(target) - 2);
  if (history.some(r => !validDate(r.availableBy) || r.availableBy >= captureDate)) throw new Error('Input disclosure not available before capture');
  if (data.records.some(r => r.period >= target)) throw new Error('Target outcome already present');
  const calibration = data.records.filter(r => r.period >= protocol.calibrationStart && r.period <= protocol.calibrationEnd)
    .map(r => ({ actual: r.amount, prediction: lagTwoRevenue(data.records.filter(p => monthIndex(p.period) <= monthIndex(r.period) - 2), r.period) }));
  if (calibration.length !== 24 || protocol.calibrationEnd >= target) throw new Error('Incomplete or future interval calibration');
  const radius = logErrorRadius(calibration), prediction = lagTwoRevenue(history, target);
  return { modelId: protocol.version, companyId: 'tsmc', metric: data.metric, units: data.units, targetPeriod: target,
    capturedAt, informationLagMonths: 2, lastInputPeriod: history.at(-1).period, lastInputAvailableBy: history.at(-1).availableBy,
    prediction, lower: prediction * Math.exp(-radius), upper: prediction * Math.exp(radius), nominalCoverage: .8,
    baseline: history.at(-1).amount, baselineDefinition: 'Latest available month, same information cutoff',
    calibration: { start: protocol.calibrationStart, end: protocol.calibrationEnd, months: 24, logErrorRadius: radius },
    state: 'pending_outcome', operationallyValidated: false, modelStatus: protocol.modelStatus,
    limitations: protocol.limitations };
}
export function scoreProspectiveNowcasts(predictions, data, asOf) {
  if (!Number.isFinite(Date.parse(asOf)) || !data.historicalVintagesVerified) throw new Error('Invalid evaluation cutoff or unverified outcomes');
  const ids = new Set(), results = [];
  for (const p of predictions) {
    const key = `${p.modelId}|${p.targetPeriod}`;
    if (ids.has(key)) throw new Error('Duplicate prospective target');
    ids.add(key);
    if (p.companyId !== data.companyId || p.metric !== data.metric || p.units !== data.units
      || p.targetPeriod !== p.capturedAt.slice(0, 7) || !Number.isFinite(Date.parse(p.capturedAt))
      || Date.parse(p.capturedAt) > Date.parse(asOf) || ![p.prediction,p.lower,p.upper,p.baseline].every(Number.isFinite)
      || p.lower > p.prediction || p.prediction > p.upper) throw new Error('Invalid prospective contract');
    const outcome = data.records.find(r => r.period === p.targetPeriod);
    if (!outcome || !validDate(outcome.availableBy) || outcome.availableBy >= asOf.slice(0, 10)) {
      results.push({ modelId: p.modelId, targetPeriod: p.targetPeriod, state: 'pending_outcome' }); continue;
    }
    if (outcome.availableBy <= p.capturedAt.slice(0, 10)) throw new Error('Outcome predated prospective capture');
    if (!Number.isFinite(outcome.amount) || outcome.amount <= 0) throw new Error('Invalid outcome amount');
    results.push({ modelId: p.modelId, targetPeriod: p.targetPeriod, state: 'scored', actual: outcome.amount,
      prediction: p.prediction, absoluteError: Math.abs(outcome.amount - p.prediction), baselineError: Math.abs(outcome.amount - p.baseline),
      covered: outcome.amount >= p.lower && outcome.amount <= p.upper, sourceUrl: outcome.originalDisclosureUrl });
  }
  const scored = results.filter(r => r.state === 'scored');
  const models = [...new Set(predictions.map(p => p.modelId))];
  const byModel = models.map(modelId => {
    const rows = scored.filter(r => r.modelId === modelId);
    return { modelId, scored: rows.length, mae: rows.length ? rows.reduce((s, r) => s + r.absoluteError, 0) / rows.length : null,
      coverage: rows.length ? rows.filter(r => r.covered).length / rows.length : null };
  });
  return { asOf, captured: predictions.length, scored: scored.length, pending: results.length - scored.length,
    mae: models.length === 1 ? byModel[0].mae : null, coverage: models.length === 1 ? byModel[0].coverage : null, byModel,
    operationallyValidated: false, status: scored.length < 12 ? 'collecting_prospective_outcomes' : 'requires_per_model_review', results };
}
