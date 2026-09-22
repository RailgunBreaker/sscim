import { it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPilotAudit } from '../../../server/src/pilot-audit.js';
import { archiveFiling, readArchivedFiling } from '../../../server/src/filing-archive.js';
import { filingAuditScore } from './filingAudit.js';
const Database = createRequire(new URL('../../../server/package.json', import.meta.url))('better-sqlite3');
const opened = [];
afterEach(() => opened.splice(0).forEach(db => db.close()));
function fixture() {
  const db = new Database(':memory:'); opened.push(db);
  db.exec('CREATE TABLE pilot_collection_runs (digest TEXT PRIMARY KEY, payload TEXT)');
  const check = { companyId: 'wdc', publicationDate: '2026-08-14', status: 'retrieved', hashBasis: 'utf8_decoded_text' };
  const collection = { checkedAt: '2026-09-20T10:00:00Z', detectorVersion: 'test-detector', detectorSha256: 'f'.repeat(64), checks: [
    { ...check, url: 'https://example.com/positive', sourceSha256: 'a'.repeat(64), candidateId: 'match' },
    { ...check, url: 'https://example.com/negative', sourceSha256: 'b'.repeat(64), candidateId: null },
    { ...check, url: 'https://example.com/control', sourceSha256: 'c'.repeat(64), candidateId: 'control', discoveryKind: 'historical_reference' },
  ] };
  db.prepare('INSERT INTO pilot_collection_runs VALUES (?,?)').run('run', JSON.stringify(collection));
  let available = true, drafts = { records: [] };
  const audit = createPilotAudit(db, () => '2026-09-20T12:00:00Z', hash => {
    if (!available) throw new Error('Archive missing');
    return { sourceSha256: hash, text: 'Contamination caused lost production. Insurance recovery was reported.' };
  }, () => drafts);
  const batch = audit.freeze('run', { activatedAt: '2026-09-19T15:00:00Z' });
  const input = (i, extras = {}) => ({ requestId: randomUUID(), batchId: batch.id, caseId: batch.cases[i].id,
    sourceSha256: batch.cases[i].sourceSha256, label: 'relevant', reviewerId: 'Test reviewer', reviewerKind: 'external_human',
    independenceDeclared: true, reportReference: 'test-report-1', evidenceSection: 'Test section',
    rationale: 'Fixture judgment only', quote: 'Contamination caused lost production.', expectedVersion: 0, ...extras });
  return { audit, batch, input, db, collection, unavailable: () => { available = false; }, setDrafts: records => { drafts = { records }; } };
}
it('freezes the full run once, separates historical controls, and survives later collection changes', () => {
  const { audit, batch, db, collection } = fixture();
  expect(audit.freeze('run', { activatedAt: '2026-09-19T15:00:00Z' })).toEqual(batch);
  expect(audit.snapshot()[0].score).toMatchObject({ total: 2, controls: 1, accuracy: null, recall: null });
  collection.checks.pop(); db.prepare('UPDATE pilot_collection_runs SET payload=?').run(JSON.stringify(collection));
  expect(audit.snapshot()[0].cases).toHaveLength(3);
  expect(() => audit.freeze('run', null)).toThrow('Activate');
});
it('withholds metrics for partial, operator and AI labels, and reports only census agreement after qualifying reviews', () => {
  const { audit, input } = fixture();
  audit.label(input(0, { reviewerKind: 'ai_assisted', independenceDeclared: false }));
  audit.label(input(1, { label: 'not_relevant', quote: '', reviewerKind: 'operator_human', independenceDeclared: false }));
  expect(audit.snapshot()[0].score).toMatchObject({ labeled: 2, qualified: 0, complete: false, confusion: null, accuracy: null });
  expect(audit.snapshot()[0].score).toMatchObject({ externalReviewNeeded: 2,
    reviewOrigins: { ai_assisted: 1, operator_human: 1, external_human: 0 },
    judgments: { relevant: 1, not_relevant: 1, uncertain: 0 } });
  audit.label(input(0, { expectedVersion: 1 }));
  expect(audit.snapshot()[0].score.accuracy).toBeNull();
  audit.label(input(1, { label: 'not_relevant', quote: '', expectedVersion: 1 }));
  expect(audit.snapshot()[0].score).toMatchObject({ accuracy: 1, precision: 1, recall: 1, independentlyValidatedAccuracy: null });
  expect(audit.snapshot()[0].score).toMatchObject({ externalReviewNeeded: 0,
    reviewOrigins: { ai_assisted: 0, operator_human: 0, external_human: 2 } });
  expect(audit.snapshot()[0].labels).toHaveLength(4);
});
it('includes false negatives from unmatched filings and excludes the deliberately selected control', () => {
  const { audit, input } = fixture();
  audit.label(input(0, { label: 'not_relevant', quote: '' }));
  audit.label(input(1));
  expect(audit.snapshot()[0].score).toMatchObject({ accuracy: 0, precision: 0, recall: 0,
    confusion: { truePositive: 0, falsePositive: 1, trueNegative: 0, falseNegative: 1 } });
});
it('rejects stale edits, altered retries, missing archives and unsupported evidence text', () => {
  const { audit, input, unavailable } = fixture();
  const r = input(0); const saved = audit.label(r);
  expect(audit.label(r)).toEqual(saved);
  expect(() => audit.label({ ...r, rationale: 'Changed retry' })).toThrow('already used');
  expect(() => audit.label(input(0))).toThrow('Judgment changed');
  expect(() => audit.label(input(1, { quote: 'Not in the source' }))).toThrow('does not match');
  expect(() => audit.label(input(1, { reviewerKind: 'ai_assisted' }))).toThrow('external human');
  expect(() => audit.label(input(1, { reportReference: '' }))).toThrow('report reference');
  unavailable();
  expect(() => audit.label(input(1))).toThrow('Archive missing');
  expect(audit.snapshot()[0].labels).toHaveLength(1);
});
it('keeps unavailable and uncertain cases in the denominator and avoids undefined ratios', () => {
  const { audit, input, batch } = fixture();
  audit.label(input(0, { label: 'uncertain', quote: '' }));
  audit.label(input(1, { label: 'not_relevant', quote: '' }));
  const report = audit.snapshot()[0];
  expect(report.score).toMatchObject({ total: 2, uncertain: 1, accuracy: null });
  const cases = batch.cases.filter(c => !c.control).map(c => ({ ...c, matched: false }));
  const labels = cases.map(c => ({ ...input(0), caseId: c.id, sourceSha256: c.sourceSha256, sourceIntegrityVerified: true, label: 'not_relevant' }));
  expect(filingAuditScore({ cases }, labels)).toMatchObject({ accuracy: 1, precision: null, recall: null });
  cases[1].status = 'unavailable';
  expect(filingAuditScore({ cases }, labels)).toMatchObject({ unavailable: 1, accuracy: null });
});
it('refuses older collection snapshots without detector provenance', () => {
  const { audit, db } = fixture();
  db.prepare('INSERT INTO pilot_collection_runs VALUES (?,?)').run('old', JSON.stringify({ checks: [] }));
  expect(() => audit.freeze('old', { activatedAt: '2026-09-19T00:00:00Z' })).toThrow('detector provenance');
});
it('archives exact decoded source content, serves text only, and detects corruption and path traversal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sscim-filing-audit-'));
  const record = archiveFiling('<html><script>unsafe()</script><p>Filing evidence.</p></html>', dir);
  const path = join(dir, `${record.sourceSha256}.html`);
  try {
    expect(readArchivedFiling(record.sourceSha256, dir).text).toBe('Filing evidence.');
    expect(() => readArchivedFiling('../other-file', dir)).toThrow('Invalid');
    writeFileSync(path, 'tampered');
    expect(() => readArchivedFiling(record.sourceSha256, dir)).toThrow('integrity');
  } finally { unlinkSync(path); rmdirSync(dir); }
});
it('shows source-bound AI drafts without converting them to judgments or external validation', () => {
  const { audit, batch, input, setDrafts } = fixture();
  const draft = { ...input(0), preparedAt: '2026-09-20T13:00:00Z', proposedLabel: 'not_relevant', reviewerKind: 'external_human' };
  setDrafts([draft]);
  const result = audit.snapshot()[0];
  expect(result.screeningDrafts).toHaveLength(1);
  expect(result.screeningDrafts[0]).toMatchObject({ status: 'unscored_draft', reviewerKind: 'ai_assisted', independentOutcomeLabel: false });
  expect(result.labels).toHaveLength(0);
  expect(result.score).toMatchObject({ labeled: 0, pending: 2, externalReviewNeeded: 2, accuracy: null });
  expect(result.screeningDrafts[0].caseId).toBe(batch.cases[0].id);
});
it('withholds drafts with mismatched source fingerprints or unsupported excerpts', () => {
  const { audit, input, setDrafts } = fixture();
  const draft = { ...input(0), preparedAt: '2026-09-20T13:00:00Z', proposedLabel: 'not_relevant' };
  for (const changes of [{ sourceSha256: 'f'.repeat(64) }, { quote: 'Unsupported text' }]) {
    setDrafts([{ ...draft, ...changes }]);
    const result = audit.snapshot()[0];
    expect(result.screeningDrafts).toHaveLength(0);
    expect(result.screeningDraftError).toContain('withheld');
    expect(result.labels).toHaveLength(0);
  }
});
function response(f, reviews = [f.input(0), f.input(1, { label: 'not_relevant', quote: '' })]) {
  const packet = f.audit.handoff(f.batch.id);
  return { ...packet.responseTemplate, reviews, requestId: randomUUID() };
}
it('exports source-only handoffs without detector outcomes, drafts, controls or earlier judgments', () => {
  const f = fixture(); f.audit.label(f.input(0));
  const packet = f.audit.handoff(f.batch.id);
  expect(packet.cases).toHaveLength(2);
  expect(packet.cases.every(c => c.sourceText && c.sourceSha256)).toBe(true);
  expect(packet).not.toHaveProperty('labels');
  expect(packet).not.toHaveProperty('screeningDrafts');
  expect(packet.cases[0]).not.toHaveProperty('matched');
  expect(packet.cases[0]).not.toHaveProperty('control');
  expect(packet.responseTemplate.reviews[0]).toMatchObject({ expectedVersion: 1, reviewerId: '', reviewerKind: '', independenceDeclared: false });
  expect(packet.responseTemplate.reviews[0]).not.toHaveProperty('rationale', 'Fixture judgment only');
});
it('previews a response without writes, then imports atomically and safely replays a retry', () => {
  const f = fixture(), payload = response(f);
  expect(f.audit.importReviews(payload, { preview: true }).count).toBe(2);
  expect(f.audit.snapshot()[0].labels).toHaveLength(0);
  expect(f.audit.snapshot()[0].importHistory).toHaveLength(0);
  const imported = f.audit.importReviews(payload);
  expect(imported.alreadyImported).toBe(false);
  expect(f.audit.importReviews(payload).alreadyImported).toBe(true);
  expect(f.audit.snapshot()[0].labels).toHaveLength(2);
  expect(f.audit.snapshot()[0].importHistory).toHaveLength(1);
  expect(f.audit.snapshot()[0].score.complete).toBe(true);
  expect(() => f.audit.importReviews({ ...payload, reviews: [payload.reviews[0]] })).toThrow('already used');
});
it('rolls back an entire import if any record is stale and rechecks a preview before commit', () => {
  const f = fixture(), payload = response(f);
  f.audit.importReviews(payload, { preview: true });
  f.audit.label(f.input(1, { label: 'uncertain', quote: '' }));
  expect(() => f.audit.importReviews(payload)).toThrow('Judgment changed');
  const saved = f.audit.snapshot()[0];
  expect(saved.labels).toHaveLength(1);
  expect(saved.labels[0].caseId).toBe(f.batch.cases[1].id);
  expect(saved.importHistory).toHaveLength(0);
});
it('rejects wrong packages, duplicate cases, hidden controls and blank returned templates', () => {
  const f = fixture(), payload = response(f);
  expect(() => f.audit.importReviews({ ...payload, packageId: 'wrong' })).toThrow('frozen audit');
  expect(() => f.audit.importReviews(response(f, [f.input(0), f.input(0)]))).toThrow('Duplicate');
  expect(() => f.audit.importReviews(response(f, [f.input(2)]))).toThrow('control');
  expect(() => f.audit.importReviews({ ...f.audit.handoff(f.batch.id).responseTemplate, requestId: randomUUID() })).toThrow('Reviewer identity');
  expect(f.audit.snapshot()[0].labels).toHaveLength(0);
});
it('allows partial responses while retaining unresolved cases in the review backlog', () => {
  const f = fixture();
  f.audit.importReviews(response(f, [f.input(0)]));
  expect(f.audit.snapshot()[0].score).toMatchObject({ labeled: 1, externalReviewNeeded: 1, accuracy: null });
  const packet = f.audit.handoff(f.batch.id);
  expect(packet.responseTemplate.reviews.map(r => r.expectedVersion)).toEqual([1, 0]);
});
