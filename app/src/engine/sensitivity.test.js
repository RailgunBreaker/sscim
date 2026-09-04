/* ====================================================================
   sensitivity.test.js — the global sensitivity design.

   Two properties matter more than any number the design produces:

     1. REPRODUCIBILITY. The artefact is committed and diffed. If a rerun
        over the same snapshot produced different numbers, the diff would
        be noise and nobody would read it. There is no unseeded
        randomness anywhere in this path, and this file pins that shut.

     2. THE BASE RESULT LIES INSIDE EVERY REPORTED ENVELOPE. An envelope
        that does not contain the base result means the sweep explored a
        box the base parameters are not in — a bug in the design, not a
        finding about the model.
   ==================================================================== */
import { describe, it, expect } from 'vitest';
import {
  makeRng, saltelliDesign, sobolIndices, sobolBootstrap, sobolConvergence,
  continuousDimensions, rowToOverrides,
  modelFormGrid, rankStability, signStability, envelope, oneAtATime,
} from './sensitivity.js';
import { buildEngine } from './index.js';
import { makeFixtureData } from './testFixture.js';
import { PARAMETERS, MODEL_FORMS, STRUCTURAL_COMPONENTS, resolveParams, BASE_PARAMS } from './registry.js';

/* A small but real evaluation: the fixture engine's headline index at a
   given parameter override. Fast enough to sweep in a unit test. */
const data = makeFixtureData();
const evaluate = (overrides) => {
  const e = buildEngine({ ...data, params: overrides, computeHistory: false });
  return e.toDisplayIndex(e.operationalIndex(e.operationalField(data.EVENTS)));
};

describe('the generator is deterministic', () => {
  it('produces an identical stream for an identical seed', () => {
    const a = Array.from({ length: 64 }, makeRng(12345));
    const b = Array.from({ length: 64 }, makeRng(12345));
    expect(a).toEqual(b);
  });

  it('produces a different stream for a different seed', () => {
    const a = Array.from({ length: 64 }, makeRng(1));
    const b = Array.from({ length: 64 }, makeRng(2));
    expect(a).not.toEqual(b);
  });

  it('stays inside [0,1) and is not obviously degenerate', () => {
    const rng = makeRng(7);
    const draws = Array.from({ length: 4000 }, rng);
    draws.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); });
    const mean = draws.reduce((a, v) => a + v, 0) / draws.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    expect(new Set(draws).size).toBeGreaterThan(3900); // no short cycle
  });
});

describe('the Saltelli design', () => {
  const dims = 4;
  const samples = 16;

  it('is byte-reproducible for a fixed seed', () => {
    expect(saltelliDesign({ dims, samples, seed: 99 })).toEqual(saltelliDesign({ dims, samples, seed: 99 }));
  });

  it('builds A, B and one AB matrix per dimension, at the stated cost', () => {
    const d = saltelliDesign({ dims, samples, seed: 99 });
    expect(d.A).toHaveLength(samples);
    expect(d.B).toHaveLength(samples);
    expect(d.AB).toHaveLength(dims);
    expect(d.evaluations).toBe(samples * (dims + 2));
  });

  it('AB_i is A with exactly column i taken from B', () => {
    const d = saltelliDesign({ dims, samples, seed: 5 });
    for (let i = 0; i < dims; i++) {
      for (let j = 0; j < samples; j++) {
        for (let k = 0; k < dims; k++) {
          expect(d.AB[i][j][k]).toBe(k === i ? d.B[j][i] : d.A[j][k]);
        }
      }
    }
  });
});

