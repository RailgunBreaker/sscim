/* ====================================================================
   curationUncertainty.js — THE THIRD KIND OF UNCERTAINTY.

   The global sensitivity design varies the model's PARAMETERS and its
   MODEL FORMS. Neither touches the numbers a person wrote down about each
   incident: how much of a stage it touches (alpha) and which persistence
   profile it follows. Those are judgements made from a news record, they
   are frequently the largest single input to a published figure, and until
   now they were varied by nothing at all — which is to say they were
   treated as exact.

   This module varies them, and reports the effect SEPARATELY, so a reader
   can tell three different things apart:

     1. parameter uncertainty   — the coefficients (sensitivity.js)
     2. model-form uncertainty  — the structural choices (sensitivity.js)
     3. curation uncertainty    — the per-incident judgements (here)

   HOW THE BANDS ARE CHOSEN. An incident may declare `exposureLow` and
   `exposureHigh` per stage. Where it does not, a band is derived from its
   `evidenceStrength`, which says how specific the underlying record is:

     strong    the record names sites, volumes or dated scopes   +/-25%
     moderate  the record names the affected parties, not amounts +/-50%
     weak      the scope is inferred from the record's subject    +/-75%

   These are RELATIVE bands on the curated value, clipped to [0,1]. They
   are deliberately broad, and they are assumptions about how wrong a
   judgement might be — not measurements of how wrong it is. A wide band on
   a weakly evidenced incident is the honest representation; a narrow one
   would be invented precision.

   PROFILE ALTERNATIVES. Where an incident could defensibly have been
   classified differently, `altProfile` records the alternative. Swapping to
   it is a discrete jump, so profile variation is reported as its own
   scenario rather than blended into the exposure band.
   ==================================================================== */
import { EVENT_MODEL } from './event-model.js';
import { getEventAssumption, incidentOf } from './event-assumptions.js';
import { groupIncidents } from './eventSource.js';
import { makeRng } from './sensitivity.js';

export const CURATION_SEED = 20260906;
export const TESTED_RANGE_LABEL = 'Range over tested curation scenarios; not a proven bound or statistical confidence interval.';
export const COMPANY_CURATION_LABEL = 'Structurally unaffected: company criticality uses company stakes and network/structural inputs, which this event-curation experiment holds fixed. This is not empirical validation.';

/* These are explicit stress dependencies, not estimated correlations. Multiple
   reports already grouped into one incident still get only one perturbation. */
export const SHARED_ASSUMPTION_GROUPS = Object.freeze([
  { id: 'memory-allocation', eventIds: ['h2512_memory', 'h2603_memorypeak', 'p260807_man0807'],
    rationale: 'These records describe the same broader commodity-memory/HBM allocation episode. A common scope judgement can affect all; incident deduplication remains in force.' },
  { id: 'advanced-computing-licensing', eventIds: ['e1', 'h2606_subs', 'h2601_ease', 'h2507_h20back', 'h2504_h20', 'h2412_bis3'],
    rationale: 'Related advanced-computing controls and licensing relief reuse judgements about the affected product/customer scope. Test shared scope error and opposing adverse/mitigating scope error, without claiming an observed correlation.' },
]);

/* Relative half-width of the exposure band, by evidence strength. */
export const EVIDENCE_BANDS = Object.freeze({
  strong: 0.25,
  moderate: 0.50,
  weak: 0.75,
});

export const DEFAULT_EVIDENCE_STRENGTH = 'moderate';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* The low/base/high exposure vectors for one curated incident. */
export function exposureBand(curated) {
  if (!curated?.exposure) return null;
  const strength = curated.evidenceStrength ?? DEFAULT_EVIDENCE_STRENGTH;
  const band = EVIDENCE_BANDS[strength];
  if (band === undefined) throw new Error(`unknown evidenceStrength "${strength}" — expected ${Object.keys(EVIDENCE_BANDS).join('|')}`);

  const low = {}, base = {}, high = {};
  for (const [stage, alpha] of Object.entries(curated.exposure)) {
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error(`invalid base exposure for ${stage}`);
    base[stage] = alpha;
    low[stage] = clamp01(curated.exposureLow?.[stage] ?? alpha * (1 - band));
    high[stage] = clamp01(curated.exposureHigh?.[stage] ?? alpha * (1 + band));
    if (!Number.isFinite(low[stage]) || !Number.isFinite(high[stage]) || low[stage] > alpha || high[stage] < alpha) {
      throw new Error(`exposure band for ${stage} must contain its baseline`);
    }
  }
  return { low, base, high, evidenceStrength: strength, band, declared: Boolean(curated.exposureLow || curated.exposureHigh) };
}

