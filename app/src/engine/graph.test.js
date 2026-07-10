import { describe, it, expect } from 'vitest';
import { buildAdjacency, buildDependenceMatrices, propagateFromSource, findTopPaths } from './graph.js';
import { topologicalSort } from './math.js';
import { MODEL_PRIORS } from './priors.js';

const stageIds = ['s1', 's2', 's3', 's4', 's5', 'siso'];
const edges = [['s1', 's2'], ['s2', 's3'], ['s3', 's4'], ['s4', 's5']];

function setup(getSubst = () => 5) {
  const { OUT, IN } = buildAdjacency(stageIds, edges);
  const { order: TOPO } = topologicalSort(stageIds, OUT);
  const REV_TOPO = [...TOPO].reverse();
  const { D, U } = buildDependenceMatrices(stageIds, OUT, IN, getSubst, MODEL_PRIORS);
  return { OUT, IN, TOPO, REV_TOPO, D, U };
}

describe('propagateFromSource() — all-reachable-paths propagation', () => {
  it('a downstream shock at s1 reaches s5, four hops away (beyond the old fixed 2-hop cutoff)', () => {
    const { OUT, IN, TOPO, REV_TOPO, D, U } = setup();
    const field = propagateFromSource({
      sourceId: 's1', magnitude: 1, channel: 'downstream',
      stageIds, OUT, IN, TOPO, REV_TOPO, D, U, tolerance: MODEL_PRIORS.contributionTolerance,
    });
    expect(field.s2).toBeGreaterThan(0);
    expect(field.s3).toBeGreaterThan(0);
    expect(field.s4).toBeGreaterThan(0);
    expect(field.s5).toBeGreaterThan(0);
  });

  it('leaves a disconnected node completely unaffected', () => {
    const { OUT, IN, TOPO, REV_TOPO, D, U } = setup();
    const field = propagateFromSource({
      sourceId: 's1', magnitude: 1, channel: 'both',
      stageIds, OUT, IN, TOPO, REV_TOPO, D, U, tolerance: MODEL_PRIORS.contributionTolerance,
    });
    expect(field.siso).toBe(0);
  });

  it('every propagated value stays within [-1,1]', () => {
    const { OUT, IN, TOPO, REV_TOPO, D, U } = setup();
    const field = propagateFromSource({
      sourceId: 's1', magnitude: 1, channel: 'both',
      stageIds, OUT, IN, TOPO, REV_TOPO, D, U, tolerance: MODEL_PRIORS.contributionTolerance,
    });
    Object.values(field).forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});

describe('propagateFromSource({ trace: true }) — trace is a pure decomposition', () => {
  // Diamond with an asymmetric path so a node is reachable at two different
  // depths (a->d directly at hop 1, and a->b->c->d at hop 3): exercises the
  // "settle hop = longest contributing path" reveal, not shortest.
  const ids = ['a', 'b', 'c', 'd', 'x'];
  const dia = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'd']];
  function diaSetup() {
    const { OUT, IN } = buildAdjacency(ids, dia);
    const { order: TOPO } = topologicalSort(ids, OUT);
    const REV_TOPO = [...TOPO].reverse();
    const { D, U } = buildDependenceMatrices(ids, OUT, IN, () => 5, MODEL_PRIORS);
    return { OUT, IN, TOPO, REV_TOPO, D, U };
  }
  const run = (channel, trace) => {
    const s = diaSetup();
    return propagateFromSource({
      sourceId: 'a', magnitude: 1, channel, ...s, stageIds: ids,
      tolerance: MODEL_PRIORS.contributionTolerance, trace,
    });
  };

  it.each(['downstream', 'upstream', 'both'])('enabling trace does not change the final field (%s)', (channel) => {
    const plain = run(channel, false);
    const { field } = run(channel, true);
    expect(field).toEqual(plain);
  });

  it('cumulative contribution at the final step equals the returned field exactly', () => {
    const { field, trace } = run('both', true);
    const finalCumulative = trace[trace.length - 1].cumulativeContribution;
    ids.forEach((id) => {
      expect(finalCumulative[id] ?? 0).toBe(field[id]);
    });
  });

  it('reveals the source alone at step 0, then each reached node exactly once', () => {
    const { trace } = run('downstream', true);
    expect(trace[0].nodes).toEqual(['a']);
    expect(trace[0].incrementalContribution).toEqual({ a: 1 });
    const seen = [];
    trace.forEach((s) => s.nodes.forEach((n) => seen.push(n)));
    expect(new Set(seen).size).toBe(seen.length); // no node revealed twice
    expect(seen).not.toContain('x'); // disconnected node never appears
  });

  it('places d on its longest contributing path (hop 3), not its shortest (hop 1)', () => {
    const { trace } = run('downstream', true);
    const stepOfD = trace.find((s) => s.nodes.includes('d'))?.step;
    expect(stepOfD).toBe(3);
  });

  it('cumulative is monotonic: every earlier value persists unchanged in later steps', () => {
    const { trace } = run('both', true);
    for (let k = 1; k < trace.length; k++) {
      const prev = trace[k - 1].cumulativeContribution;
      const cur = trace[k].cumulativeContribution;
      Object.entries(prev).forEach(([id, v]) => expect(cur[id]).toBe(v));
    }
  });

  it('returns an empty trace for a zero-magnitude shock', () => {
    const s = diaSetup();
    const { field, trace } = propagateFromSource({
      sourceId: 'a', magnitude: 0, channel: 'both', ...s, stageIds: ids,
      tolerance: MODEL_PRIORS.contributionTolerance, trace: true,
    });
    expect(trace).toEqual([]);
    expect(field.a).toBe(0);
  });
});