describe('the Sobol estimators', () => {
  it('assign all the influence to the one dimension the output depends on', () => {
    const dims = 3;
    const d = saltelliDesign({ dims, samples: 512, seed: 42 });
    const f = (row) => row[0]; // depends on dimension 0 only
    const r = sobolIndices({
      yA: d.A.map(f), yB: d.B.map(f), yAB: d.AB.map((m) => m.map(f)),
    });
    expect(r.first[0]).toBeGreaterThan(0.9);
    expect(r.total[0]).toBeGreaterThan(0.9);
    expect(r.first[1]).toBeLessThan(0.1);
    expect(r.total[1]).toBeLessThan(0.1);
  });

  it('reports a constant output as degenerate rather than dividing by nothing', () => {
    const d = saltelliDesign({ dims: 2, samples: 32, seed: 1 });
    const f = () => 3;
    const r = sobolIndices({ yA: d.A.map(f), yB: d.B.map(f), yAB: d.AB.map((m) => m.map(f)) });
    expect(r.degenerate).toBe(true);
    expect(r.first.every((v) => v === 0)).toBe(true);
  });

  it('keeps every reported index inside [0,1]', () => {
    const d = saltelliDesign({ dims: 3, samples: 128, seed: 8 });
    const f = (row) => row[0] * row[1] + 0.2 * row[2];
    const r = sobolIndices({ yA: d.A.map(f), yB: d.B.map(f), yAB: d.AB.map((m) => m.map(f)) });
    [...r.first, ...r.total].forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); });
  });
});

describe('the sampled dimensions', () => {
  const dims = continuousDimensions();

  it('cover every continuous registry parameter and every raw structural weight', () => {
    expect(dims).toHaveLength(Object.keys(PARAMETERS).length + STRUCTURAL_COMPONENTS.length);
    Object.keys(PARAMETERS).forEach((k) => expect(dims.some((d) => d.key === k)).toBe(true));
    STRUCTURAL_COMPONENTS.forEach((k) => expect(dims.some((d) => d.key === `structuralWeight.${k}`)).toBe(true));
  });

  it('map a unit row onto overrides the registry accepts, at the declared bounds', () => {
    const lo = rowToOverrides(dims.map(() => 0), dims);
    const hi = rowToOverrides(dims.map(() => 1), dims);
    expect(() => resolveParams(lo)).not.toThrow();
    expect(() => resolveParams(hi)).not.toThrow();
    expect(lo.downstreamTransmission).toBeCloseTo(PARAMETERS.downstreamTransmission.low, 12);
    expect(hi.downstreamTransmission).toBeCloseTo(PARAMETERS.downstreamTransmission.high, 12);
    expect(resolveParams(hi).structuralWeights.geo).toBeGreaterThan(0);
  });

  it('always produce a structural weight vector summing to one', () => {
    const rng = makeRng(3);
    for (let i = 0; i < 25; i++) {
      const p = resolveParams(rowToOverrides(dims.map(() => rng()), dims));
      expect(Object.values(p.structuralWeights).reduce((a, v) => a + v, 0)).toBeCloseTo(1, 12);
    }
  });
});

describe('the model-form grid', () => {
  it('is the full factorial over every declared categorical choice', () => {
    const grid = modelFormGrid();
    const expected = Object.values(MODEL_FORMS).reduce((a, f) => a * f.options.length, 1);
    expect(grid).toHaveLength(expected);
    expect(new Set(grid.map((c) => JSON.stringify(c))).size).toBe(expected);
  });

  it('contains the registry base combination exactly once', () => {
    const base = Object.fromEntries(Object.entries(MODEL_FORMS).map(([k, v]) => [k, v.base]));
    const hits = modelFormGrid().filter((c) => Object.entries(base).every(([k, v]) => c[k] === v));
    expect(hits).toHaveLength(1);
  });

  it('every combination is accepted by the registry', () => {
    modelFormGrid().forEach((combo) => expect(() => resolveParams(combo)).not.toThrow());
  });
});

/* ==================================================================
   REPRODUCIBILITY AND THE ENVELOPE, over the real engine.
   ================================================================== */
