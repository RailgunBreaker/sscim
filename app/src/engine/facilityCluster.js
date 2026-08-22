/* ====================================================================
   engine/facilityCluster.js — grouping plants that sit on top of each other.

   THE PROBLEM. Real semiconductor geography is extremely clustered: eight
   modeled sites sit inside the Hsinchu Science Park, several more a few km
   apart in Tainan, and at any zoom that shows Taiwan whole they land on the
   same handful of pixels. The map then shows a pile of overlapping glyphs
   where the top one hides the rest, which is worse than showing one marker
   and admitting there are eight.

   THE RULE. Cluster by SCREEN distance, not by a fixed number of kilometres.
   A fixed radius is either too coarse when you are zoomed in or too fine when
   you are zoomed out, because the thing that actually overlaps is pixels. A
   34px radius works out at roughly 38 km at zoom 7 over Taiwan — which is the
   "30-50 km" scale the clustering was asked for — and stays visually correct
   at every other zoom without a second rule.

   Clusters are transparent about what they hide: every one carries its member
   list, its worst live state, and the bounds needed to zoom into it. A count
   badge that cannot be opened would be a different way of hiding the same
   plants.

   Pure and dependency-free: no Leaflet, no React. The Web-Mercator maths is
   the standard formulation, written out rather than imported so the one
   number that matters (km per pixel) is inspectable.
   ==================================================================== */

/* Web Mercator: the whole world is 256px at zoom 0, and a degree of longitude
   shrinks by cos(latitude). 156543.03392 is metres-per-pixel at the equator
   at zoom 0. */
export const EQUATOR_METRES_PER_PIXEL = 156543.03392;

export function metresPerPixel(latitude, zoom) {
  return EQUATOR_METRES_PER_PIXEL * Math.cos((latitude * Math.PI) / 180) / 2 ** zoom;
}

/* The screen radius clusters are built at. Large enough that glyphs stop
   overlapping, small enough that two genuinely distinct sites a city apart
   stay distinct once you have zoomed to city scale. */
export const CLUSTER_PIXEL_RADIUS = 34;

/* What that radius means on the ground right now — surfaced in the interface
   so the grouping is a stated rule rather than an unexplained blob. */
export function clusterRadiusKm(latitude, zoom, pixels = CLUSTER_PIXEL_RADIUS) {
  return (metresPerPixel(latitude, zoom) * pixels) / 1000;
}

/* Past this zoom nothing is grouped: you have asked to see individual plants,
   so you get individual plants even if two of them overlap. */
export const NEVER_CLUSTER_ABOVE_ZOOM = 11;

const toRad = (d) => (d * Math.PI) / 180;

/* Planar distance in pixels at a given zoom. Cheaper and more appropriate
   than haversine here: clustering is a screen-space question, and over a few
   tens of km the flat approximation is exact to well under a pixel. */
function pixelDistance(a, b, zoom) {
  const mpp = metresPerPixel((a.lat + b.lat) / 2, zoom);
  const dLatM = (a.lat - b.lat) * 111_320;
  const dLngM = (a.lng - b.lng) * 111_320 * Math.cos(toRad((a.lat + b.lat) / 2));
  return Math.hypot(dLatM, dLngM) / mpp;
}

/* Greedy clustering, seeded by weight.

   Deliberately greedy rather than k-means or a quadtree: the seed order is
   "most significant site first", so a cluster is always anchored on the plant
   that matters most and takes its identity from it. That makes the label
   predictable — the Hsinchu group is always the TSMC group — where a
   centroid-based method would drift with membership and rename itself as you
   panned.

   `weightOf` decides seed order; `stateOf` returns a signed live effect used
   to colour the cluster by its WORST member, because a group containing one
   stopped fab is not quiet just because the other seven are. */
export function clusterFacilities(facilities, {
  zoom = 2,
  pixels = CLUSTER_PIXEL_RADIUS,
  weightOf = (f) => f.scale ?? 1,
  stateOf = () => 0,
  neverClusterAbove = NEVER_CLUSTER_ABOVE_ZOOM,
} = {}) {
  const list = (facilities || []).filter((f) => Number.isFinite(f?.lat) && Number.isFinite(f?.lng));

  // Zoomed right in: every site is its own marker.
  if (zoom > neverClusterAbove) {
    return list.map((f) => singleton(f, stateOf));
  }

  const seeds = [...list].sort((a, b) => weightOf(b) - weightOf(a));
  const taken = new Set();
  const clusters = [];

  for (const seed of seeds) {
    if (taken.has(seed.id)) continue;
    taken.add(seed.id);

    const members = [seed];
    for (const other of seeds) {
      if (taken.has(other.id)) continue;
      if (pixelDistance(seed, other, zoom) <= pixels) {
        taken.add(other.id);
        members.push(other);
      }
    }

    clusters.push(members.length === 1 ? singleton(seed, stateOf) : makeCluster(seed, members, stateOf));
  }

  return clusters;
}

function singleton(facility, stateOf) {
  return {
    kind: 'site',
    id: facility.id,
    lat: facility.lat,
    lng: facility.lng,
    count: 1,
    facility,
    members: [facility],
    state: stateOf(facility),
    bounds: [[facility.lat, facility.lng], [facility.lat, facility.lng]],
  };
}

function makeCluster(seed, members, stateOf) {
  /* Positioned on the SEED, not the centroid. A centroid drifts as membership
     changes with zoom, so a cluster would slide across the map while you
     zoom — and it can land in the sea between two coastal clusters, which
     reads as a plant that is not there. The seed is a real plant at a real
     coordinate. */
  let worst = 0;
  let lat0 = seed.lat, lat1 = seed.lat, lng0 = seed.lng, lng1 = seed.lng;
  for (const m of members) {
    const s = stateOf(m);
    if (Math.abs(s) > Math.abs(worst)) worst = s;
    if (m.lat < lat0) lat0 = m.lat;
    if (m.lat > lat1) lat1 = m.lat;
    if (m.lng < lng0) lng0 = m.lng;
    if (m.lng > lng1) lng1 = m.lng;
  }
  return {
    kind: 'cluster',
    id: `cluster:${seed.id}`,
    lat: seed.lat,
    lng: seed.lng,
    count: members.length,
    facility: seed,
    members,
    state: worst,
    bounds: [[lat0, lng0], [lat1, lng1]],
  };
}

/* A short, honest label: the anchor operator plus how many others are hidden
   behind it. Built here so the map marker and the tooltip cannot disagree. */
export function clusterLabel(cluster, { COMPANY_BY_ID = {} } = {}) {
  if (cluster.kind === 'site') return cluster.facility.name;
  const operators = new Set(cluster.members.map((m) => m.company));
  const anchor = COMPANY_BY_ID[cluster.facility.company]?.name || cluster.facility.company;
  return operators.size === 1
    ? `${anchor} — ${cluster.count} sites`
    : `${cluster.count} sites · ${operators.size} operators`;
}
