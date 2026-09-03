/* ====================================================================
   sensitivity.js — GLOBAL SENSITIVITY ANALYSIS.

   WHAT THIS REPLACES. v6's principal uncertainty analysis was three
   presets — low / base / high — that moved the transmission coefficients
   and the half-life TOGETHER, in the same direction, by the same relative
   amount. That design cannot answer the only question worth asking of an
   uncalibrated model ("which assumption is my answer actually resting
   on?"), because every parameter moves at once; and it systematically
   overstates the spread, because perfectly correlated movement is the
   widest possible envelope.

   WHAT THIS IS. A deterministic, fixed-seed variance-based global design
   (Saltelli's estimators for first-order and total-order Sobol indices)
   over the assumption box declared in registry.js, plus one-at-a-time
   diagnostics, rank-stability statistics, and a SEPARATE full-factorial
   sweep over the categorical model forms.

   READ THIS BEFORE READING ANY NUMBER THIS PRODUCES.

     UNIFORM SAMPLING OVER AN ASSUMPTION BOX IS A COMPUTATIONAL DESIGN,
     NOT A PROBABILITY DISTRIBUTION OVER WHAT IS TRUE.

   The registry's low/base/high are stress bounds a person chose. Nothing
   establishes that the truth is inside them, still less that it is
   uniformly distributed across them. It follows that:

     · the spread reported here is an ASSUMPTION ENVELOPE. It is not a
       confidence interval, a credible interval, or a prediction interval,
       and it must never be labelled as one;
     · a Sobol index here answers "how much of the variation ACROSS THIS
       BOX does this parameter drive", which is a statement about the
       model's structure, not about the world;
     · rank stability is the finding that actually travels: if an ordering
       survives the whole box, it does not rest on the coefficients.

   NO UNSEEDED RANDOMNESS. Every sample is drawn from a seeded
   deterministic generator, so two runs over the same snapshot produce
   byte-identical output, and the sensitivity report can be regenerated
   and diffed like any other build artefact.
   ==================================================================== */
import { PARAMETERS, STRUCTURAL_WEIGHT_SPECS, STRUCTURAL_COMPONENTS, MODEL_FORMS } from './registry.js';
import { spearman } from './math.js';

/* ---------------- deterministic generator ----------------
   splitmix32: a small, well-distributed, fully deterministic PRNG. Chosen
   over Math.random for the only reason that matters here — reproducibility
   — and over a hand-rolled LCG because splitmix32 passes the usual
   equidistribution smoke tests at this sample size. */
export function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad) >>> 0;
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97) >>> 0;
    t = (t ^ (t >>> 15)) >>> 0;
    return t / 4294967296;
  };
}

/* ---------------- Saltelli design ----------------
   Two independent unit-hypercube sample matrices A and B, plus, for each
   dimension i, the matrix AB_i that is A with column i taken from B. This
   is the standard construction behind the Sobol estimators below and costs
   N*(k+2) model evaluations. */
export function saltelliDesign({ dims, samples, seed = 20260829 }) {
  const rng = makeRng(seed);
  const draw = () => Array.from({ length: samples }, () => Array.from({ length: dims }, () => rng()));
  const A = draw();
  const B = draw();
  const AB = [];
  for (let i = 0; i < dims; i++) {
    AB.push(A.map((row, j) => {
      const copy = row.slice();
      copy[i] = B[j][i];
      return copy;
    }));
  }
  return { A, B, AB, samples, dims, seed, evaluations: samples * (dims + 2) };
}

const mean = (v) => v.reduce((a, x) => a + x, 0) / (v.length || 1);
const variance = (v) => {
  if (v.length < 2) return 0;
  const m = mean(v);
  return v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1);
};

/* Jansen (1999) estimators, as recommended in Saltelli et al. (2010):

     S_i  = [ Var(y) - (1/2N) sum_j (yB_j  - yAB_ij)^2 ] / Var(y)
     ST_i =            (1/2N) sum_j (yA_j  - yAB_ij)^2   / Var(y)

   The first-order estimator is written this way DELIBERATELY. The
   alternative correlation form, (1/N) sum_j yB_j (yAB_ij - yA_j) / Var(y),
   is also unbiased but has markedly higher variance at finite N — enough
   that on this model it routinely reported S_i above ST_i, which is
   arithmetically impossible and would have been read as a real finding.
   Both Jansen forms are differences of paired evaluations, so the sampling
   noise largely cancels and the pair stays consistent.

   Both are RATIOS OF VARIANCES OVER THE SAMPLED BOX. A near-zero variance
   means the output barely moves across the whole assumption box — a
   finding in itself, reported as `degenerate` rather than as a division by
   almost nothing. Estimates are clipped to [0,1] for reporting: they are
   unbiased but not guaranteed to land inside the interval at finite N, and
   a reported index of -0.03 is noise, not a negative influence. */
export function sobolIndices({ yA, yB, yAB }) {
  const all = [...yA, ...yB];
  const varY = variance(all);
  const n = yA.length;
  const first = [];
  const total = [];
  for (const yABi of yAB) {
    if (!(varY > 1e-15)) { first.push(0); total.push(0); continue; }
    let sFirst = 0, sTotal = 0;
    for (let j = 0; j < n; j++) {
      sFirst += (yB[j] - yABi[j]) ** 2;
      sTotal += (yA[j] - yABi[j]) ** 2;
    }
    first.push(Math.min(1, Math.max(0, (varY - sFirst / (2 * n)) / varY)));
    total.push(Math.min(1, Math.max(0, (sTotal / (2 * n)) / varY)));
  }
  return { first, total, variance: varY, degenerate: !(varY > 1e-15) };
}

