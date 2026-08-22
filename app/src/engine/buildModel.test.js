import { describe, it, expect } from 'vitest';
import { buildEngine } from './index.js';
import { buildModel, reviewDateISO } from './buildModel.js';
import { makeFixtureData } from './testFixture.js';

function fixture() {
  const data = makeFixtureData();
  return { data, engine: buildEngine(data) };
}

const hazard = {
  id: 'hazard',
  event: { sev: 8, daysAgo: 0, conf: 'Simulated', stages: ['s1'], countries: ['us'],
    assumption: { direction: 'adverse', channel: 'both', operational: true } },
};

describe('buildModel — live', () => {
  it('reports no review and no overlay by default', () => {
    const { data, engine } = fixture();
    const m = buildModel({ data, engine });
    expect(m.reviewing).toBe(false);
    expect(m.asOfDaysAgo).toBe(0);
    expect(m.scenarioActive).toBe(false);
    expect(m.chainIndexDelta).toBe(0);
    expect(m.activeChainIndex).toBeCloseTo(m.baselineChainIndex, 12);
    expect(m.eventsInWindow).toBe(data.EVENTS.length);
  });
});

describe('buildModel — history review', () => {
  it('re-derives from the back-dated event set, not from today with a new label', () => {
    const { data, engine } = fixture();
    const live = buildModel({ data, engine });
    const past = buildModel({ data, engine, asOfDaysAgo: 400 });
    expect(past.reviewing).toBe(true);
    expect(past.asOfDaysAgo).toBe(400);
    // 400 days back, every fixture event is either unborn or decayed away
    expect(past.eventsInWindow).toBeLessThanOrEqual(live.eventsInWindow);
    expect(past.activeChainIndex).not.toBeCloseTo(live.activeChainIndex, 6);
  });

  it('matches the engine own index for that date, so the panel and the chart agree', () => {
    const { data, engine } = fixture();
    [0, 5, 20, 90].forEach((t) => {
      const m = buildModel({ data, engine, asOfDaysAgo: t });
      expect(m.baselineChainIndex).toBeCloseTo(engine.chainIndexAt(t), 9);
    });
  });

  it('reports the honest denominator — how many events were in the window then', () => {
    const { data, engine } = fixture();
    const m = buildModel({ data, engine, asOfDaysAgo: 30 });
    expect(m.eventsInWindow).toBe(engine.eventsAsOf(30).length);
  });

  it('never rewrites the sparkline history', () => {
    const { data, engine } = fixture();
    expect(buildModel({ data, engine, asOfDaysAgo: 200 }).history).toEqual(engine.HISTORY);
  });

  it('treats a zero, negative or non-finite offset as live', () => {
    const { data, engine } = fixture();
    [0, -5, NaN, undefined].forEach((t) => {
      expect(buildModel({ data, engine, asOfDaysAgo: t }).reviewing).toBe(false);
    });
  });
});

describe('buildModel — hazard overlay', () => {
  it('moves the active index while leaving the baseline alone', () => {
    const { data, engine } = fixture();
    const base = buildModel({ data, engine });
    const withHazard = buildModel({ data, engine, scenario: hazard });
    expect(withHazard.scenarioActive).toBe(true);
    expect(withHazard.baselineChainIndex).toBeCloseTo(base.baselineChainIndex, 12);
    expect(withHazard.activeChainIndex).toBeGreaterThan(withHazard.baselineChainIndex);
    expect(withHazard.chainIndexDelta).toBeCloseTo(
      withHazard.activeChainIndex - withHazard.baselineChainIndex, 12,
    );
  });

  /* The composition is the point: reviewing a past date with a hazard on top
     answers "what would this have done, then", so the baseline it is
     measured against has to be that date and not today. */
  it('composes with a review, measuring the delta against the reviewed date', () => {
    const { data, engine } = fixture();
    const reviewOnly = buildModel({ data, engine, asOfDaysAgo: 45 });
    const both = buildModel({ data, engine, asOfDaysAgo: 45, scenario: hazard });
    expect(both.reviewing).toBe(true);
    expect(both.scenarioActive).toBe(true);
    expect(both.baselineChainIndex).toBeCloseTo(reviewOnly.baselineChainIndex, 12);
    expect(both.activeChainIndex).toBeGreaterThan(both.baselineChainIndex);
  });
});

describe('reviewDateISO', () => {
  it('resolves an offset to a calendar date from the snapshot date', () => {
    const { engine } = fixture();
    const asOf = engine.MODEL_PRIORS.datasetAsOf;
    expect(reviewDateISO(engine, 0)).toBe(asOf);
    const back = reviewDateISO(engine, 10);
    expect(Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${back}T00:00:00Z`)).toBe(10 * 86400000);
  });

  it('treats a missing offset as the snapshot date', () => {
    const { engine } = fixture();
    expect(reviewDateISO(engine)).toBe(engine.MODEL_PRIORS.datasetAsOf);
  });
});
