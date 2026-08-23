/* Draft the pending candidates that have no AI proposal yet.

   WHY THIS EXISTS SEPARATELY FROM pipeline.mjs. Drafting is step 2 of seven,
   and the other six ingest new records, re-age every event, run the gate, and
   push. When a drafting run fails — the batch times out, the binary errors —
   the candidates sit pending-and-undrafted, and the only way to retry was to
   run the whole pipeline again. That is a heavy, side-effecting way to redo
   one step, so nobody does it, and the queue fills with undrafted records that
   the review UI cannot do anything with (approveCandidate refuses a candidate
   with no draft).

   This writes ONLY event_candidates.proposed_json / ai_model / ai_notes.
   It never touches events, never commits, never pushes.

   USAGE
     node scripts/draft-candidates.mjs            # draft all undrafted pending
     node scripts/draft-candidates.mjs --limit=5  # just a few (cost control)
     node scripts/draft-candidates.mjs --retry    # also re-draft ones that failed before
     node scripts/draft-candidates.mjs --dry-run  # show what would be drafted
*/
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

{
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    try { process.loadEnvFile(envPath); } catch { /* malformed .env must not block the run */ }
  }
}

import { db } from '../src/db.js';
import { claudeCodeAvailable, analyzeBatchWithClaudeCode } from '../src/ai/analyze-claude-code.mjs';
import { aiAvailable, analyzeCandidate } from '../src/ai/analyze.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const DRY_RUN = flag('dry-run');
const RETRY = flag('retry');
const LIMIT = Number(opt('limit', 0)) || 0;
const BACKEND = opt('ai', 'auto');

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

/* --retry picks up records whose previous draft attempt errored. Those have
   proposed_json NULL and an ai_notes that starts with a failure sentence, so
   they are already in the undrafted set — the flag exists to make the intent
   explicit and to allow the default run to skip nothing. */
const rows = db.prepare(`SELECT id, source_feed, source_ref, date_iso, raw_json, ai_notes
  FROM event_candidates
  WHERE status = 'pending' AND proposed_json IS NULL
  ORDER BY date_iso DESC
  ${LIMIT ? 'LIMIT ' + LIMIT : ''}`).all();

if (!rows.length) {
  log('Nothing to draft — every pending candidate already has a proposal.');
  process.exit(0);
}

const failed = rows.filter((r) => /analysis failed|returned an error|No proposal returned/i.test(r.ai_notes || '')).length;
log(`${rows.length} undrafted pending candidate(s)${failed ? ` (${failed} from a previous failed attempt)` : ''}`);

const backend = BACKEND !== 'auto' ? BACKEND
  : claudeCodeAvailable() ? 'claude-code'
  : aiAvailable() ? 'api'
  : 'none';

if (backend === 'none') {
  console.error('No AI backend available. Install the Claude Code extension or set ANTHROPIC_API_KEY in server/.env.');
  process.exit(1);
}
log(`backend: ${backend}`);

if (DRY_RUN) {
  for (const r of rows) log(`  would draft ${r.id} (${r.source_feed}, ${r.date_iso})`);
  process.exit(0);
}

const saveDraft = db.prepare('UPDATE event_candidates SET proposed_json = ?, ai_model = ?, ai_notes = ? WHERE id = ?');
const verdict = (id, p) => log(`    ${id}: ${
  !p ? 'UNDRAFTED' : p.relevant ? `sev ${p.proposedSev} ${p.proposedDirection}/${p.proposedChannel} ${p.proposedOperational ? 'scored' : 'excluded'} [${p.confidence}]` : `not relevant — ${p.irrelevantReason}`}`);

let drafted = 0;
if (backend === 'claude-code') {
  const payload = rows.map((r) => ({ id: r.id, sourceFeed: r.source_feed, dateISO: r.date_iso, raw: JSON.parse(r.raw_json) }));
  /* Persist as each chunk lands rather than after the whole batch. Drafting a
     news record means fetching and reading the article, so a full queue is
     minutes of work — long enough that a Ctrl-C or a dropped connection part
     way through used to throw away every chunk that had already succeeded. */
  const seen = new Set();
  const persist = (r) => {
    saveDraft.run(r.proposal ? JSON.stringify(r.proposal) : null, r.model, r.notes ?? null, r.id);
    seen.add(r.id);
    if (r.proposal) drafted++;
    verdict(r.id, r.proposal);
  };

  const results = await analyzeBatchWithClaudeCode(payload, {
    onProgress: (p) => {
      log(p.ok
        ? `  chunk ${p.chunk}/${p.of}: ${p.drafted}/${p.of_chunk} drafted${p.cost != null ? ` (~$${Number(p.cost).toFixed(3)})` : ''}`
        : `  chunk ${p.chunk}/${p.of}: FAILED — ${p.error}`);
      for (const r of p.results || []) persist(r);
    },
  });

  /* A failed chunk reports no results, so its records still need their failure
     note written. */
  for (const r of payload) {
    if (seen.has(r.id)) continue;
    const { proposal, model, notes } = results.get(r.id) ?? { proposal: null, model: 'claude-code', notes: 'No result returned.' };
    persist({ id: r.id, proposal, model, notes });
  }
} else {
  for (const r of rows) {
    const { proposal, model, notes } = await analyzeCandidate({
      sourceFeed: r.source_feed, sourceRef: r.source_ref, dateISO: r.date_iso, raw: JSON.parse(r.raw_json),
    });
    saveDraft.run(proposal ? JSON.stringify(proposal) : null, model, notes ?? null, r.id);
    if (proposal) drafted++;
    verdict(r.id, proposal);
  }
}

db.pragma('wal_checkpoint(TRUNCATE)');
log(`Done — ${drafted}/${rows.length} drafted. ${rows.length - drafted} still undrafted.`);