describe('the sweep over the engine', () => {
  const dims = continuousDimensions();
  const design = saltelliDesign({ dims: dims.length, samples: 12, seed: 20260829 });
  const run = () => [...design.A, ...design.B].map((row) => evaluate(rowToOverrides(row, dims)));

  it('is reproducible: two runs over the same snapshot are bit-identical', () => {
    expect(run()).toEqual(run());
  });

  it('produces finite, bounded results at every sampled point', () => {
    run().forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
    });
  });

  /* THE INVARIANT THAT MATTERS. Every published envelope must contain the
     base result. One that does not means the sweep explored a box the base
     parameters are not in. */
  it('the base result lies inside the numerical assumption envelope', () => {
    const base = evaluate(undefined);
    const env = envelope(run(), base);
    expect(env.containsBase).toBe(true);
    expect(base).toBeGreaterThanOrEqual(env.low - 1e-9);
    expect(base).toBeLessThanOrEqual(env.high + 1e-9);
  });

  it('the base result lies inside the MODEL-FORM envelope too', () => {
    const base = evaluate(undefined);
    const values = modelFormGrid().map((combo) => evaluate(combo));
    const env = envelope(values, base);
    expect(env.containsBase).toBe(true);
  });

  it('the base result lies inside every one-at-a-time range', () => {
    const oat = oneAtATime({ evaluate, dims });
    oat.forEach((d) => {
      expect(d.atBase).toBeGreaterThanOrEqual(Math.min(d.atLow, d.atHigh) - 1e-9);
      expect(d.atBase).toBeLessThanOrEqual(Math.max(d.atLow, d.atHigh) + 1e-9);
    });
  });

  it('reports the envelope as an assumption envelope, never a confidence interval', () => {
    const env = envelope([1, 2, 3], 2);
    expect(env.kind).toBe('assumption-envelope');
    expect(env.note).toMatch(/NOT a confidence interval/i);
    expect(env.note).toMatch(/computational design/i);
  });

  it('the in-app envelope also contains its own base', () => {
    const engine = buildEngine({ ...data, computeHistory: false });
    const env = engine.sensitivityEnvelope(data.EVENTS);
    expect(env.base).toBeGreaterThanOrEqual(env.low - 1e-12);
    expect(env.base).toBeLessThanOrEqual(env.high + 1e-12);
    expect(env.base).toBeCloseTo(engine.operationalIndex(engine.operationalField(data.EVENTS)), 12);
  });
});

describe('rank and sign stability', () => {
  it('reports a perfectly stable ranking as spearman 1 with full top-k membership', () => {
    const base = { a: 3, b: 2, c: 1 };
    const r = rankStability(base, [base, base, base], 2);
    expect(r.spearmanVsBase.min).toBeCloseTo(1, 10);
    expect(r.topKFrequency.a).toBe(1);
    expect(r.baseTopK).toEqual(['a', 'b']);
  });

  it('detects a reordering', () => {
    const base = { a: 3, b: 2, c: 1 };
    const r = rankStability(base, [{ a: 1, b: 2, c: 3 }], 2);
    expect(r.spearmanVsBase.min).toBeCloseTo(-1, 10);
  });

  it('calls a sign stable only when every sample agrees', () => {
    expect(signStability([0.2, 0.5, 0.1]).stable).toBe(true);
    expect(signStability([0.2, 0.5, -0.1]).stable).toBe(false);
    expect(signStability([-0.2, -0.5]).dominantSign).toBe('negative');
  });
});

describe('one-at-a-time diagnostics', () => {
  const dims = continuousDimensions();

  it('vary exactly one dimension at a time and rank by the range they open', () => {
    const oat = oneAtATime({ evaluate, dims });
    expect(oat).toHaveLength(dims.length);
    for (let i = 1; i < oat.length; i++) expect(oat[i - 1].range).toBeGreaterThanOrEqual(oat[i].range);
    oat.forEach((d) => expect(d.atBase).toBeCloseTo(evaluate(undefined), 12));
  });

  it('base parameters reproduce the default engine exactly', () => {
    expect(evaluate({})).toBeCloseTo(evaluate(undefined), 12);
    expect(evaluate({ downstreamTransmission: BASE_PARAMS.downstreamTransmission })).toBeCloseTo(evaluate(undefined), 12);
  });
});

