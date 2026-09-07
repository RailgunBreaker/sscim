/* Automatic triage of the review queue.

   ── The problem ───────────────────────────────────────────────────────────
   The news feed is mostly not supply-chain events. A day's ingest is stock
   commentary, analyst ratings, earnings reactions, and product announcements,
   and every one of them arrived as a row a human had to open and reject by
   hand. The signal — an actual fab outage, an export control — is a few
   records buried in that.

   ── What this does ────────────────────────────────────────────────────────
   The AI draft already carries the two fields needed to sort the queue:
   `relevant` and `confidence`. Triage reads them and routes each candidate to
   one of three verdicts, so a human opens only what is genuinely undecided.

   ── What it deliberately does NOT do ──────────────────────────────────────
   It never invents a judgement of its own. Every verdict here is a
   restatement of what the draft already said, plus a threshold. The drafting
   step is where the thinking happens; this is only the routing.

   ── On auto-approval ──────────────────────────────────────────────────────
   AUTO_APPROVE writes to `events` and appends to event-assumptions.js with no
   human in the loop. That is a real change to the property analyze.mjs and
   README 4.8 describe — that event semantics are hand-curated — so it is
   OPT-IN. With SSCIM_TRIAGE_AUTO_APPROVE unset, every relevant candidate
   waits for a person; nothing reaches the public dataset unattended.

   It used to default ON, and that combined badly with approveCandidate()
   stamping "AI-drafted, human-reviewed" onto every row it wrote: a record
   approved by the machine claimed a human had read it. The default is now
   off, and the provenance is recorded structurally (events.provenance) rather
   than asserted in prose — see review-queue.js.

   Set SSCIM_TRIAGE_AUTO_APPROVE=on to enable it. It stays bounded even then:
   only High confidence, only when the drafter flagged no duplicate, never for
   a record with no draft. Every row it creates is stamped
   reviewed_by='auto-triage' and provenance='automatic', so
   `SELECT * FROM events WHERE provenance='automatic'` is the complete list of
   what went in unattended, and untriage() reverses it.

   Automatic REJECTION is configured separately and independently
   (SSCIM_TRIAGE_AUTO_REJECT, default off). The asymmetry is deliberate: a
   wrongly rejected candidate stays in the queue with its reason attached and
   costs one glance to recover, while a wrongly approved one is already
   published and already moving the index.
   ────────────────────────────────────────────────────────────────────────── */

/* Opt-in, expressed as a pure predicate so the rule can be tested without
   reloading the module under a mutated environment. An ALLOW-LIST rather
   than `!== 'off'`: absent, empty, or a typo all leave relevant candidates
   pending for a human, which is the direction this must fail in. */
