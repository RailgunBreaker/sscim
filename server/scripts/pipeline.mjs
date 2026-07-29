#!/usr/bin/env node
/* The Option-A pipeline: fetch → analyze → recompute → verify → publish.

   Runs unattended on the machine that owns the vault database. GitHub Pages
   stays a pure static frontend; this is the only writer.

     ingest   pull candidates from USGS + Federal Register + webz.io news
     analyze  draft/propose each new candidate with Claude (optional):
                --ai=claude-code  the VS Code extension's bundled binary
                                  (runs on your subscription, gets WebFetch)
                --ai=api          the Anthropic SDK (needs ANTHROPIC_API_KEY)
                --ai=auto         claude-code if present, else api  [default]
     age      advance the snapshot date and re-derive every event age
     quotes   refresh price/PE
     export   regenerate the bundled snapshot from the database
     verify   audit + tests — THE GATE. Nothing publishes if this fails.
     publish  commit and push, which triggers the Pages rebuild

   The gate matters more than the automation. If your PC is down, the site
   serves the last good commit — fine. If your PC pushes corrupt data and then
   goes down, the site serves corrupt data with nobody to fix it. So a failed
   audit or test run aborts before the commit and leaves the last good state
   deployed.

   Usage:
     node scripts/pipeline.mjs               # full run, publishes if clean
     node scripts/pipeline.mjs --dry-run     # everything except commit/push
     node scripts/pipeline.mjs --no-ai       # skip the Claude step
     node scripts/pipeline.mjs --since=2026-07-01
*/
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

/* Load server/.env before anything reads process.env. A scheduled task does
   not inherit an interactive shell's environment, so ANTHROPIC_API_KEY has to
   come from the file. .env is gitignored — the key never enters the repo. */
{
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(envPath); } catch { /* malformed .env must not block the run */ }
  }
}

