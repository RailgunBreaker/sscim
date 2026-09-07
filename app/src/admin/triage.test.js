/* Rules for the review queue's automatic triage.

   These live in server/src/triage.js but are tested here because `app` owns
   the only vitest runner, and this is the gate the pipeline actually runs.
   The module is deliberately pure — no database, no imports — so reaching
   across the directory boundary costs nothing at test time.

   What is being pinned down: AUTO_APPROVE writes into `events` and appends to
   event-assumptions.js with no human involved. Every boundary that keeps that
   narrow is asserted below, because a loosened threshold here is invisible
   until it has already put something into the scored index.

   AND THE DEFAULT ITSELF. Auto-approval used to be on unless explicitly
   disabled, which meant a fresh checkout published events unattended — while
   approveCandidate() stamped every row "AI-drafted, human-reviewed". It is
   now OPT-IN. That is asserted here rather than left to documentation,
   because the environment variable is the only thing standing between the
   news feed and the public dataset.

   The switches are pure predicates over an environment VALUE, and classify()
   takes them as options, so both settings are testable directly instead of by
   reloading the module under a mutated process.env — which vitest's bundler
   cannot do anyway. */
import { describe, it, expect } from 'vitest';
import {
  classify, partition, VERDICTS, autoApproveEnabled, autoRejectEnabled,
  AUTO_APPROVE_ON, AUTO_REJECT_ON,
  PROVENANCE, provenanceFor, provenanceLabel, TRIAGE_ACTOR,
} from '../../../server/src/triage.js';

const candidate = (proposal, extra = {}) => ({ id: 'cand_x', duplicate_of: null, proposal, ...extra });

const relevant = (over = {}) => ({
  relevant: true, confidence: 'High', evidenceStatus: 'quoted_input_requires_review', evidenceKind: 'observed', proposedSev: 6, proposedDirection: 'adverse',
  proposedChannel: 'downstream', proposedOperational: true, irrelevantReason: '', ...over,
});

const irrelevant = (over = {}) => ({
  relevant: false, confidence: 'High', irrelevantReason: 'Stock commentary, not a supply-chain event.', ...over,
});

const ON = { autoApprove: true, autoReject: true };

describe('automatic approval is opt-in', () => {
  it('is off when the environment variable is absent or empty', () => {
    expect(autoApproveEnabled(undefined)).toBe(false);
    expect(autoApproveEnabled(null)).toBe(false);
    expect(autoApproveEnabled('')).toBe(false);
  });

  it('is on only for an explicit yes', () => {
    for (const v of ['on', 'ON', ' on ', 'true', '1', 'yes']) {
      expect(autoApproveEnabled(v), `"${v}" should enable it`).toBe(true);
    }
  });

  /* An allow-list, not `!== 'off'`: a typo in the environment must fail
     safe rather than silently enabling unattended publication. */
  it('fails safe on anything that is not an explicit yes', () => {
    for (const v of ['off', 'no', 'false', '0', 'ON_MAYBE', 'enabled', 'yes please']) {
      expect(autoApproveEnabled(v), `"${v}" must not enable auto-approval`).toBe(false);
    }
  });

  /* The default the repository actually ships with. This is the assertion
     that would fail if someone flipped it back. */
  it('is off in this process, because nothing opted in', () => {
    expect(AUTO_APPROVE_ON).toBe(autoApproveEnabled(process.env.SSCIM_TRIAGE_AUTO_APPROVE));
    if (!process.env.SSCIM_TRIAGE_AUTO_APPROVE) expect(AUTO_APPROVE_ON).toBe(false);
  });

  it('leaves a relevant, High-confidence candidate pending for a human when off', () => {
    const out = classify(candidate(relevant()), { autoApprove: false, autoReject: true });
    expect(out.verdict).toBe(VERDICTS.REVIEW);
    expect(out.reason).toMatch(/human review/i);
  });

  it('approves that same candidate once opted in', () => {
    expect(classify(candidate(relevant()), ON).verdict).toBe(VERDICTS.AUTO_APPROVE);
  });
});

describe('automatic rejection is configured separately', () => {
  it('defaults off, but can be enabled independently', () => {
    expect(autoRejectEnabled(undefined)).toBe(false);
    expect(AUTO_REJECT_ON).toBe(autoRejectEnabled(process.env.SSCIM_TRIAGE_AUTO_REJECT));
    expect(classify(candidate(irrelevant()), { autoApprove: false, autoReject: true }).verdict)
      .toBe(VERDICTS.AUTO_REJECT);
  });

  it('can be turned off on its own', () => {
    expect(autoRejectEnabled('off')).toBe(false);
    expect(classify(candidate(irrelevant()), { autoApprove: true, autoReject: false }).verdict)
      .toBe(VERDICTS.REVIEW);
  });
});

