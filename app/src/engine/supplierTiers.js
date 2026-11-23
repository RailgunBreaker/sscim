import PUBLIC_SUPPLIER_TIERS from '../data/publicSupplierTiers.json';

/* ====================================================================
   supplierTiers — the public, document-cited supplier graph.

   WHAT THIS IS, AND WHY IT SITS BESIDE THE MODELED NETWORK RATHER THAN
   INSIDE IT.

   Everywhere else in SSCIM, a facility-to-facility link is *derived*:
   composed from a company-level supplier-revenue share and stage
   reachability, carrying a weight that is ultimately a declared prior.
   That is stated plainly throughout, and it is the right construction
   for a propagation model — but a reader is entitled to ask a different
   question: not "what does the model think flows here", but "who has
   anybody actually SAID supplies whom, in public, on the record".

   This dataset answers only that question. One rule governs it:

     EVERY EDGE CITES A PUBLIC DOCUMENT THAT NAMES BOTH PARTIES.

   No stage composition, no reachability, no share, no weight, no prior.
   An edge exists because Apple printed a supplier's name in its supplier
   list, because TSMC or Intel named an award-winning supplier, because a
   supplier announced its own customer's award, because a filing names a
   counterparty, because a teardown identified the silicon, or because a
   government rule named the affiliation. If no public document names the
   pair, there is no edge — and the resulting hole is the finding.

   CONSEQUENCES THE INTERFACE HAS TO CARRY, because each one is a way a
   reader could be misled:

   1. There are NO WEIGHTS. A named relationship is a named relationship.
      Nothing here says how much of anything moves, and the graph must
      never imply an ordering it does not have. The modeled network's
      strength ramp is deliberately absent.

   2. TIER IS DISTANCE, NOT RANK. Tier 2 does not mean "second most
      important supplier"; it means "two documented steps upstream of a
      focal buyer". A firm's tier changes if the focal set changes, which
      is why tier is DERIVED here and never stored in the data.

   3. ABSENCE IS NOT ABSENCE OF A RELATIONSHIP. It is absence of a public
      document naming the pair. Firms under export control are close to
      unobservable this way: Huawei's upstream is nearly empty here, and
      that emptiness is the most honest thing in the dataset.

   4. THE LISTS ARE SELECTIVE. Apple's covers 98% of direct spend by
      value and omits everything indirect. TSMC's and Intel's name award
      winners, which is a subset of their suppliers and not a census. A
      firm absent from a tier is not a firm absent from the chain.

   Pure functions over a frozen dataset: no React, no DOM, no vault.
   ==================================================================== */

export const EVIDENCE_CLASSES = {
  'P1-buyer': {
    label: 'Buyer named the supplier',
    short: 'buyer-named',
    detail: 'The buying company published its supplier’s name in its own document.',
    rank: 1,
    dash: null,
  },
  'P1-supplier': {
    label: 'Supplier named the buyer',
    short: 'supplier-named',
    detail: 'The supplying company published its customer’s name in its own document.',
    rank: 2,
    dash: null,
  },
  'P1-self': {
    label: 'Named in a filing',
    short: 'filed',
    detail: 'A company’s own securities filing names the counterparty.',
    rank: 3,
    dash: null,
  },
  'P2-institutional': {
    label: 'Found by teardown',
    short: 'teardown',
    detail:
      'A research house identified the pair by physical analysis. Neither party disclosed it — the only evidence left when a relationship is unspeakable for both sides.',
    rank: 4,
    dash: '7 4',
  },
  'P3-regulatory': {
    label: 'Established by a government document',
    short: 'regulatory',
    detail: 'A rule, listing or other government document establishes the relationship or affiliation.',
    rank: 5,
    dash: '2 3.5',
  },
};

const EVIDENCE_ORDER = Object.entries(EVIDENCE_CLASSES)
  .sort((a, b) => a[1].rank - b[1].rank)
  .map(([k]) => k);

/* The strongest class among an edge's documents. "Strongest" means
   closest to the parties themselves, not most prestigious: a supplier
   list beats a research note, because the firm put its own name to it. */
export function bestEvidence(sourceIds, sources) {
  const present = new Set((sourceIds || []).map((id) => sources[id]?.evidence).filter(Boolean));
  return EVIDENCE_ORDER.find((c) => present.has(c)) ?? 'P3-regulatory';
}

/* Chain groups. The dataset's 18 layers are too many to colour or filter
   legibly, so they roll up into seven positions a reader can hold in
   their head at once. The layer itself is still shown in words. */
export const CHAIN_GROUPS = [
  'Equipment & optics',
  'Wafers & masks',
  'Materials & metals',
  'Chips',
  'Packaging, boards & components',
  'Modules, assembly & brand',
  'Fab build & services',
];

