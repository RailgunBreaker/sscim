import { db } from './db.js';
import { DATASET_AS_OF } from './history-events.js';

/* The `meta` table is the single place the pipeline records dataset state, so
   the snapshot date is data rather than a constant two files must agree on.
   getSnapshotDate() falls back to the DATASET_AS_OF constant for a database
   that predates the table (or a fresh clone that has never run the pipeline). */

const getStmt = () => db.prepare('SELECT value FROM meta WHERE key = ?');
const setStmt = () => db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`);

export function getMeta(key, fallback = null) {
  const row = getStmt().get(key);
  return row?.value ?? fallback;
}

export function setMeta(key, value) {
  setStmt().run(key, value == null ? null : String(value));
}

export function getSnapshotDate() {
  return getMeta('snapshot_date', DATASET_AS_OF);
}

export function setSnapshotDate(dateISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error(`Invalid snapshot date: ${dateISO}`);
  setMeta('snapshot_date', dateISO);
}

export function getMetaBundle() {
  return {
    snapshotDate: getSnapshotDate(),
    lastRunAt: getMeta('last_run_at'),
    lastRunStatus: getMeta('last_run_status'),
    generatedAt: new Date().toISOString(),
  };
}
