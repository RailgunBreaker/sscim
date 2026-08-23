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
   README 4.8 describe — that event semantics are hand-curated. It is enabled
   deliberately and it is bounded: only High confidence, only when the drafter
   flagged no duplicate, and never for a record with no draft. Every row it
   creates is stamped reviewed_by='auto-triage', so
   `SELECT * FROM event_candidates WHERE reviewed_by='auto-triage'` is the
   complete list of what went in unattended, and untriage() reverses it.
   Set SSCIM_TRIAGE_AUTO_APPROVE=off to fall back to review-everything-relevant.
   ────────────────────────────────────────────────────────────────────────── */

export const AUTO_APPROVE_ON = (process.env.SSCIM_TRIAGE_AUTO_APPROVE ?? 'on').toLowerCase() !== 'off';
export const AUTO_REJECT_ON = (process.env.SSCIM_TRIAGE_AUTO_REJECT ?? 'on').toLowerCase() !== 'off';

export const TRIAGE_ACTOR = 'auto-triage';

export const VERDICTS = {
  AUTO_APPROVE: 'auto-approve',
  AUTO_REJECT: 'auto-reject',
  REVIEW: 'review',
};

/* Decide what happens to one candidate. Pure — no database, no side effects —
   so the preview endpoint and the apply path cannot disagree about what would
   happen. Returns { verdict, reason }. */
export function classify(candidate) {
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
    if (!AUTO_REJECT_ON) {
      return { verdict: VERDICTS.REVIEW, reason: 'Auto-reject is disabled (SSCIM_TRIAGE_AUTO_REJECT=off).' };
    }
    return { verdict: VERDICTS.AUTO_REJECT, reason: p.irrelevantReason || 'Judged not a supply-chain event.' };
  }

  if (!AUTO_APPROVE_ON) {
    return { verdict: VERDICTS.REVIEW, reason: 'Relevant — auto-approve is disabled (SSCIM_TRIAGE_AUTO_APPROVE=off).' };
  }

  if (confidence !== 'High') {
    return { verdict: VERDICTS.REVIEW, reason: `Relevant at ${confidence} confidence — a person decides.` };
  }

  return {
    verdict: VERDICTS.AUTO_APPROVE,
    reason: `High confidence, sev ${p.proposedSev} ${p.proposedDirection}/${p.proposedChannel}, ${p.proposedOperational ? 'scored' : 'excluded from score'}.`,
  };
}

/* Groups a candidate list by verdict, preserving order within each group. */
export function partition(candidateList) {
  const groups = { [VERDICTS.AUTO_APPROVE]: [], [VERDICTS.AUTO_REJECT]: [], [VERDICTS.REVIEW]: [] };
  for (const candidate of candidateList) {
    const { verdict, reason } = classify(candidate);
    groups[verdict].push({ ...candidate, triage: { verdict, reason } });
  }
  return groups;
}
