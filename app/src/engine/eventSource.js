/* ====================================================================
   eventSource.js — raw records -> deduplicated incidents -> the signed
   source vector z_{e,s}(t).

   THE FORMULA THIS FILE IMPLEMENTS, once:

       z_{e,s}(t) = d_{e,s} * g(q_e) * alpha_{e,s} * R_e(t)

     d_{e,s} in [-1,1]   explicitly signed direction for stage s
     q_e     in [1,10]   the displayed ordinal severity rubric
     g                   severity -> intensity mapping (severity.js)
     alpha_{e,s} in [0,1] stage exposure (event-model.js, or the counted
                          1/k legacy fallback)
     R_e(t)  in [0,1]    temporal profile (persistence.js)

   FOUR RULES THAT ARE NOT NEGOTIABLE HERE.

     1. DEDUPLICATE BY INCIDENT FIRST. Five newspapers reporting one
        earthquake is one earthquake. Records are grouped by incidentId
        and only the PRIMARY record of each group carries source mass;
        updates and recovery reports inform the curated persistence
        profile and are displayed, but they are never independent shocks.

     2. DEDUPLICATE STAGE IDS. A stage listed twice on one record is one
        stage. The unique set is taken before any allocation, so a
        duplicated tag cannot change any number.

     3. NEVER TREAT AN UNKNOWN DIRECTION AS ADVERSE. `mixed` and
        `unclassified` records produce NO scalar field at all, unless the
        curation supplies an explicit signed decomposition. Guessing
        "probably bad" is how a model acquires a pessimism bias that
        nobody declared.

     4. CONFIDENCE IS METADATA. It is displayed, it is never a multiplier.

   Everything that had to fall back is returned as a machine-readable
   diagnostic, so the audit can count it and the documentation can quote
   the count instead of claiming coverage the data does not have.
   ==================================================================== */
import { clamp } from './math.js';
import { severityIntensity } from './severity.js';
import { persistence, persistenceByStage, profileHorizonDays, isProfileId } from './persistence.js';
import { EVENT_MODEL, LEGACY_PROFILE, UNSCORED_PROFILE, ACTIVE_HORIZON_DAYS } from './event-model.js';
import { factualEligibility, eventEvaluationDate } from './evidence.js';

export const UNSCORED_REASONS = Object.freeze({
  NOT_OPERATIONAL: 'not_operational',
  UNKNOWN_DIRECTION: 'unknown_direction_no_signed_components',
  NO_STAGE_MAPPING: 'country_only_no_stage_mapping',
  FUTURE_DATED: 'future_dated',
  ZERO_PERSISTENCE: 'zero_persistence_at_evaluation_date',
  EVIDENCE_INELIGIBLE: 'evidence_ineligible',
});

/* Unique stage ids of a record, order-preserving. */
export function uniqueStages(event) {
  const seen = new Set();
  const out = [];
  for (const sid of event?.stages || []) {
    if (typeof sid !== 'string' || seen.has(sid)) continue;
    seen.add(sid);
    out.push(sid);
  }
  return out;
}

/* ---------------- incident grouping ----------------
   `incidentKeyOf(event)` resolves the stable incident key for a record:
   the record's own `incidentId` field, else the curated EVENT_INCIDENTS
   lookup, else the record's own id (a record that describes an incident
   nobody else reported IS that incident). */
export function groupIncidents(events, { incidentOf } = {}) {
  const groups = new Map();
  for (const e of events || []) {
    if (!e || !e.id) continue;
    const linked = e.incidentId || incidentOf?.(e.id)?.incident || null;
    const key = linked || e.id;
    const role = e.incidentRole || incidentOf?.(e.id)?.role || (linked ? 'update' : 'primary');
    if (!groups.has(key)) groups.set(key, { incidentId: key, records: [] });
    groups.get(key).records.push({ event: e, role });
  }

  const out = [];
  for (const g of groups.values()) {
    // Primary selection is deterministic: the declared primary, else the
    // most severe record, else the lowest id. Never "whichever came first
    // in the array", which is how a bundle's serialisation order becomes a
    // modelling decision.
    const bySeverityThenId = (a, b) => (b.event.sev ?? 0) - (a.event.sev ?? 0)
      || (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0);
    const declared = g.records.filter((r) => r.role === 'primary').sort(bySeverityThenId)[0];
    const primary = declared ?? [...g.records].sort(bySeverityThenId)[0];
    out.push({
      incidentId: g.incidentId,
      primary: primary.event,
      primaryRole: primary.role,
      records: g.records.map((r) => ({ id: r.event.id, role: r.role })),
      recordCount: g.records.length,
    });
  }
  // Stable output order so two runs over the same bundle never disagree.
  return out.sort((a, b) => (a.incidentId < b.incidentId ? -1 : a.incidentId > b.incidentId ? 1 : 0));
}

