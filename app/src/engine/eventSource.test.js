/* ====================================================================
   eventSource.test.js — the rules that turn records into source mass.

   Every test here pins a defect that v6 actually had, or a rule the v7
   specification states in §2 and §6.
   ==================================================================== */
import { describe, it, expect } from 'vitest';
import {
  groupIncidents, stageExposure, incidentSourceVector, uniqueStages, UNSCORED_REASONS,
} from './eventSource.js';
import { BASE_PARAMS, PARAMETERS, resolveParams } from './registry.js';
import { severityIntensity } from './severity.js';
import { buildEngine } from './index.js';
import { makeFixtureData } from './testFixture.js';

const P = BASE_PARAMS;
const adverse = { direction: 'adverse', channel: 'downstream', operational: true };
const mitigating = { direction: 'mitigating', channel: 'downstream', operational: true };

const rec = (over = {}) => ({ id: 'r1', sev: 8, daysAgo: 0, stages: ['s1'], countries: ['us'], ...over });
const sum = (z) => Object.values(z).reduce((a, v) => a + Math.abs(v), 0);

describe('uniqueStages() — a stage listed twice is one stage', () => {
  it('deduplicates while preserving order', () => {
    expect(uniqueStages({ stages: ['a', 'b', 'a', 'c', 'b'] })).toEqual(['a', 'b', 'c']);
  });
  it('ignores non-string tags rather than propagating through them', () => {
    expect(uniqueStages({ stages: ['a', null, 7, 'a'] })).toEqual(['a']);
  });
});

describe('duplicate stage tags cannot change any number', () => {
  it('produces an identical source vector with and without the duplicates', () => {
    const clean = incidentSourceVector({ event: rec({ stages: ['s1', 's2'] }), assumption: adverse, ageDays: 0, params: P, curated: null });
    const dirty = incidentSourceVector({ event: rec({ stages: ['s1', 's2', 's1', 's2', 's2'] }), assumption: adverse, ageDays: 0, params: P, curated: null });
    expect(dirty.z).toEqual(clean.z);
    expect(dirty.diagnostics.some((d) => d.code === 'duplicate_stage_tags')).toBe(true);
  });
});

describe('the legacy 1/k stage-exposure fallback', () => {
  it('allocates exactly one unit of exposure, whatever k is', () => {
    for (const k of [1, 2, 3, 5, 9]) {
      const stages = Array.from({ length: k }, (_, i) => `s${i}`);
      const { exposure, source } = stageExposure({ stages }, null);
      expect(source).toBe('legacy_equal_split');
      expect(Object.values(exposure).reduce((a, v) => a + v, 0)).toBeCloseTo(1, 12);
    }
  });

  /* THE v6 DEFECT. v6 injected the FULL severity into every tagged stage,
     so splitting one scope into two, or tagging the same incident more
     thoroughly, multiplied its source mass. Under v7 it redistributes it. */
  it('splitting a legacy scope in two does not create source mass', () => {
    const one = incidentSourceVector({ event: rec({ stages: ['s1'] }), assumption: adverse, ageDays: 0, params: P, curated: null });
    const two = incidentSourceVector({ event: rec({ stages: ['s1', 's2'] }), assumption: adverse, ageDays: 0, params: P, curated: null });
    const four = incidentSourceVector({ event: rec({ stages: ['s1', 's2', 's3', 's4'] }), assumption: adverse, ageDays: 0, params: P, curated: null });
    expect(sum(two.z)).toBeCloseTo(sum(one.z), 12);
    expect(sum(four.z)).toBeCloseTo(sum(one.z), 12);
  });

  it('duplicating a legacy scope does not create source mass either', () => {
    const plain = incidentSourceVector({ event: rec({ stages: ['s1', 's2'] }), assumption: adverse, ageDays: 0, params: P, curated: null });
    const dup = incidentSourceVector({ event: rec({ stages: ['s1', 's2', 's1', 's2'] }), assumption: adverse, ageDays: 0, params: P, curated: null });
    expect(sum(dup.z)).toBeCloseTo(sum(plain.z), 12);
  });
});

