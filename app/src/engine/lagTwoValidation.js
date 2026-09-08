import { lagTwoRevenue } from './prospectivePerformance.js';
import { monthIndex, validateRevenueRows, logErrorRadius, errorMetrics } from './revenuePrediction.js';
import { validDate } from './evidenceContract.js';
const nextDay = date => new Date(Date.parse(date) + 86400000).toISOString().slice(0,10);
export function evaluateLagTwoValidation(data, protocol, { testStart = '2024-01', testEnd = '2025-12' } = {}) {
  if (!data.historicalVintagesVerified || data.companyId !== 'tsmc' || data.metric !== 'consolidated_monthly_revenue'
    || data.units !== 'TWD million') throw new Error('Verified matching revenue target required');
  if (protocol.informationLagMonths !== 2 || protocol.growthWindow !== 3 || protocol.nominalCoverage !== .8) throw new Error('Unsupported captured protocol');
  validateRevenueRows(data.records);
  if (monthIndex(protocol.calibrationEnd) >= monthIndex(testStart) || monthIndex(testStart) > monthIndex(testEnd)) throw new Error('Overlapping test and calibration');
  if (data.records.some(r => !validDate(r.availableBy) || !r.originalDisclosureUrl)) throw new Error('Missing original disclosure vintage');
  const select = (start,end) => {
    const selected = data.records.filter(r => r.period >= start && r.period <= end);
    if (selected.length !== monthIndex(end)-monthIndex(start)+1) throw new Error('Incomplete evaluation period');
    return selected;
  };
  const predict = r => {
    const history = data.records.filter(h => monthIndex(h.period) <= monthIndex(r.period)-2);
    const priorYear = history.find(h => monthIndex(h.period) === monthIndex(r.period)-12);
    if (!priorYear || history.length < 15) throw new Error('Insufficient lagged history');
    const latestInputDisclosure=history.map(h=>h.availableBy).sort().at(-1);
    const earliestOrigin=[r.period+'-01',nextDay(latestInputDisclosure)].sort().at(-1);
    if(earliestOrigin.slice(0,7)!==r.period||earliestOrigin>=r.availableBy) throw new Error('Input unavailable before historical outcome');
    return { period: r.period, actual: r.amount, prediction: lagTwoRevenue(history,r.period),
      lastInputPeriod: history.at(-1).period,
      latestInputDisclosure,
      sourceUrl: r.originalDisclosureUrl, outcomeAvailableBy: r.availableBy,
      baselines: { latest_available_month: history.at(-1).amount, same_month_last_year: priorYear.amount,
        trailing_12_available_mean: history.slice(-12).reduce((s,h)=>s+h.amount,0)/12 } };
  };
  const calibration = select(protocol.calibrationStart,protocol.calibrationEnd).map(predict);
  if (calibration.length !== 24) throw new Error('Captured protocol requires 24 calibration months');
  const radius = logErrorRadius(calibration,protocol.nominalCoverage);
  const calibrationAvailable = calibration.map(r=>r.outcomeAvailableBy).sort().at(-1);
  const predictions = select(testStart,testEnd).map(predict).map(r => {
    // Earliest day in the target month when both predictors and the fixed
    // interval calibration are public. January 2024 must wait for Dec 2023.
    const originDate = [r.period+'-01',nextDay(r.latestInputDisclosure),nextDay(calibrationAvailable)].sort().at(-1);
    if (originDate.slice(0,7) !== r.period || originDate >= r.outcomeAvailableBy) throw new Error('Unavailable information at historical origin');
    // Give baselines every observation actually public at this origin. In
    // January 2024 the wait for interval calibration also reveals December
    // revenue, even though the captured candidate rule deliberately uses lag 2.
    const available=data.records.filter(h=>h.period<r.period&&h.availableBy<originDate);
    if(available.length<12) throw new Error('Insufficient baseline history');
    return { ...r, originDate, baselineLastInputPeriod:available.at(-1).period,
      baselines:{...r.baselines,two_month_lag_value:r.baselines.latest_available_month,latest_available_month:available.at(-1).amount,
        trailing_12_available_mean:available.slice(-12).reduce((s,h)=>s+h.amount,0)/12},
      lower:r.prediction*Math.exp(-radius), upper:r.prediction*Math.exp(radius) };
  });
  const metrics = errorMetrics(predictions);
  const comparisons = Object.keys(predictions[0].baselines).map(model => ({ model,
    ...errorMetrics(predictions,r=>r.baselines[model]) }));
  return { schemaVersion:1, status:'retrospective_horizon_diagnostic', modelId:protocol.version,
    target:data.metric, units:data.units, informationLagMonths:2, growthWindow:3,
    calibration:{ start:protocol.calibrationStart,end:protocol.calibrationEnd,months:24,logErrorRadius:radius,availableBy:calibrationAvailable },
    test:{ start:testStart,end:testEnd,...metrics, covered:predictions.filter(r=>r.actual>=r.lower&&r.actual<=r.upper).length,
      nominalCoverage:protocol.nominalCoverage, coverage:predictions.filter(r=>r.actual>=r.lower&&r.actual<=r.upper).length/predictions.length },
    comparisons, predictions, beatsEveryBaseline:comparisons.every(b=>metrics.mae<b.mae),
    prospectiveValidated:false, globalParametersCalibrated:[],
    limitations:['Uses the exact existing lag-two point rule and fixed interval calibration; no tuning on the test outcomes.',
      'Historical outcomes were already examined in prior work. This is a retrospective horizon diagnostic, not a fresh untouched holdout.',
      'Historical origin waits for every required disclosure; it is not an actual forecast capture.',
      'Nominal revenue accuracy does not identify physical disruption losses or supplier transmission.'] };
}
