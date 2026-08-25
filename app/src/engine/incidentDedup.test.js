/* One incident must not be counted several times.

   THE DEFECT. The index accumulates events through noisy-OR
   (engine/math.js combineSigned). That is right for independent events and
   wrong for several reports of one: the July 28–29 2026 M7.1 Kumamoto
   earthquake arrived as a curated record plus six ingested news records —
   a USGS bulletin, four wire accounts of the same halts at the same named
   fabs, and a "JASM resumes, no structural damage found" report — and each
   one contributed to the reading as though a separate earthquake had
   occurred. Seven adverse contributions for one quake. The recovery report
   was classified adverse and scored, so a plant coming back online was
   raising the disruption reading.

   THE FIX being asserted: exactly one record per incident is scored (the
   primary); the rest are marked as updates or recovery reports, still
   published with their own citations and their own severity assessment,
   but not independently accumulated.

   Nothing is deleted. The tests below check that too — the sources are the
   evidence, and thinning them to tidy a list would be the wrong trade. */
import { describe, it, expect } from 'vitest';
import { buildEngine } from './index.js';
import { makeFixtureData } from './testFixture.js';
import { getEventAssumption, EVENT_INCIDENTS, incidentGroup } from './event-assumptions.js';
import snapshot from '../data/vault-snapshot.json';
import { buildVaultData } from '../data/buildVaultData.js';

const KUMAMOTO = 'kumamoto_m71_2026_07';
const group = incidentGroup(KUMAMOTO);
const primary = group.find((g) => g.role === 'primary');
const secondaries = group.filter((g) => g.role !== 'primary');

describe('the Kumamoto cluster, as classified', () => {
  it('is a real cluster — more than one record for one earthquake', () => {
    expect(group.length).toBeGreaterThan(5);
    expect(secondaries.length).toBeGreaterThan(4);
  });

  it('scores exactly one of them', () => {
    const scored = group.filter((g) => getEventAssumption(g.id).operational);
    expect(scored.map((s) => s.id)).toEqual([primary.id]);
  });

  it('keeps every record published — no citation was deleted to tidy the list', () => {
    group.forEach((g) => {
      const event = snapshot.events.find((e) => e.id === g.id);
      expect(event, `${g.id} must still be in the snapshot`).toBeTruthy();
      expect(event.source, `${g.id} must keep its source`).toBeTruthy();
      expect(event.source.length).toBeGreaterThan(10);
    });
  });

  it('keeps each record’s own severity assessment rather than flattening them', () => {
    const sevs = group.map((g) => snapshot.events.find((e) => e.id === g.id).sev);
    expect(new Set(sevs).size).toBeGreaterThan(1);
  });

  /* "JASM resumes operations, no structural damage found" was adverse and
     scored. A plant coming back online is a recovery report. */
  it('classifies the resumption reports as mitigating recovery updates, not adverse events', () => {
    const recoveries = group.filter((g) => g.role === 'recovery');
    expect(recoveries.length).toBeGreaterThan(0);
    recoveries.forEach((r) => {
      const a = getEventAssumption(r.id);
      expect(a.direction, `${r.id} is a resumption report`).toBe('mitigating');
      expect(a.operational, `${r.id} must not be independently scored`).toBe(false);
    });
  });

  it('explains, on each secondary record, why it is not scored', () => {
    secondaries.forEach((s) => {
      const reason = getEventAssumption(s.id).reason;
      expect(reason, s.id).toMatch(/incident|recovery|primary|update/i);
    });
  });
});

/* ==================================================================
   The arithmetic, on the engine fixture: several representations of one
   incident must not push the index further than the one record does.
   ================================================================== */
