import { describe, it, expect } from 'vitest';
import { decay, hhiBounds, stageWeights, spearman, topologicalSort } from './math.js';

describe('decay() — exponential half-life', () => {
  it('decay(0,12) = 1', () => { expect(decay(0, 12)).toBeCloseTo(1, 10); });
  it('decay(12,12) = 0.5 (true half-life, not exp(-days/12))', () => { expect(decay(12, 12)).toBeCloseTo(0.5, 10); });
  it('decay(24,12) = 0.25', () => { expect(decay(24, 12)).toBeCloseTo(0.25, 10); });
});

/* The v7 HHI is an INTERVAL, because the unobserved residual's own
   concentration is not identified by the observed shares. Both ends must
   be correct bounds on the true index. */
describe('hhiBounds() — partially observed HHI', () => {
  it('shares {a:0.5,b:0.25} -> lower 0.3125 (observed only), upper 0.375 (residual as one holder)', () => {
    const r = hhiBounds({ a: 0.5, b: 0.25 });
    expect(r.residual).toBeCloseTo(0.25, 10);
    expect(r.lower).toBeCloseTo(0.5 * 0.5 + 0.25 * 0.25, 10);
    expect(r.upper).toBeCloseTo(0.5 * 0.5 + 0.25 * 0.25 + 0.25 * 0.25, 10);
    expect(r.lowerScore10).toBeCloseTo(3.125, 10);
    expect(r.upperScore10).toBeCloseTo(3.75, 10);
  });

  it('the lower bound never exceeds the upper bound, and they coincide when shares are fully disclosed', () => {
    const partial = hhiBounds({ a: 0.4, b: 0.3 });
    expect(partial.lower).toBeLessThan(partial.upper);
    const full = hhiBounds({ a: 0.6, b: 0.4 });
    expect(full.residual).toBeCloseTo(0, 12);
    expect(full.lower).toBeCloseTo(full.upper, 12);
  });

  it('both bounds stay inside [0,1] and bracket the single-holder and fully-fragmented extremes', () => {
    const r = hhiBounds({ a: 0.2 });
    expect(r.lower).toBeCloseTo(0.04, 10);          // residual infinitely fragmented
    expect(r.upper).toBeCloseTo(0.04 + 0.64, 10);   // residual is one undisclosed holder
    expect(r.lower).toBeGreaterThanOrEqual(0);
    expect(r.upper).toBeLessThanOrEqual(1);
  });

  it('flags (but tolerates) shares that sum to materially more than 1', () => {
    const r = hhiBounds({ a: 0.7, b: 0.6 });
    expect(r.overAllocated).toBe(true);
    expect(r.lower).toBeCloseTo(r.upper, 12); // normalized, so no residual is left
  });
});

describe('stageWeights() — normalized economic weights', () => {
  const entries = [['a', 100], ['b', 25], ['c', 0]];

  it('turnover_normalized sums to exactly one and is proportional to the proxy', () => {
    const w = stageWeights(entries, 'turnover_normalized');
    expect(Object.values(w).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    expect(w.a / w.b).toBeCloseTo(4, 10);
  });

  it('equal weighting sums to one and gives every stage the same weight', () => {
    const w = stageWeights(entries, 'equal');
    expect(Object.values(w).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    expect(w.a).toBeCloseTo(1 / 3, 12);
    expect(w.a).toBeCloseTo(w.c, 12);
  });

  it('log_turnover sums to one and compresses the skew', () => {
    const w = stageWeights(entries, 'log_turnover');
    expect(Object.values(w).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    expect(w.a / w.b).toBeLessThan(4);
    expect(w.a).toBeGreaterThan(w.b);
  });

  it('rejects an unknown weighting rather than silently choosing one', () => {
    expect(() => stageWeights(entries, 'made_up')).toThrow(/unknown stage weighting/);
  });
});

describe('spearman() — rank correlation', () => {
  it('is 1 for an identical ordering and -1 for a reversed one', () => {
    const a = { x: 3, y: 2, z: 1 };
    expect(spearman(a, { x: 30, y: 20, z: 10 })).toBeCloseTo(1, 10);
    expect(spearman(a, { x: 1, y: 2, z: 3 })).toBeCloseTo(-1, 10);
  });
});

describe('topologicalSort() — Kahn\'s algorithm', () => {
  it('orders a simple chain and reports no cycle', () => {
    const ids = ['a', 'b', 'c'];
    const out = { a: ['b'], b: ['c'], c: [] };
    const { order, hasCycle } = topologicalSort(ids, out);
    expect(hasCycle).toBe(false);
    expect(order).toEqual(['a', 'b', 'c']);
  });
  it('detects a cycle', () => {
    const ids = ['a', 'b'];
    const out = { a: ['b'], b: ['a'] };
    const { hasCycle } = topologicalSort(ids, out);
    expect(hasCycle).toBe(true);
  });
});
