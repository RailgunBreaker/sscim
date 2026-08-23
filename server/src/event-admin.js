/* Administration of the event table: list, edit, delete, restore.

   ── The thing that makes this non-trivial ─────────────────────────────────
   Events reach the vault two ways, and they behave differently under edit:

     code-defined   history-events.js, decade-events.js, seed-data.js. Every
                    pipeline run calls scripts/sync-events.mjs, which upserts
                    all of them. Deleting one from the events table is
                    therefore not a delete — it is a delay. It comes back on
                    the next run, and an edited severity reverts to the value
                    in the source file, with nothing reporting either.

     vault-only     added through the review queue or the admin API. Nothing
                    re-creates these, so a delete is a delete.

   So an edit is recorded in `event_overrides` as well as applied to `events`.
   sync-events.mjs reads that table: a tombstoned id is never re-inserted, a
   patched one is re-patched after the upsert. The source file stays the
   definition of the event; the override table is the record of the human
   decision about it. restoreEvent() drops the override and lets the code win
   again — which is the undo, and the reason edits are never destructive to
   the source files.
   ──────────────────────────────────────────────────────────────────────── */
import { db } from './db.js';
import { HISTORY_EVENTS, daysAgoOf } from './history-events.js';
import { DECADE_EVENTS } from './decade-events.js';
import { EVENTS as SEED_EVENTS } from './seed-data.js';
import { getSnapshotDate } from './meta.js';
import { eventImpacts } from './event-impact.js';

/* Which ids sync-events.mjs will re-assert. Derived from the same three sets
   that script reads, so the two cannot disagree about what "code-defined"
   means. */
export function codeDefinedIds() {
  return new Set([...SEED_EVENTS, ...HISTORY_EVENTS, ...DECADE_EVENTS].map((e) => e.id));
}

/* Columns an admin may change. Deliberately not `id` (it is the join key for
   assumptions, overrides and candidates) and not days_ago (derived from
   date_iso — see the date handling in updateEvent). */
const EDITABLE = ['title', 'summary', 'sev', 'type', 'conf', 'first', 'second', 'watch', 'detail', 'source', 'date_iso', 'stages_json', 'countries_json'];

const COLUMN_OF = {
  title: 'title', summary: 'summary', sev: 'sev', type: 'type', conf: 'conf',
  first: 'first', second: 'second', watch: 'watch', detail: 'detail', source: 'source',
  dateISO: 'date_iso', stages: 'stages_json', countries: 'countries_json',
};

const parseRow = (r) => ({
  ...r,
  stages: JSON.parse(r.stages_json || '[]'),
  countries: JSON.parse(r.countries_json || '[]'),
  timeline: JSON.parse(r.timeline_json || '[]'),
});

export function getOverride(eventId) {
  const row = db.prepare('SELECT * FROM event_overrides WHERE event_id = ?').get(eventId);
  return row ? { ...row, deleted: Boolean(row.deleted), patch: row.patch_json ? JSON.parse(row.patch_json) : null } : null;
}

export function allOverrides() {
  return db.prepare('SELECT * FROM event_overrides ORDER BY updated_at DESC').all()
    .map((r) => ({ ...r, deleted: Boolean(r.deleted), patch: r.patch_json ? JSON.parse(r.patch_json) : null }));
}

/* The full table with everything an admin needs to decide on a row: where it
   came from, whether it has been overridden, and what removing it would do to
   the index. Impacts are merged in from one engine build, not fetched per
   row. */
export function listEvents({ includeImpact = true } = {}) {
  const rows = db.prepare('SELECT * FROM events ORDER BY COALESCE(date_iso, date) DESC').all().map(parseRow);
  const code = codeDefinedIds();
  const overrides = new Map(allOverrides().map((o) => [o.event_id, o]));
  const impacts = includeImpact ? eventImpacts() : null;
  const impactById = new Map((impacts?.events ?? []).map((i) => [i.id, i]));

  const events = rows.map((r) => {
    const impact = impactById.get(r.id);
    return {
      id: r.id, title: r.title, summary: r.summary, detail: r.detail,
      dateISO: r.date_iso, date: r.date, daysAgo: r.days_ago,
      sev: r.sev, type: r.type, conf: r.conf, source: r.source,
      first: r.first, second: r.second, watch: r.watch,
      stages: r.stages, countries: r.countries,
      origin: code.has(r.id) ? 'code-defined' : 'vault-only',
      override: overrides.get(r.id) ?? null,
      operational: impact?.operational ?? null,
      removalDelta: impact?.removalDelta ?? null,
      indexWithout: impact?.indexWithout ?? null,
      marginal: impact?.marginal ?? null,
      standalone: impact?.standalone ?? null,
      classification: impact ? { direction: impact.direction, channel: impact.channel, reason: impact.reason } : null,
    };
  });

  /* Tombstoned ids are absent from `events` by definition, so they would
     vanish from this screen entirely — including the undo. Report them
     alongside, flagged, so a deletion stays visible and reversible. */
  const deleted = allOverrides().filter((o) => o.deleted).map((o) => ({
    id: o.event_id, origin: code.has(o.event_id) ? 'code-defined' : 'vault-only',
    deleted: true, reason: o.reason, actor: o.actor, updatedAt: o.updated_at,
    patch: o.patch,
  }));

  return {
    snapshotDate: impacts?.snapshotDate ?? getSnapshotDate(),
    currentIndex: impacts?.currentIndex ?? null,
    counts: {
      total: events.length,
      codeDefined: events.filter((e) => e.origin === 'code-defined').length,
      vaultOnly: events.filter((e) => e.origin === 'vault-only').length,
      scored: events.filter((e) => e.operational).length,
      overridden: events.filter((e) => e.override).length,
      deleted: deleted.length,
    },
    events, deleted,
  };
}

