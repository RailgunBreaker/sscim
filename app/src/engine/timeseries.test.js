import { describe, it, expect } from 'vitest';
import { buildEngine } from './index.js';
import { getEventAssumption } from './event-assumptions.js';
import { makeFixtureData } from './testFixture.js';
import {
  buildIndexSeries, seriesStats, findPeaks, runsAbove, rollingMean,
  eventImpacts, impactsByType, summarizeByYear, eventDensity, correlation,
  analyzeIndexHistory, NEUTRAL_INDEX,
} from './timeseries.js';

/* The fixture's events all sit at daysAgo 0, which is useless for a history.
   Spread them across two years so the series has structure to analyse, and
   keep the real ids so the actual EVENT_ASSUMPTIONS classification applies
   (e1/e2 scored, e3/e5/e6 excluded — see event-assumptions.js). */
function makeHistoricalData() {
  const data = makeFixtureData();
  const ages = { e1: 30, e2: 400, e3: 200, e5: 250, e6: 600 };
  return { ...data, EVENTS: data.EVENTS.map((e) => ({ ...e, daysAgo: ages[e.id] })) };
}

const engineFor = (data) => buildEngine(data);

describe('buildIndexSeries', () => {
  it('runs oldest to newest and ends on the snapshot date', () => {
    const engine = engineFor(makeHistoricalData());
    const points = buildIndexSeries(engine, { spanDays: 100 });
    expect(points).toHaveLength(101);
    expect(points[0].daysAgo).toBe(100);
    expect(points[points.length - 1].daysAgo).toBe(0);
  });

  it('reads every value from the engine, never from interpolation', () => {
    const engine = engineFor(makeHistoricalData());
    const points = buildIndexSeries(engine, { spanDays: 60 });
    points.forEach((p) => expect(p.index).toBeCloseTo(engine.chainIndexAt(p.daysAgo), 12));
  });

  it('always includes the snapshot date even when step does not divide the span', () => {
    const engine = engineFor(makeHistoricalData());
    const points = buildIndexSeries(engine, { spanDays: 100, step: 7 });
    expect(points[points.length - 1].daysAgo).toBe(0);
    // 100, 93, ... 2, then the appended 0
    expect(points[points.length - 2].daysAgo).toBeGreaterThan(0);
  });

  it('labels points with dates when given a snapshot timestamp', () => {
    const engine = engineFor(makeHistoricalData());
    const asOfMs = Date.parse('2026-07-29');
    const points = buildIndexSeries(engine, { spanDays: 10, asOfMs });
    expect(points[points.length - 1].dateMs).toBe(asOfMs);
    expect(points[0].dateMs).toBe(asOfMs - 10 * 86400000);
  });

  it('defaults its span to the engine long-history span', () => {
    const engine = engineFor(makeHistoricalData());
    const points = buildIndexSeries(engine);
    expect(points[0].daysAgo).toBe(engine.longSpanDays);
  });
});

describe('seriesStats', () => {
  it('reports the extremes with the points they occurred on', () => {
    const points = [
      { daysAgo: 3, index: 5 }, { daysAgo: 2, index: 7.5 },
      { daysAgo: 1, index: 4.2 }, { daysAgo: 0, index: 6.1 },
    ];
    const s = seriesStats(points);
    expect(s.max).toBe(7.5);
    expect(s.maxAt.daysAgo).toBe(2);
    expect(s.min).toBe(4.2);
    expect(s.minAt.daysAgo).toBe(1);
    expect(s.daysAbove6).toBe(2);
    expect(s.daysAbove7).toBe(1);
    expect(s.daysBelowNeutral).toBe(1);
    expect(s.daysFlat).toBe(1);
    expect(s.samples).toBe(4);
  });

  it('returns null for an empty series rather than NaN statistics', () => {
    expect(seriesStats([])).toBeNull();
    expect(seriesStats(undefined)).toBeNull();
  });

  it('computes a zero standard deviation for a flat series', () => {
    const flat = Array.from({ length: 10 }, (_, i) => ({ daysAgo: 9 - i, index: 5 }));
    const s = seriesStats(flat);
    expect(s.sd).toBe(0);
    expect(s.mean).toBe(5);
    expect(s.daysFlat).toBe(10);
  });
});

describe('findPeaks', () => {
  const series = (values) => values.map((v, i) => ({ daysAgo: values.length - 1 - i, index: v }));

  it('keeps the tallest sample of a cluster and drops its neighbours', () => {
    const points = series([5, 5.5, 7, 6.5, 5.2, 5, 5, 5]);
    const peaks = findPeaks(points, { minSeparationDays: 30 });
    expect(peaks).toHaveLength(1);
    expect(peaks[0].index).toBe(7);
  });

  it('separates two peaks that are further apart than the separation window', () => {
    const values = new Array(90).fill(5);
    values[10] = 7; values[70] = 6.5;
    const peaks = findPeaks(series(values), { minSeparationDays: 30 });
    expect(peaks).toHaveLength(2);
    expect(peaks.map((p) => p.index)).toEqual([7, 6.5]);
  });

  it('ignores a flat neutral series', () => {
    expect(findPeaks(series(new Array(50).fill(5)))).toHaveLength(0);
  });

  it('returns peaks in descending order of index', () => {
    const values = new Array(200).fill(5);
    values[10] = 6.2; values[60] = 7.4; values[120] = 6.8;
    const peaks = findPeaks(series(values), { minSeparationDays: 30 });
    expect(peaks.map((p) => p.index)).toEqual([7.4, 6.8, 6.2]);
  });
});

