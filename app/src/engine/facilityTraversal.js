/* ====================================================================
   engine/facilityTraversal.js — walking the modeled facility network.

   facilityNetwork.js DERIVES the site-to-site links. This module only
   WALKS them. That split is deliberate and load-bearing: the playground,
   the compact explorer, the map and a facility's own profile must never
   be able to disagree about which plants are connected, so there is
   exactly one derivation (facilityNetwork.buildFacilityNetwork) and
   everything else reads its `linksByFacility` index. Nothing here builds
   an edge.

   WHAT A LINK IS, restated once because traversal makes it easy to forget:
   a MODELED, stage-mediated relationship composed from company-level
   supplier-revenue share and stage reachability. It is not a shipment, a
   customer contract, or a trade route. Nothing in this dataset records
   which plant ships to which plant. Multi-hop traversal compounds that:
   a two-hop path is two modeled relationships in sequence, not an
   observed route, and the labels say so.

   TWO PERCENTAGE SCALES EXIST AND THEY ARE NOT COMPARABLE.
     · link.rel      — strength against the strongest link in the whole
                       snapshot. Almost every link rounds to 0% on it.
     · localRel(...) — strength against the strongest link touching the
                       facility being viewed. Answers "of THIS plant's
                       connections, which matter most".
   Both are exported with names that say which is which, and every caller
   is required to label the scale it renders. Showing one next to the
   other without saying so was a real defect: the graph normalised
   locally, the list normalised globally, and the two numbers for one link
   disagreed by orders of magnitude.

   Pure and dependency-free so every rule is unit-testable directly.
   ==================================================================== */

export const DIRECTIONS = ['upstream', 'downstream', 'both'];

/* Traversal has to be bounded or "show everything reachable" from a hub
   walks most of the network into one SVG and locks the tab. The cap is
   REPORTED (truncated/reachableTotal), never silent — a truncated view
   that looks complete is the failure mode this codebase is written
   against. */
export const DEFAULT_MAX_NODES = 300;

/* Hop depths the UI offers. `Infinity` is "all reachable", which is
   gated behind a warning because on a hub it is not readable. */
export const HOP_CHOICES = [1, 2, 3];

/* A stable identity for one link. Two sites of the same company pair can
   be joined through different stage pairs, so the stage pair and flow are
   part of the key — without them, deduplication would collapse distinct
   modeled relationships into one and undercount the network. */
export function linkKey(l) {
  return `${l.from}>${l.to}|${l.fromStage || ''}>${l.toStage || ''}|${l.flow || 'forward'}`;
}

/* Strength relative to the strongest link touching `facilityId`. See the
   header: this is NOT link.rel and the two must never be shown as if they
   were the same number. */
export function localScale(network, facilityId) {
  const e = network?.linksByFacility?.[facilityId];
  if (!e) return 0;
  return [...e.inbound, ...e.outbound].reduce((m, l) => Math.max(m, l.weight || 0), 0) || 0;
}

export function localRel(link, scale) {
  if (!scale) return 0;
  return (link?.weight || 0) / scale;
}

/* Every link touching a facility, with the direction it was reached from
   attached. `dir` is the direction of TRAVEL from that facility:
   'upstream' means the other end supplies it, 'downstream' means it
   supplies the other end. */
export function edgesOf(network, facilityId) {
  const e = network?.linksByFacility?.[facilityId] || { inbound: [], outbound: [] };
  return [
    ...e.inbound.map((link) => ({ link, dir: 'upstream', otherId: link.from })),
    ...e.outbound.map((link) => ({ link, dir: 'downstream', otherId: link.to })),
  ];
}

function wantedDirections(direction) {
  if (direction === 'upstream') return ['upstream'];
  if (direction === 'downstream') return ['downstream'];
  return ['upstream', 'downstream'];
}

