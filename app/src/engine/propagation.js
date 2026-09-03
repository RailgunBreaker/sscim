/* ====================================================================
   propagation.js — v7 JOINT INCIDENT PROPAGATION.

   WHAT CHANGED FROM v6, AND WHY IT MATTERED.

   v6 propagated each of an incident's tagged stages SEPARATELY, each
   carrying the incident's full severity, then combined the resulting
   per-stage fields with a noisy-OR. Two things went wrong with that:

     · An incident tagged to four stages injected four full-severity
       shocks, so the same earthquake hit harder the more thoroughly it
       was tagged. Tagging is metadata; it must not be a multiplier.
     · Within ONE incident, two paths that reconverge on a stage are the
       same disruption arriving twice, not two independent causes.
       Combining them with a noisy-OR treated them as independent and
       inflated the reconvergent node.

   v7 propagates the WHOLE source vector of one incident jointly, in one
   pass, so reconvergence is a plain sum of dependency-weighted inflows,
   clipped to the bound. Aggregation across DISTINCT incidents happens
   afterwards, in aggregation.js.

   DEPENDENCY MATRICES. For an edge a -> b:

     D[b][a] = f_d * q_ba * (phi + (1 - phi) * nu_a),   sum_{a in IN(b)} q_ba = 1
     U[a][b] = f_u * r_ab,                              sum_{b in OUT(a)} r_ab = 1

   where nu_a in [0,1] is stage a's non-substitutability and q, r are
   normalized edge allocations. Because the allocations sum to one at each
   node and the dependency factor is at most one:

     sum_{a in IN(b)} D[b][a] <= f_d < 1        and
     sum_{b in OUT(a)} U[a][b] <= f_u < 1

   which is what makes the propagation below a contraction — the field is
   finite, bounded and order-independent on any DAG, with no truncation
   tolerance needed. v6's `contributionTolerance` is therefore GONE from
   substantive calculation; a tiny epsilon survives only for display
   formatting.

   THE PROPAGATION. For a nonnegative source vector z of ONE incident:

     x^d_b = clip_[0,1]( z_b + sum_{a in IN(b)} D[b][a] * x^d_a )   topological order
     x^u_a = clip_[0,1]( z_a + sum_{b in OUT(a)} U[a][b] * x^u_b )   reverse topological order

     p_s   = clip_[-1,1]( z_s + (x^d_s - z_s) + (x^u_s - z_s) )

   The last line counts the direct source ONCE: both channels start from
   z, so adding them naively would double it at every directly sourced
   stage. Signed sources are split into a nonnegative adverse vector and a
   nonnegative mitigating vector, each propagated separately by the above,
   and then netted.

   WHAT THIS IS NOT. Not a probability, not a Leontief loss, not a
   measured input-output coefficient, not a forecast. It is a bounded
   dependency-sensitivity calculation over declared priors.
   ==================================================================== */
import { clamp, topologicalSort } from './math.js';

export function buildAdjacency(stageIds, edges) {
  const OUT = {}, IN = {};
  stageIds.forEach((id) => { OUT[id] = []; IN[id] = []; });
  (edges || []).forEach((edge) => {
    const [a, b] = edge;
    if (!(a in OUT) || !(b in OUT)) return; // invalid edges are reported by diagnostics.validateGraph, never silently traversed
    OUT[a].push(b);
    IN[b].push(a);
  });
  return { OUT, IN };
}

/* ---------------- normalized edge allocations ----------------
   OPTIONAL evidence-based fields. An edge may be given as
   [a, b] or [a, b, { inShare, outShare }] where

     inShare   b's share of its input dependence attributable to a  (q_ba)
     outShare  a's share of its output exposure attributable to b   (r_ab)

   Anything supplied is normalized per node so the constraint holds
   exactly. Where a node has NO supplied allocation, an equal split is
   used and the fallback is REPORTED rather than presented as evidence.
   The current snapshot supplies none, so every allocation in the shipped
   model is the equal-split fallback — which is precisely why it is
   counted in the audit instead of being invisible. */
