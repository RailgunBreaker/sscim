/* Walking the modeled facility network.

   Two kinds of assertion here, and the second is the one that matters.

   The first is arithmetic on a small synthetic network: depth, direction,
   cycle prevention, node deduplication, filtering. Those are the rules.

   The second runs against THE REAL SNAPSHOT, on TSMC Fab 18 specifically,
   because that plant is where the interface used to contradict itself:
   it reported 60 modeled links and 53 inbound suppliers, drew the
   strongest 14 per side, listed 40, and captioned the graph "the list
   below has all of them". Thirteen real relationships were unreachable
   through the UI while the copy asserted completeness. If that plant's
   numbers ever stop being reachable, this fails. */
import { describe, it, expect } from 'vitest';
import {
  traverseFacilityNetwork, reachableCount, routeBetween, linkKey, edgesOf,
  localScale, localRel, makeLinkFilter, EMPTY_FILTERS, filtersActive,
  relationshipClass, evidenceTier, explainConnection, searchFacilities,
  RELATIONSHIP_CLASSES,
} from './facilityTraversal.js';
import { buildFacilityNetwork } from './facilityNetwork.js';
import { buildFacilityLayer } from './facilities.js';
import snapshot from '../data/vault-snapshot.json';
import { buildVaultData } from '../data/buildVaultData.js';
import { buildEngine } from './index.js';

/* ---------- a hand-built network, so the rules are unambiguous ---------- */

const link = (from, to, over = {}) => ({
  from, to, fromCompany: `${from}co`, toCompany: `${to}co`,
  fromStage: 's1', toStage: 's2', companyShare: 0.5, dependence: 0.5,
  weight: 1, rel: 0.5, flow: 'forward', ...over,
});

function netOf(links) {
  const byFacility = {};
  links.forEach((l) => {
    (byFacility[l.from] ||= { inbound: [], outbound: [] }).outbound.push(l);
    (byFacility[l.to] ||= { inbound: [], outbound: [] }).inbound.push(l);
  });
  return { links, linksByFacility: byFacility, stats: { maxWeight: Math.max(...links.map((l) => l.weight)) } };
}

/*  a -> b -> c -> a   (a cycle)
    d -> b             (a second route into b)
    b -> e                                                        */
const CYCLE = netOf([
  link('a', 'b', { weight: 4 }),
  link('b', 'c', { weight: 3 }),
  link('c', 'a', { weight: 2 }),
  link('d', 'b', { weight: 1 }),
  link('b', 'e', { weight: 5 }),
]);

describe('traverseFacilityNetwork — direction and depth', () => {
  it('one hop downstream returns only the direct customers', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 1 });
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(t.nodes.find((n) => n.id === 'b').depth).toBe(1);
  });

  it('one hop upstream returns only the direct suppliers', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'b', direction: 'upstream', maxHops: 1 });
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'd']);
  });

  it('both directions returns both sides at one hop', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'b', direction: 'both', maxHops: 1 });
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(t.byId.a.dir).toBe('upstream');
    expect(t.byId.c.dir).toBe('downstream');
  });

  it('two hops reaches one step further, and records the depth', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 2 });
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'e']);
    expect(t.byId.c.depth).toBe(2);
    expect(t.byId.e.depth).toBe(2);
  });

  /* A node reached upstream keeps walking upstream. Letting every node
     explore both ways would produce paths that alternate direction and
     therefore describe nothing: "A supplies B, and C also supplies B" is
     not a supply relationship between A and C. */
  it('carries the direction of travel rather than re-choosing it per node', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'e', direction: 'upstream', maxHops: 2 });
    // e <- b <- a and b <- d. Never e -> (nothing), never b -> c.
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'd', 'e']);
    expect(t.byId.c).toBeUndefined();
  });
});

describe('traverseFacilityNetwork — cycles and duplicates', () => {
  it('terminates on a cycle instead of walking it forever', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 50 });
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'e']);
  });

  it('emits each facility exactly once, at its shallowest depth', () => {
    /* b is reachable from a at depth 1 and (via c -> a is a cycle) could
       be re-entered; it must appear once. */
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 50 });
    const ids = t.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(t.byId.b.depth).toBe(1);
  });

  it('emits each link exactly once even when both endpoints are visited', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'b', direction: 'both', maxHops: 3 });
    const keys = t.links.map(linkKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /* Two sites of the same company pair can be joined through different
     stage pairs. Those are distinct modeled relationships and must not
     collapse into one. */
  it('does not collapse two links between the same pair through different stages', () => {
    const n = netOf([
      link('x', 'y', { fromStage: 's1', toStage: 's2' }),
      link('x', 'y', { fromStage: 's3', toStage: 's4' }),
    ]);
    const t = traverseFacilityNetwork(n, { rootId: 'x', direction: 'downstream', maxHops: 1 });
    expect(t.links).toHaveLength(2);
    expect(t.nodes).toHaveLength(2); // one node each, two edges between them
  });
});

