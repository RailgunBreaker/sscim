/* ====================================================================
   aggregates.test.js — the corrected aggregate constructs (spec §6):
   country measures, stage weights, policy families, relative scores, and
   the removal of the v6 country double count.
   ==================================================================== */
import { describe, it, expect } from 'vitest';
import { buildEngine } from './index.js';
import { makeFixtureData } from './testFixture.js';
import { policyExposure, buildPolicyFamilies, policyFamilyOf } from './policy.js';
import { resolveParams, BASE_STRUCTURAL_WEIGHTS, MODEL_FORMS } from './registry.js';
import { hhiBounds } from './math.js';

const build = (over = {}) => {
  const data = { ...makeFixtureData(), ...over };
  return { data, engine: buildEngine(data) };
};

describe('stage economic weights', () => {
  it('sum to exactly one, so the headline index is a plain weighted mean', () => {
    const { engine } = build();
    expect(Object.values(engine.STAGE_WEIGHT).reduce((a, v) => a + v, 0)).toBeCloseTo(1, 12);
  });

  it('make the headline index a convex combination of the stage field — inside its range', () => {
    const { engine, data } = build();
    const field = { s1: 0.8, s2: 0.4, s3: 0.2, s4: 0.1, s5: 0, siso: 0 };
    const idx = engine.operationalIndex(field);
    expect(idx).toBeLessThanOrEqual(Math.max(...Object.values(field)));
    expect(idx).toBeGreaterThanOrEqual(Math.min(...Object.values(field)));
    void data;
  });

  it('offer the declared weighting modes as sensitivity alternatives', () => {
    expect(MODEL_FORMS.stageWeighting.options).toContain('equal');
    expect(MODEL_FORMS.stageWeighting.options).toContain('log_turnover');
    const { data } = build();
    const equal = buildEngine({ ...data, params: { stageWeighting: 'equal' } });
    const n = data.STAGES.length;
    Object.values(equal.STAGE_WEIGHT).forEach((w) => expect(w).toBeCloseTo(1 / n, 12));
  });
});

/* ==================================================================
   COUNTRY MEASURES. v6 published one number that mixed a normalized
   average with a raw per-event signal, and combined a country-tagged
   event's own magnitude on top of the same event's stage field — so an
   event counted twice for any country it was both tagged to and hosted
   stages for. v7 publishes two clearly separated measures and no direct
   signal at all.
   ================================================================== */
describe('country measures', () => {
  it('publishes local pressure and chain contribution as distinct numbers', () => {
    const { engine, data } = build();
    const field = engine.operationalField(data.EVENTS);
    const countries = engine.countryData(data.EVENTS, field, data.COUNTRY_NAMES);
    Object.values(countries).forEach((c) => {
      expect(typeof c.localPressure).toBe('number');
      expect(typeof c.chainContribution).toBe('number');
      expect(c.operational).toBe(c.localPressure); // documented compatibility alias
    });
  });

  it('local pressure is normalized over the country’s own modeled stage footprint', () => {
    const { engine, data } = build();
    const field = Object.fromEntries(data.STAGES.map((s) => [s.id, 0.5]));
    const countries = engine.countryData(data.EVENTS, field, data.COUNTRY_NAMES);
    // Every stage at 0.5 -> every country's share-weighted mean is 0.5,
    // regardless of how much of the chain that country holds.
    Object.values(countries).forEach((c) => expect(c.localPressure).toBeCloseTo(0.5, 12));
  });

  it('chain contributions RECONCILE to the headline field when country shares sum to one', () => {
    const { engine, data } = build(); // fixture shares are exactly {us:1} or {cn:1}
    const field = engine.operationalField(data.EVENTS);
    const countries = engine.countryData(data.EVENTS, field, data.COUNTRY_NAMES);
    const totalChain = Object.values(countries).reduce((a, c) => a + c.chainContribution, 0);
    expect(totalChain).toBeCloseTo(engine.operationalIndex(field), 12);
  });

  /* THE v6 DOUBLE COUNT, stated as a test. An event tagged to a country
     AND to a stage that country hosts must enter that country's reading
     exactly once — through the stage field. */
  it('counts an incident once for a country that is both tagged and hosts the stage', () => {
    const { engine, data } = build();
    const tagged = { id: 'e1', sev: 8, daysAgo: 0, stages: ['s1'], countries: ['us'] };
    const untagged = { ...tagged, countries: [] };
    const withTag = engine.countryData([tagged], engine.operationalField([tagged]), data.COUNTRY_NAMES);
    const withoutTag = engine.countryData([untagged], engine.operationalField([untagged]), data.COUNTRY_NAMES);
    // The country tag is display metadata; it must not add source mass.
    expect(withTag.us.localPressure).toBeCloseTo(withoutTag.us.localPressure, 12);
    expect(withTag.us.chainContribution).toBeCloseTo(withoutTag.us.chainContribution, 12);
  });

  it('a country hosting no stage share is absent, not zero-scored', () => {
    const { engine, data } = build();
    const countries = engine.countryData(data.EVENTS, engine.operationalField(data.EVENTS), { ...data.COUNTRY_NAMES, xx: 'Nowhere' });
    expect(countries.xx).toBeUndefined();
  });
});