import { db } from '../src/db.js';
import { setMeta, setSnapshotDate, getSnapshotDate } from '../src/meta.js';
import { fetchEarthquakeCandidates } from '../src/ingest/usgs.mjs';
import { fetchPolicyCandidates } from '../src/ingest/federal-register.mjs';
import { fetchNewsCandidates } from '../src/ingest/webz-news.mjs';
import { findDuplicate, storyKey, WINDOW_DAYS } from '../src/ingest/dedupe.js';
import { aiAvailable, analyzeCandidate } from '../src/ai/analyze.mjs';
import { claudeCodeAvailable, analyzeBatchWithClaudeCode } from '../src/ai/analyze-claude-code.mjs';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_DIR = resolve(SERVER_DIR, '..');
const APP_DIR = resolve(REPO_DIR, 'app');

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const DRY_RUN = flag('dry-run');
const NO_AI = flag('no-ai');
const AI_BACKEND = opt('ai', 'auto');   // auto | claude-code | api | none
const today = new Date().toISOString().slice(0, 10);
const SINCE = opt('since', getSnapshotDate());
const UNTIL = opt('until', today);

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
function run(cmd, cmdArgs, cwd) {
  return execFileSync(cmd, cmdArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
/* Invoke the underlying scripts with `node` rather than through npm: Windows
   refuses to spawn npm.cmd without a shell (EINVAL), and this avoids depending
   on npm being on the scheduled task's PATH at all. */
const nodeScript = (relPath, cwd) => run('node', [relPath], cwd);

async function main() {
  log(`Pipeline start - window ${SINCE} -> ${UNTIL}${DRY_RUN ? ' (dry run)' : ''}`);

  /* ---- 1. Ingest ------------------------------------------------------- */
  const feeds = [
    ['usgs', () => fetchEarthquakeCandidates({ since: SINCE, until: UNTIL })],
    ['federal-register', () => fetchPolicyCandidates({ since: SINCE, until: UNTIL })],
    // News is where most real supply-chain events actually surface — the other
    // two feeds report that the ground shook or a rule published, never that a
    // fab stopped. Skipped silently when WEBZ_TOKEN is unset.
    ['webz-news', () => fetchNewsCandidates({ since: SINCE, until: UNTIL })],
  ];
  const candidates = [];
  for (const [name, fetchFn] of feeds) {
    try {
      const found = await fetchFn();
      log(`  ingest ${name}: ${found.length} record(s)`);
      candidates.push(...found);
    } catch (err) {
      // A dead feed must not block the rest of the run.
      log(`  ingest ${name}: FAILED (${err.message}) - continuing`);
    }
  }

  const insert = db.prepare(`INSERT INTO event_candidates (id, status, source_feed, source_ref, date_iso, raw_json, dedupe_key, duplicate_of)
    VALUES (@id, 'pending', @source_feed, @source_ref, @date_iso, @raw_json, @dedupe_key, NULL)
    ON CONFLICT(source_feed, source_ref) DO NOTHING`);
  const collapse = db.prepare("UPDATE event_candidates SET status = 'rejected', duplicate_of = ?, ai_notes = ? WHERE id = ?");
  const flagNear = db.prepare('UPDATE event_candidates SET duplicate_of = ?, ai_notes = ? WHERE id = ?');

  /* Story-level dedupe (src/ingest/dedupe.js): the unique index only catches
     the same upstream record, so a wire story syndicated across sites arrives
     as N distinct candidates. Compare against everything recent regardless of
     status — a story already rejected must not return under a new url. */
  const recent = () => db.prepare(`SELECT id, date_iso, dedupe_key, json_extract(raw_json, '$.title') AS title
    FROM event_candidates WHERE date_iso >= date(?, '-${WINDOW_DAYS} days')`).all(UNTIL);

  let queued = 0;
  let collapsed = 0;
  let flagged = 0;
  for (const c of candidates) {
    const id = `cand_${c.sourceFeed}_${c.sourceRef}`.replace(/[^\w]/g, '_');
    const info = insert.run({
      id, source_feed: c.sourceFeed, source_ref: c.sourceRef,
      date_iso: c.dateISO, raw_json: JSON.stringify(c.raw),
      dedupe_key: storyKey(c.raw?.title) || null,
    });
    if (info.changes === 0) continue;
    const hit = findDuplicate(c, recent().filter((r) => r.id !== id));
    if (hit?.exact) {
      // Recorded, not deleted: the reviewer can still see what arrived and why
      // it was collapsed, and the AI step below skips anything not pending.
      collapse.run(hit.id, `Auto-collapsed: identical story to ${hit.id}.`, id);
      collapsed++;
    } else if (hit) {
      flagNear.run(hit.id, `Possible duplicate of ${hit.id} - confirm before approving.`, id);
      flagged++; queued++;
    } else {
      queued++;
    }
  }
  log(`  ${queued} new candidate(s) queued (${candidates.length - queued - collapsed} already known, ${collapsed} duplicate(s) collapsed, ${flagged} flagged as possible duplicates)`);

  /* ---- 2. AI analysis (optional; proposals only) ------------------------
     Two interchangeable backends, both writing only to the review queue:
       claude-code  the binary bundled with the VS Code extension. Runs on the
                    subscription instead of API credits, and gets WebFetch so
                    it can read a thin news snippet's actual article. One
                    batched invocation for all candidates (Claude Code carries
                    a large system context, so per-call overhead is the cost).
       api          the Anthropic SDK. Cheaper per record, needs ANTHROPIC_API_KEY.
     Default: claude-code if the binary is present, else api, else skip. */
  const undrafted = db.prepare(`SELECT id, source_feed, source_ref, date_iso, raw_json
    FROM event_candidates WHERE status = 'pending' AND proposed_json IS NULL`).all();

  const backend = NO_AI ? 'none'
    : AI_BACKEND !== 'auto' ? AI_BACKEND
    : claudeCodeAvailable() ? 'claude-code'
    : aiAvailable() ? 'api'
    : 'none';

  const saveDraft = db.prepare('UPDATE event_candidates SET proposed_json = ?, ai_model = ?, ai_notes = ? WHERE id = ?');
  const logVerdict = (id, proposal) => log(`    ${id}: ${
    !proposal ? 'undrafted' : proposal.relevant ? `sev ${proposal.proposedSev} ${proposal.proposedDirection}/${proposal.proposedChannel} ${proposal.proposedOperational ? 'scored' : 'excluded'}` : 'not relevant'}`);

  if (!undrafted.length) {
    log('  nothing to analyze');
  } else if (backend === 'none') {
    log(`  AI step skipped (${NO_AI ? '--no-ai' : 'no backend available'}); ${undrafted.length} candidate(s) queued undrafted`);
  } else if (backend === 'claude-code') {
    log(`  analyzing ${undrafted.length} candidate(s) via Claude Code (one batched call)...`);
    const rows = undrafted.map((r) => ({ id: r.id, sourceFeed: r.source_feed, dateISO: r.date_iso, raw: JSON.parse(r.raw_json) }));
    const results = await analyzeBatchWithClaudeCode(rows);
    for (const row of rows) {
      const { proposal, model, notes } = results.get(row.id) ?? { proposal: null, model: 'claude-code', notes: 'No result returned.' };
      saveDraft.run(proposal ? JSON.stringify(proposal) : null, model, notes ?? null, row.id);
      logVerdict(row.id, proposal);
    }
  } else {
    log(`  analyzing ${undrafted.length} candidate(s) via the Anthropic API...`);
    for (const row of undrafted) {
      const { proposal, model, notes } = await analyzeCandidate({
        sourceFeed: row.source_feed, sourceRef: row.source_ref,
        dateISO: row.date_iso, raw: JSON.parse(row.raw_json),
      });
      saveDraft.run(proposal ? JSON.stringify(proposal) : null, model, notes ?? null, row.id);
      logVerdict(row.id, proposal);
    }
  }

  const pending = db.prepare("SELECT COUNT(*) c FROM event_candidates WHERE status = 'pending'").get().c;

  /* ---- 3. Re-age every event against today's snapshot date -------------- */
  setSnapshotDate(UNTIL);
  log(`  snapshot date set to ${UNTIL}`);
  log(run('node', ['scripts/sync-events.mjs'], SERVER_DIR).trim());

  /* ---- 4. Quotes (best-effort — never blocks) --------------------------- */
  try {
    log(run('node', ['scripts/fetch-quotes.mjs'], SERVER_DIR).trim().split('\n')[0]);
  } catch (err) {
    log(`  quote refresh failed (${err.message.split('\n')[0]}) - keeping committed quotes`);
  }

  /* ---- 5. Export the snapshot ------------------------------------------ */
  log(nodeScript('scripts/build-vault-snapshot.mjs', APP_DIR).trim().split('\n').pop());

  /* ---- 6. THE GATE ------------------------------------------------------ */
  try {
    nodeScript('scripts/audit-snapshot.mjs', APP_DIR);
    run('node', ['node_modules/vitest/vitest.mjs', 'run'], APP_DIR);
    log('  verify: audit + tests PASSED');
  } catch (err) {
    setMeta('last_run_at', new Date().toISOString());
    setMeta('last_run_status', 'blocked: verification failed');
    db.pragma('wal_checkpoint(TRUNCATE)');
    console.error('\nVERIFICATION FAILED - nothing published. The last good commit stays deployed.\n');
    console.error((err.stdout || '') + (err.stderr || err.message));
    process.exit(1);
  }

  setMeta('last_run_at', new Date().toISOString());
  setMeta('last_run_status', 'ok');
  db.pragma('wal_checkpoint(TRUNCATE)');

  /* ---- 7. Publish ------------------------------------------------------- */
  const dirty = run('git', ['status', '--porcelain', '--', 'server/data/sscim.db'], REPO_DIR).trim();
  if (!dirty) {
    log('  no database changes to publish');
  } else if (DRY_RUN) {
    log('  dry run - skipping commit/push');
  } else {
    run('git', ['add', 'server/data/sscim.db'], REPO_DIR);
    const msg = `Data pipeline: snapshot ${UNTIL}${queued ? `, ${queued} new candidate(s)` : ''}${pending ? `, ${pending} pending review` : ''}`;
    run('git', ['commit', '-m', msg], REPO_DIR);
    try {
      run('git', ['pull', '--rebase', 'origin', 'main'], REPO_DIR);
      run('git', ['push', 'origin', 'main'], REPO_DIR);
      log('  published - Pages will rebuild');
    } catch (err) {
      // Committed locally but not pushed: the next run retries the push.
      log(`  push FAILED (${err.message.split('\n')[0]}) - commit is local, will retry next run`);
      process.exit(1);
    }
  }

  if (pending) log(`\n  ${pending} candidate(s) awaiting review - run: node scripts/review.mjs list`);
  log('Pipeline done.');
}

main().catch((err) => {
  setMeta('last_run_at', new Date().toISOString());
  setMeta('last_run_status', `error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