/* Every curated incident that carries an exposure vector, with its band. */
export function curationBands(model = EVENT_MODEL) {
  return Object.entries(model)
    .map(([id, curated]) => ({ id, curated, band: exposureBand(curated) }))
    .filter((x) => x.band);
}

/* Apply a curation variant to the event model, returning an override map
   the engine accepts per event (`event.model`). `level` is 'low' | 'base' |
   'high'; `useAltProfile` swaps in the declared alternative where one
   exists. */
export function curationVariant({ level = 'base', useAltProfile = false, model = EVENT_MODEL } = {}) {
  if (!['low', 'base', 'high'].includes(level)) throw new Error(`unknown exposure level ${level}`);
  const out = {};
  for (const { id, curated, band } of curationBands(model)) {
    const profile = useAltProfile && curated.altProfile ? curated.altProfile : curated.profile;
    out[id] = { ...curated, exposure: band[level], profile };
  }
  return out;
}

/* Incidents whose exposure band is DERIVED from evidence strength rather
   than declared per stage. Counted so the report can say how much of the
   curation uncertainty rests on a default rather than on a judgement. */
export function derivedBandCount(model = EVENT_MODEL) {
  return curationBands(model).filter((x) => !x.band.declared).length;
}

/* Incidents that declare a defensible alternative profile. */
export function alternativeProfileCount(model = EVENT_MODEL) {
  return Object.values(model).filter((c) => c.altProfile).length;
}

/* An incident's whole exposure vector moves together: stage components within
   an incident are not sampled independently. Only primary records are changed;
   evidence eligibility, record confidence and severity are never overridden. */
