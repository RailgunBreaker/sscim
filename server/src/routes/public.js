import { Router } from 'express';
import { db } from '../db.js';

export const publicRouter = Router();

function getStages() {
  return db.prepare('SELECT * FROM stages').all().map((s) => ({
    id: s.id, name: s.name, x: s.x, y: s.y, value: s.value, subst: s.subst, market: s.market,
    shares: JSON.parse(s.shares_json),
  }));
}
function getFlowEdges() {
  return db.prepare('SELECT from_stage, to_stage FROM flow_edges').all().map((e) => [e.from_stage, e.to_stage]);
}
function getTierLabels() {
  return db.prepare('SELECT label, x FROM tier_labels ORDER BY seq').all().map((t) => [t.label, t.x]);
}
function getCountries() {
  return db.prepare('SELECT * FROM countries').all();
}
function getCompanies() {
  return db.prepare('SELECT * FROM companies').all().map((c) => ({
    id: c.id, name: c.name, country: c.country, domain: c.domain, stakes: JSON.parse(c.stakes_json),
  }));
}
function getCustomers() {
  const rows = db.prepare('SELECT * FROM customers').all();
  const out = {};
  for (const r of rows) (out[r.supplier_id] ||= []).push([r.customer_id, r.share]);
  return out;
}
function getOwners() {
  const rows = db.prepare('SELECT * FROM owners').all();
  const out = {};
  for (const r of rows) (out[r.company_id] ||= []).push([r.owner_name, r.share]);
  return out;
}
function getPolicies() {
  return db.prepare('SELECT * FROM policies').all().map((p) => ({ id: p.id, name: p.name, sev: p.sev, stages: JSON.parse(p.stages_json) }));
}
function getEvents() {
  return db.prepare('SELECT * FROM events').all().map((e) => ({
    id: e.id, date: e.date, daysAgo: e.days_ago, sev: e.sev, type: e.type, conf: e.conf,
    title: e.title, summary: e.summary, first: e.first, second: e.second, watch: e.watch,
    detail: e.detail, source: e.source,
    stages: JSON.parse(e.stages_json), countries: JSON.parse(e.countries_json), timeline: JSON.parse(e.timeline_json),
  }));
}
function getScenarios() {
  return db.prepare('SELECT * FROM scenarios').all().map((s) => ({
    id: s.id, name: s.name, desc: s.desc, ...(s.event_json ? { event: JSON.parse(s.event_json) } : {}),
  }));
}
function getDataNotes() {
  return db.prepare('SELECT scope, tier, note, source, created_at FROM data_notes ORDER BY id').all();
}

publicRouter.get('/stages', (req, res) => res.json(getStages()));
publicRouter.get('/flow-edges', (req, res) => res.json(getFlowEdges()));
publicRouter.get('/tier-labels', (req, res) => res.json(getTierLabels()));
publicRouter.get('/countries', (req, res) => res.json(getCountries()));
publicRouter.get('/companies', (req, res) => res.json(getCompanies()));
publicRouter.get('/customers', (req, res) => res.json(getCustomers()));
publicRouter.get('/owners', (req, res) => res.json(getOwners()));
publicRouter.get('/policies', (req, res) => res.json(getPolicies()));
publicRouter.get('/events', (req, res) => res.json(getEvents()));
publicRouter.get('/scenarios', (req, res) => res.json(getScenarios()));
publicRouter.get('/data-notes', (req, res) => res.json(getDataNotes()));

/* Single-fetch bundle — what the dashboard actually loads on startup. */
publicRouter.get('/bundle', (req, res) => {
  res.json({
    stages: getStages(),
    flowEdges: getFlowEdges(),
    tierLabels: getTierLabels(),
    countries: getCountries(),
    companies: getCompanies(),
    customers: getCustomers(),
    owners: getOwners(),
    policies: getPolicies(),
    events: getEvents(),
    scenarios: getScenarios(),
    dataNotes: getDataNotes(),
  });
});
