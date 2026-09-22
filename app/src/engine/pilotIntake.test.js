import { it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPilotStore } from '../../../server/src/pilot-store.js';
import { loadPilotIntake, buildPilotIntake } from '../../../server/src/pilot-intake.js';
const opened = [];
afterEach(() => opened.splice(0).forEach(s => s.close()));
function fixture() {
  let now = '2026-09-19T12:00:00.000Z', source = structuredClone(loadPilotIntake()), unavailable = false;
  const store = createPilotStore(':memory:', id => id === 'tsmc', () => now, () => { if (unavailable) throw new Error('Collection file missing'); return source; });
  opened.push(store);
  return { store, source, advance: value => { now = value; }, fail: () => { unavailable = true; } };
}
function decision(c, choice = 'investigate') {
  return { candidateId: c.id, revision: c.revision, expectedReviews: c.reviewCount, requestId: randomUUID(), decision: choice, reason: 'Review the disclosed recovery boundary.' };
}
it('activates once with three source-backed historical cases and never invents actions or deliveries', () => {
  const { store } = fixture();
  expect(store.snapshot().protocol).toBeNull();
  expect(store.snapshot().records).toHaveLength(0);
  store.activate(); store.activate();
  const result = store.snapshot();
  expect(result.records.filter(r => r.type === 'watch')).toHaveLength(3);
  expect(result.records.filter(r => r.type === 'investigation')).toHaveLength(3);
  expect(result.history).toHaveLength(6);
  expect(result.protocol.activatedAt).toBe('2026-09-19T12:00:00.000Z');
  expect(result.protocol.checkpointAt).toBe('2026-10-19T12:00:00.000Z');
  expect(result.summary).toMatchObject({ actions: 0, deliveries: 0, modelAccuracy: null });
  expect(result.evaluation).toMatchObject({ historical: 3, newlyPublished: 0, triaged: 0, accuracy: null, recall: null });
  expect(result.protocol.historicalInvestigations.every(r => r.source.sourceSha256.length === 64)).toBe(true);
});
it('keeps deferred work pending, links an existing historical case, and preserves changed decisions', () => {
  const { store, advance } = fixture(); store.activate();
  let c = store.snapshot().queue[0]; store.review(decision(c, 'defer'));
  advance('2026-09-22T12:00:00.000Z');
  expect(store.snapshot().evaluation).toMatchObject({ deferred: 1, triaged: 0, overdue: 3 });
  c = store.snapshot().queue.find(r => r.id === c.id);
  store.review(decision(c));
  const result = store.snapshot();
  expect(result.records.filter(r => r.type === 'investigation')).toHaveLength(3);
  expect(result.reviews).toHaveLength(2);
  expect(result.evaluation).toMatchObject({ triaged: 1, triagedWithinTarget: 0, overdue: 2 });
  expect(result.reviews[1]).toMatchObject({ independentOutcomeLabel: false, reviewedAt: '2026-09-22T12:00:00.000Z' });
});
it('rejects stale reviews, requeues changed source content, and safely replays a timed-out submission', () => {
  const { store, source } = fixture(); store.activate();
  const c = store.snapshot().queue[0], input = decision(c, 'dismiss');
  const first = store.review(input);
  expect(store.review(input)).toEqual(first);
  expect(() => store.review({ ...input, reason: 'Different payload' })).toThrow('already used');
  expect(() => store.review({ ...input, requestId: randomUUID() })).toThrow('Review changed');
  source.candidates.find(r => r.id === c.id).revision = 'b'.repeat(64);
  expect(store.snapshot().queue.find(r => r.id === c.id).status).toBe('pending');
  expect(() => store.review({ ...input, requestId: randomUUID(), expectedReviews: 1 })).toThrow('Source changed');
  expect(store.review(input)).toEqual(first);
  expect(store.snapshot().reviews).toHaveLength(1);
});
it('creates a new source-linked investigation atomically and does not label a historical backfill prospective', () => {
  const { store, source, advance } = fixture(); store.activate();
  advance('2026-09-21T12:00:00.000Z');
  const base = { ...source.candidates[0], discoveryKind: 'collected_filing', firstSeenAt: '2026-09-21T11:00:00.000Z', sourceUrl: 'https://example.com/test-filing' };
  source.candidates.push({ ...base, id: 'new', publicationDate: '2026-09-20', revision: 'c'.repeat(64) });
  source.candidates.push({ ...base, id: 'backfill', publicationDate: '2024-01-01', revision: 'd'.repeat(64) });
  source.candidates.push({ ...base, id: 'same_day', publicationDate: '2026-09-19', revision: 'e'.repeat(64) });
  let result = store.snapshot();
  expect(result.evaluation).toMatchObject({ historical: 5, newlyPublished: 1 });
  const c = result.queue.find(r => r.id === 'new'); store.review(decision(c));
  result = store.snapshot();
  expect(result.records.filter(r => r.type === 'investigation')).toHaveLength(4);
  const linked = store.get(result.reviews[0].investigationId);
  expect(linked.payload.sourceUrl).toBe(base.sourceUrl);
  expect(result.reviews[0].independentOutcomeLabel).toBe(false);
});
it('retains source and review history when intake fails or a candidate disappears', () => {
  const { store, source, fail } = fixture(); store.activate();
  store.review(decision(store.snapshot().queue[0], 'dismiss'));
  source.candidates = [];
  expect(store.snapshot().queue.every(c => !c.current)).toBe(true);
  fail();
  const result = store.snapshot();
  expect(result.collection.error).toContain('Collection file missing');
  expect(result.queue).toHaveLength(3);
  expect(result.reviews).toHaveLength(1);
  expect(result.evaluation.accuracy).toBeNull();
});
it('rolls back activation when historical provenance is incomplete', () => {
  const { store, source } = fixture(); source.historicalCases.pop();
  expect(() => store.activate()).toThrow('three historical');
  expect(store.snapshot().records).toHaveLength(0);
  expect(store.snapshot().protocol).toBeNull();
});
it('captures scheduled intake and unmatched checks once per run without creating reviews', () => {
  const { store, source, advance } = fixture();
  expect(store.syncIntake().status).toBe('skipped');
  expect(store.snapshot().collectionHistory).toHaveLength(0);
  store.activate();
  const initial = store.snapshot().collectionHistory[0];
  expect(initial.checks.some(c => !c.candidateId)).toBe(true);
  advance('2026-09-20T12:00:00.000Z');
  source.checkedAt = '2026-09-20T11:00:00.000Z';
  source.checks = [{ companyId: 'wdc', status: 'unavailable', url: 'https://example.com/test' }];
  store.syncIntake(); store.syncIntake();
  const result = store.snapshot();
  expect(result.collectionHistory).toHaveLength(2);
  expect(result.collectionHistory[0]).toEqual(initial);
  expect(result.collectionHistory[1].checks[0].status).toBe('unavailable');
  expect(result.reviews).toHaveLength(0);
  expect(result.records).toHaveLength(6);
});
it('uses normalized evidence for revision identity while retaining raw source provenance', () => {
  const intake = loadPilotIntake();
  const monitored = intake.candidates.find(c => c.evidenceSha256);
  const docs = intake.historicalCases.map(c => ({ id: c.documentId, url: c.sourceUrl, publicationDate: c.publicationDate,
    sha256: c.sourceSha256, hashBasis: c.hashBasis, reviewedAt: '2026-09-17', archivePath: 'test-archive', finding: c.finding }));
  const candidate = { ...monitored, sourceSha256: 'a'.repeat(64) };
  const rebuilt = buildPilotIntake({ candidates: [candidate] }, { documents: docs });
  expect(rebuilt.candidates.find(c => c.id === monitored.id).revision).toBe(monitored.revision);
  candidate.evidenceSha256 = 'f'.repeat(64);
  expect(buildPilotIntake({ candidates: [candidate] }, { documents: docs }).candidates.find(c => c.id === monitored.id).revision).not.toBe(monitored.revision);
});
