import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

// Discovery feeds provide headlines for review, not verified impact claims.
export const NEWS_LOCALES = [
  { language: 'en', hl: 'en-US', gl: 'US', query: 'semiconductor (supply OR factory OR export OR production)' },
  { language: 'zh', hl: 'zh-CN', gl: 'CN', query: '半导体 (供应 OR 工厂 OR 出口 OR 生产)' },
  { language: 'tw', hl: 'zh-TW', gl: 'TW', query: '半導體 (供應 OR 工廠 OR 出口 OR 生產)' },
  { language: 'ja', hl: 'ja', gl: 'JP', query: '半導体 (供給 OR 工場 OR 輸出 OR 生産)' },
];

export function dateWindow(since, until) {
  const parse = (value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) {
      throw new Error('News window requires valid YYYY-MM-DD dates');
    }
    return time;
  };
  const start = parse(since), end = parse(until) + 86400000;
  if (start >= end) throw new Error('News window starts after its end');
  return { start, end };
}

export function newsFeeds({ since, until }) {
  const { end } = dateWindow(since, until);
  const before = new Date(end).toISOString().slice(0, 10);
  return NEWS_LOCALES.map((locale) => ({
    id: `google-news-${locale.language}`, language: locale.language,
    url: `https://news.google.com/rss/search?${new URLSearchParams({
      q: `${locale.query} after:${since} before:${before}`,
      hl: locale.hl, gl: locale.gl, ceid: `${locale.gl}:${locale.hl.split('-')[0]}`,
    })}`,
  }));
}

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true });
const array = (value) => value == null ? [] : Array.isArray(value) ? value : [value];
const text = (value) => String(typeof value === 'object' ? value?.['#text'] || '' : value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const webUrl = (value) => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};

export function parseNewsFeed(xml, feed, window) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('RSS document declarations are not supported');
  if (XMLValidator.validate(xml) !== true) throw new Error('Invalid RSS XML');
  const doc = parser.parse(xml);
  if (!doc.rss?.channel && !doc.feed) throw new Error('Response is not an RSS or Atom feed');
  const { start, end } = dateWindow(window.since, window.until);
  return array(doc.rss?.channel?.item || doc.feed?.entry).flatMap((item) => {
    const title = text(item.title);
    const published = text(item.pubDate || item.published || item.updated || item['dc:date']);
    const time = Date.parse(published);
    const link = array(item.link).find((l) => typeof l === 'string' || !l['@_rel'] || l['@_rel'] === 'alternate');
    const url = webUrl(typeof link === 'object' ? link['@_href'] : text(link));
    if (!title || !url || !Number.isFinite(time) || time < start || time >= end) return [];
    return [{
      sourceFeed: 'rss-news', sourceRef: createHash('sha256').update(url).digest('hex').slice(0, 32),
      dateISO: new Date(time).toISOString().slice(0, 10),
      raw: {
        title, excerpt: text(item.description || item.summary).slice(0, 1200),
        url, published: new Date(time).toISOString(), language: feed.language,
        site: text(item.source) || new URL(url).hostname,
        matchedQuery: feed.id, discoveryOnly: true,
      },
    }];
  });
}

export async function fetchRssNewsCandidates({ since, until, feeds = newsFeeds({ since, until }), fetchImpl = fetch, onFeedResult = () => {}, limitPerFeed = 20 } = {}) {
  dateWindow(since, until);
  const results = await Promise.all(feeds.map(async (feed) => {
    try {
      const res = await fetchImpl(feed.url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'sscim-pipeline/1.0', Accept: 'application/rss+xml, application/atom+xml, application/xml' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      if (xml.length > 2_000_000) throw new Error('RSS feed exceeds size limit');
      const records = parseNewsFeed(xml, feed, { since, until }).sort((a, b) => b.raw.published.localeCompare(a.raw.published)).slice(0, limitPerFeed);
      onFeedResult({ feed: feed.id, status: 'ok', count: records.length });
      return { ok: true, records };
    } catch (error) {
      onFeedResult({ feed: feed.id, status: 'failed', error: error.name === 'TimeoutError' ? 'Request timed out' : error.message });
      return { ok: false, records: [] };
    }
  }));
  if (!results.some((r) => r.ok)) throw new Error('All RSS news feeds failed');
  const seen = new Set();
  return results.flatMap((r) => r.records).filter((record) => {
    const key = `${record.raw.language}:${record.raw.title.normalize('NFKC').toLowerCase()}`;
    if (seen.has(record.sourceRef) || seen.has(key)) return false;
    seen.add(record.sourceRef); seen.add(key); return true;
  });
}
