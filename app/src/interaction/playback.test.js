import { describe, it, expect } from 'vitest';
import { frameFromTrace } from './playback.js';

// Minimal stagesById: s1 in us, s2 in tw, s3 in cn (each fully in one country)
const stagesById = {
  s1: { shares: { us: 1 } },
  s2: { shares: { tw: 1 } },
  s3: { shares: { cn: 1 } },
};

// Synthetic 3-hop trace: s1 (hop0) -> s2 (hop1) -> s3 (hop2)
const traceResult = {
  field: { s1: 1, s2: 0.5, s3: 0.25 },
  trace: [
    { step: 0, nodes: ['s1'], edges: [], incrementalContribution: { s1: 1 }, cumulativeContribution: { s1: 1 } },
    { step: 1, nodes: ['s2'], edges: [{ from: 's1', to: 's2', dir: 'downstream' }], incrementalContribution: { s2: 0.5 }, cumulativeContribution: { s1: 1, s2: 0.5 } },
    { step: 2, nodes: ['s3'], edges: [{ from: 's2', to: 's3', dir: 'downstream' }], incrementalContribution: { s3: 0.25 }, cumulativeContribution: { s1: 1, s2: 0.5, s3: 0.25 } },
  ],
};

describe('frameFromTrace()', () => {
  it('returns a disengaged empty frame for a null / empty trace', () => {
    expect(frameFromTrace(null, 0, stagesById).engaged).toBe(false);
    expect(frameFromTrace({ trace: [] }, 0, stagesById).engaged).toBe(false);
  });

  it('step 0 reveals only the source stage and its country', () => {
    const f = frameFromTrace(traceResult, 0, stagesById);
    expect(f.engaged).toBe(true);
    expect([...f.reachedStages]).toEqual(['s1']);
    expect([...f.newStages]).toEqual(['s1']);
    expect([...f.reachedCountries]).toEqual(['us']);
    expect([...f.newCountries]).toEqual(['us']);
    expect(f.atStart).toBe(true);
    expect(f.atEnd).toBe(false);
  });

  it('mid-step accumulates reached stages and marks only the newly reached one', () => {
    const f = frameFromTrace(traceResult, 1, stagesById);
    expect(f.reachedStages.has('s1')).toBe(true);
    expect(f.reachedStages.has('s2')).toBe(true);
    expect([...f.newStages]).toEqual(['s2']);
    expect([...f.newCountries]).toEqual(['tw']); // us was already reached
    expect(f.edges).toHaveLength(1);
  });

  it('final step marks atEnd and reaches every node', () => {
    const f = frameFromTrace(traceResult, 2, stagesById);
    expect(f.atEnd).toBe(true);
    expect(f.reachedStages.size).toBe(3);
    expect(f.reachedCountries.size).toBe(3);
  });

  it('clamps an out-of-range step into bounds', () => {
    expect(frameFromTrace(traceResult, 99, stagesById).step).toBe(2);
    expect(frameFromTrace(traceResult, -5, stagesById).step).toBe(0);
  });
});
