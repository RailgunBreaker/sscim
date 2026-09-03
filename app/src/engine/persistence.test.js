import { describe, it, expect } from 'vitest';
import { persistence, profileHorizonDays, PROFILE_IDS, PROFILE_DEFINITIONS, isProfileId } from './persistence.js';
import { BASE_PARAMS, PARAMETERS, resolveParams } from './registry.js';

const P = BASE_PARAMS;

describe('every declared profile', () => {
  it('has a definition and a formula', () => {
    PROFILE_IDS.forEach((id) => {
      expect(PROFILE_DEFINITIONS[id]).toBeTruthy();
      expect(PROFILE_DEFINITIONS[id].formula).toBeTruthy();
      expect(PROFILE_DEFINITIONS[id].describes).toBeTruthy();
    });
  });

  it.each(PROFILE_IDS)('%s returns a multiplier inside [0,1] at every age', (kind) => {
    const spec = { kind, effectiveAfterDays: 5, expiresAfterDays: 50, recoveryStartDays: 5 };
    for (const age of [0, 1, 7, 14, 30, 45, 60, 90, 200, 1000]) {
      const r = persistence(spec, age, P);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  /* A record dated in the future must not contribute to today's index —
     under any profile, with no exceptions. */
  it.each(PROFILE_IDS)('%s returns exactly 0 for a future-dated record', (kind) => {
    const spec = { kind, effectiveAfterDays: 0, expiresAfterDays: 500, recoveryStartDays: 0 };
    expect(persistence(spec, -1, P)).toBe(0);
    expect(persistence(spec, -365, P)).toBe(0);
  });

  it('rejects an unknown profile rather than silently decaying', () => {
    expect(() => persistence({ kind: 'vibes' }, 0, P)).toThrow(/unknown temporal profile/);
    expect(isProfileId('vibes')).toBe(false);
  });
});

describe('exponential profiles', () => {
  it('acute_exponential is exactly 0.5 at its half-life, at every point of the assumption range', () => {
    for (const level of ['low', 'base', 'high']) {
      const H = PARAMETERS.acuteHalfLifeDays[level];
      const params = resolveParams({ acuteHalfLifeDays: H });
      expect(persistence('acute_exponential', H, params)).toBeCloseTo(0.5, 12);
      expect(persistence('acute_exponential', 0, params)).toBeCloseTo(1, 12);
      expect(persistence('acute_exponential', 2 * H, params)).toBeCloseTo(0.25, 12);
    }
  });

  it('market_exponential is exactly 0.5 at its own half-life, and decays slower than acute at the base', () => {
    for (const level of ['low', 'base', 'high']) {
      const H = PARAMETERS.marketHalfLifeDays[level];
      const params = resolveParams({ marketHalfLifeDays: H });
      expect(persistence('market_exponential', H, params)).toBeCloseTo(0.5, 12);
    }
    expect(persistence('market_exponential', 30, P)).toBeGreaterThan(persistence('acute_exponential', 30, P));
  });

  it('is strictly decreasing in age', () => {
    let prev = Infinity;
    for (const age of [0, 3, 7, 14, 30, 60]) {
      const v = persistence('acute_exponential', age, P);
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });
});

describe('persistent_policy — exact boundary behaviour', () => {
  const spec = { kind: 'persistent_policy', effectiveAfterDays: 10, expiresAfterDays: 40 };

  it('is 0 before the effective date, 1 ON it, 1 inside the window', () => {
    expect(persistence(spec, 9, P)).toBe(0);
    expect(persistence(spec, 10, P)).toBe(1);
    expect(persistence(spec, 39, P)).toBe(1);
  });

  it('is 0 ON the expiry date — the interval is half-open, so a rule and its replacement never overlap', () => {
    expect(persistence(spec, 40, P)).toBe(0);
    expect(persistence(spec, 41, P)).toBe(0);
  });

  it('never fades inside its window: it is a step, not a decay', () => {
    const ages = [10, 15, 20, 25, 30, 35, 39];
    ages.forEach((a) => expect(persistence(spec, a, P)).toBe(1));
  });

  it('stays in force indefinitely with no declared expiry', () => {
    const open = { kind: 'persistent_policy', effectiveAfterDays: 0 };
    expect(persistence(open, 0, P)).toBe(1);
    expect(persistence(open, 5000, P)).toBe(1);
  });
});

describe('outage_recovery — exact boundary behaviour', () => {
  const spec = { kind: 'outage_recovery', recoveryStartDays: 7 };

  it('is 1 up to the moment recovery begins', () => {
    expect(persistence(spec, 0, P)).toBe(1);
    expect(persistence(spec, 6.999, P)).toBe(1);
    expect(persistence(spec, 7, P)).toBe(1);
  });

  it('declines linearly to exactly 0 at recoveryStart + T_r, and stays there', () => {
    const T = P.outageRecoveryDays;
    expect(persistence(spec, 7 + T / 2, P)).toBeCloseTo(0.5, 12);
    expect(persistence(spec, 7 + T / 4, P)).toBeCloseTo(0.75, 12);
    expect(persistence(spec, 7 + T, P)).toBe(0);
    expect(persistence(spec, 7 + T + 100, P)).toBe(0);
  });

  it('a longer assumed recovery duration always leaves more effect at a given age', () => {
    const at = (T) => persistence(spec, 40, resolveParams({ outageRecoveryDays: T }));
    expect(at(PARAMETERS.outageRecoveryDays.high)).toBeGreaterThan(at(PARAMETERS.outageRecoveryDays.base));
    expect(at(PARAMETERS.outageRecoveryDays.base)).toBeGreaterThan(at(PARAMETERS.outageRecoveryDays.low));
  });

  it('honours a record-specific recovery duration over the registry default', () => {
    expect(persistence({ kind: 'outage_recovery', recoveryStartDays: 0, recoveryDays: 10 }, 5, P)).toBeCloseTo(0.5, 12);
  });
});

describe('strategic_context — operationally unscored', () => {
  it('is exactly 0 at every age, including its own date', () => {
    [0, 1, 100, 10000].forEach((age) => expect(persistence('strategic_context', age, P)).toBe(0));
  });
});

describe('profileHorizonDays()', () => {
  it('gives an exponential profile the age at which it falls below the floor', () => {
    const h = profileHorizonDays('acute_exponential', P, 1e-4);
    expect(persistence('acute_exponential', h, P)).toBeCloseTo(1e-4, 8);
  });
  it('gives a policy with no expiry an infinite horizon, and strategic context none', () => {
    expect(profileHorizonDays({ kind: 'persistent_policy' }, P)).toBe(Infinity);
    expect(profileHorizonDays('strategic_context', P)).toBe(0);
  });
  it('gives outage recovery exactly its completion age', () => {
    expect(profileHorizonDays({ kind: 'outage_recovery', recoveryStartDays: 7 }, P)).toBe(7 + P.outageRecoveryDays);
  });
});
