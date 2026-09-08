import { reviewedClaim, sourceAvailable, validDate } from './evidenceContract.js';
import { PARAMETERS } from './registry.js';

const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86400000;
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const latest = dates => [...dates].sort().at(-1);
const groups = rows => [...new Set(rows.map(r => r.incidentId))].map(id => rows.filter(r => r.incidentId === id));
const quantile = (sorted, p) => {
  const index = (sorted.length - 1) * p, lo = Math.floor(index);
  return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo);
};
export function validateRecoveryDurations(data, asOf) {
  if (!validDate(asOf)) throw new Error('Invalid recovery as-of date');
  const accepted = [], rejected = [], ids = new Set(), targets = new Set(), incidentDates = new Map();
  for (const r of data.records || []) {
    let reason;
    const target = `${r.incidentId}:${r.facilityId}`;
    if (!r.id || ids.has(r.id) || targets.has(target)) reason = 'Duplicate or missing recovery target';
    else if (!r.incidentId || !r.facilityId || !r.companyId || r.metric !== 'wafer_input_capacity_recovery_duration' || r.units !== 'days') reason = 'Incompatible recovery target';
    else if (r.kind !== 'observed' || !reviewedClaim(r, asOf) || r.review.verifiedAt > asOf
      || !sourceAvailable(r.restart?.source, asOf) || !sourceAvailable(r.completion?.source, asOf)) reason = 'Unreviewed or unavailable outcome';
    else if (![r.incidentDate, r.restart.date, r.completion.date].every(validDate)
      || r.restart.date < r.incidentDate || r.completion.date <= r.restart.date
      || r.completion.date > asOf || !r.restart.definition) reason = 'Invalid milestone chronology';
    else if (r.restart.source.publicationDate < r.restart.date || r.restart.source.informationAvailableDate < r.restart.date
      || r.completion.source.publicationDate < r.completion.date || r.completion.source.informationAvailableDate < r.completion.date) reason = 'Forecast date substituted for observed milestone';
    else if (incidentDates.has(r.incidentId) && incidentDates.get(r.incidentId) !== r.incidentDate) reason = 'Inconsistent incident dates';
    ids.add(r.id); targets.add(target); incidentDates.set(r.incidentId, r.incidentDate);
    if (reason) { rejected.push({ id: r.id, reason }); continue; }
    const availableAt = latest([r.restart.source.publicationDate, r.restart.source.informationAvailableDate,
      r.completion.source.publicationDate, r.completion.source.informationAvailableDate]);
    accepted.push({ ...r, durationDays: days(r.restart.date, r.completion.date), availableAt,
      originDate: latest([r.restart.date, r.restart.source.publicationDate, r.restart.source.informationAvailableDate]) });
  }
  return { accepted, rejected };
}

// One unit of likelihood weight per incident; sites from a shared earthquake
// are not independent draws. Lognormal parameters are weighted MLEs, not a
// claim that recovery has been shown to follow a lognormal population law.
export function fitRecoveryDuration(rows) {
  if (!rows.length || rows.some(r => !Number.isFinite(r.durationDays) || r.durationDays <= 0)) throw new Error('Positive observed durations required');
  const clusters = groups(rows);
  const mu = mean(clusters.map(g => mean(g.map(r => Math.log(r.durationDays)))));
  const variance = mean(clusters.map(g => mean(g.map(r => (Math.log(r.durationDays) - mu) ** 2))));
  const points = clusters.flatMap(g => g.map(r => ({ value: r.durationDays, weight: 1 / (clusters.length * g.length) }))).sort((a,b) => a.value-b.value);
  let sum = 0, empiricalMedianDays = points.at(-1).value;
  for (const p of points) { sum += p.weight; if (sum >= .5 - 1e-12) { empiricalMedianDays = p.value; break; } }
  return { method: 'incident-balanced lognormal weighted maximum likelihood', records: rows.length, incidents: clusters.length,
    logMean: mu, logSigma: Math.sqrt(variance), medianDays: Math.exp(mu), meanDays: Math.exp(mu + variance / 2), empiricalMedianDays };
}

