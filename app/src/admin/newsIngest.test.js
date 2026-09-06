import { describe, expect, it, vi } from 'vitest';
import { dateWindow, newsFeeds, parseNewsFeed, fetchRssNewsCandidates } from '../../../server/src/ingest/rss-news.mjs';
import { fetchNewsCandidates } from '../../../server/src/ingest/webz-news.mjs';
import { storyKey, findDuplicate } from '../../../server/src/ingest/dedupe.js';

const window = { since: '2026-09-04', until: '2026-09-06' };
const feed = { id: 'test', language: 'ja', url: 'https://example.org/feed' };
const item = (title, date, url = 'https://example.org/story') => `<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate><description><![CDATA[<p>Source excerpt</p>]]></description></item>`;
const rss = (...items) => `<rss version="2.0"><channel>${items.join('')}</channel></rss>`;

describe('multilingual news ingestion', () => {
  it('uses inclusive dates and rejects invalid or reversed windows', () => {
    expect(dateWindow(window.since, window.until).end - dateWindow(window.since, window.until).start).toBe(3 * 86400000);
    expect(() => dateWindow('2026-02-30', '2026-03-01')).toThrow();
    expect(() => dateWindow('2026-09-07', '2026-09-06')).toThrow();
    expect(newsFeeds(window)).toHaveLength(4);
    expect(new URL(newsFeeds(window)[0].url).searchParams.get('q')).toContain('before:2026-09-07');
  });

  it('keeps original language and publisher links while excluding undated, old, and future stories', () => {
    const rows = parseNewsFeed(rss(
      item('半導体工場が生産を再開', '2026-09-06T23:59:59Z'),
      item('Old', '2026-09-03T23:59:59Z'),
      item('Future', '2026-09-07T00:00:00Z'),
      item('Undated', ''),
      item('Unsafe link', '2026-09-06', 'javascript:alert(1)'),
    ), feed, window);
    expect(rows).toHaveLength(1);
    expect(rows[0].raw).toMatchObject({ title: '半導体工場が生産を再開', language: 'ja', discoveryOnly: true, excerpt: 'Source excerpt', url: 'https://example.org/story' });
    expect(rows[0].sourceRef).toMatch(/^[a-f0-9]{32}$/);
  });

  it('supports Atom alternate links and rejects HTML error pages and entity declarations', () => {
    const atom = '<feed><entry><title>Chip factory</title><published>2026-09-05T00:00:00Z</published><link rel="self" href="https://example.org/api"/><link rel="alternate" href="https://example.org/article"/></entry></feed>';
    expect(parseNewsFeed(atom, feed, window)[0].raw.url).toBe('https://example.org/article');
    expect(() => parseNewsFeed('<html><body>Error</body></html>', feed, window)).toThrow();
    expect(() => parseNewsFeed('<!DOCTYPE rss><rss/>', feed, window)).toThrow();
  });

  it('reports individual feed failures, keeps successful results, and removes duplicate stories', async () => {
    const onFeedResult = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValue({ ok: true, text: async () => rss(item('Chip factory', '2026-09-05')) });
    const rows = await fetchRssNewsCandidates({ ...window, feeds: [feed, { ...feed, id: 'second' }, { ...feed, id: 'third' }], fetchImpl, onFeedResult });
    expect(rows).toHaveLength(1);
    expect(onFeedResult).toHaveBeenCalledWith(expect.objectContaining({ feed: 'test', status: 'failed' }));
    await expect(fetchRssNewsCandidates({ ...window, feeds: [feed], fetchImpl: async () => { throw new Error('offline'); } })).rejects.toThrow('All RSS');
  });

  it('does not collapse distinct Chinese or Japanese headlines to an empty ASCII key', () => {
    const a = '半導體工廠恢復生產', b = '半導體出口管制擴大';
    expect(storyKey(a)).not.toBe('');
    expect(storyKey(a)).not.toBe(storyKey(b));
    expect(findDuplicate({ dateISO: '2026-09-06', raw: { title: b } }, [{ id: 'a', date_iso: '2026-09-06', title: a, dedupe_key: storyKey(a) }])).toBeNull();
  });

  it('Webz rejects older, future, blank-title, and undated posts instead of inventing publication dates', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => JSON.stringify({ posts: [
      { uuid: 'good', title: 'Chip factory opens', published: '2026-09-05T12:00:00Z', url: 'https://example.org/good' },
      { uuid: 'old', title: 'Older', published: '2026-09-01' },
      { uuid: 'future', title: 'Future', published: '2026-09-07' },
      { uuid: 'undated', title: 'Undated' }, { uuid: 'empty', title: '', published: '2026-09-05' },
    ] }) })));
    try { expect(await fetchNewsCandidates({ ...window, token: 'test-token' })).toHaveLength(1); }
    finally { vi.unstubAllGlobals(); }
  });
});