describe('curated stage exposure', () => {
  const curated = {
    exposure: { s1: 0.9, s2: 0.4 },
    exposureBasis: 'test basis',
    profile: { kind: 'acute_exponential' },
    profileBasis: 'test basis',
  };

  it('uses the curated vector, and reports that it did', () => {
    const r = incidentSourceVector({ event: rec({ stages: ['s1', 's2'] }), assumption: adverse, ageDays: 0, params: P, curated });
    expect(r.exposureSource).toBe('curated');
    expect(r.exposureBasis).toBe('test basis');
    expect(r.z.s1).toBeCloseTo(severityIntensity(8, 'linear') * 0.9, 12);
    expect(r.z.s2).toBeCloseTo(severityIntensity(8, 'linear') * 0.4, 12);
    expect(r.diagnostics.some((d) => d.code === 'legacy_equal_stage_exposure')).toBe(false);
  });

  it('drops — and reports — a curated stage the record does not carry', () => {
    const r = incidentSourceVector({ event: rec({ stages: ['s1'] }), assumption: adverse, ageDays: 0, params: P, curated });
    expect(Object.keys(r.z)).toEqual(['s1']);
    expect(r.diagnostics.some((d) => d.code === 'curated_exposure_orphan_stage')).toBe(true);
  });

  it('falls back, loudly, when the curation and the record share no stage at all', () => {
    const r = incidentSourceVector({ event: rec({ stages: ['zz'] }), assumption: adverse, ageDays: 0, params: P, curated });
    expect(r.exposureSource).toBe('curated_stage_mismatch');
    expect(r.diagnostics.some((d) => d.code === 'curated_exposure_stage_mismatch')).toBe(true);
    expect(sum(r.z)).toBeCloseTo(severityIntensity(8, 'linear'), 12);
  });
});

describe('direction — an unknown direction is never treated as adverse', () => {
  it.each(['mixed', 'unclassified', 'unknown', undefined])('%s produces no scalar field without a signed decomposition', (direction) => {
    const r = incidentSourceVector({
      event: rec(), assumption: { direction, channel: 'downstream', operational: true }, ageDays: 0, params: P, curated: null,
    });
    expect(r.scored).toBe(false);
    expect(r.unscoredReason).toBe(UNSCORED_REASONS.UNKNOWN_DIRECTION);
    expect(r.z).toEqual({});
    expect(r.diagnostics.some((d) => d.code === 'unknown_direction_unscored')).toBe(true);
  });

  it('DOES score a mixed record that carries an explicit signed decomposition', () => {
    const curated = {
      signedExposure: { s1: 0.6, s2: -0.3 },
      exposureBasis: 'winners and losers named separately',
      profile: { kind: 'market_exponential' }, profileBasis: 'b',
    };
    const r = incidentSourceVector({
      event: rec({ stages: ['s1', 's2'] }), assumption: { direction: 'mixed', channel: 'downstream', operational: true },
      ageDays: 0, params: P, curated,
    });
    expect(r.scored).toBe(true);
    expect(r.z.s1).toBeGreaterThan(0);
    expect(r.z.s2).toBeLessThan(0);
  });

  it('a mitigating record produces a negative source, never a smaller positive one', () => {
    const r = incidentSourceVector({ event: rec(), assumption: mitigating, ageDays: 0, params: P, curated: null });
    expect(r.z.s1).toBeLessThan(0);
  });
});

