/* ====================================================================
   registry.js — THE v7 PARAMETER REGISTRY.

   One validated place where every numerical coefficient and every
   categorical model-form choice in SSCIM v7 is declared. Nothing else in
   the engine may hard-code a coefficient: scattered defaults are exactly
   how v6 ended up with a half-life in priors.js, a 5% cut-off in
   facilities.js, and a status table nobody could stress-test.

   EVERY ENTRY CARRIES, BY CONSTRUCTION (validated below):
     name        machine name, also the key
     symbol      the symbol used in docs/MODEL_V7_SPEC.md, AS LATEX. It is
                 rendered inside $...$ by the documentation generator, so
                 it must be valid LaTeX and Greek letters must be written
                 as commands: '\\phi', never 'phi', which KaTeX renders
                 as three italic letters. registry.test.js enforces this.
     definition  what the number MEANS, in one sentence
     low/base/high  the assumption range used by global sensitivity
     domain      [min, max] of numerically valid values
     units       'dimensionless' | 'days' | …
     component   which part of the model consumes it
     rationale   why this value / why this range
     status      'assumption' | 'calibrated'
     modelVersion

   STATUS DISCIPLINE. Every parameter here is `assumption`. None has been
   estimated from observed disruption outcomes. low/base/high are STRESS
   BOUNDS chosen to span the range a reasonable analyst might defend —
   they are NOT confidence intervals, NOT posterior quantiles, and NOT a
   probability distribution over the true value. A parameter may only be
   promoted to `calibrated` after the roadmap in docs/MODEL_V7_SPEC.md
   §11 is satisfied (real incident outcomes, holdout incidents, profile
   likelihood or bootstrap uncertainty, out-of-sample validation).
   ==================================================================== */

export const MODEL_VERSION = 'sscim-model-v7.1-exposure-robustness';

const P = (spec) => Object.freeze({ ...spec, status: spec.status ?? 'assumption', modelVersion: MODEL_VERSION });

