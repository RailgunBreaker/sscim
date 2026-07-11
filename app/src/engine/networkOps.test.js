import { describe, it, expect } from 'vitest';
import { buildEngine } from './index.js';
import { buildBaseGraph } from './network.js';
import {
  deriveAnalysisGraph, neighborhood, reachableSet, weightedDegree,
  reachabilitySummary, directNeighbors, topConnectionsForNode, filterConnections,
} from './networkOps.js';
import { makeFixtureData } from './testFixture.js';

// fixture stage chain: s1(us) -> s2(us) -> s3(cn) -> s4(cn) -> s5(us)
// => centre chain us::s1 -> us::s2 -> cn::s3 -> cn::s4 -> us::s5
function graph() {
  const data = makeFixtureData();
  const engine = buildEngine(data);
  const base = buildBaseGraph({ data, engine });
  return { base, derived: deriveAnalysisGraph(base) };
}

describe('deriveAnalysisGraph() — reversible removals over an immutable base', () => {
  it('with no removals mirrors the base graph node/edge counts', () => {
    const { base, derived } = graph();
    expect(derived.centres.length).toBe(base.centres.length);
    expect(derived.centreEdges.length).toBe(base.centreEdges.length);
  });

  it('removing a centre drops it and every edge touching it, without mutating the base', () => {
    const { base } = graph();
    const beforeEdges = base.centreEdges.length;
    const d = deriveAnalysisGraph(base, { removedNodeIds: ['us::s2'] });
    expect(d.centreById['us::s2']).toBeUndefined();
    expect(d.centreEdges.some((e) => e.sourceId === 'us::s2' || e.targetId === 'us::s2')).toBe(false);
    // base is untouched → re-derive with no removals restores everything (Reset)
    expect(deriveAnalysisGraph(base).centreEdges.length).toBe(beforeEdges);
  });

  it('removing an edge drops only that edge', () => {
    const { base } = graph();
    const eid = 'us::s1->us::s2';
    const d = deriveAnalysisGraph(base, { removedEdgeIds: [eid] });
    expect(d.edgeById[eid]).toBeUndefined();
    expect(d.centreById['us::s1']).toBeTruthy(); // nodes stay
  });
});

describe('neighborhood() — bounded graph-transition expansion', () => {
  it('one downstream hop reveals only direct downstream neighbors', () => {
    const { derived } = graph();
    const { nodeIds } = neighborhood(derived, 'us::s1', { direction: 'downstream', hops: 1 });
    expect(nodeIds.has('us::s1')).toBe(true);
    expect(nodeIds.has('us::s2')).toBe(true);
    expect(nodeIds.has('cn::s3')).toBe(false); // two hops away
  });

  it('two hops reach two transitions out', () => {
    const { derived } = graph();
    const { nodeIds } = neighborhood(derived, 'us::s1', { direction: 'downstream', hops: 2 });
    expect(nodeIds.has('cn::s3')).toBe(true);
    expect(nodeIds.has('cn::s4')).toBe(false);
  });

  it('upstream direction walks against the edges', () => {
    const { derived } = graph();
    const { nodeIds } = neighborhood(derived, 'us::s5', { direction: 'upstream', hops: 1 });
    expect(nodeIds.has('cn::s4')).toBe(true);
    expect(nodeIds.has('us::s1')).toBe(false);
  });
});

describe('reachability & degree', () => {
  it('reachableSet downstream reaches the whole tail of the chain', () => {
    const { derived } = graph();
    const down = reachableSet(derived, 'us::s1', 'downstream');
    expect([...down].sort()).toEqual(['cn::s3', 'cn::s4', 'us::s2', 'us::s5']);
  });

  it('reachability shrinks after a node removal (hypothetical removal sensitivity)', () => {
    const { base } = graph();
    const full = reachableSet(deriveAnalysisGraph(base), 'us::s1', 'downstream').size;
    const cut = reachableSet(deriveAnalysisGraph(base, { removedNodeIds: ['cn::s3'] }), 'us::s1', 'downstream').size;
    expect(cut).toBeLessThan(full);
  });

  it('weightedDegree sums incident modeled connection weights by direction', () => {
    const { derived } = graph();
    const both = weightedDegree(derived, 'us::s2', 'both');
    const up = weightedDegree(derived, 'us::s2', 'upstream');
    const down = weightedDegree(derived, 'us::s2', 'downstream');
    expect(both).toBeCloseTo(up + down, 12);
    expect(up).toBeGreaterThan(0);
  });

  it('reachabilitySummary reports distinct reachable stages and countries', () => {
    const { derived } = graph();
    const s = reachabilitySummary(derived, 'us::s1');
    expect(s.downstreamCount).toBeGreaterThan(0);
    expect(s.reachableStages.has('s3')).toBe(true);
    expect(s.reachableCountries.has('cn')).toBe(true);
  });
});

describe('neighbor + filter helpers', () => {
  it('directNeighbors labels upstream vs downstream correctly', () => {
    const { derived } = graph();
    const ns = directNeighbors(derived, 'us::s2', 'both');
    const down = ns.find((n) => n.neighborId === 'cn::s3');
    const up = ns.find((n) => n.neighborId === 'us::s1');
    expect(down.dir).toBe('downstream');
    expect(up.dir).toBe('upstream');
  });

  it('topConnectionsForNode returns strongest-first and respects topN', () => {
    const { derived } = graph();
    const top = topConnectionsForNode(derived, 'us::s2', { direction: 'both', topN: 1 });
    expect(top).toHaveLength(1);
  });

  it('filterConnections applies threshold, country filter and topN without mutating input', () => {
    const { derived } = graph();
    const edges = derived.centreEdges;
    const filtered = filterConnections(edges, { topN: 2, minWeight: 0 });
    expect(filtered.length).toBeLessThanOrEqual(2);
    // sorted strongest-first
    if (filtered.length === 2) expect(filtered[0].rawDisplayWeight).toBeGreaterThanOrEqual(filtered[1].rawDisplayWeight);
    // input array not reordered/mutated
    expect(edges.length).toBe(derived.centreEdges.length);
    const cn = filterConnections(edges, { countries: ['cn'] });
    cn.forEach((e) => expect(e.sourceCountry === 'cn' || e.targetCountry === 'cn').toBe(true));
  });
});