/* ==================================================================
   RELATIVE SCORES. A maximum-normalized score orders things inside one
   snapshot and nothing else. The raw value must be published beside it.
   ================================================================== */
describe('snapshot-relative scores are published beside their raw values', () => {
  it('network influence exposes the raw measure separately from the 0-10 score', () => {
    const { engine } = build();
    expect(engine.NETWORK_INFLUENCE_RAW).toBeTruthy();
    expect(engine.NETWORK_INFLUENCE_SNAPSHOT_RELATIVE).toBeTruthy();
    const top = engine.NETWORK_INFLUENCE_RANK[0];
    expect(engine.NETWORK_INFLUENCE_SNAPSHOT_RELATIVE[top]).toBeCloseTo(10, 9);
    // The raw value is NOT pinned to the top of a 0-10 scale.
    expect(engine.NETWORK_INFLUENCE_RAW[top]).toBeLessThan(10);
  });

  it('the relative score preserves the raw ordering exactly', () => {
    const { engine } = build();
    const byRaw = [...engine.NETWORK_INFLUENCE_RANK];
    const byScore = [...byRaw].sort((a, b) =>
      engine.NETWORK_INFLUENCE_SNAPSHOT_RELATIVE[b] - engine.NETWORK_INFLUENCE_SNAPSHOT_RELATIVE[a] || (a < b ? -1 : 1));
    expect(byScore).toEqual(byRaw);
  });

  it('company criticality exposes its raw value and flags the score as snapshot-relative', () => {
    const { engine, data } = build();
    const c = data.COMPANIES[0];
    const r = engine.companyCriticality(c);
    expect(r.snapshotRelative).toBe(true);
    expect(r.raw).toBeCloseTo(engine.COMPANY_CRITICALITY_RAW[c.id], 12);
    expect(r.value).toBeCloseTo(10 * r.raw / engine.MAX_CRITICALITY_RAW, 9);
  });

  /* THE v6 DEFECT: criticality propagated across the topology and then
     weighted the result by NETWORK_INFLUENCE, which is itself a
     propagation-derived reachability measure — topology applied twice. */
  it('company criticality applies topology exactly once — it does not weight by network influence', () => {
    const { engine, data } = build();
    const c = data.COMPANIES.find((x) => x.id === 'coA');
    const { field } = engine.companyCriticalityRaw(c);
    const stageIds = data.STAGES.map((s) => s.id);
    const byEconomic = (() => {
      let num = 0, den = 0;
      stageIds.forEach((id) => { const w = engine.STAGE_WEIGHT[id] ?? 0; num += Math.max(0, field[id]) * w; den += w; });
      return den ? num / den : 0;
    })();
    const byNetworkInfluence = (() => {
      let num = 0, den = 0;
      stageIds.forEach((id) => { const w = engine.NETWORK_INFLUENCE[id] ?? 0; num += Math.max(0, field[id]) * w; den += w; });
      return den ? num / den : 0;
    })();
    expect(engine.COMPANY_CRITICALITY_RAW.coA).toBeCloseTo(byEconomic, 12);
    expect(engine.COMPANY_CRITICALITY_RAW.coA).not.toBeCloseTo(byNetworkInfluence, 6);
  });

  it('a larger within-stage share never reduces criticality', () => {
    const { engine } = build();
    const small = engine.companyCriticalityRaw({ stakes: { s1: 0.2 } }).raw;
    const large = engine.companyCriticalityRaw({ stakes: { s1: 0.9 } }).raw;
    expect(large).toBeGreaterThanOrEqual(small);
  });
});