export function buildEdgeAllocations(stageIds, OUT, IN, edges = []) {
  const supplied = { in: {}, out: {} };
  (edges || []).forEach((edge) => {
    const [a, b, meta] = edge;
    if (!meta || typeof meta !== 'object') return;
    if (Number.isFinite(meta.inShare) && meta.inShare >= 0) ((supplied.in[b] ||= {})[a] = meta.inShare);
    if (Number.isFinite(meta.outShare) && meta.outShare >= 0) ((supplied.out[a] ||= {})[b] = meta.outShare);
  });

  const q = {}; // q[b][a] — incoming allocation at b
  const r = {}; // r[a][b] — outgoing allocation at a
  const fallbacks = { incomingEqualSplit: [], outgoingEqualSplit: [], renormalized: [] };

  stageIds.forEach((b) => {
    q[b] = {};
    const ins = IN[b] || [];
    if (!ins.length) return;
    const given = supplied.in[b];
    const complete = given && ins.every((a) => Number.isFinite(given[a]));
    if (!complete) {
      if (given) fallbacks.incomingEqualSplit.push(`${b} (partial allocation supplied for ${Object.keys(given).length}/${ins.length} inbound edges — equal split used for all)`);
      else fallbacks.incomingEqualSplit.push(b);
      ins.forEach((a) => { q[b][a] = 1 / ins.length; });
      return;
    }
    const total = ins.reduce((s, a) => s + given[a], 0);
    if (!(total > 0)) { ins.forEach((a) => { q[b][a] = 1 / ins.length; }); fallbacks.incomingEqualSplit.push(`${b} (supplied allocations sum to zero)`); return; }
    if (Math.abs(total - 1) > 1e-9) fallbacks.renormalized.push(`incoming allocations at "${b}" summed to ${total.toFixed(6)} — renormalized to 1`);
    ins.forEach((a) => { q[b][a] = given[a] / total; });
  });

  stageIds.forEach((a) => {
    r[a] = {};
    const outs = OUT[a] || [];
    if (!outs.length) return;
    const given = supplied.out[a];
    const complete = given && outs.every((b) => Number.isFinite(given[b]));
    if (!complete) {
      if (given) fallbacks.outgoingEqualSplit.push(`${a} (partial allocation supplied for ${Object.keys(given).length}/${outs.length} outbound edges — equal split used for all)`);
      else fallbacks.outgoingEqualSplit.push(a);
      outs.forEach((b) => { r[a][b] = 1 / outs.length; });
      return;
    }
    const total = outs.reduce((s, b) => s + given[b], 0);
    if (!(total > 0)) { outs.forEach((b) => { r[a][b] = 1 / outs.length; }); fallbacks.outgoingEqualSplit.push(`${a} (supplied allocations sum to zero)`); return; }
    if (Math.abs(total - 1) > 1e-9) fallbacks.renormalized.push(`outgoing allocations at "${a}" summed to ${total.toFixed(6)} — renormalized to 1`);
    outs.forEach((b) => { r[a][b] = given[b] / total; });
  });

  return { q, r, fallbacks };
}

/* D and U from the allocations, the non-substitutability vector and the
   resolved v7 parameters. `nonSubstitutabilityOf(stageId)` returns the
   stage's 0-10 non-substitutability score (higher = harder to substitute
   = stronger downstream dependency). */
export function buildDependencyMatrices(stageIds, OUT, IN, nonSubstitutabilityOf, params, allocations) {
  const alloc = allocations || buildEdgeAllocations(stageIds, OUT, IN, []);
  const D = {}, U = {};
  stageIds.forEach((id) => { D[id] = {}; U[id] = {}; });

  const nu = {};
  stageIds.forEach((a) => { nu[a] = clamp((nonSubstitutabilityOf(a) ?? 0) / 10, 0, 1); });

  const phi = params.minimumDependencyFactor;
  stageIds.forEach((a) => {
    (OUT[a] || []).forEach((b) => {
      const qba = alloc.q[b]?.[a] ?? 0;
      const rab = alloc.r[a]?.[b] ?? 0;
      D[b][a] = params.downstreamTransmission * qba * (phi + (1 - phi) * nu[a]);
      U[a][b] = params.upstreamTransmission * rab;
    });
  });
  return { D, U, nu, allocations: alloc };
}

const zeroVector = (stageIds) => Object.fromEntries(stageIds.map((id) => [id, 0]));

/* One channel of the joint propagation over a NONNEGATIVE source vector.
   Returns the settled vector x and, in trace mode, the hop at which each
   node's value became fully determined plus the edges that contributed. */
