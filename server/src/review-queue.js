import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { getSnapshotDate } from './meta.js';
import { daysAgoOf } from './history-events.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..');
const repoDir = path.resolve(serverDir, '..');
const appDir = path.join(repoDir, 'app');
const assumptionFile = path.join(appDir, 'src', 'engine', 'event-assumptions.js');

const row = (r) => ({
  ...r,
  raw: JSON.parse(r.raw_json),
  proposal: r.proposed_json ? JSON.parse(r.proposed_json) : null,
});

export function pendingCandidates() {
  return db.prepare(`SELECT * FROM event_candidates WHERE status = 'pending' ORDER BY date_iso DESC`).all().map(row);
}

export function candidateById(id) {
  const found = db.prepare('SELECT * FROM event_candidates WHERE id = ?').get(id);
  return found ? row(found) : null;
}

function validate({ sev, direction, channel, operational }) {
  if (!Number.isInteger(sev) || sev < 1 || sev > 10) throw new Error('Severity must be an integer from 1 to 10.');
  if (!['adverse', 'mitigating', 'mixed'].includes(direction)) throw new Error('Direction must be adverse, mitigating, or mixed.');
  if (!['downstream', 'upstream', 'both'].includes(channel)) throw new Error('Channel must be downstream, upstream, or both.');
  if (typeof operational !== 'boolean') throw new Error('Operational must be true or false.');
}

function safeEventId(value) {
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(value)) throw new Error('Event ID must start with a letter and use lowercase letters, digits, or underscores.');
  return value;
}

function addAssumption(id, { direction, channel, operational, reason }) {
  const text = fs.readFileSync(assumptionFile, 'utf8');
  if (new RegExp(`\\n\\s*${id}:`).test(text)) throw new Error(`An assumption for ${id} already exists.`);
  const anchor = 'export const EVENT_ASSUMPTIONS = Object.freeze({';
  const at = text.indexOf(anchor);
  if (at < 0) throw new Error('Could not locate EVENT_ASSUMPTIONS in the source file.');
  const entry = `\n  ${id}: Object.freeze({ direction: ${JSON.stringify(direction)}, channel: ${JSON.stringify(channel)}, operational: ${operational}, reason: ${JSON.stringify(reason)} }),\n`;
  fs.writeFileSync(assumptionFile, text.slice(0, at + anchor.length) + entry + text.slice(at + anchor.length), 'utf8');
}

export function approveCandidate(candidateId, input, reviewer) {
  const candidate = candidateById(candidateId);
  if (!candidate) throw new Error('Candidate not found.');
  if (candidate.status !== 'pending') throw new Error(`Candidate is already ${candidate.status}.`);
  if (!candidate.proposal) throw new Error('This candidate has no AI draft and must be entered manually.');
  const p = candidate.proposal;
  const fields = {
    eventId: safeEventId(input.eventId || `p${candidate.date_iso.replace(/-/g, '').slice(2)}_${candidate.source_feed.slice(0, 3)}${String(candidate.source_ref || candidate.id).replace(/[^\w]/g, '').slice(-4)}`),
    sev: Number(input.sev ?? p.proposedSev),
    direction: input.direction ?? p.proposedDirection,
    channel: input.channel ?? p.proposedChannel,
    operational: input.operational ?? p.proposedOperational,
  };
  validate(fields);
  if (db.prepare('SELECT 1 FROM events WHERE id = ?').get(fields.eventId)) throw new Error(`Event ID ${fields.eventId} already exists.`);
  const reason = input.reason || p.classificationReason || 'Human-reviewed candidate classification.';
  const date = new Date(`${candidate.date_iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
  db.transaction(() => {
    db.prepare(`INSERT INTO events (id, date, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, stages_json, countries_json, timeline_json)
      VALUES (@id, @date, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @stages_json, @countries_json, @timeline_json)`).run({
      id: fields.eventId, date, days_ago: daysAgoOf(candidate.date_iso, getSnapshotDate()), sev: fields.sev,
      type: p.eventType, conf: p.confidence, title: input.title || p.title, summary: input.summary || p.summary,
      first: p.first, second: p.second, watch: p.watch,
      detail: `${p.detail}\n\nReviewer note: ${reason}`,
      source: `${candidate.source_feed} (${candidate.raw.url ?? candidate.source_ref}) - AI-drafted, human-reviewed`,
      stages_json: JSON.stringify(input.stages || p.stages), countries_json: JSON.stringify(input.countries || p.countries), timeline_json: JSON.stringify([]),
    });
    db.prepare("UPDATE event_candidates SET status='approved', reviewed_at=datetime('now'), reviewed_by=? WHERE id=?").run(reviewer, candidateId);
  })();
  try { addAssumption(fields.eventId, { ...fields, reason }); } catch (error) {
    db.prepare('DELETE FROM events WHERE id = ?').run(fields.eventId);
    db.prepare("UPDATE event_candidates SET status='pending', reviewed_at=NULL, reviewed_by=NULL WHERE id=?").run(candidateId);
    throw error;
  }
  db.pragma('wal_checkpoint(TRUNCATE)');
  return { eventId: fields.eventId, candidateId };
}

export function rejectCandidate(candidateId, reason, reviewer) {
  const info = db.prepare("UPDATE event_candidates SET status='rejected', reviewed_at=datetime('now'), reviewed_by=?, ai_notes=COALESCE(?, ai_notes) WHERE id=? AND status='pending'")
    .run(reviewer, reason || null, candidateId);
  if (!info.changes) throw new Error('Candidate not found or already reviewed.');
  db.pragma('wal_checkpoint(TRUNCATE)');
  return { candidateId };
}

function run(file, args, cwd) { return execFileSync(file, args, { cwd, encoding: 'utf8', stdio: 'pipe' }); }

export function publishReview({ action, candidateId, eventId }) {
  try {
    if (action === 'approve') {
      run('node', ['scripts/build-vault-snapshot.mjs'], appDir);
      run('node', ['scripts/audit-snapshot.mjs'], appDir);
    }
    run('git', ['add', 'server/data/sscim.db', 'app/src/engine/event-assumptions.js'], repoDir);
    const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: repoDir }).status === 1;
    if (!staged) return { published: true, message: 'No publishable changes.' };
    const subject = action === 'approve' ? `Review: approve ${eventId}` : `Review: reject ${candidateId}`;
    run('git', ['commit', '-m', subject], repoDir);
    run('git', ['pull', '--rebase', 'origin', 'main'], repoDir);
    run('git', ['push', 'origin', 'main'], repoDir);
    return { published: true, message: subject };
  } catch (error) {
    // The approval/rejection remains safely recorded locally. The scheduled
    // pipeline will retry publication; return this explicitly to the reviewer.
    return { published: false, error: String(error.stderr || error.message).slice(0, 800) };
  }
}