/* ---------------- continuous numerical parameters ---------------- */
export const PARAMETERS = Object.freeze({
  downstreamTransmission: P({
    name: 'downstreamTransmission',
    symbol: 'f_d',
    definition: 'Per-RECEIVING-STAGE inherited-sensitivity multiplier. Under incoming-share normalization it caps how much dependency signal a buyer stage can inherit from all of its modeled inputs combined in one hop. It is NOT a globally conserved fraction of an incident: the same source reaches several buyers, so signal branches rather than being divided up.',
    low: 0.30, base: 0.55, high: 0.80,
    domain: [0, 1], exclusiveMax: true,
    units: 'dimensionless',
    component: 'propagation.downstream',
    rationale: 'Strictly below 1 so that the incoming coefficients AT ANY ONE STAGE sum to less than one. That bounds each stage individually and makes the per-stage recursion settle on a DAG; it does NOT bound the network-wide total, because a source branches to several buyers and the summed signal across stages can exceed the source magnitude. The base retains the v6 value for continuity; the range spans "inputs are largely substitutable within one hop" (0.30) to "a buyer stage is nearly wholly dependent on its modeled inputs" (0.80).',
    affects: ['stage operational field', 'headline index', 'country measures', 'company criticality', 'network influence'],
  }),
  upstreamTransmission: P({
    name: 'upstreamTransmission',
    symbol: 'f_u',
    definition: 'Per-SUPPLYING-STAGE upstream-inheritance multiplier. Under outgoing-share normalization it caps how much demand-side echo a supplier stage inherits from all of its modeled buyers combined in one hop. Like f_d it is a per-stage cap, not a conserved share of the incident.',
    low: 0.10, base: 0.30, high: 0.50,
    domain: [0, 1], exclusiveMax: true,
    units: 'dimensionless',
    component: 'propagation.upstream',
    rationale: 'Held below the downstream coefficient because a supplier losing one buyer has more resale options than a buyer losing a specific input has substitutes; strictly below 1 for the same per-stage bound as f_d. Base retains the v6 value.',
    affects: ['stage operational field', 'headline index', 'country measures', 'company criticality'],
  }),
  minimumDependencyFactor: P({
    name: 'minimumDependencyFactor',
    symbol: '\\phi',
    definition: 'Floor on the dependency multiplier, so a fully substitutable input (non-substitutability 0) still transmits a residual fraction phi of the downstream coefficient rather than exactly zero.',
    low: 0.10, base: 0.25, high: 0.40,
    domain: [0, 1],
    units: 'dimensionless',
    component: 'propagation.downstream',
    rationale: 'Renamed from the v6 `specificityFloor`, which read as a floor on specificity rather than on the dependency it produces. Substitution is never instant or free even for a commodity input, so a hard zero is the less defensible end; the range spans "substitution is cheap" to "substitution is slow even where alternatives exist".',
    affects: ['downstream dependency matrix D', 'stage operational field', 'headline index'],
  }),
  acuteHalfLifeDays: P({
    name: 'acuteHalfLifeDays',
    symbol: 'H_a',
    definition: 'Half-life in days of the acute_exponential persistence profile: the age at which a physical-disruption incident’s modeled source is half its day-zero value.',
    low: 7, base: 14, high: 30,
    domain: [0.5, 3650],
    units: 'days',
    component: 'persistence.acute_exponential',
    rationale: 'Spans the observable restart span of a single-site physical outage: inspection-and-restart within a week at the fast end, a quarter-scale rebuild at the slow end. v6 used one 12-day half-life for every event class, which is exactly what this profile split replaces.',
    affects: ['event source vector', 'stage operational field', 'headline index', 'history'],
  }),
  marketHalfLifeDays: P({
    name: 'marketHalfLifeDays',
    symbol: 'H_m',
    definition: 'Half-life in days of the market_exponential persistence profile, used for allocation, pricing and licensing-throughput incidents whose effect decays on a commercial rather than a physical timescale.',
    low: 21, base: 45, high: 90,
    domain: [0.5, 3650],
    units: 'days',
    component: 'persistence.market_exponential',
    rationale: 'Allocation and pricing shocks persist through contract and qualification cycles rather than through repair, so they decay markedly more slowly than acute outages; the range spans roughly one quarter-cycle to three.',
    affects: ['event source vector', 'stage operational field', 'headline index', 'history'],
  }),
  outageRecoveryDays: P({
    name: 'outageRecoveryDays',
    symbol: 'T_r',
    definition: 'Length in days of the linear ramp-down of the outage_recovery persistence profile, from the start of recovery to full restoration.',
    low: 30, base: 60, high: 120,
    domain: [1, 3650],
    units: 'days',
    component: 'persistence.outage_recovery',
    rationale: 'Applies where a record states that restoration has begun but is staged. Linear rather than exponential because staged restarts are reported as a sequence of line restarts, not as a decay; the range spans a one-month to a four-month restoration programme.',
    affects: ['event source vector', 'stage operational field', 'headline index'],
  }),
  rampingSiteWeight: P({
    name: 'rampingSiteWeight',
    symbol: 'w_{\\mathrm{ramp}}',
    definition: 'Operational weight of a site whose status is "ramping" when computing the modeled facility footprint. Operating sites are 1; idle and under-construction sites are 0.',
    low: 0.25, base: 0.50, high: 0.75,
    domain: [0, 1],
    units: 'dimensionless',
    component: 'facilities.footprint',
    rationale: 'A ramping line produces something but not at its steady-state rate, and the snapshot records no ramp curve, so the discount is a judgement. The range spans "barely started" to "nearly at rate"; the two endpoints of the status scale (0 and 1) are definitional, not assumptions.',
    affects: ['modeled facility footprint', 'hazard stage exposure', 'hazard scenario delta'],
  }),
});

/* ---------------- structural component weights ----------------
   RAW weights; the effective weights are these renormalized to sum to
   one, which reproduces the v6 effective vector exactly:
     networkInfluence 0.2777778, geo 0.2222222, policy 0.2222222,
     nonSubstitutability 0.1666667, market 0.1111111.
   The v6 `shock` weight (0.10) is DELETED: it was declared but never
   read, because the structural layer is by definition event-free.
   Sensitivity varies each RAW weight by +/-25% and renormalizes the
   complete vector, so the effective vector always sums to one. */
