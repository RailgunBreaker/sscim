/* ====================================================================
   quoteSeries — decoding and slicing the price history behind the chart.

   The bundle ships each series compactly (see server/src/bundle.js):

     { t0, unit, o: [0, 1, 2, 5, ...], v: [178.88, ...] }

   Offsets in units of `unit` seconds, because trading days are not
   regular and a fixed stride would silently shift every point after the
   first long weekend.

   Pure, so the arithmetic the chart rests on — which baseline a range is
   measured against, where the zero line sits, what "no data" means — is
   testable without a DOM.
   ==================================================================== */

/* The ranges the chart offers. `intraday` is the last session; the rest
   are windows onto the daily series.

   1D is a different SERIES, not a different window, which is why it
   carries its own source: five-minute closes exist only for the last
   session, and slicing the daily series to one day would draw a chart
   with one point in it. */
export const RANGES = [
  { id: '1D', source: 'intraday', days: null, label: 'Today' },
  { id: '1M', source: 'daily', days: 30, label: '1 month' },
  { id: '3M', source: 'daily', days: 91, label: '3 months' },
  { id: '6M', source: 'daily', days: 182, label: '6 months' },
  { id: '1Y', source: 'daily', days: 365, label: '1 year' },
];

export const rangeById = (id) => RANGES.find((r) => r.id === id) || RANGES[1];

/* Decode one stored series into [{ t, v }] with t in epoch milliseconds. */
export function decodeSeries(series) {
  if (!series || !Array.isArray(series.o) || !Array.isArray(series.v)) return [];
  const { t0, unit, o, v } = series;
  const n = Math.min(o.length, v.length);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const value = v[i];
    if (value == null || !Number.isFinite(value)) continue;
    out.push({ t: (t0 + o[i] * unit) * 1000, v: value });
  }
  return out;
}

/* The points for one range, plus the baseline the change is measured
   against.

   WHICH BASELINE. For the intraday chart it is the previous close, so
   the chart agrees with the day-change the quote line prints. For a
   longer window it is the FIRST POINT IN THAT WINDOW, because "up 12%
   over six months" means against six months ago, not against last
   night. Using one baseline for both would make the 1Y chart disagree
   with its own percentage. */
export function seriesFor(history, rangeId, now = Date.now()) {
  const range = rangeById(rangeId);
  const raw = decodeSeries(history?.[range.source]);
  if (!raw.length) return { points: [], baseline: null, range, empty: true };

  let points = raw;
  if (range.days != null) {
    const cutoff = now - range.days * 86400 * 1000;
    const windowed = raw.filter((p) => p.t >= cutoff);
    /* A window that lands between trading sessions can come back empty
       or with a single point; falling back to the whole series beats
       drawing nothing, and the caller is told what it actually got. */
    points = windowed.length >= 2 ? windowed : raw;
  }

  const prevClose = history?.[range.source]?.prevClose;
  const baseline = range.source === 'intraday' && prevClose != null
    ? prevClose
    : points[0].v;

  return { points, baseline, range, empty: points.length < 2 };
}

/* The change across the drawn window, which is what the chart's own
   caption reports — deliberately not the quote's day change, because on
   a 1Y chart those are different numbers and showing the day change
   under a year of line would be answering a question nobody asked. */
export function windowChange(points, baseline) {
  if (!points?.length || baseline == null || !Number.isFinite(baseline) || baseline === 0) return null;
  const last = points[points.length - 1].v;
  const abs = last - baseline;
  return { abs, pct: (abs / baseline) * 100, dir: abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat', last, baseline };
}

/* Extent with a little headroom, so the line never touches the frame and
   a flat series still gets a sane band instead of a zero-height one. */
export function extent(points, baseline = null) {
  if (!points?.length) return null;
  let min = points[0].v;
  let max = points[0].v;
  for (const p of points) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  /* The baseline is included so the zero line is always on screen: a
     chart whose reference line sits outside the frame is drawing a
     change the reader cannot see. */
  if (baseline != null && Number.isFinite(baseline)) {
    min = Math.min(min, baseline);
    max = Math.max(max, baseline);
  }
  if (min === max) { min -= Math.abs(min) * 0.01 || 1; max += Math.abs(max) * 0.01 || 1; }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

/* Build the SVG path and the projection used to place the crosshair, so
   the hit-testing and the drawn line cannot disagree about where a point
   is. */
export function project(points, { width, height, min, max }) {
  if (!points?.length || max === min) return { d: '', at: () => null, xOf: () => 0, yOf: () => 0 };
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = t1 - t0 || 1;
  const xOf = (t) => ((t - t0) / span) * width;
  const yOf = (v) => height - ((v - min) / (max - min)) * height;

  let d = '';
  points.forEach((p, i) => { d += `${i === 0 ? 'M' : 'L'} ${xOf(p.t).toFixed(2)} ${yOf(p.v).toFixed(2)} `; });

  /* Nearest point to an x in pixels — a binary search would be faster
     and this is a few hundred points behind a mouse move. */
  const at = (x) => {
    let best = null;
    let bestD = Infinity;
    for (const p of points) {
      const dx = Math.abs(xOf(p.t) - x);
      if (dx < bestD) { bestD = dx; best = p; }
    }
    return best;
  };
  return { d: d.trim(), at, xOf, yOf };
}
