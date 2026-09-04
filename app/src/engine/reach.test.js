/* ====================================================================
   reach.test.js — DirectFootprint vs SpilloverReach (model v7.1).

   THE v7.0 DEFECT THIS PINS SHUT. One quantity was published as "network
   influence":

       NI_s = sum_j w_j * p_{s->j}      with p_{s->s} = 1

   The j = s term contributes w_s * 1, so every stage scored at least its
   own economic weight before any propagation occurred. A large stage with
   no downstream edge at all therefore looked highly "network influential".
   In the shipped snapshot `m_ai` ranked SECOND on that measure and has no
   outgoing edge whatsoever.

   v7.1 splits it:
       DirectFootprint_s = w_s                          how big it is
       SpilloverReach_s  = sum_{j != s} w_j p_{s->j}    how much of the REST
                                                        of the chain it moves

   The structural index uses SpilloverReach. DirectFootprint is published
   separately and deliberately kept OUT of the structural score, so
   economic size is not counted twice alongside market importance.
   ==================================================================== */
import { describe, it, expect } from 'vitest';
import { buildEngine } from './index.js';
import { BASE_STRUCTURAL_WEIGHTS } from './registry.js';

/* Minimal engine over a declared graph. Values are chosen so that size and
   reach disagree, which is the whole point of the split. */
const build = (STAGES, FLOW_EDGES) => buildEngine({
  STAGES, FLOW_EDGES,
  COMPANIES: [], CUSTOMERS: {}, POLICIES: [], EVENTS: [], OWNERS: {},
  COUNTRY_NAMES: { us: 'United States' },
  computeHistory: false,
});

const stage = (id, value, over = {}) => ({
  id, name: id, x: 0, y: 0, value, nonSubstitutability: 5, market: 5, shares: { us: 1 }, ...over,
});

describe('a large TERMINAL stage has size but no reach', () => {
  /* small -> big. `big` is 9x the size of `small` and feeds nothing. */
  const STAGES = [stage('small', 10), stage('big', 90)];
  const engine = build(STAGES, [['small', 'big']]);

  it('scores zero spillover reach, because there is nothing downstream of it', () => {
    expect(engine.SPILLOVER_REACH_RAW.big).toBe(0);
  });

  it('still records its size as direct footprint', () => {
    expect(engine.DIRECT_FOOTPRINT.big).toBeCloseTo(0.9, 12);
    expect(engine.DIRECT_FOOTPRINT.small).toBeCloseTo(0.1, 12);
  });

  it('is out-ranked on reach by the small upstream stage that feeds it', () => {
    expect(engine.SPILLOVER_REACH_RAW.small).toBeGreaterThan(engine.SPILLOVER_REACH_RAW.big);
    expect(engine.NETWORK_INFLUENCE_RANK[0]).toBe('small');
  });

  /* The v7.0 measure ranked them the other way round, purely on size. */
  it('and the v7.0 measure ranked it FIRST — which is the defect', () => {
    const v70 = engine.SYSTEM_WEIGHTED_REACH_INCLUDING_SOURCE;
    expect(v70.big).toBeGreaterThan(v70.small);
    expect(v70.big).toBeCloseTo(engine.DIRECT_FOOTPRINT.big, 12); // entirely its own weight
  });
});

describe('a small UPSTREAM stage with broad downstream reach', () => {
  const STAGES = [stage('seed', 1), stage('a', 40), stage('b', 40), stage('c', 40)];
  const engine = build(STAGES, [['seed', 'a'], ['seed', 'b'], ['seed', 'c']]);

  it('out-reaches every large stage it feeds, despite being tiny', () => {
    expect(engine.DIRECT_FOOTPRINT.seed).toBeLessThan(engine.DIRECT_FOOTPRINT.a);
    expect(engine.SPILLOVER_REACH_RAW.seed).toBeGreaterThan(engine.SPILLOVER_REACH_RAW.a);
    expect(engine.NETWORK_INFLUENCE_RANK[0]).toBe('seed');
  });

  it('and takes the top structural network score', () => {
    expect(engine.NETWORK_INFLUENCE.seed).toBeCloseTo(10, 9);
  });
});