/* ====================================================================
   traverse — breadth-first from one facility over the modeled links.

   Direction is carried, not re-chosen at every node. A node reached by
   walking upstream keeps walking upstream; a node reached downstream keeps
   walking downstream. Only the root explores both when `direction: 'both'`.

   The alternative — letting every node explore both ways — turns a
   two-hop request into most of the network within one step of any hub,
   and worse, it produces paths that alternate direction and therefore
   describe nothing: "A supplies B, and C also supplies B, therefore A…C"
   is not a supply relationship in either direction. Keeping the direction
   means every path in the result reads as one consistent chain.

   CYCLE PREVENTION AND DEDUPLICATION. `seen` is keyed by facility id, so
   a facility that is reachable by several routes is visited once and
   appears as one node — never a duplicate glyph, and never an infinite
   walk around a cycle. Links are deduplicated by linkKey(), so a link
   discovered from both of its endpoints is emitted once.
   ==================================================================== */
export function traverseFacilityNetwork(network, {
  rootId,
  direction = 'both',
  maxHops = 1,
  expanded = [],
  collapsed = [],
  hidden = [],
  linkFilter = null,
  maxNodes = DEFAULT_MAX_NODES,
} = {}) {
  const empty = {
    nodes: [], links: [], byId: {}, truncated: false,
    reachableTotal: 0, frontier: [], depthOf: {},
  };
  if (!network?.linksByFacility || !rootId) return empty;

  const expandedSet = new Set(expanded || []);
  const collapsedSet = new Set(collapsed || []);
  const hiddenSet = new Set(hidden || []);
  if (hiddenSet.has(rootId)) return empty;

  const accept = typeof linkFilter === 'function' ? linkFilter : () => true;

  const nodes = [];
  const byId = {};
  const seen = new Set();
  const linkSeen = new Set();
  const links = [];
  const frontier = [];
  let truncated = false;
  /* Counted even when the node is not emitted, so "showing 300 of 412"
     can be stated honestly rather than the view simply ending. */
  const reachable = new Set();

  const push = (facilityId, depth, dir, viaLink) => {
    const node = { id: facilityId, depth, dir, via: viaLink || null };
    nodes.push(node);
    byId[facilityId] = node;
    return node;
  };

  seen.add(rootId);
  reachable.add(rootId);
  push(rootId, 0, 'root', null);

  let queue = [{ id: rootId, depth: 0, dir: 'root' }];

  while (queue.length) {
    const next = [];
    for (const cur of queue) {
      /* A collapsed branch still shows its own node — the user asked to
         fold it, not to pretend it is not there — but contributes no
         children. The root can never be collapsed away. */
      if (cur.depth > 0 && collapsedSet.has(cur.id)) continue;

      /* Depth gate. `expanded` is the per-node override that makes
         progressive traversal work: one neighbour opened by name goes a
         hop further than the global depth without raising it for
         everything else. */
      const allowed = cur.depth < maxHops || expandedSet.has(cur.id);
      if (!allowed) { frontier.push(cur.id); continue; }

      const dirs = cur.depth === 0 ? wantedDirections(direction) : [cur.dir];
      for (const { link, dir, otherId } of edgesOf(network, cur.id)) {
        if (!dirs.includes(dir)) continue;
        if (hiddenSet.has(otherId)) continue;
        if (!accept(link, { dir, fromId: cur.id, otherId, depth: cur.depth + 1 })) continue;

        reachable.add(otherId);

        const key = linkKey(link);
        const isNewNode = !seen.has(otherId);

        if (isNewNode && nodes.length >= maxNodes) { truncated = true; continue; }

        if (!linkSeen.has(key)) {
          linkSeen.add(key);
          links.push({ ...link, dir, fromDepth: cur.depth, sourceOfWalk: cur.id });
        }
        if (isNewNode) {
          seen.add(otherId);
          push(otherId, cur.depth + 1, dir, link);
          next.push({ id: otherId, depth: cur.depth + 1, dir });
        }
      }
    }
    queue = next;
  }

  return {
    nodes, links, byId, truncated,
    reachableTotal: reachable.size,
    frontier: [...new Set(frontier)],
    depthOf: Object.fromEntries(nodes.map((n) => [n.id, n.depth])),
  };
}

