/* ====================================================================
   repair-event-provenance.mjs — one-time, idempotent repair of three
   defects in already-published event rows.

   Run:  node scripts/repair-event-provenance.mjs [--dry-run]

   1. PROVENANCE. Every event approved through the review queue had
      "AI-drafted, human-reviewed" written into its `source`, including
      the ones automatic triage approved with nobody in the loop. The
      candidate table records who actually decided each one
      (event_candidates.reviewed_by, linked by event_id), so provenance is
      derived from that fact rather than guessed — and where there is no
      link at all, the row is marked 'legacy' or 'curated' rather than
      being upgraded to a claim the record cannot support.

      No reviewer identity is invented anywhere in this script.

   2. PUBLIC NOTES. Eight events carried the review workflow's own
      bookkeeping in their public `detail` field, in the form
      "Reviewer note: Published: Review: reject cand_webz_news_04f59e...".
      That put internal candidate ids and the literal approve/reject
      commands onto public event cards. The internal line is replaced with
      the curated public classification note for that event (from
      app/src/engine/event-assumptions.js, which has been rewritten with
      real rationales); where none exists, with a truthful stand-in. The
      audit trail is untouched — it still lives in event_candidates,
      behind the admin token.

   3. INCIDENT GROUPING. The July 2026 M7.1 Kumamoto earthquake is
      represented by eight records. They are grouped here so the interface
      can say which is the scored primary and which are updates or
      recovery reports. Nothing is deleted: every source, url and
      assessment stays exactly as published.

   Idempotent by construction — every write is conditional on the row not
   already being in its target state, so re-running changes nothing.
   ==================================================================== */

import '../src/load-env.js';
import { db } from '../src/db.js';
import { PROVENANCE, provenanceLabel, TRIAGE_ACTOR } from '../src/triage.js';
import { looksInternal } from '../src/review-queue.js';
import { EVENT_INCIDENTS, publicClassificationNote } from '../../app/src/engine/event-assumptions.js';

const DRY = process.argv.includes('--dry-run');
const changes = [];
const note = (kind, id, detail) => changes.push({ kind, id, detail });

/* ---- 1. provenance ------------------------------------------------ */
const reviewerOf = new Map(
  db.prepare("SELECT event_id, reviewed_by FROM event_candidates WHERE event_id IS NOT NULL AND status = 'approved'")
    .all().map((r) => [r.event_id, r.reviewed_by]),
);

/* Most approved events predate event_candidates.event_id, so the direct
   link is null for them. They are still attributable, because
   approveCandidate() writes the candidate's own url into the event's
   `source`: matching on that url recovers which candidate — and therefore
   which reviewer — produced the row. That is a factual join on a value
   both rows already carry, not an inference.

   It is deliberately strict: only an UNAMBIGUOUS single approved match
   counts. Two candidates matching one url would mean the join is not
   identifying, and a guess there would be exactly the kind of invented
   provenance this script exists to remove. */
const approvedCandidates = db.prepare("SELECT id, reviewed_by, source_ref, raw_json FROM event_candidates WHERE status = 'approved'")
  .all().map((c) => {
    let url = null;
    try { url = JSON.parse(c.raw_json)?.url || null; } catch { url = null; }
    return { ...c, url };
  });

function reviewerByUrl(source) {
  if (!source) return null;
  const hits = approvedCandidates.filter((c) => (c.url && source.includes(c.url))
    || (c.source_ref && c.source_ref.length > 8 && source.includes(c.source_ref)));
  const reviewers = [...new Set(hits.map((h) => h.reviewed_by).filter(Boolean))];
  return reviewers.length === 1 ? reviewers[0] : null;
}

const events = db.prepare('SELECT id, source, detail, provenance, reviewed_by FROM events').all();

