import { describe, it, expect } from 'vitest';
import { draftToScenario } from './scenarioDraft.js';

const stageById = {
  litho: { id: 'litho', name: 'Lithography', shares: { nl: 0.9, jp: 0.1 } },
  fab: { id: 'fab', name: 'Fab', shares: { tw: 0.6, kr: 0.2 } },
  assembly: { id: 'assembly', name: 'Assembly', shares: { tw: 0.05 } }, // below threshold for tw
};

const base = { builderMode: false, sources: [], severity: 6, direction: 'adverse' };

describe('draftToScenario()', () => {
  it('returns null when there are no sources', () => {
    expect(draftToScenario(base, { stageById })).toBeNull();
  });

  it('builds an adverse scenario from stage sources', () => {
    const sc = draftToScenario({ ...base, sources: [{ type: 'stage', id: 'litho' }], severity: 7 }, { stageById });
    expect(sc.event.stages).toEqual(['litho']);
    expect(sc.event.sev).toBe(7);
    expect(sc.event.assumption.direction).toBe('adverse');
    expect(sc.event.assumption.operational).toBe(true);
  });

  it('expands a country source to the stages it participates in above threshold', () => {
    const sc = draftToScenario({ ...base, sources: [{ type: 'country', id: 'tw' }] }, { stageById });
    expect(sc.event.stages).toContain('fab'); // tw has 0.6 in fab
    expect(sc.event.stages).not.toContain('assembly'); // tw only 0.05 there
    expect(sc.event.countries).toEqual(['tw']);
  });

  it('mitigating direction is carried onto the event assumption', () => {
    const sc = draftToScenario({ ...base, sources: [{ type: 'stage', id: 'fab' }], direction: 'mitigating' }, { stageById });
    expect(sc.event.assumption.direction).toBe('mitigating');
  });

  it('neutral direction produces a zero-severity control shock', () => {
    const sc = draftToScenario({ ...base, sources: [{ type: 'stage', id: 'fab' }], direction: 'neutral', severity: 8 }, { stageById });
    expect(sc.event.sev).toBe(0);
  });

  it('de-duplicates stages when several sources overlap', () => {
    const sc = draftToScenario({ ...base, sources: [{ type: 'stage', id: 'fab' }, { type: 'country', id: 'tw' }] }, { stageById });
    expect(sc.event.stages.filter((s) => s === 'fab')).toHaveLength(1);
  });
});