describe('runsAbove', () => {
  const series = (values) => values.map((v, i) => ({ daysAgo: values.length - 1 - i, index: v }));

  it('measures contiguous stretches and their peaks', () => {
    const runs = runsAbove(series([5, 6.5, 6.2, 6.9, 5, 5, 6.1, 5]), 6);
    expect(runs).toHaveLength(2);
    expect(runs[0].samples).toBe(3);
    expect(runs[0].peak).toBe(6.9);
    expect(runs[1].samples).toBe(1);
  });

  it('closes a run that reaches the end of the series', () => {
    const runs = runsAbove(series([5, 5, 6.5, 6.6]), 6);
    expect(runs).toHaveLength(1);
    expect(runs[0].samples).toBe(2);
    expect(runs[0].toDaysAgo).toBe(0);
  });

  it('returns nothing when the series never crosses the threshold', () => {
    expect(runsAbove(series([5, 5.9, 6]), 6)).toHaveLength(0);
  });

  it('orders runs longest first', () => {
    const runs = runsAbove(series([6.1, 5, 6.1, 6.2, 6.3, 5]), 6);
    expect(runs.map((r) => r.samples)).toEqual([3, 1]);
  });
});

describe('rollingMean', () => {
  it('preserves length and smooths a single spike', () => {
    const points = [0, 0, 0, 9, 0, 0, 0].map((v, i) => ({ daysAgo: 6 - i, index: v }));
    const smoothed = rollingMean(points, 3);
    expect(smoothed).toHaveLength(points.length);
    expect(smoothed[3].index).toBeLessThan(9);
    expect(smoothed[3].index).toBeGreaterThan(0);
  });

  it('leaves a constant series unchanged', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({ daysAgo: 19 - i, index: 5 }));
    rollingMean(points, 7).forEach((p) => expect(p.index).toBeCloseTo(5, 12));
  });
});

describe('eventImpacts', () => {
  it('reports every event, with excluded ones as explicit zeros', () => {
    const engine = engineFor(makeHistoricalData());
    const impacts = eventImpacts(engine, getEventAssumption);
    expect(impacts).toHaveLength(5);
    const excluded = impacts.filter((i) => !i.operational);
    expect(excluded.length).toBeGreaterThan(0);
    excluded.forEach((i) => {
      expect(i.marginal).toBe(0);
      expect(i.standalone).toBe(0);
      expect(i.reason).toBeTruthy();
    });
  });

  it('gives a scored adverse event a positive marginal effect on its own date', () => {
    const engine = engineFor(makeHistoricalData());
    const impacts = eventImpacts(engine, getEventAssumption);
    const e1 = impacts.find((i) => i.id === 'e1');
    expect(e1.operational).toBe(true);
    expect(e1.marginal).toBeGreaterThan(0);
    expect(e1.indexOnDate).toBeGreaterThan(NEUTRAL_INDEX);
  });

  it('gives a mitigating event a negative marginal effect', () => {
    const engine = engineFor(makeHistoricalData());
    const impacts = eventImpacts(engine, getEventAssumption);
    // e2 is classified mitigating/downstream/operational in event-assumptions.js
    expect(getEventAssumption('e2').direction).toBe('mitigating');
    expect(impacts.find((i) => i.id === 'e2').marginal).toBeLessThan(0);
  });

  it('never exceeds the standalone effect when shocks overlap', () => {
    /* Two identical scored events on the same stage and date: noisy-OR
       saturation (math.js combineSigned) means each one's marginal
       contribution is strictly less than what it would do alone. This is the
       property that makes marginal attribution the honest measure — and it is
       exactly the duplicate-record case that inflates the index if one real
       event is approved several times.

       The copy carries an inline `assumption` because the engine reads
       `e.assumption || getEventAssumption(e.id)`: an id absent from
       EVENT_ASSUMPTIONS is not scored at all, which would make this test
       silently measure a single event. */
    const data = makeHistoricalData();
    const twin = { ...data.EVENTS.find((e) => e.id === 'e1'), assumption: getEventAssumption('e1') };
    const engine = engineFor({ ...data, EVENTS: [twin, { ...twin, id: 'e1_copy' }] });
    const impacts = eventImpacts(engine, (id) => getEventAssumption(id === 'e1_copy' ? 'e1' : id));
    const first = impacts.find((i) => i.id === 'e1');
    expect(first.marginal).toBeGreaterThan(0);
    expect(first.marginal).toBeLessThan(first.standalone);
  });

  it('sorts oldest first', () => {
    const engine = engineFor(makeHistoricalData());
    const ages = eventImpacts(engine, getEventAssumption).map((i) => i.daysAgo);
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
  });

  it('honours an explicit event subset', () => {
    const engine = engineFor(makeHistoricalData());
    const subset = engine.EVENTS.filter((e) => e.id === 'e1');
    expect(eventImpacts(engine, getEventAssumption, { events: subset })).toHaveLength(1);
  });
});

