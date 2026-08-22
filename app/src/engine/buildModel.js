/* Builds the model the dashboard renders: the live reading, an optional
   hazard overlay, their signed per-stage/per-country deltas, and a
   deterministic sensitivity envelope. Nothing here is a forecast — see
   docs/MODEL_ROADMAP.md and the Methodology document for what each number
   does and doesn't mean.

   TWO WAYS THE MODEL CAN DEPART FROM "LIVE", and they are different things:

     asOfDaysAgo  HISTORY REVIEW. Re-derives the whole model as it stood on a
                  past date, using the engine's own back-dating rule
                  (eventsAsOf): events that had not happened yet are absent,
                  and the ones that had are aged to that date. This is a real
                  past state of the chain, not a hypothesis.

     scenario     HAZARD OVERLAY. Adds one simulated shock on top, which is
                  how a hazard footprint drawn on the map gets an index Δ.
                  This is a hypothesis, and it is labelled as one everywhere
                  it surfaces.

   They compose: reviewing a past date with a hazard applied answers "what
   would this have done, then". The baseline in that case is the reviewed
   date, not today, so the Δ stays meaningful.

   Pure and dependency-free (no React/Leaflet) so it can be unit-tested
   directly and reused by App.jsx without pulling in the component tree. */
export function buildModel({ data, engine, scenario, asOfDaysAgo = 0 }) {
  const { operationalField, operationalIndex, toDisplayIndex, sensitivityEnvelope, countryData, STAGE_BY_ID } = engine;

  /* The event set the whole model is derived from. Under review this is the
     back-dated set, so every downstream figure — stage fields, country
     readings, the index, the envelope — describes that date rather than
     today with a different label on it. */
  const reviewing = Number.isFinite(asOfDaysAgo) && asOfDaysAgo > 0;
  const EVENTS = reviewing ? engine.eventsAsOf(asOfDaysAgo) : data.EVENTS;

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
    reviewing,
    asOfDaysAgo: reviewing ? asOfDaysAgo : 0,
    /* How many reviewed events are inside the decay horizon at the date being
       shown. Under review this is the honest denominator for the index —
       "6.3 from 4 events" and "6.3 from 40" are not the same reading. */
    eventsInWindow: EVENTS.length,
    baselineField, activeField, stageDelta,
    countriesBase, countriesActive, countryDelta,
    baselineChainIndex: toDisplayIndex(baselineChainSigned),
    activeChainIndex: toDisplayIndex(activeChainSigned),
    chainIndexDelta: toDisplayIndex(activeChainSigned) - toDisplayIndex(baselineChainSigned),
    envelope: { low: toDisplayIndex(envelopeRaw.low), base: toDisplayIndex(envelopeRaw.base), high: toDisplayIndex(envelopeRaw.high) },
    history: engine.HISTORY, // baseline-only — a hypothetical overlay never rewrites history
    diagnostics: engine.diagnostics.list,
    graphValid: engine.graphValid,
    datasetAsOf: engine.MODEL_PRIORS.datasetAsOf,
    modelVersion: engine.MODEL_PRIORS.modelVersion,
  };
}

/* The calendar date `asOfDaysAgo` resolves to, from the snapshot date the
   engine was built with. Kept next to buildModel so the review banner, the
   slider label and the model can never disagree about which day is showing. */
export function reviewDateISO(engine, asOfDaysAgo = 0) {
  const base = Date.parse(`${engine.MODEL_PRIORS.datasetAsOf}T00:00:00Z`);
  if (!Number.isFinite(base)) return engine.MODEL_PRIORS.datasetAsOf;
  return new Date(base - (asOfDaysAgo || 0) * 86400000).toISOString().slice(0, 10);
}
