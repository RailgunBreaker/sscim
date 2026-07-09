/* Generates app/src/data/vault-snapshot.json — a static snapshot of the vault,
   built straight from server/src/seed-data.js (the same source the live
   backend seeds from). Bundled into the frontend as a fallback for when the
   vault API isn't reachable (e.g. a GitHub-Pages-only deploy with no backend
   hosted yet) — see VaultContext.jsx. Runs automatically before `npm run
   build` (see package.json "prebuild"); re-run manually via `npm run snapshot`
   whenever server/src/seed-data.js changes and you want the static fallback
   to reflect it. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  COUNTRY_NAMES, COUNTRY_POS, STAGES, FLOW_EDGES, TIER_LABELS,
  COMPANIES, DOMAINS, CUSTOMERS, POLICIES, EVENTS, SCENARIOS, OWNERS,
} from '../../server/src/seed-data.js';
import { DATA_NOTES } from '../../server/src/data-notes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const bundle = {
  stages: STAGES,
  flowEdges: FLOW_EDGES,
  tierLabels: TIER_LABELS,
  countries: Object.entries(COUNTRY_NAMES).map(([id, name]) => {
    const [lat, lng] = COUNTRY_POS[id];
    return { id, name, lat, lng };
  }),
  companies: COMPANIES.map((c) => ({ id: c.id, name: c.name, country: c.country, domain: DOMAINS[c.id] || null, stakes: c.stakes })),
  customers: CUSTOMERS,
  owners: OWNERS,
  policies: POLICIES,
  events: EVENTS.map((e) => ({
    id: e.id, date: e.date, daysAgo: e.daysAgo, sev: e.sev, type: e.type, conf: e.conf,
    title: e.title, summary: e.summary, first: e.first, second: e.second, watch: e.watch,
    detail: e.detail ?? null, source: e.source ?? null, stages: e.stages, countries: e.countries, timeline: e.timeline ?? [],
  })),
  scenarios: SCENARIOS,
  dataNotes: DATA_NOTES.map((n) => ({ scope: n.scope, tier: n.tier, note: n.note, source: n.source ?? null, created_at: null })),
};

const outPath = resolve(__dirname, '../src/data/vault-snapshot.json');
writeFileSync(outPath, JSON.stringify(bundle), 'utf8');
console.log(`Wrote static vault snapshot: ${outPath} (${COMPANIES.length} companies, ${STAGES.length} stages)`);