export function autoApproveEnabled(value) {
  return ['on', 'true', '1', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}

/* Rejection is opt-in. Self-rated confidence has no measured recall guarantee. A wrongly
   rejected candidate stays in the queue with its reason attached and costs
   one glance to recover; a wrongly approved one is already published and
   already moving the index. The two switches are independent. */
export function autoRejectEnabled(value) {
  return autoApproveEnabled(value);
}

export const AUTO_APPROVE_ON = autoApproveEnabled(process.env.SSCIM_TRIAGE_AUTO_APPROVE);
export const AUTO_REJECT_ON = autoRejectEnabled(process.env.SSCIM_TRIAGE_AUTO_REJECT);

export const TRIAGE_ACTOR = 'auto-triage';

/* Provenance values written to events.provenance. Never a person's name for
   an unattended approval: 'automatic' is a fact about the process, and
   inventing a reviewer identity to fill the field would be exactly the
   misrepresentation this replaces. */
export const PROVENANCE = Object.freeze({
  HUMAN: 'human',
  AUTOMATIC: 'automatic',
  CURATED: 'curated',
  LEGACY: 'legacy',
});

export function provenanceFor(reviewer) {
  return reviewer === TRIAGE_ACTOR ? PROVENANCE.AUTOMATIC : PROVENANCE.HUMAN;
}

/* The human-readable provenance clause appended to an event's `source`.
   Must never say "human-reviewed" for an automatic approval. */
export function provenanceLabel(provenance) {
  return {
    [PROVENANCE.HUMAN]: 'AI-drafted, human-reviewed',
    [PROVENANCE.AUTOMATIC]: 'AI-drafted, automatically approved by triage — not human-reviewed',
    [PROVENANCE.CURATED]: 'hand-curated',
    [PROVENANCE.LEGACY]: 'provenance not recorded',
  }[provenance] || 'provenance not recorded';
}

export const VERDICTS = {
  AUTO_APPROVE: 'auto-approve',
  AUTO_REJECT: 'auto-reject',
  REVIEW: 'review',
};

/* Decide what happens to one candidate. Pure — no database, no side effects —
   so the preview endpoint and the apply path cannot disagree about what would
   happen. Returns { verdict, reason }. */
export function classify(candidate, {
  autoApprove = AUTO_APPROVE_ON,
  autoReject = AUTO_REJECT_ON,
} = {}) {
  const p = candidate.proposal;

  /* No draft means the drafting step never ran or failed for this record.
     There is nothing to route on, and approveCandidate refuses it anyway. */
  if (!p) {
    return { verdict: VERDICTS.REVIEW, reason: 'No AI draft — needs manual entry or a re-run of scripts/draft-candidates.mjs.' };
  }

  /* A near-duplicate the ingest step flagged is exactly the case a threshold
     cannot settle: the drafter judged the story on its own merits and does not
     know the other record exists. Always a human. */
  if (candidate.duplicate_of) {
    return { verdict: VERDICTS.REVIEW, reason: `Flagged as a possible duplicate of ${candidate.duplicate_of}.` };
  }

  const confidence = p.confidence || 'Low';

  if (p.relevant === false) {
    /* Low confidence in "this is not an event" is the miss that matters — a
       real disruption dropped without anyone seeing it. Those get read. */
    if (confidence === 'Low') {
      return { verdict: VERDICTS.REVIEW, reason: 'Judged not relevant, but only at Low confidence — worth a look before dropping.' };
    }
    if (!autoReject) {
      return { verdict: VERDICTS.REVIEW, reason: 'Auto-reject is disabled (SSCIM_TRIAGE_AUTO_REJECT=off).' };
    }
    return { verdict: VERDICTS.AUTO_REJECT, reason: p.irrelevantReason || 'Judged not a supply-chain event.' };
  }

  if (!autoApprove) {
    return { verdict: VERDICTS.REVIEW, reason: 'Relevant — awaiting human review. Automatic approval is opt-in and is currently off (set SSCIM_TRIAGE_AUTO_APPROVE=on to enable it).' };
  }

  if (confidence !== 'High') {
    return { verdict: VERDICTS.REVIEW, reason: `Relevant at ${confidence} confidence — a person decides.` };
  }

  if (p.proposedOperational && (p.evidenceStatus !== 'quoted_input_requires_review' || p.evidenceKind !== 'observed')) {
    return { verdict: VERDICTS.REVIEW, reason: 'Operational proposal lacks a matching source passage; human review required.' };
  }

  return {
    verdict: VERDICTS.AUTO_APPROVE,
    reason: `High confidence, sev ${p.proposedSev} ${p.proposedDirection}/${p.proposedChannel}, ${p.proposedOperational ? 'scored' : 'excluded from score'}.`,
  };
}

/* Groups a candidate list by verdict, preserving order within each group. */
export function partition(candidateList, options) {
  const groups = { [VERDICTS.AUTO_APPROVE]: [], [VERDICTS.AUTO_REJECT]: [], [VERDICTS.REVIEW]: [] };
  for (const candidate of candidateList) {
    const { verdict, reason } = classify(candidate, options);
    groups[verdict].push({ ...candidate, triage: { verdict, reason } });
  }
  return groups;
}
