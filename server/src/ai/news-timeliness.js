const hours = 3600000;
const timestamp = value => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? Date.parse(value) : NaN;
const sqliteTime = value => timestamp(typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
const summary = values => {
  values.sort((a, b) => a - b);
  return { count: values.length, medianHours: values.length ? (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2 : null,
    p95Hours: values.length ? values[Math.ceil(values.length * .95) - 1] : null,
    maximumHours: values.length ? values.at(-1) : null };
};

// First queue insertion minus a feed-supplied publication timestamp. Neither
// date_iso nor an earthquake's origin time establishes publication time.
export function newsTimeliness(rows, asOf) {
  const now = timestamp(asOf);
  if (!Number.isFinite(now)) throw new Error('Explicit UTC/offset audit timestamp required');
  const feeds = new Map();
  for (const row of rows) {
    if (!['rss-news', 'webz-news'].includes(row.source_feed)) continue;
    const feed = feeds.get(row.source_feed) || { records: 0, missingPublication: 0, invalidTiming: 0, lags: [], pendingAges: [], latestInsertedAt: null };
    feeds.set(row.source_feed, feed); feed.records++;
    const created = sqliteTime(row.created_at);
    const published = timestamp(row.raw?.published);
    if (!Number.isFinite(created) || created > now) { feed.invalidTiming++; continue; }
    if (!feed.latestInsertedAt || created > Date.parse(feed.latestInsertedAt)) feed.latestInsertedAt = new Date(created).toISOString();
    if (row.status === 'pending') feed.pendingAges.push((now - created) / hours);
    if (!Number.isFinite(published)) { feed.missingPublication++; continue; }
    if (published > created) { feed.invalidTiming++; continue; }
    feed.lags.push((created - published) / hours);
  }
  return { asOf, measurement: 'source-publication-to-first-queue-insertion',
    feeds: Object.fromEntries([...feeds].map(([id, f]) => [id, { records: f.records, missingPublication: f.missingPublication,
      invalidTiming: f.invalidTiming, latestInsertedAt: f.latestInsertedAt, ingestionLag: summary(f.lags), pendingAge: summary(f.pendingAges) }])),
    limitation: 'Historical queue sample, potentially backfilled. Does not measure source coverage, incident detection recall, classifier latency, or a prospective service-level guarantee.' };
}
