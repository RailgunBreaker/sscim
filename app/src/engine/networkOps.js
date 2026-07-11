/* ====================================================================
   engine/networkOps.js — pure, renderer-agnostic operations over the
   immutable base multilayer graph (engine/network.js). These are the
   analytical primitives the playground UI derives its views from
   (spec Phase 2 neighborhood/expansion/filters + Phase 5 degree/
   reachability). None mutate the base graph or the snapshot; each returns
   a fresh derived view or plain result, so hypothetical playground actions
   (node/edge removal) are fully reversible by simply re-deriving.
   ==================================================================== */

function groupBy(items, key) {
  const out = {};
  items.forEach((it) => { (out[it[key]] ||= []).push(it); });
  return out;
}

/* Apply the playground's temporary removals (§26) to the frozen base graph,
   returning a derived analysis graph that excludes removed centres, removed
   edges, and any edge touching a removed centre. The base graph is never
   modified — Reset is just "derive with no removals". */
export function deriveAnalysisGraph(baseGraph, { removedNodeIds = [], removedEdgeIds = [] } = {}) {
  const removedNodes = new Set(removedNodeIds);
  const removedEdges = new Set(removedEdgeIds);

  const centres = baseGraph.centres.filter((c) => !removedNodes.has(c.id));
  const centreById = Object.fromEntries(centres.map((c) => [c.id, c]));
  const centreEdges = baseGraph.centreEdges.filter(
    (e) => !removedEdges.has(e.id) && !removedNodes.has(e.sourceId) && !removedNodes.has(e.targetId)
  );
  const edgeById = Object.fromEntries(centreEdges.map((e) => [e.id, e]));

  const outAdj = {};
  const inAdj = {};
  centres.forEach((c) => { outAdj[c.id] = []; inAdj[c.id] = []; });
  centreEdges.forEach((e) => { outAdj[e.sourceId].push(e.id); inAdj[e.targetId].push(e.id); });

  return {
    centres, centreById, centreEdges, edgeById, outAdj, inAdj,
    centresByCountry: groupBy(centres, 'countryId'),
    centresByStage: groupBy(centres, 'stageId'),
    removedNodeIds: [...removedNodes],
    removedEdgeIds: [...removedEdges],
    isDerived: true,
  };
}

/* Bounded neighborhood around a centre (§11/§15): expand `hops` graph
   transitions upstream, downstream, or both. Returns id sets for the nodes
   and edges to reveal — graph transitions, NOT time steps. */
export function neighborhood(graph, centreId, { direction = 'both', hops = 1 } = {}) {
  const nodeIds = new Set([centreId]);
  const edgeIds = new Set();
  if (!graph.centreById[centreId]) return { nodeIds, edgeIds };
  const wantDown = direction === 'downstream' || direction === 'both';
  const wantUp = direction === 'upstream' || direction === 'both';

  let frontier = [centreId];
  for (let h = 0; h < Math.max(0, hops); h++) {
    const next = [];
    frontier.forEach((id) => {
      if (wantDown) (graph.outAdj[id] || []).forEach((eid) => {
        const e = graph.edgeById[eid];
        edgeIds.add(eid);
        if (!nodeIds.has(e.targetId)) { nodeIds.add(e.targetId); next.push(e.targetId); }
      });
      if (wantUp) (graph.inAdj[id] || []).forEach((eid) => {
        const e = graph.edgeById[eid];
        edgeIds.add(eid);
        if (!nodeIds.has(e.sourceId)) { nodeIds.add(e.sourceId); next.push(e.sourceId); }
      });
    });
    frontier = next;
  }
  return { nodeIds, edgeIds };
}

/* All centres reachable from `centreId` in one direction (any number of
   hops). The centre graph is a DAG (edges follow the stage DAG), but the
   seen-set makes this safe regardless. Excludes the origin itself. */
