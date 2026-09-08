import { it, expect } from 'vitest';
import { prospectiveScoreSummary } from './prospectiveScoreSummary.js';
it('scores baselines and intervals without counting pending or missing months as successes', () => {
  const predictions = [
    { modelId:'fixture',targetPeriod:'2026-09',lower:80,upper:120 },
    { modelId:'fixture',targetPeriod:'2026-11',lower:80,upper:120 },
  ];
  const report = { asOf:'2026-11-12T00:00:00Z', results:[
    { modelId:'fixture',targetPeriod:'2026-09',state:'scored',actual:100,absoluteError:10,baselineError:20,covered:true },
    { modelId:'fixture',targetPeriod:'2026-11',state:'pending_outcome' },
  ] };
  const [r] = prospectiveScoreSummary(report,predictions,{version:'fixture',prospectiveStart:'2026-09',minimumScoredMonthsForAssessment:12});
  expect(r).toMatchObject({ scored:1,pending:1,mae:10,baselineMae:20,wape:.1,improvementOverBaseline:.5,intervalCoverage:1,meanRelativeIntervalWidth:.4,missingCaptureMonths:['2026-10'],assessmentStatus:'incomplete_capture_series',operationallyValidated:false });
});