/* ---------------- stage exposure ----------------
   Curated alpha where it exists; the counted 1/k legacy fallback where it
   does not. Returns the vector plus how it was obtained. */
export function stageExposure(event, curated) {
  const stages = uniqueStages(event);
  if (!stages.length) return { exposure: {}, source: 'none', stages };
  const tagged = new Set(stages);

  /* A curated vector is only usable for the stages the record actually
     carries. Curation that names a stage the record does not is dropped
     and reported: the record's tags are the data, and a curation that has
     drifted away from them must be visible, not silently authoritative. */
  if (curated?.signedExposure) {
    // Explicit signed decomposition: alpha is the magnitude, the sign is
    // the per-stage direction. This is the ONLY way a mixed-direction
    // record scores at all.
    const exposure = {};
    const direction = {};
    const orphans = [];
    for (const [sid, v] of Object.entries(curated.signedExposure)) {
      if (!Number.isFinite(v) || v === 0) continue;
      if (!tagged.has(sid)) { orphans.push(sid); continue; }
      exposure[sid] = clamp(Math.abs(v), 0, 1);
      direction[sid] = v > 0 ? 1 : -1;
    }
    if (Object.keys(exposure).length) {
      return { exposure, direction, source: 'curated_signed', basis: curated.exposureBasis, orphans, stages: Object.keys(exposure) };
    }
  }

  if (curated?.exposure && Object.keys(curated.exposure).length) {
    const exposure = {};
    const orphans = [];
    for (const [sid, a] of Object.entries(curated.exposure)) {
      if (!Number.isFinite(a) || a <= 0) continue;
      if (!tagged.has(sid)) { orphans.push(sid); continue; }
      exposure[sid] = clamp(a, 0, 1);
    }
    if (Object.keys(exposure).length) {
      return { exposure, source: 'curated', basis: curated.exposureBasis, orphans, stages: Object.keys(exposure) };
    }
    /* Every curated stage is absent from the record: the curation and the
       record disagree completely. Fall through to the counted legacy
       fallback so the model still runs, and report the mismatch. */
    return {
      exposure: Object.fromEntries(stages.map((sid) => [sid, 1 / stages.length])),
      source: 'curated_stage_mismatch', k: stages.length, orphans: Object.keys(curated.exposure), stages,
    };
  }

  /* LEGACY COMPATIBILITY FALLBACK. Split one unit of exposure equally
     across the k unique stages, so a record tagged to more stages spreads
     its severity rather than multiplying it. Sums to exactly 1 by
     construction, which is the property that makes splitting or
     duplicating a legacy scope unable to create source mass. */
  const k = stages.length;
  const exposure = Object.fromEntries(stages.map((sid) => [sid, 1 / k]));
  return { exposure, source: 'legacy_equal_split', k, stages };
}

/* ---------------- the source vector ----------------
   `assumption`  { direction, channel, operational } from event-assumptions.js
   `ageDays`     the incident's age at the evaluation date
   `params`      a resolved v7 parameter set

   Returns { z, scored, unscoredReason, channel, intensity, persistence,
             exposure, exposureSource, profile, diagnostics }. */
