import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { getSnapshotDate, getMeta, setMeta } from './meta.js';
import { daysAgoOf } from './history-events.js';
import { partition, VERDICTS, TRIAGE_ACTOR, AUTO_APPROVE_ON, AUTO_REJECT_ON, provenanceFor, provenanceLabel, PROVENANCE } from './triage.js';

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

export function candidates(status = 'pending') {
  const where = status === 'all' ? '' : 'WHERE status = ?';
  return db.prepare(`SELECT * FROM event_candidates ${where} ORDER BY COALESCE(reviewed_at, created_at) DESC`).all(...(where ? [status] : [])).map(row);
}

export function pendingCandidates() {
  return candidates('pending');
}

export function dashboardSummary() {
  const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS count FROM event_candidates GROUP BY status').all().map((r) => [r.status, r.count]));
  const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [r.key, r.value]));
  const recentReviews = db.prepare(`SELECT id, status, reviewed_at, reviewed_by, proposed_json FROM event_candidates
    WHERE status != 'pending' ORDER BY reviewed_at DESC LIMIT 8`).all().map((r) => ({ ...r, proposal: r.proposed_json ? JSON.parse(r.proposed_json) : null }));
  return {
    counts: { pending: counts.pending || 0, approved: counts.approved || 0, rejected: counts.rejected || 0 },
    events: db.prepare('SELECT COUNT(*) AS count FROM events').get().count,
    unpublished: unpublishedReviews().length,
    autoPublish: autoPublishStatus(),
    meta, recentReviews,
  };
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

/* ====================================================================
   Public-output sanitising.

   `events.detail` and the `reason` written into app/src/engine/
   event-assumptions.js are both PUBLIC: they are served by the API, baked
   into the static snapshot, and rendered in the dashboard. Review-workflow
   strings must never reach them. Eight published events carried
   "Published: Review: reject cand_webz_news_04f59e01..." as their public
   classification note before this existed.

   The same patterns live in app/src/engine/event-assumptions.js
   (INTERNAL_NOTE_PATTERNS) so the render side refuses them too, and the
   app's public-output test asserts the generated snapshot is clean. Two
   independent guards, because one of them will eventually be bypassed.
   ==================================================================== */
const INTERNAL_NOTE_PATTERNS = [
  /\bReview:\s*(approve|reject|publish)\b/i,
  /\bcand_[a-z0-9_]+/i,
  /\bPublished:\s*Review\b/i,
  /\bdecision\(s\)\s+awaiting\s+publication/i,
  /\bawaiting\s+publication\b/i,
];

export function looksInternal(text) {
  return INTERNAL_NOTE_PATTERNS.some((re) => re.test(String(text || '')));
}

const NO_PUBLIC_REASON = 'Classified through the review queue; no public classification rationale was recorded.';

/* Returns the reason when it is publishable, or a truthful stand-in when it
   is workflow text. Never publishes the workflow text itself. */
export function publicReason(reason) {
  const text = String(reason || '').trim();
  if (!text) return NO_PUBLIC_REASON;
  return looksInternal(text) ? NO_PUBLIC_REASON : text;
}

