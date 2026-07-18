/* Upserts server/src/history-events.js into the live vault database
   (server/data/sscim.db) without touching any other event — safe to re-run
   after editing the history dataset. Fresh databases get these events from
   the normal seed path (seed-logic.js) instead; this script exists so an
   ALREADY-populated vault (the committed source of truth, possibly carrying
   live admin-API edits) can pick up history-dataset changes in place.

   Run from server/:  node scripts/backfill-history.mjs
   Then re-export the static snapshot:  cd ../app && npm run snapshot  */
import { db } from '../src/db.js';
import { HISTORY_EVENTS, daysAgoOf } from '../src/history-events.js';

const upsert = db.prepare(`INSERT INTO events (id, date, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, stages_json, countries_json, timeline_json)
  VALUES (@id, @date, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @stages_json, @countries_json, @timeline_json)
  ON CONFLICT(id) DO UPDATE SET
    date=excluded.date, days_ago=excluded.days_ago, sev=excluded.sev, type=excluded.type, conf=excluded.conf,
    title=excluded.title, summary=excluded.summary, first=excluded.first, second=excluded.second, watch=excluded.watch,
    detail=excluded.detail, source=excluded.source, stages_json=excluded.stages_json,
    countries_json=excluded.countries_json, timeline_json=excluded.timeline_json, updated_at=datetime('now')`);

db.transaction(() => {
  for (const e of HISTORY_EVENTS) {
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
console.log(`Backfilled ${HISTORY_EVENTS.length} historical events — vault now holds ${total} events.`);