describe('records that are displayed but not scored', () => {
  it('a country-only record with no stage mapping is unscored and reported', () => {
    const r = incidentSourceVector({ event: rec({ stages: [] }), assumption: adverse, ageDays: 0, params: P, curated: null });
    expect(r.scored).toBe(false);
    expect(r.unscoredReason).toBe(UNSCORED_REASONS.NO_STAGE_MAPPING);
    expect(r.diagnostics.some((d) => d.code === 'country_only_event')).toBe(true);
  });

  it('a non-operational record is unscored, with a strategic_context profile', () => {
    const r = incidentSourceVector({ event: rec(), assumption: { ...adverse, operational: false }, ageDays: 0, params: P, curated: null });
    expect(r.scored).toBe(false);
    expect(r.unscoredReason).toBe(UNSCORED_REASONS.NOT_OPERATIONAL);
    expect(r.profile.kind).toBe('strategic_context');
  });

  it('a FUTURE-dated record has exactly zero operational effect', () => {
    for (const age of [-1, -30, -400]) {
      const r = incidentSourceVector({ event: rec({ daysAgo: age }), assumption: adverse, ageDays: age, params: P, curated: null });
      expect(r.scored).toBe(false);
      expect(r.unscoredReason).toBe(UNSCORED_REASONS.FUTURE_DATED);
      expect(r.z).toEqual({});
    }
  });
});

describe('missing temporal profiles', () => {
  it('an ACTIVE operational record without a profile is flagged as a hard defect', () => {
    const r = incidentSourceVector({ event: rec({ daysAgo: 10 }), assumption: adverse, ageDays: 10, params: P, curated: null });
    expect(r.diagnostics.some((d) => d.code === 'missing_profile_active')).toBe(true);
  });

  it('an ARCHIVED record outside the curated horizon is a counted legacy diagnostic instead', () => {
    const r = incidentSourceVector({ event: rec({ daysAgo: 2000 }), assumption: adverse, ageDays: 2000, params: P, curated: null });
    expect(r.diagnostics.some((d) => d.code === 'missing_profile_archived')).toBe(true);
    expect(r.diagnostics.some((d) => d.code === 'missing_profile_active')).toBe(false);
  });
});

describe('confidence is metadata and never a multiplier', () => {
  it('two records differing only in confidence produce identical source vectors', () => {
    const hi = incidentSourceVector({ event: rec({ conf: 'High' }), assumption: adverse, ageDays: 0, params: P, curated: null });
    const lo = incidentSourceVector({ event: rec({ conf: 'Low' }), assumption: adverse, ageDays: 0, params: P, curated: null });
    expect(hi.z).toEqual(lo.z);
  });
});

describe('severity mappings', () => {
  it('all three agree at the ends of the rubric and are monotone between them', () => {
    for (const form of ['linear', 'concave', 'convex']) {
      expect(severityIntensity(0, form)).toBeCloseTo(0, 12);
      expect(severityIntensity(10, form)).toBeCloseTo(1, 12);
      let prev = -1;
      for (let q = 0; q <= 10; q++) {
        const v = severityIntensity(q, form);
        expect(v).toBeGreaterThanOrEqual(prev);
        prev = v;
      }
    }
  });

  it('concave sits above and convex below the linear base in the interior', () => {
    expect(severityIntensity(5, 'concave')).toBeGreaterThan(severityIntensity(5, 'linear'));
    expect(severityIntensity(5, 'convex')).toBeLessThan(severityIntensity(5, 'linear'));
  });

  it('changing the mapping changes the source, which is why it is a reported model form', () => {
    const at = (form) => incidentSourceVector({ event: rec({ sev: 5 }), assumption: adverse, ageDays: 0, params: resolveParams({ severityMapping: form }), curated: null }).z.s1;
    expect(at('concave')).toBeGreaterThan(at('linear'));
    expect(at('convex')).toBeLessThan(at('linear'));
  });
});

/* ==================================================================
   INCIDENT DEDUPLICATION — the rule that five reports of one earthquake
   are one earthquake.
   ================================================================== */