function addAssumption(id, { direction, channel, operational, reason }) {
  const text = fs.readFileSync(assumptionFile, 'utf8');
  if (new RegExp(`\\n\\s*${id}:`).test(text)) throw new Error(`An assumption for ${id} already exists.`);
  const anchor = 'export const EVENT_ASSUMPTIONS = Object.freeze({';
  const at = text.indexOf(anchor);
  if (at < 0) throw new Error('Could not locate EVENT_ASSUMPTIONS in the source file.');
  const entry = `\n  ${id}: Object.freeze({ direction: ${JSON.stringify(direction)}, channel: ${JSON.stringify(channel)}, operational: ${operational}, reason: ${JSON.stringify(publicReason(reason))} }),\n`;
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
  /* PROVENANCE, recorded rather than asserted.

     This used to write "AI-drafted, human-reviewed" into `source` for every
     approval — including the ones automatic triage made with no human in the
     loop. Now the actual approver decides the value, it is stored in its own
     column, and the prose clause is derived from it, so the two cannot drift
     apart. No reviewer identity is invented for an automatic approval. */
  const provenance = provenanceFor(reviewer);

  db.transaction(() => {
    /* date_iso is stored, not just days_ago: it is what lets sync-events.mjs
       re-age this row when the snapshot date advances. Without it the event
       would sit at today's age forever and never decay out of the index. */
    db.prepare(`INSERT INTO events (id, date, date_iso, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, provenance, reviewed_by, stages_json, countries_json, timeline_json)
      VALUES (@id, @date, @date_iso, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @provenance, @reviewed_by, @stages_json, @countries_json, @timeline_json)`).run({
      id: fields.eventId, date, date_iso: candidate.date_iso, days_ago: daysAgoOf(candidate.date_iso, getSnapshotDate()), sev: fields.sev,
      type: p.eventType, conf: p.confidence, title: input.title || p.title, summary: input.summary || p.summary,
      first: p.first, second: p.second, watch: p.watch,
      /* `detail` is public. The classification rationale belongs in it; the
         review workflow's own bookkeeping does not, and used to end up there
         verbatim ("Reviewer note: Published: Review: reject cand_webz_news_..."),
         putting internal candidate ids onto a public event card. Anything that
         looks like workflow text is kept out of the published field; the audit
         trail stays in the candidate row behind the admin token. */
      detail: `${p.detail}\n\nClassification note: ${publicReason(reason)}`,
      source: `${candidate.source_feed} (${candidate.raw.url ?? candidate.source_ref}) - ${provenanceLabel(provenance)}`,
      provenance,
      reviewed_by: provenance === PROVENANCE.AUTOMATIC ? TRIAGE_ACTOR : reviewer,
      stages_json: JSON.stringify(input.stages || p.stages), countries_json: JSON.stringify(input.countries || p.countries), timeline_json: JSON.stringify([]),
    });
    db.prepare("UPDATE event_candidates SET status='approved', reviewed_at=datetime('now'), reviewed_by=?, event_id=? WHERE id=?").run(reviewer, fields.eventId, candidateId);
  })();
  try { addAssumption(fields.eventId, { ...fields, reason }); } catch (error) {
    db.prepare('DELETE FROM events WHERE id = ?').run(fields.eventId);
    db.prepare("UPDATE event_candidates SET status='pending', reviewed_at=NULL, reviewed_by=NULL, event_id=NULL WHERE id=?").run(candidateId);
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

/* ---------------- bulk decisions and automatic triage ----------------------
   Reviewing a feed one record at a time does not scale past the first quiet
   week: most of what arrives is not a supply-chain event at all, and opening
   each one to say so is the whole cost of the queue.

   Both entry points below route through approveCandidate/rejectCandidate
   rather than writing status directly. That matters — approve is not an
   UPDATE, it inserts the event, derives its id, appends to
   event-assumptions.js, and rolls the whole thing back if the assumption
   write fails. A bulk path that set status='approved' itself would produce
   approved candidates with no event behind them. */

/* Per-item failures must not abort the batch: one candidate whose event id
   collides should not strand the other twenty. Each result carries its own
   ok/error so the caller can report exactly what happened. */
function decideEach(ids, action, { reason, reviewer, inputs = {} }) {
  const results = [];
  for (const id of ids) {
    try {
      const out = action === 'approve'
        ? approveCandidate(id, { ...(inputs[id] || {}), reason }, reviewer)
        : rejectCandidate(id, reason, reviewer);
      results.push({ id, ok: true, ...out });
    } catch (error) {
      results.push({ id, ok: false, error: error.message });
    }
  }
  return results;
}

export function bulkDecide({ ids, action, reason, reviewer = 'admin-ui' }) {
  if (!Array.isArray(ids) || !ids.length) throw new Error('No candidates selected.');
  if (!['approve', 'reject'].includes(action)) throw new Error('Action must be approve or reject.');
  const results = decideEach(ids, action, { reason, reviewer });
  return {
    action,
    attempted: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok),
    results,
  };
}

/* What triage WOULD do, with no writes. The admin UI calls this to render the
   queue already sorted, and to put a number on the Run-triage button before
   anyone presses it. */
export function triagePreview() {
  const groups = partition(pendingCandidates());
  const strip = (c) => ({
    id: c.id, date_iso: c.date_iso, source_feed: c.source_feed, duplicate_of: c.duplicate_of,
    title: c.proposal?.title || c.raw?.title || null,
    sev: c.proposal?.proposedSev ?? null,
    confidence: c.proposal?.confidence ?? null,
    operational: c.proposal?.proposedOperational ?? null,
    eventType: c.proposal?.eventType ?? null,
    triage: c.triage,
  });
  return {
    settings: { autoApprove: AUTO_APPROVE_ON, autoReject: AUTO_REJECT_ON },
    counts: {
      autoApprove: groups[VERDICTS.AUTO_APPROVE].length,
      autoReject: groups[VERDICTS.AUTO_REJECT].length,
      review: groups[VERDICTS.REVIEW].length,
    },
    autoApprove: groups[VERDICTS.AUTO_APPROVE].map(strip),
    autoReject: groups[VERDICTS.AUTO_REJECT].map(strip),
    review: groups[VERDICTS.REVIEW].map(strip),
  };
}

/* Applies the two automatic verdicts and leaves the review group alone.

   Rejections run first, deliberately. They are the cheap, reversible half —
   a status flip — while approvals insert events and rewrite a source file. If
   something goes wrong partway, the queue is left smaller and cleaner rather
   than half-populated with events whose noise was never cleared. */
export function applyTriage({ reviewer = TRIAGE_ACTOR } = {}) {
  const plan = triagePreview();

  const rejected = decideEach(plan.autoReject.map((c) => c.id), 'reject', {
    reason: null, reviewer,
  });
  /* The rejection reason is per-candidate (each has its own irrelevantReason),
     so write them individually rather than stamping one shared string. */
  for (const item of plan.autoReject) {
    if (rejected.find((r) => r.id === item.id)?.ok) {
      db.prepare('UPDATE event_candidates SET ai_notes = ? WHERE id = ?')
        .run(`Auto-rejected by triage: ${item.triage.reason}`, item.id);
    }
  }

  const approved = decideEach(plan.autoApprove.map((c) => c.id), 'approve', {
    reason: null, reviewer,
  });

  db.pragma('wal_checkpoint(TRUNCATE)');

  const remaining = pendingCandidates().length;
  return {
    rejected: { attempted: rejected.length, succeeded: rejected.filter((r) => r.ok).length, failed: rejected.filter((r) => !r.ok) },
    approved: { attempted: approved.length, succeeded: approved.filter((r) => r.ok).length, failed: approved.filter((r) => !r.ok) },
    remaining,
    autoPublish: scheduleAutoPublish({ queueEmpty: remaining === 0 }),
  };
}

/* Everything that went in unattended, newest first — the audit trail for the
   auto-approve decision. */
export function autoTriaged(limit = 200) {
  return db.prepare(`SELECT id, status, reviewed_at, reviewed_by, ai_notes, proposed_json FROM event_candidates
    WHERE reviewed_by = ? ORDER BY reviewed_at DESC LIMIT ?`).all(TRIAGE_ACTOR, limit)
    .map((r) => ({ ...r, proposal: r.proposed_json ? JSON.parse(r.proposed_json) : null }));
}

/* Reverses one auto-approval: drops the event it created and returns the
   candidate to the queue. The assumption entry in event-assumptions.js is
   left in place — it is a source file under review, and silently rewriting it
   from an undo path is how that file gets corrupted. It is reported instead. */
export function untriage(candidateId) {
  const candidate = candidateById(candidateId);
  if (!candidate) throw new Error('Candidate not found.');
  if (candidate.reviewed_by !== TRIAGE_ACTOR) throw new Error('That candidate was not decided by automatic triage.');

  const eventId = candidate.event_id;
  db.transaction(() => {
    if (eventId) db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    db.prepare("UPDATE event_candidates SET status='pending', reviewed_at=NULL, reviewed_by=NULL, event_id=NULL WHERE id=?").run(candidateId);
  })();
  db.pragma('wal_checkpoint(TRUNCATE)');
  return {
    candidateId,
    removedEvent: eventId ?? null,
    note: eventId ? `Remove the ${eventId} entry from app/src/engine/event-assumptions.js by hand.` : null,
  };
}

function run(file, args, cwd) { return execFileSync(file, args, { cwd, encoding: 'utf8', stdio: 'pipe' }); }

/* Publishing is deliberately NOT part of approve/reject. A reviewer works
   through a queue in one sitting, and committing per decision produced one
   binary-database commit per click ("Review: approve …", "Review: reject …")
   — dozens of commits that each rewrite the whole .db blob and say nothing a
   single batched commit would not. Decisions are recorded in the database
   immediately and published together, either by the idle auto-publish below,
   by an explicit publish, or by the next scheduled pipeline run. Nothing is
   lost by waiting: the database IS the record, the commit is only its
   distribution. */

const PUBLISH_MARK = 'last_review_publish_at';

export function unpublishedReviews() {
  let since = getMeta(PUBLISH_MARK, null);
  if (since == null) {
    /* First run after this change: every decision already in the database was
       published by the old commit-per-review path, so seed the marker at now
       rather than reporting the whole review history as a pending backlog. */
    since = new Date().toISOString();
    setMeta(PUBLISH_MARK, since);
  }
  return db.prepare(`SELECT id, status, reviewed_at, reviewed_by, proposed_json FROM event_candidates
    WHERE status != 'pending' AND reviewed_at IS NOT NULL AND reviewed_at > ?
    ORDER BY reviewed_at`).all(since)
    .map((r) => ({ ...r, proposal: r.proposed_json ? JSON.parse(r.proposed_json) : null }));
}

export function publishPendingReviews() {
  const queued = unpublishedReviews();
  const approved = queued.filter((r) => r.status === 'approved').length;
  const rejected = queued.filter((r) => r.status === 'rejected').length;
  try {
    if (approved) {
      run('node', ['scripts/build-vault-snapshot.mjs'], appDir);
      run('node', ['scripts/audit-snapshot.mjs'], appDir);
    }
    run('git', ['add', 'server/data/sscim.db', 'app/src/engine/event-assumptions.js'], repoDir);
    const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: repoDir }).status === 1;
    if (!staged) {
      setMeta(PUBLISH_MARK, new Date().toISOString());
      return { published: true, count: 0, message: 'Nothing to publish — the working tree already matches the database.' };
    }
    const parts = [approved && `${approved} approved`, rejected && `${rejected} rejected`].filter(Boolean);
    const subject = `Review: publish ${parts.join(', ') || 'queue decisions'}`;
    const body = queued.map((r) => `${r.status === 'approved' ? 'approve' : 'reject'} ${r.id}`).join('\n');
    run('git', ['commit', '-m', subject, ...(body ? ['-m', body] : [])], repoDir);
    /* --autostash: the vault clone routinely carries unrelated working-tree
       drift (a stray build output, a file copied in by hand). Without it a
       plain `pull --rebase` aborts with "cannot pull with rebase: you have
       unstaged changes" and the whole publish fails — which is how a week of
       reviewed data can sit committed-but-unpushed while the reviewer sees
       only "Publish failed". The database itself is already committed on the
       line above, so it is never what gets stashed. */
    run('git', ['pull', '--rebase', '--autostash', 'origin', 'main'], repoDir);
    run('git', ['push', 'origin', 'main'], repoDir);
    setMeta(PUBLISH_MARK, new Date().toISOString());
    return { published: true, count: queued.length, message: subject };
  } catch (error) {
    // Decisions stay safely recorded in the database; auto-publish retries and
    // so does the scheduled pipeline. Surface the failure to the reviewer.
    return { published: false, count: queued.length, error: String(error.stderr || error.message).slice(0, 800) };
  }
}