/* How many facilities "all reachable" would pull in, without building the
   result — so the UI can warn before it draws instead of after it hangs.
   Same direction-carrying rule as traverse(), so the number it reports is
   the number traverse() would produce. */
export function reachableCount(network, { rootId, direction = 'both', hidden = [] } = {}) {
  if (!network?.linksByFacility || !rootId) return 0;
  const hiddenSet = new Set(hidden || []);
  const seen = new Set([rootId]);
  let queue = [{ id: rootId, dir: 'root' }];
  while (queue.length) {
    const next = [];
    for (const cur of queue) {
      const dirs = cur.dir === 'root' ? wantedDirections(direction) : [cur.dir];
      for (const { dir, otherId } of edgesOf(network, cur.id)) {
        if (!dirs.includes(dir)) continue;
        if (hiddenSet.has(otherId) || seen.has(otherId)) continue;
        seen.add(otherId);
        next.push({ id: otherId, dir });
      }
    }
    queue = next;
  }
  return seen.size;
}

/* Shortest modeled path between two facilities that are both visible in
   the current traversal. Undirected over the visible link set on purpose:
   the question the UI asks is "how are these two connected in what I am
   looking at", and refusing an answer because one leg runs the other way
   would be pedantry — the returned edges each carry their own direction,
   so the answer stays honest about which way each leg points. */
export function routeBetween(traversal, fromId, toId) {
  if (!traversal || !fromId || !toId || fromId === toId) return null;
  if (!traversal.byId[fromId] || !traversal.byId[toId]) return null;

  const adj = {};
  traversal.links.forEach((l) => {
    (adj[l.from] ||= []).push({ to: l.to, link: l });
    (adj[l.to] ||= []).push({ to: l.from, link: l });
  });

  const prev = { [fromId]: null };
  let queue = [fromId];
  const seen = new Set([fromId]);
  while (queue.length) {
    const next = [];
    for (const cur of queue) {
      if (cur === toId) break;
      for (const edge of adj[cur] || []) {
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);
        prev[edge.to] = { from: cur, link: edge.link };
        next.push(edge.to);
      }
    }
    if (seen.has(toId)) break;
    queue = next;
  }
  if (!seen.has(toId)) return null;

  const nodesRev = [toId];
  const edges = [];
  let cur = toId;
  while (prev[cur]) {
    edges.push(prev[cur].link);
    cur = prev[cur].from;
    nodesRev.push(cur);
  }
  return { nodes: nodesRev.reverse(), links: edges.reverse() };
}

/* ====================================================================
   Relationship classes and evidence.

   The network builder tags each link with a `flow`: how the supplier's
   output and the customer's die actually move relative to each other.
   These are the user-facing names for those, plus the sentence that says
   what the class means — used by the connection detail panel so no reader
   has to infer it from a colour.
   ==================================================================== */
export const RELATIONSHIP_CLASSES = Object.freeze({
  forward: {
    id: 'forward',
    label: 'Upstream supply',
    short: 'forward',
    describes: 'The supplier’s output feeds a stage the customer runs: material, tool, or wafer moving downstream.',
  },
  service: {
    id: 'service',
    label: 'Service relationship',
    short: 'service',
    describes: 'The customer’s die travels to the supplier and comes back changed — packaging, test, foundry service. The invoice and the die move in opposite directions.',
  },
  'co-input': {
    id: 'co-input',
    label: 'Co-input relationship',
    short: 'co-input',
    describes: 'Neither stage reaches the other; both feed a common stage downstream. Substrates and logic dice are siblings that meet at advanced packaging.',
  },
});

export function relationshipClass(link) {
  return RELATIONSHIP_CLASSES[link?.flow] || RELATIONSHIP_CLASSES.forward;
}

