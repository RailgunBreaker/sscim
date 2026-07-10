import { describe, it, expect } from 'vitest';
import { buildEngine } from '../engine/index.js';
import { makeFixtureData } from '../engine/testFixture.js';
import { buildModel } from '../engine/buildModel.js';
import { briefingText } from './Briefing.jsx';

function setup(scenario) {
  const data = makeFixtureData();
  const engine = buildEngine(data);
  const model = buildModel({ data, engine, scenario });
  return { data, engine, model };
}

describe('briefingText() — scenario awareness', () => {
  it('includes the active scenario in WHAT CHANGED when one is running', () => {
    const scenario = {
      id: 'strait', name: 'Test crisis scenario', desc: 'A hypothetical test disruption.',
      event: { sev: 9, daysAgo: 0, conf: 'Simulated', stages: ['s3', 's4'], countries: ['cn'] },
    };
    const { data, engine, model } = setup(scenario);
    const text = briefingText(model, scenario, data, engine);
    expect(text).toContain('ACTIVE SCENARIO');
    expect(text).toContain(scenario.name.toUpperCase());
  });

  it('omits any active-scenario block when no scenario is running', () => {
    const { data, engine, model } = setup(undefined);
    const text = briefingText(model, undefined, data, engine);
    expect(text).not.toContain('ACTIVE SCENARIO');
  });

  it('ranks the country board by scenario marginal delta, never by structural baseline alone', () => {
    const scenario = {
      id: 'strait', name: 'Test crisis scenario', desc: 'A hypothetical test disruption.',
      event: { sev: 9, daysAgo: 0, conf: 'Simulated', stages: ['s3', 's4'], countries: ['cn'] },
    };
    const { data, engine, model } = setup(scenario);
    // Force a case where "us" has a high structural baseline but almost no
    // scenario delta, and "cn" has a low structural baseline but a large
    // scenario delta — a correct implementation must list "cn" first.
    const forcedModel = {
      ...model,
      countriesBase: { us: { structural: 9, operational: 0 }, cn: { structural: 1, operational: 0 } },
      countriesActive: { us: { structural: 9, operational: 0.01 }, cn: { structural: 1, operational: 0.9 } },
      countryDelta: { us: 0.01, cn: 0.9 },
    };
    const text = briefingText(forcedModel, scenario, data, engine);
    const board = text.split('COUNTRY BOARD')[1];
    expect(board.indexOf('China')).toBeGreaterThanOrEqual(0);
    expect(board.indexOf('China')).toBeLessThan(board.indexOf('United States'));
  });
});