// Enumerate the entire small-sample cluster bootstrap, reproducibly, rather
// than reporting a seed-dependent narrow interval. This is parameter
// uncertainty conditional on the selected incidents, NOT a prediction interval.
export function recoveryBootstrap(rows) {
  const clusters = groups(rows), n = clusters.length;
  if (n < 2 || n > 6) return { status: 'unavailable', reason: 'Exact bootstrap requires 2 to 6 incident clusters' };
  const logMeans = clusters.map(g => mean(g.map(r => Math.log(r.durationDays)))), samples = [];
  function enumerate(depth, total) {
    if (depth === n) { samples.push(Math.exp(total / n)); return; }
    for (const value of logMeans) enumerate(depth + 1, total + value);
  }
  enumerate(0, 0); samples.sort((a,b) => a-b);
  return { status: 'exploratory', method: 'exact incident-cluster percentile bootstrap', confidenceLevel: .95,
    resamples: samples.length, lowerDays: quantile(samples, .025), upperDays: quantile(samples, .975),
    target: 'fitted population median duration, not an individual recovery interval',
    limitation: 'Very few selected clusters; nominal confidence is not validated and does not cover selection bias.' };
}

function scoreSplit(train, test, baselineDays) {
  if (train.some(r => test.some(t => r.incidentId === t.incidentId))) throw new Error('Incident leakage');
  if (!train.length || !test.length) return { status: 'insufficient_data' };
  const firstIncident = [...test].sort((a,b) => a.incidentDate.localeCompare(b.incidentDate))[0].incidentDate;
  if (train.some(r => r.availableAt >= firstIncident)) throw new Error('Training outcome unavailable before test incident');
  const fit = fitRecoveryDuration(train);
  const lastIncident = groups(train).sort((a,b) => a[0].incidentDate.localeCompare(b[0].incidentDate)).at(-1);
  const lastDuration = mean(lastIncident.map(r => r.durationDays));
  const predictions = test.map(r => {
    if (r.originDate >= r.completion.date) throw new Error('Outcome known before prediction origin');
    const issuer = r.issuerTarget;
    const issuerValid = issuer?.kind === 'issuer_forecast' && Number.isFinite(issuer.durationDays) && issuer.durationDays > 0
      && sourceAvailable(issuer.source, r.originDate) && issuer.source.publicationDate < r.completion.date;
    const targets = { candidate: fit.medianDays, registry: baselineDays, empiricalMedian: fit.empiricalMedianDays, lastIncident: lastDuration };
    return { id: r.id, incidentId: r.incidentId, originDate: r.originDate, actualDays: r.durationDays,
      predictions: targets, absoluteErrors: Object.fromEntries(Object.entries(targets).map(([k,v]) => [k, Math.abs(v-r.durationDays)])),
      issuerTargetDays: issuerValid ? issuer.durationDays : null,
      issuerTargetQualifier: issuerValid ? issuer.qualifier : null,
      issuerTargetAbsoluteError: issuerValid ? Math.abs(issuer.durationDays-r.durationDays) : null,
      sourceUrl: r.completion.source.url };
  });
  const incidentMean = (list, get) => mean(groups(list).map(g => mean(g.map(get))));
  const metrics = Object.fromEntries(['candidate','registry','empiricalMedian','lastIncident'].map(k => [k, { maeDays: incidentMean(predictions, r => r.absoluteErrors[k]) }]));
  const issuerPairs = predictions.filter(r => r.issuerTargetAbsoluteError != null);
  return { status: 'retrospective_temporal_test', trainingIncidentIds: [...new Set(train.map(r => r.incidentId))],
    testIncidentIds: [...new Set(test.map(r => r.incidentId))], fit, parameterUncertainty: recoveryBootstrap(train), predictions, metrics,
    issuerComparison: { records: issuerPairs.length, incidents: groups(issuerPairs).length,
      candidateMaeDays: issuerPairs.length ? incidentMean(issuerPairs, r => r.absoluteErrors.candidate) : null,
      issuerTargetMaeDays: issuerPairs.length ? incidentMean(issuerPairs, r => r.issuerTargetAbsoluteError) : null,
      limitation: 'Issuer schedules are informed targets with qualifiers, not calibrated probability forecasts.' } };
}

