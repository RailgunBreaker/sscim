/* ====================================================================
   persistence.js — the temporal profile R_e(t).

   v6 applied ONE exponential half-life (12 days) to every event class, so
   a standing export-control rule and a same-week fab inspection decayed at
   the same rate, and a rule still in force scored a fifth of its own
   severity a month after it took effect. v7 makes the profile an explicit,
   per-incident, curated property.

   R is a multiplier in [0,1] on the incident's source vector. It never
   changes a sign, never exceeds 1, and is zero for anything that has not
   happened yet.

   PROFILES

     acute_exponential   R(age) = 2^(-age / H_a)
                         Physical disruption with an unstated restart path.

     market_exponential  R(age) = 2^(-age / H_m)
                         Allocation, pricing and licensing-throughput
                         effects: same functional form, commercial rather
                         than physical timescale.

     persistent_policy   R(age) = 1 for effectiveAfterDays <= age < expiresAfterDays,
                         0 otherwise.
                         A rule in force is in force. It does not fade; it
                         ends, on the date it is superseded or expires.

     outage_recovery     R(age) = 1                                        age < S
                                = 1 - (age - S)/T_r                        S <= age < S + T_r
                                = 0                                        age >= S + T_r
                         where S = recoveryStartDays. A staged restart is
                         reported as a sequence of line restarts, so the
                         decline is linear, not exponential.

     strategic_context   R(age) = 0 always.
                         Long-horizon signals are real, are displayed, and
                         are operationally UNSCORED. Modelling a 2030 fab
                         announcement as current-period exposure would be a
                         forecast, which this model does not make.

   AGE CONVENTION. `age` is the incident's age in days at the evaluation
   date, i.e. `daysAgo` measured against the snapshot date (never against
   the reader's clock — see registry.js and the dataset date on the
   bundle). A NEGATIVE age means the record is dated in the future, and
   every profile returns exactly 0 for it: an event must not contribute to
   the index before its own date.
   ==================================================================== */
import { clamp } from './math.js';

export const PROFILE_IDS = Object.freeze([
  'acute_exponential', 'market_exponential', 'persistent_policy', 'outage_recovery', 'strategic_context',
]);

/* Which profiles can ever produce a nonzero operational field. */
export const SCORING_PROFILES = Object.freeze(PROFILE_IDS.filter((p) => p !== 'strategic_context'));

export const PROFILE_DEFINITIONS = Object.freeze({
  acute_exponential: Object.freeze({
    id: 'acute_exponential', formula: 'R(age) = 2^(-age / H_a)',
    halfLifeParam: 'acuteHalfLifeDays', scoring: true,
    describes: 'Physical disruption whose restoration path is not separately recorded.',
  }),
  market_exponential: Object.freeze({
    id: 'market_exponential', formula: 'R(age) = 2^(-age / H_m)',
    halfLifeParam: 'marketHalfLifeDays', scoring: true,
    describes: 'Allocation, pricing and licensing-throughput effects on a commercial timescale.',
  }),
  persistent_policy: Object.freeze({
    id: 'persistent_policy', formula: 'R(age) = 1 on [effectiveAfterDays, expiresAfterDays), else 0',
    halfLifeParam: null, scoring: true,
    describes: 'A control that is in force until it is superseded or expires, and does not fade meanwhile.',
  }),
  outage_recovery: Object.freeze({
    id: 'outage_recovery', formula: 'R(age) = 1 before recoveryStartDays, then linear to 0 over T_r',
    halfLifeParam: 'outageRecoveryDays', scoring: true,
    describes: 'An outage whose staged restoration has begun and is reported.',
  }),
  strategic_context: Object.freeze({
    id: 'strategic_context', formula: 'R(age) = 0',
    halfLifeParam: null, scoring: false,
    describes: 'Long-horizon capacity, investment or intent signals: displayed, operationally unscored.',
  }),
});

export function isProfileId(id) {
  return PROFILE_IDS.includes(id);
}

/* R_e(t) for one incident.

   `profile`  { kind, effectiveAfterDays?, expiresAfterDays?, recoveryStartDays? }
              or a bare kind string.
   `ageDays`  the incident's age in days at the evaluation date.
   `params`   a resolved v7 parameter set (registry.js).

   Unknown kinds throw: silently defaulting an unrecognised profile to a
   decay is how a data-entry typo becomes an invisible modelling decision.
   The audit and the source builder handle MISSING profiles explicitly (see
   eventSource.js) rather than routing them here. */
export function persistence(profile, ageDays, params) {
  const spec = typeof profile === 'string' ? { kind: profile } : (profile || {});
  const kind = spec.kind;
  if (!isProfileId(kind)) throw new Error(`unknown temporal profile "${kind}" — expected one of ${PROFILE_IDS.join('|')}`);

  // A record dated in the future contributes nothing, under every profile.
  const age = Number.isFinite(ageDays) ? ageDays : 0;
  if (age < 0) return 0;

  switch (kind) {
    case 'strategic_context':
      return 0;

    case 'acute_exponential':
      return clamp(Math.pow(2, -age / params.acuteHalfLifeDays), 0, 1);

    case 'market_exponential':
      return clamp(Math.pow(2, -age / params.marketHalfLifeDays), 0, 1);

    case 'persistent_policy': {
      // Boundaries are half-open [from, until): a control is in force ON the
      // day it takes effect and NOT on the day it is superseded, so a rule and
      // its replacement can never both score for the same day.
      const from = Number.isFinite(spec.effectiveAfterDays) ? spec.effectiveAfterDays : 0;
      const until = Number.isFinite(spec.expiresAfterDays) ? spec.expiresAfterDays : Infinity;
      return age >= from && age < until ? 1 : 0;
    }

    case 'outage_recovery': {
      const start = Number.isFinite(spec.recoveryStartDays) ? Math.max(0, spec.recoveryStartDays) : 0;
      const duration = Number.isFinite(spec.recoveryDays) ? spec.recoveryDays : params.outageRecoveryDays;
      if (!(duration > 0)) return age < start ? 1 : 0;
      if (age < start) return 1;
      if (age >= start + duration) return 0;
      return clamp(1 - (age - start) / duration, 0, 1);
    }

    default:
      throw new Error(`unhandled temporal profile "${kind}"`);
  }
}

/* The age at which a profile's multiplier first drops below `floor`, or
   Infinity if it never does. Used by the history replay to skip incidents
   that cannot move the index at a past date, so the multi-year replay stays
   tractable without inventing a truncation rule per profile. */
export function profileHorizonDays(profile, params, floor = 1e-4) {
  const spec = typeof profile === 'string' ? { kind: profile } : (profile || {});
  switch (spec.kind) {
    case 'strategic_context': return 0;
    case 'acute_exponential': return params.acuteHalfLifeDays * Math.log2(1 / floor);
    case 'market_exponential': return params.marketHalfLifeDays * Math.log2(1 / floor);
    case 'persistent_policy': return Number.isFinite(spec.expiresAfterDays) ? spec.expiresAfterDays : Infinity;
    case 'outage_recovery': {
      const start = Number.isFinite(spec.recoveryStartDays) ? Math.max(0, spec.recoveryStartDays) : 0;
      const duration = Number.isFinite(spec.recoveryDays) ? spec.recoveryDays : params.outageRecoveryDays;
      return start + duration;
    }
    default: return 0;
  }
}
