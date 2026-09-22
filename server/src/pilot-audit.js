import { createHash } from 'node:crypto';
import { FILING_AUDIT_RUBRIC, filingAuditScore } from '../../app/src/engine/filingAudit.js';
import { readArchivedFiling } from './filing-archive.js';
import { readFileSync } from 'node:fs';
function readScreeningDrafts() {
  try { return JSON.parse(readFileSync(new URL('../data/private/filing-screening-drafts.json', import.meta.url), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return { records: [] }; throw new Error('AI screening draft file could not be read.'); }
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const conflict = message => Object.assign(new Error(message), { status: 409 });
const text = (v, label, max = 2000, optional = false) => {
  if (optional && (v == null || v === '')) return '';
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new Error(`${label} is required (maximum ${max} characters).`);
  return v.trim();
};
export function createPilotAudit(db, clock, readSource = readArchivedFiling, readDrafts = readScreeningDrafts) {
  db.exec(`CREATE TABLE IF NOT EXISTS pilot_audit_batches (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_audit_labels (sequence INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT UNIQUE NOT NULL, batch_id TEXT NOT NULL, case_id TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL, UNIQUE(batch_id,case_id,version));
    CREATE TABLE IF NOT EXISTS pilot_audit_imports (request_id TEXT PRIMARY KEY, content_digest TEXT NOT NULL, payload TEXT NOT NULL);`);
  const get = id => { const r = db.prepare('SELECT payload FROM pilot_audit_batches WHERE id=?').get(id); return r ? JSON.parse(r.payload) : null; };
  const labels = id => db.prepare('SELECT payload FROM pilot_audit_labels WHERE batch_id=? ORDER BY sequence').all(id).map(r => JSON.parse(r.payload));
  function freeze(collectionDigest, protocol) {
    return db.transaction(() => {
      if (!protocol) throw new Error('Activate the pilot before freezing an audit.');
      const run = db.prepare('SELECT payload FROM pilot_collection_runs WHERE digest=?').get(collectionDigest);
      if (!run) throw new Error('Collection snapshot not found. Reload the workspace.');
      const collection = JSON.parse(run.payload);
      if (!collection.detectorVersion || !collection.detectorSha256) throw new Error('This older run lacks detector provenance. Collect filings again before freezing an audit.');
      const id = digest([collectionDigest, FILING_AUDIT_RUBRIC.version]);
      if (get(id)) return get(id);
      const seen = new Set();
      const cases = collection.checks.map((c, i) => {
        const key = [c.companyId, c.url || `discovery-${i}`, c.discoveryKind || 'regular'].join('|');
        if (seen.has(key)) throw new Error('Duplicate filing checks in collection snapshot.');
        seen.add(key);
        return { id: digest([id, key]), companyId: c.companyId, sourceUrl: c.url || null,
          publicationDate: c.publicationDate || null, form: c.form || null, status: c.status,
          sourceSha256: c.sourceSha256 || null, hashBasis: c.hashBasis || null,
          matched: c.status === 'retrieved' ? Boolean(c.candidateId) : null,
          control: c.discoveryKind === 'historical_reference',
          cohort: c.publicationDate > protocol.activatedAt.slice(0, 10) ? 'published_after_activation' : 'historical_or_backfill' };
      });
      if (!cases.length) throw new Error('Collection snapshot contains no checks.');
      const batch = { id, collectionDigest, createdAt: clock(), collectedAt: collection.checkedAt,
        detectorVersion: collection.detectorVersion, detectorSha256: collection.detectorSha256,
        rubric: FILING_AUDIT_RUBRIC, cases, sampling: 'all_checks_in_frozen_run', predictionValidation: false };
      db.prepare('INSERT INTO pilot_audit_batches VALUES (?,?)').run(id, JSON.stringify(batch));
      return batch;
    })();
  }
  function source(batchId, caseId) {
    const c = get(batchId)?.cases.find(c => c.id === caseId);
    if (!c || c.status !== 'retrieved' || !c.sourceSha256) throw new Error('No archived source is available for this case.');
    return readSource(c.sourceSha256);
  }
  function label(input, { preview = false } = {}) {
    return db.transaction(() => {
      if (!input || typeof input !== 'object') throw new Error('A source review is required.');
      const requestId = text(input.requestId, 'Request identifier', 36);
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) throw new Error('Invalid request identifier.');
      const submission = { batchId: text(input.batchId, 'Audit batch', 64), caseId: text(input.caseId, 'Audit case', 64),
        sourceSha256: text(input.sourceSha256, 'Source fingerprint', 64), label: input.label,
        reviewerId: text(input.reviewerId, 'Reviewer identity', 150), reviewerKind: input.reviewerKind,
        independenceDeclared: input.independenceDeclared === true,
        reportReference: text(input.reportReference, 'Review report reference', 500, true),
        evidenceSection: text(input.evidenceSection, 'Sections reviewed', 1000), rationale: text(input.rationale, 'Judgment rationale'),
        quote: text(input.quote, 'Supporting source text', 2000, true), expectedVersion: input.expectedVersion };
      if (!['relevant', 'not_relevant', 'uncertain'].includes(submission.label) || !['external_human', 'operator_human', 'ai_assisted'].includes(submission.reviewerKind)
        || !Number.isInteger(submission.expectedVersion) || submission.expectedVersion < 0) throw new Error('Invalid judgment, reviewer kind or version.');
      const prior = db.prepare('SELECT payload FROM pilot_audit_labels WHERE request_id=?').get(requestId);
      if (prior) {
        const previous = JSON.parse(prior.payload);
        if (JSON.stringify(previous.submission) !== JSON.stringify(submission)) throw conflict('Request identifier already used.');
        return previous;
      }
      const batch = get(submission.batchId), c = batch?.cases.find(c => c.id === submission.caseId);
      if (!c || c.sourceSha256 !== submission.sourceSha256) throw conflict('Audit case or source fingerprint changed.');
      const previous = labels(batch.id).filter(r => r.caseId === c.id).at(-1);
      if ((previous?.version || 0) !== submission.expectedVersion) throw conflict('Judgment changed. Reload before saving.');
      const archive = source(batch.id, c.id);
      if (archive.sourceSha256 !== c.sourceSha256) throw new Error('Source integrity check failed.');
      const normalize = s => s.replace(/\s+/g, ' ').trim();
      if (submission.label === 'relevant' && !submission.quote) throw new Error('Relevant judgments require supporting text from the archived source.');
      if (submission.quote && !normalize(archive.text).includes(normalize(submission.quote))) throw new Error('Supporting text does not match the archived source.');
      if (submission.independenceDeclared && (submission.reviewerKind !== 'external_human' || !submission.reportReference)) throw new Error('An independence declaration requires an external human review and report reference.');
      const record = { ...submission, requestId, version: submission.expectedVersion + 1, recordedAt: clock(),
        sourceIntegrityVerified: true, independenceVerified: false, submission };
      if (preview) return record;
      db.prepare('INSERT INTO pilot_audit_labels(request_id,batch_id,case_id,version,payload) VALUES (?,?,?,?,?)')
        .run(requestId, batch.id, c.id, record.version, JSON.stringify(record));
      return record;
    })();
  }
  function packageId(batch) { return digest([batch.id, 'review-handoff-v1', batch.cases.filter(c => !c.control).map(c => [c.id, c.sourceSha256])]); }
  function handoff(batchId) {
    const batch = get(batchId); if (!batch) throw new Error('Audit batch not found.');
    const history = labels(batchId);
    const cases = batch.cases.filter(c => !c.control).map(c => {
      let archived = null, sourceError = null;
      try { archived = source(batchId, c.id); } catch { sourceError = 'Frozen archive unavailable; do not substitute a newer document.'; }
      return { caseId: c.id, companyId: c.companyId, publicationDate: c.publicationDate, form: c.form,
        sourceUrl: c.sourceUrl, sourceSha256: c.sourceSha256, hashBasis: c.hashBasis,
        sourceText: archived?.text || null, sourceTextFormat: 'normalized_visible_text_v1', sourceError,
        expectedVersion: history.filter(r => r.caseId === c.id).at(-1)?.version || 0 };
    });
    return { schemaVersion: 1, kind: 'filing-audit-review-package', batchId, packageId: packageId(batch), exportedAt: clock(),
      rubric: batch.rubric,
      instructions: [
        'Review each frozen filing against the rubric. Detector outputs, AI drafts, prior judgments and historical controls are omitted from this package.',
        'Use sourceText for the frozen normalized text. The source fingerprint identifies the archived HTML, not this text view. The live publisher link may differ from the archive.',
        'Save a separate JSON file containing only responseTemplate. Complete the reviewer origin, identity, judgment, sections and rationale for each reviewed case; supporting source text is required for relevant judgments.',
        'Select uncertain for unresolved evidence. Do not infer zero losses from an irrelevant judgment. Partial responses are allowed; omitted cases remain pending.',
        'Declare external independence only if true and provide a report reference. This workspace cannot authenticate reviewer identity or independence. Disclose any AI assistance.',
      ], cases,
      responseTemplate: { schemaVersion: 1, kind: 'filing-audit-review-response', batchId, packageId: packageId(batch),
        reviews: cases.map(c => ({ caseId: c.caseId, sourceSha256: c.sourceSha256, expectedVersion: c.expectedVersion,
          label: 'uncertain', reviewerId: '', reviewerKind: '', independenceDeclared: false,
          reportReference: '', evidenceSection: '', quote: '', rationale: '' })) } };
  }
  function importReviews(input, { preview = false } = {}) {
    return db.transaction(() => {
      if (!input || input.schemaVersion !== 1 || input.kind !== 'filing-audit-review-response') throw new Error('Select a completed reviewer response, not the source package.');
      const requestId = text(input.requestId, 'Import request identifier', 36);
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) throw new Error('Invalid import request identifier.');
      const batch = get(text(input.batchId, 'Audit batch', 64));
      if (!batch || input.packageId !== packageId(batch)) throw conflict('Response does not match this frozen audit package.');
      if (!Array.isArray(input.reviews) || !input.reviews.length || input.reviews.length > batch.cases.filter(c => !c.control).length) throw new Error('Response must contain at least one regular case, at most once each.');
      const contentDigest = digest([input.batchId, input.packageId, input.reviews]);
      const prior = db.prepare('SELECT * FROM pilot_audit_imports WHERE request_id=?').get(requestId);
      if (prior) {
        if (prior.content_digest !== contentDigest) throw conflict('Import request identifier already used for another response.');
        return { ...JSON.parse(prior.payload), alreadyImported: true };
      }
      const seen = new Set(), rows = [];
      for (const review of input.reviews) {
        if (!review || typeof review !== 'object' || seen.has(review.caseId)) throw new Error('Duplicate or invalid response case.');
        seen.add(review.caseId);
        if (!batch.cases.some(c => c.id === review.caseId && !c.control)) throw new Error('Response includes a control or an unknown case.');
        // Stable per-case IDs make a network retry safe. Package identity and
        // record versions prevent cross-audit imports and concurrent overwrites.
        const key = digest([requestId, review.caseId]);
        const childId = `${key.slice(0,8)}-${key.slice(8,12)}-4${key.slice(13,16)}-8${key.slice(17,20)}-${key.slice(20,32)}`;
        const result = label({ ...review, batchId: batch.id, requestId: childId }, { preview });
        rows.push({ caseId: result.caseId, label: result.label, reviewerId: result.reviewerId, reviewerKind: result.reviewerKind,
          independenceDeclared: result.independenceDeclared,
          qualifiesForCensusScoring: result.label !== 'uncertain' && result.reviewerKind === 'external_human' && result.independenceDeclared && Boolean(result.reportReference) });
      }
      const receipt = { batchId: batch.id, requestId, rows, count: rows.length, recordedAt: preview ? null : clock(), alreadyImported: false };
      if (!preview) db.prepare('INSERT INTO pilot_audit_imports VALUES (?,?,?)').run(requestId, contentDigest, JSON.stringify(receipt));
      return receipt;
    })();
  }
  return { freeze, label, source, handoff, importReviews, snapshot() {
    let drafts, draftError = null;
    try { drafts = readDrafts(); if (!Array.isArray(drafts.records)) throw new Error('Invalid screening drafts.'); }
    catch (e) { drafts = { records: [] }; draftError = e.message; }
    return db.prepare('SELECT payload FROM pilot_audit_batches ORDER BY rowid').all().map(r => {
      const batch = JSON.parse(r.payload), history = labels(batch.id);
      const screeningDrafts = [];
      for (const d of drafts.records.filter(d => d.batchId === batch.id)) {
        try {
          const c = batch.cases.find(c => c.id === d.caseId);
          if (!c || c.sourceSha256 !== d.sourceSha256 || c.control) throw new Error('Draft source does not match the frozen case.');
          const archived = source(batch.id, c.id);
          const quote = text(d.quote, 'Draft source excerpt', 2000, true);
          if (quote && !archived.text.replace(/\s+/g, ' ').includes(quote.replace(/\s+/g, ' '))) throw new Error('Draft excerpt does not match the archive.');
          if (!['not_relevant', 'relevant', 'uncertain'].includes(d.proposedLabel)) throw new Error('Invalid draft label.');
          screeningDrafts.push({ caseId: c.id, sourceSha256: c.sourceSha256,
            preparedAt: text(d.preparedAt, 'Preparation time', 50), proposedLabel: d.proposedLabel,
            rationale: text(d.rationale, 'Draft rationale'), evidenceSection: text(d.evidenceSection, 'Draft sections', 1000), quote,
            reviewerKind: 'ai_assisted', status: 'unscored_draft', independentOutcomeLabel: false });
        } catch (e) { draftError = `Some AI screening drafts were withheld: ${e.message}`; }
      }
      return { ...batch, labels: history, screeningDrafts, screeningDraftError: draftError, score: filingAuditScore(batch, history),
        importHistory: db.prepare('SELECT payload FROM pilot_audit_imports ORDER BY rowid').all().map(r => JSON.parse(r.payload)).filter(r => r.batchId === batch.id) };
    });
  } };
}
