import { describe, it, expect } from 'vitest';
import {
  haversineKm, siteWeight, buildFacilityLayer, facilitiesWithin,
  hazardFootprint, footprintToDraftSources, facilityImpact, facilitiesForEvent,
  DISPLAY_EXPOSURE_THRESHOLD, STATUS_EXPOSURE, footprintToHazardScenario, SCALE_MAPPINGS, statusWeight,
} from './facilities.js';

const site = (id, over = {}) => ({
  id, name: id, company: 'co', country: 'jp', lat: 0, lng: 0,
  kind: 'fab', stages: ['mature_fab'], scale: 3, status: 'operating', ...over,
});

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(35, 139, 35, 139)).toBe(0);
  });

  it('matches a known separation within a percent', () => {
    // Tokyo (35.68,139.77) → Osaka (34.69,135.50): ~400km great-circle.
    const d = haversineKm(35.68, 139.77, 34.69, 135.50);
    expect(d).toBeGreaterThan(390);
    expect(d).toBeLessThan(410);
  });

  it('is symmetric', () => {
    expect(haversineKm(10, 20, -30, 100)).toBeCloseTo(haversineKm(-30, 100, 10, 20), 9);
  });
});

describe('siteWeight', () => {
  it('discounts by status — a fab under construction cannot lose output it is not making', () => {
    expect(siteWeight(site('a', { scale: 4, status: 'operating' }))).toBe(4);
    expect(siteWeight(site('b', { scale: 4, status: 'ramping' }))).toBe(4 * STATUS_EXPOSURE.ramping);
    expect(siteWeight(site('c', { scale: 4, status: 'construction' }))).toBe(0);
    expect(siteWeight(site('d', { scale: 4, status: 'idle' }))).toBe(0);
  });

  it('is 0 for a malformed record rather than NaN', () => {
    expect(siteWeight({})).toBe(0);
    expect(siteWeight(null)).toBe(0);
  });
});

describe('buildFacilityLayer', () => {
  const layer = buildFacilityLayer([
    site('big', { scale: 5, stages: ['adv_fab', 'mature_fab'] }),
    site('small', { scale: 1, stages: ['adv_fab'], country: 'tw' }),
    site('future', { scale: 5, stages: ['adv_fab'], status: 'construction' }),
  ]);

  it('indexes by id, country, stage and company', () => {
    expect(layer.FACILITY_BY_ID.big.id).toBe('big');
    expect(layer.FACILITIES_BY_COUNTRY.jp.map((f) => f.id)).toEqual(['big', 'future']);
    expect(layer.FACILITIES_BY_COUNTRY.tw.map((f) => f.id)).toEqual(['small']);
    expect(layer.FACILITIES_BY_STAGE.adv_fab).toHaveLength(3);
    expect(layer.FACILITIES_BY_COMPANY.co).toHaveLength(3);
  });

  it('shares sum to 1 across the sites of a stage, ignoring zero-weight sites', () => {
    const shares = layer.FACILITIES_BY_STAGE.adv_fab.map((f) => layer.shareOfStage(f, 'adv_fab'));
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    // the construction site holds no share — it has nothing to lose yet
    expect(layer.shareOfStage(layer.FACILITY_BY_ID.future, 'adv_fab')).toBe(0);
    expect(layer.shareOfStage(layer.FACILITY_BY_ID.big, 'adv_fab')).toBeCloseTo(5 / 6, 9);
  });

  it('returns 0 rather than dividing by zero for an unmodeled stage', () => {
    expect(layer.shareOfStage(layer.FACILITY_BY_ID.big, 'eda')).toBe(0);
  });

  it('degrades to empty indices on an empty or missing table', () => {
    expect(buildFacilityLayer().FACILITIES).toEqual([]);
    expect(buildFacilityLayer(null).FACILITY_BY_ID).toEqual({});
  });
});

describe('facilitiesWithin', () => {
  const kumamoto = site('kumamoto', { lat: 32.88, lng: 130.79 });
  const naka = site('naka', { lat: 36.46, lng: 140.53 });
  const list = [naka, kumamoto];

  it('returns only sites inside the radius, nearest first', () => {
    const hits = facilitiesWithin(list, { lat: 32.8, lng: 130.7, radiusKm: 220 });
    expect(hits.map((h) => h.facility.id)).toEqual(['kumamoto']);
    expect(hits[0].distanceKm).toBeLessThan(20);
  });

  it('widens correctly — a national-scale radius catches both', () => {
    const hits = facilitiesWithin(list, { lat: 34.5, lng: 135, radiusKm: 900 });
    expect(hits.map((h) => h.facility.id)).toEqual(['kumamoto', 'naka']);
  });

  it('is empty for a bad centre rather than throwing', () => {
    expect(facilitiesWithin(list, { lat: NaN, lng: 130, radiusKm: 100 })).toEqual([]);
    expect(facilitiesWithin(undefined, { lat: 0, lng: 0, radiusKm: 100 })).toEqual([]);
  });
});

