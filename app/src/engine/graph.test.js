import { describe, it, expect } from 'vitest';
import { buildAdjacency, buildDependenceMatrices, propagateFromSource } from './graph.js';
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
