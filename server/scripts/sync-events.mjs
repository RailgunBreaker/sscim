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
import { syncEventEvidence } from '../src/event-evidence.js';
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

/* Administrative overrides (event_overrides, written by the admin events
   screen) outrank the code definition here.

   Without this step the screen would be a lie. Every id below is upserted on
   every run, so an admin who deleted a duplicate earthquake record would see
   it reappear the next morning, and an edited severity would revert to the
   number in the source file — silently, with the index moving back and
   nothing reporting why. A tombstoned id is skipped entirely; a patched one
   is re-patched after the upsert has overwritten it. */
const OVERRIDES = new Map(db.prepare('SELECT event_id, deleted, patch_json FROM event_overrides').all()
  .map((o) => [o.event_id, { deleted: Boolean(o.deleted), patch: o.patch_json ? JSON.parse(o.patch_json) : null }]));

const PATCH_COLUMN = {
  title: 'title', summary: 'summary', sev: 'sev', type: 'type', conf: 'conf',
  first: 'first', second: 'second', watch: 'watch', detail: 'detail', source: 'source',
  dateISO: 'date_iso', stages: 'stages_json', countries: 'countries_json',
};

const tombstoned = ALL.filter((e) => OVERRIDES.get(e.id)?.deleted);
const patched = ALL.filter((e) => OVERRIDES.get(e.id)?.patch);
const SYNCABLE = ALL.filter((e) => !OVERRIDES.get(e.id)?.deleted);

const upsert = db.prepare(`INSERT INTO events (id, date, date_iso, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, stages_json, countries_json, timeline_json)
  VALUES (@id, @date, @date_iso, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @stages_json, @countries_json, @timeline_json)
  ON CONFLICT(id) DO UPDATE SET
    date=excluded.date, date_iso=excluded.date_iso, days_ago=excluded.days_ago, sev=excluded.sev, type=excluded.type, conf=excluded.conf,
    title=excluded.title, summary=excluded.summary, first=excluded.first, second=excluded.second, watch=excluded.watch,
    detail=excluded.detail, source=excluded.source, stages_json=excluded.stages_json,
    countries_json=excluded.countries_json, timeline_json=excluded.timeline_json, updated_at=datetime('now')`);

db.transaction(() => {
  for (const e of SYNCABLE) {
    upsert.run({
      id: e.id, date: e.date, date_iso: e.dateISO, days_ago: daysAgoOf(e.dateISO, DATASET_AS_OF), sev: e.sev, type: e.type, conf: e.conf,
      title: e.title, summary: e.summary ?? null, first: e.first ?? null, second: e.second ?? null, watch: e.watch ?? null,
      detail: e.detail ?? null, source: e.source ?? null,
      stages_json: JSON.stringify(e.stages ?? []), countries_json: JSON.stringify(e.countries ?? []),
      timeline_json: JSON.stringify(e.timeline ?? []),
    });
  }
})();

/* Re-apply administrative edits the upsert above just overwrote. Only the
   columns a human actually changed are written back, so an edited severity
   survives while every other field still tracks the source file. */
const repatched = db.transaction(() => {
  let changed = 0;
  for (const e of patched) {
    const { patch } = OVERRIDES.get(e.id);
    const sets = [];
    const values = [];
    for (const [key, value] of Object.entries(patch)) {
      const column = PATCH_COLUMN[key];
      if (!column) continue;
      sets.push(`${column} = ?`);
      values.push(key === 'stages' || key === 'countries' ? JSON.stringify(value) : value);
    }
    if (!sets.length) continue;
    if (patch.dateISO) { sets.push('days_ago = ?'); values.push(daysAgoOf(patch.dateISO, DATASET_AS_OF)); }
    db.prepare(`UPDATE events SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values, e.id);
    changed++;
  }
  return changed;
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

syncEventEvidence();
db.pragma('wal_checkpoint(TRUNCATE)');
const total = db.prepare('SELECT COUNT(*) c FROM events').get().c;
const newest = db.prepare('SELECT id, date, days_ago FROM events ORDER BY days_ago ASC LIMIT 1').get();
console.log(`Synced ${SYNCABLE.length} code-defined events (${SEED_EVENTS.length} sample + ${HISTORY_EVENTS.length} historical + ${DECADE_EVENTS.length} decade backfill); vault holds ${total}.`);
if (tombstoned.length) console.log(`  ${tombstoned.length} code-defined event(s) held back by an admin deletion: ${tombstoned.map((e) => e.id).join(', ')}`);
if (repatched) console.log(`  ${repatched} event(s) re-patched from admin edits after the upsert.`);
console.log(`Ages re-derived against DATASET_AS_OF=${DATASET_AS_OF} for every dated row (${reaged} age${reaged === 1 ? '' : 's'} changed). Newest: ${newest.id} (${newest.date}, ${newest.days_ago}d ago).`);
if (undated) console.warn(`WARNING: ${undated} event(s) have no date_iso and cannot be re-aged — they will not decay as the snapshot date advances.`);
