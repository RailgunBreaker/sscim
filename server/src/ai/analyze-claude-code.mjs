/* Analysis backend that drives the Claude Code binary bundled with the VS Code
   extension, instead of the Anthropic API.

   Why this exists: it runs on the Claude Code subscription rather than API
   credits, and it gets WebFetch/WebSearch for free — so when a news snippet is
   too thin to judge (which is most of them), it can read the actual article
   before proposing anything. That is the "if the news is not enough, go get
   it" behaviour.

   ── Safety boundary ────────────────────────────────────────────────────────
   The agent is given NO file, shell, or git tools — only WebFetch and
   WebSearch. Candidates go in through the prompt and JSON comes back on
   stdout. It cannot touch the database, the repo, or push anything; the
   deterministic pipeline does every write. This is deliberate: an unattended
   agent with --dangerously-skip-permissions and push rights is not a trade
   worth making to save a few API cents.

   ── Cost ───────────────────────────────────────────────────────────────────
   Each invocation carries Claude Code's full system context (~$0.07 even for a
   trivial prompt), so ALL pending candidates are analyzed in ONE call rather
   than one call each. With ~10 candidates/day that is one invocation, not ten.
   ──────────────────────────────────────────────────────────────────────────── */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { db } from '../db.js';

/* Resolve the newest installed extension rather than pinning a version — the
   path contains the version number and VS Code updates it silently, which
   would break a scheduled task with a hardcoded path. */