const LAYER_GROUP = {
  equipment: 'Equipment & optics',
  optics_laser: 'Equipment & optics',
  wafers: 'Wafers & masks',
  photomask: 'Wafers & masks',
  materials: 'Materials & metals',
  metals: 'Materials & metals',
  foundry_idm: 'Chips',
  memory: 'Chips',
  ic_other: 'Chips',
  osat_test: 'Packaging, boards & components',
  substrates_pcb: 'Packaging, boards & components',
  passives: 'Packaging, boards & components',
  display_camera: 'Modules, assembly & brand',
  mechanical: 'Modules, assembly & brand',
  assembly: 'Modules, assembly & brand',
  brand: 'Modules, assembly & brand',
  construction: 'Fab build & services',
  services: 'Fab build & services',
};

export const chainGroup = (layer) => LAYER_GROUP[layer] ?? 'Fab build & services';

/* ----------------------------------------------------------------
   The index. Built once, then read by everything.
   ---------------------------------------------------------------- */
export function buildSupplierIndex(data = PUBLIC_SUPPLIER_TIERS) {
  const { companies, edges, sources, meta } = data;

  const suppliersOf = {};   // customer id -> edges into it
  const customersOf = {};   // supplier id -> edges out of it
  for (const id of Object.keys(companies)) {
    suppliersOf[id] = [];
    customersOf[id] = [];
  }

  const enriched = edges.map((e, i) => ({
    ...e,
    key: `${e.supplier}->${e.customer}`,
    index: i,
    evidence: bestEvidence(e.sources, sources),
  }));
  for (const e of enriched) {
    suppliersOf[e.customer]?.push(e);
    customersOf[e.supplier]?.push(e);
  }

  /* Tier: shortest UPSTREAM distance from a focal buyer, by breadth-first
     search against the direction of supply. Breadth-first and not
     depth-first because the claim being made is "shortest", and a
     depth-first walk would assign whichever distance it happened to
     reach first. */
  const tier = {};
  let frontier = (meta.focal || []).filter((id) => companies[id]);
  for (const id of frontier) tier[id] = 0;
  let depth = 0;
  while (frontier.length) {
    depth += 1;
    const next = [];
    for (const id of frontier) {
      for (const e of suppliersOf[id] || []) {
        if (tier[e.supplier] === undefined) {
          tier[e.supplier] = depth;
          next.push(e.supplier);
        }
      }
    }
    frontier = next;
  }

  const ids = Object.keys(companies);
  const unreached = ids.filter((id) => tier[id] === undefined);
  const maxTier = ids.reduce((m, id) => Math.max(m, tier[id] ?? 0), 0);

  const perTier = {};
  for (const id of ids) {
    const t = tier[id];
    const k = t === undefined ? 'unreached' : t;
    perTier[k] = (perTier[k] ?? 0) + 1;
  }
  const perEvidence = {};
  for (const e of enriched) perEvidence[e.evidence] = (perEvidence[e.evidence] ?? 0) + 1;

  return {
    meta, sources, companies,
    edges: enriched,
    edgeByKey: Object.fromEntries(enriched.map((e) => [e.key, e])),
    suppliersOf, customersOf,
    tier, maxTier, unreached, perTier, perEvidence,
    countryName: (c) => meta.countries?.[c] ?? c,
    layerName: (l) => meta.layers?.[l] ?? l,
  };
}

/* ----------------------------------------------------------------
   Traversal. Columns are signed hops: negative upstream (to the left,
   the same convention the facility graph and the flow graph use),
   positive downstream.
   ---------------------------------------------------------------- */
export function traverseSuppliers(index, rootId, { direction = 'upstream', hops = 2, groups = null } = {}) {
  if (!index.companies[rootId]) return null;

  const allowed = (id) => !groups || groups.has(chainGroup(index.companies[id].layer));
  const limit = hops === Infinity ? Number.POSITIVE_INFINITY : hops;

  const nodes = new Map([[rootId, { id: rootId, hop: 0, dir: 'root', via: null }]]);
  const links = [];
  /* Candidates, not the answer: a node sitting at the depth limit is only
     a frontier node if something is actually behind it. Marking every
     node at the limit put a "there is more here" ring on leaves that have
     no documented supplier at all — the graph promising a depth the
     documents do not contain. Resolved after both walks, because a node
     the upstream walk stops at may be opened by the downstream one. */
  const atLimit = new Map();

  const walk = (dir) => {
    const visited = new Set([rootId]);
    const step = dir === 'upstream' ? -1 : 1;
    const edgesFrom = dir === 'upstream' ? index.suppliersOf : index.customersOf;
    const otherEnd = dir === 'upstream' ? (e) => e.supplier : (e) => e.customer;

    let layer = [rootId];
    for (let d = 1; d <= limit && layer.length; d += 1) {
      const next = [];
      for (const id of layer) {
        for (const e of edgesFrom[id] || []) {
          const other = otherEnd(e);
          if (!allowed(other)) continue;
          if (!links.some((l) => l.key === e.key)) links.push(e);
          if (!visited.has(other)) {
            visited.add(other);
            if (!nodes.has(other) || Math.abs(nodes.get(other).hop) > d) {
              nodes.set(other, { id: other, hop: d * step, dir, via: e });
            }
            next.push(other);
          }
        }
      }
      layer = next;
      if (d === limit) for (const id of layer) atLimit.set(id, dir);
    }
  };

  if (direction === 'upstream' || direction === 'both') walk('upstream');
  if (direction === 'downstream' || direction === 'both') walk('downstream');

  /* A node at the limit is on the frontier only if it has an allowed
     neighbour in its own walk direction that the graph has not drawn. */
  const frontier = new Set();
  for (const [id, dir] of atLimit) {
    const edgesFrom = dir === 'upstream' ? index.suppliersOf : index.customersOf;
    const otherEnd = dir === 'upstream' ? (e) => e.supplier : (e) => e.customer;
    const hasMore = (edgesFrom[id] || []).some((e) => {
      const other = otherEnd(e);
      return allowed(other) && !nodes.has(other);
    });
    if (hasMore) frontier.add(id);
  }

  /* A link between two drawn nodes is worth drawing even if the walk did
     not discover the graph through it — otherwise two tier-2 suppliers
     that also trade with each other appear unconnected. */
  for (const e of index.edges) {
    if (nodes.has(e.supplier) && nodes.has(e.customer) && !links.some((l) => l.key === e.key)) links.push(e);
  }

  return {
    rootId,
    nodes: [...nodes.values()],
    links,
    frontier: [...frontier],
    columns: [...new Set([...nodes.values()].map((n) => n.hop))].sort((a, b) => a - b),
  };
}

