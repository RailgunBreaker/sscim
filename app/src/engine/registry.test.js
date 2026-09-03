/* ====================================================================
   registry.test.js — the parameter registry's own contract.

   The registry is the single source of truth for every coefficient in the
   model AND for the parameter tables printed in the documentation. If it
   is incomplete, mislabelled, or drifts from the published ranges, both
   the model and the documentation are wrong at once — so it is validated
   here as strictly as any calculation.
   ==================================================================== */
import { describe, it, expect } from 'vitest';
import {
  MODEL_VERSION, PARAMETERS, STRUCTURAL_WEIGHT_SPECS, STRUCTURAL_COMPONENTS, MODEL_FORMS,
  BASE_PARAMS, BASE_STRUCTURAL_WEIGHTS, BASE_STRUCTURAL_WEIGHTS_RAW,
  validateRegistry, resolveParams, normalizeStructuralWeights,
  adaptLegacyPriors, adaptLegacyStage, parameterRegister,
  V6_TO_V7_PARAMETER_NAMES, V6_TO_V7_FIELD_NAMES,
} from './registry.js';

const REQUIRED = ['name', 'symbol', 'definition', 'low', 'base', 'high', 'domain', 'units', 'component', 'rationale', 'status', 'modelVersion', 'affects'];

describe('the registry is complete and internally valid', () => {
  it('validates', () => {
    const r = validateRegistry();
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('declares the v7 model version, and every entry carries it', () => {
    expect(MODEL_VERSION).toBe('sscim-model-v7-exposure-robustness');
    [...Object.values(PARAMETERS), ...Object.values(STRUCTURAL_WEIGHT_SPECS), ...Object.values(MODEL_FORMS)]
      .forEach((p) => expect(p.modelVersion).toBe(MODEL_VERSION));
  });

  it.each(Object.keys(PARAMETERS))('%s carries every required field', (key) => {
    REQUIRED.forEach((f) => {
      const v = PARAMETERS[key][f];
      expect(v === undefined || v === null || v === '').toBe(false);
    });
  });

  it('marks every parameter as an assumption — nothing has been calibrated', () => {
    [...Object.values(PARAMETERS), ...Object.values(STRUCTURAL_WEIGHT_SPECS)]
      .forEach((p) => expect(p.status).toBe('assumption'));
  });

  it('publishes exactly the stress ranges the specification states', () => {
    const expected = {
      downstreamTransmission: [0.30, 0.55, 0.80],
      upstreamTransmission: [0.10, 0.30, 0.50],
      minimumDependencyFactor: [0.10, 0.25, 0.40],
      acuteHalfLifeDays: [7, 14, 30],
      marketHalfLifeDays: [21, 45, 90],
      outageRecoveryDays: [30, 60, 120],
      rampingSiteWeight: [0.25, 0.50, 0.75],
    };
    expect(Object.keys(PARAMETERS).sort()).toEqual(Object.keys(expected).sort());
    for (const [k, [low, base, high]] of Object.entries(expected)) {
      expect([PARAMETERS[k].low, PARAMETERS[k].base, PARAMETERS[k].high]).toEqual([low, base, high]);
    }
  });

  it('keeps both transmission coefficients strictly below 1, at every level', () => {
    for (const k of ['downstreamTransmission', 'upstreamTransmission']) {
      expect(PARAMETERS[k].exclusiveMax).toBe(true);
      ['low', 'base', 'high'].forEach((level) => expect(PARAMETERS[k][level]).toBeLessThan(1));
    }
  });
});

describe('structural weights', () => {
  it('reproduce the v6 effective vector exactly', () => {
    expect(BASE_STRUCTURAL_WEIGHTS.networkInfluence).toBeCloseTo(0.2777778, 7);
    expect(BASE_STRUCTURAL_WEIGHTS.geo).toBeCloseTo(0.2222222, 7);
    expect(BASE_STRUCTURAL_WEIGHTS.policy).toBeCloseTo(0.2222222, 7);
    expect(BASE_STRUCTURAL_WEIGHTS.nonSubstitutability).toBeCloseTo(0.1666667, 7);
    expect(BASE_STRUCTURAL_WEIGHTS.market).toBeCloseTo(0.1111111, 7);
    expect(Object.values(BASE_STRUCTURAL_WEIGHTS).reduce((a, v) => a + v, 0)).toBeCloseTo(1, 12);
  });

  it('has NO shock component — the structural layer is event-free', () => {
    expect(STRUCTURAL_COMPONENTS).not.toContain('shock');
    expect(BASE_STRUCTURAL_WEIGHTS_RAW.shock).toBeUndefined();
  });

  it('varies each raw weight by exactly +/-25%', () => {
    for (const k of STRUCTURAL_COMPONENTS) {
      const s = STRUCTURAL_WEIGHT_SPECS[k];
      expect(s.low).toBeCloseTo(s.base * 0.75, 12);
      expect(s.high).toBeCloseTo(s.base * 1.25, 12);
    }
  });

  it('renormalizes the COMPLETE vector to one after any single perturbation', () => {
    for (const k of STRUCTURAL_COMPONENTS) {
      for (const level of ['low', 'high']) {
        const raw = { ...BASE_STRUCTURAL_WEIGHTS_RAW, [k]: STRUCTURAL_WEIGHT_SPECS[k][level] };
        const w = normalizeStructuralWeights(raw);
        expect(Object.values(w).reduce((a, v) => a + v, 0)).toBeCloseTo(1, 12);
      }
    }
  });
});

describe('model forms are categorical, declared, and bracketed by their base', () => {
  it.each(Object.keys(MODEL_FORMS))('%s declares options, a base among them, and a rationale', (key) => {
    const f = MODEL_FORMS[key];
    expect(f.options.length).toBeGreaterThanOrEqual(2);
    expect(f.options).toContain(f.base);
    expect(f.rationale.length).toBeGreaterThan(40);
    expect(f.definition).toBeTruthy();
  });

  it('keeps the v6 behaviour as the continuity base wherever one existed', () => {
    expect(MODEL_FORMS.severityMapping.base).toBe('linear');
    expect(MODEL_FORMS.facilityScaleMapping.base).toBe('linear');
    expect(MODEL_FORMS.incidentAggregation.base).toBe('bounded_union');
    expect(MODEL_FORMS.stageWeighting.base).toBe('turnover_normalized');
  });

  it('never calls the bounded union an independence assumption', () => {
    expect(MODEL_FORMS.incidentAggregation.rationale).toMatch(/not an assumption of probabilistic independence/i);
  });
});

describe('resolveParams()', () => {
  it('returns the base set unchanged for no overrides', () => {
    expect(resolveParams()).toEqual(BASE_PARAMS);
  });

  it('accepts a valid numerical override', () => {
    expect(resolveParams({ downstreamTransmission: 0.42 }).downstreamTransmission).toBe(0.42);
  });

  it('REJECTS an unknown parameter rather than silently ignoring it', () => {
    expect(() => resolveParams({ halfLifeDays: 12 })).toThrow(/unknown parameter "halfLifeDays"/);
    expect(() => resolveParams({ specificityFloor: 0.2 })).toThrow(/unknown parameter/);
  });

  it('rejects a value outside its declared domain, including the exclusive upper bound', () => {
    expect(() => resolveParams({ downstreamTransmission: 1 })).toThrow(/outside valid domain/);
    expect(() => resolveParams({ downstreamTransmission: -0.1 })).toThrow(/outside valid domain/);
    expect(() => resolveParams({ acuteHalfLifeDays: 0 })).toThrow(/outside valid domain/);
  });

  it('rejects an undeclared model-form option', () => {
    expect(() => resolveParams({ severityMapping: 'sigmoid' })).toThrow(/is not one of/);
  });

  it('rejects a non-numeric value rather than coercing it', () => {
    expect(() => resolveParams({ downstreamTransmission: '0.5' })).toThrow(/not a finite number/);
  });
});

describe('the v6 compatibility adapter', () => {
  const v6 = {
    halfLifeDays: 12,
    downstreamTransmission: 0.55,
    upstreamTransmission: 0.30,
    specificityFloor: 0.25,
    contributionTolerance: 1e-4,
    componentWeights: { choke: 0.25, geo: 0.20, policy: 0.20, subst: 0.15, shock: 0.10, market: 0.10 },
    modelVersion: 'sscim-model-v6-client-sensitivity',
  };

  it('renames the two misleading parameters', () => {
    expect(V6_TO_V7_PARAMETER_NAMES.specificityFloor).toBe('minimumDependencyFactor');
    expect(V6_TO_V7_PARAMETER_NAMES.halfLifeDays).toBe('acuteHalfLifeDays');
    const { params } = adaptLegacyPriors(v6);
    expect(params.acuteHalfLifeDays).toBe(12);
    expect(params.minimumDependencyFactor).toBe(0.25);
  });

  it('renames the two misleading stage fields', () => {
    expect(V6_TO_V7_FIELD_NAMES.subst).toBe('nonSubstitutability');
    expect(V6_TO_V7_FIELD_NAMES.choke).toBe('networkInfluence');
    expect(adaptLegacyStage({ subst: 6.5, choke: 3 })).toMatchObject({ nonSubstitutability: 6.5, networkInfluence: 3 });
  });

  it('DROPS the two dead v6 concepts, and says so', () => {
    const { dropped } = adaptLegacyPriors(v6);
    expect(dropped.join(' ')).toMatch(/contributionTolerance/);
    expect(dropped.join(' ')).toMatch(/componentWeights\.shock/);
  });

  it('maps the v6 component weights onto the same effective v7 vector', () => {
    const { params } = adaptLegacyPriors(v6);
    expect(params.structuralWeights).toEqual(BASE_STRUCTURAL_WEIGHTS);
  });
});

describe('parameterRegister() — what the documentation build reads', () => {
  it('serializes every parameter, structural weight and model form', () => {
    const r = parameterRegister();
    expect(r.modelVersion).toBe(MODEL_VERSION);
    expect(r.parameters).toHaveLength(Object.keys(PARAMETERS).length);
    expect(r.structuralWeights).toHaveLength(STRUCTURAL_COMPONENTS.length);
    expect(r.modelForms).toHaveLength(Object.keys(MODEL_FORMS).length);
    r.structuralWeights.forEach((w) => expect(w.effectiveBase).toBeCloseTo(BASE_STRUCTURAL_WEIGHTS[w.key], 12));
  });
});
