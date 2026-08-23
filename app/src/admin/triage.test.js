/* Rules for the review queue's automatic triage.

   These live in server/src/triage.js but are tested here because `app` owns
   the only vitest runner, and this is the gate the pipeline actually runs.
   The module is deliberately pure — no database, no imports — so reaching
   across the directory boundary costs nothing at test time.

   What is being pinned down: AUTO_APPROVE writes into `events` and appends to
   event-assumptions.js with no human involved. Every boundary that keeps that
   narrow is asserted below, because a loosened threshold here is invisible
   until it has already put something into the scored index. */
import { describe, it, expect } from 'vitest';
import { classify, partition, VERDICTS } from '../../../server/src/triage.js';

const candidate = (proposal, extra = {}) => ({ id: 'cand_x', duplicate_of: null, proposal, ...extra });

const relevant = (over = {}) => ({
  relevant: true, confidence: 'High', proposedSev: 6, proposedDirection: 'adverse',
  proposedChannel: 'downstream', proposedOperational: true, irrelevantReason: '', ...over,
});

const irrelevant = (over = {}) => ({
  relevant: false, confidence: 'High', irrelevantReason: 'Stock commentary, not a supply-chain event.', ...over,
});

describe('triage.classify', () => {
  it('auto-approves a relevant, High-confidence, unflagged candidate', () => {
    expect(classify(candidate(relevant())).verdict).toBe(VERDICTS.AUTO_APPROVE);
  });

  it('auto-rejects a confident not-an-event and carries its reason through', () => {
    const out = classify(candidate(irrelevant()));
    expect(out.verdict).toBe(VERDICTS.AUTO_REJECT);
    expect(out.reason).toBe('Stock commentary, not a supply-chain event.');
  });

  it('sends Medium and Low confidence relevant records to a human', () => {
    for (const confidence of ['Medium', 'Low']) {
      expect(classify(candidate(relevant({ confidence }))).verdict).toBe(VERDICTS.REVIEW);
    }
  });

  /* Dropping a real disruption is the expensive error, so uncertainty about
     irrelevance is the one case that does NOT get cleared automatically. */
  it('does not auto-reject a Low-confidence not-an-event', () => {
    expect(classify(candidate(irrelevant({ confidence: 'Low' }))).verdict).toBe(VERDICTS.REVIEW);
  });

  it('never auto-decides a candidate with no draft', () => {
    expect(classify(candidate(null)).verdict).toBe(VERDICTS.REVIEW);
  });

  /* The drafter judges each story alone and cannot know a near-identical one
     is already in the queue, so the ingest step's duplicate flag outranks it
     — including on a record it would otherwise have approved outright. */
  it('never auto-decides a flagged possible duplicate', () => {
    expect(classify(candidate(relevant(), { duplicate_of: 'cand_other' })).verdict).toBe(VERDICTS.REVIEW);
    expect(classify(candidate(irrelevant(), { duplicate_of: 'cand_other' })).verdict).toBe(VERDICTS.REVIEW);
  });

  it('treats a missing confidence as Low rather than assuming High', () => {
    expect(classify(candidate(relevant({ confidence: undefined }))).verdict).toBe(VERDICTS.REVIEW);
    expect(classify(candidate(irrelevant({ confidence: undefined }))).verdict).toBe(VERDICTS.REVIEW);
  });
});

describe('triage.partition', () => {
  it('routes every candidate to exactly one group and tags it with its reason', () => {
    const list = [
      { id: 'a', duplicate_of: null, proposal: relevant() },
      { id: 'b', duplicate_of: null, proposal: irrelevant() },
      { id: 'c', duplicate_of: null, proposal: relevant({ confidence: 'Low' }) },
      { id: 'd', duplicate_of: null, proposal: null },
    ];
    const groups = partition(list);
    expect(groups[VERDICTS.AUTO_APPROVE].map((c) => c.id)).toEqual(['a']);
    expect(groups[VERDICTS.AUTO_REJECT].map((c) => c.id)).toEqual(['b']);
    expect(groups[VERDICTS.REVIEW].map((c) => c.id)).toEqual(['c', 'd']);

    const total = Object.values(groups).flat();
    expect(total).toHaveLength(list.length);
    for (const c of total) expect(c.triage.reason).toBeTruthy();
  });
});
