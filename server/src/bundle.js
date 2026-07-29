import { db } from './db.js';
import { getMetaBundle } from './meta.js';

/* Reads the whole vault out of SQLite in the wire format the dashboard
   consumes. Shared by the live API (routes/public.js) and the static-snapshot
   export (app/scripts/build-vault-snapshot.mjs), so a GitHub-Pages build and
   a live backend serve byte-identical data shapes from the same database. */

export function getStages() {
  return db.prepare('SELECT * FROM stages').all().map((s) => ({
    id: s.id, name: s.name, x: s.x, y: s.y, value: s.value, subst: s.subst, market: s.market,
    shares: JSON.parse(s.shares_json),
  }));
}
export function getFlowEdges() {
  return db.prepare('SELECT from_stage, to_stage FROM flow_edges').all().map((e) => [e.from_stage, e.to_stage]);
}
export function getTierLabels() {
  return db.prepare('SELECT label, x FROM tier_labels ORDER BY seq').all().map((t) => [t.label, t.x]);
}
export function getCountries() {
  return db.prepare('SELECT * FROM countries').all();
}
export function getCompanies() {
  return db.prepare('SELECT * FROM companies').all().map((c) => ({
    id: c.id, name: c.name, country: c.country, domain: c.domain, stakes: JSON.parse(c.stakes_json),
  }));
}
export function getCustomers() {
  const rows = db.prepare('SELECT * FROM customers').all();
  const out = {};
  for (const r of rows) (out[r.supplier_id] ||= []).push([r.customer_id, r.share]);
  return out;
}
export function getOwners() {
  const rows = db.prepare('SELECT * FROM owners').all();
  const out = {};
  for (const r of rows) (out[r.company_id] ||= []).push([r.owner_name, r.share]);
  return out;
}
export function getPolicies() {
  return db.prepare('SELECT * FROM policies').all().map((p) => ({ id: p.id, name: p.name, sev: p.sev, stages: JSON.parse(p.stages_json) }));
}
export function getEvents() {
  return db.prepare('SELECT * FROM events').all().map((e) => ({
    id: e.id, date: e.date, daysAgo: e.days_ago, sev: e.sev, type: e.type, conf: e.conf,
    title: e.title, summary: e.summary, first: e.first, second: e.second, watch: e.watch,
    detail: e.detail, source: e.source,
    stages: JSON.parse(e.stages_json), countries: JSON.parse(e.countries_json), timeline: JSON.parse(e.timeline_json),
  }));
}
export function getScenarios() {
  return db.prepare('SELECT * FROM scenarios').all().map((s) => ({
    id: s.id, name: s.name, desc: s.desc, ...(s.event_json ? { event: JSON.parse(s.event_json) } : {}),
  }));
}
export function getDataNotes() {
  return db.prepare('SELECT scope, tier, note, source, created_at FROM data_notes ORDER BY id').all();
}
export function getQuotes() {
  const out = {};
  for (const q of db.prepare('SELECT * FROM quotes').all()) {
    out[q.company_id] = {
      ticker: q.ticker, price: q.price, currency: q.currency, changePct: q.change_pct,
      trailingPE: q.trailing_pe, forwardPE: q.forward_pe, marketCap: q.market_cap, asOf: q.as_of,
    };
  }
  return out;
}

/* The archive list, without the bodies. A briefing body is ~6KB, so shipping
   every one of them in the startup bundle would grow it without bound as the
   archive fills. The list carries what the picker needs; the body is fetched
   when a reader opens a specific day. The newest is included in full, since
   that is the one the dashboard shows by default and it should render with no
   second request and no backend at all. */
export function getBriefingIndex(limit = 120) {
  return db.prepare(`SELECT date_iso, chain_index, headline, event_count, model_version, created_at
    FROM briefings ORDER BY date_iso DESC LIMIT ?`).all(limit)
    .map((r) => ({
      dateISO: r.date_iso, chainIndex: r.chain_index, headline: r.headline,
      eventCount: r.event_count, modelVersion: r.model_version, createdAt: r.created_at,
    }));
}

export function getBriefing(dateISO) {
  const row = dateISO
    ? db.prepare('SELECT * FROM briefings WHERE date_iso = ?').get(dateISO)
    : db.prepare('SELECT * FROM briefings ORDER BY date_iso DESC LIMIT 1').get();
  if (!row) return null;
  return {
    dateISO: row.date_iso, chainIndex: row.chain_index, headline: row.headline,
    eventCount: row.event_count, modelVersion: row.model_version, createdAt: row.created_at,
    body: row.body,
  };
}

/* Bodies for the most recent days, so the static deploy — which has no
   backend to ask — can still open recent history offline. Capped rather than
   complete: a body is ~6KB, so a year of daily runs would put 2MB into the
   startup bundle. Older entries stay listed and are fetched from the API when
   one is reachable, which is what the PC backend is for. */
export const BUNDLED_BRIEFING_BODIES = 14;

export function getBriefingBodies(limit = BUNDLED_BRIEFING_BODIES) {
  return Object.fromEntries(
    db.prepare('SELECT date_iso, body FROM briefings ORDER BY date_iso DESC LIMIT ?').all(limit)
      .map((r) => [r.date_iso, r.body]),
  );
}

export function buildBundle() {
  return {
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
    quotes: getQuotes(),
    briefings: getBriefingIndex(),
    briefingBodies: getBriefingBodies(),
    meta: getMetaBundle(),
  };
}