describe('groupIncidents()', () => {
  const records = [
    { id: 'primary', sev: 7, incidentId: 'quake', incidentRole: 'primary' },
    { id: 'update_a', sev: 8, incidentId: 'quake', incidentRole: 'update' },
    { id: 'recovery', sev: 3, incidentId: 'quake', incidentRole: 'recovery' },
    { id: 'unrelated', sev: 5 },
  ];

  it('collapses every record of one incident into one group', () => {
    const groups = groupIncidents(records);
    expect(groups).toHaveLength(2);
    const quake = groups.find((g) => g.incidentId === 'quake');
    expect(quake.recordCount).toBe(3);
    expect(quake.primary.id).toBe('primary');
  });

  it('prefers the DECLARED primary over the most severe record', () => {
    expect(groupIncidents(records).find((g) => g.incidentId === 'quake').primary.id).toBe('primary');
  });

  it('falls back to the most severe record, then the lowest id, when no primary is declared', () => {
    const undeclared = [
      { id: 'b', sev: 4, incidentId: 'x' },
      { id: 'a', sev: 9, incidentId: 'x' },
      { id: 'c', sev: 9, incidentId: 'x' },
    ];
    expect(groupIncidents(undeclared)[0].primary.id).toBe('a');
  });

  it('treats a record with no incident link as its own incident', () => {
    expect(groupIncidents(records).find((g) => g.incidentId === 'unrelated').recordCount).toBe(1);
  });

  it('is order-stable: shuffling the input never changes the grouping', () => {
    const a = groupIncidents(records);
    const b = groupIncidents([...records].reverse());
    expect(b.map((g) => g.incidentId)).toEqual(a.map((g) => g.incidentId));
    expect(b.map((g) => g.primary.id)).toEqual(a.map((g) => g.primary.id));
  });
});

describe('one incident scores once, however many reports it has', () => {
  const build = () => {
    const data = makeFixtureData();
    return { data, engine: buildEngine(data) };
  };
  const primary = { id: 'e1', sev: 8, daysAgo: 0, stages: ['s1'], countries: ['us'], incidentId: 'inc1', incidentRole: 'primary' };
  const report = (n, over = {}) => ({ ...primary, id: `e1_report_${n}`, incidentId: 'inc1', incidentRole: 'update', ...over });

  it('adding four more reports of the same incident does not move any stage field', () => {
    const { engine } = build();
    const alone = engine.operationalField([primary]);
    const withReports = engine.operationalField([primary, report(1), report(2), report(3), report(4)]);
    expect(withReports).toEqual(alone);
  });

  it('and does not move the headline index', () => {
    const { engine } = build();
    const alone = engine.operationalIndex(engine.operationalField([primary]));
    const many = engine.operationalIndex(engine.operationalField([primary, report(1), report(2)]));
    expect(many).toBeCloseTo(alone, 12);
  });

  it('a MORE severe update does not raise the incident either — the primary carries the reading', () => {
    const { engine } = build();
    const alone = engine.operationalField([primary]);
    const withSevere = engine.operationalField([primary, report(1, { sev: 10 })]);
    expect(withSevere).toEqual(alone);
  });

  /* v6 scored a plant coming back online as a fresh shock in the opposite
     direction, against an anchor that had already priced the restart. */
  it('a recovery update cannot increase adverse exposure', () => {
    const { engine } = build();
    const alone = engine.operationalField([primary]);
    const recovery = { ...primary, id: 'e1_recovery', incidentRole: 'recovery', sev: 6 };
    const withRecovery = engine.operationalField([primary, recovery]);
    Object.keys(alone).forEach((sid) => {
      expect(withRecovery[sid]).toBeLessThanOrEqual(alone[sid] + 1e-12);
    });
  });

  it('a genuinely DISTINCT adverse incident does raise the field — deduplication is not suppression', () => {
    const { engine } = build();
    const alone = engine.operationalField([primary]);
    const other = { id: 'e4', sev: 7, daysAgo: 0, stages: ['s1'], countries: ['us'] };
    const both = engine.operationalField([primary, other]);
    expect(both.s1).toBeGreaterThan(alone.s1);
    expect(both.s1).toBeLessThanOrEqual(1);
  });
});
