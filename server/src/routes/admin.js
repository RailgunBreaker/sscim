import { Router } from 'express';
import { db } from '../db.js';
import { adminAuth } from '../middleware/adminAuth.js';

export const adminRouter = Router();
adminRouter.use(adminAuth);

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
adminRouter.post('/events', (req, res) => {
  const e = req.body || {};
  if (!e.id || !e.title) return res.status(400).json({ error: 'id and title are required' });
  db.prepare(`INSERT INTO events (id, date, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, stages_json, countries_json, timeline_json)
    VALUES (@id, @date, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @stages_json, @countries_json, @timeline_json)`)
    .run({
      id: e.id, date: e.date ?? null, days_ago: e.daysAgo ?? 0, sev: e.sev ?? 5, type: e.type ?? null, conf: e.conf ?? 'Medium',
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
  db.prepare(`UPDATE events SET date=COALESCE(?,date), days_ago=COALESCE(?,days_ago), sev=COALESCE(?,sev), type=COALESCE(?,type),
    conf=COALESCE(?,conf), title=COALESCE(?,title), summary=COALESCE(?,summary), first=COALESCE(?,first), second=COALESCE(?,second),
    watch=COALESCE(?,watch), detail=COALESCE(?,detail), source=COALESCE(?,source),
    stages_json=COALESCE(?,stages_json), countries_json=COALESCE(?,countries_json), timeline_json=COALESCE(?,timeline_json),
    updated_at=datetime('now') WHERE id=?`)
    .run(e.date ?? null, e.daysAgo ?? null, e.sev ?? null, e.type ?? null, e.conf ?? null, e.title ?? null, e.summary ?? null,
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
