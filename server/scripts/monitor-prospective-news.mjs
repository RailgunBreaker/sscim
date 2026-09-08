import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { db } from '../src/db.js';
import { prospectiveNews } from '../src/ai/prospective-news.js';
import { writeAtomicJson } from '../src/atomic-json.js';
const root = new URL('../../', import.meta.url);
const rows = db.prepare('SELECT id,source_feed,status,raw_json,created_at FROM event_candidates').all()
  .map(r => ({ ...r, raw: JSON.parse(r.raw_json) }));
const now = new Date().toISOString(), path = new URL('docs/operational-monitor/news-baseline.json', root);
if (process.argv.includes('--start')) {
  mkdirSync(new URL('docs/operational-monitor/', root), { recursive: true });
  writeFileSync(path, JSON.stringify({ startedAt: now, existingIds: rows.map(r => r.id),
    measurement: 'Publication-to-insertion latency for new post-start source reports', independentTimestampAttestation: false }, null, 2) + '\n', { flag: 'wx' });
}
const report = prospectiveNews(rows, JSON.parse(readFileSync(path)), now);
writeAtomicJson(new URL('docs/benchmarks/prospective-news-performance.json', root), report);
console.log(JSON.stringify(report,null,2));
