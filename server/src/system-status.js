/* Everything the operator needs to answer "is this system healthy right now",
   in one object.

   ── Why it exists ─────────────────────────────────────────────────────────
   The state that matters is spread across places nothing reads together: the
   meta table, the candidate queue, the events table, the git working tree,
   the environment, and the filesystem. A stale snapshot date, a pipeline that
   has not run for a week, a queue of undrafted candidates, or a commit sitting
   unpushed are each invisible until someone thinks to look for that specific
   thing — and each one silently stops the deployed site from being current.

   ── Checks, not just numbers ──────────────────────────────────────────────
   Raw counts do not tell an operator whether anything is wrong. Every figure
   gathered here that has a "should be" is also turned into a check with a
   severity, so the page can lead with what needs attention instead of asking
   someone to eyeball twelve numbers and remember the thresholds.

   Nothing here writes. It is safe to poll and safe to call while the pipeline
   is running. */
import { execFileSync } from 'node:child_process';
import { statSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { getMeta, getSnapshotDate } from './meta.js';
import { claudeCodeAvailable } from './ai/analyze-claude-code.mjs';
import { aiAvailable } from './ai/analyze.mjs';
import { AUTO_APPROVE_ON, AUTO_REJECT_ON } from './triage.js';
import { eventImpacts } from './event-impact.js';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(here, '..');
const repoDir = resolve(serverDir, '..');

const DAY = 86400000;
const started = Date.now();

/* git is consulted read-only and must never take the page down with it: a
   clone with no remote, a detached HEAD, or git missing from PATH are all
   ordinary states for a machine running only the API. */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function gitState() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch === null) return { available: false };
  const porcelain = git(['status', '--porcelain']) ?? '';
  const dirty = porcelain ? porcelain.split('\n').filter(Boolean) : [];
  const ahead = git(['rev-list', '--count', '@{upstream}..HEAD']);
  const behind = git(['rev-list', '--count', 'HEAD..@{upstream}']);
  const last = git(['log', '-1', '--format=%h %s (%cr)']);
  return {
    available: true, branch, last,
    dirtyCount: dirty.length,
    dirtyFiles: dirty.slice(0, 12),
    /* null rather than 0 when there is no upstream — "nothing to push" and
       "no upstream configured" are different situations and must not look
       the same on the page. */
    ahead: ahead === null ? null : Number(ahead),
    behind: behind === null ? null : Number(behind),
    vaultDirty: dirty.some((l) => l.includes('server/data/sscim.db')),
  };
}

function fileSize(path) {
  try { return existsSync(path) ? statSync(path).size : 0; } catch { return 0; }
}

function daysSince(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor((Date.now() - ms) / DAY) : null;
}

const count = (sql, ...args) => db.prepare(sql).get(...args)?.c ?? 0;

