import { it, expect } from 'vitest';
import { prospectiveNews } from '../../../server/src/ai/prospective-news.js';
it('excludes pre-existing and backfilled stories from prospective latency', () => {
  const baseline = { startedAt: '2026-09-08T00:00:00Z', existingIds: ['old'] };
  const r = id => ({ id, source_feed: 'rss-news', created_at: '2026-09-08 01:00:00', status: 'pending', raw: { published: '2026-09-08T00:30:00Z' } });
  const backfill = { ...r('backfill'), raw: { published: '2026-09-07T00:00:00Z' } };
  const result = prospectiveNews([r('old'),r('new'),backfill],baseline,'2026-09-08T02:00:00Z');
  expect(result.newEligibleRecords).toBe(1);
  expect(result.backfilledRecords).toBe(1);
  expect(result.timeliness['rss-news'].ingestionLag.medianHours).toBe(.5);
  expect(result.classifierAccuracy).toBeNull();
});
