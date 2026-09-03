/* ====================================================================
   hazardExposure.test.js — the v6 5% CLIFF, proven gone.

   v6 refused to shock a stage whose modeled footprint inside a hazard
   radius was below 5%, and shocked it at FULL severity above 5%. Three
   separate defects followed, and this file pins all three shut:

     · 4.99% did nothing at all;
     · 5.01% did everything;
     · 5.01% did exactly as much as 100%.

   The properties asserted here are the ones that make a screening tool
   usable: zero means zero, more never means less, and the response is
   continuous everywhere — in particular across the old threshold, which is
   now a display preference and nothing more.
   ==================================================================== */
import { describe, it, expect } from 'vitest';
import { buildEngine } from './index.js';
import { makeFixtureData } from './testFixture.js';
import {
  buildFacilityLayer, hazardFootprint, footprintToHazardScenario,
  DISPLAY_EXPOSURE_THRESHOLD, siteWeight, statusWeight, SCALE_MAPPINGS,
} from './facilities.js';
import { BASE_PARAMS, PARAMETERS, resolveParams, MODEL_FORMS } from './registry.js';

/* A layer engineered so the footprint inside the radius is a chosen
   fraction of the stage's total modeled weight, to arbitrary precision:
   one site at the origin with weight `inside`, one far away with the
   complement. Scale is a plain number here so the fraction is exact under
   the linear (base) ordinal mapping. */
function layerWithExposure(fraction, stage = 's1') {
  const total = 10000;
  const inside = Math.round(fraction * total);
  const outside = total - inside;
  const sites = [];
  if (inside > 0) sites.push({ id: 'near', name: 'near', company: 'x', country: 'us', lat: 0, lng: 0, stages: [stage], scale: inside, status: 'operating' });
  if (outside > 0) sites.push({ id: 'far', name: 'far', company: 'y', country: 'us', lat: 50, lng: 50, stages: [stage], scale: outside, status: 'operating' });
  return buildFacilityLayer(sites);
}

const exposureAt = (fraction, stage = 's1') =>
  hazardFootprint({ lat: 0, lng: 0, radiusKm: 100 }, layerWithExposure(fraction, stage));

/* The full pipeline: geometry -> scenario -> source vector -> propagation
   -> headline index delta. This is what a reader of the dashboard sees. */
function deltaAt(fraction, severity = 7) {
  const data = makeFixtureData();
  const engine = buildEngine(data);
  const fp = exposureAt(fraction);
  const scenario = footprintToHazardScenario(fp, { severity });
  const base = engine.operationalIndex(engine.operationalField(data.EVENTS));
  if (!scenario) return 0;
  const withHazard = engine.operationalIndex(engine.operationalField([...data.EVENTS, { ...scenario.event, id: 'hazard' }]));
  return withHazard - base;
}

describe('modeled facility footprint — the geometry', () => {
  it('zero footprint produces no stage entry at all, and no scenario', () => {
    const fp = exposureAt(0);
    expect(fp.stages).toEqual([]);
    expect(footprintToHazardScenario(fp, { severity: 10 })).toBeNull();
  });

  it('reports the footprint continuously, not in two buckets', () => {
    const seen = [0.01, 0.0499, 0.0501, 0.25, 0.5, 1].map((f) => exposureAt(f).stages[0].exposure);
    expect(new Set(seen.map((v) => v.toFixed(6))).size).toBe(seen.length);
    seen.forEach((v, i) => { if (i) expect(v).toBeGreaterThan(seen[i - 1]); });
  });

  it('is exactly 1 when every modeled site for the stage is inside', () => {
    expect(exposureAt(1).stages[0].exposure).toBeCloseTo(1, 12);
  });
});

describe('the 5% threshold is a display preference and nothing else', () => {
  it('a 4.99% footprint scores, where v6 scored nothing', () => {
    const below = exposureAt(DISPLAY_EXPOSURE_THRESHOLD - 0.0001);
    expect(below.stages[0].exposure).toBeLessThan(DISPLAY_EXPOSURE_THRESHOLD);
    expect(below.displayStages).toHaveLength(0);
    expect(deltaAt(DISPLAY_EXPOSURE_THRESHOLD - 0.0001)).toBeGreaterThan(0);
  });

  it('the index response is CONTINUOUS across the old 5% line', () => {
    const eps = 1e-4;
    const just_below = deltaAt(DISPLAY_EXPOSURE_THRESHOLD - eps);
    const just_above = deltaAt(DISPLAY_EXPOSURE_THRESHOLD + eps);
    expect(just_below).toBeGreaterThan(0);
    // The step across the line is of the order of the step in exposure, not
    // of the order of the whole effect: no cliff.
    const wholeEffect = deltaAt(1);
    expect(Math.abs(just_above - just_below)).toBeLessThan(0.02 * wholeEffect);
  });

  it('5.01% does NOT receive the same shock as 100% — the v6 defect, stated as a test', () => {
    const small = deltaAt(DISPLAY_EXPOSURE_THRESHOLD + 0.0001);
    const full = deltaAt(1);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(full);
    expect(small).toBeLessThan(0.25 * full); // and by a wide margin, not a rounding difference
  });
});

