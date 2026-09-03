/* ====================================================================
   math.js — pure, dependency-free numerical primitives shared by the
   engine. Everything here is either (a) a standard, named statistical or
   graph construct (HHI, topological sort) or (b) an explicitly labelled
   pragmatic prior. None of it is presented as a result drawn from the
   cited literature — see docs/MODEL_V7_SPEC.md §9.
   ==================================================================== */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const clamp10 = (v) => clamp(v, 0, 10);
export const clampSigned = (v) => clamp(v, -1, 1);

/* Display-only epsilon, and the ONLY tolerance left in the engine. v7
   propagation is exact on a finite DAG, so no substantive calculation
   truncates anything — v6's `contributionTolerance`, which stopped
   propagation once a contribution fell below 1e-4, is gone. This exists
   solely so a display surface can ask "is this worth printing", and it
   must never gate a modelled quantity. */
export const DISPLAY_EPSILON = 1e-9;

/* True when a value is large enough to be worth showing. Display only. */
export const isDisplayable = (v) => Number.isFinite(v) && Math.abs(v) >= DISPLAY_EPSILON;

/* Exponential half-life decay: decay(0,H)=1, decay(H,H)=0.5. Age is
   measured against the dataset's frozen snapshot date, never against the
   reader's clock. Used by the exponential persistence profiles
   (persistence.js), which are the only callers that should apply it. */
export function decay(ageDays, halfLifeDays) {
  if (!Number.isFinite(ageDays) || !Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 0;
  return Math.pow(2, -ageDays / halfLifeDays);
}

/* ---------------- Herfindahl-Hirschman index with an explicit
   partial-observation interval ----------------

   Disclosed country shares frequently sum to less than one. The residual
   is UNOBSERVED, and its concentration is not determined by the data, so a
   single HHI number is not identified. v7 publishes the interval instead:

     lower = sum_i s_i^2                      the residual is infinitely
                                              fragmented (least concentrated
                                              configuration consistent with
                                              what is observed)
     upper = lower + (1 - sum_i s_i)^2        the residual is one
                                              undisclosed holder (most
                                              concentrated configuration)

   Both bounds are correct bounds on the true HHI given the observed
   shares. The UPPER bound is the explicitly conservative default for a
   concentration measure; both enter sensitivity (registry model form
   `hhiResidual`). An over-allocated input vector (shares summing above 1)
   is tolerated by normalizing for the computation, and flagged. */
export function hhiBounds(shares, tolerance = 1e-6) {
  const values = Object.values(shares || {}).filter((v) => Number.isFinite(v) && v > 0);
  const sum = values.reduce((a, v) => a + v, 0);
  let normalized = values;
  let overAllocated = false;
  if (sum > 1 + tolerance) {
    overAllocated = true;
    normalized = values.map((v) => v / sum);
  }
  const observedSum = normalized.reduce((a, v) => a + v, 0);
  const residual = Math.max(0, 1 - observedSum);
  const lower = normalized.reduce((a, v) => a + v * v, 0);
  const upper = lower + residual * residual;
  return {
    lower,
    upper,
    residual,
    overAllocated,
    observedSum,
    lowerScore10: clamp10(10 * lower),
    upperScore10: clamp10(10 * upper),
  };
}

/* Kahn's-algorithm topological sort over a directed graph given as
   adjacency lists (OUT[node] = [downstream neighbours]). Returns
   { order, hasCycle } — hasCycle is true iff not every node was reachable
   in the sort (a cycle or a dangling reference exists).

   The ready queue is kept in the caller's declared node order, so the
   returned order is deterministic for a given input and the propagation
   built on it is reproducible run to run. */
export function topologicalSort(nodeIds, out) {
  const indeg = {};
  nodeIds.forEach((n) => (indeg[n] = 0));
  nodeIds.forEach((n) => (out[n] || []).forEach((m) => { indeg[m] = (indeg[m] ?? 0) + 1; }));
  const queue = nodeIds.filter((n) => indeg[n] === 0);
  const order = [];
  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    (out[n] || []).forEach((m) => { if (--indeg[m] === 0) queue.push(m); });
  }
  return { order, hasCycle: order.length !== nodeIds.length };
}

/* ---------------- stage economic weights ----------------
   NORMALIZED TO SUM TO ONE, directly. The headline index is then a plain
   weighted mean of the stage field with weights that are a partition of
   one, which is what makes the per-country chain contributions reconcile
   to it exactly.

   turnover IS AN IMPORTANCE PROXY, NOT A LOSS BASE. Supply-chain turnover
   is sequential: the same wafer is counted in the wafer stage's turnover,
   again in the fab stage's, and again in the packaging stage's. Summing it
   is not an economic aggregate and no output here should be read as money.

     turnover_normalized  w_s = value_s / sum_t value_t     (base)
     equal                w_s = 1 / n
     log_turnover         w_s = log1p(value_s) / sum_t log1p(value_t)
*/
export function stageWeights(entries, form = 'turnover_normalized') {
  const list = (entries || []).map(([id, v]) => [id, Number.isFinite(v) && v > 0 ? v : 0]);
  if (!list.length) return {};
  let raw;
  if (form === 'equal') raw = list.map(([id]) => [id, 1]);
  else if (form === 'log_turnover') raw = list.map(([id, v]) => [id, Math.log1p(v)]);
  else if (form === 'turnover_normalized') raw = list;
  else throw new Error(`unknown stage weighting "${form}" — expected turnover_normalized|equal|log_turnover`);

  const total = raw.reduce((a, [, v]) => a + v, 0);
  if (!(total > 0)) return Object.fromEntries(list.map(([id]) => [id, 1 / list.length]));
  return Object.fromEntries(raw.map(([id, v]) => [id, v / total]));
}

/* log1p-based max-normalized weighting, kept for display-side compression
   of skewed magnitudes. Not used for the headline index — that uses
   stageWeights(), which sums to one. */
export function log1pNormalized(values) {
  const logs = values.map(([id, v]) => [id, Math.log1p(Math.max(0, v))]);
  const maxLog = Math.max(...logs.map(([, v]) => v), 1e-9);
  return Object.fromEntries(logs.map(([id, v]) => [id, v / maxLog]));
}

/* Spearman rank correlation between two same-keyed score maps. Used by the
   sensitivity report to state whether a perturbation reorders the ranking,
   which is the question that actually matters for a comparison tool. */
export function spearman(aMap, bMap) {
  const keys = Object.keys(aMap).filter((k) => k in bMap);
  const n = keys.length;
  if (n < 2) return 1;
  const rank = (m) => {
    const sorted = [...keys].sort((x, y) => (m[y] - m[x]) || (x < y ? -1 : 1));
    const r = {};
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && m[sorted[j + 1]] === m[sorted[i]]) j++;
      const avg = (i + j) / 2 + 1; // average rank for ties
      for (let k = i; k <= j; k++) r[sorted[k]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(aMap), rb = rank(bMap);
  const ma = keys.reduce((s, k) => s + ra[k], 0) / n;
  const mb = keys.reduce((s, k) => s + rb[k], 0) / n;
  let num = 0, da = 0, db = 0;
  keys.forEach((k) => {
    const x = ra[k] - ma, y = rb[k] - mb;
    num += x * y; da += x * x; db += y * y;
  });
  if (da === 0 || db === 0) return 1;
  return num / Math.sqrt(da * db);
}

export function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
