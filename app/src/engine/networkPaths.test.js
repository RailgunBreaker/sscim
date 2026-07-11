import { describe, it, expect } from 'vitest';
import { enumerateCentreRoutes, findCentreRoutes } from './networkPaths.js';

/* Synthetic diamond so objectives and alternatives are distinguishable:
     A→B(.5)  A→C(.2)  B→D(.4)  C→D(.9)  B→C(.3)
   Paths A→D:
     A-B-D    product .20  sum .90  bottleneck .40  hops 2
     A-C-D    product .18  sum 1.10 bottleneck .20  hops 2
     A-B-C-D  product .135 sum 1.70 bottleneck .30  hops 3 */
function mkGraph(spec) {
  const centreById = {}, edgeById = {}, outAdj = {}, inAdj = {};
  const ensure = (id) => { if (!centreById[id]) { centreById[id] = { id, countryId: id.toLowerCase(), stageId: id, companies: [] }; outAdj[id] = []; inAdj[id] = []; } };
  spec.forEach(([a, b, w]) => {
    ensure(a); ensure(b);
    const id = `${a}->${b}`;
    edgeById[id] = { id, sourceId: a, targetId: b, sourceStage: a, targetStage: b, sourceCountry: a.toLowerCase(), targetCountry: b.toLowerCase(), rawDisplayWeight: w };
    outAdj[a].push(id); inAdj[b].push(id);
  });
  return { centreById, edgeById, outAdj, inAdj };
}

const G = mkGraph([['A', 'B', 0.5], ['A', 'C', 0.2], ['B', 'D', 0.4], ['C', 'D', 0.9], ['B', 'C', 0.3]]);

describe('enumerateCentreRoutes()', () => {
  it('finds all three A→D routes, each a valid connected chain', () => {
    const routes = enumerateCentreRoutes(G, 'A', 'D');
    expect(routes).toHaveLength(3);
    routes.forEach((r) => {
      expect(r.centres[0]).toBe('A');
      expect(r.centres.at(-1)).toBe('D');
      // every hop's edge really connects consecutive centres
      r.edges.forEach((e, i) => {
        expect(e.sourceId).toBe(r.centres[i]);
        expect(e.targetId).toBe(r.centres[i + 1]);
      });
      expect(r.hops).toBe(r.edges.length);
    });
  });

  it('excludes routes through an avoided node/edge (removal-aware)', () => {
    const noB = enumerateCentreRoutes(G, 'A', 'D', { avoidNodes: ['B'] });
    expect(noB.map((r) => r.centres.join('>'))).toEqual(['A>C>D']);
    const noCD = enumerateCentreRoutes(G, 'A', 'D', { avoidEdges: ['C->D'] });
    expect(noCD.every((r) => !r.centres.join('>').includes('C>D'))).toBe(true);
  });

  it('returns nothing for identical or unreachable endpoints', () => {
    expect(enumerateCentreRoutes(G, 'A', 'A')).toEqual([]);
    expect(enumerateCentreRoutes(G, 'D', 'A')).toEqual([]); // DAG, no upstream route
  });
});

describe('findCentreRoutes() — objectives', () => {
  it('strongest maximises the weight product', () => {
    const [best] = findCentreRoutes(G, 'A', 'D', { objective: 'strongest', k: 3 });
    expect(best.centres.join('>')).toBe('A>B>D');
  });

  it('max_bottleneck maximises the weakest edge', () => {
    const [best] = findCentreRoutes(G, 'A', 'D', { objective: 'max_bottleneck', k: 1 });
    expect(best.centres.join('>')).toBe('A>B>D'); // bottleneck .40
  });

  it('fewest_hops prefers 2-hop routes over the 3-hop one', () => {
    const routes = findCentreRoutes(G, 'A', 'D', { objective: 'fewest_hops', k: 3 });
    expect(routes[0].hops).toBe(2);
    expect(routes.at(-1).centres.join('>')).toBe('A>B>C>D'); // longest last
  });

  it('max_cumulative maximises the weight sum (favours the longer chain here)', () => {
    const [best] = findCentreRoutes(G, 'A', 'D', { objective: 'max_cumulative', k: 1 });
    expect(best.centres.join('>')).toBe('A>B>C>D');
  });

  it('returns distinct routes and is deterministic', () => {
    const a = findCentreRoutes(G, 'A', 'D', { objective: 'strongest', k: 3 });
    const b = findCentreRoutes(G, 'A', 'D', { objective: 'strongest', k: 3 });
    expect(a.map((r) => r.centres.join('>'))).toEqual(b.map((r) => r.centres.join('>')));
    expect(new Set(a.map((r) => r.centres.join('>'))).size).toBe(a.length);
  });

  it('avoidStage/avoidCountry drop routes through matching centres', () => {
    const noC = findCentreRoutes(G, 'A', 'D', { avoidStage: 'C', k: 3 });
    expect(noC.every((r) => !r.centres.includes('C'))).toBe(true);
    expect(noC.map((r) => r.centres.join('>'))).toEqual(['A>B>D']);
  });
});
