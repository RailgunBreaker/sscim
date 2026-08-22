import { describe, it, expect } from 'vitest';
import {
  clusterFacilities, clusterRadiusKm, metresPerPixel, clusterLabel,
  CLUSTER_PIXEL_RADIUS, NEVER_CLUSTER_ABOVE_ZOOM,
} from './facilityCluster.js';

const site = (id, lat, lng, over = {}) => ({ id, name: id, lat, lng, company: 'co', scale: 3, ...over });

/* Hsinchu Science Park: the case this module exists for. Eight modeled sites
   inside a few kilometres, which at any zoom showing Taiwan whole land on the
   same handful of pixels. */
const hsinchu = [
  site('tsmc_fab12', 24.776, 121.006, { scale: 3 }),
  site('tsmc_fab20', 24.784, 121.031, { scale: 4 }),
  site('vis_fab', 24.770, 120.997, { scale: 2 }),
  site('pti', 24.750, 121.020, { scale: 3 }),
  site('kyec', 24.700, 120.960, { scale: 3 }),
];
const tainan = [
  site('tsmc_fab18', 23.100, 120.283, { scale: 5 }),
  site('umc_12a', 23.105, 120.276, { scale: 3 }),
];
const kyushu = [site('jasm', 32.888, 130.795, { scale: 2 })];

describe('the km-per-pixel maths', () => {
  it('halves the ground scale for every zoom level', () => {
    expect(metresPerPixel(0, 1)).toBeCloseTo(metresPerPixel(0, 0) / 2, 6);
    expect(metresPerPixel(0, 8)).toBeCloseTo(metresPerPixel(0, 7) / 2, 6);
  });

  it('shrinks with latitude, as Mercator requires', () => {
    expect(metresPerPixel(60, 5)).toBeLessThan(metresPerPixel(0, 5));
  });

  /* The number the clustering was specified against: roughly 30-50 km at the
     zoom where a country fills the panel. */
  it('puts the default cluster radius in the 30-50km band at regional zoom', () => {
    const km = clusterRadiusKm(24, 7);
    expect(km).toBeGreaterThan(30);
    expect(km).toBeLessThan(50);
  });
});

describe('clusterFacilities', () => {
  const all = [...hsinchu, ...tainan, ...kyushu];

  it('groups a science park into one marker at country zoom', () => {
    const out = clusterFacilities(all, { zoom: 7 });
    const cluster = out.find((c) => c.kind === 'cluster' && c.members.some((m) => m.id === 'tsmc_fab12'));
    expect(cluster).toBeTruthy();
    expect(cluster.count).toBeGreaterThan(1);
    expect(out.length).toBeLessThan(all.length);
  });

  it('keeps a distant site out of the group', () => {
    const out = clusterFacilities(all, { zoom: 7 });
    const withJasm = out.find((c) => c.members.some((m) => m.id === 'jasm'));
    expect(withJasm.count).toBe(1);
    expect(withJasm.kind).toBe('site');
  });

  it('breaks every cluster apart once you zoom past the never-cluster level', () => {
    const out = clusterFacilities(all, { zoom: NEVER_CLUSTER_ABOVE_ZOOM + 1 });
    expect(out).toHaveLength(all.length);
    expect(out.every((c) => c.kind === 'site')).toBe(true);
  });

  it('groups more at lower zoom and less at higher zoom', () => {
    const wide = clusterFacilities(all, { zoom: 4 }).length;
    const mid = clusterFacilities(all, { zoom: 7 }).length;
    const close = clusterFacilities(all, { zoom: 10 }).length;
    expect(wide).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(close);
  });

  it('never loses or duplicates a facility', () => {
    [2, 4, 6, 8, 10, 12].forEach((zoom) => {
      const out = clusterFacilities(all, { zoom });
      const ids = out.flatMap((c) => c.members.map((m) => m.id));
      expect(ids.length).toBe(all.length);
      expect(new Set(ids).size).toBe(all.length);
    });
  });

  /* Anchoring on the heaviest member rather than a centroid keeps the marker
     on a real plant and stops it sliding as membership changes with zoom. */
  it('anchors a cluster on its most significant site, at that site exact position', () => {
    const out = clusterFacilities([...tainan], { zoom: 7 });
    const cluster = out[0];
    expect(cluster.facility.id).toBe('tsmc_fab18');
    expect(cluster.lat).toBe(23.100);
    expect(cluster.lng).toBe(120.283);
  });

  it('carries bounds that contain every member, so it can be zoomed into', () => {
    const [cluster] = clusterFacilities([...tainan], { zoom: 7 });
    const [[lat0, lng0], [lat1, lng1]] = cluster.bounds;
    tainan.forEach((m) => {
      expect(m.lat).toBeGreaterThanOrEqual(lat0);
      expect(m.lat).toBeLessThanOrEqual(lat1);
      expect(m.lng).toBeGreaterThanOrEqual(lng0);
      expect(m.lng).toBeLessThanOrEqual(lng1);
    });
  });

  /* A group holding one stopped fab is not quiet because the other seven are. */
  it('takes its state from the worst member, not the average or the anchor', () => {
    const stateOf = (f) => (f.id === 'umc_12a' ? 0.9 : 0.01);
    const [cluster] = clusterFacilities([...tainan], { zoom: 7, stateOf });
    expect(cluster.state).toBe(0.9);
  });

  it('handles empty, missing and malformed input without throwing', () => {
    expect(clusterFacilities([])).toEqual([]);
    expect(clusterFacilities(null)).toEqual([]);
    expect(clusterFacilities([site('bad', NaN, 1), ...kyushu], { zoom: 7 })).toHaveLength(1);
  });
});

describe('clusterLabel', () => {
  const ctx = { COMPANY_BY_ID: { co: { name: 'TSMC' }, other: { name: 'UMC' } } };

  it('names a single site by its own name', () => {
    const [only] = clusterFacilities(kyushu, { zoom: 12 });
    expect(clusterLabel(only, ctx)).toBe('jasm');
  });

  it('names a single-operator cluster after that operator', () => {
    const [cluster] = clusterFacilities([site('a', 24, 121), site('b', 24.01, 121.01)], { zoom: 7 });
    expect(clusterLabel(cluster, ctx)).toBe('TSMC — 2 sites');
  });

  it('counts operators when a cluster spans several', () => {
    const [cluster] = clusterFacilities([
      site('a', 24, 121, { company: 'co' }),
      site('b', 24.01, 121.01, { company: 'other' }),
    ], { zoom: 7 });
    expect(clusterLabel(cluster, ctx)).toBe('2 sites · 2 operators');
  });
});