function recordOverride(eventId, { deleted, patch, reason, actor }) {
  const existing = getOverride(eventId);
  /* Patches accumulate: editing severity and then the title must leave both
     recorded, or the second edit would silently drop the first on the next
     sync. */
  const merged = { ...(existing?.patch ?? {}), ...(patch ?? {}) };
  db.prepare(`INSERT INTO event_overrides (event_id, deleted, patch_json, reason, actor, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(event_id) DO UPDATE SET
      deleted = excluded.deleted, patch_json = excluded.patch_json,
      reason = COALESCE(excluded.reason, event_overrides.reason),
      actor = excluded.actor, updated_at = excluded.updated_at`)
    .run(eventId, deleted ? 1 : 0, Object.keys(merged).length ? JSON.stringify(merged) : null, reason ?? null, actor ?? null);
}

function validate(patch) {
  if ('sev' in patch) {
    const sev = Number(patch.sev);
    if (!Number.isInteger(sev) || sev < 1 || sev > 10) throw new Error('Severity must be an integer from 1 to 10.');
  }
  if ('dateISO' in patch && patch.dateISO != null && !/^\d{4}-\d{2}-\d{2}$/.test(patch.dateISO)) {
    throw new Error('dateISO must be YYYY-MM-DD.');
  }
  if ('conf' in patch && patch.conf != null && !['High', 'Medium', 'Low'].includes(patch.conf)) {
    throw new Error('Confidence must be High, Medium, or Low.');
  }
  for (const key of Object.keys(patch)) {
    if (!(key in COLUMN_OF)) throw new Error(`${key} is not an editable field.`);
  }
}

export function updateEvent(eventId, patch, { actor = 'admin-ui', reason = null } = {}) {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!existing) throw new Error('Event not found.');
  const clean = Object.fromEntries(Object.entries(patch ?? {}).filter(([, v]) => v !== undefined));
  if (!Object.keys(clean).length) throw new Error('No fields to update.');
  validate(clean);

  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(clean)) {
    const column = COLUMN_OF[key];
    if (!EDITABLE.includes(column)) continue;
    sets.push(`${column} = ?`);
    values.push(key === 'stages' || key === 'countries' ? JSON.stringify(value) : value);
  }

  /* date_iso is what every age derives from, so days_ago is recomputed with
     it rather than left to drift — the same rule routes/admin.js applies when
     creating an event. */
  if ('dateISO' in clean && clean.dateISO) {
    sets.push('days_ago = ?');
    values.push(daysAgoOf(clean.dateISO, getSnapshotDate()));
  }
  if (!sets.length) throw new Error('No editable fields in that update.');

  db.transaction(() => {
    db.prepare(`UPDATE events SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values, eventId);
    recordOverride(eventId, { deleted: false, patch: clean, reason, actor });
  })();
  db.pragma('wal_checkpoint(TRUNCATE)');

  return { id: eventId, updated: Object.keys(clean), override: getOverride(eventId) };
}

export function deleteEvent(eventId, { reason = null, actor = 'admin-ui' } = {}) {
  const existing = db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
  const override = getOverride(eventId);
  if (!existing && override?.deleted) throw new Error('Event is already deleted.');
  if (!existing) throw new Error('Event not found.');

  const origin = codeDefinedIds().has(eventId) ? 'code-defined' : 'vault-only';
  db.transaction(() => {
    db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    /* The tombstone is what makes this stick. Without it, sync-events.mjs
       re-inserts a code-defined event on the next pipeline run and the
       deletion silently undoes itself. */
    recordOverride(eventId, { deleted: true, patch: null, reason, actor });
  })();
  db.pragma('wal_checkpoint(TRUNCATE)');

  return {
    id: eventId, origin,
    note: origin === 'code-defined'
      ? 'Tombstoned. The definition stays in the source file; sync-events.mjs will not re-insert it while the override exists.'
      : 'Deleted. Nothing re-creates a vault-only event.',
  };
}

/* Undo. Drops the override so the code definition wins again on the next
   sync; a vault-only event has no definition to fall back to, so it stays
   gone and says so. */
export function restoreEvent(eventId) {
  const override = getOverride(eventId);
  if (!override) throw new Error('That event has no override to undo.');
  const origin = codeDefinedIds().has(eventId) ? 'code-defined' : 'vault-only';
  db.prepare('DELETE FROM event_overrides WHERE event_id = ?').run(eventId);
  db.pragma('wal_checkpoint(TRUNCATE)');
  return {
    id: eventId, origin, wasDeleted: override.deleted,
    note: origin === 'code-defined'
      ? 'Override cleared. Run sync-events.mjs (or the next pipeline run) to restore it from the source file.'
      : override.deleted
        ? 'Override cleared, but a vault-only event has no code definition — it cannot be brought back this way.'
        : 'Override cleared. The row keeps its current values; nothing will re-assert them.',
  };
}
