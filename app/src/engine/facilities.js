/* ====================================================================
   engine/facilities.js — the site-level layer: which plants exist, what
   share of a stage's modeled sites each one represents, and what a hazard
   at a coordinate actually touches.

   Why this is a separate module and not part of buildEngine(): none of it
   changes the propagation math. The engine still shocks STAGES. What this
   adds is the missing first step — turning "an M7.1 at 32.8N 130.7E" into
   "these six named plants, these four stages, this much of each" — and the
   readout that goes with it. buildEngine's input signature is deliberately
   unchanged.

   Pure and dependency-free (no React, no Leaflet) so every rule here is
   unit-testable directly.

   HONEST LIMITS, restated because they are easy to lose once numbers appear
   on a map:
     · `scale` is an analyst ordinal (1-5), not capacity. Every share this
       module produces is therefore a share OF THE MODELED SITE SAMPLE, not
       of world capacity, and is labelled that way everywhere it surfaces.
     · Coverage is a curated sample. An empty radius means "no site in this
       sample", never "no site".
     · A site inside a radius is a site that MIGHT be affected. Nothing here
       models shaking intensity, building standards, or fab hardening — a
       200km radius is a screening tool, not a damage estimate.
   ==================================================================== */

export const EARTH_RADIUS_KM = 6371;

/* Status → how much of a site can be disrupted right now. A fab under
   construction cannot lose output it is not yet producing, and an idle line
   cannot lose it either; a ramping site is discounted rather than excluded. */
export const STATUS_EXPOSURE = Object.freeze({
  operating: 1,
  ramping: 0.5,
  construction: 0,
  idle: 0,
});

/* A stage is only shocked by a hazard if a material share of its modeled
   sites is actually inside the radius. Without this, a radius that clips one
   small plant on the edge of a cluster shocks that plant's entire stage as
   hard as a radius centred on the cluster — which is how a screening tool
   turns into a nonsense generator. */
export const MIN_STAGE_EXPOSURE = 0.05;

export function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* A site's disruptable weight: its ordinal significance, discounted by what
   is actually running. Deliberately linear in `scale` — the ordinal is already
   a judgement, and raising it to a power would add precision that isn't there. */
export function siteWeight(f) {
  const status = STATUS_EXPOSURE[f?.status] ?? 1;
  return (Number.isFinite(f?.scale) ? f.scale : 0) * status;
}

/* Static indices over the facility table. Nothing event-dependent lives here,
   so this is built once per bundle (see data/buildVaultData.js). */
export function buildFacilityLayer(FACILITIES = []) {
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
    const w = siteWeight(f);
    (f.stages || []).forEach((sid) => {
      (byStage[sid] ||= []).push(f);
      stageWeight[sid] = (stageWeight[sid] ?? 0) + w;
    });
  });

  Object.values(byCountry).forEach((arr) => arr.sort((a, b) => siteWeight(b) - siteWeight(a)));
  Object.values(byStage).forEach((arr) => arr.sort((a, b) => siteWeight(b) - siteWeight(a)));

  /* share of a stage's MODELED SITE WEIGHT held by one site. Not a capacity
     share — see the header. */
  const shareOfStage = (facility, stageId) => {
    const total = stageWeight[stageId] ?? 0;
    if (!total) return 0;
    return siteWeight(facility) / total;
  };

  return {
    FACILITIES: list,
    FACILITY_BY_ID: byId,
    FACILITIES_BY_COUNTRY: byCountry,
    FACILITIES_BY_STAGE: byStage,
    FACILITIES_BY_COMPANY: byCompany,
    STAGE_SITE_WEIGHT: stageWeight,
    shareOfStage,
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

   Returns the hit list plus, per stage, the share of that stage's modeled
   site weight sitting inside the radius — the number that says whether this
   is "a plant went down" or "a third of the world's modeled capacity for
   this step is in one valley". */
export function hazardFootprint({ lat, lng, radiusKm }, layer) {
  const hits = facilitiesWithin(layer?.FACILITIES, { lat, lng, radiusKm });
  const stageWeightInside = {};
  const countries = new Set();
  const companies = new Set();

  hits.forEach(({ facility }) => {
    countries.add(facility.country);
    companies.add(facility.company);
    const w = siteWeight(facility);
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
    .sort((a, b) => b.exposure - a.exposure);

  return {
    center: { lat, lng },
    radiusKm,
    hits,
    stages,
    // Stages material enough to shock — the ones a scenario is built from.
    materialStages: stages.filter((s) => s.exposure >= MIN_STAGE_EXPOSURE),
    countries: [...countries],
    companies: [...companies],
  };
}

/* Turn a footprint into draft-scenario sources the composer already knows how
   to run (see interaction/scenarioDraft.js). Only material stages become
   sources; the rest stay visible in the readout as "touched, not shocked",
   which is a real distinction and worth showing rather than rounding away. */
export function footprintToDraftSources(footprint) {
  return (footprint?.materialStages || []).map((s) => ({ type: 'stage', id: s.stageId }));
}

/* One site's current operational reading: the strongest signed effect across
   the stages it feeds. Signed, so a recovery event reads as mitigating rather
   than as "less bad". */
export function facilityImpact(facility, field = {}) {
  let strongest = 0;
  (facility?.stages || []).forEach((sid) => {
    const v = field[sid] ?? 0;
    if (Math.abs(v) > Math.abs(strongest)) strongest = v;
  });
  return strongest;
}

/* Which modeled sites an EVENT plausibly sits on top of: the intersection of
   the countries it is tagged to and the stages it shocks. This is the event
   table's own geography — no coordinates required, because most events (an
   export rule, a price move) do not have one. */
export function facilitiesForEvent(event, layer) {
  const countries = new Set(event?.countries || []);
  const stages = new Set(event?.stages || []);
  if (!countries.size && !stages.size) return [];
  return (layer?.FACILITIES || []).filter((f) => {
    const countryHit = !countries.size || countries.has(f.country);
    const stageHit = !stages.size || (f.stages || []).some((s) => stages.has(s));
    return countryHit && stageHit;
  }).sort((a, b) => siteWeight(b) - siteWeight(a));
}