/* EVIDENCE TIER. Every link in this dataset is modeled — there is no
   facility-to-facility shipment record anywhere in the vault — so this
   function has exactly one honest answer today, and it returns it rather
   than implying a tier the data cannot support. It is written as a lookup
   so that if directly-evidenced site links are ever ingested, the label
   changes here and everywhere at once instead of in each panel.

   The words are chosen to be un-upgradable by a careless reader:
   "modeled stage-mediated relationship", never "confirmed", "shipment",
   "contract", or "route". */
export const EVIDENCE_TIERS = Object.freeze({
  observed: { id: 'observed', label: 'Observed', note: 'A recorded facility-to-facility movement.' },
  curated: { id: 'curated', label: 'Curated', note: 'A named facility relationship entered by an analyst from a cited source.' },
  inferred: { id: 'inferred', label: 'Inferred', note: 'Derived from a cited company relationship plus a named facility on each side.' },
  modeled: {
    id: 'modeled',
    label: 'Modeled',
    note: 'Composed from a company-level supply relationship and stage reachability. No facility-to-facility evidence exists for this pair.',
  },
});

export function evidenceTier(link) {
  const declared = link?.evidence;
  return EVIDENCE_TIERS[declared] || EVIDENCE_TIERS.modeled;
}

/* The full "why does this line exist" record for one connection.

   Everything here is read off the link the network builder already
   produced — companyShare, dependence, weight, the stage pair — so the
   explanation cannot drift away from the number it explains. `scale` is
   the local normaliser (localScale) for whichever facility the reader is
   looking at; the returned object carries BOTH percentages with their
   scale named, because that is the defect this replaces. */
export function explainConnection(link, {
  network, viewFrom, COMPANY_BY_ID = {}, STAGE_BY_ID = {}, FACILITY_BY_ID = {},
} = {}) {
  if (!link) return null;
  const cls = relationshipClass(link);
  const tier = evidenceTier(link);
  const scale = viewFrom ? localScale(network, viewFrom) : 0;
  const snapshotMax = network?.stats?.maxWeight || 0;

  const nameOf = (id) => COMPANY_BY_ID[id]?.name || id;
  const stageOf = (id) => STAGE_BY_ID[id]?.name || id;

  return {
    link,
    direction: link.dir || (viewFrom && link.from === viewFrom ? 'downstream' : 'upstream'),
    relationshipClass: cls,
    evidence: tier,
    from: FACILITY_BY_ID[link.from] || null,
    to: FACILITY_BY_ID[link.to] || null,
    fromCompany: { id: link.fromCompany, name: nameOf(link.fromCompany) },
    toCompany: { id: link.toCompany, name: nameOf(link.toCompany) },
    fromStage: { id: link.fromStage, name: stageOf(link.fromStage) },
    toStage: { id: link.toStage, name: stageOf(link.toStage) },
    /* The three factors, individually, because the product alone is
       un-auditable — a reader who disagrees needs to see which term they
       disagree with. */
    factors: {
      companyShare: link.companyShare ?? null,
      stageReach: link.dependence ?? null,
      weight: link.weight ?? null,
    },
    formula: 'weight = company revenue share × supplier site share of its stage × customer site share of its stage × stage reach',
    strength: {
      localPct: scale ? (link.weight || 0) / scale : null,
      localScaleLabel: viewFrom
        ? `share of ${FACILITY_BY_ID[viewFrom]?.name || viewFrom}’s strongest modeled link`
        : null,
      snapshotPct: snapshotMax ? (link.weight || 0) / snapshotMax : (link.rel ?? null),
      snapshotScaleLabel: 'share of the strongest modeled link in the whole snapshot',
    },
    /* Stated on every connection, not once in a footnote. */
    limitations: [
      'This is a modeled stage-mediated relationship, not a confirmed shipment, customer contract, or trade route.',
      'The commercial relationship is company-to-company; which specific plants serve it is an allocation assumption based on analyst significance ordinals.',
      'Strength is a relative ordering, never a volume, a revenue figure, or a capacity.',
      'Site significance is an analyst ordinal (1–5), not measured capacity.',
    ],
  };
}

