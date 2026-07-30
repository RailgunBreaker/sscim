/* ====================================================================
   timeseries.js — time-series analysis of the computed chain index.

   The engine (index.js) answers "what is the index on date t". This module
   answers the questions that need the whole series at once: when was it
   elevated, for how long, which events moved it, and by how much.

   Two properties are load-bearing:

   1. It never re-derives the index. Every number here comes from the
      engine's own chainIndexAt / indexOf, so a figure in this analysis and
      the same figure on the history chart cannot disagree.

   2. Attribution is MARGINAL, not standalone. An event's effect is the
      index on its own date with that event present, minus the same date
      with only that event removed. Because propagation combines through a
      saturating noisy-OR (math.js combineSigned), standalone magnitudes do
      not add up — two severity-7 events on the same stages do not move the
      index twice as far as one. Marginal attribution is the honest answer
      to "what did this event contribute to the number we published", and
      it is deliberately smaller than the standalone figure whenever other
      events overlap. Both are reported so the gap is visible.

   Everything here is pure: no I/O, no React, no dates beyond arithmetic on
   day offsets. `asOfMs` is only used to label points.
   ==================================================================== */

const DAY = 86400000;
export const NEUTRAL_INDEX = 5;

/* ---------------- the series itself ---------------- */

/* Daily replay of the index from `spanDays` before the snapshot up to it.
   `step` > 1 subsamples for very long spans; the default of 1 is exact.
   Cost is linear in the number of samples (~0.1ms each) and the caller is
   expected to memoize — see components/DecadeHistory.jsx. */
export function buildIndexSeries(engine, { spanDays, step = 1, asOfMs } = {}) {
  const span = Math.max(0, Math.round(spanDays ?? engine.longSpanDays ?? 0));
  const points = [];
  for (let daysAgo = span; daysAgo >= 0; daysAgo -= step) {
    points.push({
      daysAgo,
      index: engine.chainIndexAt(daysAgo),
      ...(asOfMs ? { dateMs: asOfMs - daysAgo * DAY } : {}),
    });
  }
  // Always include the snapshot date itself, even when step does not divide span.
  if (points[points.length - 1]?.daysAgo !== 0) {
    points.push({ daysAgo: 0, index: engine.chainIndexAt(0), ...(asOfMs ? { dateMs: asOfMs } : {}) });
  }
  return points;
}

/* ---------------- descriptive statistics ---------------- */

export function seriesStats(points, { neutral = NEUTRAL_INDEX, flatTolerance = 0.005 } = {}) {
  if (!points?.length) return null;
  const values = points.map((p) => p.index);
  const n = values.length;
  const mean = values.reduce((a, v) => a + v, 0) / n;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(n - 1, Math.max(0, Math.round(q * (n - 1))))];
  const maxPoint = points.reduce((b, p) => (p.index > b.index ? p : b), points[0]);
  const minPoint = points.reduce((b, p) => (p.index < b.index ? p : b), points[0]);
  return {
    samples: n,
    mean,
    sd: Math.sqrt(variance),
    median: at(0.5),
    p90: at(0.9),
    max: maxPoint.index,
    maxAt: maxPoint,
    min: minPoint.index,
    minAt: minPoint,
    daysAbove6: values.filter((v) => v > 6).length,
    daysAbove7: values.filter((v) => v > 7).length,
    daysBelowNeutral: values.filter((v) => v < neutral - flatTolerance).length,
    daysFlat: values.filter((v) => Math.abs(v - neutral) <= flatTolerance).length,
  };
}

/* Local maxima, thinned so one shock reports as one peak rather than a
   cluster of adjacent samples. `minSeparationDays` is applied greedily from
   the highest peak down, which keeps the tallest member of each cluster. */
export function findPeaks(points, { minSeparationDays = 30, minIndex = NEUTRAL_INDEX } = {}) {
  const local = [];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (p.index > points[i - 1].index && p.index >= points[i + 1].index && p.index > minIndex) local.push(p);
  }
  local.sort((a, b) => b.index - a.index);
  const kept = [];
  for (const p of local) {
    if (!kept.some((q) => Math.abs(q.daysAgo - p.daysAgo) < minSeparationDays)) kept.push(p);
  }
  return kept;
}

/* Contiguous stretches above a threshold — "how long was the chain under
   elevated modelled stress", which a peak list alone does not answer. */
export function runsAbove(points, threshold) {
  const runs = [];
  let current = null;
  // points run oldest -> newest; a run is described from its start date.
  for (const p of points) {
    if (p.index > threshold) {
      current ||= { fromDaysAgo: p.daysAgo, toDaysAgo: p.daysAgo, peak: p.index, samples: 0 };
      current.toDaysAgo = p.daysAgo;
      current.peak = Math.max(current.peak, p.index);
      current.samples++;
    } else if (current) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);
  return runs.sort((a, b) => b.samples - a.samples);
}

/* Simple centred rolling mean, for showing the trend under the spikes.
   Edges use the available window rather than being dropped, so the returned
   array is always the same length as the input. */
export function rollingMean(points, window = 91) {
  const half = Math.max(1, Math.floor(window / 2));
  return points.map((p, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(points.length - 1, i + half);
    let sum = 0;
    for (let k = lo; k <= hi; k++) sum += points[k].index;
    return { daysAgo: p.daysAgo, dateMs: p.dateMs, index: sum / (hi - lo + 1) };
  });
}

/* ---------------- per-event attribution ---------------- */

