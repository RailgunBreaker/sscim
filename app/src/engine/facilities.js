/* ====================================================================
   engine/facilities.js — the site-level layer: which plants exist, what
   share of a stage's MODELED FACILITY FOOTPRINT each one represents, and
   what a hazard at a coordinate actually touches.

   WHAT v7 CHANGED HERE, AND WHY IT MATTERED.

     · THE 5% SCORING THRESHOLD IS GONE FROM THE MODEL. v6 refused to
       shock a stage whose footprint inside the radius was below 5%, and
       shocked it at FULL severity above 5%. So 4.99% did nothing, 5.01%
       did everything, and 5.01% did exactly as much as 100%. A screening
       tool with a cliff in it is a nonsense generator on both sides of
       the cliff. v7 derives the stage exposure CONTINUOUSLY from the
       footprint: alpha_s = footprint share, so zero footprint gives zero
       shock, more footprint never gives less shock, and 5.01% gives
       about a twentieth of what 100% gives. The 5% line survives only as
       a DISPLAY threshold for dimming a row in the readout.

     · THE ORDINAL IS TREATED AS AN ORDINAL. `scale` is an analyst
       judgement on a 1-5 scale. Ratios of its values are NOT observed
       production capacity, and nothing here or downstream may describe
       them that way. The mapping from ordinal to weight is an explicit
       registry MODEL FORM with three declared options (equal, linear,
       convex), reported separately in model-form sensitivity.

     · RAMPING WEIGHT IS A REGISTRY PARAMETER, stress-tested over
       [0.25, 0.75], instead of a hard-coded 0.5.

   HONEST LIMITS, restated because they are easy to lose once numbers
   appear on a map:
     · Every share this module produces is a share OF THE MODELED SITE
       SAMPLE, not of world capacity, and is labelled that way everywhere.
     · Coverage is a curated sample. An empty radius means "no site in
       this sample", never "no site".
     · A site inside a radius is a site that MIGHT be affected. Nothing
       here models shaking intensity, building standards or fab
       hardening. No hazard-specific distance attenuation is applied,
       because the snapshot carries no hazard data that would support
       one. A radius is a screening tool, not a damage estimate.
   ==================================================================== */
import { BASE_PARAMS } from './registry.js';

export const EARTH_RADIUS_KM = 6371;

/* Status -> how much of a site can be disrupted right now. A fab under
   construction cannot lose output it is not yet producing, and an idle
   line cannot lose it either; a ramping site is discounted rather than
   excluded, by the registry parameter `rampingSiteWeight`. The 1 and the
   two 0s are definitional; only the ramping discount is an assumption. */
export function statusWeight(status, params = BASE_PARAMS) {
  switch (status) {
    case 'operating': return 1;
    case 'ramping': return params.rampingSiteWeight;
    case 'construction': return 0;
    case 'idle': return 0;
    default: return 1; // an unrecorded status is treated as running; the audit reports it
  }
}

/* Back-compatible view of the status table at the base parameters. */
export const STATUS_EXPOSURE = Object.freeze({
  operating: 1,
  ramping: BASE_PARAMS.rampingSiteWeight,
  construction: 0,
  idle: 0,
});

/* The ordinal -> weight model forms. See registry.MODEL_FORMS.facilityScaleMapping. */
export const SCALE_MAPPINGS = Object.freeze({
  equal: () => 1,
  linear: (k) => k,
  convex: (k) => k * k,
});

/* DISPLAY ONLY. Rows below this footprint share are dimmed in the hazard
   readout so a reader's eye goes to the material ones first. It does NOT
   gate any modelled quantity — that is the v6 defect this constant was
   demoted out of. */
export const DISPLAY_EXPOSURE_THRESHOLD = 0.05;

/* Deprecated alias kept so stored v6 UI preferences keep resolving.
   Never use it to gate a model value. */
export const MIN_STAGE_EXPOSURE = DISPLAY_EXPOSURE_THRESHOLD;

export function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* A site's disruptable weight: the declared model form applied to its
   ordinal significance, discounted by what is actually running.

     w(site) = scaleMapping(scale) * statusWeight(status)

   The result is a MODELED SITE WEIGHT. It is not capacity, output, or
   value, and the ratio of two of them is not a capacity ratio. */