function propagateChannel({ z, order, neighboursOf, coeffOf, stageIds, trace }) {
  const x = zeroVector(stageIds);
  const hop = {};
  const edgesInto = {};
  stageIds.forEach((id) => { if (z[id] > 0) hop[id] = 0; });

  for (const n of order) {
    let inflow = 0;
    let maxHop = -1;
    const used = trace ? [] : null;
    for (const m of neighboursOf(n)) {
      const xv = x[m];
      if (!xv) continue;
      const c = coeffOf(n, m);
      if (!c) continue;
      inflow += c * xv;
      if (trace) { maxHop = Math.max(maxHop, hop[m] ?? 0); used.push(m); }
    }
    const value = clamp((z[n] ?? 0) + inflow, 0, 1);
    x[n] = value;
    if (trace && value > 0) {
      if (z[n] > 0) hop[n] = 0;
      else if (maxHop >= 0) { hop[n] = maxHop + 1; edgesInto[n] = used; }
    }
  }
  return { x, hop, edgesInto };
}

/* Propagate ONE incident's nonnegative source vector `z` jointly.

   `channel` restricts which dependency channels apply: 'downstream',
   'upstream', or 'both'. Returns { p, xd, xu } where p is the combined
   field with the direct source counted once. */
export function propagateVector({ z, channel = 'both', stageIds, OUT, IN, TOPO, REV_TOPO, D, U, trace = false }) {
  const wantD = channel === 'downstream' || channel === 'both';
  const wantU = channel === 'upstream' || channel === 'both';
  const src = zeroVector(stageIds);
  let any = false;
  stageIds.forEach((id) => { const v = clamp(z?.[id] ?? 0, 0, 1); src[id] = v; if (v > 0) any = true; });

  if (!any) {
    const p = zeroVector(stageIds);
    return trace ? { p, xd: p, xu: p, hop: {}, edgesInto: {}, empty: true } : { p, xd: p, xu: p, empty: true };
  }

  const down = wantD
    ? propagateChannel({ z: src, order: TOPO, neighboursOf: (n) => IN[n] || [], coeffOf: (n, m) => D[n]?.[m] ?? 0, stageIds, trace })
    : { x: { ...src }, hop: {}, edgesInto: {} };
  const up = wantU
    ? propagateChannel({ z: src, order: REV_TOPO, neighboursOf: (n) => OUT[n] || [], coeffOf: (n, m) => U[n]?.[m] ?? 0, stageIds, trace })
    : { x: { ...src }, hop: {}, edgesInto: {} };

  const p = {};
  stageIds.forEach((id) => {
    const zs = src[id];
    // z + (x^d - z) + (x^u - z): the direct source is counted exactly once.
    p[id] = clamp(zs + (down.x[id] - zs) + (up.x[id] - zs), -1, 1);
  });

  if (!trace) return { p, xd: down.x, xu: up.x };

  const hop = {};
  const edgesInto = {};
  stageIds.forEach((id) => {
    if (!p[id]) return;
    const hs = [];
    if (wantD && down.hop[id] !== undefined) hs.push(down.hop[id]);
    if (wantU && up.hop[id] !== undefined) hs.push(up.hop[id]);
    if (!hs.length) return;
    // A node settles once EVERY contributing path has arrived: the longest.
    hop[id] = Math.max(...hs);
    const es = [];
    if (wantD && down.edgesInto[id]) down.edgesInto[id].forEach((m) => es.push({ from: m, to: id, dir: 'downstream' }));
    if (wantU && up.edgesInto[id]) up.edgesInto[id].forEach((m) => es.push({ from: id, to: m, dir: 'upstream' }));
    if (es.length) edgesInto[id] = es;
  });
  return { p, xd: down.x, xu: up.x, hop, edgesInto };
}

/* Split a SIGNED source vector, propagate each sign jointly, then net.

   Adverse and mitigating sources are separate physical claims — a recovery
   is not "less earthquake" — so they must not cancel before propagation,
   where a stage sourced by both would lose the smaller one entirely and
   propagate only the difference. */
