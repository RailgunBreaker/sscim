import { describe, it, expect } from 'vitest';
import {
  buildAdjacency, buildEdgeAllocations, buildDependencyMatrices,
  propagateVector, propagateSignedVector, traceSignedVector, findTopPaths,
} from './propagation.js';
import { topologicalSort } from './math.js';
import { BASE_PARAMS, PARAMETERS, resolveParams } from './registry.js';

const stageIds = ['s1', 's2', 's3', 's4', 's5', 'siso'];
const edges = [['s1', 's2'], ['s2', 's3'], ['s3', 's4'], ['s4', 's5']];

function setup(nonSub = () => 5, params = BASE_PARAMS, ids = stageIds, es = edges) {
  const { OUT, IN } = buildAdjacency(ids, es);
  const { order: TOPO } = topologicalSort(ids, OUT);
  const REV_TOPO = [...TOPO].reverse();
  const allocations = buildEdgeAllocations(ids, OUT, IN, es);
  const { D, U } = buildDependencyMatrices(ids, OUT, IN, nonSub, params, allocations);
  return { OUT, IN, TOPO, REV_TOPO, D, U, allocations, stageIds: ids };
}

const run = (z, channel = 'both', s = setup()) =>
  propagateSignedVector({ z, channel, ...s });

/* ==================================================================
   The contraction guarantees. These are what make the v7 propagation
   finite and bounded on any DAG with no truncation tolerance at all.
   ================================================================== */
describe('dependency matrices — the bounds that make propagation a contraction', () => {
  it('the incoming downstream coefficients at every node total at most f_d, which is strictly below 1', () => {
    const { D, IN } = setup(() => 10); // maximum non-substitutability = the worst case for the bound
    expect(BASE_PARAMS.downstreamTransmission).toBeLessThan(1);
    stageIds.forEach((b) => {
      const total = (IN[b] || []).reduce((s, a) => s + (D[b][a] ?? 0), 0);
      expect(total).toBeLessThanOrEqual(BASE_PARAMS.downstreamTransmission + 1e-12);
    });
  });

  it('the outgoing upstream coefficients at every node total at most f_u, which is strictly below 1', () => {
    const { U, OUT } = setup();
    expect(BASE_PARAMS.upstreamTransmission).toBeLessThan(1);
    stageIds.forEach((a) => {
      const total = (OUT[a] || []).reduce((s, b) => s + (U[a][b] ?? 0), 0);
      expect(total).toBeLessThanOrEqual(BASE_PARAMS.upstreamTransmission + 1e-12);
    });
  });

  it('holds at the high end of both transmission ranges too', () => {
    const params = resolveParams({
      downstreamTransmission: PARAMETERS.downstreamTransmission.high,
      upstreamTransmission: PARAMETERS.upstreamTransmission.high,
    });
    const { D, U, IN, OUT } = setup(() => 10, params);
    stageIds.forEach((b) => {
      expect((IN[b] || []).reduce((s, a) => s + D[b][a], 0)).toBeLessThanOrEqual(params.downstreamTransmission + 1e-12);
    });
    stageIds.forEach((a) => {
      expect((OUT[a] || []).reduce((s, b) => s + U[a][b], 0)).toBeLessThanOrEqual(params.upstreamTransmission + 1e-12);
    });
  });

  it('a higher non-substitutability at the supplier never lowers the downstream coefficient, or the propagated impact', () => {
    const low = setup((id) => (id === 's1' ? 1 : 5));
    const high = setup((id) => (id === 's1' ? 10 : 5));
    expect(high.D.s2.s1).toBeGreaterThanOrEqual(low.D.s2.s1);
    expect(run({ s1: 1 }, 'downstream', high).field.s2)
      .toBeGreaterThanOrEqual(run({ s1: 1 }, 'downstream', low).field.s2);
  });
});

describe('buildEdgeAllocations() — normalized, with a reported fallback', () => {
  it('falls back to an equal split and reports which nodes it fell back for', () => {
    const { allocations } = setup();
    expect(allocations.fallbacks.incomingEqualSplit).toContain('s2');
    expect(allocations.fallbacks.outgoingEqualSplit).toContain('s1');
  });

  it('incoming allocations sum to exactly one at every node with inbound edges', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const es = [['a', 'd'], ['b', 'd'], ['c', 'd']];
    const { allocations, IN } = setup(() => 5, BASE_PARAMS, ids, es);
    ids.filter((n) => IN[n].length).forEach((n) => {
      expect(Object.values(allocations.q[n]).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    });
  });

  it('uses supplied evidence-based allocations, renormalizing and reporting if they do not sum to one', () => {
    const ids = ['a', 'b', 'c'];
    const es = [['a', 'c', { inShare: 3 }], ['b', 'c', { inShare: 1 }]];
    const { OUT, IN } = buildAdjacency(ids, es);
    const alloc = buildEdgeAllocations(ids, OUT, IN, es);
    expect(alloc.q.c.a).toBeCloseTo(0.75, 12);
    expect(alloc.q.c.b).toBeCloseTo(0.25, 12);
    expect(alloc.fallbacks.incomingEqualSplit).not.toContain('c');
    expect(alloc.fallbacks.renormalized.join(' ')).toMatch(/incoming allocations at "c"/);
  });
});