export function siteWeight(f, params = BASE_PARAMS) {
  const map = SCALE_MAPPINGS[params.facilityScaleMapping] ?? SCALE_MAPPINGS.linear;
  const k = Number.isFinite(f?.scale) ? f.scale : 0;
  if (k <= 0) return 0;
  return map(k) * statusWeight(f?.status, params);
}

/* Static indices over the facility table. Nothing event-dependent lives
   here, so this is built once per bundle (see data/buildVaultData.js). */
export function buildFacilityLayer(FACILITIES = [], params = BASE_PARAMS) {
  const list = Array.isArray(FACILITIES) ? FACILITIES : [];
  const byId = {};
  const byCountry = {};
  const byStage = {};
  const byCompany = {};
  const stageWeight = {};

  list.forEach((f) => {
    byId[f.id] = f;
    (byCountry[f.country] ||= []).push(f);
    (byCompany[f.company] ||= []).push(f);
    const w = siteWeight(f, params);
    (f.stages || []).forEach((sid) => {
      (byStage[sid] ||= []).push(f);
      stageWeight[sid] = (stageWeight[sid] ?? 0) + w;
    });
  });

  Object.values(byCountry).forEach((arr) => arr.sort((a, b) => siteWeight(b, params) - siteWeight(a, params)));
  Object.values(byStage).forEach((arr) => arr.sort((a, b) => siteWeight(b, params) - siteWeight(a, params)));

  /* One site's share of a stage's MODELED FACILITY FOOTPRINT. Not a
     capacity share — see the header. */
  const shareOfStage = (facility, stageId) => {
    const total = stageWeight[stageId] ?? 0;
    if (!total) return 0;
    return siteWeight(facility, params) / total;
  };

  return {
    FACILITIES: list,
    FACILITY_BY_ID: byId,
    FACILITIES_BY_COUNTRY: byCountry,
    FACILITIES_BY_STAGE: byStage,
    FACILITIES_BY_COMPANY: byCompany,
    STAGE_SITE_WEIGHT: stageWeight,
    shareOfStage,
    params,
  };
}