/* For each event: the index on its own date, its marginal contribution
   there, and its standalone effect in isolation. Only events the engine
   actually scores (assumption.operational) can have a non-zero marginal
   effect, but every event is reported so the excluded ones are visible as
   explicit zeros rather than absences. */
export function eventImpacts(engine, getAssumption, { events = engine.EVENTS } = {}) {
  const scored = events.filter((e) => getAssumption(e.id).operational);
  return events.map((e) => {
    const assumption = getAssumption(e.id);
    const t = e.daysAgo ?? 0;
    const indexOnDate = engine.chainIndexAt(t);
    if (!assumption.operational) {
      return {
        id: e.id, title: e.title, daysAgo: t, sev: e.sev, type: e.type, conf: e.conf,
        stages: e.stages || [], direction: assumption.direction, channel: assumption.channel,
        operational: false, indexOnDate, marginal: 0, standalone: 0, reason: assumption.reason,
      };
    }
    const without = engine.indexOf(scored.filter((x) => x.id !== e.id), t);
    const alone = engine.indexOf([e], t);
    return {
      id: e.id, title: e.title, daysAgo: t, sev: e.sev, type: e.type, conf: e.conf,
      stages: e.stages || [], direction: assumption.direction, channel: assumption.channel,
      operational: true, indexOnDate,
      marginal: indexOnDate - without,
      standalone: alone - NEUTRAL_INDEX,
      reason: assumption.reason,
    };
  }).sort((a, b) => a.daysAgo - b.daysAgo);
}

/* Cumulative marginal effect grouped by event type — answers "which class
   of shock has actually driven this index", which the per-event list makes
   you add up by eye. */
export function impactsByType(impacts) {
  const acc = new Map();
  impacts.filter((i) => i.operational).forEach((i) => {
    const row = acc.get(i.type) || { type: i.type, count: 0, total: 0, max: 0 };
    row.count++;
    row.total += i.marginal;
    row.max = Math.max(row.max, i.marginal);
    acc.set(i.type, row);
  });
  return [...acc.values()].map((r) => ({ ...r, mean: r.total / r.count })).sort((a, b) => b.total - a.total);
}

/* Per-calendar-year summary. Needs asOfMs to place day offsets in years. */
export function summarizeByYear(points, impacts, asOfMs) {
  const yearOf = (daysAgo) => new Date(asOfMs - daysAgo * DAY).getUTCFullYear();
  const buckets = new Map();
  points.forEach((p) => {
    const y = yearOf(p.daysAgo);
    const b = buckets.get(y) || { year: y, values: [], events: 0, scored: 0 };
    b.values.push(p.index);
    buckets.set(y, b);
  });
  (impacts || []).forEach((i) => {
    const b = buckets.get(yearOf(i.daysAgo));
    if (!b) return;
    b.events++;
    if (i.operational) b.scored++;
  });
  return [...buckets.values()].map((b) => {
    const mean = b.values.reduce((a, v) => a + v, 0) / b.values.length;
    return {
      year: b.year, samples: b.values.length, events: b.events, scored: b.scored,
      mean, max: Math.max(...b.values), min: Math.min(...b.values),
      daysAbove6: b.values.filter((v) => v > 6).length,
      daysFlat: b.values.filter((v) => Math.abs(v - NEUTRAL_INDEX) <= 0.005).length,
    };
  }).sort((a, b) => a.year - b.year);
}

/* Rolling count and severity mass of scored events in the trailing window.
   This is a curation-density diagnostic, not a model input: if it tracks the
   index closely, periods that were ingested more thoroughly look worse than
   periods that were not, and that is a property of the dataset rather than
   of the supply chain. Reported so the reader can see it. */
export function eventDensity(points, impacts, { window = 30 } = {}) {
  const scored = impacts.filter((i) => i.operational);
  return points.map((p) => {
    /* Trailing window in day-offset space: larger daysAgo is further in the
       past, so the `window` days preceding point p are the offsets
       [p.daysAgo, p.daysAgo + window). The point's own date is included. */
    const inWindow = scored.filter((i) => i.daysAgo >= p.daysAgo && i.daysAgo < p.daysAgo + window);
    return {
      daysAgo: p.daysAgo, dateMs: p.dateMs, index: p.index,
      count: inWindow.length,
      severityMass: inWindow.reduce((a, i) => a + (i.sev ?? 0), 0),
    };
  });
}

/* Pearson correlation between two equal-length numeric arrays. Returns null
   when either is constant (undefined correlation) rather than NaN. */
export function correlation(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.slice(0, n).reduce((a, v) => a + v, 0) / n;
  const my = ys.slice(0, n).reduce((a, v) => a + v, 0) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    cov += dx * dy; vx += dx * dx; vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

/* ---------------- the whole analysis in one call ---------------- */

export function analyzeIndexHistory(engine, getAssumption, { spanDays, step = 1, asOfMs, events } = {}) {
  const points = buildIndexSeries(engine, { spanDays, step, asOfMs });
  const impacts = eventImpacts(engine, getAssumption, { events });
  const density = eventDensity(points, impacts);
  return {
    points,
    stats: seriesStats(points),
    peaks: findPeaks(points),
    elevatedRuns: runsAbove(points, 6),
    trend: rollingMean(points),
    impacts,
    byType: impactsByType(impacts),
    byYear: asOfMs ? summarizeByYear(points, impacts, asOfMs) : [],
    densityCorrelation: correlation(density.map((d) => d.severityMass), density.map((d) => d.index)),
    spanDays: points.length ? points[0].daysAgo : 0,
  };
}
