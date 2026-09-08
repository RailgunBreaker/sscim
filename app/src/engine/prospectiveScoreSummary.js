import { monthIndex } from './revenuePrediction.js';
export function prospectiveScoreSummary(report, predictions, protocol) {
  const models = [...new Set(predictions.map(p => p.modelId))];
  return models.map(modelId => {
    const captured = predictions.filter(p => p.modelId === modelId);
    const scored = report.results.filter(r => r.modelId === modelId && r.state === 'scored');
    const n = scored.length;
    const actual = scored.reduce((s,r) => s + r.actual,0);
    const error = scored.reduce((s,r) => s + r.absoluteError,0);
    const baselineError = scored.reduce((s,r) => s + r.baselineError,0);
    const first = modelId === protocol.version ? protocol.prospectiveStart : captured.map(p => p.targetPeriod).sort()[0];
    const missing = [];
    for (let m = monthIndex(first); m < monthIndex(report.asOf.slice(0,7)); m++) {
      const period = `${Math.floor(m/12)}-${String(m%12+1).padStart(2,'0')}`;
      if (!captured.some(p => p.targetPeriod === period)) missing.push(period);
    }
    return { modelId, captured: captured.length, scored: n, pending: captured.length - n,
      mae: n ? error/n : null, baselineMae: n ? baselineError/n : null,
      wape: actual > 0 ? error/actual : null, improvementOverBaseline: baselineError > 0 ? 1-error/baselineError : null,
      intervalCoverage: n ? scored.filter(r => r.covered).length/n : null,
      meanRelativeIntervalWidth: n ? scored.reduce((s,r) => {
        const p = captured.find(p => p.targetPeriod === r.targetPeriod);
        return s + (p.upper-p.lower)/r.actual;
      },0)/n : null,
      missingCaptureMonths: missing,
      assessmentStatus: missing.length ? 'incomplete_capture_series' : n < protocol.minimumScoredMonthsForAssessment ? 'collecting_outcomes' : 'ready_for_review',
      operationallyValidated: false };
  });
}