describe('traverseFacilityNetwork — expand, collapse, hide', () => {
  it('expands one named branch past the global depth without raising it', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 1, expanded: ['b'] });
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'e']);
  });

  it('shows a collapsed node but none of its children', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 3, collapsed: ['b'] });
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('removes a hidden facility and everything only reachable through it', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 3, hidden: ['b'] });
    expect(t.nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('reports its node budget rather than ending silently', () => {
    const many = netOf(Array.from({ length: 30 }, (_, i) => link('hub', `n${i}`, { weight: 30 - i })));
    const t = traverseFacilityNetwork(many, { rootId: 'hub', direction: 'downstream', maxHops: 1, maxNodes: 10 });
    expect(t.truncated).toBe(true);
    expect(t.nodes.length).toBeLessThanOrEqual(10);
    expect(t.reachableTotal).toBe(31); // every neighbour was counted, not just the drawn ones
  });
});

describe('reachableCount', () => {
  it('agrees with what a full traversal would produce', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 99, maxNodes: 9999 });
    expect(reachableCount(CYCLE, { rootId: 'a', direction: 'downstream' })).toBe(t.nodes.length);
  });
});

describe('routeBetween', () => {
  /* Undirected over the visible link set, deliberately: the question is
     "how are these two connected in what I am looking at". a and c are one
     modeled relationship apart (c supplies a), so one hop is the honest
     answer even though the traversal reached c by walking a -> b -> c. */
  it('finds the shortest modeled path between two visible plants', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 3 });
    const r = routeBetween(t, 'a', 'c');
    expect(r.nodes).toEqual(['a', 'c']);
    expect(r.links).toHaveLength(1);
  });

  it('walks several hops when there is no shorter connection', () => {
    const chain = netOf([link('p', 'q'), link('q', 'r'), link('r', 's')]);
    const t = traverseFacilityNetwork(chain, { rootId: 'p', direction: 'downstream', maxHops: 3 });
    const r = routeBetween(t, 'p', 's');
    expect(r.nodes).toEqual(['p', 'q', 'r', 's']);
    expect(r.links).toHaveLength(3);
  });

  it('returns null when the two are not connected in the current view', () => {
    const t = traverseFacilityNetwork(CYCLE, { rootId: 'a', direction: 'downstream', maxHops: 1 });
    expect(routeBetween(t, 'a', 'c')).toBeNull();
  });
});

describe('filters', () => {
  const FACILITY_BY_ID = {
    a: { id: 'a', country: 'tw', kind: 'fab', status: 'operating' },
    b: { id: 'b', country: 'jp', kind: 'assembly', status: 'construction' },
  };

  it('is inactive by default and rejects nothing', () => {
    expect(filtersActive(EMPTY_FILTERS)).toBe(false);
    const f = makeLinkFilter(EMPTY_FILTERS, { FACILITY_BY_ID });
    expect(f(link('a', 'b'), { otherId: 'b' })).toBe(true);
  });

  it('filters by relationship class', () => {
    const f = makeLinkFilter({ relClass: 'service' }, { FACILITY_BY_ID });
    expect(f(link('a', 'b', { flow: 'forward' }), { otherId: 'b' })).toBe(false);
    expect(f(link('a', 'b', { flow: 'service' }), { otherId: 'b' })).toBe(true);
  });

  it('filters by the far end’s country, type and status', () => {
    expect(makeLinkFilter({ country: 'jp' }, { FACILITY_BY_ID })(link('a', 'b'), { otherId: 'b' })).toBe(true);
    expect(makeLinkFilter({ country: 'us' }, { FACILITY_BY_ID })(link('a', 'b'), { otherId: 'b' })).toBe(false);
    expect(makeLinkFilter({ kind: 'assembly' }, { FACILITY_BY_ID })(link('a', 'b'), { otherId: 'b' })).toBe(true);
    expect(makeLinkFilter({ status: 'operating' }, { FACILITY_BY_ID })(link('a', 'b'), { otherId: 'b' })).toBe(false);
  });

  it('filters by minimum strength on the snapshot scale', () => {
    const f = makeLinkFilter({ minRel: 0.4 }, { FACILITY_BY_ID });
    expect(f(link('a', 'b', { rel: 0.5 }), { otherId: 'b' })).toBe(true);
    expect(f(link('a', 'b', { rel: 0.3 }), { otherId: 'b' })).toBe(false);
  });

  it('applies inside the traversal, so graph and table cannot diverge', () => {
    const t = traverseFacilityNetwork(CYCLE, {
      rootId: 'b', direction: 'both', maxHops: 1,
      linkFilter: (l) => l.weight >= 3,
    });
    expect(t.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'e']);
    expect(t.byId.d).toBeUndefined();
  });
});

