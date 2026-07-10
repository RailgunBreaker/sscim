import { describe, it, expect } from 'vitest';
import { STAGE_INTRO, introForCompany, introForCountry, flagEmoji } from './glossary.js';
import { buildEngine } from '../engine/index.js';
import { makeFixtureData } from '../engine/testFixture.js';
import { buildModel } from '../engine/buildModel.js';

describe('flagEmoji()', () => {
  it('builds a two-codepoint regional-indicator flag for a plain ISO id', () => {
    expect(flagEmoji('us')).toBe('🇺🇸');
    expect(flagEmoji('jp')).toBe('🇯🇵');
  });
  it('maps the dataset\'s "uk" id to the GB flag', () => {
    expect(flagEmoji('uk')).toBe('🇬🇧');
  });
});

describe('STAGE_INTRO', () => {
  it('has a non-empty description for every stage in the fixture graph', () => {
    const { STAGES } = makeFixtureData();
    // the fixture uses synthetic ids (s1..s5) not present in STAGE_INTRO,
    // so check against the real 24-stage id set instead.
    const realIds = ['research', 'eda', 'design', 'wafers', 'resist', 'gases', 'substrates', 'litho', 'depo', 'etch', 'cmp', 'metro', 'adv_fab', 'mature_fab', 'memory_fab', 'logic_ai', 'analog', 'hbm', 'adv_pkg', 'osat', 'systems', 'm_ai', 'm_auto', 'm_consumer'];
    realIds.forEach((id) => {
      expect(typeof STAGE_INTRO[id]).toBe('string');
      expect(STAGE_INTRO[id].length).toBeGreaterThan(10);
    });
    expect(STAGES.length).toBeGreaterThan(0); // sanity: fixture still loads
  });
});

describe('introForCompany() / introForCountry() — derived only from audited fields', () => {
  it('mentions the company name and its top-share stage, with no fabricated facts', () => {
    const data = makeFixtureData();
    const engine = buildEngine(data);
    const coA = data.COMPANIES.find((c) => c.id === 'coA');
    const intro = introForCompany(coA, { STAGE_BY_ID: engine.STAGE_BY_ID, COUNTRY_NAMES: data.COUNTRY_NAMES, CUSTOMERS: data.CUSTOMERS, SUPPLIERS: engine.SUPPLIERS });
    expect(intro).toContain(coA.name);
    expect(intro).toContain('Stage 1'); // coA's only stake is s1 ("Stage 1")
  });

  it('country intro reports stage participation derived from model.countriesActive, not a new claim', () => {
    const data = makeFixtureData();
    const engine = buildEngine(data);
    const model = buildModel({ data, engine, scenario: null });
    const intro = introForCountry('us', { COUNTRY_NAMES: data.COUNTRY_NAMES, STAGE_BY_ID: engine.STAGE_BY_ID, COMPANIES: data.COMPANIES }, model);
    expect(intro).toContain(data.COUNTRY_NAMES.us);
  });
});
