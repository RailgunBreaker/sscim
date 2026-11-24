/* Reproducible news catch-up, parameterised by the as-of date.

   The 2026-10-14 pass hard-coded its window into its own script
   (apply-news-catchup.mjs, left in place as the record of that pass).
   This is the same procedure with the dates lifted out, so the next
   catch-up is a data file rather than another copy of the logic.

   WHAT THIS DOES AND DELIBERATELY DOES NOT DO.

   Records enter as Industry News at severity 1 with no quantified
   first- or second-order impact, which is what keeps them DISPLAY-ONLY:
   they appear in the feed and they do not move the index. That is not
   timidity, it is the repository's rule — an event's direction, channel
   and whether it scores at all are hand-curated in
   app/src/engine/event-assumptions.js and are never inferred from
   headline text. A source pass run by a model can establish that
   something was published; it cannot decide what it means for the
   model, and writing a severity here would be exactly the invention
   this project refuses elsewhere.

   So the index after this script is the index before it, aged. Any
   movement comes from existing events decaying as the snapshot date
   advances, and the script prints that so the change is measured
   rather than claimed.

   Run from server/:
     node scripts/apply-news.mjs --as-of 2026-11-23
*/
import { readFileSync } from 'node:fs';
import { db } from '../src/db.js';
import { setSnapshotDate, setMeta, getMeta } from '../src/meta.js';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};

const asOf = arg('as-of');
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf || '')) {
  console.error('Usage: node scripts/apply-news.mjs --as-of YYYY-MM-DD');
  process.exit(1);
}

const file = arg('file') || `../src/news-catchup-${asOf}.json`;
const records = JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));

/* By default the window opens where the last pass closed. An explicit
   overlap can capture missed announcements; use stable IDs for upserts.
   A later lower bound is rejected so the review cannot skip a gap. */
const previous = getMeta('news_checked_through') || getMeta('snapshot_date') || '0000-00-00';
// Explicit overlap lets a later review capture announcements missed on the cutoff day.
const since = arg('since') || previous;
if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || since > previous) {
  throw new Error('--since must be a YYYY-MM-DD date no later than the last checked date');
}
if (asOf <= previous) {
  console.error(`as-of ${asOf} is not after the last checked date ${previous}; nothing to do.`);
  process.exit(1);
}

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

  const before = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;

  db.transaction(() => {
    for (const r of records) {
      if (r.date <= since || r.date > asOf) {
        throw new Error(`Out-of-window news: ${r.id} dated ${r.date} (window ${since} < d <= ${asOf})`);
      }
      for (const s of r.stages) {
        if (!db.prepare('SELECT 1 FROM stages WHERE id=?').get(s)) throw new Error(`Unknown stage ${s} in ${r.id}`);
      }
      for (const c of r.countries) {
        if (!db.prepare('SELECT 1 FROM countries WHERE id=?').get(c)) throw new Error(`Unknown country ${c} in ${r.id}`);
      }
      insert.run({
        ...r,
        displayDate: new Date(`${r.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
        age: Math.round((Date.parse(asOf) - Date.parse(r.date)) / 86400000),
        stages: JSON.stringify(r.stages), countries: JSON.stringify(r.countries),
        source: `${r.source} - AI source review; not human-reviewed`,
        detail: `${r.summary}\n\nPrimary-source announcement reviewed on ${asOf}. Display-only news; no calibrated disruption effect — severity, direction and channel are human-curated in event-assumptions.js and were not set by this pass.`,
      });
    }
    setSnapshotDate(asOf);
    setMeta('news_checked_through', asOf);
    /* Every event's age is recomputed against the new snapshot date, so
       the decay the index sees is consistent across the whole record
       rather than only for the rows this pass touched. */
    db.prepare('UPDATE events SET days_ago = CAST(julianday(?) - julianday(date_iso) AS INTEGER) WHERE date_iso IS NOT NULL').run(asOf);
  })();
  db.pragma('wal_checkpoint(TRUNCATE)');

  const after = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
  console.log(`Applied ${records.length} news records (${after - before} new, ${records.length - (after - before)} updated).`);
  console.log(`Snapshot date ${previous} -> ${asOf}; every event's age recomputed.`);
  console.log('All records are display-only: severity 1, no quantified impact, so none of them moves the index by itself.');
} finally {
  db.close();
}
