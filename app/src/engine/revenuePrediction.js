// A separately scoped nominal-revenue nowcast. No supply-chain coefficient is
// inferred from this series. Dated original disclosures must verify annual-table vintages.
import { validDate } from './evidenceContract.js';
const mean = values => values.reduce((s, v) => s + v, 0) / values.length;
export function attachRevenueVintages(dataset, audit) {
  const byPeriod = new Map();
  for (const row of audit.records) {
    if (byPeriod.has(row.period)) throw new Error('Duplicate vintage record');
    byPeriod.set(row.period, row);
  }
  const records = dataset.records.map(row => {
    const v = byPeriod.get(row.period);
    if (!v?.matchesAnnualTable || v.amountInOriginalDisclosure !== row.amount || v.amountInAnnualTable !== row.amount
      || !validDate(v.availableBy) || !/^https:\/\/www\.sec\.gov\/Archives\/edgar\//.test(v.sourceUrl)
      || !/^[a-f0-9]{64}$/.test(v.sha256)) throw new Error(`Unverified original disclosure: ${row.period}`);
    if (monthIndex(v.availableBy.slice(0, 7)) <= monthIndex(row.period)) throw new Error('Outcome disclosed before month completion');
    return { ...row, availableBy: v.availableBy, originalDisclosureUrl: v.sourceUrl };
  });
  return { ...dataset, records, historicalVintagesVerified: true };
}
export function monthIndex(period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Invalid month');
  return Number(period.slice(0, 4)) * 12 + Number(period.slice(5)) - 1;
}
export function validateRevenueRows(rows) {
  if (!rows.length) throw new Error('Empty revenue series');
  rows.forEach((r, i) => {
    const index = monthIndex(r.period);
    if (!Number.isFinite(r.amount) || r.amount <= 0) throw new Error('Revenue must be finite and positive');
    if (i && index !== monthIndex(rows[i - 1].period) + 1) throw new Error('Duplicate, missing or unordered month');
  });
}

