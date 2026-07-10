/* ====================================================================
   interaction/playback.js — turns a combined propagation trace (from
   engine.eventTrace / engine.buildTrace) plus the current playback step
   into a concrete per-frame view: which stages/countries have been
   reached so far, which are newly reached at THIS hop (for the pulse),
   and which edges carried the shock into this hop.

   Pure and dependency-free of React/Leaflet so the world map, industry
   graph, scenario bar and panel all derive the exact same frame from one
   place and stay in sync (task §7). It never re-derives the field — it
   only reads the cumulative/incremental contributions the engine already
   computed, so the numbers shown mid-playback are real engine outputs.
   ==================================================================== */

function countriesForStages(stageSet, stagesById, threshold) {
  const cs = new Set();
  stageSet.forEach((sid) => {
    const shares = stagesById?.[sid]?.shares || {};
    Object.entries(shares).forEach(([cid, sh]) => { if (sh >= threshold) cs.add(cid); });
  });
  return cs;
}

const EMPTY_FRAME = {
  engaged: false, step: 0, length: 0, cumulative: {}, incremental: {}, edges: [],
  reachedStages: new Set(), newStages: new Set(), reachedCountries: new Set(),
  newCountries: new Set(), atEnd: true, atStart: true,
};

/* `traceResult` = { field, trace, ... } | null. `stagesById` =
   engine.STAGE_BY_ID (for mapping reached stages onto countries via their
   modeled shares). `threshold` = minimum modeled stage share for a country
   to count as reached at that hop. */
export function frameFromTrace(traceResult, step, stagesById, threshold = 0.1) {
  const steps = traceResult?.trace || [];
  if (!steps.length) return { ...EMPTY_FRAME, cumulative: {}, incremental: {} };

  const clamped = Math.max(0, Math.min(step, steps.length - 1));
  const cur = steps[clamped];
  const prev = clamped > 0 ? steps[clamped - 1] : null;

  const reachedStages = new Set(Object.keys(cur.cumulativeContribution));
  const newStages = new Set(Object.keys(cur.incrementalContribution));
  const reachedCountries = countriesForStages(reachedStages, stagesById, threshold);
  const prevCountries = prev
    ? countriesForStages(new Set(Object.keys(prev.cumulativeContribution)), stagesById, threshold)
    : new Set();
  const newCountries = new Set([...reachedCountries].filter((c) => !prevCountries.has(c)));

  return {
    engaged: true,
    step: clamped,
    length: steps.length,
    cumulative: cur.cumulativeContribution,
    incremental: cur.incrementalContribution,
    edges: cur.edges || [],
    reachedStages,
    newStages,
    reachedCountries,
    newCountries,
    atEnd: clamped >= steps.length - 1,
    atStart: clamped <= 0,
  };
}

export { EMPTY_FRAME };