/* ====================================================================
   Filters. One predicate factory used by BOTH the graph and the
   connection table, so the two can never disagree about what is included
   — a filter that hid a row from the list but left its line on the graph
   would be the same class of lie as a silent truncation.
   ==================================================================== */
export const EMPTY_FILTERS = Object.freeze({
  relClass: 'all',      // 'all' | 'forward' | 'service' | 'co-input'
  company: '',          // company id on either end
  country: '',          // country id of the far end
  stage: '',            // stage id on either end
  kind: '',             // facility kind of the far end
  status: 'all',        // operating | ramping | construction
  evidence: 'all',      // evidence tier of the link
  minRel: 0,            // minimum strength, on the SNAPSHOT scale (link.rel)
});

export function filtersActive(filters) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  return f.relClass !== 'all' || Boolean(f.company) || Boolean(f.country)
    || Boolean(f.stage) || Boolean(f.kind) || f.status !== 'all'
    || f.evidence !== 'all' || Number(f.minRel) > 0;
}

export function makeLinkFilter(filters, { FACILITY_BY_ID = {} } = {}) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  return (link, ctx = {}) => {
    if (f.relClass !== 'all' && (link.flow || 'forward') !== f.relClass) return false;
    if (f.evidence !== 'all' && evidenceTier(link).id !== f.evidence) return false;
    if (Number(f.minRel) > 0 && (link.rel ?? 0) < Number(f.minRel)) return false;
    if (f.company && link.fromCompany !== f.company && link.toCompany !== f.company) return false;
    if (f.stage && link.fromStage !== f.stage && link.toStage !== f.stage) return false;

    const otherId = ctx.otherId || link.to;
    const other = FACILITY_BY_ID[otherId];
    if (f.country && other?.country !== f.country) return false;
    if (f.kind && other?.kind !== f.kind) return false;
    if (f.status !== 'all' && other?.status !== f.status) return false;
    return true;
  };
}

/* ====================================================================
   Facility search. Name, operator, city, country, stage and facility type
   — the six fields the product promises are searchable.

   `city` has no column of its own in the facility table: the name column
   carries it ("Analog Devices — Beaverton, Oregon"), so the city term is
   matched against the name's post-dash remainder rather than invented as
   a field. Stated here so nobody later "fixes" this into a fabricated
   city attribute.
   ==================================================================== */
export function facilitySearchText(f, { COMPANY_BY_ID = {}, COUNTRY_NAMES = {}, STAGE_BY_ID = {}, KIND_LABELS = {} } = {}) {
  return [
    f.name,
    COMPANY_BY_ID[f.company]?.name || f.company,
    COUNTRY_NAMES[f.country] || f.country,
    f.country,
    ...(f.stages || []).map((s) => STAGE_BY_ID[s]?.name || s),
    ...(f.stages || []),
    KIND_LABELS[f.kind] || f.kind,
    f.node || '',
    f.output || '',
  ].join(' · ').toLowerCase();
}

export function searchFacilities(facilities, query, ctx = {}, limit = 20) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const f of facilities || []) {
    const hay = facilitySearchText(f, ctx);
    if (!terms.every((t) => hay.includes(t))) continue;
    /* A name hit outranks a hit buried in the output prose — searching
       "ASML" should not put a plant that merely mentions ASML above ASML
       Veldhoven. */
    const name = f.name.toLowerCase();
    const score = terms.reduce((s, t) => s + (name.includes(t) ? 2 : 0), 0)
      + (name.startsWith(terms[0]) ? 3 : 0);
    scored.push({ f, score });
  }
  scored.sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name));
  return scored.slice(0, limit).map((s) => s.f);
}
