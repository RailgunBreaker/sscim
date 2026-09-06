import { describe, expect, it } from 'vitest';
import { recoverySummary } from '../../../docs/computation-demo/validation/report.mjs';

describe('synthetic recovery reporting', () => {
  it('reports unavailable statistics when every interval fit fails', () => {
    expect(recoverySummary(['decay'], [30], [], [0])).toEqual([{
      parameter: 'decay', truth: 30, meanEstimate: null, bias: null,
      sdEstimate: null, meanSE: null, syntheticCoverage95: null,
    }]);
  });

  it('summarizes retained fits without treating failed fits as zero estimates', () => {
    const [result] = recoverySummary(['decay'], [30], [
      { thetaHat: [28], se: [2] }, { thetaHat: [34], se: [4] },
    ], [1]);
    expect(result).toMatchObject({ meanEstimate: 31, bias: 1, sdEstimate: 3, meanSE: 3, syntheticCoverage95: 0.5 });
  });
});
