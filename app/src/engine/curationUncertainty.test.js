import { describe, it, expect } from 'vitest';
import { buildCurationDesign, applyCurationScenario, testedScenarioRange, COMPANY_CURATION_LABEL } from './curationUncertainty.js';

const events = [{ id: 'a', stages: ['x'], assumption: { direction: 'adverse' } }, { id: 'm', stages: ['x'], assumption: { direction: 'mitigating' } }];
const model = Object.fromEntries(events.map(e => [e.id, { exposure: { x: .4 }, exposureLow: { x: .2 }, exposureHigh: { x: .6 }, profile: { kind: 'market_exponential' }, altProfile: { kind: 'acute_exponential' } }]));
const design = () => buildCurationDesign({ events, model, assumptionOf: e => e.assumption, samples: 4, seed: 17, sharedGroups: [] });

describe('curation scenario design', () => {
  it('includes baseline and opposing sign combinations that coupled corners miss', () => {
    const d = design();
    expect(d.scenarios[0].id).toBe('baseline');
    const low = d.scenarios.find(s => s.id === 'adverse-low-mitigating-high');
    const high = d.scenarios.find(s => s.id === 'adverse-high-mitigating-low');
    expect(low.exposureLevels).toEqual({ a: 'low', m: 'high' });
    expect(high.exposureLevels).toEqual({ a: 'high', m: 'low' });
    const score = s => { const e = applyCurationScenario(events, s); return 5 + (e[0].model || model.a).exposure.x - (e[1].model || model.m).exposure.x; };
    expect(score(low)).toBeCloseTo(4.6);
    expect(score(high)).toBeCloseTo(5.4);
    expect(score(d.scenarios.find(s => s.id === 'all-low'))).toBe(5);
  });
  it('reproduces the complete design and preserves correlated stage scope assumptions', () => {
    expect(design()).toEqual(design());
    expect(design().dependencies).toContain('No incident independence');
  });
  it('crosses individual and combined alternative profiles with opposing exposures', () => {
    const d = design();
    expect(d.scenarios.some(s => s.kind === 'individual-exposure-profile')).toBe(true);
    expect(d.scenarios.some(s => s.alternativeProfileIds.length === 2 && s.exposureLevels.a === 'high' && s.exposureLevels.m === 'low')).toBe(true);
  });
  it('requires baseline and labels a finite tested range without a bound or CI claim', () => {
    expect(() => testedScenarioRange([{ id: 'other', headline: 4 }])).toThrow(/baseline/);
    const range = testedScenarioRange([{ id: 'baseline', headline: 5 }, { id: 'low', headline: 4 }]);
    expect(range).toMatchObject({ low: 4, base: 5, high: 5, provenBound: false, confidenceInterval: false });
    expect(COMPANY_CURATION_LABEL).toContain('Structurally unaffected');
  });
});