describe('labels: modeled versus observed', () => {
  it('names the three relationship classes with a plain-language description', () => {
    expect(relationshipClass(link('a', 'b', { flow: 'service' })).label).toBe('Service relationship');
    expect(relationshipClass(link('a', 'b', { flow: 'co-input' })).label).toBe('Co-input relationship');
    expect(relationshipClass(link('a', 'b')).id).toBe('forward');
    Object.values(RELATIONSHIP_CLASSES).forEach((c) => expect(c.describes.length).toBeGreaterThan(20));
  });

  /* There is no facility-to-facility shipment record anywhere in this
     dataset, so every link is modeled and must say so. */
  it('reports every undeclared link as modeled, never observed', () => {
    expect(evidenceTier(link('a', 'b')).id).toBe('modeled');
    expect(evidenceTier(link('a', 'b')).note).toMatch(/no facility-to-facility evidence/i);
  });

  it('never describes a connection as a confirmed shipment, contract or route', () => {
    const x = explainConnection(link('a', 'b'), { network: CYCLE, viewFrom: 'a' });
    const prose = [x.evidence.note, x.relationshipClass.describes, ...x.limitations].join(' ');
    expect(prose).toMatch(/not a confirmed shipment, customer contract, or trade route/i);
    expect(prose).not.toMatch(/\bconfirmed shipment\b(?!,)/i);
  });

  it('carries BOTH percentage scales, each with its own label', () => {
    const x = explainConnection(link('a', 'b', { weight: 4, rel: 0.5 }), { network: CYCLE, viewFrom: 'a' });
    expect(x.strength.localScaleLabel).toMatch(/strongest modeled link/i);
    expect(x.strength.snapshotScaleLabel).toMatch(/whole snapshot/i);
    expect(x.strength.localScaleLabel).not.toBe(x.strength.snapshotScaleLabel);
  });

  it('exposes the three factors separately, so the number is auditable', () => {
    const x = explainConnection(link('a', 'b', { companyShare: 0.3, dependence: 0.2, weight: 0.06 }), { network: CYCLE, viewFrom: 'a' });
    expect(x.factors.companyShare).toBe(0.3);
    expect(x.factors.stageReach).toBe(0.2);
    expect(x.formula).toMatch(/company revenue share/i);
  });
});

describe('local versus snapshot strength scales', () => {
  it('normalises locally against the focus plant’s own strongest link', () => {
    const scale = localScale(CYCLE, 'b');
    expect(scale).toBe(5); // b -> e
    expect(localRel(CYCLE.links.find((l) => l.to === 'e'), scale)).toBe(1);
    expect(localRel(CYCLE.links.find((l) => l.from === 'd'), scale)).toBeCloseTo(0.2, 6);
  });

  it('returns 0 rather than dividing by zero for an unconnected plant', () => {
    expect(localScale(CYCLE, 'nobody')).toBe(0);
    expect(localRel(link('a', 'b'), 0)).toBe(0);
  });
});

/* ==================================================================
   The real snapshot. TSMC Fab 18 is the regression case named in the
   brief: 60 modeled links, 53 inbound, 7 outbound.
   ================================================================== */
