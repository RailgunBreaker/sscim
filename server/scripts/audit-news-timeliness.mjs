import { writeFileSync } from 'node:fs';
import { db } from '../src/db.js';
import { newsTimeliness } from '../src/ai/news-timeliness.js';
const rows = db.prepare('SELECT source_feed, status, raw_json, created_at FROM event_candidates').all()
  .map(row => ({ ...row, raw: JSON.parse(row.raw_json) }));
const report = newsTimeliness(rows, new Date().toISOString());
writeFileSync(new URL('../../docs/benchmarks/news-timeliness.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