/* Publish edits made directly to the vault — the admin events screen, not the
   review queue.

   Separate from publishPendingReviews because the gate is not optional here.
   That function rebuilds the snapshot only when something was APPROVED, since
   a queue of pure rejections cannot move the index. An event edit always can:
   changing a severity, or deleting one of five overlapping earthquake
   records, re-derives the published number. So the snapshot is regenerated
   and audited on every call, and a failed audit aborts before anything is
   committed — the last good deployment stays live, which is the same contract
   pipeline.mjs step 6 enforces. */
export function publishVaultChanges({ message, reviewer = 'admin-ui' } = {}) {
  try {
    run('node', ['scripts/build-vault-snapshot.mjs'], appDir);
    run('node', ['scripts/audit-snapshot.mjs'], appDir);
  } catch (error) {
    return { published: false, stage: 'verify', error: String(error.stdout || error.stderr || error.message).slice(0, 800) };
  }

  try {
    run('git', ['add', 'server/data/sscim.db', 'app/src/engine/event-assumptions.js'], repoDir);
    const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: repoDir }).status === 1;
    if (!staged) return { published: true, count: 0, message: 'Nothing to publish — the working tree already matches the database.' };

    const subject = message || 'Vault: administrative event edits';
    run('git', ['commit', '-m', subject, '-m', `Recorded by ${reviewer} via the admin events screen.`], repoDir);
    run('git', ['pull', '--rebase', '--autostash', 'origin', 'main'], repoDir);
    run('git', ['push', 'origin', 'main'], repoDir);
    setMeta('last_vault_publish_at', new Date().toISOString());
    return { published: true, message: subject };
  } catch (error) {
    return { published: false, stage: 'publish', error: String(error.stderr || error.message).slice(0, 800) };
  }
}