export function findClaudeBinary() {
  if (process.env.SSCIM_CLAUDE_BIN && existsSync(process.env.SSCIM_CLAUDE_BIN)) {
    return process.env.SSCIM_CLAUDE_BIN;
  }
  const extRoot = join(homedir(), '.vscode', 'extensions');
  if (!existsSync(extRoot)) return null;

  const candidates = readdirSync(extRoot)
    .filter((d) => d.startsWith('anthropic.claude-code-'))
    .map((d) => ({ dir: d, bin: join(extRoot, d, 'resources', 'native-binary', 'claude.exe') }))
    .filter((c) => existsSync(c.bin))
    // Version-aware sort so 2.1.220 beats 2.1.99 (lexical sort would not).
    .sort((a, b) => {
      const ver = (s) => (s.match(/(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
      const [aM = 0, aN = 0, aP = 0] = ver(a.dir);
      const [bM = 0, bN = 0, bP = 0] = ver(b.dir);
      return bM - aM || bN - aN || bP - aP;
    });

  return candidates[0]?.bin ?? null;
}

export function claudeCodeAvailable() {
  return Boolean(findClaudeBinary());
}

function vaultIds() {
  return {
    stages: db.prepare('SELECT id FROM stages ORDER BY id').all().map((r) => r.id),
    countries: db.prepare('SELECT id FROM countries ORDER BY id').all().map((r) => r.id),
  };
}

function buildPrompt(candidates, { stages, countries }) {
  return `You are triaging raw feed records for SSCIM, a semiconductor supply-chain risk model. For each record decide whether it is a genuine supply-chain event and, if so, draft the event a human analyst will review.

Records come from three feeds: \`usgs\` (earthquakes near fab clusters), \`federal-register\` (U.S. regulatory documents), and \`webz-news\` (news articles).

RULES, in order of importance:

1. Be conservative about relevance. Most records are not supply-chain events. Stock-price moves, analyst ratings, earnings-reaction pieces, and product announcements are NOT supply-chain events — set relevant=false. An earthquake matters only if it plausibly disrupted production. A proposed rule or routine notice is not a realized change.

2. Severity (1-10) measures REALIZED operational scale — capacity share affected, duration, breadth — never newsworthiness or market reaction. Anchors from the existing dataset: 9 = the Oct 2022 BIS export controls (broadest sector-wide restriction). 7 = the M7.1 Kumamoto quake halting several named fabs with confirmed damage; China's Ga/Ge licensing regime. 6 = a multi-week single-site outage. 4 = one company losing one supply line. If you cannot establish that production was actually affected, the honest severity is low.

3. operational=false is right more often than people expect. Use it for: hazard signals where no disruption occurred, mixed/reallocative events with simultaneous winners and losers, long-term strategic or subsidy signals, and anything announced but not yet in effect.

4. For news records the excerpt is usually too thin to judge. Use WebFetch on the record's url to read the actual article before deciding. Do not guess at facts the snippet does not contain.

5. Separate what the source states from what you infer. Put only source-supported facts in summary/detail. Use \`uncertainty\` to say plainly what you could NOT establish — especially fab-level impact, which no feed reliably reports. A human reads that field to decide whether to trust your proposal.

6. Use ONLY these ids. Never invent one.
   stages: ${stages.join(', ')}
   countries: ${countries.join(', ')}

RECORDS:
${JSON.stringify(candidates, null, 2)}

OUTPUT: reply with ONLY a JSON array, no prose and no markdown fence. One object per record, in the same order, each shaped exactly:
{"candidateId":"<the id given>","relevant":true|false,"irrelevantReason":"","title":"","summary":"","eventType":"Export Control|Policy Signal|Natural Disaster|Industrial Accident|Critical Material Risk|Geopolitical Risk|Company Guidance|Technology Update|Market Shock|Pandemic Disruption","proposedSev":1-10,"proposedDirection":"adverse|mitigating|mixed","proposedChannel":"downstream|upstream|both","proposedOperational":true|false,"classificationReason":"","confidence":"High|Medium|Low","stages":[],"countries":[],"first":"","second":"","watch":"","detail":"","uncertainty":""}`;
}

/* Models wrap JSON in fences or prose often enough that strict JSON.parse on
   raw stdout is a reliability bug. Extract the outermost array/object. */
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) return null;
  const open = body[start];
  const close = open === '[' ? ']' : '}';
  const end = body.lastIndexOf(close);
  if (end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

/* One invocation of the binary. Returns the parsed envelope, or throws an
   Error whose message is SHORT and about the failure.

   THE PROMPT GOES ON STDIN, NOT IN ARGV. It used to be an `-p <prompt>`
   argument, which had two consequences. The soft one: Windows caps a command
   line at 32767 characters, so a large enough batch would fail to spawn at
   all. The loud one: execFileSync builds err.message by concatenating the
   whole command line, so a failed run stored a 17KB "Claude Code analysis
   failed: Command failed: ...claude.exe -p <the entire prompt>" string as the
   candidate's ai_notes — every pending record in the review UI rendered as a
   wall of the prompt that was supposed to analyze it, with the actual reason
   for the failure truncated off the end. */
function invoke(prompt, timeoutMs) {
  const bin = findClaudeBinary();
  let stdout;
  try {
    stdout = execFileSync(bin, [
      '-p',
      '--output-format', 'json',
      // Only web tools. No Read/Write/Bash/Edit — the agent cannot reach the
      // database, the repo, or git.
      '--allowed-tools', 'WebFetch', 'WebSearch',
    ], {
      input: prompt,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
      // Run outside the repo so no stray file can be picked up as context.
      cwd: tmpdir(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    /* Deliberately NOT err.message — that is the "Command failed: <argv>"
       string. The reason lives in the envelope on stdout, or in stderr when
       the binary died before emitting one. */
    const envelope = safeParse(err.stdout);
    const reason = envelope?.result || String(err.stderr || '').trim()
      || (err.signal === 'SIGTERM' ? `timed out after ${Math.round(timeoutMs / 1000)}s` : `exited with code ${err.status}`);
    throw new Error(clip(reason));
  }

  const envelope = safeParse(stdout);
  if (!envelope) throw new Error(clip(`unparseable output: ${String(stdout).slice(0, 200)}`));
  if (envelope.is_error) throw new Error(clip(String(envelope.result ?? 'the binary reported is_error with no result')));
  return envelope;
}

function safeParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/* ai_notes is rendered verbatim in the review UI, so it has to stay a
   sentence, not a transcript. */
function clip(text, max = 300) {
  const one = String(text).replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max)}...` : one;
}

/* Analyzes candidates in batches.
   Returns Map<candidateId, {proposal, model, notes}>. Never throws — a failed
   analysis must degrade to "queued undrafted for manual review".

   WHY BATCHES AND NOT ONE CALL. Each invocation carries Claude Code's full
   system context (~$0.07 even for a trivial prompt), so one call per candidate
   is the wrong shape. But one call for ALL of them is all-or-nothing: a single
   failure — a timeout, a transient error — left every pending candidate
   undrafted, which is exactly what happened. Chunking costs one system context
   per chunk and buys partial progress: a chunk that fails takes only its own
   records down with it, and the rest still get drafted. */
export async function analyzeBatchWithClaudeCode(candidates, {
  timeoutMs = 15 * 60 * 1000,
  chunkSize = Number(process.env.SSCIM_AI_CHUNK) || 8,
  onProgress = () => {},
} = {}) {
  const results = new Map();
  if (!claudeCodeAvailable() || !candidates.length) return results;

  const ids = vaultIds();
  const chunks = [];
  for (let i = 0; i < candidates.length; i += chunkSize) chunks.push(candidates.slice(i, i + chunkSize));

  for (const [index, chunk] of chunks.entries()) {
    const payload = chunk.map((c) => ({
      candidateId: c.id, feed: c.sourceFeed, date: c.dateISO, record: c.raw,
    }));

    let envelope;
    try {
      envelope = invoke(buildPrompt(payload, ids), timeoutMs);
    } catch (err) {
      onProgress({ chunk: index + 1, of: chunks.length, ok: false, error: err.message });
      for (const c of chunk) {
        results.set(c.id, { proposal: null, model: 'claude-code', notes: `Claude Code analysis failed: ${err.message}` });
      }
      continue;
    }

    const parsed = extractJson(envelope.result);
    const list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    const byId = new Map(list.filter((p) => p?.candidateId).map((p) => [p.candidateId, p]));

    const model = envelope.modelUsage ? Object.keys(envelope.modelUsage)[0] : 'claude-code';
    const costNote = envelope.total_cost_usd != null ? ` (batch cost ~$${Number(envelope.total_cost_usd).toFixed(3)})` : '';
    const chunkResults = chunk.map((c) => {
      const p = byId.get(c.id);
      return p
        ? { id: c.id, proposal: p, model, notes: p.relevant ? p.uncertainty : `Judged not relevant: ${p.irrelevantReason}` }
        : { id: c.id, proposal: null, model, notes: `No proposal returned for this record${costNote}.` };
    });
    for (const r of chunkResults) results.set(r.id, { proposal: r.proposal, model: r.model, notes: r.notes });

    /* Results are handed over per chunk, not just returned at the end. A caller
       that persists them here keeps the work a completed chunk already paid
       for; without it, chunking still loses everything if the run is
       interrupted on the last one, which defeats the point of chunking. */
    onProgress({ chunk: index + 1, of: chunks.length, ok: true, drafted: byId.size, of_chunk: chunk.length, cost: envelope.total_cost_usd, results: chunkResults });
  }
  return results;
}