/* ==================================================================
   ESTIMATOR QUALITY (v7.1). v7.0 clipped the Sobol estimates to [0,1] and
   published them as exact, so estimator noise was indistinguishable from
   a real zero, and impossible results (S_i > ST_i) were invisible.
   ================================================================== */
describe('the Sobol estimator against a model with KNOWN analytic indices', () => {
  /* Ishigami: f = sin(x1) + a sin^2(x2) + b x3^4 sin(x1), xi ~ U(-pi, pi).
     With a = 7, b = 0.1 the indices are known in closed form. x3 has zero
     FIRST-order influence and substantial TOTAL-order influence — the one
     case that catches an estimator which confuses the two. */
  const a = 7, b = 0.1, TP = 2 * Math.PI;
  const f = (row) => {
    const x = row.map((u) => -Math.PI + u * TP);
    return Math.sin(x[0]) + a * Math.sin(x[1]) ** 2 + b * (x[2] ** 4) * Math.sin(x[0]);
  };
  const design = saltelliDesign({ dims: 3, samples: 8192, seed: 1 });
  const yA = design.A.map(f), yB = design.B.map(f);
  const yAB = design.AB.map((m) => m.map(f));
  const est = sobolIndices({ yA, yB, yAB });

  const ANALYTIC_FIRST = [0.3139, 0.4424, 0.0];
  const ANALYTIC_TOTAL = [0.5576, 0.4424, 0.2437];

  it.each([0, 1, 2])('recovers the analytic FIRST-order index for x%i', (i) => {
    expect(est.firstRaw[i]).toBeCloseTo(ANALYTIC_FIRST[i], 1);
  });

  it.each([0, 1, 2])('recovers the analytic TOTAL-order index for x%i', (i) => {
    expect(est.totalRaw[i]).toBeCloseTo(ANALYTIC_TOTAL[i], 1);
  });

  it('finds x3 first-order near zero while its total-order is clearly non-zero', () => {
    expect(Math.abs(est.firstRaw[2])).toBeLessThan(0.06);
    expect(est.totalRaw[2]).toBeGreaterThan(0.15);
  });

  it('never reports a first-order index above its own total-order index', () => {
    expect(est.firstExceedsTotal).toEqual([false, false, false]);
  });
});

describe('raw versus display-clipped estimates', () => {
  const design = saltelliDesign({ dims: 3, samples: 256, seed: 11 });
  const f = (row) => row[0] + 0.5 * row[1];          // x3 is INACTIVE
  const yA = design.A.map(f), yB = design.B.map(f);
  const yAB = design.AB.map((m) => m.map(f));
  const est = sobolIndices({ yA, yB, yAB });

  it('publishes the unclipped estimate alongside the clipped one', () => {
    expect(est.firstRaw).toHaveLength(3);
    expect(est.totalRaw).toHaveLength(3);
    expect(est.first).toHaveLength(3);
    est.first.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); });
  });

  it('flags exactly the entries display clipping altered', () => {
    est.clipped.forEach((wasClipped, i) => {
      const outside = est.firstRaw[i] < 0 || est.firstRaw[i] > 1 || est.totalRaw[i] < 0 || est.totalRaw[i] > 1;
      expect(wasClipped).toBe(outside);
    });
  });

  it('gives an INACTIVE dimension a total-order index near zero', () => {
    expect(Math.abs(est.totalRaw[2])).toBeLessThan(0.05);
  });
});

