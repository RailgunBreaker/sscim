import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { writeAtomicJson } from '../src/atomic-json.js';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { db } from '../src/db.js';
import { buildStructuredEvidence } from '../src/structured-evidence.js';
const root = new URL('../../', import.meta.url), inputs = [];
const tables = ['countries','stages','flow_edges','tier_labels','companies','customers','owners','policies','events','scenarios',
  'data_notes','quotes','meta','event_candidates','briefings','facilities','event_overrides','event_evidence','measurement_evidence','facility_evidence'];
const existing = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
db.transaction(() => { for (const table of tables) if (existing.has(table)) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all().map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (key.endsWith('_json') && typeof value === 'string') { try { return [key, JSON.parse(value)]; } catch { /* retain malformed original text visibly */ } }
    return [key, value];
  })));
  inputs.push({ id: `vault.${table}`, origin: `server/data/sscim.db#${table}`, data: rows });
} })();
for (const directory of ['docs/reference','docs/benchmarks','docs/prospective','docs/operational-monitor',
  'docs/computation-demo/validation','docs/computation-demo/real-data-example']) {
  const dir = new URL(`${directory}/`, root);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
    const origin = `${directory}/${name}`;
    inputs.push({ id: origin, origin, data: JSON.parse(readFileSync(new URL(origin, root))) });
  }
}
const catalog = buildStructuredEvidence(inputs), bytes = JSON.stringify(catalog);
const digest = createHash('sha256').update(bytes).digest('hex');
const output = new URL('artifacts/structured/', root); mkdirSync(output, { recursive: true });
const base = `sscim-evidence-${digest.slice(0, 12)}`;
const sqlite = new URL(`${base}.sqlite`, output);
if (!existsSync(sqlite)) {
  const out = new Database(fileURLToPath(sqlite));
  out.pragma('foreign_keys = ON');
  out.exec(`
    CREATE TABLE datasets(id TEXT PRIMARY KEY, origin TEXT NOT NULL, sha256 TEXT NOT NULL, record_count INTEGER NOT NULL);
    CREATE TABLE records(id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL REFERENCES datasets(id), pointer TEXT NOT NULL,
      original_id TEXT, epistemic_status TEXT NOT NULL, subject_id TEXT, incident_id TEXT, metric TEXT, period_start TEXT,
      period_end TEXT, available_at TEXT, value_number REAL, units TEXT, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)));
    CREATE TABLE fields(record_id TEXT NOT NULL REFERENCES records(id), pointer TEXT NOT NULL, value_type TEXT NOT NULL,
      value_number REAL, value_text TEXT, PRIMARY KEY(record_id,pointer));
    CREATE TABLE sources(id TEXT PRIMARY KEY, url TEXT NOT NULL);
    CREATE TABLE record_sources(record_id TEXT REFERENCES records(id), source_id TEXT REFERENCES sources(id), PRIMARY KEY(record_id,source_id));
    CREATE TABLE entities(id TEXT PRIMARY KEY, original_id TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)));
    CREATE TABLE relationships(id TEXT PRIMARY KEY REFERENCES records(id), from_id TEXT NOT NULL, to_id TEXT NOT NULL, type TEXT NOT NULL, epistemic_status TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)));
    CREATE INDEX record_targets ON records(subject_id,metric,period_start,period_end);
    CREATE INDEX record_incidents ON records(incident_id);
    CREATE INDEX field_paths ON fields(pointer,value_type);
  `);
  out.transaction(() => {
    const ds = out.prepare('INSERT INTO datasets VALUES (?,?,?,?)'); for (const d of catalog.datasets) ds.run(d.id,d.origin,d.sha256,d.recordCount);
    const rs = out.prepare('INSERT INTO records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const r of catalog.records) rs.run(r.id,r.datasetId,r.pointer,r.originalId,r.epistemicStatus,r.subjectId,r.incidentId,r.metric,r.periodStart,r.periodEnd,r.availableAt,r.value,r.units,JSON.stringify(r.payload));
    const fs = out.prepare('INSERT INTO fields VALUES (?,?,?,?,?)'); for (const f of catalog.fields) fs.run(f.recordId,f.pointer,f.type,f.number,f.text);
    const ss = out.prepare('INSERT INTO sources VALUES (?,?)'); for (const s of catalog.sources) ss.run(s.id,s.url);
    const links = out.prepare('INSERT INTO record_sources VALUES (?,?)'); for (const l of catalog.recordSources) links.run(l.recordId,l.sourceId);
    const es = out.prepare('INSERT INTO entities VALUES (?,?,?,?,?)'); for (const e of catalog.entities) es.run(e.id,e.originalId,e.type,e.name,JSON.stringify(e.payload));
    const edges = out.prepare('INSERT INTO relationships VALUES (?,?,?,?,?,?)'); for (const e of catalog.relationships) edges.run(e.id,e.fromId,e.toId,e.type,e.epistemicStatus,JSON.stringify(e.payload));
  })();
  if (out.pragma('integrity_check', { simple: true }) !== 'ok' || out.pragma('foreign_key_check').length) throw new Error('Export integrity failure');
  out.close();
}
writeFileSync(new URL(`${base}.json`, output), bytes + '\n');
const manifest = { schemaVersion: 1, exportedAt: new Date().toISOString(), catalogSha256: digest,
  sqlite: `${base}.sqlite`, json: `${base}.json`, ...catalog.counts,
  jsonFileSha256: createHash('sha256').update(readFileSync(new URL(`${base}.json`, output))).digest('hex'),
  sqliteFileSha256: createHash('sha256').update(readFileSync(sqlite)).digest('hex'),
  datasets: catalog.datasets.map(d => ({ id: d.id, records: d.recordCount, sha256: d.sha256 })) };
writeAtomicJson(new URL('manifest.json', output), manifest);
const retain = process.argv.find(arg => arg.startsWith('--retain='))?.slice(9);
if (retain != null) {
  const count = Number(retain);
  if (!Number.isInteger(count) || count < 2) throw new Error('Retain at least two catalog generations');
  const directory = fileURLToPath(output);
  const generations = readdirSync(directory).filter(name => /^sscim-evidence-[a-f0-9]{12}\.json$/.test(name))
    .map(name => ({ base: name.slice(0,-5), date: statSync(resolve(directory,name)).mtimeMs }))
    .filter(item => item.base !== base).sort((a,b) => b.date - a.date);
  for (const old of generations.slice(count - 1)) for (const extension of ['json','sqlite']) {
    const target = resolve(directory, `${old.base}.${extension}`);
    if (dirname(target) !== resolve(directory)) throw new Error('Retention path escaped artifact directory');
    if (existsSync(target) && statSync(target).isFile()) unlinkSync(target);
  }
}
console.log(JSON.stringify({ ...catalog.counts, sqlite: fileURLToPath(sqlite), digest }));
