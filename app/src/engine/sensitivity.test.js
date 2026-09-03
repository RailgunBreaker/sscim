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
  makeRng, saltelliDesign, sobolIndices, continuousDimensions, rowToOverrides,
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