// Reject future rows instead of relying on a caller to ignore them correctly.
export function predictRevenue(history, targetPeriod, window = 3) {
  validateRevenueRows(history);
  if (![1, 3, 6, 12].includes(window)) throw new Error('Unknown candidate window');
  const last = monthIndex(history.at(-1).period), target = monthIndex(targetPeriod);
  if (last >= target) throw new Error('Target/future outcome leaked into predictors');
  if (last !== target - 1 || history.length < 12 + window) throw new Error('Insufficient contiguous history for horizon');
  const n = history.length;
  const used = history.slice(-12 - window);
  let issuedOn = null;
  if (used.every(r => validDate(r.availableBy))) {
    // The day after the latest SEC filing avoids claiming same-day intraday availability.
    const latest = used.map(r => r.availableBy).sort().at(-1);
    issuedOn = new Date(Date.parse(`${latest}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    if (issuedOn.slice(0, 7) !== targetPeriod) throw new Error('Predictor disclosure is unavailable within the nowcast month');
  }
  const growth = mean(Array.from({ length: window }, (_, j) => Math.log(history[n - 1 - j].amount / history[n - 13 - j].amount)));
  const prediction = history[n - 12].amount * Math.exp(growth);
  if (!Number.isFinite(prediction) || prediction <= 0) throw new Error('Nonfinite prediction');
  return { prediction, fittedLogGrowth: growth, lastInputPeriod: history.at(-1).period, issuedOn,
    baselines: { last_month: history.at(-1).amount, same_month_last_year: history[n - 12].amount,
      trailing_12_month_mean: mean(history.slice(-12).map(r => r.amount)) } };
}

export function errorMetrics(rows, value = r => r.prediction) {
  if (!rows.length) throw new Error('Empty evaluation period');
  const errors = rows.map(r => value(r) - r.actual);
  return { months: rows.length, mae: mean(errors.map(Math.abs)),
    rmse: Math.sqrt(mean(errors.map(e => e * e))),
    wape: errors.reduce((s, e) => s + Math.abs(e), 0) / rows.reduce((s, r) => s + r.actual, 0) };
}

export function logErrorRadius(rows, coverage = .8) {
  if (!(coverage > 0 && coverage < 1) || !rows.length) throw new Error('Invalid interval calibration');
  const errors = rows.map(r => {
    if (!(r.actual > 0) || !(r.prediction > 0) || !Number.isFinite(r.actual + r.prediction)) throw new Error('Invalid calibration value');
    return Math.abs(Math.log(r.actual / r.prediction));
  }).sort((a, b) => a - b);
  const rank = Math.ceil((errors.length + 1) * coverage);
  if (rank > errors.length) throw new Error('Insufficient calibration observations');
  return errors[rank - 1];
}

function pairedBlockInterval(differences, { blockLength = 3, replications = 5000, seed = 20260907 } = {}) {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const draws = Array.from({ length: replications }, () => {
    const sample = [];
    while (sample.length < differences.length) {
      const start = Math.floor(random() * differences.length);
      for (let j = 0; j < blockLength && sample.length < differences.length; j++) sample.push(differences[(start + j) % differences.length]);
    }
    return mean(sample);
  }).sort((a, b) => a - b);
  return { low: draws[Math.floor(.05 * replications)], high: draws[Math.ceil(.95 * replications) - 1],
    level: .9, blockLength, replications, seed, method: 'paired_circular_moving_block_bootstrap' };
}

export function evaluateRevenuePrediction(dataset, protocol) {
  if (dataset.companyId !== 'tsmc' || dataset.metric !== 'consolidated_monthly_revenue' || dataset.units !== 'TWD million') throw new Error('Mismatched target definition');
  if (JSON.stringify(protocol.baselineModels) !== JSON.stringify(['last_month', 'same_month_last_year', 'trailing_12_month_mean'])) throw new Error('Required baselines missing or changed');
  const rows = dataset.records;
  validateRevenueRows(rows);
  const bounds = ['developmentEnd', 'selectionStart', 'selectionEnd', 'calibrationStart', 'calibrationEnd', 'testStart', 'testEnd'].map(k => monthIndex(protocol[k]));
  for (let i = 1; i < bounds.length; i++) if (bounds[i] <= bounds[i - 1]) throw new Error('Overlapping or reversed validation periods');
  if (bounds[3] !== bounds[2] + 1 || bounds[5] !== bounds[4] + 1) throw new Error('Unaccounted validation gap');
  const simulate = (start, end, window) => {
    const expected = monthIndex(end) - monthIndex(start) + 1;
    const scored = rows.flatMap((r, i) => {
      if (r.period < start || r.period > end) return [];
      const prediction = predictRevenue(rows.slice(0, i), r.period, window);
      if (dataset.historicalVintagesVerified && (!prediction.issuedOn || !validDate(r.availableBy)
        || prediction.issuedOn >= r.availableBy)) throw new Error('Outcome was already available at nowcast issuance');
      return [{ period: r.period, actual: r.amount, ...prediction, sourceUrl: r.originalDisclosureUrl || r.sourceUrl,
        outcomeAvailableBy: r.availableBy || null }];
    });
    if (scored.length !== expected) throw new Error('Missing evaluation targets');
    return scored;
  };
  const selection = [1, 3, 6, 12].map(window => ({ window,
    ...errorMetrics(simulate(protocol.selectionStart, protocol.selectionEnd, window)) }));
  const window = [...selection].sort((a, b) => a.mae - b.mae || a.window - b.window)[0].window;
  const calibration = simulate(protocol.calibrationStart, protocol.calibrationEnd, window);
  if (dataset.historicalVintagesVerified && rows.some(r => r.period >= protocol.selectionStart && r.period <= protocol.selectionEnd
    && r.availableBy >= calibration[0].issuedOn)) throw new Error('Model-selection outcome unavailable before calibration');
  const radius = logErrorRadius(calibration);
  const test = simulate(protocol.testStart, protocol.testEnd, window).map(r => ({ ...r,
    lower: r.prediction * Math.exp(-radius), upper: r.prediction * Math.exp(radius) }));
  if (dataset.historicalVintagesVerified && calibration.some(r => r.outcomeAvailableBy >= test[0].issuedOn)) throw new Error('Interval-calibration outcome unavailable before test');
  const metrics = errorMetrics(test);
  const coverage = mean(test.map(r => Number(r.actual >= r.lower && r.actual <= r.upper)));
  const meanRelativeWidth = mean(test.map(r => (r.upper - r.lower) / r.actual));
  const comparisons = protocol.baselineModels.map(model => {
    if (!(model in test[0].baselines)) throw new Error('Unknown baseline');
    const baseline = errorMetrics(test, r => r.baselines[model]);
    const differences = test.map(r => Math.abs(r.prediction - r.actual) - Math.abs(r.baselines[model] - r.actual));
    return { model, ...baseline, candidateMaeRatio: metrics.mae / baseline.mae,
      candidateMinusBaselineMae: mean(differences), differenceInterval: pairedBlockInterval(differences) };
  });
  const g = protocol.qualificationGates;
  const gates = { completeTest: test.length === g.testMonths,
    beatsEveryBaseline: comparisons.every(c => c.candidateMaeRatio <= g.maeRatioToEveryBaselineAtMost),
    bootstrapImprovement: comparisons.every(c => c.differenceInterval.high < g.bootstrapUpperDifferenceBelow),
    intervalCoverage: coverage >= g.testIntervalCoverageAtLeast,
    intervalWidth: meanRelativeWidth <= g.meanRelativeIntervalWidthAtMost };
  return { modelVersion: protocol.version, target: protocol.target, scope: protocol.scope,
    status: Object.values(gates).every(Boolean) ? 'historical_benchmark_pass' : 'historical_benchmark_fail',
    selectedWindow: window, selection, calibration: { start: protocol.calibrationStart, end: protocol.calibrationEnd,
      months: calibration.length, nominalCoverage: .8, logErrorRadius: radius },
    test: { start: protocol.testStart, end: protocol.testEnd, ...metrics, coverage, meanRelativeWidth }, comparisons, gates,
    yearly: [...new Set(test.map(r => r.period.slice(0, 4)))].map(year => {
      const subset = test.filter(r => r.period.startsWith(year));
      return { year, candidate: errorMetrics(subset), baselines: protocol.baselineModels.map(model => ({ model, ...errorMetrics(subset, r => r.baselines[model]) })) };
    }),
    predictions: test, historicalVintagesVerified: dataset.historicalVintagesVerified,
    prospectiveValidated: false, disruptionCausalityValidated: false, globalParametersCalibrated: [], limitations: protocol.limitations };
}
