import { describe, it, expect } from 'vitest';
import { complementaryInputBenchmark, renderComplementaryInputBenchmark } from '../../scripts/build-complementary-input-benchmark.mjs';
import { BASE_PARAMS } from './registry.js';

describe('equal allocation is not complementary-input production', () => {
  it('dilutes one unavailable input as unrelated incoming edges are added', () => {
    const [one, two, three] = complementaryInputBenchmark();
    expect(one.modelExposure).toBe(BASE_PARAMS.downstreamTransmission);
    expect(two.modelExposure).toBe(one.modelExposure / 2);
    expect(three.modelExposure).toBeCloseTo(one.modelExposure / 3, 12);
    expect([one, two, three].map((r) => r.physicalOutputFraction)).toEqual([0, 0, 0]);
  });

  it('bounds simultaneous outages as exposure while the thought-experiment output stops', () => {
    const both = complementaryInputBenchmark()[3];
    expect(both.modelExposure).toBe(BASE_PARAMS.downstreamTransmission);
    expect(both.physicalOutputLoss).toBe(1);
    expect(both.modelExposure).toBeLessThan(both.physicalOutputLoss);
  });

  it('keeps a partial bottleneck distinct from the exposure heuristic and labels the benchmark', () => {
    const partial = complementaryInputBenchmark()[4];
    expect(partial.physicalOutputFraction).toBe(0.5);
    expect(partial.modelExposure).toBe(BASE_PARAMS.downstreamTransmission / 4);
    const doc = renderComplementaryInputBenchmark();
    expect(doc).toContain('synthetic counterexample, not empirical validation');
    expect(doc).toContain('not a production-loss percentage');
    expect(doc).toContain('no inventory, substitutes');
  });
});
