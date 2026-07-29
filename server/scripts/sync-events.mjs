/* Syncs every code-defined event into the live vault database
   (server/data/sscim.db) and re-derives each one's age from its
   authoritative `dateISO` against DATASET_AS_OF. Safe to re-run: it upserts
   only the ids defined in code and never touches other rows (e.g. events
   added through the admin API).

   Run it after editing server/src/history-events.js or server/src/
   seed-data.js EVENTS, and — importantly — after advancing DATASET_AS_OF,
   which re-ages the entire table and therefore recomputes every index and
   the whole multi-year index history.

   Run from server/:  node scripts/sync-events.mjs
   Then re-export the snapshot:  cd ../app && npm run snapshot  */
import { db } from '../src/db.js';
import { HISTORY_EVENTS, DATASET_AS_OF, daysAgoOf } from '../src/history-events.js';
import { EVENTS as SEED_EVENTS } from '../src/seed-data.js';

const ALL = [...SEED_EVENTS, ...HISTORY_EVENTS];

const missingDate = ALL.filter((e) => !e.dateISO);
if (missingDate.length) {
  console.error(`Refusing to sync: these events have no authoritative dateISO — ${missingDate.map((e) => e.id).join(', ')}`);
  process.exit(1);
}

const upsert = db.prepare(`INSERT INTO events (id, date, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, stages_json, countries_json, timeline_json)
  VALUES (@id, @date, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @stages_json, @countries_json, @timeline_json)
  ON CONFLICT(id) DO UPDATE SET
    date=excluded.date, days_ago=excluded.days_ago, sev=excluded.sev, type=excluded.type, conf=excluded.conf,
    title=excluded.title, summary=excluded.summary, first=excluded.first, second=excluded.second, watch=excluded.watch,
    detail=excluded.detail, source=excluded.source, stages_json=excluded.stages_json,
    countries_json=excluded.countries_json, timeline_json=excluded.timeline_json, updated_at=datetime('now')`);

db.transaction(() => {
  for (const e of ALL) {
    upsert.run({
      id: e.id, date: e.date, days_ago: daysAgoOf(e.dateISO), sev: e.sev, type: e.type, conf: e.conf,
      title: e.title, summary: e.summary ?? null, first: e.first ?? null, second: e.second ?? null, watch: e.watch ?? null,
      detail: e.detail ?? null, source: e.source ?? null,
      stages_json: JSON.stringify(e.stages ?? []), countries_json: JSON.stringify(e.countries ?? []),
      timeline_json: JSON.stringify(e.timeline ?? []),
    });
  }
})();

db.pragma('wal_checkpoint(TRUNCATE)');
const total = db.prepare('SELECT COUNT(*) c FROM events').get().c;
const newest = db.prepare('SELECT id, date, days_ago FROM events ORDER BY days_ago ASC LIMIT 1').get();
console.log(`Synced ${ALL.length} code-defined events (${SEED_EVENTS.length} sample + ${HISTORY_EVENTS.length} historical); vault holds ${total}.`);
console.log(`Ages re-derived against DATASET_AS_OF=${DATASET_AS_OF}. Newest: ${newest.id} (${newest.date}, ${newest.days_ago}d ago).`);
