/* The two properties that make the events admin screen trustworthy.

   1. Δ-if-removed is what the ENGINE says, not a restatement of severity.
      An admin deletes on that number, so it has to come from the same
      propagation the published index does.
   2. Removing a SET is not the sum of removing each one. Overlapping events
      saturate through the noisy-OR (engine/math.js combineSigned), which is
      exactly why a cluster of near-duplicate records each looks harmless on
      its own — and why the admin screen previews a multi-select as a set.

   Built on the engine fixture with a synthetic event set, so these assert the
   arithmetic rather than whatever happens to be in the vault today. Event ids
   are real ones from EVENT_ASSUMPTIONS because operationalField() skips any
   event whose assumption is not operational — an invented id would silently
   score nothing and make every assertion below vacuously true. */
import { describe, it, expect } from 'vitest';
import { buildEngine } from '../engine/index.js';
import { makeFixtureData } from '../engine/testFixture.js';
import { getEventAssumption } from '../engine/event-assumptions.js';

const fixture = makeFixtureData();

// Four operational/adverse ids, used as a stand-in duplicate cluster.
const CLUSTER = ['p260729_web6934', 'p260728_usgtgb9', 'p260729_web1ae0', 'p260729_web3084'];
const ADVERSE = 'e1';
const MITIGATING = 'e2';

const event = (id, { daysAgo = 0, sev = 7 } = {}) => ({
  id, title: id, sev, daysAgo, date: 'Aug 20', conf: 'High', type: 'Natural Disaster',
  summary: 's', first: 'f', second: 's', watch: 'w', stages: ['s1'], countries: ['us'],
});

const engineWith = (EVENTS) => buildEngine({
  STAGES: fixture.STAGES, FLOW_EDGES: fixture.FLOW_EDGES, COMPANIES: fixture.COMPANIES,
  CUSTOMERS: fixture.CUSTOMERS, POLICIES: fixture.POLICIES, OWNERS: fixture.OWNERS,
  EVENTS, datasetAsOf: '2026-08-22',
});

describe('the fixture ids this file depends on', () => {
  it('are all operational, or the assertions below would be meaningless', () => {
    for (const id of [...CLUSTER, ADVERSE]) {
      expect(getEventAssumption(id).operational, `${id} must be operational`).toBe(true);
    }
    expect(getEventAssumption(MITIGATING).direction).toBe('mitigating');
  });
});

describe('removal impact', () => {
  it('reports the index the engine produces without the event, not the severity', () => {
    const events = [event(ADVERSE, { sev: 8 }), event(CLUSTER[0], { daysAgo: 40, sev: 5 })];
    const engine = engineWith(events);
    const current = engine.chainIndexAt(0);
    const without = engine.indexOf(events.filter((e) => e.id !== ADVERSE), 0);

    expect(current).not.toBeCloseTo(without, 6);
    // A movement on the 0-10 index scale, not the severity in disguise.
    expect(Math.abs(current - without)).toBeLessThan(8);
  });

  /* The load-bearing one: each member of a duplicate cluster looks small only
     while the others hold the index up. */
  it('combined removal exceeds the sum of the individual deltas when events overlap', () => {
    const cluster = CLUSTER.map((id) => event(id, { daysAgo: 3, sev: 7 }));
    const engine = engineWith(cluster);
    const current = engine.chainIndexAt(0);

    const sumOfIndividual = cluster.reduce(
      (total, e) => total + (current - engine.indexOf(cluster.filter((x) => x.id !== e.id), 0)),
      0,
    );
    const combined = current - engine.indexOf([], 0);

    expect(combined).toBeGreaterThan(0);
    expect(combined).toBeGreaterThan(sumOfIndividual);
  });

  it('a scored event old enough to have decayed moves today’s index by nothing', () => {
    const events = [event(ADVERSE, { daysAgo: 1, sev: 7 }), event(CLUSTER[0], { daysAgo: 4000, sev: 9 })];
    const engine = engineWith(events);
    const current = engine.chainIndexAt(0);
    const withoutAncient = engine.indexOf(events.filter((e) => e.id !== CLUSTER[0]), 0);

    // Severity 9 beats severity 7; decay has still taken it out of the reading.
    expect(current - withoutAncient).toBeCloseTo(0, 6);
  });

  it('removing a mitigating event raises the index instead of lowering it', () => {
    const adverse = event(ADVERSE, { daysAgo: 2, sev: 8 });
    const events = [adverse, event(MITIGATING, { daysAgo: 2, sev: 6 })];
    const engine = engineWith(events);

    expect(engine.indexOf([adverse], 0)).toBeGreaterThan(engine.chainIndexAt(0));
  });
});