export function incidentSourceVector({ event, assumption, ageDays, params, evaluationDate: suppliedEvaluationDate, curated = EVENT_MODEL[event?.id] ?? null }) {
  const evaluationDate = eventEvaluationDate(event, ageDays, suppliedEvaluationDate);
  const evidenceEligibility = factualEligibility(event, evaluationDate);
  const diagnostics = [];
  const stages = uniqueStages(event);
  const rawStageCount = (event?.stages || []).length;
  if (rawStageCount > stages.length) {
    diagnostics.push({ code: 'duplicate_stage_tags', id: event.id, detail: `${rawStageCount - stages.length} duplicate stage tag(s) removed before scoring` });
  }

  const unscored = (reason) => ({
    z: {}, scored: false, unscoredReason: reason, channel: assumption?.channel ?? 'downstream',
    intensity: 0, persistence: 0, exposure: {}, exposureSource: 'none',
    profile: UNSCORED_PROFILE, diagnostics, evidenceEligibility,
  });

  if (!assumption?.operational) return unscored(UNSCORED_REASONS.NOT_OPERATIONAL);
  if (!evidenceEligibility.eligible) {
    diagnostics.push({ code: 'factual_evidence_excluded', id: event.id, detail: evidenceEligibility.reason });
    return unscored(UNSCORED_REASONS.EVIDENCE_INELIGIBLE);
  }

  if (!stages.length) {
    diagnostics.push({ code: 'country_only_event', id: event.id, detail: 'record carries countries but no stage mapping — displayed, operationally unscored' });
    return unscored(UNSCORED_REASONS.NO_STAGE_MAPPING);
  }

  const exposureResult = stageExposure(event, curated);
  if (exposureResult.source === 'legacy_equal_split') {
    diagnostics.push({
      code: 'legacy_equal_stage_exposure', id: event.id,
      detail: `no curated stage exposure — equal 1/${exposureResult.k} allocation across ${exposureResult.k} unique stage(s)`,
    });
  }
  if (exposureResult.source === 'curated_stage_mismatch') {
    diagnostics.push({
      code: 'curated_exposure_stage_mismatch', id: event.id,
      detail: `curated exposure names stage(s) [${(exposureResult.orphans || []).join(', ')}] that this record does not carry — curation ignored, equal 1/${exposureResult.k} allocation applied instead`,
    });
  } else if (exposureResult.orphans?.length) {
    diagnostics.push({
      code: 'curated_exposure_orphan_stage', id: event.id,
      detail: `curated exposure names stage(s) [${exposureResult.orphans.join(', ')}] absent from the record's stage tags — dropped`,
    });
  }

  /* Direction. An explicitly signed decomposition wins; otherwise the
     record's curated direction, and mixed/unclassified scores nothing. */
  let signOf;
  if (exposureResult.direction) {
    signOf = (sid) => exposureResult.direction[sid] ?? 0;
  } else if (assumption.direction === 'adverse') {
    signOf = () => 1;
  } else if (assumption.direction === 'mitigating') {
    signOf = () => -1;
  } else {
    diagnostics.push({
      code: 'unknown_direction_unscored', id: event.id,
      detail: `direction "${assumption.direction}" carries no signed stage components — displayed, operationally unscored (an unknown direction is never treated as adverse)`,
    });
    return unscored(UNSCORED_REASONS.UNKNOWN_DIRECTION);
  }

  /* Persistence profile. */
  let profile = curated?.profile;
  if (!profile || !isProfileId(profile.kind)) {
    const age = Number.isFinite(ageDays) ? ageDays : 0;
    profile = LEGACY_PROFILE;
    diagnostics.push({
      code: age <= ACTIVE_HORIZON_DAYS ? 'missing_profile_active' : 'missing_profile_archived',
      id: event.id,
      detail: `no curated temporal profile — legacy fallback "${LEGACY_PROFILE.kind}" applied (record age ${age} d, curated horizon ${ACTIVE_HORIZON_DAYS} d)`,
    });
  }

  const R = persistence(profile, ageDays, params);
  const recovery = persistenceByStage(profile, ageDays, params, { stages: exposureResult.stages, evaluationDate });
  diagnostics.push(...recovery.diagnostics.map((d) => ({ ...d, id: event.id })));
  const intensity = severityIntensity(event.sev, params.severityMapping);

  if (Number.isFinite(ageDays) && ageDays < 0) {
    return { ...unscored(UNSCORED_REASONS.FUTURE_DATED), profile, intensity };
  }

  const z = {};
  for (const [sid, alpha] of Object.entries(exposureResult.exposure)) {
    const v = signOf(sid) * intensity * alpha * recovery.byStage[sid];
    if (v) z[sid] = clamp(v, -1, 1);
  }

  const scored = Object.values(z).some((v) => v !== 0);
  return {
    z,
    scored,
    unscoredReason: scored ? null : UNSCORED_REASONS.ZERO_PERSISTENCE,
    channel: assumption.channel ?? 'downstream',
    intensity,
    // Compatibility summary is exposure-weighted; computation uses R per stage.
    persistence: Object.entries(exposureResult.exposure).reduce((sum, [sid, alpha]) => sum + alpha * recovery.byStage[sid], 0)
      / (Object.values(exposureResult.exposure).reduce((sum, alpha) => sum + alpha, 0) || 1),
    assumedPersistence: R,
    persistenceByStage: recovery.byStage,
    recoveryComponents: recovery.components,
    evidenceEligibility,
    exposure: exposureResult.exposure,
    exposureSource: exposureResult.source,
    exposureBasis: exposureResult.basis ?? null,
    profile,
    diagnostics,
  };
}

/* Horizon helper for the history replay: the age past which this incident
   cannot contribute materially under the given parameters. */
export function incidentHorizonDays(event, params, curated = EVENT_MODEL[event?.id] ?? null) {
  const profile = curated?.profile && isProfileId(curated.profile.kind) ? curated.profile : LEGACY_PROFILE;
  return profileHorizonDays(profile, params);
}
