/* Syncs the code-defined facility list (src/facilities-data.js) into the live
   vault database. Safe to re-run: it upserts only the ids defined in code and
   never touches rows added by hand or through the admin API.

   It refuses to write anything if a record would dangle. A facility whose
   company or country id does not exist, or whose stage list names a stage the
   model does not have, is worse than a missing facility: it renders on the map,
   opens a popup, and contributes to a hazard footprint while pointing at
   nothing the engine can propagate through. Better to fail here than to ship a
   site that silently scores zero.

   Run from server/:  node scripts/sync-facilities.mjs
   Then re-export the snapshot:  cd ../app && npm run snapshot  */
import { db } from '../src/db.js';
import { FACILITIES, FACILITY_KINDS, FACILITY_STATUSES } from '../src/facilities-data.js';

const companyIds = new Set(db.prepare('SELECT id FROM companies').all().map((r) => r.id));
const countryIds = new Set(db.prepare('SELECT id FROM countries').all().map((r) => r.id));
const stageIds = new Set(db.prepare('SELECT id FROM stages').all().map((r) => r.id));

const problems = [];
const seen = new Set();
for (const f of FACILITIES) {
  const where = f.id || '(missing id)';
  if (!f.id) problems.push('a facility has no id');
  if (seen.has(f.id)) problems.push(`${where}: duplicate id`);
  seen.add(f.id);
  if (!companyIds.has(f.company)) problems.push(`${where}: unknown company "${f.company}"`);
  if (!countryIds.has(f.country)) problems.push(`${where}: unknown country "${f.country}"`);
  if (!FACILITY_KINDS.includes(f.kind)) problems.push(`${where}: unknown kind "${f.kind}"`);
  if (!FACILITY_STATUSES.includes(f.status)) problems.push(`${where}: unknown status "${f.status}"`);
  if (!Array.isArray(f.stages) || !f.stages.length) problems.push(`${where}: no stages`);
  (f.stages || []).forEach((s) => { if (!stageIds.has(s)) problems.push(`${where}: unknown stage "${s}"`); });
  if (!Number.isFinite(f.lat) || f.lat < -90 || f.lat > 90) problems.push(`${where}: lat out of range`);
  if (!Number.isFinite(f.lng) || f.lng < -180 || f.lng > 180) problems.push(`${where}: lng out of range`);
  if (!Number.isFinite(f.scale) || f.scale < 1 || f.scale > 5) problems.push(`${where}: scale must be 1-5`);
}

if (problems.length) {
  console.error(`Refusing to sync ${FACILITIES.length} facilities — ${problems.length} problem(s):`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}

const upsert = db.prepare(`INSERT INTO facilities (id, name, company_id, country, lat, lng, kind, stages_json, scale, output, node, wafer_size, status, since, source)
  VALUES (@id, @name, @company_id, @country, @lat, @lng, @kind, @stages_json, @scale, @output, @node, @wafer_size, @status, @since, @source)
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, company_id=excluded.company_id, country=excluded.country,
    lat=excluded.lat, lng=excluded.lng, kind=excluded.kind, stages_json=excluded.stages_json,
    scale=excluded.scale, output=excluded.output, node=excluded.node, wafer_size=excluded.wafer_size,
    status=excluded.status, since=excluded.since, source=excluded.source, updated_at=datetime('now')`);

db.transaction(() => {
  for (const f of FACILITIES) {
    upsert.run({
      id: f.id, name: f.name, company_id: f.company, country: f.country,
      lat: f.lat, lng: f.lng, kind: f.kind, stages_json: JSON.stringify(f.stages), scale: f.scale,
      output: f.output ?? null, node: f.node ?? null, wafer_size: f.waferSize ?? null,
      status: f.status, since: f.since ?? null, source: f.source ?? null,
    });
  }
})();

db.pragma('wal_checkpoint(TRUNCATE)');

const total = db.prepare('SELECT COUNT(*) c FROM facilities').get().c;
const byCountry = db.prepare('SELECT country, COUNT(*) c FROM facilities GROUP BY country ORDER BY c DESC').all();
const uncovered = db.prepare(`SELECT s.id FROM stages s WHERE NOT EXISTS (
  SELECT 1 FROM facilities f WHERE instr(f.stages_json, '"' || s.id || '"') > 0)`).all().map((r) => r.id);

console.log(`Synced ${FACILITIES.length} code-defined facilities; vault holds ${total}.`);
console.log(`Coverage: ${byCountry.length} countries — ${byCountry.map((r) => `${r.country}:${r.c}`).join(' ')}`);
if (uncovered.length) {
  console.log(`Stages with no modeled site (by design — demand-side and pure-IP stages have no plant): ${uncovered.join(', ')}`);
}