/* How many firms the walk would reach with no depth limit — the number
   the "all reachable" warning has to state before it draws anything. */
export function reachableCount(index, rootId, direction = 'upstream') {
  const t = traverseSuppliers(index, rootId, { direction, hops: Infinity });
  return t ? t.nodes.length - 1 : 0;
}

/* Firms worth offering as a starting point: the focal buyers first, then
   whoever the documents name most often. Degree here is a count of
   DOCUMENTED relationships, not of real ones, and the caller says so. */
export function suggestedRoots(index, limit = 8) {
  const score = (id) =>
    (index.suppliersOf[id]?.length ?? 0) + (index.customersOf[id]?.length ?? 0);
  const focal = (index.meta.focal || []).filter((id) => index.companies[id]);
  const rest = Object.keys(index.companies)
    .filter((id) => !focal.includes(id))
    .sort((a, b) => score(b) - score(a) || index.companies[a].name.localeCompare(index.companies[b].name));
  return [...focal, ...rest].slice(0, limit);
}

export function searchCompanies(index, query, limit = 12) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const hits = [];
  for (const [id, c] of Object.entries(index.companies)) {
    const name = [c.name, ...(c.aliases || [])].join(' ').toLowerCase();
    const at = name.indexOf(q);
    if (at === -1) continue;
    hits.push({ id, at, name: c.name });
  }
  /* A prefix match is what the reader almost always meant, so "ASM"
     offers ASM International before Advanced Semiconductor Engineering. */
  hits.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
  return hits.slice(0, limit).map((h) => h.id);
}

// Exact shortest-hop counts, with missing evidence kept separate from zero real suppliers.
export function companyCoverage(index, id) {
  const upstream = traverseSuppliers(index, id, { hops: 3 });
  if (!upstream) return null;
  const levels = [1, 2, 3].map(depth => upstream.nodes.filter(n => n.hop === -depth).length);
  return { id, levels, suppliers: index.suppliersOf[id].length, customers: index.customersOf[id].length,
    documented: index.suppliersOf[id].length + index.customersOf[id].length > 0 };
}

export function systemCompanyCoverage(index) {
  const grouped = new Map();
  for (const [id, c] of Object.entries(index.companies)) {
    if (!c.vaultId) continue;
    const row = companyCoverage(index, id);
    const existing = grouped.get(c.vaultId);
    // Keep legal entities separate; choose the most connected entity for the directory.
    if (!existing || row.suppliers + row.customers > existing.suppliers + existing.customers) {
      grouped.set(c.vaultId, { ...row, vaultId: c.vaultId, name: c.aliases?.[0] || c.name });
    }
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function shortestSupplierPath(index, rootId, targetId, direction = 'upstream', hops = 3) {
  if (!index.companies[rootId] || !index.companies[targetId]) return null;
  const queue = [{ id: rootId, nodes: [rootId], links: [] }];
  const seen = new Set([rootId]);
  for (let i = 0; i < queue.length; i += 1) {
    const path = queue[i];
    if (path.id === targetId) return path;
    if (path.links.length >= hops) continue;
    const links = direction === 'upstream' ? index.suppliersOf[path.id] : index.customersOf[path.id];
    for (const edge of links) {
      const next = direction === 'upstream' ? edge.supplier : edge.customer;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push({ id: next, nodes: [...path.nodes, next], links: [...path.links, edge] });
    }
  }
  return null;
}
