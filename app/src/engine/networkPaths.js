/* ====================================================================
   engine/networkPaths.js — deterministic multi-centre pathfinding over the
   functional-centre network (spec §16/§17). Operates on a derived analysis
   graph ({ centreById, edgeById, outAdj }) so it automatically respects any
   temporary node/edge removals. Every route is a chain of existing
   functional centres joined by existing stage-mediated connections — a
   MODELED propagation route, never a verified physical shipment.

   The centre graph is a DAG (its edges follow the industry-stage DAG), so
   bounded depth-first enumeration terminates; a hard cap guards against
   combinatorial blow-up. Routes are then ranked by the chosen objective
   with fully deterministic tie-breaking.

   Each route edge carries rawDisplayWeight (the modeled stage-mediated
   connection weight = share × stage-edge prior × share). A route's:
     - weightProduct  = Π edge weights   (multiplicative attenuation)
     - weightSum      = Σ edge weights   (cumulative modeled weight)
     - bottleneck     = min edge weight  (widest-path strength)
     - hops           = number of stage transitions
   ==================================================================== */

export const ROUTE_OBJECTIVES = [
  { id: 'strongest', label: 'Strongest modeled connection', hint: 'Maximise the product of edge weights (least attenuation).' },
  { id: 'max_bottleneck', label: 'Maximum bottleneck strength', hint: 'Maximise the weakest edge on the route (widest path).' },
  { id: 'fewest_hops', label: 'Fewest stage transitions', hint: 'Shortest route by graph hops; ties broken by strength.' },
  { id: 'max_cumulative', label: 'Maximum cumulative weight', hint: 'Maximise the sum of edge weights along the route.' },
];

/* Enumerate every source→target route (downstream over outAdj), honoring
   avoided nodes/edges. Bounded by maxDepth and maxPaths. */
export function enumerateCentreRoutes(graph, sourceId, targetId, { maxDepth = 10, maxPaths = 20000, avoidNodes, avoidEdges } = {}) {
  if (!graph.centreById[sourceId] || !graph.centreById[targetId] || sourceId === targetId) return [];
  const avoidN = new Set(avoidNodes || []);
  const avoidE = new Set(avoidEdges || []);
  if (avoidN.has(sourceId) || avoidN.has(targetId)) return [];

  const routes = [];
  const dfs = (node, visited, centres, edges, product, sum, bottleneck, depth) => {
    if (routes.length >= maxPaths) return;
    if (node === targetId) {
      routes.push({ centres: [...centres], edges: [...edges], hops: edges.length, weightProduct: product, weightSum: sum, bottleneck });
      return;
    }
    if (depth >= maxDepth) return;
    for (const eid of graph.outAdj[node] || []) {
      if (avoidE.has(eid)) continue;
      const e = graph.edgeById[eid];
      const nxt = e.targetId;
      if (avoidN.has(nxt) || visited.has(nxt)) continue;
      visited.add(nxt);
      dfs(nxt, visited, [...centres, nxt], [...edges, e], product * e.rawDisplayWeight, sum + e.rawDisplayWeight, Math.min(bottleneck, e.rawDisplayWeight), depth + 1);
      visited.delete(nxt);
    }
  };
  dfs(sourceId, new Set([sourceId]), [sourceId], [], 1, 0, Infinity, 0);
  return routes;
}

const SCORERS = {
  strongest: (r) => r.weightProduct,
  max_cumulative: (r) => r.weightSum,
  max_bottleneck: (r) => r.bottleneck,
  fewest_hops: (r) => -r.hops,
};

/* Resolve which centre ids to avoid from higher-level avoidance options
   (avoid a whole country / stage / company). */
function avoidSetFrom(graph, { avoidNodes = [], avoidCountry, avoidStage, avoidCompany } = {}) {
  const set = new Set(avoidNodes);
  Object.values(graph.centreById).forEach((c) => {
    if (avoidCountry && c.countryId === avoidCountry) set.add(c.id);
    if (avoidStage && c.stageId === avoidStage) set.add(c.id);
    if (avoidCompany && (c.companies || []).some((co) => co.id === avoidCompany)) set.add(c.id);
  });
  return [...set];
}

/* Top-K distinct routes for an objective, deterministically ordered. */
export function findCentreRoutes(graph, sourceId, targetId, { objective = 'strongest', k = 3, maxDepth, maxPaths, avoidEdges, ...avoidOpts } = {}) {
  const avoidNodes = avoidSetFrom(graph, avoidOpts);
  const all = enumerateCentreRoutes(graph, sourceId, targetId, { maxDepth, maxPaths, avoidNodes, avoidEdges });
  const score = SCORERS[objective] || SCORERS.strongest;

  all.sort((a, b) =>
    (score(b) - score(a))
    || (b.weightProduct - a.weightProduct)
    || (a.hops - b.hops)
    || a.centres.join('>').localeCompare(b.centres.join('>'))
  );

  const seen = new Set();
  const out = [];
  for (const r of all) {
    const key = r.centres.join('>');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, objective });
    if (out.length >= k) break;
  }
  return out;
}
