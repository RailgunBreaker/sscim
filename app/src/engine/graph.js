/* ====================================================================
   graph.js — directional dependence matrices and all-paths propagation.

   Replaces the old two-hop-downstream/one-hop-upstream "propagate()"
   with propagation over every reachable path in the DAG, using two
   distinct, explicitly-labeled dependence proxies (see MISSION spec /
   README "Model status and limitations"):

     D[b][a] — downstream INPUT-DEPENDENCE proxy: how much buyer stage b
               depends on supplier stage a for input, given b's in-degree
               and a's substitutability-derived specificity. This is a
               transparent equal-allocation prior, NOT a measured input-
               output coefficient (no BOM/facility data exists yet).

     U[a][b] — upstream SUPPLIER-REVENUE-DEPENDENCE proxy: the demand-side
               echo felt by supplier a when buyer b is disrupted, given
               a's out-degree. Also a prior, not a measured trade flow.

   Neither matrix is a measured trade/input coefficient — both are
   declared, transparent priors built only from graph structure (in/out
   degree) and the one analyst-judgment input the dataset already has
   (stage substitutability). See MODEL_ROADMAP.md for what real data
   would need to replace these.
   ==================================================================== */
import { clamp, combineSigned, topologicalSort } from './math.js';

export function buildAdjacency(stageIds, edges) {
  const OUT = {}, IN = {};
  stageIds.forEach((id) => { OUT[id] = []; IN[id] = []; });
  edges.forEach(([a, b]) => {
    if (!(a in OUT) || !(b in OUT)) return; // invalid edges are reported by diagnostics.validateGraph, not silently traversed
    OUT[a].push(b);
    IN[b].push(a);
  });
  return { OUT, IN };
}

/* Builds the two directional dependence-proxy matrices described above.
   `getSubstitutability(stageId)` returns the stage's 0-10 substitutability
   score (higher = more substitutable / less specific). */
export function buildDependenceMatrices(stageIds, OUT, IN, getSubstitutability, priors) {
  const D = {}, U = {};
  stageIds.forEach((id) => { D[id] = {}; U[id] = {}; });

  // NOTE ON NAMING: the dataset's stage field is called "subst" ("substitutability
  // risk") but, by this dataset's own convention (see original WEIGHTS/risk-score
  // usage), a HIGH value means the stage is HARD to substitute — i.e. high
  // specificity/criticality, not high substitutability. specificity(a) below
  // uses the score directly, matching that existing convention: higher score
  // -> higher specificity -> stronger downstream transmission.
  const specificity = {};
  stageIds.forEach((a) => {
    const subst = getSubstitutability(a) ?? 0;
    specificity[a] = clamp(subst / 10, 0, 1);
  });

  stageIds.forEach((a) => {
    const outdeg = OUT[a].length;
    OUT[a].forEach((b) => {
      const indeg = IN[b].length || 1;
      const baseInputShare = 1 / indeg;
      D[b][a] = priors.downstreamTransmission * baseInputShare
        * (priors.specificityFloor + (1 - priors.specificityFloor) * specificity[a]);
      U[a][b] = outdeg ? priors.upstreamTransmission / outdeg : 0;
    });
  });
  return { D, U };
}

/* Propagates a single signed shock (positive=adverse, negative=mitigating)
   originating at `sourceId` across every reachable path in the DAG —
   downstream via D (topological order), upstream via U (reverse
   topological order), each hop combined with same-node contributions via
   combineSigned (bounded noisy-OR), truncated once a contribution's
   magnitude falls below `tolerance`. Returns a plain object mapping every
   stage id to its signed contribution (0 for unreached stages).

   Optional TRACE MODE (`trace: true`) additionally returns a hop-by-hop
   decomposition for playback. It is a PURE DECOMPOSITION: the returned
   `field` is byte-identical to the untraced result — the trace never
   re-derives it. Each node is placed on the step at which its final value
   becomes fully determined (its "settle hop" = 1 + the longest
   contributing path from the source), so a node's value never changes once
   revealed and the cumulative field at the final step equals `field`
   exactly. Returns { field, trace: [{ step, nodes, edges,
   incrementalContribution, cumulativeContribution }] }. */