describe('monotonicity in exposure, for a nonnegative fixture', () => {
  const fractions = [0, 0.001, 0.01, 0.0499, 0.0501, 0.1, 0.25, 0.5, 0.75, 1];

  it('a larger footprint never produces a smaller source shock', () => {
    const seen = fractions.map((f) => exposureAt(f).stages[0]?.exposure ?? 0);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it('a larger footprint never produces a smaller index delta', () => {
    const seen = fractions.map((f) => deltaAt(f));
    expect(seen[0]).toBe(0);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] - 1e-12);
  });

  it('and a larger severity never produces a smaller index delta at fixed exposure', () => {
    const seen = [1, 3, 5, 7, 10].map((q) => deltaAt(0.4, q));
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] - 1e-12);
  });
});

describe('the ordinal scale is treated as an ordinal', () => {
  it('offers exactly the three declared model forms, all monotone in the ordinal', () => {
    expect(Object.keys(SCALE_MAPPINGS).sort()).toEqual([...MODEL_FORMS.facilityScaleMapping.options].sort());
    Object.values(SCALE_MAPPINGS).forEach((f) => {
      for (let k = 1; k < 5; k++) expect(f(k + 1)).toBeGreaterThanOrEqual(f(k));
    });
  });

  it('equal weighting discards the ordinal, convex weighting amplifies it', () => {
    const s = (mapping) => siteWeight({ scale: 4, status: 'operating' }, resolveParams({ facilityScaleMapping: mapping }));
    expect(s('equal')).toBe(1);
    expect(s('linear')).toBe(4);
    expect(s('convex')).toBe(16);
  });

  it('the footprint SHARE changes with the ordinal mapping — which is why the mapping is a reported model form', () => {
    const sites = [
      { id: 'a', company: 'x', country: 'us', lat: 0, lng: 0, stages: ['s1'], scale: 5, status: 'operating' },
      { id: 'b', company: 'y', country: 'us', lat: 50, lng: 50, stages: ['s1'], scale: 1, status: 'operating' },
      { id: 'c', company: 'z', country: 'us', lat: 50, lng: 51, stages: ['s1'], scale: 1, status: 'operating' },
    ];
    const share = (mapping) => hazardFootprint({ lat: 0, lng: 0, radiusKm: 100 },
      buildFacilityLayer(sites, resolveParams({ facilityScaleMapping: mapping }))).stages[0].exposure;
    expect(share('equal')).toBeCloseTo(1 / 3, 12);
    expect(share('linear')).toBeCloseTo(5 / 7, 12);
    expect(share('convex')).toBeCloseTo(25 / 27, 12);
  });
});

describe('status weights', () => {
  it('operating is 1 and both non-producing statuses are exactly 0 — definitional, not assumptions', () => {
    expect(statusWeight('operating', BASE_PARAMS)).toBe(1);
    expect(statusWeight('construction', BASE_PARAMS)).toBe(0);
    expect(statusWeight('idle', BASE_PARAMS)).toBe(0);
  });

  it('the ramping discount is the registry parameter, and moves across its declared range', () => {
    expect(statusWeight('ramping', BASE_PARAMS)).toBe(PARAMETERS.rampingSiteWeight.base);
    expect(statusWeight('ramping', resolveParams({ rampingSiteWeight: PARAMETERS.rampingSiteWeight.low })))
      .toBe(PARAMETERS.rampingSiteWeight.low);
    expect(statusWeight('ramping', resolveParams({ rampingSiteWeight: PARAMETERS.rampingSiteWeight.high })))
      .toBe(PARAMETERS.rampingSiteWeight.high);
  });
});

describe('the hazard scenario reports what it is', () => {
  it('describes the result as a modeled facility footprint, never as capacity share or damage', () => {
    const scenario = footprintToHazardScenario(exposureAt(0.4), { severity: 6 });
    expect(scenario.desc).toMatch(/modeled facility footprint/i);
    expect(scenario.desc).toMatch(/not capacity share and not physical damage/i);
    expect(scenario.event.model.exposure.s1).toBeCloseTo(0.4, 6);
    expect(scenario.event.model.exposureBasis).toBeTruthy();
    expect(scenario.event.model.profile.kind).toBe('acute_exponential');
  });
});