describe('findTopPaths() — strongest modeled propagation routes', () => {
  // Diamond: two downstream routes from a to d — a->b->d and a->c->d — plus
  // a longer one a->b->c->d, so ranking by attenuation is exercised.
  const ids = ['a', 'b', 'c', 'd'];
  const dia = [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['b', 'c']];
  function setupDia() {
    const { OUT, IN } = buildAdjacency(ids, dia);
    const { D, U } = buildDependenceMatrices(ids, OUT, IN, () => 5, MODEL_PRIORS);
    return { OUT, IN, D, U };
  }

  it('finds downstream routes from source to target, strongest first', () => {
    const { OUT, IN, D, U } = setupDia();
    const paths = findTopPaths({ sourceId: 'a', targetId: 'd', OUT, IN, D, U, k: 3 });
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].nodes[0]).toBe('a');
    expect(paths[0].nodes[paths[0].nodes.length - 1]).toBe('d');
    // sorted by attenuation descending
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i - 1].attenuation).toBeGreaterThanOrEqual(paths[i].attenuation);
    }
    // each edge carries a positive coefficient and a direction
    paths[0].edges.forEach((e) => { expect(e.coeff).toBeGreaterThan(0); expect(e.dir).toBe('downstream'); });
  });

  it('falls back to the upstream echo direction when target is a supplier of source', () => {
    const { OUT, IN, D, U } = setupDia();
    const paths = findTopPaths({ sourceId: 'd', targetId: 'a', OUT, IN, D, U, k: 3 });
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((p) => expect(p.channel).toBe('upstream'));
    expect(paths[0].nodes[0]).toBe('d');
    expect(paths[0].nodes[paths[0].nodes.length - 1]).toBe('a');
  });

  it('returns an empty array for unrelated or identical stages', () => {
    const { OUT, IN, D, U } = setupDia();
    expect(findTopPaths({ sourceId: 'a', targetId: 'a', OUT, IN, D, U })).toEqual([]);
  });
});

describe('buildDependenceMatrices() — specificity monotonicity', () => {
  it('a higher specificity (subst score) at the supplier stage never decreases the downstream transmission coefficient', () => {
    const low = buildDependenceMatrices(stageIds, buildAdjacency(stageIds, edges).OUT, buildAdjacency(stageIds, edges).IN,
      (id) => (id === 's1' ? 1 : 5), MODEL_PRIORS);
    const high = buildDependenceMatrices(stageIds, buildAdjacency(stageIds, edges).OUT, buildAdjacency(stageIds, edges).IN,
      (id) => (id === 's1' ? 10 : 5), MODEL_PRIORS);
    expect(high.D.s2.s1).toBeGreaterThanOrEqual(low.D.s2.s1);
  });

  it('and the corresponding downstream-propagated impact never decreases either', () => {
    const build = (subst1) => {
      const { OUT, IN } = buildAdjacency(stageIds, edges);
      const { order: TOPO } = topologicalSort(stageIds, OUT);
      const REV_TOPO = [...TOPO].reverse();
      const { D, U } = buildDependenceMatrices(stageIds, OUT, IN, (id) => (id === 's1' ? subst1 : 5), MODEL_PRIORS);
      return propagateFromSource({ sourceId: 's1', magnitude: 1, channel: 'downstream', stageIds, OUT, IN, TOPO, REV_TOPO, D, U, tolerance: MODEL_PRIORS.contributionTolerance });
    };
    const low = build(1);
    const high = build(10);
    expect(high.s2).toBeGreaterThanOrEqual(low.s2);
  });
});