/* ==================================================================
   GEOGRAPHIC CONCENTRATION BOUNDS.
   ================================================================== */
describe('geographic concentration is published as an interval', () => {
  it('the engine exposes both bounds per stage, upper as the conservative base', () => {
    const { engine, data } = build({
      STAGES: makeFixtureData().STAGES.map((s) => (s.id === 's1' ? { ...s, shares: { us: 0.5, cn: 0.25 } } : s)),
    });
    const b = engine.GEO_BOUNDS.s1;
    expect(b.lower).toBeCloseTo(0.3125, 12);
    expect(b.upper).toBeCloseTo(0.375, 12);
    expect(engine.GEO_CONCENTRATION.s1).toBeCloseTo(b.upperScore10, 12);
    void data;
  });

  it('selecting the lower bound as the model form changes the published score', () => {
    const base = makeFixtureData();
    const STAGES = base.STAGES.map((s) => (s.id === 's1' ? { ...s, shares: { us: 0.5, cn: 0.25 } } : s));
    const upper = buildEngine({ ...base, STAGES });
    const lower = buildEngine({ ...base, STAGES, params: { hhiResidual: 'lower' } });
    expect(lower.GEO_CONCENTRATION.s1).toBeCloseTo(3.125, 12);
    expect(upper.GEO_CONCENTRATION.s1).toBeCloseTo(3.75, 12);
    expect(lower.GEO_CONCENTRATION.s1).toBeLessThan(upper.GEO_CONCENTRATION.s1);
  });

  it('the true HHI of any completion of the observed shares lies between the bounds', () => {
    const observed = { a: 0.5, b: 0.2 };
    const { lower, upper, residual } = hhiBounds(observed);
    // Split the residual into m equal undisclosed holders, for every m.
    for (let m = 1; m <= 20; m++) {
      const hhi = 0.25 + 0.04 + m * (residual / m) ** 2;
      expect(hhi).toBeGreaterThanOrEqual(lower - 1e-12);
      expect(hhi).toBeLessThanOrEqual(upper + 1e-12);
    }
  });
});

/* ==================================================================
   POLICY FAMILIES. v6's record-count-driven saturation rose whenever the
   same control was filed twice.
   ================================================================== */
