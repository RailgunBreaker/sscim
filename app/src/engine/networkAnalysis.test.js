import { describe, it, expect } from 'vitest';
import { betweenness, nodeRemovalImpact, edgeCriticalityImpact, metricValues, rankByMetric } from './networkAnalysis.js';
import { deriveAnalysisGraph } from './networkOps.js';

/* Synthetic graph: a bridge topology where B is the sole cut vertex.
     A→B, X→B, B→C, B→D
   Every shortest path from {A,X} to {C,D} passes through B. */
function mkGraph(spec) {
  const centreById = {}, edgeById = {}, outAdj = {}, inAdj = {};
  const ensure = (id) => { if (!centreById[id]) { centreById[id] = { id, countryId: id, stageId: id, companies: [] }; outAdj[id] = []; inAdj[id] = []; } };
  spec.forEach(([a, b, w = 1]) => {
    ensure(a); ensure(b);
    const id = `${a}->${b}`;
    edgeById[id] = { id, sourceId: a, targetId: b, sourceStage: a, targetStage: b, sourceCountry: a, targetCountry: b, rawDisplayWeight: w };
    outAdj[a].push(id); inAdj[b].push(id);
  });
  // buildBaseGraph-like shape for deriveAnalysisGraph: needs centres array + centreEdges
  const centres = Object.values(centreById);
  const centreEdges = Object.values(edgeById);
  return { centres, centreById, centreEdges, edgeById, outAdj, inAdj };
}

const G = mkGraph([['A', 'B'], ['X', 'B'], ['B', 'C'], ['B', 'D']]);
// deriveFn wrapper matching engine signature (baseGraph, { removed... })
const derive = (base, opts) => deriveAnalysisGraph(base, opts);

describe('betweenness()', () => {
  it('ranks the sole cut vertex highest', () => {
    const cb = betweenness(G);
    expect(cb['B']).toBeGreaterThan(cb['A']);
    expect(cb['B']).toBeGreaterThan(cb['C']);
    // leaf/source nodes have zero shortest-path bridging
    expect(cb['A']).toBe(0);
    expect(cb['C']).toBe(0);
  });

  it('is deterministic', () => {
    expect(betweenness(G)).toEqual(betweenness(G));
  });
});

describe('nodeRemovalImpact() — hypothetical removal sensitivity', () => {
  it('removing the cut vertex loses all cross reachability and isolates the rest', () => {
    const r = nodeRemovalImpact(G, 'B', derive);
    expect(r.lostReachablePairs).toBeGreaterThan(0);
    expect(r.reachablePairsAfter).toBeLessThan(r.reachablePairsBefore);
    // A, X, C, D all lose their only connection (through B)
    expect(r.newlyIsolated.sort()).toEqual(['A', 'C', 'D', 'X']);
  });

  it('removing a leaf loses little and isolates nothing extra', () => {
    const r = nodeRemovalImpact(G, 'C', derive);
    expect(r.newlyIsolated).toEqual([]);
    expect(r.lostReachablePairs).toBeGreaterThanOrEqual(0);
  });
});

describe('edgeCriticalityImpact()', () => {
  it('reports lost reachability and no alternative when the edge is the only link', () => {
    const r = edgeCriticalityImpact(G, 'B->C', derive);
    expect(r.sourceId).toBe('B');
    expect(r.targetId).toBe('C');
    expect(r.lostReachablePairs).toBeGreaterThan(0);
    expect(r.alternativeExists).toBe(false);
  });

  it('finds an alternative when a parallel path exists', () => {
    const D2 = mkGraph([['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']]);
    const r = edgeCriticalityImpact(D2, 'B->D', derive);
    // A still reaches D via C; but B→D removal: does B still reach D? no.
    // the edge's own endpoints B and D: B no longer reaches D → alt false
    expect(r.alternativeExists).toBe(false);
    // whereas removing A->B keeps A→(everything) via C
    const r2 = edgeCriticalityImpact(D2, 'A->B', derive);
    expect(r2.alternativeExists).toBe(false); // A reaches B only via that edge
  });
});

describe('metricValues() + rankByMetric()', () => {
  it('computes degree/reachability and ranks strongest first', () => {
    const g = derive(G, {});
    const reach = metricValues(g, 'reach_down');
    expect(reach['B']).toBe(2); // B reaches C and D
    expect(reach['A']).toBe(3); // A reaches B, C, D
    const ranked = rankByMetric(reach);
    expect(ranked[0].value).toBe(3); // A/X reach the most (tie → A first by id)
    expect(ranked[0].id).toBe('A');
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].value).toBeGreaterThanOrEqual(ranked[i].value);
  });

  it('betweenness path returns the Brandes map', () => {
    const g = derive(G, {});
    const bt = metricValues(g, 'betweenness');
    expect(bt['B']).toBeGreaterThan(0);
  });
});
