/* ====================================================================
   engine/networkAnalysis.js — deterministic network-analysis metrics over
   the functional-centre graph (spec §21/§22). Pure and renderer-agnostic;
   operates on a derived analysis graph ({ centreById, edgeById, outAdj,
   inAdj }) so it respects temporary removals.

   GUARDRAILS (§22): these are TOPOLOGY / graph-structure measures over
   modeled stage-mediated connectivity — NOT calibrated risk, economic-loss
   probability, disruption likelihood, or causal importance. Generic
   centrality here is deliberately kept SEPARATE from SSCIM's existing
   propagation-based "network influence" metric (which lives in the engine
   and is not replaced). Every metric ships with a plain-language question
   and an explicit limitation string (see METRICS below); nothing is folded
   into a hidden composite risk score.
   ==================================================================== */

import { reachableSet, weightedDegree } from './networkOps.js';

/* Metric descriptors carrying the §22 guardrail metadata the UI must show. */
export const METRICS = [
  { id: 'degree_out', label: 'Weighted out-degree', question: 'How broadly does this centre connect downstream?', weighted: true, limitation: 'Sum of modeled connection weights leaving the node — not shipment volume.' },
  { id: 'degree_in', label: 'Weighted in-degree', question: 'How much modeled dependency enters this centre?', weighted: true, limitation: 'Sum of modeled connection weights entering the node — not measured dependence.' },
  { id: 'reach_down', label: 'Downstream reachability', question: 'How many centres does this one reach downstream?', weighted: false, limitation: 'Count of reachable centres in the selected graph — a connectivity count, not exposure value.' },
  { id: 'reach_up', label: 'Upstream reachability', question: 'How many centres can reach this one?', weighted: false, limitation: 'Count of centres that reach this node — connectivity only.' },
  { id: 'betweenness', label: 'Betweenness centrality', question: 'How often does this centre lie on shortest modeled paths?', weighted: false, limitation: 'A topology measure of shortest-path bridging — NOT a prediction of economic loss or importance.' },
  { id: 'removal_impact', label: 'Node-removal impact', question: 'How much modeled reachability is lost if this centre is removed?', weighted: false, limitation: 'Hypothetical node-removal sensitivity over the graph — not a predicted shutdown outcome.' },
];

/* Brandes' algorithm — unweighted, directed shortest-path betweenness,
   normalized by (n-1)(n-2). Deterministic. */
export function betweenness(graph) {
  const nodes = Object.keys(graph.centreById);
  const CB = {};
  nodes.forEach((n) => { CB[n] = 0; });

  for (const s of nodes) {
    const stack = [];
    const P = {}; const sigma = {}; const dist = {};
    nodes.forEach((w) => { P[w] = []; sigma[w] = 0; dist[w] = -1; });
    sigma[s] = 1; dist[s] = 0;
    const queue = [s];
    let qi = 0;
    while (qi < queue.length) {
      const v = queue[qi++];
      stack.push(v);
      for (const eid of graph.outAdj[v] || []) {
        const w = graph.edgeById[eid].targetId;
        if (dist[w] < 0) { dist[w] = dist[v] + 1; queue.push(w); }
        if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); }
      }
    }
    const delta = {};
    nodes.forEach((w) => { delta[w] = 0; });
    while (stack.length) {
      const w = stack.pop();
      for (const v of P[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      if (w !== s) CB[w] += delta[w];
    }
  }

  const n = nodes.length;
  const norm = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1;
  const out = {};
  nodes.forEach((w) => { out[w] = CB[w] * norm; });
  return out;
}

/* Total downstream reachable pairs in a graph (Σ over nodes of |reach|). */
function totalReachablePairs(graph) {
  return Object.keys(graph.centreById).reduce((acc, id) => acc + reachableSet(graph, id, 'downstream').size, 0);
}

/* Hypothetical node-removal sensitivity (§21.6). Compares reachability
   before/after excluding the node — reported as a change, explicitly a
   modeled sensitivity, not a predicted outcome. `deriveFn` derives an
   analysis graph from a removals option so this stays engine-agnostic. */
export function nodeRemovalImpact(baseGraph, centreId, deriveFn) {
  const before = deriveFn(baseGraph, {});
  const after = deriveFn(baseGraph, { removedNodeIds: [centreId] });
  const pairsBefore = totalReachablePairs(before);
  const pairsAfter = totalReachablePairs(after);

  // Centres that had any connection before but are fully isolated after.
  const isolatedAfter = [];
  Object.keys(after.centreById).forEach((id) => {
    const degBefore = (before.outAdj[id]?.length || 0) + (before.inAdj[id]?.length || 0);
    const degAfter = (after.outAdj[id]?.length || 0) + (after.inAdj[id]?.length || 0);
    if (degBefore > 0 && degAfter === 0) isolatedAfter.push(id);
  });

  return {
    removed: centreId,
    reachablePairsBefore: pairsBefore,
    reachablePairsAfter: pairsAfter,
    lostReachablePairs: pairsBefore - pairsAfter,
    directDownstream: reachableSet(before, centreId, 'downstream').size,
    directUpstream: reachableSet(before, centreId, 'upstream').size,
    newlyIsolated: isolatedAfter,
  };
}

/* Edge criticality (§21.7): reachability lost and whether the connection's
   own endpoints still connect via an alternative modeled path. */
export function edgeCriticalityImpact(baseGraph, edgeId, deriveFn) {
  const before = deriveFn(baseGraph, {});
  const edge = before.edgeById[edgeId];
  if (!edge) return null;
  const after = deriveFn(baseGraph, { removedEdgeIds: [edgeId] });
  const pairsBefore = totalReachablePairs(before);
  const pairsAfter = totalReachablePairs(after);
  const alternativeExists = reachableSet(after, edge.sourceId, 'downstream').has(edge.targetId);

  return {
    edgeId,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    reachablePairsBefore: pairsBefore,
    reachablePairsAfter: pairsAfter,
    lostReachablePairs: pairsBefore - pairsAfter,
    alternativeExists,
  };
}

/* Compute a per-centre value for a chosen metric — for node encoding +
   ranking. `precomputed` may carry a betweenness map to avoid recompute. */
export function metricValues(graph, metricId, precomputed = {}) {
  const ids = Object.keys(graph.centreById);
  const out = {};
  if (metricId === 'betweenness') {
    return precomputed.betweenness || betweenness(graph);
  }
  ids.forEach((id) => {
    switch (metricId) {
      case 'degree_out': out[id] = weightedDegree(graph, id, 'downstream'); break;
      case 'degree_in': out[id] = weightedDegree(graph, id, 'upstream'); break;
      case 'reach_down': out[id] = reachableSet(graph, id, 'downstream').size; break;
      case 'reach_up': out[id] = reachableSet(graph, id, 'upstream').size; break;
      default: out[id] = 0;
    }
  });
  return out;
}

/* Rank centres by a metric value map, strongest first (deterministic). */
export function rankByMetric(values) {
  return Object.entries(values)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => (b.value - a.value) || a.id.localeCompare(b.id));
}
