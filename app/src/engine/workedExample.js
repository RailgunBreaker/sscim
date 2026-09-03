/* ====================================================================
   workedExample.js — the FROZEN FIXTURE behind the worked numerical
   example in docs/MODEL_V7_SPEC.md §7.

   Small enough that a reader can reproduce every number with a
   calculator, and structured so that each v7 mechanism appears exactly
   once:

     · a reconvergent diamond (A -> B -> C and A -> C), so the joint
       propagation's plain summation at C is visible and distinguishable
       from the v6 noisy-OR;
     · a two-stage source vector with DIFFERENT exposures, so the removal
       of multi-stage full-shock multiplication is visible;
     · a persistence multiplier of exactly 0.5 (the incident is exactly
       one acute half-life old), so the temporal profile is checkable by
       eye;
     · country shares that sum to one at every stage, so the country chain
       contributions reconcile to the headline index exactly;
     · a second, distinct incident applied as a scenario, so incident
       aggregation and the scenario delta are both exercised.

   The engine computes these numbers; this module only declares the
   fixture and reads the intermediates out. The documentation prints them
   from here, and specDocs.test.js asserts that the printed numbers match
   what the engine produces — so a formula change that the documentation
   does not follow fails CI.
   ==================================================================== */
import { buildEngine } from './index.js';
import { BASE_PARAMS } from './registry.js';
import { severityIntensity } from './severity.js';
import { persistence } from './persistence.js';

export const WORKED_STAGES = Object.freeze([
  { id: 'A', name: 'Materials', x: 0, y: 0, value: 10, nonSubstitutability: 8, market: 5, shares: { xx: 0.6, yy: 0.4 } },
  { id: 'B', name: 'Fabrication', x: 1, y: 0, value: 40, nonSubstitutability: 6, market: 5, shares: { xx: 1.0 } },
  { id: 'C', name: 'Assembly', x: 2, y: 0, value: 20, nonSubstitutability: 4, market: 5, shares: { yy: 1.0 } },
  { id: 'D', name: 'Systems', x: 3, y: 0, value: 30, nonSubstitutability: 2, market: 5, shares: { xx: 0.5, yy: 0.5 } },
]);

/* A -> B -> C -> D with the extra chord A -> C: C is reconvergent. */
export const WORKED_EDGES = Object.freeze([['A', 'B'], ['B', 'C'], ['A', 'C'], ['C', 'D']]);

export const WORKED_COUNTRY_NAMES = Object.freeze({ xx: 'Country X', yy: 'Country Y' });

/* The baseline incident: one record, adverse, both channels, exactly one
   acute half-life old, curated exposure on two of the four stages. */
export const WORKED_INCIDENT = Object.freeze({
  id: 'worked_incident',
  date: 'day 0',
  sev: 6,
  daysAgo: BASE_PARAMS.acuteHalfLifeDays, // exactly one half-life -> R = 0.5 exactly
  conf: 'High',
  type: 'Worked example',
  title: 'Worked example incident',
  stages: ['A', 'B'],
  countries: ['xx'],
  assumption: Object.freeze({ direction: 'adverse', channel: 'both', operational: true }),
  model: Object.freeze({
    exposure: Object.freeze({ A: 0.5, B: 0.25 }),
    exposureBasis: 'Declared by the fixture: half of the materials stage and a quarter of the fabrication stage.',
    profile: Object.freeze({ kind: 'acute_exponential' }),
    profileBasis: 'Declared by the fixture, so the persistence multiplier is exactly 0.5 at the stated age.',
  }),
});

/* The scenario: a second, DISTINCT incident on the assembly stage, on its
   own date, so its persistence multiplier is exactly 1. */
export const WORKED_SCENARIO = Object.freeze({
  id: 'worked_scenario',
  date: 'day 0',
  sev: 8,
  daysAgo: 0,
  conf: 'Simulated',
  type: 'Worked example scenario',
  title: 'Worked example scenario',
  stages: ['C'],
  countries: ['yy'],
  assumption: Object.freeze({ direction: 'adverse', channel: 'both', operational: true }),
  model: Object.freeze({
    exposure: Object.freeze({ C: 0.4 }),
    exposureBasis: 'Declared by the fixture: two fifths of the assembly stage.',
    profile: Object.freeze({ kind: 'acute_exponential' }),
    profileBasis: 'Declared by the fixture, evaluated on its own date, so the persistence multiplier is exactly 1.',
  }),
});

