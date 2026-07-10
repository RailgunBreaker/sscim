/* Builds the scenario-aware model: baseline (real snapshot events only),
   active (baseline + the currently-selected scenario, if any), their
   signed per-stage/per-country deltas, and a deterministic sensitivity
   envelope. Nothing here is a forecast — see MODEL_ROADMAP.md and the
   Methodology overlay for what each number does and doesn't mean.

   Pure and dependency-free (no React/Leaflet) so it can be unit-tested
   directly and reused by App.jsx without pulling in the component tree. */
export function buildModel({ data, engine, scenario }) {
  const { EVENTS } = data;
  const { operationalField, operationalIndex, toDisplayIndex, sensitivityEnvelope, countryData, STAGE_BY_ID } = engine;

  const activeEvents = scenario?.event ? [...EVENTS, { ...scenario.event, id: scenario.id === 'custom' ? 'custom' : scenario.id }] : EVENTS;

  const baselineField = operationalField(EVENTS);
  const activeField = operationalField(activeEvents);
  const stageDelta = {};
  Object.keys(STAGE_BY_ID).forEach((sid) => { stageDelta[sid] = (activeField[sid] ?? 0) - (baselineField[sid] ?? 0); });

  const countriesBase = countryData(EVENTS, baselineField, data.COUNTRY_NAMES);
  const countriesActive = countryData(activeEvents, activeField, data.COUNTRY_NAMES);
  const countryDelta = {};
  Object.keys(data.COUNTRY_NAMES).forEach((cid) => {
    countryDelta[cid] = (countriesActive[cid]?.operational ?? 0) - (countriesBase[cid]?.operational ?? 0);
  });

  const baselineChainSigned = operationalIndex(baselineField);
  const activeChainSigned = operationalIndex(activeField);
  const envelopeRaw = sensitivityEnvelope(activeEvents);

  return {
    scenarioActive: Boolean(scenario?.event),
    baselineField, activeField, stageDelta,
    countriesBase, countriesActive, countryDelta,
    baselineChainIndex: toDisplayIndex(baselineChainSigned),
    activeChainIndex: toDisplayIndex(activeChainSigned),
    chainIndexDelta: toDisplayIndex(activeChainSigned) - toDisplayIndex(baselineChainSigned),
    envelope: { low: toDisplayIndex(envelopeRaw.low), base: toDisplayIndex(envelopeRaw.base), high: toDisplayIndex(envelopeRaw.high) },
    history: engine.HISTORY, // baseline-only — a hypothetical scenario never rewrites history
    diagnostics: engine.diagnostics.list,
    graphValid: engine.graphValid,
    datasetAsOf: engine.MODEL_PRIORS.datasetAsOf,
    modelVersion: engine.MODEL_PRIORS.modelVersion,
  };
}
