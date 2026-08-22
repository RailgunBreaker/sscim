/* Upserts the code-defined country list (src/seed-data.js) into the live
   vault. Safe to re-run and never destructive: it inserts rows that are
   missing and refreshes name/position on the rest, and it deletes nothing —
   a country referenced by a stage share or a facility must not vanish because
   someone shortened a list.

   Exists because adding a host country (one with no stage share, present so
   its plants can be mapped) previously meant re-seeding the whole database.

   Run from server/:  node scripts/sync-countries.mjs  */
import { db } from '../src/db.js';
import { COUNTRY_NAMES, COUNTRY_POS } from '../src/seed-data.js';

const missingPos = Object.keys(COUNTRY_NAMES).filter((id) => !Array.isArray(COUNTRY_POS[id]) || COUNTRY_POS[id].length !== 2);
if (missingPos.length) {
  console.error(`Refusing to sync: no map position for ${missingPos.join(', ')}`);
  process.exit(1);
}

const upsert = db.prepare(`INSERT INTO countries (id, name, lat, lng) VALUES (@id, @name, @lat, @lng)
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, lat = excluded.lat, lng = excluded.lng`);

const before = db.prepare('SELECT COUNT(*) c FROM countries').get().c;
db.transaction(() => {
  for (const [id, name] of Object.entries(COUNTRY_NAMES)) {
    const [lat, lng] = COUNTRY_POS[id];
    upsert.run({ id, name, lat, lng });
  }
})();
db.pragma('wal_checkpoint(TRUNCATE)');

const after = db.prepare('SELECT COUNT(*) c FROM countries').get().c;

/* Report which countries are hosts rather than modeled participants, so the
   distinction stays visible to whoever runs this rather than living only in
   a comment. */
const hosts = db.prepare(`SELECT c.id FROM countries c WHERE NOT EXISTS (
  SELECT 1 FROM stages s WHERE json_extract(s.shares_json, '$.' || c.id) IS NOT NULL) ORDER BY c.id`).all().map((r) => r.id);

console.log(`Synced ${Object.keys(COUNTRY_NAMES).length} countries; vault holds ${after} (${after - before} added).`);
if (hosts.length) {
  console.log(`Host-only (no stage share, so they carry no score and only host facilities): ${hosts.join(', ')}`);
}