for (const e of events) {
  const reviewer = reviewerOf.get(e.id) || reviewerByUrl(e.source) || null;
  let provenance;
  if (reviewer === TRIAGE_ACTOR) provenance = PROVENANCE.AUTOMATIC;
  else if (reviewer) provenance = PROVENANCE.HUMAN;
  else if (/AI-drafted/i.test(e.source || '')) {
    /* Came through the queue but the candidate link predates the
       event_id column. It was reviewed by somebody; which is unrecorded,
       so say so rather than claiming either answer. */
    provenance = PROVENANCE.LEGACY;
  } else {
    /* Never in the queue — hand-authored in seed-data.js. */
    provenance = PROVENANCE.CURATED;
  }

  if (e.provenance !== provenance || e.reviewed_by !== reviewer) {
    note('provenance', e.id, `${e.provenance || 'unset'} -> ${provenance}${reviewer ? ` (${reviewer})` : ''}`);
    if (!DRY) db.prepare('UPDATE events SET provenance = ?, reviewed_by = ? WHERE id = ?').run(provenance, reviewer, e.id);
  }

  /* The prose clause has to agree with the column. An automatic approval
     must not keep asserting "human-reviewed". */
  if (/AI-drafted/i.test(e.source || '')) {
    const want = provenanceLabel(provenance);
    const fixed = (e.source || '').replace(/-\s*AI-drafted[^)]*$/i, `- ${want}`);
    if (fixed !== e.source && !e.source.endsWith(want)) {
      note('source', e.id, want);
      if (!DRY) db.prepare('UPDATE events SET source = ? WHERE id = ?').run(fixed, e.id);
    }
  }
}

/* ---- 2. internal notes in the public detail field ------------------ */
for (const e of events) {
  const detail = e.detail || '';
  if (!looksInternal(detail)) continue;

  /* Only the trailing reviewer-note block is workflow text; the body
     above it is the source-supported reporting and is kept verbatim. */
  const at = detail.search(/\n+\s*(Reviewer note|Classification note):/);
  const body = at >= 0 ? detail.slice(0, at).trimEnd() : detail;
  if (looksInternal(body)) {
    note('SKIPPED', e.id, 'internal text is inside the reporting body, not the note block — needs a human');
    continue;
  }
  const replacement = `${body}\n\nClassification note: ${publicClassificationNote(e.id)}`;
  note('detail', e.id, 'internal reviewer note replaced with the public classification note');
  if (!DRY) db.prepare('UPDATE events SET detail = ? WHERE id = ?').run(replacement, e.id);
}

/* ---- 2b. the "Reviewer note:" label -------------------------------- */
/* The label itself is a provenance claim. approveCandidate used to prefix
   every published rationale with "Reviewer note:", including on rows
   automatic triage approved with nobody in the loop — so a public event
   card asserted a person had reviewed it. New approvals write
   "Classification note:"; these are the rows that predate that. The
   rationale below the label is kept verbatim; only the label changes. */
for (const e of db.prepare('SELECT id, detail FROM events').all()) {
  if (!/\bReviewer note:/.test(e.detail || '')) continue;
  const fixed = e.detail.replace(/\bReviewer note:/g, 'Classification note:');
  note('label', e.id, 'Reviewer note -> Classification note');
  if (!DRY) db.prepare('UPDATE events SET detail = ? WHERE id = ?').run(fixed, e.id);
}

/* ---- 3. incident grouping ------------------------------------------ */
const known = new Set(events.map((e) => e.id));
for (const [id, { incident, role }] of Object.entries(EVENT_INCIDENTS)) {
  if (!known.has(id)) { note('SKIPPED', id, 'incident member is not in the events table'); continue; }
  const row = db.prepare('SELECT incident_id, incident_role FROM events WHERE id = ?').get(id);
  if (row.incident_id === incident && row.incident_role === role) continue;
  note('incident', id, `${incident} / ${role}`);
  if (!DRY) db.prepare('UPDATE events SET incident_id = ?, incident_role = ? WHERE id = ?').run(incident, role, id);
}

if (!DRY) db.pragma('wal_checkpoint(TRUNCATE)');

const byKind = changes.reduce((a, c) => { (a[c.kind] ||= []).push(c); return a; }, {});
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n${kind} (${list.length}):`);
  list.forEach((c) => console.log(`  ${c.id}: ${c.detail}`));
}
console.log(`\n${DRY ? '[dry run] would change' : 'changed'} ${changes.length} field(s) across ${new Set(changes.map((c) => c.id)).size} event(s).`);

/* A publish gate, not just a report: if anything internal is still in a
   public field after the repair, say so loudly and exit non-zero. */
const stillLeaking = db.prepare('SELECT id, detail, source FROM events').all()
  .filter((e) => looksInternal(e.detail) || looksInternal(e.source));
if (stillLeaking.length && !DRY) {
  console.error(`\nFAILED: ${stillLeaking.length} event(s) still carry internal review text: ${stillLeaking.map((e) => e.id).join(', ')}`);
  process.exit(1);
}
