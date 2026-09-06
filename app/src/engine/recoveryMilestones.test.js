import { describe, it, expect } from 'vitest';
import { persistence, persistenceByStage, profileHorizonDays } from './persistence.js';
import { incidentSourceVector } from './eventSource.js';
import { EVENT_MODEL } from './event-model.js';
import { BASE_PARAMS } from './registry.js';
import { buildEngine } from './index.js';
import { makeFixtureData } from './testFixture.js';

const base = { kind: 'outage_recovery', recoveryStartDays: 7 };
const milestone = (date, residual, extra = {}) => ({
  processStage: 'wafer_input', effectiveDate: date, publicationDate: date, informationAvailableDate: date,
  residualDisruption: residual, claimStatus: 'verified', sourceUrl: 'https://example.test/factory-update',
  supportingSection: 'Synthetic test fixture, production update paragraph 2', ...extra,
});
const component = (extra = {}) => ({
  id: 'site_a_input', stage: 's1', site: 'Synthetic Site A', processStage: 'wafer_input', exposureFraction: 1,
  exposureBasis: 'Explicit synthetic allocation, not a measured share', milestones: [], ...extra,
});
const at = (components, date = '2026-08-24', age = 27) => persistenceByStage(
  { ...base, recoveryComponents: components }, age, BASE_PARAMS, { stages: ['s1', 's2'], evaluationDate: date },
);

describe('component recovery observations', () => {
  it('overrides only the named component, preserving the unknown site fraction and other stage', () => {
    const r = at([component({ exposureFraction: 0.4, milestones: [milestone('2026-08-23', 0)] })]);
    const assumed = persistence(base, 27, BASE_PARAMS);
    expect(r.byStage.s1).toBeCloseTo(0.6 * assumed, 12);
    expect(r.byStage.s2).toBe(assumed);
    expect(r.components[0].status).toBe('observed_residual_carried_forward');
  });

  it('supports partial then complete restoration without interpolating an unobserved ramp', () => {
    const c = component({ milestones: [milestone('2026-08-10', 0.4), milestone('2026-08-23', 0)] });
    expect(at([c], '2026-08-15', 18).byStage.s1).toBe(0.4);
    expect(at([c], '2026-08-22', 25).byStage.s1).toBe(0.4);
    expect(at([c]).byStage.s1).toBe(0);
  });

  it('supports staggered sites and a different finished-output trajectory', () => {
    const cs = [
      component({ exposureFraction: 0.5, milestones: [milestone('2026-08-12', 0)] }),
      component({ id: 'site_b_input', site: 'Synthetic Site B', exposureFraction: 0.5, milestones: [milestone('2026-08-25', 0)] }),
      component({ id: 'site_a_output', stage: 's2', processStage: 'finished_output', milestones: [milestone('2026-08-30', 0, { processStage: 'finished_output' })] }),
    ];
    expect(at(cs).byStage.s1).toBeCloseTo(persistence(base, 27, BASE_PARAMS) / 2, 12);
    expect(at(cs).byStage.s2).toBe(persistence(base, 27, BASE_PARAMS));
    expect(at(cs, '2026-08-26', 29).byStage.s1).toBe(0);
    expect(at(cs, '2026-08-26', 29).byStage.s2).toBeGreaterThan(0);
    expect(at(cs, '2026-08-30', 33).byStage).toEqual({ s1: 0, s2: 0 });
  });

  it('does not infer wafer-input, finished-output or shipment completion from restart', () => {
    for (const processStage of ['wafer_input', 'finished_output', 'shipments']) {
      const c = component({ processStage, milestones: [milestone('2026-08-04', 0, { processStage: 'restart' })] });
      expect(at([c]).byStage.s1).toBe(persistence(base, 27, BASE_PARAMS));
      expect(at([c]).components[0].status).toMatch(/^assumed_profile/);
    }
  });

  it('requires both publication and information-available date before using an observation', () => {
    const c = component({ milestones: [milestone('2026-08-23', 0, { publicationDate: '2026-08-24', informationAvailableDate: '2026-08-26' })] });
    expect(at([c], '2026-08-23', 26).byStage.s1).toBeGreaterThan(0);
    expect(at([c], '2026-08-25', 28).byStage.s1).toBeGreaterThan(0);
    expect(at([c], '2026-08-26', 29).byStage.s1).toBe(0);
    const earlyAvailability = component({ milestones: [milestone('2026-08-23', 0, { publicationDate: '2026-08-26' })] });
    expect(at([earlyAvailability], '2026-08-25', 28).byStage.s1).toBeGreaterThan(0);
  });

  it.each([
    { claimStatus: 'unresolved' }, { sourceUrl: null }, { supportingSection: null },
    { informationAvailableDate: null }, { publicationDate: '2026-02-30' }, { residualDisruption: null },
  ])('missing or unverified information preserves a labeled assumption (%o)', (extra) => {
    const r = at([component({ milestones: [milestone('2026-08-23', 0, extra)] })]);
    expect(r.byStage.s1).toBe(persistence(base, 27, BASE_PARAMS));
    expect(r.components[0].status).toMatch(/^assumed_profile/);
  });

  it('does not make a missing evaluation date equivalent to permission for hindsight', () => {
    expect(at([component({ milestones: [milestone('2026-08-23', 0)] })], null).byStage.s1).toBe(persistence(base, 27, BASE_PARAMS));
  });

  it('retains a documented residual beyond the assumed completion and keeps replay from pruning it', () => {
    const c = component({ milestones: [milestone('2026-08-23', 0.2)] });
    expect(at([c], '2026-12-01', 126).byStage.s1).toBe(0.2);
    expect(profileHorizonDays({ ...base, recoveryComponents: [c] }, BASE_PARAMS)).toBe(Infinity);
  });

  it('accepts a separately labeled component profile when observations are missing', () => {
    const r = at([component({ profile: { ...base, recoveryDays: 120 } })]);
    expect(r.byStage.s1).toBeCloseTo(1 - 20 / 120, 12);
    expect(r.components[0].status).toMatch(/^assumed_profile/);
    expect(profileHorizonDays({ ...base, recoveryComponents: [component({ profile: { ...base, recoveryDays: 120 } })] }, BASE_PARAMS)).toBe(127);
  });

  it('does not normalize excessive fractions or count a duplicated component twice', () => {
    for (const cs of [[component(), component({ id: 'site_b' })], [component({ exposureFraction: 0.4 }), component({ exposureFraction: 0.4 })]]) {
      const r = at(cs);
      expect(r.byStage.s1).toBe(persistence(base, 27, BASE_PARAMS));
      expect(r.diagnostics[0].code).toBe('invalid_recovery_components');
    }
  });

  it('never activates a future incident or an explicitly unscored context profile', () => {
    const cs = [component({ milestones: [milestone('2026-08-23', 0.8)] })];
    expect(at(cs, '2026-08-24', -1).byStage.s1).toBe(0);
    expect(persistenceByStage({ kind: 'strategic_context', recoveryComponents: cs }, 30, BASE_PARAMS, { stages: ['s1'], evaluationDate: '2026-08-24' }).byStage.s1).toBe(0);
  });
});