describe('the real snapshot — a facility with more than 40 relationships', () => {
  const data = buildVaultData(snapshot);
  const engine = buildEngine({
    STAGES: data.STAGES, FLOW_EDGES: data.FLOW_EDGES, COMPANIES: data.COMPANIES,
    CUSTOMERS: data.CUSTOMERS, POLICIES: data.POLICIES, EVENTS: data.EVENTS, OWNERS: data.OWNERS,
    datasetAsOf: snapshot.meta?.snapshotDate,
  });
  const cache = {};
  const network = buildFacilityNetwork({
    layer: data.FACILITY_LAYER,
    CUSTOMERS: data.CUSTOMERS,
    stageIds: data.STAGES.map((s) => s.id),
    dependence: (s, c) => ((cache[s] ||= engine.propagateTrace(s, 1, 'downstream').field)[c] ?? 0),
  });

  const FAB18 = 'tsmc_fab18';

  it('still has more than 40 relationships on one side, or this test is not testing anything', () => {
    const e = network.linksByFacility[FAB18];
    expect(e).toBeTruthy();
    expect(e.inbound.length).toBeGreaterThan(40);
  });

  /* The exact contradiction from the brief. edgesOf() is what the
     connection table iterates, and it must expose every link — a cap
     belongs in the RENDERING, with its numbers stated, never here. */
  it('exposes every one of its inbound relationships, not the first 40', () => {
    const e = network.linksByFacility[FAB18];
    const rows = edgesOf(network, FAB18);
    expect(rows.filter((r) => r.dir === 'upstream')).toHaveLength(e.inbound.length);
    expect(rows.filter((r) => r.dir === 'downstream')).toHaveLength(e.outbound.length);
    expect(rows).toHaveLength(e.inbound.length + e.outbound.length);
  });

  it('reaches every neighbour in a one-hop traversal, with no per-side cap', () => {
    const e = network.linksByFacility[FAB18];
    const t = traverseFacilityNetwork(network, { rootId: FAB18, direction: 'both', maxHops: 1, maxNodes: 9999 });
    expect(t.truncated).toBe(false);
    const neighbours = new Set([...e.inbound.map((l) => l.from), ...e.outbound.map((l) => l.to)]);
    neighbours.forEach((id) => expect(t.byId[id], `${id} must be reachable`).toBeTruthy());
    expect(t.nodes.length).toBe(neighbours.size + 1);
  });

  it('deduplicates a plant that is both a supplier and a customer', () => {
    const t = traverseFacilityNetwork(network, { rootId: FAB18, direction: 'both', maxHops: 1, maxNodes: 9999 });
    const ids = t.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('multi-hop from a hub terminates and stays deduplicated', () => {
    const t = traverseFacilityNetwork(network, { rootId: FAB18, direction: 'upstream', maxHops: 3, maxNodes: 9999 });
    const ids = t.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(t.nodes.length).toBeGreaterThan(1);
  });
});

describe('facility search', () => {
  const data = buildVaultData(snapshot);
  const layer = buildFacilityLayer(snapshot.facilities);
  const ctx = {
    COMPANY_BY_ID: data.COMPANY_BY_ID,
    COUNTRY_NAMES: data.COUNTRY_NAMES,
    STAGE_BY_ID: Object.fromEntries(data.STAGES.map((s) => [s.id, s])),
    KIND_LABELS: { fab: 'Fab', assembly: 'Assembly & test', materials: 'Materials' },
  };
  const find = (q) => searchFacilities(layer.FACILITIES, q, ctx, 30).map((f) => f.id);

  it('finds by facility name', () => {
    expect(find('Veldhoven')).toContain('asml_veldhoven');
  });

  it('finds by operator', () => {
    expect(find('ASML').length).toBeGreaterThan(1);
    expect(find('ASML')).toContain('asml_veldhoven');
  });

  it('finds by city, which lives inside the name rather than a separate field', () => {
    expect(find('Kumamoto').length).toBeGreaterThan(0);
  });

  it('finds by country name', () => {
    expect(find('Netherlands')).toContain('asml_veldhoven');
  });

  it('finds by semiconductor stage', () => {
    expect(find('lithography').length).toBeGreaterThan(0);
  });

  it('finds by facility type', () => {
    expect(find('fab').length).toBeGreaterThan(0);
  });

  it('returns nothing for an empty query rather than all 275 plants', () => {
    expect(find('')).toEqual([]);
    expect(find('   ')).toEqual([]);
  });

  it('ranks a name match above a mention buried in the output prose', () => {
    const [first] = searchFacilities(layer.FACILITIES, 'asml', ctx, 30);
    expect(first.company).toBe('asml');
  });
});