/* ---------------- idle auto-publish ----------------------------------------
   "Publish after human review" without going back to one commit per click.

   Every decision (re)starts an idle timer. When the reviewer stops deciding
   for AUTOPUBLISH_IDLE_MS, or when the queue empties — whichever comes first —
   the batch is published once. So a review session still produces exactly one
   commit, but nobody has to remember to press publish.

   Failures retry with a doubling delay rather than being dropped, because the
   common failure is transient (no network, a concurrent push). After the last
   attempt the decisions simply wait for the next pipeline run, exactly as
   before — the database is the record either way. */

const AUTOPUBLISH_ON = (process.env.REVIEW_AUTOPUBLISH ?? 'on').toLowerCase() !== 'off';
const AUTOPUBLISH_IDLE_MS = Math.max(5_000, Number(process.env.REVIEW_AUTOPUBLISH_IDLE_MS) || 90_000);
const AUTOPUBLISH_MAX_ATTEMPTS = 3;

let autoTimer = null;
let autoAttempt = 0;
let autoState = { enabled: AUTOPUBLISH_ON, idleMs: AUTOPUBLISH_IDLE_MS, scheduledFor: null, lastStatus: null, lastAt: null, lastError: null };

export function autoPublishStatus() {
  return { ...autoState, pendingUnpublished: unpublishedReviews().length };
}