export const STRUCTURAL_WEIGHT_SPECS = Object.freeze({
  networkInfluence: P({
    name: 'structuralWeight.networkInfluence', symbol: 'w^{\\mathrm{struct}}_{\\mathrm{NI}}',
    definition: 'Raw weight of the network-influence component in the structural vulnerability index. As of v7.1 that component is SPILLOVER REACH — the economically weighted downstream field a unit shock at this stage produces at OTHER stages, excluding the stage itself.',
    low: 0.1875, base: 0.25, high: 0.3125, domain: [0, 1], units: 'dimensionless',
    component: 'structural.weights',
    rationale: 'Largest single weight in v6 and retained for continuity: how much of the chain a stage can reach is the one structural component derived entirely from the graph rather than from an analyst score. In v7.0 the underlying quantity wrongly included the stage\'s own economic weight, which both flattered terminal stages and counted economic size twice against `market`; v7.1 excludes the source, so this component is now purely about reach. Range is +/-25% of the raw value.',
    affects: ['structural vulnerability', 'country structural score'],
  }),
  geo: P({
    name: 'structuralWeight.geo', symbol: 'w^{\\mathrm{struct}}_{\\mathrm{geo}}',
    definition: 'Raw weight of the geographic-concentration (HHI) component in the structural vulnerability index.',
    low: 0.15, base: 0.20, high: 0.25, domain: [0, 1], units: 'dimensionless',
    component: 'structural.weights',
    rationale: 'Retains the v6 raw value. Concentration is computed from disclosed country shares, so it is better evidenced than the analyst-scored components and carries a correspondingly higher weight. Range is +/-25%.',
    affects: ['structural vulnerability', 'country structural score'],
  }),
  policy: P({
    name: 'structuralWeight.policy', symbol: 'w^{\\mathrm{struct}}_{\\mathrm{pol}}',
    definition: 'Raw weight of the policy-exposure component in the structural vulnerability index.',
    low: 0.15, base: 0.20, high: 0.25, domain: [0, 1], units: 'dimensionless',
    component: 'structural.weights',
    rationale: 'Retains the v6 raw value; policy exposure is derived from a curated register of standing controls, not from event flow. Range is +/-25%.',
    affects: ['structural vulnerability', 'country structural score'],
  }),
  nonSubstitutability: P({
    name: 'structuralWeight.nonSubstitutability', symbol: 'w^{\\mathrm{struct}}_{\\nu}',
    definition: 'Raw weight of the non-substitutability (specificity) component in the structural vulnerability index.',
    low: 0.1125, base: 0.15, high: 0.1875, domain: [0, 1], units: 'dimensionless',
    component: 'structural.weights',
    rationale: 'Retains the v6 raw value under the corrected name (v6 called the field `subst`, "substitutability", while using it with the opposite sense). A declared analyst ordinal, hence a lower weight than the measured components. Range is +/-25%.',
    affects: ['structural vulnerability', 'country structural score'],
  }),
  market: P({
    name: 'structuralWeight.market', symbol: 'w^{\\mathrm{struct}}_{\\mathrm{mkt}}',
    definition: 'Raw weight of the market-importance component in the structural vulnerability index.',
    low: 0.075, base: 0.10, high: 0.125, domain: [0, 1], units: 'dimensionless',
    component: 'structural.weights',
    rationale: 'Retains the v6 raw value. The most purely judgemental of the five components, so it carries the smallest weight. Range is +/-25%.',
    affects: ['structural vulnerability', 'country structural score'],
  }),
});

export const STRUCTURAL_COMPONENTS = Object.freeze(Object.keys(STRUCTURAL_WEIGHT_SPECS));

/* ---------------- categorical model-form choices ----------------
   These are NOT numerical parameters and must never be interpolated or
   sampled as if continuous. Global sensitivity reports their effect
   separately from the continuous parameters (spec §8). */
const F = (spec) => Object.freeze({ ...spec, status: 'assumption', modelVersion: MODEL_VERSION });