describe('an ISOLATED stage', () => {
  const STAGES = [stage('a', 50), stage('b', 50), stage('iso', 50)];
  const engine = build(STAGES, [['a', 'b']]);

  it('has exactly zero spillover reach', () => {
    expect(engine.SPILLOVER_REACH_RAW.iso).toBe(0);
  });

  it('but still has a direct footprint equal to its weight', () => {
    expect(engine.DIRECT_FOOTPRINT.iso).toBeCloseTo(engine.STAGE_WEIGHT.iso, 12);
  });

  it('contributes nothing to any other stage’s reach either', () => {
    expect(engine.SPILLOVER_REACH_RAW.a).toBeGreaterThan(0);
    const fromA = engine.propagateSignedSource('a', 1, 'downstream');
    expect(fromA.iso).toBe(0);
  });
});

/* A cyclic graph is not a DAG, so no topological order exists. The engine
   must report that rather than silently producing numbers from a partial
   traversal. */
describe('a CYCLIC graph', () => {
  const STAGES = [stage('a', 50), stage('b', 50)];
  const engine = build(STAGES, [['a', 'b'], ['b', 'a']]);

  it('is reported as invalid rather than silently scored', () => {
    expect(engine.graphValid).toBe(false);
    expect(engine.diagnostics.list.some((d) => d.level === 'error' && /cycle/i.test(d.message))).toBe(true);
  });

  it('still returns finite, bounded reach values instead of NaN', () => {
    Object.values(engine.SPILLOVER_REACH_RAW).forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    });
  });
});

/* The case that makes the split worth having: the two measures must be
   capable of ranking the same graph differently. */
describe('direct footprint and spillover reach can rank a graph differently', () => {
  const STAGES = [stage('upstream', 5), stage('mid', 20), stage('terminal', 75)];
  const engine = build(STAGES, [['upstream', 'mid'], ['mid', 'terminal']]);

  const byFootprint = Object.entries(engine.DIRECT_FOOTPRINT).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const byReach = Object.entries(engine.SPILLOVER_REACH_RAW).sort((a, b) => b[1] - a[1]).map(([k]) => k);

  /* Reach is not simply "how far upstream you sit": `mid` feeds the huge
     terminal stage directly, whereas `upstream` reaches it only through a
     second attenuating hop, so mid legitimately out-reaches upstream. What
     the split guarantees is that the biggest stage stops topping the reach
     ranking on the strength of its own size. */
  it('ranks by size one way and by reach the other', () => {
    expect(byFootprint[0]).toBe('terminal');   // biggest stage
    expect(byReach[0]).toBe('mid');            // feeds the biggest stage directly
    expect(byReach.at(-1)).toBe('terminal');   // and the biggest stage reaches nothing
    expect(byReach).not.toEqual(byFootprint);
  });

  it('and the structural score follows REACH, not size', () => {
    expect(engine.NETWORK_INFLUENCE.upstream).toBeGreaterThan(engine.NETWORK_INFLUENCE.terminal);
  });
});

describe('the structural index does not count economic size twice', () => {
  it('excludes direct footprint from the structural components entirely', () => {
    const STAGES = [stage('a', 10), stage('b', 90)];
    const engine = build(STAGES, [['a', 'b']]);
    const comp = engine.structuralComponents(STAGES[1]);
    expect(Object.keys(comp).sort()).toEqual(['geo', 'market', 'networkInfluence', 'nonSubstitutability', 'policy']);
    // The network component is reach, which is zero for this terminal stage.
    expect(comp.networkInfluence).toBe(0);
  });

  it('keeps the five structural weights summing to one', () => {
    expect(Object.values(BASE_STRUCTURAL_WEIGHTS).reduce((a, v) => a + v, 0)).toBeCloseTo(1, 12);
  });
});

describe('the v7.0 quantity is preserved for comparison, under an accurate name', () => {
  const STAGES = [stage('a', 10), stage('b', 90)];
  const engine = build(STAGES, [['a', 'b']]);

  it('equals spillover reach plus the source’s own weight, by construction', () => {
    Object.keys(engine.SPILLOVER_REACH_RAW).forEach((id) => {
      expect(engine.SYSTEM_WEIGHTED_REACH_INCLUDING_SOURCE[id])
        .toBeCloseTo(engine.SPILLOVER_REACH_RAW[id] + engine.DIRECT_FOOTPRINT[id], 12);
    });
  });

  it('is NOT what the engine publishes as network influence any more', () => {
    expect(engine.NETWORK_INFLUENCE_RAW).toBe(engine.SPILLOVER_REACH_RAW);
    expect(engine.NETWORK_INFLUENCE_RAW.b).not.toBe(engine.SYSTEM_WEIGHTED_REACH_INCLUDING_SOURCE.b);
  });
});