export function calibrateRecoveryDurations(data, protocol) {
  const { accepted, rejected } = validateRecoveryDurations(data, protocol.asOf);
  if (rejected.length) return { status: 'invalid_data', rejected, calibratedGlobalParameters: [] };
  if (!validDate(protocol.holdoutFrom)) throw new Error('Invalid chronological cutoff');
  if (!Number.isInteger(protocol.rollingMinimumTrainingIncidents) || protocol.rollingMinimumTrainingIncidents < 1) throw new Error('Invalid rolling training minimum');
  if (groups(accepted).length < 2) return { status: 'insufficient_data', calibratedGlobalParameters: [] };
  const baselineDays = PARAMETERS.outageRecoveryDays.base;
  const training = accepted.filter(r => r.incidentDate < protocol.holdoutFrom && r.availableAt < protocol.holdoutFrom);
  const test = accepted.filter(r => r.incidentDate >= protocol.holdoutFrom);
  const chronologicalTest = scoreSplit(training, test, baselineDays);
  const ordered = groups(accepted).sort((a,b) => a[0].incidentDate.localeCompare(b[0].incidentDate));
  const rollingTests = ordered.flatMap(testRows => {
    const train = accepted.filter(r => r.incidentId !== testRows[0].incidentId && r.availableAt < testRows[0].incidentDate);
    return groups(train).length >= protocol.rollingMinimumTrainingIncidents ? [scoreSplit(train, testRows, baselineDays)] : [];
  });
  const fit = fitRecoveryDuration(accepted);
  const rollingMetrics = Object.fromEntries(['candidate','registry','empiricalMedian','lastIncident'].map(key => [key,
    { maeDays: rollingTests.length ? mean(rollingTests.map(t => t.metrics[key].maeDays)) : null }]));
  const restartSensitivity = [...new Set(accepted.map(r => r.restart.definition))].map(definition => {
    const rows = accepted.filter(r => r.restart.definition !== definition);
    return { omittedDefinition: definition, ...(rows.length ? fitRecoveryDuration(rows) : { status: 'insufficient_data' }) };
  });
  // Calendar-day endpoints each have an unknown time of day: their elapsed
  // duration may differ by up to one day, without inventing exact timestamps.
  const dateSensitivity = { lowerMedianDays: fitRecoveryDuration(accepted.map(r => ({ ...r, durationDays: Math.max(.001, r.durationDays-1) }))).medianDays,
    upperMedianDays: fitRecoveryDuration(accepted.map(r => ({ ...r, durationDays: r.durationDays+1 }))).medianDays };
  return { schemaVersion: 1, status: 'exploratory_empirical_fit', asOf: protocol.asOf, protocol,
    target: 'Days from disclosed partial restart to full wafer-input capacity', parameterMapping: 'Scoped candidate for outageRecoveryDays only when recoveryStartDays uses the same restart boundary',
    baselineDays, fit, parameterUncertainty: recoveryBootstrap(accepted), dateSensitivity, restartSensitivity,
    chronologicalTest, rollingTests, rollingMetrics, records: accepted, rejected,
    replacementAssessment: {
      globalReplacementJustified: false,
      beatsRegistryOnEveryRollingIncident: rollingTests.length > 0 && rollingTests.every(t => t.metrics.candidate.maeDays < t.metrics.registry.maeDays),
      beatsEmpiricalMedianOverall: rollingTests.length > 0 && rollingMetrics.candidate.maeDays < rollingMetrics.empiricalMedian.maeDays,
      distinctTemporalTestIncidents: rollingTests.length,
      linearTrajectoryValidated: false, prospectiveValidated: false,
      scopedUse: 'A verified full-restoration milestone can supersede an assumed recovery date for that incident, facility and wafer-input target. It cannot clear lost-output or downstream-loss balances.',
      reasons: ['Improvement over a weak 60-day assumption is insufficient when simple data-based predictors perform better.',
        'One selected issuer does not establish a global recovery distribution.',
        'Endpoint observations do not identify the linear recovery path or the other six global parameters.'] },
    calibratedGlobalParameters: [], deploymentStatus: 'research_only',
    limitations: ['Endpoint fitting does not validate the linear within-recovery curve or accumulated production losses.',
      `Selected sample: ${new Set(accepted.map(r => r.companyId)).size} issuer(s), ${groups(accepted).length} incidents; historical results are not prospective performance.`,
      'The protocol was written after historical outcomes were inspected; the temporal test is not a pristine untouched holdout.',
      'Cluster bootstrap uncertainty does not establish prediction interval coverage.',
      'No supply-chain transmission, inventory, financial loss or supplier allocation coefficient is identified by these durations.'] };
}
