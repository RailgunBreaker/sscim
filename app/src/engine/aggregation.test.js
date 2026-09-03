import { describe, it, expect } from 'vitest';
import { AGGREGATORS, AGGREGATOR_IDS, aggregateNonNegative, aggregateSigned } from './aggregation.js';
import { MODEL_FORMS } from './registry.js';

describe('bounded aggregation operators across DISTINCT incidents', () => {
  it('offers exactly the three forms the registry declares', () => {
    expect([...AGGREGATOR_IDS].sort()).toEqual([...MODEL_FORMS.incidentAggregation.options].sort());
  });

  it('bounded_union([0.4,0.5]) = 0.7 — saturating, not additive', () => {
    expect(AGGREGATORS.bounded_union([0.4, 0.5])).toBeCloseTo(0.7, 12);
  });

  it('max keeps only the largest and clipped_sum adds up to the bound', () => {
    expect(AGGREGATORS.max([0.4, 0.5])).toBeCloseTo(0.5, 12);
    expect(AGGREGATORS.clipped_sum([0.4, 0.5])).toBeCloseTo(0.9, 12);
    expect(AGGREGATORS.clipped_sum([0.8, 0.8])).toBe(1);
  });

  it.each(AGGREGATOR_IDS)('%s is monotone: a second adverse incident never lowers the total', (form) => {
    expect(aggregateNonNegative([0.5, 0.3], form)).toBeGreaterThanOrEqual(aggregateNonNegative([0.5], form));
  });

  it.each(AGGREGATOR_IDS)('%s stays inside [0,1] however many incidents are combined', (form) => {
    const v = aggregateNonNegative([0.9, 0.9, 0.9, 0.9, 0.9], form);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it.each(AGGREGATOR_IDS)('%s returns 0 for no contributions', (form) => {
    expect(aggregateNonNegative([], form)).toBe(0);
  });

  it('rejects an unknown form rather than silently choosing one', () => {
    expect(() => aggregateNonNegative([0.5], 'independence')).toThrow(/unknown aggregation form/);
  });
});

describe('aggregateSigned() — signs are combined separately, then netted', () => {
  it('mixed adverse and mitigating contributions stay within [-1,1]', () => {
    const v = aggregateSigned([0.8, -0.6, 0.5]);
    expect(v).toBeGreaterThanOrEqual(-1);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('is order-independent: the two signs never cancel inside the bounded operator', () => {
    const a = aggregateSigned([0.8, -0.6, 0.5]);
    const b = aggregateSigned([-0.6, 0.5, 0.8]);
    const c = aggregateSigned([0.5, 0.8, -0.6]);
    expect(a).toBeCloseTo(b, 12);
    expect(b).toBeCloseTo(c, 12);
  });

  it('equals the adverse aggregate minus the mitigating aggregate', () => {
    const v = aggregateSigned([0.4, 0.5, -0.2]);
    expect(v).toBeCloseTo(AGGREGATORS.bounded_union([0.4, 0.5]) - AGGREGATORS.bounded_union([0.2]), 12);
  });
});