export function propagateFromSource({ sourceId, magnitude, channel, stageIds, OUT, IN, TOPO, REV_TOPO, D, U, tolerance, trace = false }) {
  const field = Object.fromEntries(stageIds.map((id) => [id, 0]));
  if (!Number.isFinite(magnitude) || magnitude === 0) return trace ? { field, trace: [] } : field;

  const downstream = channel === 'downstream' || channel === 'both';
  const upstream = channel === 'upstream' || channel === 'both';

  // Per-channel settle-hop and contributing-edge bookkeeping are only
  // populated in trace mode; they never influence the field values.
  const dHop = {}, uHop = {}, dEdges = {}, uEdges = {};

  const dField = {};
  if (downstream) {
    dField[sourceId] = magnitude; dHop[sourceId] = 0;
    for (const n of TOPO) {
      if (n === sourceId) continue;
      const contributions = [];
      let hop = 0; const used = trace ? [] : null;
      for (const p of IN[n] || []) {
        const pv = dField[p];
        const coeff = D[n]?.[p];
        if (pv && coeff) {
          contributions.push(pv * coeff);
          if (trace) { hop = Math.max(hop, dHop[p]); used.push({ from: p, to: n, dir: 'downstream' }); }
        }
      }
      if (contributions.length) {
        const combined = combineSigned(contributions);
        if (Math.abs(combined) >= tolerance) {
          dField[n] = combined;
          if (trace) { dHop[n] = hop + 1; dEdges[n] = used; }
        }
      }
    }
  }

  const uField = {};
  if (upstream) {
    uField[sourceId] = magnitude; uHop[sourceId] = 0;
    for (const n of REV_TOPO) {
      if (n === sourceId) continue;
      const contributions = [];
      let hop = 0; const used = trace ? [] : null;
      for (const s of OUT[n] || []) {
        const sv = uField[s];
        const coeff = U[n]?.[s];
        if (sv && coeff) {
          contributions.push(sv * coeff);
          if (trace) { hop = Math.max(hop, uHop[s]); used.push({ from: n, to: s, dir: 'upstream' }); }
        }
      }
      if (contributions.length) {
        const combined = combineSigned(contributions);
        if (Math.abs(combined) >= tolerance) {
          uField[n] = combined;
          if (trace) { uHop[n] = hop + 1; uEdges[n] = used; }
        }
      }
    }
  }

  const settleHop = trace ? {} : null;
  stageIds.forEach((id) => {
    if (id === sourceId) { field[id] = magnitude; if (trace) settleHop[id] = 0; return; }
    const vals = [];
    if (dField[id]) vals.push(dField[id]);
    if (uField[id]) vals.push(uField[id]);
    if (vals.length) {
      field[id] = combineSigned(vals);
      if (trace) {
        let h = 0;
        if (dField[id]) h = Math.max(h, dHop[id]);
        if (uField[id]) h = Math.max(h, uHop[id]);
        settleHop[id] = h;
      }
    }
  });

  if (!trace) return field;

  const reached = stageIds.filter((id) => settleHop[id] !== undefined);
  const maxHop = reached.reduce((m, id) => Math.max(m, settleHop[id]), 0);
  const traceSteps = [];
  const cumulative = {};
  for (let k = 0; k <= maxHop; k++) {
    const nodesAtK = reached.filter((id) => settleHop[id] === k);
    const incremental = {};
    const edges = [];
    nodesAtK.forEach((id) => {
      incremental[id] = field[id];
      cumulative[id] = field[id];
      if (dEdges[id]) edges.push(...dEdges[id]);
      if (uEdges[id]) edges.push(...uEdges[id]);
    });
    traceSteps.push({
      step: k,
      nodes: nodesAtK,
      edges,
      incrementalContribution: incremental,
      cumulativeContribution: { ...cumulative },
    });
  }
  return { field, trace: traceSteps };
}

/* Enumerates the strongest modeled propagation paths between two stages,
   for the "explain path" view (task §11). A path's strength is the product
   of its per-edge dependence coefficients (multiplicative attenuation along
   the chain) — the same transparent priors the propagation uses, NOT a
   measured route. Tries the downstream direction first (source supplies →
   … → target, coefficient D[b][a] per a→b edge); if the two aren't
   connected that way, tries the upstream echo (source ← … ← target,
   coefficient U[p][n] per p→n edge). Returns up to `k` paths, strongest
   first, each: { nodes:[ids], edges:[{from,to,dir,coeff}], attenuation,
   channel }. Empty array if unreachable in either direction. */
export function findTopPaths({ sourceId, targetId, OUT, IN, D, U, k = 3, maxDepth = 9 }) {
  if (!sourceId || !targetId || sourceId === targetId) return [];

  function enumerate(nextMap, coeffFn, orient, channel) {
    const out = [];
    const dfs = (node, visited, nodes, edges, strength, depth) => {
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

  // Downstream: traverse OUT; graph edge is (node -> nxt), influence coeff D[nxt][node].
  let paths = enumerate(OUT, (a, b) => D[b]?.[a], (a, b) => ({ from: a, to: b, dir: 'downstream' }), 'downstream');
  // Upstream echo: traverse IN; graph edge is (nxt -> node), influence coeff U[nxt][node].
  if (!paths.length) {
    paths = enumerate(IN, (n, p) => U[p]?.[n], (n, p) => ({ from: p, to: n, dir: 'upstream' }), 'upstream');
  }
  return paths.sort((a, b) => b.attenuation - a.attenuation).slice(0, k);
}

export { topologicalSort };