export function workedExampleData() {
  return {
    STAGES: WORKED_STAGES.map((s) => ({ ...s, shares: { ...s.shares } })),
    FLOW_EDGES: WORKED_EDGES.map((e) => [...e]),
    COMPANIES: [{ id: 'coA', name: 'Company A', country: 'xx', stakes: { A: 0.7, B: 0.3 } }],
    CUSTOMERS: {},
    POLICIES: [],
    EVENTS: [{ ...WORKED_INCIDENT }],
    OWNERS: {},
    COUNTRY_NAMES: { ...WORKED_COUNTRY_NAMES },
  };
}

/* Every intermediate the specification prints, straight from the engine. */
export function workedExample(params = BASE_PARAMS) {
  const data = workedExampleData();
  const engine = buildEngine({ ...data, params: params === BASE_PARAMS ? undefined : params, computeHistory: false });
  const stageIds = WORKED_STAGES.map((s) => s.id);

  const { source } = engine.eventField(WORKED_INCIDENT);
  const propagated = engine.propagateVectorField(source.z, source.channel);
  const baselineField = engine.operationalField(data.EVENTS);
  const activeField = engine.operationalField([...data.EVENTS, WORKED_SCENARIO]);

  const { source: scenarioSource } = engine.eventField(WORKED_SCENARIO);
  const scenarioPropagated = engine.propagateVectorField(scenarioSource.z, scenarioSource.channel);

  const baselineCountries = engine.countryData(data.EVENTS, baselineField, data.COUNTRY_NAMES);
  const activeCountries = engine.countryData([...data.EVENTS, WORKED_SCENARIO], activeField, data.COUNTRY_NAMES);

  const baselineSigned = engine.operationalIndex(baselineField);
  const activeSigned = engine.operationalIndex(activeField);

  return {
    params: engine.PARAMS,
    stageIds,
    stageWeight: { ...engine.STAGE_WEIGHT },
    nonSubstitutabilityUnit: { ...engine.NON_SUBSTITUTABILITY_UNIT },
    allocations: { q: engine.EDGE_ALLOCATIONS.q, r: engine.EDGE_ALLOCATIONS.r },
    D: engine.D,
    U: engine.U,
    incident: {
      severity: WORKED_INCIDENT.sev,
      ageDays: WORKED_INCIDENT.daysAgo,
      intensity: source.intensity,
      persistence: source.persistence,
      exposure: source.exposure,
      sourceVector: source.z,
      downstream: propagated.adverse && propagated,
      field: propagated.field,
    },
    // The two channel vectors, exposed separately so the direct-source
    // deduplication in p = z + (x^d - z) + (x^u - z) is visible.
    channels: (() => {
      const adverse = {};
      stageIds.forEach((id) => { adverse[id] = Math.max(0, source.z[id] ?? 0); });
      const down = engine.propagateVectorField(adverse, 'downstream');
      const up = engine.propagateVectorField(adverse, 'upstream');
      return { xDown: down.field, xUp: up.field };
    })(),
    baselineField,
    baselineIndexSigned: baselineSigned,
    baselineIndexDisplay: engine.toDisplayIndex(baselineSigned),
    scenario: {
      severity: WORKED_SCENARIO.sev,
      ageDays: WORKED_SCENARIO.daysAgo,
      intensity: scenarioSource.intensity,
      persistence: scenarioSource.persistence,
      sourceVector: scenarioSource.z,
      field: scenarioPropagated.field,
    },
    activeField,
    activeIndexSigned: activeSigned,
    activeIndexDisplay: engine.toDisplayIndex(activeSigned),
    scenarioDelta: engine.toDisplayIndex(activeSigned) - engine.toDisplayIndex(baselineSigned),
    countries: {
      baseline: baselineCountries,
      active: activeCountries,
    },
    /* Independent arithmetic checks the documentation quotes. */
    checks: {
      persistenceIsExactlyHalf: persistence('acute_exponential', WORKED_INCIDENT.daysAgo, engine.PARAMS) === 0.5,
      intensityIsSeverityOverTen: severityIntensity(WORKED_INCIDENT.sev, 'linear') === 0.6,
      countryChainReconciles: Math.abs(
        Object.values(baselineCountries).reduce((a, c) => a + c.chainContribution, 0) - baselineSigned,
      ) < 1e-12,
      stageWeightsSumToOne: Math.abs(Object.values(engine.STAGE_WEIGHT).reduce((a, v) => a + v, 0) - 1) < 1e-12,
    },
  };
}
