/* ====================================================================
   math.js — pure, dependency-free numerical primitives shared by the
   engine. Every formula implemented here is either (a) a standard,
   named statistical/graph construct (HHI, topological sort) or (b) an
   explicitly-labeled pragmatic aggregation prior (noisy-OR combination).
   None of it is presented as a result drawn from the cited literature —
   see README §12 and MODEL_ROADMAP.md.
   ==================================================================== */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const clamp10 = (v) => clamp(v, 0, 10);
export const clampSigned = (v) => clamp(v, -1, 1);

/* Genuine exponential half-life decay: decay(0,H)=1, decay(H,H)=0.5. Age is
   relative to MODEL_PRIORS.datasetAsOf (a frozen snapshot date), never to
   the visitor's real-time clock — see priors.js. */
export function decay(ageDays, halfLifeDays) {
  if (!Number.isFinite(ageDays) || !Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 0;
  return Math.pow(2, -ageDays / halfLifeDays);
}

/* Bounded noisy-OR combination for same-sign contributions in [0,1]:
   combinePositive([0.4, 0.5]) = 1 - (1-0.4)(1-0.5) = 0.7
   This is a pragmatic saturating-aggregation prior (a second adverse
   contribution can only add to, never subtract from, the combined
   effect, and the result never exceeds 1) — it is not a formula drawn
   from the cited literature; it exists so multiple simultaneous shocks
   accumulate in a bounded way instead of via Math.max (which discards
   everything but the single largest contribution) or naive summation
   (which is unbounded). */
export function combinePositive(values) {
  let product = 1;
  for (const v of values) product *= (1 - clamp(v, 0, 1));
  return clamp(1 - product, 0, 1);
}

/* Combine a set of signed contributions in [-1,1] (positive = adverse,
   negative = mitigating) into one net signed effect in [-1,1]: positive
   and negative magnitudes are each noisy-OR-combined separately, then
   netted and clamped. */
export function combineSigned(values) {
  const pos = [], neg = [];
  for (const v of values) {
    if (v > 0) pos.push(v);
    else if (v < 0) neg.push(-v);
  }
  const combinedPos = combinePositive(pos);
  const combinedNeg = combinePositive(neg);
  return clampSigned(combinedPos - combinedNeg);
}

/* Standard Herfindahl-Hirschman Index, extended to explicitly account for
   an unmodeled residual ("Other") when shares sum to less than 1 — the
   original engine silently ignored this residual, which understates
   concentration whenever the sample shares don't sum to 1.
     shares {a:0.5, b:0.25} -> residual Other=0.25 -> HHI = 0.5^2+0.25^2+0.25^2 = 0.375
   Returns both the raw HHI in [0,1] and a 0-10 concentration score
   (10 * HHI), plus the residual actually used and a diagnostic if the
   input shares summed to materially more than 1 (an over-allocated
   input vector, which this function tolerates by normalizing for the
   computation but flags rather than silently accepting). */
export function hhiWithResidual(shares, tolerance = 1e-6) {
  const values = Object.values(shares).filter((v) => Number.isFinite(v) && v > 0);
  const sum = values.reduce((a, v) => a + v, 0);
  let normalized = values;
  let overAllocated = false;
  if (sum > 1 + tolerance) {
    overAllocated = true;
    normalized = values.map((v) => v / sum);
  }
  const normSum = normalized.reduce((a, v) => a + v, 0);
  const residual = Math.max(0, 1 - normSum);
  const hhi = normalized.reduce((a, v) => a + v * v, 0) + residual * residual;
  return { hhi, score10: clamp10(10 * hhi), residual, overAllocated };
}

/* Kahn's-algorithm topological sort over a directed graph given as
   adjacency lists (OUT[node] = [downstream neighbors]). Returns
   { order, hasCycle } — hasCycle is true iff not all nodes were
   reachable in the sort (a cycle or a dangling reference exists). */
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

/* log1p-based normalized weighting used for "modeled turnover proxy"
   weighting (network-influence, chain index) — compresses skewed stage
   economic values into a comparable 0-1 range without a hand-picked max. */
export function log1pNormalized(values) {
  const logs = values.map(([id, v]) => [id, Math.log1p(Math.max(0, v))]);
  const maxLog = Math.max(...logs.map(([, v]) => v), 1e-9);
  return Object.fromEntries(logs.map(([id, v]) => [id, v / maxLog]));
}

export function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