describe('policy exposure is family-deduplicated and bounded', () => {
  const policies = [
    { id: 'bis', name: 'BIS controls', sev: 9, stages: ['s1'] },
    { id: 'meti', name: 'METI controls', sev: 6, stages: ['s1', 's2'] },
  ];

  it('resolves revision suffixes to a stable family', () => {
    expect(policyFamilyOf({ id: 'bis-r2' })).toBe('bis');
    expect(policyFamilyOf({ id: 'bis_rev3' })).toBe('bis');
    expect(policyFamilyOf({ id: 'bis.v2' })).toBe('bis');
    expect(policyFamilyOf({ id: 'bis_2024' })).toBe('bis');
    expect(policyFamilyOf({ id: 'bis' })).toBe('bis');
    expect(policyFamilyOf({ id: 'anything', family: 'explicit' })).toBe('explicit');
  });

  it('a duplicate REPORT of the same policy does not raise the score', () => {
    const once = policyExposure(['s1', 's2'], policies);
    const twice = policyExposure(['s1', 's2'], [...policies, { ...policies[0], id: 'bis' }]);
    expect(twice.scores).toEqual(once.scores);
    expect(twice.duplicateRecords).toBe(1);
  });

  it('a REVISION of the same policy does not raise the score', () => {
    const once = policyExposure(['s1', 's2'], policies);
    const revised = policyExposure(['s1', 's2'], [...policies, { id: 'bis-r2', name: 'BIS controls (revised)', sev: 9, stages: ['s1'] }]);
    expect(revised.scores).toEqual(once.scores);
  });

  it('a WEAKER revision does not lower the score either — the strongest reading stands', () => {
    const once = policyExposure(['s1'], policies);
    const weaker = policyExposure(['s1'], [...policies, { id: 'bis_rev4', sev: 2, stages: ['s1'] }]);
    expect(weaker.scores.s1).toBeCloseTo(once.scores.s1, 12);
  });

  it('a genuinely NEW family does raise the score, and it stays bounded by 10', () => {
    const once = policyExposure(['s1'], policies);
    const more = policyExposure(['s1'], [...policies, { id: 'newfam', sev: 8, stages: ['s1'] }]);
    expect(more.scores.s1).toBeGreaterThan(once.scores.s1);
    const many = policyExposure(['s1'], Array.from({ length: 30 }, (_, i) => ({ id: `f${i}`, sev: 9, stages: ['s1'] })));
    expect(many.scores.s1).toBeLessThanOrEqual(10);
  });

  it.each(MODEL_FORMS.policyAggregator.options)('%s is bounded by 10 and duplicate-invariant', (form) => {
    const once = policyExposure(['s1'], policies, form);
    const twice = policyExposure(['s1'], [...policies, { ...policies[0] }], form);
    expect(twice.scores.s1).toBeCloseTo(once.scores.s1, 12);
    expect(once.scores.s1).toBeLessThanOrEqual(10);
  });

  it('collapses the register into families and reports the counts', () => {
    const r = buildPolicyFamilies([...policies, { id: 'bis-r2', sev: 4, stages: ['s3'] }]);
    expect(r.families).toHaveLength(2);
    expect(r.duplicateRecords).toBe(1);
    const bis = r.families.find((f) => f.family === 'bis');
    expect(bis.sev).toBe(9);              // strongest within the family
    expect(bis.stages).toEqual(['s1', 's3']); // union of the family's scope
  });
});

describe('structural weights', () => {
  it('use the registry’s normalized vector, which sums to one and drops the unread v6 shock term', () => {
    const { engine } = build();
    expect(engine.STRUCTURAL_WEIGHTS).toEqual(BASE_STRUCTURAL_WEIGHTS);
    expect(Object.values(engine.STRUCTURAL_WEIGHTS).reduce((a, v) => a + v, 0)).toBeCloseTo(1, 12);
    expect(engine.STRUCTURAL_WEIGHTS.shock).toBeUndefined();
    expect(engine.STRUCTURAL_WEIGHTS.networkInfluence).toBeCloseTo(0.2777778, 6);
    expect(engine.STRUCTURAL_WEIGHTS.geo).toBeCloseTo(0.2222222, 6);
    expect(engine.STRUCTURAL_WEIGHTS.policy).toBeCloseTo(0.2222222, 6);
    expect(engine.STRUCTURAL_WEIGHTS.nonSubstitutability).toBeCloseTo(0.1666667, 6);
    expect(engine.STRUCTURAL_WEIGHTS.market).toBeCloseTo(0.1111111, 6);
  });

  it('name the component non-substitutability, not "subst"', () => {
    const { engine, data } = build();
    const comp = engine.structuralComponents(data.STAGES[0]);
    expect(comp).toHaveProperty('nonSubstitutability');
    expect(comp).not.toHaveProperty('subst');
  });

  it('renormalize to one after any +/-25% perturbation of a raw weight', () => {
    const p = resolveParams({ structuralWeightsRaw: { geo: 0.25 } });
    expect(Object.values(p.structuralWeights).reduce((a, v) => a + v, 0)).toBeCloseTo(1, 12);
    expect(p.structuralWeights.geo).toBeGreaterThan(BASE_STRUCTURAL_WEIGHTS.geo);
  });
});
