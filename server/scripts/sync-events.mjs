/* Syncs every code-defined event into the live vault database
   (server/data/sscim.db) and re-derives each one's age from its
   authoritative `dateISO` against DATASET_AS_OF. Safe to re-run: it upserts
   only the ids defined in code and never touches other rows (e.g. events
   added through the admin API).

   Run it after editing server/src/history-events.js, server/src/
   decade-events.js or server/src/seed-data.js EVENTS, and — importantly —
   after advancing DATASET_AS_OF, which re-ages the entire table and
   therefore recomputes every index and the whole multi-year index history.

   Run from server/:  node scripts/sync-events.mjs
   Then re-export the snapshot:  cd ../app && npm run snapshot  */
import { db } from '../src/db.js';
import { HISTORY_EVENTS, daysAgoOf } from '../src/history-events.js';
import { DECADE_EVENTS } from '../src/decade-events.js';
import { EVENTS as SEED_EVENTS } from '../src/seed-data.js';
import { getSnapshotDate } from '../src/meta.js';
import { getEventAssumption, UNCLASSIFIED_ASSUMPTION } from '../../app/src/engine/event-assumptions.js';

// The snapshot date lives in the `meta` table (the pipeline advances it),
// falling back to the DATASET_AS_OF constant for a DB that predates it.
const DATASET_AS_OF = getSnapshotDate();

const ALL = [...SEED_EVENTS, ...HISTORY_EVENTS, ...DECADE_EVENTS];

const missingDate = ALL.filter((e) => !e.dateISO);
if (missingDate.length) {
  console.error(`Refusing to sync: these events have no authoritative dateISO — ${missingDate.map((e) => e.id).join(', ')}`);
  process.exit(1);
}

const duplicateIds = Object.entries(ALL.reduce((acc, e) => ({ ...acc, [e.id]: (acc[e.id] ?? 0) + 1 }), {}))
  .filter(([, n]) => n > 1).map(([id]) => id);
if (duplicateIds.length) {
  console.error(`Refusing to sync: duplicate event id(s) across the code-defined sets — ${duplicateIds.join(', ')}`);
  process.exit(1);
}

/* An id with no entry in event-assumptions.js is silently excluded from the
   scored index (getEventAssumption falls back to UNCLASSIFIED_ASSUMPTION with
   operational: false). That is the right default for an event that arrives
   through the review queue unclassified, but for a hand-curated code-defined
   event it is always a mistake — the record was written to be scored and would
   quietly not be. Catch it here rather than in a puzzling flat index later. */
const unclassified = ALL.filter((e) => getEventAssumption(e.id) === UNCLASSIFIED_ASSUMPTION);
if (unclassified.length) {
  console.error(`Refusing to sync: ${unclassified.length} code-defined event(s) have no entry in app/src/engine/event-assumptions.js,`);
  console.error('so they would be displayed but silently excluded from the scored index:');
  unclassified.forEach((e) => console.error(`  ${e.id}  ${e.title}`));
  process.exit(1);
}

const upsert = db.prepare(`INSERT INTO events (id, date, date_iso, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, stages_json, countries_json, timeline_json)
  VALUES (@id, @date, @date_iso, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @stages_json, @countries_json, @timeline_json)
  ON CONFLICT(id) DO UPDATE SET
    date=excluded.date, date_iso=excluded.date_iso, days_ago=excluded.days_ago, sev=excluded.sev, type=excluded.type, conf=excluded.conf,
    title=excluded.title, summary=excluded.summary, first=excluded.first, second=excluded.second, watch=excluded.watch,
    detail=excluded.detail, source=excluded.source, stages_json=excluded.stages_json,
    countries_json=excluded.countries_json, timeline_json=excluded.timeline_json, updated_at=datetime('now')`);

db.transaction(() => {
  for (const e of ALL) {
    upsert.run({
      id: e.id, date: e.date, date_iso: e.dateISO, days_ago: daysAgoOf(e.dateISO, DATASET_AS_OF), sev: e.sev, type: e.type, conf: e.conf,
      title: e.title, summary: e.summary ?? null, first: e.first ?? null, second: e.second ?? null, watch: e.watch ?? null,
      detail: e.detail ?? null, source: e.source ?? null,
      stages_json: JSON.stringify(e.stages ?? []), countries_json: JSON.stringify(e.countries ?? []),
      timeline_json: JSON.stringify(e.timeline ?? []),
    });
  }
})();

/* Re-age EVERY row that has an authoritative date, not just the code-defined
   ones above. Events added through the review queue or the admin API are
   otherwise stuck at the age they had on the day they were recorded, so
   advancing the snapshot date aged the curated history while the live feed
   stayed permanently fresh — and never decayed out of the index. */
const reaged = db.transaction(() => {
  const rows = db.prepare('SELECT id, date_iso, days_ago FROM events WHERE date_iso IS NOT NULL').all();
  const update = db.prepare("UPDATE events SET days_ago = ?, updated_at = datetime('now') WHERE id = ?");
  let changed = 0;
  for (const row of rows) {
    const age = daysAgoOf(row.date_iso, DATASET_AS_OF);
    if (age !== row.days_ago) { update.run(age, row.id); changed++; }
  }
  return changed;
})();

const undated = db.prepare('SELECT COUNT(*) c FROM events WHERE date_iso IS NULL').get().c;

db.pragma('wal_checkpoint(TRUNCATE)');
const total = db.prepare('SELECT COUNT(*) c FROM events').get().c;
const newest = db.prepare('SELECT id, date, days_ago FROM events ORDER BY days_ago ASC LIMIT 1').get();
console.log(`Synced ${ALL.length} code-defined events (${SEED_EVENTS.length} sample + ${HISTORY_EVENTS.length} historical + ${DECADE_EVENTS.length} decade backfill); vault holds ${total}.`);
console.log(`Ages re-derived against DATASET_AS_OF=${DATASET_AS_OF} for every dated row (${reaged} age${reaged === 1 ? '' : 's'} changed). Newest: ${newest.id} (${newest.date}, ${newest.days_ago}d ago).`);
if (undated) console.warn(`WARNING: ${undated} event(s) have no date_iso and cannot be re-aged — they will not decay as the snapshot date advances.`);
