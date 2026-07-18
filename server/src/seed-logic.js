import { db } from './db.js';
import {
  COUNTRY_NAMES, COUNTRY_POS, STAGES, FLOW_EDGES, TIER_LABELS,
  COMPANIES, DOMAINS, CUSTOMERS, POLICIES, EVENTS, SCENARIOS, OWNERS,
} from './seed-data.js';
import { DATA_NOTES } from './data-notes.js';
import { HISTORY_EVENTS, daysAgoOf } from './history-events.js';

const TABLES = ['countries', 'stages', 'flow_edges', 'tier_labels', 'companies', 'customers', 'owners', 'policies', 'events', 'scenarios', 'data_notes'];

export const truncateAll = db.transaction(() => {
  for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
});

export const seedAll = db.transaction(() => {
  const insCountry = db.prepare('INSERT INTO countries (id, name, lat, lng) VALUES (?, ?, ?, ?)');
  for (const [id, name] of Object.entries(COUNTRY_NAMES)) {
    const [lat, lng] = COUNTRY_POS[id];
    insCountry.run(id, name, lat, lng);
  }

  const insStage = db.prepare(`INSERT INTO stages (id, name, x, y, value, subst, market, shares_json) VALUES (@id, @name, @x, @y, @value, @subst, @market, @shares_json)`);
  for (const s of STAGES) {
    insStage.run({ id: s.id, name: s.name, x: s.x, y: s.y, value: s.value, subst: s.subst, market: s.market, shares_json: JSON.stringify(s.shares) });
  }

  const insEdge = db.prepare('INSERT INTO flow_edges (from_stage, to_stage) VALUES (?, ?)');
  for (const [a, b] of FLOW_EDGES) insEdge.run(a, b);

  const insTier = db.prepare('INSERT INTO tier_labels (label, x) VALUES (?, ?)');
  for (const [label, x] of TIER_LABELS) insTier.run(label, x);

  const insCompany = db.prepare('INSERT INTO companies (id, name, country, domain, stakes_json) VALUES (@id, @name, @country, @domain, @stakes_json)');
  for (const c of COMPANIES) {
    insCompany.run({ id: c.id, name: c.name, country: c.country, domain: DOMAINS[c.id] || null, stakes_json: JSON.stringify(c.stakes) });
  }

  const insCustomer = db.prepare('INSERT INTO customers (supplier_id, customer_id, share) VALUES (?, ?, ?)');
  for (const [supplierId, list] of Object.entries(CUSTOMERS)) {
    for (const [customerId, share] of list) insCustomer.run(supplierId, customerId, share);
  }

  const insOwner = db.prepare('INSERT INTO owners (company_id, owner_name, share) VALUES (?, ?, ?)');
  for (const [companyId, list] of Object.entries(OWNERS)) {
    for (const [ownerName, share] of list) insOwner.run(companyId, ownerName, share);
  }

  const insPolicy = db.prepare('INSERT INTO policies (id, name, sev, stages_json) VALUES (@id, @name, @sev, @stages_json)');
  for (const p of POLICIES) insPolicy.run({ id: p.id, name: p.name, sev: p.sev, stages_json: JSON.stringify(p.stages) });

  const insEvent = db.prepare(`INSERT INTO events (id, date, days_ago, sev, type, conf, title, summary, first, second, watch, detail, source, stages_json, countries_json, timeline_json)
    VALUES (@id, @date, @days_ago, @sev, @type, @conf, @title, @summary, @first, @second, @watch, @detail, @source, @stages_json, @countries_json, @timeline_json)`);
  // Historical backfill events (2021–2026) carry an authoritative dateISO;
  // days_ago is derived from it here, never hand-maintained.
  const allEvents = [...EVENTS, ...HISTORY_EVENTS.map((e) => ({ ...e, daysAgo: daysAgoOf(e.dateISO) }))];
  for (const e of allEvents) {
    insEvent.run({
      id: e.id, date: e.date, days_ago: e.daysAgo, sev: e.sev, type: e.type, conf: e.conf,
      title: e.title, summary: e.summary, first: e.first, second: e.second, watch: e.watch,
      detail: e.detail || null, source: e.source || null,
      stages_json: JSON.stringify(e.stages), countries_json: JSON.stringify(e.countries), timeline_json: JSON.stringify(e.timeline || []),
    });
  }

  const insScenario = db.prepare('INSERT INTO scenarios (id, name, desc, event_json) VALUES (@id, @name, @desc, @event_json)');
  for (const s of SCENARIOS) {
    insScenario.run({ id: s.id, name: s.name, desc: s.desc, event_json: s.event ? JSON.stringify(s.event) : null });
  }

  const insNote = db.prepare('INSERT INTO data_notes (scope, tier, note, source) VALUES (@scope, @tier, @note, @source)');
  for (const n of DATA_NOTES) insNote.run(n);
});

export function seedCounts() {
  const counts = {};
  for (const t of TABLES) counts[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  return counts;
}

/* Bootstraps a brand-new database automatically (used on server startup) —
   never touches an already-populated vault, so restarting the process can
   never wipe live admin-API edits. Explicit resets go through `npm run seed`. */
export function seedIfEmpty() {
  const { stages } = seedCounts();
  if (stages > 0) return false;
  seedAll();
  return true;
}