describe('triage provenance', () => {
  it('calls an unattended approval automatic, and never invents a reviewer', () => {
    expect(provenanceFor(TRIAGE_ACTOR)).toBe(PROVENANCE.AUTOMATIC);
    expect(provenanceLabel(PROVENANCE.AUTOMATIC)).toMatch(/not human-reviewed/i);
  });

  it('calls a person-made approval human, and says so', () => {
    expect(provenanceFor('admin-ui')).toBe(PROVENANCE.HUMAN);
    expect(provenanceLabel(PROVENANCE.HUMAN)).toMatch(/human-reviewed/i);
    expect(provenanceLabel(PROVENANCE.HUMAN)).not.toMatch(/not human-reviewed/i);
  });

  it('reports unknown provenance as unrecorded rather than upgrading it', () => {
    expect(provenanceLabel(PROVENANCE.LEGACY)).toMatch(/not recorded/i);
    expect(provenanceLabel('nonsense')).toMatch(/not recorded/i);
  });
});

describe('triage.classify (with auto-approval enabled)', () => {
  it('keeps stored legacy and forecast drafts out of automatic operational approval', () => {
    for (const evidenceKind of [undefined, 'forecast', 'unknown']) {
      expect(classify(candidate(relevant({ evidenceKind })), ON).verdict).toBe(VERDICTS.REVIEW);
    }
  });
  it('auto-approves a relevant, High-confidence, unflagged candidate', () => {
    expect(classify(candidate(relevant()), ON).verdict).toBe(VERDICTS.AUTO_APPROVE);
  });

  it('auto-rejects a confident not-an-event and carries its reason through', () => {
    const out = classify(candidate(irrelevant()), ON);
    expect(out.verdict).toBe(VERDICTS.AUTO_REJECT);
    expect(out.reason).toBe('Stock commentary, not a supply-chain event.');
  });

  it('sends Medium and Low confidence relevant records to a human', () => {
    for (const confidence of ['Medium', 'Low']) {
      expect(classify(candidate(relevant({ confidence })), ON).verdict).toBe(VERDICTS.REVIEW);
    }
  });

  /* Dropping a real disruption is the expensive error, so uncertainty about
     irrelevance is the one case that does NOT get cleared automatically. */
  it('does not auto-reject a Low-confidence not-an-event', () => {
    expect(classify(candidate(irrelevant({ confidence: 'Low' })), ON).verdict).toBe(VERDICTS.REVIEW);
  });

  it('never auto-decides a candidate with no draft', () => {
    expect(classify(candidate(null), ON).verdict).toBe(VERDICTS.REVIEW);
  });

  /* The drafter judges each story alone and cannot know a near-identical one
     is already in the queue, so the ingest step's duplicate flag outranks it
     — including on a record it would otherwise have approved outright. */
  it('never auto-decides a flagged possible duplicate', () => {
    expect(classify(candidate(relevant(), { duplicate_of: 'cand_other' }), ON).verdict).toBe(VERDICTS.REVIEW);
    expect(classify(candidate(irrelevant(), { duplicate_of: 'cand_other' }), ON).verdict).toBe(VERDICTS.REVIEW);
  });

  it('treats a missing confidence as Low rather than assuming High', () => {
    expect(classify(candidate(relevant({ confidence: undefined })), ON).verdict).toBe(VERDICTS.REVIEW);
    expect(classify(candidate(irrelevant({ confidence: undefined })), ON).verdict).toBe(VERDICTS.REVIEW);
  });
});

describe('triage.partition', () => {
  const list = () => ([
    { id: 'a', duplicate_of: null, proposal: relevant() },
    { id: 'b', duplicate_of: null, proposal: irrelevant() },
    { id: 'c', duplicate_of: null, proposal: relevant({ confidence: 'Low' }) },
    { id: 'd', duplicate_of: null, proposal: null },
  ]);

  it('routes every candidate to exactly one group and tags it with its reason', () => {
    const groups = partition(list(), ON);
    expect(groups[VERDICTS.AUTO_APPROVE].map((c) => c.id)).toEqual(['a']);
    expect(groups[VERDICTS.AUTO_REJECT].map((c) => c.id)).toEqual(['b']);
    expect(groups[VERDICTS.REVIEW].map((c) => c.id)).toEqual(['c', 'd']);

    const total = Object.values(groups).flat();
    expect(total).toHaveLength(4);
    for (const c of total) expect(c.triage.reason).toBeTruthy();
  });

  /* At the shipped default nothing is approved unattended: the approvable
     candidate joins the review group instead. */
  it('approves nothing at the default setting', () => {
    const groups = partition(list(), { autoApprove: false, autoReject: true });
    expect(groups[VERDICTS.AUTO_APPROVE]).toEqual([]);
    expect(groups[VERDICTS.REVIEW].map((c) => c.id)).toEqual(['a', 'c', 'd']);
  });
});
