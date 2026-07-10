/* ====================================================================
   interaction/scenarioDraft.js — turns a draft scenario composed directly
   on the map/graph (see reducer.js `draft`) into the exact scenario shape
   every preset uses, so it runs through the identical propagation engine
   (task §10). Pure and dependency-free so it can be unit-tested.

   No new empirical values are invented: a country source simply expands to
   the stages that country already participates in (≥ threshold share) in
   the static snapshot; the built scenario carries an explicit
   direction/channel assumption the engine now honors (see
   engine/index.js eventCentralMagnitude + event-assumptions.js).
   ==================================================================== */

const COUNTRY_STAGE_THRESHOLD = 0.1;

const DIR_WORD = {
  adverse: 'adverse',
  mitigating: 'mitigating',
  neutral: 'neutral (no net shock)',
};

export function draftToScenario(draft, { stageById } = {}) {
  const sources = draft?.sources || [];
  const stageSet = new Set();
  const countrySet = new Set();

  sources.forEach((s) => {
    if (s.type === 'stage') {
      stageSet.add(s.id);
    } else if (s.type === 'country') {
      countrySet.add(s.id);
      Object.values(stageById || {}).forEach((st) => {
        if ((st.shares?.[s.id] ?? 0) >= COUNTRY_STAGE_THRESHOLD) stageSet.add(st.id);
      });
    }
  });

  const stages = [...stageSet];
  if (!stages.length) return null; // nothing to propagate from

  const neutral = draft.direction === 'neutral';
  const sev = neutral ? 0 : draft.severity;
  const direction = draft.direction === 'mitigating' ? 'mitigating' : 'adverse';
  const nSrc = sources.length;

  return {
    id: 'custom',
    name: `Custom ${draft.direction} shock`,
    desc: `User-built ${DIR_WORD[draft.direction] || draft.direction} shock, severity ${sev}, from ${nSrc} selected source${nSrc === 1 ? '' : 's'} spanning ${stages.length} stage${stages.length === 1 ? '' : 's'}. Runs through the same propagation engine as every preset — a sensitivity comparison, not a forecast.`,
    event: {
      sev,
      daysAgo: 0,
      conf: 'Simulated',
      stages,
      countries: [...countrySet],
      // Explicit classification the engine honors (eventCentralMagnitude).
      assumption: { direction, channel: 'both', operational: true },
    },
  };
}
