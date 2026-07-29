#!/usr/bin/env node
/* Generates the day's baseline briefing and stores it in the vault.

   The dashboard has always been able to generate a briefing, but only for
   whatever snapshot the build happened to contain — so "what the model said
   on 3 July" was recoverable only by checking out an old commit and
   rebuilding. The pipeline runs daily; having it record the briefing it
   generated turns that into an archive a reader can page through.

   It runs the real thing, not a summary of it: the exported snapshot is
   rebuilt into the same `data`/`engine`/`model` objects the dashboard
   constructs, and the text comes from the same briefingText() the UI calls.
   An archived briefing and the live one therefore cannot drift.

   Baseline only, deliberately: a scenario is a hypothetical the reader is
   driving, not a fact about the day, and archiving one would imply the day's
   record included something that never happened.

   Run from server/:  node scripts/archive-briefing.mjs [--date=YYYY-MM-DD]
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { db } from '../src/db.js';
import { getSnapshotDate } from '../src/meta.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(here, '..', '..');
const appDir = path.join(repoDir, 'app');

const arg = (name) => process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const snapshotPath = path.join(appDir, 'src', 'data', 'vault-snapshot.json');
if (!fs.existsSync(snapshotPath)) {
  console.error('No vault-snapshot.json — run `npm run snapshot` in app/ first.');
  process.exit(1);
}

const load = (rel) => import(pathToFileURL(path.join(appDir, 'src', rel)).href);
const { buildVaultData } = await load('data/buildVaultData.js');
const { buildEngine } = await load('engine/index.js');
const { buildModel } = await load('engine/buildModel.js');
const { briefingText } = await load('components/briefingText.js');

const bundle = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const data = buildVaultData(bundle);
const engine = buildEngine({
  STAGES: data.STAGES, FLOW_EDGES: data.FLOW_EDGES, COMPANIES: data.COMPANIES,
  CUSTOMERS: data.CUSTOMERS, POLICIES: data.POLICIES, EVENTS: data.EVENTS, OWNERS: data.OWNERS,
  datasetAsOf: bundle.meta?.snapshotDate,
});
const model = buildModel({ data, engine, scenario: null });
const body = briefingText(model, null, data, engine);

const dateISO = arg('date') || bundle.meta?.snapshotDate || getSnapshotDate();

/* The archive list needs one line per entry that says what the day was about.
   The most-moved event is the honest choice: it is what the briefing itself
   leads with, rather than a separately-invented summary that could disagree
   with the body. */
const topEvent = [...data.EVENTS]
  .map((e) => ({ e, index: engine.toDisplayIndex(engine.operationalIndex(engine.eventField(e).field)) }))
  .sort((a, b) => Math.abs(b.index - 5) - Math.abs(a.index - 5))[0];

const headline = topEvent
  ? `${topEvent.e.title} — own-field index ${topEvent.index.toFixed(2)}`
  : 'No operational events in this snapshot.';

db.prepare(`INSERT INTO briefings (date_iso, chain_index, headline, event_count, body, model_version)
  VALUES (@date_iso, @chain_index, @headline, @event_count, @body, @model_version)
  ON CONFLICT(date_iso) DO UPDATE SET
    chain_index=excluded.chain_index, headline=excluded.headline, event_count=excluded.event_count,
    body=excluded.body, model_version=excluded.model_version, created_at=datetime('now')`)
  .run({
    date_iso: dateISO,
    chain_index: model.baselineChainIndex ?? null,
    headline,
    event_count: data.EVENTS.length,
    body,
    model_version: engine.MODEL_PRIORS?.modelVersion ?? null,
  });

db.pragma('wal_checkpoint(TRUNCATE)');

const total = db.prepare('SELECT COUNT(*) AS n FROM briefings').get().n;
console.log(`Archived briefing for ${dateISO} (chain index ${model.baselineChainIndex?.toFixed(2)}, ${data.EVENTS.length} events). ${total} briefing(s) on record.`);
