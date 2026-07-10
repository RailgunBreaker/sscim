import { describe, it, expect } from 'vitest';
import { buildEngine } from '../engine/index.js';
import { makeFixtureData } from '../engine/testFixture.js';
import { buildModel } from '../engine/buildModel.js';
import { mapEncoding, graphEncoding, fmtSigned, pct } from './lensEncoding.js';

function setup(scenario = null) {
  const data = makeFixtureData();
  const engine = buildEngine(data);
  const model = buildModel({ data, engine, scenario });
  return { data, engine, model };
}

describe('mapEncoding', () => {
  it('structural lens uses raw structural values (0–10) with size + numeric badge, not color alone', () => {
    const { data, engine, model } = setup();
    const { enc, legend } = mapEncoding({ lens: 'structural', model, engine, data, selected: null });
    expect(enc.us).toBeTruthy();
    expect(enc.us.value).toBeCloseTo(model.countriesActive.us.structural, 10);
    expect(enc.us.badge).not.toBe(''); // numeric badge present (not color-only)
    expect(legend.title).toMatch(/Structural/i);
  });

  it('share lens with a stage selected returns each country’s RAW share of that stage', () => {
    const { data, engine, model } = setup();
    // fixture stage s3 has shares { cn: 1 }
    const { enc, legend } = mapEncoding({ lens: 'share', model, engine, data, selected: { type: 'stage', id: 's3' } });
    expect(enc.cn.value).toBe(1);        // raw share preserved
    expect(enc.cn.badge).toBe('100%');
    expect(enc.us.value).toBe(0);        // us has no share of s3
    expect(legend.title).toMatch(/Selected share/i);
  });
});

describe('graphEncoding', () => {
  it('share lens with a country selected shades stages by that country’s raw share', () => {
    const { data, engine, model } = setup();
    // us has share 1 of s1/s2/s5, 0 of s3/s4 in the fixture
    const { enc } = graphEncoding({ lens: 'share', model, engine, data, selected: { type: 'country', id: 'us' } });
    expect(enc.s1.value).toBe(1);
    expect(enc.s3.value).toBe(0);
    expect(enc.s1.badge).toBe('100%');
  });

  it('structural lens badges every stage with its 0–10 value', () => {
    const { data, engine, model } = setup();
    const { enc } = graphEncoding({ lens: 'structural', model, engine, data, selected: null });
    Object.values(enc).forEach((e) => expect(e.badge).not.toBe(''));
  });
});

describe('formatting helpers', () => {
  it('fmtSigned keeps the sign', () => {
    expect(fmtSigned(0.5)).toBe('+0.50');
    expect(fmtSigned(-0.5)).toBe('-0.50');
  });
  it('pct rounds to whole percent', () => {
    expect(pct(0.345)).toBe('35%');
  });
});
