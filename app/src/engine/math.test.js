import { describe, it, expect } from 'vitest';
import { decay, combinePositive, combineSigned, hhiWithResidual, topologicalSort } from './math.js';

describe('decay() — exponential half-life', () => {
  it('decay(0,12) = 1', () => { expect(decay(0, 12)).toBeCloseTo(1, 10); });
  it('decay(12,12) = 0.5 (true half-life, not exp(-days/12))', () => { expect(decay(12, 12)).toBeCloseTo(0.5, 10); });
  it('decay(24,12) = 0.25', () => { expect(decay(24, 12)).toBeCloseTo(0.25, 10); });
});

describe('combinePositive() — bounded noisy-OR combination', () => {
  it('combinePositive([0.4,0.5]) = 0.7', () => { expect(combinePositive([0.4, 0.5])).toBeCloseTo(0.7, 10); });
  it('a second contribution never reduces the combined effect', () => {
    const one = combinePositive([0.5]);
    const two = combinePositive([0.5, 0.3]);
    expect(two).toBeGreaterThanOrEqual(one);
  });
  it('stays bounded at 1 regardless of how many contributions are combined', () => {
    const many = combinePositive([0.9, 0.9, 0.9, 0.9, 0.9]);
    expect(many).toBeLessThanOrEqual(1);
  });
});

describe('combineSigned() — signed bounded aggregation', () => {
  it('mixed adverse/mitigating contributions stay within [-1,1]', () => {
    const v = combineSigned([0.8, -0.6, 0.5]);
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  });
});

describe('hhiWithResidual() — HHI with explicit unmodeled residual', () => {
  it('shares {a:0.5,b:0.25} -> residual 0.25, HHI 0.375, score10 3.75', () => {
    const r = hhiWithResidual({ a: 0.5, b: 0.25 });
    expect(r.residual).toBeCloseTo(0.25, 10);
    expect(r.hhi).toBeCloseTo(0.375, 10);
    expect(r.score10).toBeCloseTo(3.75, 10);
  });
  it('flags (but tolerates) shares that sum to materially more than 1', () => {
    const r = hhiWithResidual({ a: 0.7, b: 0.6 });
    expect(r.overAllocated).toBe(true);
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
