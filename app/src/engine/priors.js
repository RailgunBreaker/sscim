/* ====================================================================
   priors.js — WHAT IS LEFT OF THE v6 PRIORS MODULE.

   In v6 this file was the single source of truth for every coefficient.
   In v7 that role belongs to engine/registry.js, which validates every
   parameter and carries its definition, domain, units, rationale, status
   and assumption range. Nothing numerical is declared here any more.

   Two things remain, because they are genuinely not model parameters:

     1. DEFAULT_DATASET_AS_OF — the snapshot date a bundle falls back to
        when it predates the vault's `meta` table. It is a fact about the
        data, not a coefficient.

     2. The v6 compatibility surface — MODEL_PRIORS and
        SENSITIVITY_PRESETS, rebuilt from the v7 registry through the
        documented adapter, so stored v6 artefacts and any caller that has
        not moved yet keep resolving. These are READ-ONLY VIEWS. They are
        not what the engine computes with, they carry the v7 model
        version, and they must not be used to author new code.
   ==================================================================== */
import {
  BASE_PARAMS, MODEL_VERSION, PARAMETERS, BASE_STRUCTURAL_WEIGHTS_RAW,
  V6_TO_V7_PARAMETER_NAMES, V6_TO_V7_FIELD_NAMES, adaptLegacyPriors, adaptLegacyStage,
} from './registry.js';

/* The frozen demonstration snapshot a bundle without a `meta` table
   represents. Event `daysAgo` values are relative to this date, never to
   the visitor's clock: this is a snapshot, not a live feed. Keep in sync
   with server/src/history-events.js DATASET_AS_OF — every record's age
   derives from its dateISO against that date, so advancing both (then
   running server/scripts/sync-events.mjs) re-ages the whole table. */
export const DEFAULT_DATASET_AS_OF = '2026-07-29';

/* ---------------- v6 compatibility view ----------------
   Deprecated. Read docs/MODEL_V7_SPEC.md §5 and use registry.js. */
export const MODEL_PRIORS = Object.freeze({
  // v6 names, v7 values, through the documented adapter.
  halfLifeDays: BASE_PARAMS.acuteHalfLifeDays,
  downstreamTransmission: BASE_PARAMS.downstreamTransmission,
  upstreamTransmission: BASE_PARAMS.upstreamTransmission,
  specificityFloor: BASE_PARAMS.minimumDependencyFactor,
  datasetAsOf: DEFAULT_DATASET_AS_OF,
  /* v6's `componentWeights` carried a `shock` entry that was declared but
     never read — the structural layer is event-free by construction — and
     called non-substitutability `subst` while using it with the opposite
     sense. Both are corrected in the v7 registry; this view exposes the
     corrected raw vector under the v7 names. */
  structuralWeightsRaw: BASE_STRUCTURAL_WEIGHTS_RAW,
  modelVersion: MODEL_VERSION,
});

/* v6 shipped three JOINTLY MOVING presets as its principal uncertainty
   analysis, which cannot separate one parameter's influence from
   another's and systematically overstates the spread by moving everything
   the same way at once. v7 replaces that with the global sensitivity
   design in engine/sensitivity.js. This view survives only so stored v6
   artefacts still resolve, and it is built from the registry's declared
   low/base/high so it can never drift from the published table. */
export const SENSITIVITY_PRESETS = Object.freeze({
  low: Object.freeze({
    halfLifeDays: PARAMETERS.acuteHalfLifeDays.low,
    downstreamTransmission: PARAMETERS.downstreamTransmission.low,
    upstreamTransmission: PARAMETERS.upstreamTransmission.low,
    specificityFloor: PARAMETERS.minimumDependencyFactor.low,
  }),
  base: Object.freeze({
    halfLifeDays: PARAMETERS.acuteHalfLifeDays.base,
    downstreamTransmission: PARAMETERS.downstreamTransmission.base,
    upstreamTransmission: PARAMETERS.upstreamTransmission.base,
    specificityFloor: PARAMETERS.minimumDependencyFactor.base,
  }),
  high: Object.freeze({
    halfLifeDays: PARAMETERS.acuteHalfLifeDays.high,
    downstreamTransmission: PARAMETERS.downstreamTransmission.high,
    upstreamTransmission: PARAMETERS.upstreamTransmission.high,
    specificityFloor: PARAMETERS.minimumDependencyFactor.high,
  }),
});

export { MODEL_VERSION, V6_TO_V7_PARAMETER_NAMES, V6_TO_V7_FIELD_NAMES, adaptLegacyPriors, adaptLegacyStage };
