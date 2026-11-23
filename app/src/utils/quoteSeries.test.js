import { describe, it, expect } from 'vitest';
import {
  RANGES, rangeById, decodeSeries, seriesFor, windowChange, extent, project,
} from './quoteSeries.js';
import snapshot from '../data/vault-snapshot.json' with { type: 'json' };

const DAY = 86400;
const NOW = Date.parse('2026-11-23T01:00:00.000Z');

/* A daily series ending "today", with a weekend gap in it. */
const dailyFrom = (closes, startDaysAgo) => {
  const t0 = Math.floor(NOW / 1000) - startDaysAgo * DAY;
  return { t0, unit: DAY, o: closes.map((_, i) => i), v: closes, prevClose: closes[0], currency: 'USD' };
};

describe('decoding', () => {
  it('rebuilds timestamps from the base, unit and offsets', () => {
    const s = { t0: 1_700_000_000, unit: DAY, o: [0, 1, 4], v: [10, 11, 12] };
    const out = decodeSeries(s);
    expect(out.map((p) => p.v)).toEqual([10, 11, 12]);
    expect(out[1].t - out[0].t).toBe(DAY * 1000);
    expect(out[2].t - out[0].t).toBe(4 * DAY * 1000);
  });

  it('keeps gaps as gaps rather than interpolating a price that never traded', () => {
    const s = { t0: 1_700_000_000, unit: DAY, o: [0, 1, 2], v: [10, null, 12] };
    expect(decodeSeries(s).map((p) => p.v)).toEqual([10, 12]);
  });

  it('survives a missing or malformed series', () => {
    expect(decodeSeries(null)).toEqual([]);
    expect(decodeSeries({})).toEqual([]);
    expect(decodeSeries({ o: [0], v: null })).toEqual([]);
  });
});

describe('which baseline a range is measured against', () => {
  /* The load-bearing decision in this module. Intraday is measured
     against the previous close so the chart agrees with the day change
     the quote line prints; a longer window is measured against its own
     first point, because "up 12% over six months" means against six
     months ago and not against last night. */
  it('uses the previous close for the intraday range', () => {
    const history = {
      intraday: { t0: Math.floor(NOW / 1000) - 3600, unit: 300, o: [0, 1, 2], v: [100, 101, 102], prevClose: 90 },
    };
    const { baseline } = seriesFor(history, '1D', NOW);
    expect(baseline).toBe(90);
  });

  it('uses the first point in the window for a longer range', () => {
    const history = { daily: dailyFrom([50, 60, 70, 80], 3) };
    const { baseline, points } = seriesFor(history, '1M', NOW);
    expect(baseline).toBe(points[0].v);
    expect(baseline).toBe(50);
  });

  it('measures the same series differently at 1M and 1Y', () => {
    const closes = Array.from({ length: 300 }, (_, i) => 100 + i);
    const history = { daily: dailyFrom(closes, 299) };
    const m = seriesFor(history, '1M', NOW);
    const y = seriesFor(history, '1Y', NOW);
    expect(m.baseline).toBeGreaterThan(y.baseline);
    expect(windowChange(m.points, m.baseline).pct)
      .toBeLessThan(windowChange(y.points, y.baseline).pct);
  });
});

describe('windowing', () => {
  it('keeps only the points inside the range', () => {
    const closes = Array.from({ length: 200 }, (_, i) => 100 + i);
    const history = { daily: dailyFrom(closes, 199) };
    const m = seriesFor(history, '1M', NOW).points.length;
    const y = seriesFor(history, '1Y', NOW).points.length;
    expect(m).toBeLessThan(y);
    expect(m).toBeLessThanOrEqual(31);
  });

  it('falls back to the whole series rather than drawing nothing', () => {
    /* A window landing between sessions would otherwise come back with
       one point or none. */
    const history = { daily: dailyFrom([10, 11, 12], 300) };
    const { points, empty } = seriesFor(history, '1M', NOW);
    expect(points.length).toBe(3);
    expect(empty).toBe(false);
  });

  it('reports empty when there is genuinely nothing to draw', () => {
    expect(seriesFor({}, '1M', NOW).empty).toBe(true);
    expect(seriesFor({ daily: dailyFrom([10], 0) }, '1M', NOW).empty).toBe(true);
  });

  it('never slices the intraday series by days', () => {
    expect(rangeById('1D').days).toBeNull();
    expect(rangeById('1D').source).toBe('intraday');
  });
});

describe('change across the drawn window', () => {
  it('signs and sizes the move against the baseline', () => {
    const c = windowChange([{ t: 1, v: 110 }], 100);
    expect(c.dir).toBe('up');
    expect(c.pct).toBeCloseTo(10, 6);
    expect(c.abs).toBeCloseTo(10, 6);
  });

  it('refuses to divide by a zero or missing baseline', () => {
    expect(windowChange([{ t: 1, v: 10 }], 0)).toBeNull();
    expect(windowChange([{ t: 1, v: 10 }], null)).toBeNull();
    expect(windowChange([], 100)).toBeNull();
  });
});

describe('extent', () => {
  it('always contains the baseline, so the zero line is on screen', () => {
    const e = extent([{ t: 1, v: 100 }, { t: 2, v: 110 }], 50);
    expect(e.min).toBeLessThanOrEqual(50);
  });

  it('gives a flat series a band rather than zero height', () => {
    const e = extent([{ t: 1, v: 10 }, { t: 2, v: 10 }], 10);
    expect(e.max).toBeGreaterThan(e.min);
  });
});

describe('projection', () => {
  const pts = [{ t: 0, v: 0 }, { t: 100, v: 10 }];
  const p = project(pts, { width: 200, height: 50, min: 0, max: 10 });

  it('spans the full width and inverts y so up is up', () => {
    expect(p.xOf(0)).toBe(0);
    expect(p.xOf(100)).toBe(200);
    expect(p.yOf(10)).toBe(0);
    expect(p.yOf(0)).toBe(50);
  });

  it('emits a path that starts with a move', () => {
    expect(p.d.startsWith('M ')).toBe(true);
  });

  it('hit-tests to the nearest point, so the crosshair matches the line', () => {
    expect(p.at(0)).toEqual(pts[0]);
    expect(p.at(200)).toEqual(pts[1]);
    expect(p.at(199)).toEqual(pts[1]);
  });
});

describe('the real series the snapshot ships', () => {
  const history = snapshot.quoteHistory;

  it('ships history for the listed companies', () => {
    expect(Object.keys(history).length).toBeGreaterThan(50);
  });

  it('encodes every series with matching offset and value arrays', () => {
    for (const [id, ranges] of Object.entries(history)) {
      for (const [name, s] of Object.entries(ranges)) {
        expect(s.o.length, `${id}/${name}`).toBe(s.v.length);
        expect(Number.isFinite(s.t0), `${id}/${name}`).toBe(true);
        expect(s.unit, `${id}/${name}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps offsets ascending, so the line is drawn in time order', () => {
    for (const [id, ranges] of Object.entries(history)) {
      for (const [name, s] of Object.entries(ranges)) {
        for (let i = 1; i < s.o.length; i += 1) {
          expect(s.o[i] > s.o[i - 1], `${id}/${name} at ${i}`).toBe(true);
        }
      }
    }
  });

  it('draws a real company at every offered range', () => {
    const h = history.nvidia;
    expect(h).toBeTruthy();
    for (const r of RANGES) {
      if (!h[r.source]) continue;
      const { points } = seriesFor(h, r.id, NOW);
      expect(points.length, r.id).toBeGreaterThan(1);
    }
  });
});
