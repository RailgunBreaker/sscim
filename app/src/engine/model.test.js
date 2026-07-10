import { describe, it, expect } from 'vitest';
import { buildEngine } from './index.js';
import { makeFixtureData } from './testFixture.js';

function fixtureEngine() {
  const data = makeFixtureData();
  return { data, engine: buildEngine(data) };
}

describe('buildEngine() — confidence as metadata only', () => {
  it('two otherwise-identical events differing only in confidence produce the same central magnitude', () => {
    const { engine } = fixtureEngine();
    const e = { id: 'e1', sev: 8, daysAgo: 3, stages: ['s1'], countries: ['us'] };
    const high = engine.eventCentralMagnitude({ ...e, conf: 'High' });
    const low = engine.eventCentralMagnitude({ ...e, conf: 'Low' });
    expect(high.magnitude).toBeCloseTo(low.magnitude, 12);
  });
});

describe('buildEngine() — event semantics', () => {
  it('e2 (mitigating capacity event) has a negative (mitigating) magnitude, not adverse', () => {
    const { engine, data } = fixtureEngine();
    const e2 = data.EVENTS.find((e) => e.id === 'e2');
    const { magnitude } = engine.eventCentralMagnitude(e2);
    expect(magnitude).toBeLessThan(0);
  });

  it('hazard-signal / mixed / long-term-strategic events (e3, e5, e6) are excluded from the scored operational field', () => {
    const { engine, data } = fixtureEngine();
    const onlyExcluded = data.EVENTS.filter((e) => ['e3', 'e5', 'e6'].includes(e.id));
    const field = engine.operationalField(onlyExcluded);
    // none of e3/e5/e6 are `operational: true`, so the aggregate stays at zero everywhere.
    Object.values(field).forEach((v) => expect(v).toBe(0));
  });

  it('an operational adverse event (e1) does register in the scored operational field', () => {
    const { engine, data } = fixtureEngine();
    const e1 = data.EVENTS.find((e) => e.id === 'e1');
    const field = engine.operationalField([e1]);
    expect(field.s1).toBeGreaterThan(0);
  });
});

describe('buildEngine() — bounded cumulative aggregation of simultaneous shocks', () => {
  it('adding a second adverse event affecting the same stage never decreases the combined operational impact, and stays bounded', () => {
    const { engine, data } = fixtureEngine();
    const e1 = data.EVENTS.find((e) => e.id === 'e1');
    const extraAdverse = { id: 'e4', sev: 7, daysAgo: 0, conf: 'High', stages: ['s1'], countries: ['us'] }; // e4 is adverse/downstream/operational in EVENT_ASSUMPTIONS
    const oneEvent = engine.operationalField([e1]);
    const twoEvents = engine.operationalField([e1, extraAdverse]);
    expect(Math.abs(twoEvents.s1)).toBeGreaterThanOrEqual(Math.abs(oneEvent.s1) - 1e-9);
    expect(Math.abs(twoEvents.s1)).toBeLessThanOrEqual(1);
  });
});

describe('buildEngine() — company vulnerability vs. contribution vs. criticality', () => {
  it('two companies exposed only to the same single stage have equal vulnerability regardless of market share', () => {
    const { engine, data } = fixtureEngine();
    const e1 = data.EVENTS.find((e) => e.id === 'e1');
    const field = engine.operationalField([e1]);
    const coA = data.COMPANIES.find((c) => c.id === 'coA'); // 0.6 share of s1
    const coB = data.COMPANIES.find((c) => c.id === 'coB'); // 0.2 share of s1
    expect(engine.companyVulnerability(coA, field)).toBeCloseTo(engine.companyVulnerability(coB, field), 10);
  });

  it('a larger stage share produces a larger modeled contribution at the same impact level', () => {
    const { engine, data } = fixtureEngine();
    const e1 = data.EVENTS.find((e) => e.id === 'e1');
    const field = engine.operationalField([e1]);
    const coA = data.COMPANIES.find((c) => c.id === 'coA');
    const coB = data.COMPANIES.find((c) => c.id === 'coB');
    expect(engine.companyContribution(coA, field)).toBeGreaterThan(engine.companyContribution(coB, field));
  });

  it('increasing a company\'s market share never reduces its modeled systemic criticality', () => {
    const { engine, data } = fixtureEngine();
    const smallShare = { id: 'tmp', name: 'tmp', country: 'us', stakes: { s1: 0.1 } };
    const largeShare = { id: 'tmp', name: 'tmp', country: 'us', stakes: { s1: 0.9 } };
    expect(engine.companyCriticality(largeShare).value).toBeGreaterThanOrEqual(engine.companyCriticality(smallShare).value);
  });
});

describe('buildEngine() — scenario vs. baseline chain index', () => {
  it('adding an active-scenario shock visibly changes the displayed chain index vs. baseline', () => {
    const { engine, data } = fixtureEngine();
    const baseline = data.EVENTS.filter((e) => e.id === 'e1');
    const scenarioEvent = { id: 'strait', sev: 10, daysAgo: 0, conf: 'Simulated', stages: ['s1', 's2'], countries: ['us'] };
    const active = [...baseline, scenarioEvent];
    const baselineIndex = engine.toDisplayIndex(engine.operationalIndex(engine.operationalField(baseline)));
    const activeIndex = engine.toDisplayIndex(engine.operationalIndex(engine.operationalField(active)));
    expect(activeIndex).not.toBeCloseTo(baselineIndex, 6);
  });
});

describe('buildEngine() — every score finite and within its documented range', () => {
  it('STRUCTURAL_VULNERABILITY and NETWORK_INFLUENCE are within [0,10]', () => {
    const { engine, data } = fixtureEngine();
    data.STAGES.forEach((s) => {
      expect(Number.isFinite(engine.STRUCTURAL_VULNERABILITY[s.id])).toBe(true);
      expect(engine.STRUCTURAL_VULNERABILITY[s.id]).toBeGreaterThanOrEqual(0);
      expect(engine.STRUCTURAL_VULNERABILITY[s.id]).toBeLessThanOrEqual(10);
      expect(engine.NETWORK_INFLUENCE[s.id]).toBeGreaterThanOrEqual(0);
      expect(engine.NETWORK_INFLUENCE[s.id]).toBeLessThanOrEqual(10);
    });
  });

  it('operationalField values are within [-1,1]', () => {
    const { engine, data } = fixtureEngine();
    const field = engine.operationalField(data.EVENTS);
    Object.values(field).forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it('the graph validates and the engine reports no diagnostic errors on well-formed fixture data', () => {
    const { engine } = fixtureEngine();
    expect(engine.graphValid).toBe(true);
    expect(engine.diagnostics.hasErrors).toBe(false);
  });
});
