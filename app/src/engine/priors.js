/* ====================================================================
   MODEL_PRIORS — the single source of truth for every numerical
   coefficient used by the propagation/scoring model.

   These are DECLARED, UNVALIDATED SENSITIVITY PRIORS, not calibrated
   parameters. Nothing here has been fit to observed disruption episodes.
   They exist so the model's behavior is reproducible and inspectable,
   not because the specific numbers are known to be correct. See
   MODEL_ROADMAP.md and README §8/§9 for what would be required to
   calibrate them, and the "Model status and limitations" section for
   the plain-language version of this disclaimer.
   ==================================================================== */

export const MODEL_PRIORS = Object.freeze({
  // Exponential half-life (days) for event-shock decay: decay(age,H) = 2^(-age/H).
  halfLifeDays: 12,

  // Downstream (supplier -> buyer, input-dependence proxy) and upstream
  // (buyer -> supplier, revenue-echo proxy) transmission coefficients.
  downstreamTransmission: 0.55,
  upstreamTransmission: 0.30,

  // Floor applied to the specificity multiplier so a fully-substitutable
  // input (specificity 0) still transmits a residual effect, rather than
  // transmitting exactly zero.
  specificityFloor: 0.25,

  // Propagation is truncated once a contribution's magnitude falls below
  // this tolerance, rather than at a fixed hop count.
  contributionTolerance: 1e-4,

  // The frozen demonstration snapshot this dataset represents. Event
  // `daysAgo` values are relative to this date, not to the visitor's
  // clock — see math.js decay(). Keeping this static is deliberate: this
  // is a snapshot, not a live feed (see VaultContext.jsx / vault-snapshot.json).
  datasetAsOf: '2026-07-06',

  // Composite node-risk-score weights (structural vulnerability index).
  // Four components are graph/data-derived; two ("subst", "market") are
  // declared analyst judgments — see Methodology.jsx and README §8.
  componentWeights: Object.freeze({
    choke: 0.25, geo: 0.20, policy: 0.20, subst: 0.15, shock: 0.10, market: 0.10,
  }),

  modelVersion: 'sscim-model-v6-client-sensitivity',
});

/* Deterministic low/base/high parameter sets for a sensitivity envelope —
   NOT confidence intervals. They bound how sensitive the operational-impact
   numbers are to the two transmission coefficients and the half-life,
   holding everything else (graph, shares, event classification) fixed. */
export const SENSITIVITY_PRESETS = Object.freeze({
  low: Object.freeze({
    ...MODEL_PRIORS,
    downstreamTransmission: MODEL_PRIORS.downstreamTransmission * 0.7,
    upstreamTransmission: MODEL_PRIORS.upstreamTransmission * 0.7,
    halfLifeDays: MODEL_PRIORS.halfLifeDays * 0.7,
  }),
  base: MODEL_PRIORS,
  high: Object.freeze({
    ...MODEL_PRIORS,
    downstreamTransmission: Math.min(1, MODEL_PRIORS.downstreamTransmission * 1.3),
    upstreamTransmission: Math.min(1, MODEL_PRIORS.upstreamTransmission * 1.3),
    halfLifeDays: MODEL_PRIORS.halfLifeDays * 1.3,
  }),
});