export const MODEL_FORMS = Object.freeze({
  severityMapping: F({
    name: 'severityMapping', symbol: 'g',
    definition: 'Mapping from the displayed 1-10 ordinal severity rubric to a [0,1] modeled intensity.',
    options: Object.freeze(['linear', 'concave', 'convex']),
    base: 'linear',
    component: 'event source vector',
    rationale: 'Severity is an ORDINAL human rubric, so no mapping to a cardinal intensity is calibrated, or even identifiable from the rubric alone. Linear is the continuity base because it is the v6 behaviour and the least committed of the three; concave (square root) and convex (square) bracket it monotonically and are reported as model-form cases.',
    affects: ['event source vector', 'stage operational field', 'headline index'],
  }),
  facilityScaleMapping: F({
    name: 'facilityScaleMapping', symbol: 'w(k)',
    definition: 'Mapping from a site’s ordinal 1-5 `scale` field to a site weight in the modeled facility footprint.',
    options: Object.freeze(['equal', 'linear', 'convex']),
    base: 'linear',
    component: 'facilities.footprint',
    rationale: '`scale` is an analyst ordinal, so ratios of its values are NOT observed production capacity and no mapping is calibrated. Linear w(k)=k is the continuity base (the v6 behaviour); equal w(k)=1 discards the ordinal entirely and convex w(k)=k^2 assumes large sites dominate, bracketing it.',
    affects: ['modeled facility footprint', 'hazard stage exposure', 'hazard scenario delta'],
  }),
  incidentAggregation: F({
    name: 'incidentAggregation', symbol: 'A',
    definition: 'Bounded operator combining the per-stage fields of DISTINCT, deduplicated incidents of the same sign.',
    options: Object.freeze(['bounded_union', 'max', 'clipped_sum']),
    base: 'bounded_union',
    component: 'incident aggregation',
    rationale: 'bounded_union, 1 - prod(1 - x_i), is the continuity base because it saturates rather than exceeding 1 and a second adverse incident can never reduce the total. It is a BOUNDED AGGREGATION OPERATOR, not an assumption of probabilistic independence: the incidents are not events in a probability space. max (only the largest incident counts) and clipped_sum (fully additive up to the bound) bracket it.',
    affects: ['stage operational field', 'headline index', 'country measures'],
  }),
  hhiResidual: F({
    name: 'hhiResidual', symbol: 'HHI bound',
    definition: 'Which bound of the partially observed Herfindahl-Hirschman index to publish as the geographic-concentration score.',
    options: Object.freeze(['upper', 'lower']),
    base: 'upper',
    component: 'structural.geo',
    rationale: 'Disclosed country shares often sum to less than one. The LOWER bound (sum of squared observed shares) assumes the unobserved residual is infinitely fragmented; the UPPER bound adds the squared residual, i.e. assumes it is one undisclosed holder. The upper bound is the explicitly conservative base for a concentration measure; both are published and both enter sensitivity.',
    affects: ['geographic concentration', 'structural vulnerability', 'country structural score'],
  }),
  stageWeighting: F({
    name: 'stageWeighting', symbol: 'w_s',
    definition: 'How the stage economic weights used by the headline index and the country chain contribution are derived from the stage turnover proxy.',
    options: Object.freeze(['turnover_normalized', 'equal', 'log_turnover']),
    base: 'turnover_normalized',
    component: 'aggregation.weights',
    rationale: 'Turnover is an IMPORTANCE PROXY, not an additive loss base: supply-chain turnover is sequential, so summing it counts the same silicon at every stage. turnover_normalized (value_s divided by the total) is the base because it is the most direct reading of the proxy and sums to one by construction; equal (1/n) drops the proxy entirely and log_turnover compresses its skew, bracketing it.',
    affects: ['headline index', 'country chain contribution', 'network influence'],
  }),
  policyAggregator: F({
    name: 'policyAggregator', symbol: 'A_pol',
    definition: 'Bounded operator combining per-family policy severities into a stage policy-exposure score.',
    options: Object.freeze(['bounded_union', 'max', 'clipped_sum']),
    base: 'bounded_union',
    component: 'structural.policy',
    rationale: 'Replaces the v6 record-count-driven "strongest + 0.4 times the sum of the rest", which grew without bound in the number of RECORDS and so rose when one control was re-reported. The family-level bounded union saturates at 10 and is invariant to duplicate records and revisions by construction.',
    affects: ['policy exposure', 'structural vulnerability', 'country structural score'],
  }),
});

/* ---------------- validation ---------------- */
const REQUIRED_FIELDS = ['name', 'symbol', 'definition', 'low', 'base', 'high', 'domain', 'units', 'component', 'rationale', 'status', 'modelVersion', 'affects'];