describe('estimator uncertainty is reported, not assumed away', () => {
  const design = saltelliDesign({ dims: 3, samples: 512, seed: 5 });
  const f = (row) => row[0] + 0.5 * row[1];
  const yA = design.A.map(f), yB = design.B.map(f);
  const yAB = design.AB.map((m) => m.map(f));

  it('bootstrap intervals bracket the point estimate, with positive error where the dimension acts', () => {
    const bs = sobolBootstrap({ yA, yB, yAB, replicates: 60, seed: 7 });
    const est = sobolIndices({ yA, yB, yAB });
    bs.total.forEach((t, i) => {
      expect(t.standardError).toBeGreaterThanOrEqual(0);
      expect(t.ci95[0]).toBeLessThanOrEqual(t.ci95[1]);
      expect(est.totalRaw[i]).toBeGreaterThan(t.ci95[0] - 0.15);
      expect(est.totalRaw[i]).toBeLessThan(t.ci95[1] + 0.15);
    });
    // The two dimensions the function actually uses carry real error...
    expect(bs.total[0].standardError).toBeGreaterThan(0);
    expect(bs.total[1].standardError).toBeGreaterThan(0);
  });

  /* A dimension the function IGNORES is a special case worth pinning: the
     estimator differences (yA - yAB_i) are identically zero, so the index
     and its bootstrap error are exactly zero rather than small-and-noisy.
     That is a property of the design, not a coincidence of the seed. */
  it('a dimension the model genuinely ignores has exactly zero total-order index and zero error', () => {
    const bs = sobolBootstrap({ yA, yB, yAB, replicates: 40, seed: 7 });
    const est = sobolIndices({ yA, yB, yAB });
    expect(est.totalRaw[2]).toBe(0);
    expect(bs.total[2].standardError).toBe(0);
    expect(bs.total[2].ci95).toEqual([0, 0]);
  });

  it('bootstrap is deterministic for a fixed seed', () => {
    const one = sobolBootstrap({ yA, yB, yAB, replicates: 30, seed: 99 });
    const two = sobolBootstrap({ yA, yB, yAB, replicates: 30, seed: 99 });
    expect(one).toEqual(two);
  });

  it('reports an interval for every dimension, including inactive ones', () => {
    const bs = sobolBootstrap({ yA, yB, yAB, replicates: 80, seed: 3 });
    expect(bs.first).toHaveLength(3);
    bs.first.forEach((t) => {
      expect(Array.isArray(t.ci95)).toBe(true);
      expect(t.ci95[0]).toBeLessThanOrEqual(t.ci95[1]);
      expect(Number.isFinite(t.standardError)).toBe(true);
    });
  });

  it('convergence reports the drift between successive sample sizes', () => {
    const cv = sobolConvergence({ yA, yB, yAB });
    expect(cv.steps.length).toBeGreaterThanOrEqual(2);
    expect(cv.steps[0].samples).toBeLessThan(cv.steps.at(-1).samples);
    expect(cv.maxFirstDrift).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(cv.maxTotalDrift)).toBe(true);
  });

  it('drift shrinks as the sample size grows, for a well-behaved model', () => {
    const big = saltelliDesign({ dims: 2, samples: 4096, seed: 21 });
    const g = (row) => row[0];
    const cv = sobolConvergence({
      yA: big.A.map(g), yB: big.B.map(g), yAB: big.AB.map((m) => m.map(g)),
    });
    expect(cv.maxTotalDrift).toBeLessThan(0.05);
  });
});

describe('multiple seeds agree within estimator uncertainty', () => {
  const f = (row) => row[0] + 0.5 * row[1];
  const at = (seed) => {
    const d = saltelliDesign({ dims: 3, samples: 1024, seed });
    return sobolIndices({ yA: d.A.map(f), yB: d.B.map(f), yAB: d.AB.map((m) => m.map(f)) });
  };
  it('gives the same ordering and close values across independent seeds', () => {
    const runs = [at(1), at(2), at(3)];
    runs.forEach((r) => {
      expect(r.totalRaw[0]).toBeGreaterThan(r.totalRaw[1]);   // x1 dominates x2
      expect(r.totalRaw[1]).toBeGreaterThan(r.totalRaw[2]);   // x2 beats inactive x3
    });
    const spread = Math.max(...runs.map((r) => r.totalRaw[0])) - Math.min(...runs.map((r) => r.totalRaw[0]));
    expect(spread).toBeLessThan(0.1);
  });
});
