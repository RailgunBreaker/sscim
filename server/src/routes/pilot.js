import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { adminRateLimit } from '../middleware/rateLimit.js';

// A single-operator private workspace. It has no public read route, automatic
// publishing, external messaging or connection to the public evidence export.
export function pilotRouter(getStore) {
  const router = Router();
  router.use(adminAuth, adminRateLimit());
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/', (req, res) => res.json(getStore().snapshot()));
  router.post('/activate', (req, res) => {
    try { const store = getStore(); store.activate(); res.json(store.snapshot()); }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  router.post('/reviews', (req, res) => {
    try { const store = getStore(); store.review(req.body); res.json(store.snapshot()); }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  router.post('/audits', (req, res) => {
    try { const store = getStore(); store.freezeAudit(req.body.collectionDigest); res.json(store.snapshot()); }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  router.post('/audit-labels', (req, res) => {
    try { const store = getStore(); store.labelAudit(req.body); res.json(store.snapshot()); }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  router.get('/audits/:batchId/handoff', (req, res) => {
    try { res.json(getStore().auditHandoff(req.params.batchId)); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  router.post('/audit-import-preview', (req, res) => {
    try { res.json(getStore().importAuditReviews(req.body, { preview: true })); }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  router.post('/audit-imports', (req, res) => {
    try { const store = getStore(); store.importAuditReviews(req.body); res.json(store.snapshot()); }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  router.get('/audits/:batchId/sources/:caseId', (req, res) => {
    try { res.json(getStore().auditSource(req.params.batchId, req.params.caseId)); }
    catch (e) { res.status(400).json({ error: e.code === 'ENOENT' ? 'Archived source is missing. Recollection cannot replace the frozen source revision.' : e.message }); }
  });
  router.post('/records', (req, res) => {
    try {
      const key = req.body.requestId;
      if (key != null && (typeof key !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))) throw new Error('Invalid request identifier.');
      res.status(201).json(getStore().save(req.body.type, req.body.payload, key ? { id: key, replayCreate: true } : undefined));
    }
    catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  router.put('/records/:id', (req, res) => {
    try {
      const store = getStore(), previous = store.get(req.params.id);
      if (!previous) return res.status(404).json({ error: 'Record not found.' });
      if (!Number.isInteger(req.body.version) || req.body.version < 1) throw new Error('Current record version is required.');
      res.json(store.save(previous.type, req.body.payload, { id: previous.id, version: req.body.version, reason: req.body.reason }));
    } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
  });
  return router;
}