export function reachableSet(graph, centreId, direction = 'downstream') {
  const seen = new Set([centreId]);
  const stack = [centreId];
  const upstream = direction === 'upstream';
  while (stack.length) {
    const id = stack.pop();
    const adj = upstream ? graph.inAdj[id] : graph.outAdj[id];
    (adj || []).forEach((eid) => {
      const e = graph.edgeById[eid];
      const nxt = upstream ? e.sourceId : e.targetId;
      if (!seen.has(nxt)) { seen.add(nxt); stack.push(nxt); }
    });
  }
  seen.delete(centreId);
  return seen;
}

/* Weighted degree (§21.1/2): sum of modeled connection weight entering
   (upstream) and/or leaving (downstream) a centre. Weights are the raw
   modeled stage-mediated connection weights — not trade volumes. */
export function weightedDegree(graph, centreId, direction = 'both') {
  let sum = 0;
  if (direction === 'downstream' || direction === 'both') (graph.outAdj[centreId] || []).forEach((eid) => { sum += graph.edgeById[eid].rawDisplayWeight; });
  if (direction === 'upstream' || direction === 'both') (graph.inAdj[centreId] || []).forEach((eid) => { sum += graph.edgeById[eid].rawDisplayWeight; });
  return sum;
}

/* Reachability summary for a centre detail panel (§11/§21.3): upstream and
   downstream reach, plus the distinct stages / countries those reachable
   centres span. Direction-separated. */
export function reachabilitySummary(graph, centreId) {
  const up = reachableSet(graph, centreId, 'upstream');
  const down = reachableSet(graph, centreId, 'downstream');
  const stagesOf = (set) => new Set([...set].map((id) => graph.centreById[id]?.stageId).filter(Boolean));
  const countriesOf = (set) => new Set([...set].map((id) => graph.centreById[id]?.countryId).filter(Boolean));
  return {
    upstream: up,
    downstream: down,
    upstreamCount: up.size,
    downstreamCount: down.size,
    reachableStages: new Set([...stagesOf(up), ...stagesOf(down)]),
    reachableCountries: new Set([...countriesOf(up), ...countriesOf(down)]),
  };
}

/* Direct upstream / downstream neighbor centres of a node (one hop),
   strongest first — for the centre detail panel's neighbor lists. */
export function directNeighbors(graph, centreId, direction = 'both') {
  const edges = topConnectionsForNode(graph, centreId, { direction, topN: Infinity });
  return edges.map((e) => ({
    edge: e,
    neighborId: e.sourceId === centreId ? e.targetId : e.sourceId,
    dir: e.sourceId === centreId ? 'downstream' : 'upstream',
  }));
}

/* The strongest connections incident to a centre (§30 clutter control). */
export function topConnectionsForNode(graph, centreId, { direction = 'both', topN = 8 } = {}) {
  const ids = [];
  if (direction === 'downstream' || direction === 'both') ids.push(...(graph.outAdj[centreId] || []));
  if (direction === 'upstream' || direction === 'both') ids.push(...(graph.inAdj[centreId] || []));
  return ids
    .map((id) => graph.edgeById[id])
    .sort((a, b) => b.rawDisplayWeight - a.rawDisplayWeight)
    .slice(0, topN);
}

/* Global display filter (§30): top-N by weight + threshold + optional
   stage/country constraints. Never mutates its input. */
export function filterConnections(edges, { topN = null, minWeight = 0, stages = null, countries = null } = {}) {
  const out = edges.filter((e) => {
    if (e.rawDisplayWeight < minWeight) return false;
    if (stages && !(stages.includes(e.sourceStage) || stages.includes(e.targetStage))) return false;
    if (countries && !(countries.includes(e.sourceCountry) || countries.includes(e.targetCountry))) return false;
    return true;
  }).sort((a, b) => b.rawDisplayWeight - a.rawDisplayWeight);
  return typeof topN === 'number' ? out.slice(0, topN) : out;
}