/* ---------------- the sampled dimensions ----------------
   The seven continuous registry parameters plus the five RAW structural
   weights. The weights are sampled raw and renormalized inside the
   evaluator, so the effective vector always sums to one no matter where in
   the box a sample lands. */
export function continuousDimensions() {
  const dims = Object.keys(PARAMETERS).map((key) => ({
    key, kind: 'parameter', symbol: PARAMETERS[key].symbol, units: PARAMETERS[key].units,
    low: PARAMETERS[key].low, high: PARAMETERS[key].high, base: PARAMETERS[key].base,
  }));
  for (const key of STRUCTURAL_COMPONENTS) {
    const s = STRUCTURAL_WEIGHT_SPECS[key];
    dims.push({
      key: `structuralWeight.${key}`, kind: 'structuralWeight', component: key,
      symbol: s.symbol, units: s.units, low: s.low, high: s.high, base: s.base,
    });
  }
  return dims;
}

/* Map one unit-hypercube row onto a parameter-override object. */
export function rowToOverrides(row, dims) {
  const overrides = {};
  const structuralWeightsRaw = {};
  dims.forEach((d, i) => {
    const value = d.low + row[i] * (d.high - d.low);
    if (d.kind === 'structuralWeight') structuralWeightsRaw[d.component] = value;
    else overrides[d.key] = value;
  });
  if (Object.keys(structuralWeightsRaw).length) overrides.structuralWeightsRaw = structuralWeightsRaw;
  return overrides;
}

/* Every combination of the categorical model forms. Reported SEPARATELY
   from the numerical results: a model form is a different model, not a
   different value of the same model, and averaging across them would
   present a choice between structures as if it were noise. */
export function modelFormGrid() {
  const keys = Object.keys(MODEL_FORMS);
  let grid = [{}];
  for (const key of keys) {
    const next = [];
    for (const combo of grid) for (const option of MODEL_FORMS[key].options) next.push({ ...combo, [key]: option });
    grid = next;
  }
  return grid;
}

/* ---------------- rank stability ---------------- */
export function topKMembership(scoreMaps, k = 5) {
  const counts = {};
  for (const m of scoreMaps) {
    const top = Object.entries(m).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, k);
    top.forEach(([id]) => { counts[id] = (counts[id] ?? 0) + 1; });
  }
  const n = scoreMaps.length || 1;
  return Object.fromEntries(Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([id, c]) => [id, c / n]));
}

export function rankStability(baseMap, sampleMaps, k = 5) {
  const correlations = sampleMaps.map((m) => spearman(baseMap, m));
  return {
    spearmanVsBase: {
      min: Math.min(...correlations), mean: mean(correlations), max: Math.max(...correlations),
      belowPoint9: correlations.filter((c) => c < 0.9).length / (correlations.length || 1),
    },
    topKFrequency: topKMembership(sampleMaps, k),
    baseTopK: Object.entries(baseMap).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, k).map(([id]) => id),
  };
}

/* Sign stability for a scenario delta. A scenario whose delta never
   changes sign across the whole assumption box supports a directional
   statement; one that does, does not — and that is the honest reading. */
export function signStability(values, tolerance = 1e-9) {
  let pos = 0, neg = 0, zero = 0;
  for (const v of values) {
    if (v > tolerance) pos += 1;
    else if (v < -tolerance) neg += 1;
    else zero += 1;
  }
  const n = values.length || 1;
  const dominant = pos >= neg ? 'positive' : 'negative';
  return {
    positiveShare: pos / n, negativeShare: neg / n, zeroShare: zero / n,
    dominantSign: dominant,
    stable: (dominant === 'positive' ? pos : neg) / n >= 1 - 1e-12,
  };
}

/* ---------------- envelopes ---------------- */
export function envelope(values, base) {
  const finite = values.filter((v) => Number.isFinite(v));
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  return {
    low, base, high,
    width: high - low,
    /* An envelope that does not contain the base result would mean the
       base parameters lie outside the box the sweep explored — a bug in
       the design, not a finding. Reported so the assertion is visible in
       the artefact and not only in the test suite. */
    containsBase: Number.isFinite(base) && base >= low - 1e-9 && base <= high + 1e-9,
    kind: 'assumption-envelope',
    note: 'Assumption envelope over the declared parameter box. NOT a confidence interval: uniform sampling over an assumption box is a computational design, not a probability distribution over what is true.',
  };
}

/* One-at-a-time diagnostics: each parameter taken to the ends of its own
   range with everything else held at base. Cheap, easy to read, and
   strictly less informative than the Sobol indices — it cannot see
   interactions at all, which is exactly why both are reported. */
export function oneAtATime({ evaluate, dims }) {
  const base = evaluate({});
  return dims.map((d) => {
    const mk = (value) => (d.kind === 'structuralWeight'
      ? { structuralWeightsRaw: { [d.component]: value } }
      : { [d.key]: value });
    const low = evaluate(mk(d.low));
    const high = evaluate(mk(d.high));
    return {
      key: d.key, symbol: d.symbol, low: d.low, high: d.high,
      atLow: low, atBase: base, atHigh: high,
      range: Math.max(low, base, high) - Math.min(low, base, high),
      monotoneIncreasing: low <= base + 1e-12 && base <= high + 1e-12,
      monotoneDecreasing: low >= base - 1e-12 && base >= high - 1e-12,
    };
  }).sort((a, b) => b.range - a.range);
}

export { spearman };