describe('impactsByType', () => {
  it('aggregates scored events only and orders by total effect', () => {
    const impacts = [
      { type: 'Export Control', operational: true, marginal: 1 },
      { type: 'Export Control', operational: true, marginal: 0.5 },
      { type: 'Natural Disaster', operational: true, marginal: 0.4 },
      { type: 'Policy Signal', operational: false, marginal: 0 },
    ];
    const rows = impactsByType(impacts);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: 'Export Control', count: 2, total: 1.5, max: 1 });
    expect(rows[0].mean).toBeCloseTo(0.75, 12);
    expect(rows[1].type).toBe('Natural Disaster');
  });
});

describe('summarizeByYear', () => {
  it('buckets points and events into calendar years', () => {
    const asOfMs = Date.parse('2026-07-29');
    const points = [
      { daysAgo: 400, index: 5 },   // 2025
      { daysAgo: 300, index: 6.5 }, // 2025
      { daysAgo: 10, index: 7 },    // 2026
      { daysAgo: 0, index: 5 },     // 2026
    ];
    const impacts = [
      { daysAgo: 400, operational: true }, { daysAgo: 300, operational: false },
      { daysAgo: 10, operational: true },
    ];
    const rows = summarizeByYear(points, impacts, asOfMs);
    expect(rows.map((r) => r.year)).toEqual([2025, 2026]);
    expect(rows[0]).toMatchObject({ samples: 2, events: 2, scored: 1, daysAbove6: 1 });
    expect(rows[1]).toMatchObject({ samples: 2, events: 1, scored: 1, daysFlat: 1 });
  });
});

describe('eventDensity', () => {
  it('counts only scored events inside the trailing window', () => {
    // The window for a point at daysAgo D is [D, D+30): the 30 days BEFORE it.
    const points = [{ daysAgo: 100, index: 5 }, { daysAgo: 0, index: 6 }];
    const impacts = [
      { daysAgo: 110, operational: true, sev: 5 },  // 10 days before the first point — counts
      { daysAgo: 95, operational: true, sev: 7 },   // after the first point — does not count
      { daysAgo: 140, operational: true, sev: 8 },  // 40 days before — outside the window
      { daysAgo: 20, operational: true, sev: 6 },   // inside the window of the snapshot date
      { daysAgo: 10, operational: false, sev: 9 },  // inside, but not scored
    ];
    const density = eventDensity(points, impacts, { window: 30 });
    expect(density[0]).toMatchObject({ count: 1, severityMass: 5 });
    expect(density[1]).toMatchObject({ count: 1, severityMass: 6 });
  });

  it('includes an event dated on the point itself', () => {
    const density = eventDensity([{ daysAgo: 50, index: 6 }], [{ daysAgo: 50, operational: true, sev: 7 }]);
    expect(density[0]).toMatchObject({ count: 1, severityMass: 7 });
  });
});

describe('correlation', () => {
  it('is 1 for a perfectly increasing relationship and -1 for the reverse', () => {
    expect(correlation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 12);
    expect(correlation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 12);
  });

  it('returns null rather than NaN when a series is constant or too short', () => {
    expect(correlation([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(correlation([1], [1])).toBeNull();
  });
});

describe('analyzeIndexHistory', () => {
  it('produces a coherent analysis whose parts agree with the engine', () => {
    const engine = engineFor(makeHistoricalData());
    const asOfMs = Date.parse('2026-07-29');
    const a = analyzeIndexHistory(engine, getEventAssumption, { spanDays: 700, asOfMs });

    expect(a.points[0].daysAgo).toBe(700);
    expect(a.stats.samples).toBe(701);
    expect(a.trend).toHaveLength(a.points.length);
    expect(a.impacts).toHaveLength(engine.EVENTS.length);
    expect(a.byYear.length).toBeGreaterThan(1);
    expect(a.spanDays).toBe(700);

    // the reported maximum really is the maximum the engine computes
    const maxFromEngine = Math.max(...a.points.map((p) => engine.chainIndexAt(p.daysAgo)));
    expect(a.stats.max).toBeCloseTo(maxFromEngine, 12);

    // every index stays inside the engine's declared bounds
    a.points.forEach((p) => {
      expect(p.index).toBeGreaterThanOrEqual(0);
      expect(p.index).toBeLessThanOrEqual(10);
    });
  });

  it('holds the index at exactly neutral before the oldest event', () => {
    const engine = engineFor(makeHistoricalData());
    const oldest = Math.max(...engine.EVENTS.map((e) => e.daysAgo));
    const a = analyzeIndexHistory(engine, getEventAssumption, { spanDays: oldest + 60 });
    expect(a.points[0].index).toBeCloseTo(NEUTRAL_INDEX, 12);
    expect(a.stats.daysFlat).toBeGreaterThan(0);
  });
});
