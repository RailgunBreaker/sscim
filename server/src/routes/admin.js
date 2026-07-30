import { Router } from 'express';
import { db } from '../db.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { getSnapshotDate } from '../meta.js';
import { daysAgoOf } from '../history-events.js';
import { candidates, pendingCandidates, candidateById, approveCandidate, rejectCandidate, publishPendingReviews, unpublishedReviews, dashboardSummary, scheduleAutoPublish, autoPublishStatus, cancelAutoPublish } from '../review-queue.js';

export const adminRouter = Router();
adminRouter.use(adminAuth);

/* ---- review queue (human gate for pipeline candidates) ---- */
adminRouter.get('/review/candidates', (req, res) => {
  const status = ['pending', 'approved', 'rejected', 'all'].includes(req.query.status) ? req.query.status : 'pending';
  res.json({ candidates: status === 'pending' ? pendingCandidates() : candidates(status) });
});

adminRouter.get('/dashboard', (req, res) => res.json(dashboardSummary()));

adminRouter.get('/review/candidates/:id', (req, res) => {
  const candidate = candidateById(req.params.id);
  if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
  res.json({ candidate });
});

/* Approve/reject record the decision and return immediately, then arm the idle
   auto-publish so the batch goes out on its own once the reviewer stops (or
   the queue empties). Publication stays available as an explicit step
   (POST /review/publish) and the response reports when the automatic one is
   due, so the reviewer is never guessing — see review-queue.js. */
function decided(res, payload, status) {
  const pending = pendingCandidates().length;
  const autoPublish = scheduleAutoPublish({ queueEmpty: pending === 0 });
  res.status(status).json({ ...payload, pending, unpublished: unpublishedReviews().length, autoPublish });
}