export function propagateSignedVector({ z, channel = 'both', stageIds, OUT, IN, TOPO, REV_TOPO, D, U, trace = false }) {
  const adverse = {}, mitigating = {};
  stageIds.forEach((id) => {
    const v = clamp(z?.[id] ?? 0, -1, 1);
    adverse[id] = v > 0 ? v : 0;
    mitigating[id] = v < 0 ? -v : 0;
  });

  const a = propagateVector({ z: adverse, channel, stageIds, OUT, IN, TOPO, REV_TOPO, D, U, trace });
  const m = propagateVector({ z: mitigating, channel, stageIds, OUT, IN, TOPO, REV_TOPO, D, U, trace });

  const field = {};
  stageIds.forEach((id) => { field[id] = clamp((a.p[id] ?? 0) - (m.p[id] ?? 0), -1, 1); });

  if (!trace) return { field, adverse: a.p, mitigating: m.p };

  const hop = {};
  const edgesInto = {};
  stageIds.forEach((id) => {
    const hs = [];
    if (a.hop?.[id] !== undefined) hs.push(a.hop[id]);
    if (m.hop?.[id] !== undefined) hs.push(m.hop[id]);
    if (!hs.length || !field[id]) return;
    hop[id] = Math.max(...hs);
    const es = [...(a.edgesInto?.[id] || []), ...(m.edgesInto?.[id] || [])];
    if (es.length) edgesInto[id] = es;
  });
  return { field, adverse: a.p, mitigating: m.p, hop, edgesInto };
}

/* A hop-by-hop decomposition of one signed propagation, for the animated
   playback. PURE DECOMPOSITION: `field` is byte-identical to the untraced
   result and the trace never re-derives it. A node is revealed on the step
   at which its value is fully determined (its longest contributing path),
   so a revealed value never changes and the cumulative field at the final
   step equals `field` exactly. */
export function traceSignedVector(args) {
  const { field, adverse, mitigating, hop, edgesInto } = propagateSignedVector({ ...args, trace: true });
  const { stageIds } = args;
  const reached = stageIds.filter((id) => hop[id] !== undefined && field[id]);
  if (!reached.length) return { field, adverse, mitigating, trace: [] };

  const maxHop = reached.reduce((m, id) => Math.max(m, hop[id]), 0);
  const steps = [];
  const cumulative = {};
  const emittedEdge = new Set();
  for (let k = 0; k <= maxHop; k++) {
    const nodes = reached.filter((id) => hop[id] === k);
    const incremental = {};
    const edges = [];
    nodes.forEach((id) => {
      incremental[id] = field[id];
      cumulative[id] = field[id];
      (edgesInto[id] || []).forEach((e) => {
        const key = `${e.from}|${e.to}|${e.dir}`;
        if (emittedEdge.has(key)) return;
        emittedEdge.add(key);
        edges.push(e);
      });
    });
    steps.push({ step: k, nodes, edges, incrementalContribution: incremental, cumulativeContribution: { ...cumulative } });
  }
  return { field, adverse, mitigating, trace: steps };
}

/* Strongest modeled propagation routes between two stages, for the
   explain-path view. A route's strength is the product of its per-edge
   dependency coefficients — the same declared priors the propagation uses,
   NOT a measured shipment route. */
export function findTopPaths({ sourceId, targetId, OUT, IN, D, U, k = 3, maxDepth = 9, maxPaths = 4000 }) {
  if (!sourceId || !targetId || sourceId === targetId) return [];

  function enumerate(nextMap, coeffFn, orient, channel) {
    const out = [];
    const dfs = (node, visited, nodes, edges, strength, depth) => {
      if (out.length >= maxPaths) return; // guard against combinatorial blow-up on dense graphs
      if (node === targetId) { out.push({ nodes: [...nodes], edges: [...edges], attenuation: strength, channel }); return; }
      if (depth >= maxDepth) return;
      for (const nxt of nextMap[node] || []) {
        if (visited.has(nxt)) continue;
        const coeff = coeffFn(node, nxt);
        if (!coeff) continue;
        visited.add(nxt);
        dfs(nxt, visited, [...nodes, nxt], [...edges, { ...orient(node, nxt), coeff }], strength * coeff, depth + 1);
        visited.delete(nxt);
      }
    };
    dfs(sourceId, new Set([sourceId]), [sourceId], [], 1, 0);
    return out;
  }

  // Downstream: traverse OUT; the graph edge is (node -> nxt), coefficient D[nxt][node].
  let paths = enumerate(OUT, (a, b) => D[b]?.[a], (a, b) => ({ from: a, to: b, dir: 'downstream' }), 'downstream');
  // Upstream echo: traverse IN; the graph edge is (nxt -> node), coefficient U[nxt][node].
  if (!paths.length) {
    paths = enumerate(IN, (n, p) => U[p]?.[n], (n, p) => ({ from: p, to: n, dir: 'upstream' }), 'upstream');
  }
  return paths.sort((a, b) => b.attenuation - a.attenuation).slice(0, k);
}

export { topologicalSort };
