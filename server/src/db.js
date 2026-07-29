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
`);

/* Additive column migrations. SQLite has no "ADD COLUMN IF NOT EXISTS", and an
   existing committed database predates these, so check before altering. */
for (const [table, column, ddl] of [
  ['event_candidates', 'dedupe_key', "ALTER TABLE event_candidates ADD COLUMN dedupe_key TEXT"],
  ['event_candidates', 'duplicate_of', "ALTER TABLE event_candidates ADD COLUMN duplicate_of TEXT"],
]) {
  const has = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!has) db.exec(ddl);
}