describe('hazardFootprint', () => {
  /* A deliberately Kyushu-shaped fixture: two sites in one valley feeding
     different stages, one far away feeding the same stage as one of them. */
  const layer = buildFacilityLayer([
    site('kyushu_logic', { lat: 32.89, lng: 130.79, stages: ['mature_fab'], scale: 2 }),
    site('kyushu_cis', { lat: 32.87, lng: 130.79, stages: ['mature_fab', 'm_consumer'], scale: 3 }),
    site('kanto_mcu', { lat: 36.46, lng: 140.53, stages: ['mature_fab'], scale: 3 }),
    site('taiwan_edge', { lat: 23.10, lng: 120.28, stages: ['adv_fab'], scale: 5, country: 'tw' }),
  ]);

  const fp = hazardFootprint({ lat: 32.8, lng: 130.7, radiusKm: 220 }, layer);

  it('resolves a coordinate to the named plants around it', () => {
    expect(fp.hits.map((h) => h.facility.id).sort()).toEqual(['kyushu_cis', 'kyushu_logic']);
    expect(fp.countries).toEqual(['jp']);
  });

  it('reports the share of each stage that sits inside the radius', () => {
    const mature = fp.stages.find((s) => s.stageId === 'mature_fab');
    // 2 + 3 of a modeled 2 + 3 + 3
    expect(mature.exposure).toBeCloseTo(5 / 8, 9);
    const consumer = fp.stages.find((s) => s.stageId === 'm_consumer');
    expect(consumer.exposure).toBe(1); // the only modeled site for that stage
  });

  it('leaves stages with no site inside the radius out entirely', () => {
    expect(fp.stages.some((s) => s.stageId === 'adv_fab')).toBe(false);
  });

  /* THE v6 CLIFF, GONE. A footprint below the display threshold used to be
     dropped from the model entirely; now it is dimmed in the readout and
     scored in proportion to what it actually is. */
  it('keeps a below-threshold footprint as a scored source, and only DIMS it in the readout', () => {
    const wide = buildFacilityLayer([
      site('tiny', { lat: 0, lng: 0, stages: ['osat'], scale: 1 }),
      ...Array.from({ length: 10 }, (_, i) => site(`far${i}`, { lat: 50, lng: 50, stages: ['osat'], scale: 5 })),
    ]);
    const clipped = hazardFootprint({ lat: 0, lng: 0, radiusKm: 50 }, wide);
    const osat = clipped.stages.find((s) => s.stageId === 'osat');
    expect(osat.exposure).toBeLessThan(DISPLAY_EXPOSURE_THRESHOLD);
    expect(osat.exposure).toBeGreaterThan(0);
    expect(clipped.displayStages).toHaveLength(0);   // display partition only
    expect(clipped.minorStages).toHaveLength(1);
    expect(footprintToDraftSources(clipped).map((s) => s.id)).toEqual(['osat']); // still a source
  });

  it('builds a draft source from every stage with a nonzero footprint, carrying its exposure', () => {
    expect(footprintToDraftSources(fp).map((s) => s.id).sort()).toEqual(['m_consumer', 'mature_fab']);
    expect(footprintToDraftSources(fp).every((s) => s.type === 'stage')).toBe(true);
    const mature = footprintToDraftSources(fp).find((s) => s.id === 'mature_fab');
    expect(mature.exposure).toBeCloseTo(5 / 8, 9);
  });

  it('is empty, not broken, when nothing modeled is nearby', () => {
    const empty = hazardFootprint({ lat: -40, lng: -100, radiusKm: 100 }, layer);
    expect(empty.hits).toEqual([]);
    expect(empty.stages).toEqual([]);
    expect(empty.displayStages).toEqual([]);
    expect(empty.minorStages).toEqual([]);
    expect(footprintToDraftSources(empty)).toEqual([]);
  });

  /* Zero footprint must be zero, not "small". A radius that contains only
     idle or under-construction sites has nothing to lose. */
  it('drops a stage whose only sites inside the radius have zero operational weight', () => {
    const idleLayer = buildFacilityLayer([
      site('idle_in', { lat: 0, lng: 0, stages: ['osat'], scale: 5, status: 'idle' }),
      site('running_far', { lat: 50, lng: 50, stages: ['osat'], scale: 5 }),
    ]);
    const fpIdle = hazardFootprint({ lat: 0, lng: 0, radiusKm: 50 }, idleLayer);
    expect(fpIdle.hits).toHaveLength(1);
    expect(fpIdle.stages).toEqual([]);
    expect(footprintToHazardScenario(fpIdle, { severity: 9 })).toBeNull();
  });
});

describe('facilityImpact', () => {
  it('takes the strongest signed effect across the stages a site feeds', () => {
    const f = site('multi', { stages: ['a', 'b', 'c'] });
    expect(facilityImpact(f, { a: 0.1, b: -0.4, c: 0.2 })).toBe(-0.4);
    expect(facilityImpact(f, { a: 0.5, b: -0.4 })).toBe(0.5);
  });

  it('is 0 for a site whose stages carry no field', () => {
    expect(facilityImpact(site('x'), {})).toBe(0);
    expect(facilityImpact(null, { mature_fab: 1 })).toBe(0);
  });
});

describe('facilitiesForEvent', () => {
  const layer = buildFacilityLayer([
    site('jp_mature', { country: 'jp', stages: ['mature_fab'], scale: 2 }),
    site('jp_memory', { country: 'jp', stages: ['memory_fab'], scale: 4 }),
    site('kr_memory', { country: 'kr', stages: ['memory_fab'], scale: 5 }),
  ]);

  it('intersects the event geography with the stages it shocks', () => {
    const hit = facilitiesForEvent({ countries: ['jp'], stages: ['memory_fab'] }, layer);
    expect(hit.map((f) => f.id)).toEqual(['jp_memory']);
  });

  it('falls back to the stage alone when an event has no country tag', () => {
    const hit = facilitiesForEvent({ countries: [], stages: ['memory_fab'] }, layer);
    expect(hit.map((f) => f.id)).toEqual(['kr_memory', 'jp_memory']); // heaviest first
  });

  it('returns nothing for an event with neither', () => {
    expect(facilitiesForEvent({}, layer)).toEqual([]);
  });
});