export function validateRegistry() {
  const errors = [];
  const all = { ...PARAMETERS, ...STRUCTURAL_WEIGHT_SPECS };
  for (const [key, spec] of Object.entries(all)) {
    for (const f of REQUIRED_FIELDS) {
      const v = spec[f];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) errors.push(`${key}: missing required field "${f}"`);
    }
    const [min, max] = spec.domain || [];
    for (const level of ['low', 'base', 'high']) {
      const v = spec[level];
      if (!Number.isFinite(v)) { errors.push(`${key}.${level} is not finite`); continue; }
      if (v < min || v > max) errors.push(`${key}.${level}=${v} outside domain [${min},${max}]`);
      if (spec.exclusiveMax && v >= max) errors.push(`${key}.${level}=${v} must be strictly below ${max}`);
    }
    if (!(spec.low <= spec.base && spec.base <= spec.high)) errors.push(`${key}: low<=base<=high violated (${spec.low}/${spec.base}/${spec.high})`);
    if (spec.status !== 'assumption' && spec.status !== 'calibrated') errors.push(`${key}: status must be "assumption" or "calibrated", got "${spec.status}"`);
    if (spec.modelVersion !== MODEL_VERSION) errors.push(`${key}: modelVersion "${spec.modelVersion}" != "${MODEL_VERSION}"`);
  }
  for (const [key, spec] of Object.entries(MODEL_FORMS)) {
    if (!spec.options?.length) errors.push(`modelForm ${key}: no options`);
    if (!spec.options?.includes(spec.base)) errors.push(`modelForm ${key}: base "${spec.base}" not among options`);
    if (!spec.rationale) errors.push(`modelForm ${key}: missing rationale`);
    if (!spec.definition) errors.push(`modelForm ${key}: missing definition`);
    if (!spec.affects?.length) errors.push(`modelForm ${key}: missing affects`);
    if (spec.modelVersion !== MODEL_VERSION) errors.push(`modelForm ${key}: stale modelVersion`);
  }
  return { valid: errors.length === 0, errors };
}

{
  const check = validateRegistry();
  if (!check.valid) throw new Error(`v7 parameter registry is invalid:\n  ${check.errors.join('\n  ')}`);
}

/* ---------------- resolved parameter sets ---------------- */

/* Effective (normalized) structural weights for any raw weight vector. */
export function normalizeStructuralWeights(raw) {
  const sum = STRUCTURAL_COMPONENTS.reduce((a, k) => a + (raw[k] ?? 0), 0);
  if (!(sum > 0)) throw new Error('structural weights sum to zero');
  return Object.freeze(Object.fromEntries(STRUCTURAL_COMPONENTS.map((k) => [k, (raw[k] ?? 0) / sum])));
}

const rawAt = (level) => Object.fromEntries(STRUCTURAL_COMPONENTS.map((k) => [k, STRUCTURAL_WEIGHT_SPECS[k][level]]));

export const BASE_STRUCTURAL_WEIGHTS_RAW = Object.freeze(rawAt('base'));
export const BASE_STRUCTURAL_WEIGHTS = normalizeStructuralWeights(BASE_STRUCTURAL_WEIGHTS_RAW);

const paramsAt = (level) => Object.fromEntries(Object.keys(PARAMETERS).map((k) => [k, PARAMETERS[k][level]]));

const BASE_FORMS = Object.fromEntries(Object.entries(MODEL_FORMS).map(([k, v]) => [k, v.base]));

/* The single canonical parameter set the engine runs on by default. */
export const BASE_PARAMS = Object.freeze({
  ...paramsAt('base'),
  ...BASE_FORMS,
  structuralWeightsRaw: BASE_STRUCTURAL_WEIGHTS_RAW,
  structuralWeights: BASE_STRUCTURAL_WEIGHTS,
  modelVersion: MODEL_VERSION,
});

/* Build a validated parameter set from partial overrides. Unknown keys are
   rejected loudly: a typo'd override that silently does nothing is exactly
   how a sensitivity sweep comes to report "this parameter has no effect". */