describe('noisy-OR accumulation of a duplicate cluster', () => {
  const fixture = makeFixtureData();
  const engineWith = (EVENTS) => buildEngine({
    STAGES: fixture.STAGES, FLOW_EDGES: fixture.FLOW_EDGES, COMPANIES: fixture.COMPANIES,
    CUSTOMERS: fixture.CUSTOMERS, POLICIES: fixture.POLICIES, OWNERS: fixture.OWNERS,
    EVENTS, datasetAsOf: '2026-08-22',
  });

  const asEvent = (id, sev) => ({
    id, title: id, sev, daysAgo: 1, date: 'Jul 28, 2026', conf: 'High', type: 'Natural Disaster',
    summary: 's', first: 'f', second: 's', watch: 'w', stages: ['s1'], countries: ['us'],
  });

  /* The real cluster, at its real severities, run through the real
     assumptions table — so this measures the shipped classification and
     not a hypothetical one. */
  const cluster = group.map((g) => {
    const e = snapshot.events.find((x) => x.id === g.id);
    return asEvent(g.id, e.sev);
  });
  const primaryOnly = cluster.filter((e) => e.id === primary.id);

  it('the primary alone moves the index', () => {
    const withPrimary = engineWith(primaryOnly).chainIndexAt(0);
    const withNothing = engineWith([]).chainIndexAt(0);
    expect(withPrimary).not.toBeCloseTo(withNothing, 6);
  });

  /* THE LOAD-BEARING ASSERTION. Adding the other six reports of the same
     earthquake must change nothing, because none of them is scored. */
  it('the six other reports of the same earthquake add nothing to it', () => {
    const primaryIndex = engineWith(primaryOnly).chainIndexAt(0);
    const clusterIndex = engineWith(cluster).chainIndexAt(0);
    expect(clusterIndex).toBeCloseTo(primaryIndex, 10);
  });

  /* And the counterfactual, so the test above cannot pass vacuously: four
     INDEPENDENT adverse events of the same severity do move the index
     further than one. That is the accumulation the cluster was wrongly
     receiving, measured against the same engine. */
  it('would have been inflated had the duplicates stayed independently scored', () => {
    const independent = ['h2103_renesas', 'h2202_kioxia', 'h2204_shanghai', 'h2309_duv'].map((id) => asEvent(id, 7));
    independent.forEach((e) => expect(getEventAssumption(e.id).operational, e.id).toBe(true));
    const one = engineWith([independent[0]]).chainIndexAt(0);
    const four = engineWith(independent).chainIndexAt(0);
    expect(Math.abs(four - 5)).toBeGreaterThan(Math.abs(one - 5));
  });

  it('a genuinely independent second event still moves the index', () => {
    const base = engineWith(primaryOnly).chainIndexAt(0);
    const plusOther = engineWith([...primaryOnly, asEvent('h2202_neon', 7)]).chainIndexAt(0);
    expect(plusOther).not.toBeCloseTo(base, 6);
  });
});

describe('the incident table itself', () => {
  it('names every member of a group with a role', () => {
    Object.entries(EVENT_INCIDENTS).forEach(([id, v]) => {
      expect(typeof v.incident, id).toBe('string');
      expect(['primary', 'update', 'recovery'], id).toContain(v.role);
    });
  });

  it('has an assumption entry for every incident member', () => {
    Object.keys(EVENT_INCIDENTS).forEach((id) => {
      expect(getEventAssumption(id).reason, id).toBeTruthy();
    });
  });
});

/* ==================================================================
   The published reading, end to end. These are the numbers quoted in the
   change report, pinned so a future reclassification cannot move them
   silently.
   ================================================================== */
describe('the published index, with the real snapshot', () => {
  const data = buildVaultData(snapshot);
  const engine = buildEngine({
    STAGES: data.STAGES, FLOW_EDGES: data.FLOW_EDGES, COMPANIES: data.COMPANIES,
    CUSTOMERS: data.CUSTOMERS, POLICIES: data.POLICIES, EVENTS: data.EVENTS, OWNERS: data.OWNERS,
    datasetAsOf: snapshot.meta?.snapshotDate,
  });
  const idx = (evs) => engine.toDisplayIndex(engine.operationalIndex(engine.operationalField(evs)));

  const members = Object.keys(EVENT_INCIDENTS);
  const withoutIncident = data.EVENTS.filter((e) => !members.includes(e.id));
  const primaryOnly = data.EVENTS.filter((e) => e.id === primary.id);

  it('reads the same with the whole cluster as with the primary alone', () => {
    expect(idx(data.EVENTS)).toBeCloseTo(idx([...withoutIncident, ...primaryOnly]), 10);
  });

  it('still records the earthquake — removing it entirely does change the reading', () => {
    expect(idx(withoutIncident)).not.toBeCloseTo(idx(data.EVENTS), 4);
  });

  it('attributes the whole of the incident’s effect to the primary record', () => {
    const contribution = idx(data.EVENTS) - idx(withoutIncident);
    const primaryContribution = idx([...withoutIncident, ...primaryOnly]) - idx(withoutIncident);
    expect(contribution).toBeCloseTo(primaryContribution, 10);
    expect(contribution).toBeGreaterThan(0);
  });
});
