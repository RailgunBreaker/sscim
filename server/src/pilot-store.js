import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { validatePilotRecord, pilotSummary } from '../../app/src/engine/pilotWorkflow.js';
import { PILOT_PROTOCOL } from './pilot-intake.js';
import { createPilotAudit } from './pilot-audit.js';

export function createPilotStore(path, companyExists, clock = () => new Date().toISOString(), getIntake = () => ({ candidates: [], historicalCases: [], checks: [], checkedAt: null }), getScreeningDrafts, readAuditSource) {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS pilot_records (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_history (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT, record_id TEXT NOT NULL, version INTEGER NOT NULL,
    recorded_at TEXT NOT NULL, reason TEXT NOT NULL, payload TEXT NOT NULL,
    UNIQUE(record_id,version));
    CREATE TABLE IF NOT EXISTS pilot_protocol (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_sources (candidate_id TEXT NOT NULL, revision TEXT NOT NULL, queued_at TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(candidate_id,revision));
    CREATE TABLE IF NOT EXISTS pilot_collection_runs (digest TEXT PRIMARY KEY, recorded_at TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pilot_reviews (sequence INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT UNIQUE NOT NULL, candidate_id TEXT NOT NULL, revision TEXT NOT NULL, payload TEXT NOT NULL);`);
  const audit = createPilotAudit(db, clock, readAuditSource, getScreeningDrafts || (path === ':memory:' ? () => ({ records: [] }) : undefined));
  const decode = r => r && ({ id: r.id, type: r.type, version: r.version, payload: JSON.parse(r.payload), createdAt: r.created_at, updatedAt: r.updated_at });
  const get = id => decode(db.prepare('SELECT * FROM pilot_records WHERE id=?').get(id));
  function save(type, input, { id = randomUUID(), version = 0, reason = 'Created by workspace operator', replayCreate = false } = {}) {
    return db.transaction(() => {
      const now = clock(), payload = validatePilotRecord(type, input, now.slice(0, 10));
      if (!companyExists(payload.companyId) && !PILOT_PROTOCOL.companies.some(c => c.id === payload.companyId)) throw new Error('Unknown company.');
      const previous = get(id);
      if (previous && replayCreate) {
        const original = db.prepare('SELECT payload FROM pilot_history WHERE record_id=? AND version=1').get(id);
        if (previous.type === type && original?.payload === JSON.stringify(payload)) return previous;
        throw Object.assign(new Error('Request identifier already used for another record.'), { status: 409 });
      }
      if ((previous?.version || 0) !== version) throw Object.assign(new Error('Record changed. Reload before saving your edit.'), { status: 409 });
      if (previous && (previous.type !== type || previous.payload.companyId !== payload.companyId)) throw new Error('Record type and company cannot change.');
      if (typeof reason !== 'string' || !reason.trim() || reason.length > 1000) throw new Error('A change reason is required (maximum 1000 characters).');
      const records = db.prepare('SELECT * FROM pilot_records').all().map(decode);
      if (type === 'watch' && records.some(r => r.id !== id && r.type === 'watch' && r.payload.companyId === payload.companyId)) throw Object.assign(new Error('This company is already on the watchlist.'), { status: 409 });
      if (payload.investigationId) {
        const parent = get(payload.investigationId);
        if (!parent || parent.type !== 'investigation' || parent.payload.companyId !== payload.companyId) throw new Error('Action or delivery must belong to an investigation for this company.');
        if (previous && previous.payload.investigationId !== payload.investigationId) throw new Error('The linked investigation cannot change.');
      }
      if (type === 'delivery' && records.some(r => r.id !== id && r.type === 'delivery' && r.payload.companyId === payload.companyId && r.payload.orderReference === payload.orderReference)) throw new Error('Order reference already exists for this company; edit the original record.');
      const encoded = JSON.stringify(payload), next = version + 1;
      db.prepare(`INSERT INTO pilot_records VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,payload=excluded.payload,updated_at=excluded.updated_at`)
        .run(id, type, next, encoded, previous?.createdAt || now, now);
      db.prepare('INSERT INTO pilot_history(record_id,version,recorded_at,reason,payload) VALUES (?,?,?,?,?)').run(id, next, now, reason.trim(), encoded);
      return get(id);
    })();
  }
  const protocol = () => {
    const row = db.prepare('SELECT payload FROM pilot_protocol WHERE id=1').get();
    return row ? JSON.parse(row.payload) : null;
  };
  const reviews = () => db.prepare('SELECT payload FROM pilot_reviews ORDER BY sequence').all().map(r => JSON.parse(r.payload));
  function capture(intake, now) {
    const coverage = JSON.stringify({ checkedAt: intake.checkedAt, checks: intake.checks,
      detectorVersion: intake.detectorVersion || null, detectorSha256: intake.detectorSha256 || null });
    const digest = createHash('sha256').update(coverage).digest('hex');
    db.prepare('INSERT OR IGNORE INTO pilot_collection_runs VALUES (?,?,?)').run(digest, now, coverage);
    for (const c of intake.candidates) db.prepare('INSERT OR IGNORE INTO pilot_sources VALUES (?,?,?,?)').run(c.id, c.revision, now, JSON.stringify(c));
  }
  function syncIntake() {
    if (!protocol()) return { status: 'skipped', reason: 'pilot_not_activated' };
    const intake = getIntake(); db.transaction(() => capture(intake, clock()))();
    return { status: 'captured', checkedAt: intake.checkedAt, candidates: intake.candidates.length, checks: intake.checks.length };
  }
  function activate() {
    return db.transaction(() => {
      if (protocol()) return protocol();
      const intake = getIntake(), now = clock();
      if (intake.historicalCases.length !== 3) throw new Error('The three historical reference sources must be available before activation.');
      const p = { ...PILOT_PROTOCOL, activatedAt: now, checkpointAt: new Date(Date.parse(now) + PILOT_PROTOCOL.checkpointDays * 86400000).toISOString() };
      capture(intake, now);
      for (const c of p.companies) {
        const watched = db.prepare("SELECT payload FROM pilot_records WHERE type='watch'").all().some(r => JSON.parse(r.payload).companyId === c.id);
        if (!watched) save('watch', { companyId: c.id, productScope: c.productScope, objective: p.objective }, { reason: 'Public disclosure pilot activated' });
      }
      const historicalInvestigations = intake.historicalCases.map(c => {
        const r = save('investigation', { companyId: c.companyId, productScope: p.companies.find(p => p.id === c.companyId).productScope,
          question: c.question, sourceUrl: c.sourceUrl, sourceDate: c.publicationDate, status: 'open', resolution: c.finding },
        { reason: 'Imported historical source context; no new incident or operator action asserted' });
        return { investigationId: r.id, source: c, kind: 'historical_reference' };
      });
      p.historicalInvestigations = historicalInvestigations;
      db.prepare('INSERT INTO pilot_protocol VALUES (1,?)').run(JSON.stringify(p));
      return p;
    })();
  }
  function review(input) {
    return db.transaction(() => {
      const p = protocol(); if (!p) throw new Error('Activate the pilot before reviewing candidates.');
      if (!input || typeof input !== 'object') throw new Error('A review is required.');
      const { candidateId, revision, decision, reason, requestId, expectedReviews } = input;
      if (typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId)) throw new Error('Invalid request identifier.');
      if (!['investigate', 'dismiss', 'defer'].includes(decision) || typeof reason !== 'string' || !reason.trim() || reason.length > 2000 || !Number.isInteger(expectedReviews) || expectedReviews < 0) throw new Error('A decision, reason and current review count are required.');
      const submission = { candidateId, revision, decision, reason: reason.trim(), expectedReviews };
      const prior = db.prepare('SELECT payload FROM pilot_reviews WHERE request_id=?').get(requestId);
      if (prior) {
        const saved = JSON.parse(prior.payload);
        if (JSON.stringify(saved.submission) !== JSON.stringify(submission)) throw Object.assign(new Error('Request identifier already used.'), { status: 409 });
        return saved;
      }
      const intake = getIntake(), now = clock(); capture(intake, now);
      const candidate = intake.candidates.find(c => c.id === candidateId);
      if (!candidate || candidate.revision !== revision) throw Object.assign(new Error('Source changed or is unavailable. Reload before reviewing.'), { status: 409 });
      const previous = reviews().filter(r => r.candidateId === candidateId);
      if (previous.length !== expectedReviews) throw Object.assign(new Error('Review changed. Reload before saving.'), { status: 409 });
      let investigationId = previous.find(r => r.investigationId)?.investigationId
        || p.historicalInvestigations.find(r => r.source.sourceUrl === candidate.sourceUrl)?.investigationId || null;
      if (decision === 'investigate' && !investigationId) {
        investigationId = save('investigation', { companyId: candidate.companyId,
          productScope: p.companies.find(c => c.id === candidate.companyId).productScope,
          question: reason.trim(), sourceUrl: candidate.sourceUrl, sourceDate: candidate.publicationDate, status: 'open' },
        { reason: 'Created from a source-linked pilot review' }).id;
      }
      const r = { ...submission, requestId, reviewedAt: now, source: structuredClone(candidate), investigationId: decision === 'investigate' ? investigationId : null,
        independentOutcomeLabel: false, submission };
      db.prepare('INSERT INTO pilot_reviews(request_id,candidate_id,revision,payload) VALUES (?,?,?,?)').run(requestId, candidateId, revision, JSON.stringify(r));
      return r;
    })();
  }
  function intakeSnapshot(asOf) {
    const p = protocol(), history = reviews();
    let intake, error = null;
    try { intake = getIntake(); if (p) db.transaction(() => capture(intake, asOf))(); }
    catch (e) { error = `Collection intake unavailable: ${e.message}`; intake = { candidates: [], checks: [], checkedAt: null }; }
    const latest = new Map();
    for (const row of db.prepare('SELECT * FROM pilot_sources ORDER BY rowid').all()) latest.set(row.candidate_id, { ...JSON.parse(row.payload), queuedAt: row.queued_at });
    for (const c of intake.candidates) {
      const saved = db.prepare('SELECT queued_at FROM pilot_sources WHERE candidate_id=? AND revision=?').get(c.id, c.revision);
      latest.set(c.id, { ...c, queuedAt: saved?.queued_at || null });
    }
    const queue = [...latest.values()].map(c => {
      const current = intake.candidates.some(r => r.id === c.id && r.revision === c.revision);
      const decisions = history.filter(r => r.candidateId === c.id), lastDecision = decisions.at(-1);
      const matching = lastDecision?.revision === c.revision ? lastDecision : null;
      const status = matching?.decision || 'pending';
      const elapsedHours = c.queuedAt ? Math.max(0, (Date.parse(asOf) - Date.parse(c.queuedAt)) / 3600000) : null;
      const newPublication = Boolean(p && c.discoveryKind !== 'historical_reference' && c.publicationDate > p.activatedAt.slice(0, 10)
        && Date.parse(c.firstSeenAt) >= Date.parse(p.activatedAt) && Date.parse(c.firstSeenAt) <= Date.parse(asOf)
        && c.publicationDate <= asOf.slice(0, 10));
      return { ...c, current, cohort: newPublication ? 'new_publication_after_activation' : 'historical_or_backfill',
        status, reviewCount: decisions.length, lastDecision: matching || null, elapsedHours,
        overdue: ['pending', 'defer'].includes(status) && elapsedHours > (p?.triageTargetHours || PILOT_PROTOCOL.triageTargetHours) };
    });
    const completed = queue.filter(c => ['investigate', 'dismiss'].includes(c.status));
    return { protocol: p, proposedProtocol: PILOT_PROTOCOL, queue, reviews: history,
      collectionHistory: db.prepare('SELECT * FROM pilot_collection_runs ORDER BY rowid').all().map(r => ({ digest: r.digest, recordedAt: r.recorded_at, ...JSON.parse(r.payload) })),
      collection: { checkedAt: intake.checkedAt, checks: intake.checks, error },
      evaluation: { candidates: queue.length, triaged: completed.length, pending: queue.filter(c => c.status === 'pending').length,
        deferred: queue.filter(c => c.status === 'defer').length, overdue: queue.filter(c => c.overdue).length,
        historical: queue.filter(c => c.cohort === 'historical_or_backfill').length,
        newlyPublished: queue.filter(c => c.cohort === 'new_publication_after_activation').length,
        triagedWithinTarget: completed.filter(c => c.queuedAt && (Date.parse(c.lastDecision.reviewedAt) - Date.parse(c.queuedAt)) / 3600000 <= p.triageTargetHours).length,
        accuracy: null, recall: null, operationalBenefit: null } };
  }
  return { get, save, activate, review, syncIntake,
    freezeAudit: collectionDigest => audit.freeze(collectionDigest, protocol()),
    labelAudit: audit.label, auditSource: audit.source, auditHandoff: audit.handoff, importAuditReviews: audit.importReviews,
    snapshot() {
    const asOf = clock(), records = db.prepare('SELECT * FROM pilot_records ORDER BY created_at,id').all().map(decode);
    return { schemaVersion: 3, asOf, records, summary: pilotSummary(records, asOf.slice(0, 10)), ...intakeSnapshot(asOf), audits: audit.snapshot(),
      history: db.prepare('SELECT record_id AS recordId,version,recorded_at AS recordedAt,reason,payload FROM pilot_history ORDER BY sequence').all().map(r => ({ ...r, payload: JSON.parse(r.payload) })) };
  }, close: () => db.close() };
}
