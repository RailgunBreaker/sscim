/* USGS earthquake feed → event candidates.

   Free, keyless, structured. Only quakes that are both large enough to matter
   and near a modeled fab cluster become candidates — the point is to catch the
   Kumamoto/Hualien/Noto class of event automatically, not to log seismicity.
   A candidate is a PROPOSAL: severity and stage/country tagging are the AI
   step's draft and a human's decision, never this file's. */

const FEED = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

/* Semiconductor clusters worth watching, with the vault stages/countries a
   disruption there would touch. Radius is deliberately generous — the review
   step discards false positives, and a missed quake can't be recovered. */
export const FAB_CLUSTERS = [
  { name: 'Kyushu (Kumamoto/Nagasaki — JASM, Sony CIS, Renesas)', lat: 32.8, lng: 130.7, radiusKm: 220,
    countries: ['jp'], stages: ['mature_fab', 'analog', 'm_consumer', 'm_auto'] },
  { name: 'Kanto/Tohoku (Naka, Kitakami, Yokkaichi — Renesas, Kioxia)', lat: 36.5, lng: 140.3, radiusKm: 320,
    countries: ['jp'], stages: ['memory_fab', 'analog', 'mature_fab'] },
  { name: 'Chubu/Kansai (Shin-Etsu, SUMCO, materials)', lat: 35.0, lng: 136.5, radiusKm: 240,
    countries: ['jp'], stages: ['wafers', 'resist', 'gases'] },
  { name: 'Taiwan west corridor (Hsinchu/Taichung/Tainan)', lat: 24.1, lng: 120.7, radiusKm: 260,
    countries: ['tw'], stages: ['adv_fab', 'mature_fab', 'adv_pkg', 'osat'] },
  { name: 'Korea (Giheung/Icheon/Pyeongtaek)', lat: 37.2, lng: 127.2, radiusKm: 180,
    countries: ['kr'], stages: ['memory_fab', 'hbm', 'adv_fab'] },
  { name: 'US Southwest (Phoenix/Chandler)', lat: 33.3, lng: -111.9, radiusKm: 250,
    countries: ['us'], stages: ['adv_fab', 'mature_fab'] },
  { name: 'US Pacific Northwest (Hillsboro)', lat: 45.5, lng: -122.9, radiusKm: 250,
    countries: ['us'], stages: ['adv_fab', 'metro'] },
];

const R_EARTH_KM = 6371;
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(a));
}

/* Magnitude alone is a poor proxy for fab impact (depth and distance matter
   enormously), so this only decides whether a human should LOOK — the actual
   severity comes from reported fab status, which no API provides. */
const MIN_MAGNITUDE = 6.0;

export async function fetchEarthquakeCandidates({ since, until, minMagnitude = MIN_MAGNITUDE } = {}) {
  const params = new URLSearchParams({
    format: 'geojson',
    starttime: since,
    endtime: until,
    minmagnitude: String(minMagnitude),
    orderby: 'time',
  });
  const res = await fetch(`${FEED}?${params}`, { headers: { 'User-Agent': 'sscim-pipeline/1.0' } });
  if (!res.ok) throw new Error(`USGS feed returned HTTP ${res.status}`);
  const json = await res.json();

  const candidates = [];
  for (const f of json.features ?? []) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (lat == null || lng == null) continue;
    const near = FAB_CLUSTERS
      .map((c) => ({ cluster: c, distKm: haversineKm(lat, lng, c.lat, c.lng) }))
      .filter((x) => x.distKm <= x.cluster.radiusKm)
      .sort((a, b) => a.distKm - b.distKm)[0];
    if (!near) continue; // not near any modeled cluster — not a supply-chain signal

    const when = new Date(f.properties.time);
    candidates.push({
      sourceFeed: 'usgs',
      sourceRef: f.id,
      dateISO: when.toISOString().slice(0, 10),
      raw: {
        magnitude: f.properties.mag,
        place: f.properties.place,
        time: when.toISOString(),
        depthKm: f.geometry.coordinates[2],
        url: f.properties.url,
        tsunami: Boolean(f.properties.tsunami),
        cluster: near.cluster.name,
        distanceKm: Math.round(near.distKm),
        suggestedStages: near.cluster.stages,
        suggestedCountries: near.cluster.countries,
      },
    });
  }
  return candidates;
}