export function cancelAutoPublish() {
  if (autoTimer) clearTimeout(autoTimer);
  autoTimer = null;
  autoState = { ...autoState, scheduledFor: null };
}

function armAutoPublish(delayMs) {
  if (autoTimer) clearTimeout(autoTimer);
  autoState = { ...autoState, scheduledFor: new Date(Date.now() + delayMs).toISOString() };
  autoTimer = setTimeout(runAutoPublish, delayMs);
  // Never hold the process open just to publish; a shutdown loses at most the
  // commit, and the next pipeline run picks the decisions up.
  autoTimer.unref?.();
}

function runAutoPublish() {
  autoTimer = null;
  autoState = { ...autoState, scheduledFor: null };
  if (!unpublishedReviews().length) {
    autoAttempt = 0;
    return;
  }
  const result = publishPendingReviews();
  const at = new Date().toISOString();
  if (result.published) {
    autoAttempt = 0;
    autoState = { ...autoState, lastStatus: 'published', lastAt: at, lastError: null };
    setMeta('last_autopublish_at', at);
    setMeta('last_autopublish_status', `published ${result.count} decision(s)`);
    return;
  }
  autoAttempt++;
  autoState = { ...autoState, lastStatus: autoAttempt >= AUTOPUBLISH_MAX_ATTEMPTS ? 'failed' : 'retrying', lastAt: at, lastError: result.error };
  setMeta('last_autopublish_at', at);
  setMeta('last_autopublish_status', `${autoState.lastStatus}: ${String(result.error).split('\n')[0].slice(0, 200)}`);
  if (autoAttempt < AUTOPUBLISH_MAX_ATTEMPTS) armAutoPublish(AUTOPUBLISH_IDLE_MS * 2 ** autoAttempt);
}

/* Called after each recorded decision. `queueEmpty` publishes on a short delay
   instead of the full idle window: the reviewer has finished the queue, so
   there is nothing left to batch and no reason to make them wait. */
export function scheduleAutoPublish({ queueEmpty = false } = {}) {
  if (!AUTOPUBLISH_ON) return autoPublishStatus();
  autoAttempt = 0;
  armAutoPublish(queueEmpty ? Math.min(5_000, AUTOPUBLISH_IDLE_MS) : AUTOPUBLISH_IDLE_MS);
  return autoPublishStatus();
}