adminRouter.post('/review/candidates/:id/approve', (req, res) => {
  try {
    const reviewedBy = req.get('x-reviewer') || 'admin-ui';
    decided(res, approveCandidate(req.params.id, req.body || {}, reviewedBy), 201);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

adminRouter.post('/review/candidates/:id/reject', (req, res) => {
  try {
    const reviewedBy = req.get('x-reviewer') || 'admin-ui';
    decided(res, rejectCandidate(req.params.id, req.body?.reason, reviewedBy), 200);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/* Explicit publish. Cancels any armed auto-publish first so the two cannot
   both fire and race for the same commit. */
adminRouter.post('/review/publish', (req, res) => {
  cancelAutoPublish();
  const result = publishPendingReviews();
  res.status(result.published ? 200 : 202).json({ ...result, autoPublish: autoPublishStatus() });
});

adminRouter.get('/review/autopublish', (req, res) => res.json(autoPublishStatus()));

/* ---- companies (identity + production footprint) ---- */
adminRouter.put('/companies/:id', (req, res) => {
  const { id } = req.params;
  const { name, country, domain, stakes } = req.body || {};
  const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(id);
  if (existing) {
    db.prepare(`UPDATE companies SET name = COALESCE(?, name), country = COALESCE(?, country),
      domain = COALESCE(?, domain), stakes_json = COALESCE(?, stakes_json), updated_at = datetime('now') WHERE id = ?`)
      .run(name ?? null, country ?? null, domain ?? null, stakes ? JSON.stringify(stakes) : null, id);
  } else {
    if (!name || !country) return res.status(400).json({ error: 'name and country are required to create a company' });
    db.prepare('INSERT INTO companies (id, name, country, domain, stakes_json) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, country, domain ?? null, JSON.stringify(stakes ?? {}));
  }
  res.json(db.prepare('SELECT * FROM companies WHERE id = ?').get(id));
});

adminRouter.delete('/companies/:id', (req, res) => {
  db.prepare('DELETE FROM companies WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/* ---- stages (economics + country shares) ---- */
adminRouter.put('/stages/:id', (req, res) => {
  const { id } = req.params;
  const { name, x, y, value, subst, market, shares } = req.body || {};
  const existing = db.prepare('SELECT id FROM stages WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Stage not found — stages are structural nodes in the DAG, create via a migration, not the admin API.' });
  db.prepare(`UPDATE stages SET name = COALESCE(?, name), x = COALESCE(?, x), y = COALESCE(?, y),
    value = COALESCE(?, value), subst = COALESCE(?, subst), market = COALESCE(?, market),
    shares_json = COALESCE(?, shares_json), updated_at = datetime('now') WHERE id = ?`)
    .run(name ?? null, x ?? null, y ?? null, value ?? null, subst ?? null, market ?? null, shares ? JSON.stringify(shares) : null, id);
  res.json(db.prepare('SELECT * FROM stages WHERE id = ?').get(id));
});

/* ---- customer graph edges ---- */
adminRouter.put('/customers/:supplierId/:customerId', (req, res) => {
  const { supplierId, customerId } = req.params;
  const { share } = req.body || {};
  if (typeof share !== 'number') return res.status(400).json({ error: 'share (number) is required' });
  db.prepare(`INSERT INTO customers (supplier_id, customer_id, share) VALUES (?, ?, ?)
    ON CONFLICT(supplier_id, customer_id) DO UPDATE SET share = excluded.share, updated_at = datetime('now')`)
    .run(supplierId, customerId, share);
  res.json({ supplierId, customerId, share });
});

adminRouter.delete('/customers/:supplierId/:customerId', (req, res) => {
  db.prepare('DELETE FROM customers WHERE supplier_id = ? AND customer_id = ?').run(req.params.supplierId, req.params.customerId);
  res.status(204).end();
});

/* ---- shareholder table ---- */
adminRouter.put('/owners/:companyId/:ownerName', (req, res) => {
  const { companyId, ownerName } = req.params;
  const { share } = req.body || {};
  if (typeof share !== 'number') return res.status(400).json({ error: 'share (number) is required' });
  db.prepare(`INSERT INTO owners (company_id, owner_name, share) VALUES (?, ?, ?)
    ON CONFLICT(company_id, owner_name) DO UPDATE SET share = excluded.share, updated_at = datetime('now')`)
    .run(companyId, ownerName, share);
  res.json({ companyId, ownerName, share });
});

adminRouter.delete('/owners/:companyId/:ownerName', (req, res) => {
  db.prepare('DELETE FROM owners WHERE company_id = ? AND owner_name = ?').run(req.params.companyId, req.params.ownerName);
  res.status(204).end();
});

/* ---- events (the live intelligence feed) ---- */
/* dateISO is what makes an event re-ageable when the snapshot date advances
   (see db.js events.date_iso). Accept it, and derive days_ago from it when
   given so the two cannot disagree. */
adminRouter.post('/events', (req, res) => {
  const e = req.body || {};
  if (!e.id || !e.title) return res.status(400).json({ error: 'id and title are required' });
  if (e.dateISO && !/^\d{4}-\d{2}-\d{2}$/.test(e.dateISO)) return res.status(400).json({ error: 'dateISO must be YYYY-MM-DD' });
  const daysAgo = e.dateISO ? daysAgoOf(e.dateISO, getSnapshotDate()) : (e.daysAgo ?? 0);
  db.prepare(`INSERT INTO events (id, date, date_iso, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, stages_json, countries_json, timeline_json)
    VALUES (@id, @date, @date_iso, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @stages_json, @countries_json, @timeline_json)`)
    .run({
      id: e.id, date: e.date ?? null, date_iso: e.dateISO ?? null, days_ago: daysAgo, sev: e.sev ?? 5, type: e.type ?? null, conf: e.conf ?? 'Medium',
      title: e.title, summary: e.summary ?? null, first: e.first ?? null, second: e.second ?? null, watch: e.watch ?? null,
      detail: e.detail ?? null, source: e.source ?? null,
      stages_json: JSON.stringify(e.stages ?? []), countries_json: JSON.stringify(e.countries ?? []), timeline_json: JSON.stringify(e.timeline ?? []),
    });
  res.status(201).json(e);
});

adminRouter.put('/events/:id', (req, res) => {
  const { id } = req.params;
  const e = req.body || {};
  const existing = db.prepare('SELECT id FROM events WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Event not found' });
  if (e.dateISO && !/^\d{4}-\d{2}-\d{2}$/.test(e.dateISO)) return res.status(400).json({ error: 'dateISO must be YYYY-MM-DD' });
  db.prepare(`UPDATE events SET date=COALESCE(?,date), date_iso=COALESCE(?,date_iso), days_ago=COALESCE(?,days_ago), sev=COALESCE(?,sev), type=COALESCE(?,type),
    conf=COALESCE(?,conf), title=COALESCE(?,title), summary=COALESCE(?,summary), first=COALESCE(?,first), second=COALESCE(?,second),
    watch=COALESCE(?,watch), detail=COALESCE(?,detail), source=COALESCE(?,source),
    stages_json=COALESCE(?,stages_json), countries_json=COALESCE(?,countries_json), timeline_json=COALESCE(?,timeline_json),
    updated_at=datetime('now') WHERE id=?`)
    .run(e.date ?? null, e.dateISO ?? null, e.dateISO ? daysAgoOf(e.dateISO, getSnapshotDate()) : (e.daysAgo ?? null), e.sev ?? null, e.type ?? null, e.conf ?? null, e.title ?? null, e.summary ?? null,
      e.first ?? null, e.second ?? null, e.watch ?? null, e.detail ?? null, e.source ?? null,
      e.stages ? JSON.stringify(e.stages) : null, e.countries ? JSON.stringify(e.countries) : null, e.timeline ? JSON.stringify(e.timeline) : null,
      id);
  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
});

adminRouter.delete('/events/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/* ---- data notes (citation trail) ---- */
adminRouter.post('/data-notes', (req, res) => {
  const { scope, tier, note, source } = req.body || {};
  if (!scope || !tier || !note) return res.status(400).json({ error: 'scope, tier, and note are required' });
  const info = db.prepare('INSERT INTO data_notes (scope, tier, note, source) VALUES (?, ?, ?, ?)').run(scope, tier, note, source ?? null);
  res.status(201).json({ id: info.lastInsertRowid, scope, tier, note, source });
});