/* Every modeled site within `radiusKm` of a point, nearest first. */
export function facilitiesWithin(FACILITIES, { lat, lng, radiusKm }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusKm)) return [];
  return (FACILITIES || [])
    .map((f) => ({ facility: f, distanceKm: haversineKm(lat, lng, f.lat, f.lng) }))
    .filter((hit) => hit.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/* What a hazard at a point touches.

   Returns the hit list plus, per stage, the MODELED FACILITY FOOTPRINT
   inside the radius:

       alpha_s = (sum of site weights inside) / (sum of site weights in the stage)

   in [0,1] by construction. This is the number that says whether this is
   "a plant went down" or "a third of this step's modeled footprint is in
   one valley". It is not capacity share and it is not physical damage. */
export function hazardFootprint({ lat, lng, radiusKm }, layer) {
  const params = layer?.params ?? BASE_PARAMS;
  const hits = facilitiesWithin(layer?.FACILITIES, { lat, lng, radiusKm });
  const stageWeightInside = {};
  const countries = new Set();
  const companies = new Set();

  hits.forEach(({ facility }) => {
    countries.add(facility.country);
    companies.add(facility.company);
    const w = siteWeight(facility, params);
    (facility.stages || []).forEach((sid) => {
      stageWeightInside[sid] = (stageWeightInside[sid] ?? 0) + w;
    });
  });

  const stages = Object.entries(stageWeightInside)
    .map(([stageId, inside]) => {
      const total = layer?.STAGE_SITE_WEIGHT?.[stageId] ?? 0;
      return {
        stageId,
        exposure: total ? inside / total : 0,
        insideWeight: inside,
        totalWeight: total,
        sites: hits.filter((h) => (h.facility.stages || []).includes(stageId)).map((h) => h.facility.id),
      };
    })
    // A zero-weight stage (every site inside is idle or under construction)
    // contributes nothing and must not appear as a source.
    .filter((s) => s.exposure > 0)
    .sort((a, b) => b.exposure - a.exposure);

  return {
    center: { lat, lng },
    radiusKm,
    hits,
    stages,
    /* DISPLAY partition only. Every stage in `stages` is scored, in
       proportion to its footprint; these two lists exist so the readout
       can lead with the material ones. */
    displayStages: stages.filter((s) => s.exposure >= DISPLAY_EXPOSURE_THRESHOLD),
    minorStages: stages.filter((s) => s.exposure < DISPLAY_EXPOSURE_THRESHOLD),
    countries: [...countries],
    companies: [...companies],
  };
}

/* The footprint's stages as shock sources. EVERY stage with a nonzero
   footprint qualifies — the display threshold does not gate this. */
export function footprintToDraftSources(footprint) {
  return (footprint?.stages || []).map((s) => ({ type: 'stage', id: s.stageId, exposure: s.exposure }));
}

/* The hazard as something the engine can score.

   The geometry says WHAT IS EXPOSED (alpha_s, continuous, from the
   footprint); the operator's severity says HOW HARD IT WAS HIT (q). The
   two are separate inputs and neither substitutes for the other. The
   scenario runs through the identical v7 source-vector and propagation
   path every recorded incident uses, so its delta is comparable with the
   index it modifies. */
export function footprintToHazardScenario(footprint, { severity = 6 } = {}) {
  const stages = footprint?.stages || [];
  if (!stages.length) return null;
  const sev = Math.max(1, Math.min(10, Math.round(severity)));
  const sites = footprint.hits.length;
  const material = footprint.displayStages?.length ?? 0;
  const exposure = Object.fromEntries(stages.map((s) => [s.stageId, s.exposure]));
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const top = stages.slice(0, 3).map((s) => `${s.stageId} ${pct(s.exposure)}`).join(', ');

  return {
    id: 'hazard',
    name: `Hazard at ${footprint.center.lat.toFixed(1)}°, ${footprint.center.lng.toFixed(1)}°`,
    desc: `Simulated severity-${sev} hazard within ${footprint.radiusKm} km of ${footprint.center.lat.toFixed(2)}°, ${footprint.center.lng.toFixed(2)}°, `
      + `covering ${sites} modeled site${sites === 1 ? '' : 's'}. Each of the ${stages.length} touched stage${stages.length === 1 ? '' : 's'} is shocked `
      + `in proportion to its modeled facility footprint inside the radius (largest: ${top}); ${material} `
      + `exceed${material === 1 ? 's' : ''} the ${Math.round(DISPLAY_EXPOSURE_THRESHOLD * 100)}% display threshold. `
      + 'Footprint is a share of the modeled site sample, not capacity share and not physical damage. '
      + 'A screening hypothesis run through the same propagation engine as every recorded incident — not a damage estimate.',
    event: {
      sev,
      daysAgo: 0,
      conf: 'Simulated',
      stages: stages.map((s) => s.stageId),
      countries: footprint.countries || [],
      assumption: { direction: 'adverse', channel: 'both', operational: true },
      /* The curated model this scenario carries with it: exposures come
         from the geometry, and a hazard on the day it happens is at full
         persistence with no recorded restart schedule. */
      model: {
        exposure,
        exposureBasis: 'Derived continuously from the modeled facility footprint inside the hazard radius — the share of each stage’s modeled site weight that sits inside.',
        profile: { kind: 'acute_exponential' },
        profileBasis: 'A hypothesised hazard as of the evaluation date, with no recorded staged restart, so the acute exponential profile applies.',
      },
    },
  };
}

/* One site's current operational reading: the strongest signed effect
   across the stages it feeds. Signed, so a recovery reads as mitigating
   rather than as "less bad". */
export function facilityImpact(facility, field = {}) {
  let strongest = 0;
  (facility?.stages || []).forEach((sid) => {
    const v = field[sid] ?? 0;
    if (Math.abs(v) > Math.abs(strongest)) strongest = v;
  });
  return strongest;
}

/* Which modeled sites an incident plausibly sits on top of: the
   intersection of the countries it is tagged to and the stages it shocks.
   This is the event table's own geography — no coordinates required,
   because most records (an export rule, a price move) have none. */
export function facilitiesForEvent(event, layer) {
  const params = layer?.params ?? BASE_PARAMS;
  const countries = new Set(event?.countries || []);
  const stages = new Set(event?.stages || []);
  if (!countries.size && !stages.size) return [];
  return (layer?.FACILITIES || []).filter((f) => {
    const countryHit = !countries.size || countries.has(f.country);
    const stageHit = !stages.size || (f.stages || []).some((s) => stages.has(s));
    return countryHit && stageHit;
  }).sort((a, b) => siteWeight(b, params) - siteWeight(a, params));
}
