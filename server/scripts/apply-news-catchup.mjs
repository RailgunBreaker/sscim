// One-time, reproducible news catch-up. No collection service or publishing.
import { readFileSync } from 'node:fs';
import { db } from '../src/db.js';
import { setSnapshotDate, setMeta } from '../src/meta.js';

const asOf = '2026-10-14';
const records = JSON.parse(readFileSync(new URL('../src/news-catchup-2026-10-14.json', import.meta.url), 'utf8'));
try {
  const insert = db.prepare(`INSERT INTO events
    (id, date, date_iso, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source,
     stages_json, countries_json, timeline_json, provenance, reviewed_by)
    VALUES (@id, @displayDate, @date, @age, 1, 'Industry News', 'High', @title, @summary,
      'No quantified disruption impact assigned.', 'No downstream impact quantified.',
      'Subsequent company disclosures on actual output and capacity.',
      @detail, @source, @stages, @countries, '[]', 'ai', 'Codex source review')
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, summary=excluded.summary,
      source=excluded.source, detail=excluded.detail, days_ago=excluded.days_ago,
      provenance=excluded.provenance, reviewed_by=excluded.reviewed_by`);
  db.transaction(() => {
    for (const r of records) {
      if (r.date <= '2026-09-04' || r.date > asOf) throw new Error(`Out-of-window news: ${r.id}`);
      for (const s of r.stages) if (!db.prepare('SELECT 1 FROM stages WHERE id=?').get(s)) throw new Error(`Unknown stage ${s}`);
      for (const c of r.countries) if (!db.prepare('SELECT 1 FROM countries WHERE id=?').get(c)) throw new Error(`Unknown country ${c}`);
      insert.run({ ...r, displayDate: new Date(`${r.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
        age: Math.round((Date.parse(asOf) - Date.parse(r.date)) / 86400000),
        stages: JSON.stringify(r.stages), countries: JSON.stringify(r.countries),
        source: `${r.source} - AI source review; not human-reviewed`,
        detail: `${r.summary}\n\nPrimary-source announcement reviewed on ${asOf}. Display-only news; no calibrated disruption effect. Historical model and data retained from 79289b1.`,
      });
    }
    setSnapshotDate(asOf);
    setMeta('news_checked_through', asOf);
    db.prepare('UPDATE events SET days_ago = CAST(julianday(?) - julianday(date_iso) AS INTEGER) WHERE date_iso IS NOT NULL').run(asOf);
  })();
  db.pragma('wal_checkpoint(TRUNCATE)');
  console.log(`Applied ${records.length} news records; snapshot ${asOf}.`);
} finally { db.close(); }
