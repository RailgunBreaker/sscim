import { Router } from 'express';
import { db } from '../db.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { getSnapshotDate } from '../meta.js';
import { daysAgoOf } from '../history-events.js';
import { candidates, pendingCandidates, candidateById, approveCandidate, rejectCandidate, publishPendingReviews, unpublishedReviews, dashboardSummary, scheduleAutoPublish, autoPublishStatus, cancelAutoPublish, triagePreview, applyTriage, bulkDecide, autoTriaged, untriage, publishVaultChanges } from '../review-queue.js';
import { listEvents, updateEvent, deleteEvent, restoreEvent, allOverrides } from '../event-admin.js';
import { eventImpacts, removalPreview } from '../event-impact.js';
import { systemStatus } from '../system-status.js';

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

/* ---- system status --------------------------------------------------------
   Behind the admin token like every other route here. The page at /status
   carries no data of its own precisely so that this stays the only way to
   read it: a status console that leaked the vault's shape, the environment
   flags and the git state to anyone who could reach the port would be a worse
   problem than the one it solves.

   `?index=false` skips the engine build for a cheap poll. */
adminRouter.get('/status', (req, res) => {
  try {
    res.json(systemStatus({ includeIndex: req.query.index !== 'false' }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ---- bulk review ----------------------------------------------------------
   GET  /review/triage   what triage would do — no writes, safe to poll
   POST /review/triage   apply the two automatic verdicts
   POST /review/bulk     decide an explicit list the reviewer selected
   GET  /review/auto     what triage decided unattended (the audit trail)
   POST /review/auto/:id/undo  reverse one auto-approval
   ------------------------------------------------------------------------- */
adminRouter.get('/review/triage', (req, res) => res.json(triagePreview()));

adminRouter.post('/review/triage', (req, res) => {
  try {
    res.json(applyTriage({ reviewer: req.get('x-reviewer') === 'admin-ui' ? undefined : req.get('x-reviewer') }));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

adminRouter.post('/review/bulk', (req, res) => {
  try {
    const { ids, action, reason } = req.body || {};
    const result = bulkDecide({ ids, action, reason, reviewer: req.get('x-reviewer') || 'admin-ui' });
    const pending = pendingCandidates().length;
    res.json({ ...result, pending, unpublished: unpublishedReviews().length, autoPublish: scheduleAutoPublish({ queueEmpty: pending === 0 }) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

adminRouter.get('/review/auto', (req, res) => res.json({ decisions: autoTriaged(Number(req.query.limit) || 200) }));

adminRouter.post('/review/auto/:id/undo', (req, res) => {
  try {
    res.json(untriage(req.params.id));
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

/* ---- event administration (the historical record) -------------------------
   GET    /events/admin           every event + origin + what removing it does
   GET    /events/impact          impacts alone (no rows), for a refresh
   POST   /events/removal-preview { ids } — combined effect of removing a set
   PUT    /events/:id             edit, recorded as an override so it survives sync
   DELETE /events/:id             delete, tombstoned for the same reason
   POST   /events/:id/restore     drop the override
   GET    /events/overrides       every administrative change on record
   POST   /events/publish         rebuild snapshot, audit, commit, push
   ------------------------------------------------------------------------- */
adminRouter.get('/events/admin', (req, res) => {
  try {
    res.json(listEvents({ includeImpact: req.query.impact !== 'false' }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

adminRouter.get('/events/impact', (req, res) => {
  try {
    res.json(eventImpacts());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* The combined delta is NOT the sum of the individual ones — overlapping
   events saturate through the noisy-OR — so removing a duplicate cluster has
   to be previewed as a set. */
adminRouter.post('/events/removal-preview', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids (non-empty array) is required' });
  try {
    res.json(removalPreview(ids));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

adminRouter.get('/events/overrides', (req, res) => res.json({ overrides: allOverrides() }));

adminRouter.post('/events/:id/restore', (req, res) => {
  try {
    res.json(restoreEvent(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

adminRouter.post('/events/publish', (req, res) => {
  const result = publishVaultChanges({ message: req.body?.message, reviewer: req.get('x-reviewer') || 'admin-ui' });
  res.status(result.published ? 200 : 202).json(result);
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

/* Edits go through event-admin.js rather than straight to SQL so the change
   is recorded in event_overrides. Without that record, scripts/sync-events.mjs
   upserts the code definition back over the top on the next pipeline run and
   the edit silently reverts. */
adminRouter.put('/events/:id', (req, res) => {
  try {
    /* `reason` is metadata about the edit, not a column — it is recorded on
       the override. Splitting it out here keeps updateEvent free to reject
       every other unknown key as a typo rather than silently ignoring it. */
    const { reason, ...patch } = req.body || {};
    res.json(updateEvent(req.params.id, patch, {
      actor: req.get('x-reviewer') || 'admin-ui',
      reason: reason ?? null,
    }));
  } catch (error) {
    res.status(error.message === 'Event not found.' ? 404 : 400).json({ error: error.message });
  }
});

adminRouter.delete('/events/:id', (req, res) => {
  try {
    res.json(deleteEvent(req.params.id, {
      reason: req.body?.reason ?? req.query.reason ?? null,
      actor: req.get('x-reviewer') || 'admin-ui',
    }));
  } catch (error) {
    res.status(error.message === 'Event not found.' ? 404 : 400).json({ error: error.message });
  }
});

/* ---- data notes (citation trail) ---- */
adminRouter.post('/data-notes', (req, res) => {
  const { scope, tier, note, source } = req.body || {};
  if (!scope || !tier || !note) return res.status(400).json({ error: 'scope, tier, and note are required' });
  const info = db.prepare('INSERT INTO data_notes (scope, tier, note, source) VALUES (?, ?, ?, ?)').run(scope, tier, note, source ?? null);
  res.status(201).json({ id: info.lastInsertRowid, scope, tier, note, source });
});
