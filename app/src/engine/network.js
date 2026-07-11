/* ====================================================================
   engine/network.js — the frontend-derived MULTILAYER supply-chain graph
   (spec Phase 1 / §4–§7). Everything here is derived deterministically
   from the existing static snapshot + the existing propagation priors —
   no facility locations, shipment routes, trade volumes, BOM coefficients,
   or relationships are invented, and the snapshot is never mutated.

   Layers:
     - countries          (snapshot countries)
     - functional centres (country × stage, only where the country already
                           participates in that stage in the snapshot)
     - stages             (snapshot industry stages)
     - companies          (attached to the centres their HQ + stake imply)

   A functional-centre connection is derived ONLY from an existing directed
   stage edge a→b plus the two endpoints' existing country-stage shares:

     W(i,a → b,j) = share(i,a) × D[b][a] × share(j,b)

   i.e. "modeled stage-mediated connection weight" — NOT a bilateral trade
   volume, shipment value, measured input-output dependence, probability,
   or causal effect. rawDisplayWeight is preserved; normalizedDisplayWeight
   is a display-only rescaling and never overwrites the raw value.

   The returned base graph is deep-frozen so downstream playground state can
   derive views from it without ever mutating the immutable baseline (§7).
   ==================================================================== */

/* Resolve a stage's tier from the snapshot's tierLabels (x-position bands).
   Falls back to the stage's own x when tierLabels are absent (unit fixtures)
   so this stays pure and testable without inventing a tier taxonomy. */
export function tierResolver(TIER_LABELS) {
  const labels = Array.isArray(TIER_LABELS) ? TIER_LABELS : [];
  return function tierOf(stage) {
    const x = stage?.x;
    let bestIdx = -1;
    for (let k = 0; k < labels.length; k++) {
      if (labels[k][1] === x) { bestIdx = k; break; }
    }
    if (bestIdx >= 0) return { tierId: bestIdx, tierLabel: labels[bestIdx][0] };
    // Fallback: order-preserving tier keyed on x (fixtures have no labels).
    return { tierId: x ?? 0, tierLabel: `Tier ${x ?? 0}` };
  };
}

const freeze = Object.freeze;

/* Build every functional supply centre (country × stage) that the snapshot
   actually supports. countryShare is the existing snapshot share; the
   structural / network-influence scores are the stage's existing engine
   scores (a centre inherits its stage's structural profile). Operational
   impact and scenario Δ are model-dependent and computed separately against
   a chosen model (see deriveCentreMetrics), never baked into the base. */
export function buildFunctionalCentres({ data, engine }) {
  const { STAGES, TIER_LABELS } = data;
  const { STRUCTURAL_VULNERABILITY, NETWORK_INFLUENCE, STAGE_COMPANIES, COMPANY_BY_ID } = engine;
  const tierOf = tierResolver(TIER_LABELS);

  const centres = [];
  const centreById = {};
  const centresByCountry = {};
  const centresByStage = {};

  STAGES.forEach((stage) => {
    const shares = stage.shares || {};
    const { tierId, tierLabel } = tierOf(stage);
    Object.keys(shares).sort().forEach((countryId) => {
      const share = shares[countryId];
      if (!(share > 0)) return;
      const companies = (STAGE_COMPANIES[stage.id] || [])
        .filter(([cid]) => COMPANY_BY_ID[cid]?.country === countryId)
        .map(([cid, stake]) => freeze({ id: cid, name: COMPANY_BY_ID[cid].name, stake }));
      const centre = freeze({
        id: `${countryId}::${stage.id}`,
        countryId,
        stageId: stage.id,
        tierId,
        tierLabel,
        countryShare: share,
        structuralScore: STRUCTURAL_VULNERABILITY[stage.id] ?? 0,
        networkInfluence: NETWORK_INFLUENCE[stage.id] ?? 0,
        companies: freeze(companies),
      });
      centres.push(centre);
      centreById[centre.id] = centre;
      (centresByCountry[countryId] ||= []).push(centre);
      (centresByStage[stage.id] ||= []).push(centre);
    });
  });

  return { centres, centreById, centresByCountry, centresByStage };
}

/* Derive every valid functional-centre connection from the existing stage
   edges + country-stage shares. Returns ALL valid edges (the immutable base
   set); display top-N / threshold filtering happens later (§30) so the base
   graph is never a lossy artifact. */
export function buildCentreConnections({ data, engine, centreById }) {
  const { FLOW_EDGES } = data;
  const { D, STAGE_BY_ID } = engine;
  const edges = [];

  FLOW_EDGES.forEach(([a, b]) => {
    const coeff = D[b]?.[a] ?? 0;
    if (!(coeff > 0)) return; // no modeled stage-edge prior → no derived connection
    const srcShares = STAGE_BY_ID[a]?.shares || {};
    const dstShares = STAGE_BY_ID[b]?.shares || {};
    Object.keys(srcShares).sort().forEach((i) => {
      const si = srcShares[i];
      if (!(si > 0)) return;
      const sourceId = `${i}::${a}`;
      if (!centreById[sourceId]) return;
      Object.keys(dstShares).sort().forEach((j) => {
        const sj = dstShares[j];
        if (!(sj > 0)) return;
        const targetId = `${j}::${b}`;
        if (!centreById[targetId]) return;
        // W(i,a → b,j) = share(i,a) × D[b][a] × share(j,b)
        const rawDisplayWeight = si * coeff * sj;
        edges.push({
          id: `${sourceId}->${targetId}`,
          sourceId,
          targetId,
          sourceCountry: i,
          sourceStage: a,
          targetCountry: j,
          targetStage: b,
          stageEdgePrior: coeff,
          sourceShare: si,
          targetShare: sj,
          rawDisplayWeight,
        });
      });
    });
  });

  const maxRaw = edges.reduce((m, e) => Math.max(m, e.rawDisplayWeight), 1e-12);
  edges.forEach((e) => { e.normalizedDisplayWeight = e.rawDisplayWeight / maxRaw; });

  return edges.map((e) => freeze(e));
}

/* Compose the immutable base multilayer graph (§7). Deep-frozen: playground
   state derives views/metrics from this without ever mutating it. */
export function buildBaseGraph({ data, engine }) {
  const { centres, centreById, centresByCountry, centresByStage } = buildFunctionalCentres({ data, engine });
  const centreEdges = buildCentreConnections({ data, engine, centreById });

  // Directed adjacency over centre ids (both orientations, for reachability
  // / pathfinding without recomputing from the edge list each time).
  const outAdj = {};
  const inAdj = {};
  centres.forEach((c) => { outAdj[c.id] = []; inAdj[c.id] = []; });
  centreEdges.forEach((e) => {
    (outAdj[e.sourceId] ||= []).push(e.id);
    (inAdj[e.targetId] ||= []).push(e.id);
  });

  return freeze({
    countries: freeze(data.COUNTRY_NAMES ? Object.keys(data.COUNTRY_NAMES) : []),
    stageIds: freeze((data.STAGES || []).map((s) => s.id)),
    tiers: freeze(Array.isArray(data.TIER_LABELS) ? data.TIER_LABELS.map(([label], i) => ({ tierId: i, tierLabel: label })) : []),
    centres: freeze(centres),
    centreById: freeze(centreById),
    centresByCountry: freeze(centresByCountry),
    centresByStage: freeze(centresByStage),
    centreEdges,
    edgeById: freeze(Object.fromEntries(centreEdges.map((e) => [e.id, e]))),
    outAdj: freeze(outAdj),
    inAdj: freeze(inAdj),
  });
}