/* ==================================================================
   Joint propagation.
   ================================================================== */
describe('propagateVector() — joint incident propagation', () => {
  it('a downstream shock at s1 reaches s5, four hops away', () => {
    const { field } = run({ s1: 1 }, 'downstream');
    ['s2', 's3', 's4', 's5'].forEach((id) => expect(field[id]).toBeGreaterThan(0));
  });

  it('leaves a disconnected node completely unaffected', () => {
    expect(run({ s1: 1 }, 'both').field.siso).toBe(0);
  });

  it('zero exposure produces exactly zero effect everywhere', () => {
    const { field } = run({ s1: 0 }, 'both');
    Object.values(field).forEach((v) => expect(v).toBe(0));
    const { field: empty } = run({}, 'both');
    Object.values(empty).forEach((v) => expect(v).toBe(0));
  });

  it('every propagated value stays finite and within [-1,1]', () => {
    const { field } = run({ s1: 1, s3: 0.8, s5: -0.4 }, 'both');
    Object.values(field).forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('counts the direct source exactly once: a lone source keeps its own value', () => {
    const { field } = run({ s1: 0.6 }, 'both');
    expect(field.s1).toBeCloseTo(0.6, 12);
  });

  it('is order-stable: shuffling the declared stage order does not change the field', () => {
    const shuffled = ['s5', 'siso', 's3', 's1', 's4', 's2'];
    const a = run({ s1: 0.7 }, 'both');
    const b = run({ s1: 0.7 }, 'both', setup(() => 5, BASE_PARAMS, shuffled, edges));
    stageIds.forEach((id) => expect(b.field[id]).toBeCloseTo(a.field[id], 12));
  });

  it('is deterministic: repeated runs are bit-identical', () => {
    const a = run({ s1: 0.51, s3: 0.22 }, 'both').field;
    const b = run({ s1: 0.51, s3: 0.22 }, 'both').field;
    expect(a).toEqual(b);
  });

  it('is monotone in the transmission coefficients for a nonnegative fixture', () => {
    const at = (fd, fu) => run({ s1: 1 }, 'both', setup(() => 5, resolveParams({ downstreamTransmission: fd, upstreamTransmission: fu })));
    const lo = at(PARAMETERS.downstreamTransmission.low, PARAMETERS.upstreamTransmission.low).field;
    const mid = at(PARAMETERS.downstreamTransmission.base, PARAMETERS.upstreamTransmission.base).field;
    const hi = at(PARAMETERS.downstreamTransmission.high, PARAMETERS.upstreamTransmission.high).field;
    stageIds.forEach((id) => {
      expect(mid[id]).toBeGreaterThanOrEqual(lo[id] - 1e-12);
      expect(hi[id]).toBeGreaterThanOrEqual(mid[id] - 1e-12);
    });
  });

  it('is monotone in the source: a larger nonnegative source never produces a smaller field', () => {
    const small = run({ s1: 0.2 }, 'both').field;
    const large = run({ s1: 0.9 }, 'both').field;
    stageIds.forEach((id) => expect(large[id]).toBeGreaterThanOrEqual(small[id] - 1e-12));
  });
});

/* THE DEFECT THIS REPLACES: v6 combined the two arms of a reconvergent
   diamond with a noisy-OR, treating one incident arriving by two routes as
   two independent causes. v7 sums the dependency-weighted inflows. */
describe('reconvergence within one incident is not multiplied like independent causes', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const dia = [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']];
  const s = setup(() => 5, BASE_PARAMS, ids, dia);

  it('the reconvergent node equals the plain sum of its dependency-weighted inflows', () => {
    const { field } = propagateSignedVector({ z: { a: 1 }, channel: 'downstream', ...s });
    const expected = s.D.d.b * field.b + s.D.d.c * field.c;
    expect(field.d).toBeCloseTo(expected, 12);
  });

  /* v6 combined the two arms with 1-(1-x)(1-y), which differs from the sum
     by exactly the interaction term xy. That term is what an independence
     assumption buys you, and within ONE incident there is nothing for it to
     represent: both arms are the same disruption. v7 must not apply it. */
  it('does not apply the noisy-OR interaction term the v6 combination introduced', () => {
    const { field } = propagateSignedVector({ z: { a: 1 }, channel: 'downstream', ...s });
    const x = s.D.d.b * field.b;
    const y = s.D.d.c * field.c;
    const noisyOr = 1 - (1 - x) * (1 - y);
    expect(x * y).toBeGreaterThan(0);
    expect(field.d - noisyOr).toBeCloseTo(x * y, 12);
    expect(field.d).not.toBeCloseTo(noisyOr, 6);
  });

  /* Scaled up so both arms are large, the difference is unmistakable: the
     independence correction discounts a reconvergence that is not
     independent, and it does so more the larger the arms get. */
  it('the gap between the joint sum and the v6 noisy-OR grows with the size of the arms', () => {
    const small = propagateSignedVector({ z: { a: 0.1 }, channel: 'downstream', ...s }).field;
    const large = propagateSignedVector({ z: { a: 1 }, channel: 'downstream', ...s }).field;
    const gap = (f) => {
      const x = s.D.d.b * f.b; const y = s.D.d.c * f.c;
      return f.d - (1 - (1 - x) * (1 - y));
    };
    expect(gap(large)).toBeGreaterThan(gap(small));
  });
});

describe('propagateSignedVector() — adverse and mitigating are propagated separately, then netted', () => {
  it('a purely mitigating source produces a purely negative field', () => {
    const { field } = run({ s1: -0.8 }, 'downstream');
    expect(field.s1).toBeCloseTo(-0.8, 12);
    expect(field.s2).toBeLessThan(0);
  });

  it('an adverse and a mitigating source at the same stage net out symmetrically', () => {
    const a = run({ s1: 0.5 }, 'downstream').field;
    const m = run({ s1: -0.5 }, 'downstream').field;
    stageIds.forEach((id) => expect(a[id]).toBeCloseTo(-m[id], 12));
  });

  it('the adverse channel is not weakened by a mitigating source at another stage before propagation', () => {
    const mixed = run({ s1: 0.6, s5: -0.6 }, 'downstream');
    expect(mixed.adverse.s1).toBeCloseTo(0.6, 12);
    expect(mixed.mitigating.s5).toBeCloseTo(0.6, 12);
  });
});

describe('traceSignedVector() — a pure decomposition of the same field', () => {
  const ids = ['a', 'b', 'c', 'd', 'x'];
  const dia = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'd']];
  const s = setup(() => 5, BASE_PARAMS, ids, dia);
  const traced = (channel) => traceSignedVector({ z: { a: 1 }, channel, ...s });

  it.each(['downstream', 'upstream', 'both'])('enabling trace does not change the final field (%s)', (channel) => {
    const plain = propagateSignedVector({ z: { a: 1 }, channel, ...s }).field;
    expect(traced(channel).field).toEqual(plain);
  });

  it('cumulative contribution at the final step equals the returned field exactly', () => {
    const { field, trace } = traced('both');
    const final = trace[trace.length - 1].cumulativeContribution;
    ids.forEach((id) => { if (field[id]) expect(final[id]).toBe(field[id]); });
  });

  it('reveals the source alone at step 0, then each reached node exactly once', () => {
    const { trace } = traced('downstream');
    expect(trace[0].nodes).toEqual(['a']);
    const seen = trace.flatMap((step) => step.nodes);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).not.toContain('x');
  });

  it('places d on its longest contributing path (hop 3), not its shortest (hop 1)', () => {
    const { trace } = traced('downstream');
    expect(trace.find((step) => step.nodes.includes('d'))?.step).toBe(3);
  });

  it('cumulative is monotonic: every earlier value persists unchanged in later steps', () => {
    const { trace } = traced('both');
    for (let k = 1; k < trace.length; k++) {
      Object.entries(trace[k - 1].cumulativeContribution).forEach(([id, v]) => {
        expect(trace[k].cumulativeContribution[id]).toBe(v);
      });
    }
  });

  it('returns an empty trace for a zero-magnitude source', () => {
    const { field, trace } = traceSignedVector({ z: { a: 0 }, channel: 'both', ...s });
    expect(trace).toEqual([]);
    expect(field.a).toBe(0);
  });
});

describe('findTopPaths() — strongest modeled propagation routes', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const dia = [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['b', 'c']];
  const s = setup(() => 5, BASE_PARAMS, ids, dia);

  it('finds downstream routes from source to target, strongest first', () => {
    const paths = findTopPaths({ sourceId: 'a', targetId: 'd', ...s, k: 3 });
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].nodes[0]).toBe('a');
    expect(paths[0].nodes.at(-1)).toBe('d');
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i - 1].attenuation).toBeGreaterThanOrEqual(paths[i].attenuation);
    }
    paths[0].edges.forEach((e) => { expect(e.coeff).toBeGreaterThan(0); expect(e.dir).toBe('downstream'); });
  });

  it('falls back to the upstream echo direction when the target is a supplier of the source', () => {
    const paths = findTopPaths({ sourceId: 'd', targetId: 'a', ...s, k: 3 });
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((p) => expect(p.channel).toBe('upstream'));
  });

  it('returns an empty array for identical stages', () => {
    expect(findTopPaths({ sourceId: 'a', targetId: 'a', ...s })).toEqual([]);
  });
});