export function resolveParams(overrides = {}) {
  const out = { ...BASE_PARAMS };
  const errors = [];
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (k === 'structuralWeightsRaw') {
      const raw = { ...BASE_STRUCTURAL_WEIGHTS_RAW, ...v };
      for (const [ck, cv] of Object.entries(raw)) {
        if (!STRUCTURAL_COMPONENTS.includes(ck)) errors.push(`structuralWeightsRaw.${ck} is not a v7 structural component`);
        else if (!Number.isFinite(cv) || cv < 0) errors.push(`structuralWeightsRaw.${ck}=${cv} must be a nonnegative finite number`);
      }
      if (!errors.length) { out.structuralWeightsRaw = Object.freeze(raw); out.structuralWeights = normalizeStructuralWeights(raw); }
      continue;
    }
    if (k === 'structuralWeights' || k === 'modelVersion') continue; // derived / fixed
    if (k in PARAMETERS) {
      if (!Number.isFinite(v)) { errors.push(`${k}: "${v}" is not a finite number`); continue; }
      const spec = PARAMETERS[k];
      const [min, max] = spec.domain;
      if (v < min || v > max || (spec.exclusiveMax && v >= max)) {
        errors.push(`${k}=${v} outside valid domain [${min},${max}${spec.exclusiveMax ? ')' : ']'}`);
        continue;
      }
      out[k] = v;
      continue;
    }
    if (k in MODEL_FORMS) {
      if (!MODEL_FORMS[k].options.includes(v)) { errors.push(`${k}="${v}" is not one of ${MODEL_FORMS[k].options.join('|')}`); continue; }
      out[k] = v;
      continue;
    }
    errors.push(`unknown parameter "${k}" — not in the v7 registry`);
  }
  if (errors.length) throw new Error(`invalid v7 parameter override:\n  ${errors.join('\n  ')}`);
  return Object.freeze(out);
}

/* ---------------- v6 compatibility adapter ----------------
   Stored v6 artefacts (archived briefings, saved playground states, the
   frozen v6 benchmark) carry the old names. This translates them into v7
   names so they can be READ; it does not make the old names part of the
   v7 output surface, which uses the unambiguous names everywhere. */
export const V6_TO_V7_PARAMETER_NAMES = Object.freeze({
  halfLifeDays: 'acuteHalfLifeDays',
  specificityFloor: 'minimumDependencyFactor',
  downstreamTransmission: 'downstreamTransmission',
  upstreamTransmission: 'upstreamTransmission',
});

/* Field renames inside stored stage / component records. */
export const V6_TO_V7_FIELD_NAMES = Object.freeze({
  subst: 'nonSubstitutability',
  choke: 'networkInfluence',
});

/* Translate a v6 stage record's fields to v7 names, keeping the values. */
export function adaptLegacyStage(stage = {}) {
  const out = { ...stage };
  for (const [v6, v7] of Object.entries(V6_TO_V7_FIELD_NAMES)) {
    if (v6 in out && !(v7 in out)) out[v7] = out[v6];
  }
  return out;
}

export function adaptLegacyPriors(v6 = {}) {
  const overrides = {};
  const dropped = [];
  for (const [k, v] of Object.entries(v6 ?? {})) {
    if (k === 'contributionTolerance') { dropped.push('contributionTolerance (v7 propagation is exact on a finite DAG — nothing is truncated)'); continue; }
    if (k === 'componentWeights') {
      const raw = {};
      for (const [ck, cv] of Object.entries(v ?? {})) {
        if (ck === 'shock') { dropped.push('componentWeights.shock (declared but never read in v6; the structural layer is event-free)'); continue; }
        const target = V6_TO_V7_FIELD_NAMES[ck] ?? ck;
        if (STRUCTURAL_COMPONENTS.includes(target)) raw[target] = cv;
        else dropped.push(`componentWeights.${ck} (no v7 structural component)`);
      }
      if (Object.keys(raw).length) overrides.structuralWeightsRaw = raw;
      continue;
    }
    const mapped = V6_TO_V7_PARAMETER_NAMES[k];
    if (mapped) { overrides[mapped] = v; continue; }
    if (k === 'modelVersion' || k === 'datasetAsOf') continue;
    dropped.push(`${k} (not a v7 parameter)`);
  }
  return { params: resolveParams(overrides), dropped };
}

/* A flat, serializable register for the documentation build and the
   code-documentation parity test, so parameter tables in the spec are
   GENERATED from this file rather than retyped alongside it. */
export function parameterRegister() {
  return {
    modelVersion: MODEL_VERSION,
    parameters: Object.values(PARAMETERS).map((p) => ({ ...p })),
    structuralWeights: Object.entries(STRUCTURAL_WEIGHT_SPECS).map(([k, p]) => ({
      ...p, key: k, effectiveBase: BASE_STRUCTURAL_WEIGHTS[k],
    })),
    modelForms: Object.values(MODEL_FORMS).map((f) => ({ ...f, options: [...f.options] })),
  };
}