export function systemStatus({ includeIndex = true } = {}) {
  const snapshotDate = getSnapshotDate();
  const today = new Date().toISOString().slice(0, 10);
  const lastRunAt = getMeta('last_run_at');
  const lastRunStatus = getMeta('last_run_status');

  const candidates = Object.fromEntries(
    db.prepare('SELECT status, COUNT(*) AS c FROM event_candidates GROUP BY status').all().map((r) => [r.status, r.c]),
  );
  const undrafted = count("SELECT COUNT(*) c FROM event_candidates WHERE status='pending' AND proposed_json IS NULL");
  const failedDrafts = count("SELECT COUNT(*) c FROM event_candidates WHERE status='pending' AND proposed_json IS NULL AND ai_notes LIKE '%analysis failed%'");

  const dbPath = process.env.SSCIM_DB_PATH || join(serverDir, 'data', 'sscim.db');
  const walBytes = fileSize(`${dbPath}-wal`);

  /* The index is the one figure that costs real work (an engine build over
     the whole vault, ~200ms). Optional so a lightweight poll can skip it. */
  let chainIndex = null;
  let indexError = null;
  if (includeIndex) {
    try {
      chainIndex = eventImpacts().currentIndex;
    } catch (error) {
      indexError = error.message;
    }
  }

  const vault = {
    events: count('SELECT COUNT(*) c FROM events'),
    undatedEvents: count('SELECT COUNT(*) c FROM events WHERE date_iso IS NULL'),
    overrides: count('SELECT COUNT(*) c FROM event_overrides'),
    tombstones: count('SELECT COUNT(*) c FROM event_overrides WHERE deleted = 1'),
    companies: count('SELECT COUNT(*) c FROM companies'),
    stages: count('SELECT COUNT(*) c FROM stages'),
    countries: count('SELECT COUNT(*) c FROM countries'),
    facilities: count('SELECT COUNT(*) c FROM facilities'),
    quotes: count('SELECT COUNT(*) c FROM quotes'),
    briefings: count('SELECT COUNT(*) c FROM briefings'),
    dbBytes: fileSize(dbPath),
    walBytes,
    path: dbPath,
  };

  const environment = {
    node: process.version,
    port: Number(process.env.PORT) || 8787,
    pid: process.pid,
    uptimeSeconds: Math.round((Date.now() - started) / 1000),
    adminToken: Boolean(process.env.ADMIN_TOKEN),
    webzToken: Boolean(process.env.WEBZ_TOKEN),
    claudeCode: claudeCodeAvailable(),
    anthropicKey: aiAvailable(),
    autoApprove: AUTO_APPROVE_ON,
    autoReject: AUTO_REJECT_ON,
    autoPublish: (process.env.REVIEW_AUTOPUBLISH ?? 'on').toLowerCase() !== 'off',
  };

  const repo = gitState();
  const snapshotAgeDays = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${snapshotDate}T00:00:00Z`)) / DAY));
  const runAgeDays = daysSince(lastRunAt);

  const checks = buildChecks({
    snapshotDate, snapshotAgeDays, lastRunAt, lastRunStatus, runAgeDays,
    candidates, undrafted, failedDrafts, vault, environment, repo, indexError,
  });

  return {
    generatedAt: new Date().toISOString(),
    ok: !checks.some((c) => c.level === 'error'),
    chainIndex, indexError,
    snapshot: { date: snapshotDate, today, ageDays: snapshotAgeDays },
    pipeline: { lastRunAt, lastRunStatus, ageDays: runAgeDays },
    queue: {
      pending: candidates.pending ?? 0,
      approved: candidates.approved ?? 0,
      rejected: candidates.rejected ?? 0,
      undrafted, failedDrafts,
    },
    vault, environment, repo, checks,
  };
}

function buildChecks(s) {
  const out = [];
  const add = (level, label, detail, fix) => out.push({ level, label, detail, fix });

  if (!s.environment.adminToken) {
    add('error', 'ADMIN_TOKEN is not set', 'Every /api/admin route answers 503 and the review queue cannot be used.',
      'Set ADMIN_TOKEN in server/.env and restart the API.');
  }

  if (s.lastRunStatus && s.lastRunStatus !== 'ok') {
    add('error', 'Last pipeline run did not succeed', s.lastRunStatus,
      'Check the run output; the previous good deployment is still live.');
  }

  if (s.runAgeDays === null) {
    add('warn', 'The pipeline has never run on this machine', 'No last_run_at recorded.', 'Run: npm run pipeline');
  } else if (s.runAgeDays >= 3) {
    add(s.runAgeDays >= 7 ? 'error' : 'warn', `Pipeline last ran ${s.runAgeDays} days ago`,
      `Last run ${s.lastRunAt}.`, 'Run: npm run pipeline');
  }

  if (s.snapshotAgeDays >= 3) {
    add(s.snapshotAgeDays >= 7 ? 'error' : 'warn', `Snapshot date is ${s.snapshotAgeDays} days behind today`,
      `Every event age is derived from ${s.snapshotDate}, so the index describes that date.`,
      'A pipeline run advances it.');
  }

  if (s.failedDrafts > 0) {
    add('warn', `${s.failedDrafts} candidate(s) failed to draft`,
      'They cannot be approved until a draft exists, so they sit in the queue doing nothing.',
      'Run: npm run draft');
  } else if (s.undrafted > 0) {
    add('info', `${s.undrafted} pending candidate(s) have no AI draft`, 'Approval requires a draft.', 'Run: npm run draft');
  }

  if ((s.candidates.pending ?? 0) > 25) {
    add('info', `${s.candidates.pending} candidates awaiting review`, 'Triage clears the clear-cut ones.', 'Open the review queue and run triage.');
  }

  if (!s.environment.claudeCode && !s.environment.anthropicKey) {
    add('warn', 'No AI drafting backend available', 'Candidates will queue undrafted for manual entry.',
      'Install the Claude Code extension, or set ANTHROPIC_API_KEY in server/.env.');
  }
  if (!s.environment.webzToken) {
    add('info', 'WEBZ_TOKEN is not set', 'The news feed is skipped, and it is where most supply-chain events surface.',
      'Set WEBZ_TOKEN in server/.env.');
  }

  if (s.vault.undatedEvents > 0) {
    add('warn', `${s.vault.undatedEvents} event(s) have no date_iso`,
      'They cannot be re-aged when the snapshot date advances, so they never decay out of the index.', null);
  }

  if (s.repo.available) {
    if (s.repo.ahead === null) {
      add('info', 'No upstream branch configured', `Branch ${s.repo.branch} has no tracking remote, so nothing is published.`, null);
    } else if (s.repo.ahead > 0) {
      add('warn', `${s.repo.ahead} commit(s) not pushed`,
        'The vault is committed locally but the deployed site has not rebuilt.', 'Publish from the admin screen, or: git push');
    }
    if (s.repo.vaultDirty) {
      add('info', 'The vault database has uncommitted changes',
        'Edits are recorded but not published.', 'Commit from the admin Events tab.');
    }
  } else {
    add('info', 'git is not available here', 'Publication status cannot be reported.', null);
  }

  if (s.vault.walBytes > 8 * 1024 * 1024) {
    add('info', `Write-ahead log is ${(s.vault.walBytes / 1048576).toFixed(1)} MB`,
      'The committed .db does not include WAL content until it is checkpointed.', 'Run: npm run snapshot');
  }

  if (s.indexError) {
    add('error', 'The chain index could not be computed', s.indexError, 'The engine build failed — the events screen will fail too.');
  }

  if (!out.length) add('ok', 'No problems detected', 'Every check passed.', null);
  return out;
}
