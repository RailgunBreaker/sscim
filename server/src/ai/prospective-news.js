import { newsTimeliness } from './news-timeliness.js';
export function prospectiveNews(rows, baseline, asOf) {
  const start = Date.parse(baseline.startedAt), end = Date.parse(asOf);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) throw new Error('Invalid monitoring window');
  const existing = new Set(baseline.existingIds), fresh = [], backfill = [], unavailable = [];
  for (const r of rows) {
    if (existing.has(r.id) || !['rss-news','webz-news'].includes(r.source_feed)) continue;
    const createdAt = /^\d{4}-\d{2}-\d{2} /.test(r.created_at) ? r.created_at.replace(' ','T') + 'Z' : r.created_at;
    const created = Date.parse(createdAt);
    if (!Number.isFinite(created) || created < start || created > end) { unavailable.push(r.id); continue; }
    const publication = r.raw?.published;
    const published = typeof publication === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(publication) ? Date.parse(publication) : NaN;
    if (!Number.isFinite(published) || published > created) { unavailable.push(r.id); continue; }
    if (published < start) { backfill.push(r.id); continue; }
    fresh.push(r);
  }
  return { startedAt: baseline.startedAt, asOf, newEligibleRecords: fresh.length, backfilledRecords: backfill.length,
    invalidOrMissingTiming: unavailable.length, eligibleIds: fresh.map(r => r.id), backfillIds: backfill,
    invalidIds: unavailable, timeliness: newsTimeliness(fresh, asOf).feeds,
    classifierAccuracy: null, incidentRecall: null, operationallyValidated: false,
    limitation: 'Only reports published and inserted after monitoring began qualify. Backfills are counted separately. No independent disruption census or adjudicated classification labels are available.' };
}
