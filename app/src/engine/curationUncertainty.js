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
    base[stage] = alpha;
    low[stage] = clamp01(curated.exposureLow?.[stage] ?? alpha * (1 - band));
    high[stage] = clamp01(curated.exposureHigh?.[stage] ?? alpha * (1 + band));
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
