import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.SSCIM_DB_PATH || path.join(DATA_DIR, 'sscim.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* CLOSE THE DATABASE ON EXIT — AND WHY THAT IS NOT THE WHOLE STORY.

   No consumer of this module ever closed the vault, so closing it here is
   correct hygiene: it checkpoints the WAL and drops the -wal/-shm sidecars,
   leaving the committed .db file complete.

   It does NOT prevent the teardown abort that took down `npm run snapshot`
   on CI:

     Assertion failed: (env) != nullptr   at ../src/api/hooks.cc:142
     Statement::~Statement() [better_sqlite3.node]
     Aborted (core dumped)                exit code 134

   better-sqlite3's Statement is a node::ObjectWrap, and close() only runs
   CloseHandles() — it finalizes the sqlite3_stmt handles and leaves the JS
   wrapper objects on the heap. Their C++ destructors therefore still run when
   V8 disposes the heap at teardown, by which point the Environment is gone
   and the cleanup-hook removal in that path asserts. Closing the database
   cannot reach those objects, which is why adding this hook alone did not fix
   the crash.

   What does fix it: an entry-point script that finishes its work must end with
   an explicit `process.exit(0)`, which runs these 'exit' listeners and then
   terminates via reallyExit, skipping the graceful teardown entirely so those
   destructors never run. Write the last line with fs.writeSync(1, ...) first —
   stdout on a pipe is asynchronous, and that is why CI showed a bare abort
   with none of the script's output. See app/scripts/build-vault-snapshot.mjs. */
process.once('exit', () => { try { if (db.open) db.close(); } catch { /* already closed */ } });

/* Core entity tables use a *_json column for naturally nested per-entity
   attributes (a stage's country-share map, a company's stage-stake map,
   an event's stage/country/timeline arrays) — idiomatic for this shape of
   data (equivalent to a Postgres JSONB column). True many-to-many edges
   (customers, owners) are real relational tables so they can be queried,
   updated, and joined independently. */
db.exec(`
CREATE TABLE IF NOT EXISTS countries (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat  REAL NOT NULL,
  lng  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS stages (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  x           REAL NOT NULL,
  y           REAL NOT NULL,
  value       REAL NOT NULL,
  subst       REAL NOT NULL,
  market      REAL NOT NULL,
  shares_json TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS flow_edges (
  from_stage TEXT NOT NULL REFERENCES stages(id),
  to_stage   TEXT NOT NULL REFERENCES stages(id),
  PRIMARY KEY (from_stage, to_stage)
);

CREATE TABLE IF NOT EXISTS tier_labels (
  label TEXT NOT NULL,
  x     REAL NOT NULL,
  seq   INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE IF NOT EXISTS companies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  country     TEXT REFERENCES countries(id),
  domain      TEXT,
  stakes_json TEXT NOT NULL DEFAULT '{}',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  supplier_id TEXT NOT NULL REFERENCES companies(id),
  customer_id TEXT NOT NULL REFERENCES companies(id),
  share       REAL NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (supplier_id, customer_id)
);

CREATE TABLE IF NOT EXISTS owners (
  company_id TEXT NOT NULL REFERENCES companies(id),
  owner_name TEXT NOT NULL,
  share      REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (company_id, owner_name)
);

-- Physical sites: the geography under the country markers. A country marker
-- cannot answer the question an earthquake asks, because a quake happens at a
-- point — so a hazard radius has to resolve to named plants, what they make,
-- and the stages they feed. "scale" (1-5) is an analyst ordinal, NOT capacity;
-- see src/facilities-data.js for exactly what is sourced and what is judged.
CREATE TABLE IF NOT EXISTS facilities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  company_id  TEXT REFERENCES companies(id),
  country     TEXT REFERENCES countries(id),
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  kind        TEXT NOT NULL,                  -- fab | assembly | materials | equipment | rnd
  stages_json TEXT NOT NULL DEFAULT '[]',     -- model stages this site feeds
  scale       REAL NOT NULL,                  -- 1-5 relative significance (judgement, not capacity)
  output      TEXT,                           -- what it makes, in plain language (display only)
  node        TEXT,
  wafer_size  TEXT,
  status      TEXT NOT NULL DEFAULT 'operating', -- operating | ramping | construction | idle
  since       INTEGER,
  source      TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_facilities_country ON facilities (country);

CREATE TABLE IF NOT EXISTS policies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sev         REAL NOT NULL,
  stages_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS events (
  id             TEXT PRIMARY KEY,
  date           TEXT, days_ago INTEGER, sev REAL, type TEXT, conf TEXT,
  title          TEXT, summary TEXT, first TEXT, second TEXT, watch TEXT,
  detail         TEXT, source TEXT,
  stages_json    TEXT NOT NULL DEFAULT '[]',
  countries_json TEXT NOT NULL DEFAULT '[]',
  timeline_json  TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scenarios (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  desc       TEXT,
  event_json TEXT
);

-- Append-only claim reviews. Original data remain recoverable independently
-- of corrected public prose and the administrative classification workflow.
CREATE TABLE IF NOT EXISTS event_evidence (
  event_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  original_record_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, revision)
);

CREATE TABLE IF NOT EXISTS data_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  scope      TEXT NOT NULL,   -- e.g. "company:tsmc", "stage:litho"
  tier       TEXT NOT NULL,   -- A / B / C / D per README §8
  note       TEXT NOT NULL,
  source     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Key/value metadata written by the pipeline. The snapshot_date key is the
-- authoritative dataset-as-of date every event age derives from — the pipeline
-- advances it on each run so the frozen-snapshot date stops being a constant
-- two files have to agree on. last_run_at / last_run_status let the UI show
-- how fresh the deployed data actually is.
CREATE TABLE IF NOT EXISTS meta (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Review queue for pipeline-ingested events. Nothing here reaches the model
-- until a human approves it: the AI step may DRAFT prose and PROPOSE a
-- classification, but severity/direction/operational only become real when
-- promoted into the events table via scripts/review.mjs. This is what keeps the
-- "hand-curated, never inferred" property in README 4.8 true.
CREATE TABLE IF NOT EXISTS event_candidates (
  id            TEXT PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  source_feed   TEXT NOT NULL,                    -- usgs | federal-register | manual
  source_ref    TEXT,                             -- upstream id/URL, for dedupe
  date_iso      TEXT NOT NULL,
  raw_json      TEXT NOT NULL,                    -- verbatim upstream record
  proposed_json TEXT,                             -- AI-drafted event fields (null if AI step skipped)
  ai_model      TEXT,                             -- which model drafted it, or null
  ai_notes      TEXT,                             -- model's own uncertainty/reasoning summary
  reviewed_by   TEXT,
  reviewed_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_candidates_source
  ON event_candidates (source_feed, source_ref);

CREATE INDEX IF NOT EXISTS idx_event_candidates_dedupe
  ON event_candidates (date_iso);

-- Administrative overrides on the event table.
--
-- WHY THIS EXISTS. Most events in the vault are code-defined: they live in
-- history-events.js, decade-events.js or seed-data.js, and scripts/
-- sync-events.mjs upserts every one of them on every pipeline run. So an
-- admin who deleted a bad event straight out of the events table would watch
-- it come back the next morning, and an edited severity would silently revert
-- value in the source file. Nothing would report the loss.
--
-- This table is the record of what a human decided about an event, kept
-- separately from where the event was defined. sync-events.mjs consults it:
-- a tombstoned id is never re-inserted, and a patched one is re-patched after
-- the upsert. The source files stay the definition; this stays the decision.
--
-- Deleting a row here restores the event to whatever the code says (or, for
-- an event that only ever existed in the vault, to gone).
CREATE TABLE IF NOT EXISTS event_overrides (
  event_id   TEXT PRIMARY KEY,
  deleted    INTEGER NOT NULL DEFAULT 0,   -- 1 = tombstoned, never re-synced
  patch_json TEXT,                         -- edited columns only, null when none
  reason     TEXT,                         -- why a human did this
  actor      TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Market quotes (price + P/E), refreshed by scripts/fetch-quotes.mjs from
-- the curated ticker map (src/tickers.js). Display metadata only — never an
-- input to the risk engine. Companies without a public listing have no row.
CREATE TABLE IF NOT EXISTS quotes (
  company_id  TEXT PRIMARY KEY REFERENCES companies(id),
  ticker      TEXT NOT NULL,
  price       REAL,
  currency    TEXT,
  change_pct  REAL,            -- regular-market day change, percent
  trailing_pe REAL,            -- null when N/A (e.g. loss-making)
  forward_pe  REAL,
  market_cap  REAL,
  as_of       TEXT NOT NULL    -- ISO timestamp of the fetch
);

-- Daily briefing archive. Each pipeline run stores the baseline briefing it
-- generated, so "what the model said on this date" is a record rather than
-- something only reconstructable by checking out an old commit. Keyed by the
-- snapshot date the briefing describes; re-running the pipeline on the same
-- day replaces that day's entry rather than accumulating duplicates.
CREATE TABLE IF NOT EXISTS briefings (
  date_iso     TEXT PRIMARY KEY,  -- the snapshot date this briefing describes
  chain_index  REAL,              -- headline index at generation time
  headline     TEXT,              -- one-line summary for the archive list
  event_count  INTEGER,
  body         TEXT NOT NULL,     -- the full generated briefing
  model_version TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* Additive column migrations. SQLite has no "ADD COLUMN IF NOT EXISTS", and an
   existing committed database predates these, so check before altering. */
for (const [table, column, ddl] of [
  ['event_candidates', 'dedupe_key', "ALTER TABLE event_candidates ADD COLUMN dedupe_key TEXT"],
  ['event_candidates', 'duplicate_of', "ALTER TABLE event_candidates ADD COLUMN duplicate_of TEXT"],
  /* The event an approval created. Approve is not a status flip — it inserts a
     row into `events` and derives that row's id — and nothing recorded the
     link back, so undoing an approval meant guessing which event came from
     which candidate by string-matching the source field. With automatic
     triage approving records unattended, that link has to be exact: it is what
     makes an auto-approval reversible. */
  ['event_candidates', 'event_id', 'ALTER TABLE event_candidates ADD COLUMN event_id TEXT'],
  /* events.date_iso is the authoritative date every age derives from. Without
     it, `days_ago` was the only date the table stored for events added through
     the review queue, so advancing the snapshot date could not re-age them:
     scripts/sync-events.mjs only knows the dates of *code-defined* events, and
     reviewed ones stayed frozen at the age they had on the day they were
     approved. Since the review queue is the live feed, those events never
     decayed and held the index near its peak indefinitely. */
  ['events', 'date_iso', 'ALTER TABLE events ADD COLUMN date_iso TEXT'],
  /* How this event's classification came to be published. The `source`
     string used to assert "AI-drafted, human-reviewed" on every reviewed
     event, including the ones automatic triage approved with no human in
     the loop — a provenance claim the record could not support. This is
     the structured version of that claim, so the public interface can
     state it without parsing prose:
       'human'    a person approved it through the admin surface
       'automatic' triage approved it unattended (reviewed_by='auto-triage')
       'curated'  hand-authored in the seed data, never in the queue
       'legacy'   predates this column; provenance is not recorded
     Never invent a reviewer identity: 'automatic' is a fact about the
     process, not a person. */
  ['events', 'provenance', 'ALTER TABLE events ADD COLUMN provenance TEXT'],
  ['events', 'reviewed_by', 'ALTER TABLE events ADD COLUMN reviewed_by TEXT'],
  /* Incident grouping. Several reports of one real-world incident used to
     accumulate through noisy-OR as though each were a separate event —
     seven adverse contributions for one earthquake. One record per
     incident is the primary (scored); the rest are updates or recovery
     reports, kept with their citations but not independently scored. */
  ['events', 'incident_id', 'ALTER TABLE events ADD COLUMN incident_id TEXT'],
  ['events', 'incident_role', 'ALTER TABLE events ADD COLUMN incident_role TEXT'],
]) {
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!has) db.exec(ddl);
}

/* One-time backfill of events.date_iso for rows that predate the column. The
   display `date` ("Jul 29, 2026") is the only date those rows carry, so parse
   it as UTC — the same calendar day it was formatted from. Idempotent: only
   NULL rows are touched, so this is a no-op on every subsequent open. */
{
  const undated = db.prepare('SELECT id, date FROM events WHERE date_iso IS NULL AND date IS NOT NULL').all();
  if (undated.length) {
    const setIso = db.prepare('UPDATE events SET date_iso = ? WHERE id = ?');
    const unparsed = [];
    db.transaction(() => {
      for (const row of undated) {
        const ms = Date.parse(`${row.date} UTC`);
        if (Number.isNaN(ms)) { unparsed.push(row.id); continue; }
        setIso.run(new Date(ms).toISOString().slice(0, 10), row.id);
      }
    })();
    if (unparsed.length) {
      console.warn(`[db] could not derive date_iso for ${unparsed.length} event(s): ${unparsed.join(', ')}. They will not be re-aged when the snapshot date advances.`);
    }
  }
}