describe('source integration and incident deduplication', () => {
  const curated = { exposure: { s1: 0.6, s2: 0.4 }, profile: { ...base, recoveryComponents: [component({ milestones: [milestone('2026-08-23', 0)] })] } };
  const event = { id: 'synthetic_quake', dateISO: '2026-07-28', daysAgo: 27, stages: ['s1', 's2'], sev: 8, incidentId: 'synthetic_quake', incidentRole: 'primary', model: curated, assumption: { operational: true, direction: 'adverse', channel: 'downstream' } };
  it('constructs source components with their own residual and preserves confidence as metadata', () => {
    const run = (conf) => incidentSourceVector({ event: { ...event, conf }, assumption: event.assumption, ageDays: 27, params: BASE_PARAMS, curated });
    const r = run('High');
    expect(r.z.s1).toBeUndefined();
    expect(r.z.s2).toBeCloseTo(0.8 * 0.4 * persistence(base, 27, BASE_PARAMS), 12);
    expect(r.z).toEqual(run('Low').z);
    expect(r.recoveryComponents[0].processStage).toBe('wafer_input');
  });

  it('recovery reports on the original incident do not create independent mitigation', () => {
    const data = makeFixtureData();
    const build = (EVENTS) => buildEngine({ ...data, EVENTS });
    const update = { ...event, id: 'synthetic_recovery', incidentRole: 'recovery', sev: 10, assumption: { ...event.assumption, direction: 'mitigating' } };
    const primary = build([event]).chainIndexAt(0);
    expect(build([event, update]).chainIndexAt(0)).toBeCloseTo(primary, 12);
    expect(build([update, event, update]).chainIndexAt(0)).toBeCloseTo(primary, 12);
  });

  it('does not promote an orphan recovery to a new shock or score it in its detail trace', () => {
    const update = { ...event, id: 'orphan_recovery', incidentRole: 'recovery', sev: 10, assumption: { ...event.assumption, direction: 'mitigating' } };
    const engine = buildEngine({ ...makeFixtureData(), EVENTS: [update] });
    expect(engine.chainIndexAt(0)).toBe(5);
    expect(engine.eventField(update).scored).toBe(false);
    expect(Object.values(engine.eventTrace(update).field).every((v) => v === 0)).toBe(true);
    expect(engine.MODEL_AUDIT.scoredIncidentCount).toBe(0);
  });

  it('chooses one stable representative when two records accidentally declare themselves primary', () => {
    const low = { ...event, id: 'primary_low', sev: 2 };
    const high = { ...event, id: 'primary_high', sev: 9 };
    const run = (EVENTS) => buildEngine({ ...makeFixtureData(), EVENTS });
    expect(run([low, high]).chainIndexAt(0)).toBe(run([high, low]).chainIndexAt(0));
    expect(run([low, high]).chainIndexAt(0)).toBe(run([high]).chainIndexAt(0));
  });

  it('Kawashiri restoration is limited to wafer input and becomes known August 24', () => {
    const profile = EVENT_MODEL.h2607_kumamoto.profile;
    const before = persistenceByStage(profile, 26, BASE_PARAMS, { stages: ['analog', 'mature_fab'], evaluationDate: '2026-08-23' });
    const after = persistenceByStage(profile, 27, BASE_PARAMS, { stages: ['analog', 'mature_fab'], evaluationDate: '2026-08-24' });
    expect(before.byStage.analog).toBeGreaterThan(0);
    expect(after.byStage.analog).toBe(0);
    expect(after.byStage.mature_fab).toBeGreaterThan(0);
    expect(after.components[0].limitations).toMatch(/Finished-chip output/);
    expect(EVENT_MODEL.h2607_kumamoto.exposureBasis).toMatch(/assumed dimensionless intensity/);
  });
});