export function buildCurationDesign({ events, model = EVENT_MODEL, assumptionOf = (e) => e.assumption || getEventAssumption(e.id),
  incidentLookup = incidentOf, sharedGroups = SHARED_ASSUMPTION_GROUPS, seed = CURATION_SEED, samples = 32 } = {}) {
  if (!Number.isInteger(samples) || samples < 0) throw new Error('samples must be a nonnegative integer');
  const incidents = groupIncidents(events || [], { incidentOf: incidentLookup }).map((group) => {
    const curated = group.primary.model || model[group.primary.id];
    return { id: group.primary.id, incidentId: group.incidentId, records: group.records,
      curated, band: exposureBand(curated), direction: assumptionOf(group.primary)?.direction };
  }).filter((incident) => incident.band);
  const byId = Object.fromEntries(incidents.map((incident) => [incident.id, incident]));
  const resolveGroupIds = (group) => [...new Set(group.eventIds.map((id) => {
    return incidents.find((incident) => incident.records.some((record) => record.id === id))?.id;
  }).filter(Boolean))].sort();
  const groups = sharedGroups.map((group) => ({ ...group, primaryIds: resolveGroupIds(group) }))
    .filter((group) => group.primaryIds.length);
  const alternatives = incidents.filter((incident) => incident.curated.altProfile).map((incident) => incident.id);
  const scenarios = [];
  function add(id, kind, levels = {}, profiles = [], metadata = {}) {
    const profileIds = new Set(profiles);
    const overrides = {};
    for (const incident of incidents) {
      const level = levels[incident.id] ?? 'base';
      let exposure;
      if (typeof level === 'number') {
        if (level < 0 || level > 1 || !Number.isFinite(level)) throw new Error('exposure coordinate outside [0,1]');
        exposure = Object.fromEntries(Object.keys(incident.band.base).map((stage) => [stage,
          incident.band.low[stage] + level * (incident.band.high[stage] - incident.band.low[stage])]));
      } else {
        exposure = incident.band[level];
        if (!exposure) throw new Error(`unknown exposure level ${level}`);
      }
      if (level !== 'base' || profileIds.has(incident.id)) {
        overrides[incident.id] = { ...incident.curated, exposure,
          profile: profileIds.has(incident.id) ? incident.curated.altProfile : incident.curated.profile };
      }
    }
    scenarios.push({ id, kind, exposureLevels: levels, alternativeProfileIds: profiles, ...metadata, overrides });
  }
  const levelsFor = (ids, pattern) => Object.fromEntries(ids.map((id) => [id,
    pattern === 'all-low' ? 'low' : pattern === 'all-high' ? 'high'
      : pattern === 'adverse-low-mitigating-high' ? (byId[id].direction === 'adverse' ? 'low' : byId[id].direction === 'mitigating' ? 'high' : 'base')
        : pattern === 'adverse-high-mitigating-low' ? (byId[id].direction === 'adverse' ? 'high' : byId[id].direction === 'mitigating' ? 'low' : 'base')
          : 'base']));
  const patterns = ['baseline', 'all-low', 'all-high', 'adverse-low-mitigating-high', 'adverse-high-mitigating-low'];
  const allIds = incidents.map((incident) => incident.id);
  add('baseline', 'baseline');
  for (const pattern of patterns.slice(1)) add(pattern, 'global-exposure', levelsFor(allIds, pattern));
  for (const incident of incidents) {
    for (const level of ['low', 'high']) add(`incident:${incident.incidentId}:${level}`, 'individual-exposure', { [incident.id]: level }, [], { incidentId: incident.incidentId });
    if (incident.curated.altProfile) {
      add(`profile:${incident.incidentId}`, 'individual-profile', {}, [incident.id], { incidentId: incident.incidentId });
      for (const level of ['low', 'high']) add(`incident:${incident.incidentId}:${level}:alt-profile`, 'individual-exposure-profile', { [incident.id]: level }, [incident.id], { incidentId: incident.incidentId });
    }
  }
  // Exhaust every declared profile subset for the small curated table. Retain a
  // visible cap rather than silently claiming exhaustive analysis after growth.
  const exhaustiveProfiles = alternatives.length <= 10;
  const subsets = exhaustiveProfiles
    ? Array.from({ length: 2 ** alternatives.length - 1 }, (_, index) => alternatives.filter((_, bit) => (index + 1) & (2 ** bit)))
    : [...alternatives.map((id) => [id]), alternatives];
  for (const profiles of subsets) {
    for (const pattern of patterns) add(`profiles:${profiles.join('+')}:${pattern}`, 'profile-combination', levelsFor(allIds, pattern), profiles);
  }
  for (const group of groups) {
    for (const pattern of patterns.slice(1)) {
      add(`shared:${group.id}:${pattern}`, 'shared-assumption', levelsFor(group.primaryIds, pattern), [], { sharedGroupId: group.id });
      const profiles = group.primaryIds.filter((id) => byId[id].curated.altProfile);
      if (profiles.length) add(`shared:${group.id}:${pattern}:alt-profiles`, 'shared-exposure-profile', levelsFor(group.primaryIds, pattern), profiles, { sharedGroupId: group.id });
    }
  }
  const rng = makeRng(seed);
  // One latent scope coordinate, shared across ALL incidents, plus its opposing
  // sign case. No independent per-incident draws or independence claim. The same
  // coordinate switches all alternatives together at 0.5 as a stress design.
  for (let sample = 0; sample < samples; sample++) {
    const coordinate = rng();
    const profiles = coordinate >= 0.5 ? alternatives : [];
    for (const opposing of [false, true]) {
      const levels = Object.fromEntries(incidents.map((incident) => [incident.id,
        opposing && incident.direction === 'mitigating' ? 1 - coordinate : coordinate]));
      add(`sample:${sample}:${opposing ? 'opposing' : 'coupled'}`, 'sampled-shared-factor', levels, profiles, { coordinate, opposing });
    }
  }
  return { seed, samples, incidents: incidents.map(({ curated, ...incident }) => ({ ...incident, hasAlternativeProfile: Boolean(curated.altProfile) })),
    sharedGroups: groups, profileSubsetsExhaustive: exhaustiveProfiles, scenarios,
    dependencies: 'Within-incident stage exposures move together. Named related groups share a scope judgement. Seeded sampling uses one common scope coordinate across all incidents, also tested with mitigating coordinates reversed; all alternative profiles switch together at coordinate 0.5. No incident independence or probabilistic correlation is assumed. Deterministic single-incident and profile-subset scenarios test departures from that shared-factor design.',
    limitation: 'Finite scenario design, not all continuous exposure combinations or all dependence structures. Eligibility is held fixed: absent or quarantined evidence is a separate data-coverage uncertainty.' };
}

export function applyCurationScenario(events, scenario) {
  return events.map((event) => scenario.overrides[event.id] ? { ...event, model: scenario.overrides[event.id] } : event);
}

export function testedScenarioRange(results, options = {}) {
  const valueOf = Object.hasOwn(options, 'valueOf') ? options.valueOf : (result) => result.headline;
  const baseline = results.find((result) => result.id === 'baseline');
  if (!baseline) throw new Error('tested scenario range requires an explicit baseline');
  const values = results.map(valueOf);
  if (!values.length || values.some((value) => !Number.isFinite(value))) throw new Error('tested range requires finite results');
  const low = Math.min(...values), high = Math.max(...values);
  return { low, base: valueOf(baseline), high, width: high - low,
    lowScenarioIds: results.filter((result) => valueOf(result) === low).map((result) => result.id),
    highScenarioIds: results.filter((result) => valueOf(result) === high).map((result) => result.id),
    kind: 'tested-scenario-range', label: TESTED_RANGE_LABEL, provenBound: false, confidenceInterval: false,
    testedScenarioCount: results.length };
}
