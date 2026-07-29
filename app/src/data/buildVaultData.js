import { COMP_META } from './compMeta.js';

/* Shapes a raw vault bundle into the object the engine and the UI consume.

   Extracted from VaultContext.jsx so it can run outside React: the nightly
   briefing archiver (server/scripts/archive-briefing.mjs) needs exactly this
   shape to rebuild the engine from an exported snapshot, and duplicating the
   derivation would let the archived briefing drift from the live one. */
export function buildVaultData(bundle) {

  const COUNTRY_NAMES = Object.fromEntries(bundle.countries.map((c) => [c.id, c.name]));
  const COUNTRY_POS = Object.fromEntries(bundle.countries.map((c) => [c.id, [c.lat, c.lng]]));
  const COMPANY_BY_ID = Object.fromEntries(bundle.companies.map((c) => [c.id, c]));
  const DOMAINS = Object.fromEntries(bundle.companies.filter((c) => c.domain).map((c) => [c.id, c.domain]));
  const SUPPLIERS = {};
  Object.entries(bundle.customers).forEach(([supId, list]) => {
    list.forEach(([custId, sh]) => (SUPPLIERS[custId] ||= []).push([supId, sh]));
  });
  const data = {
    STAGES: bundle.stages,
    FLOW_EDGES: bundle.flowEdges,
    TIER_LABELS: bundle.tierLabels,
    COUNTRY_NAMES, COUNTRY_POS,
    COMPANIES: bundle.companies, COMPANY_BY_ID, DOMAINS,
    CUSTOMERS: bundle.customers, SUPPLIERS,
    POLICIES: bundle.policies,
    EVENTS: bundle.events,
    SCENARIOS: bundle.scenarios,
    OWNERS: bundle.owners,
    DATA_NOTES: bundle.dataNotes,
    QUOTES: bundle.quotes || {}, // market quotes (price/PE) — display metadata, never an engine input
    META: bundle.meta || {},     // snapshot date + last pipeline run, for the freshness readout
    BRIEFINGS: bundle.briefings || [],           // archive index (no bodies)
    BRIEFING_BODIES: bundle.briefingBodies || {}, // recent bodies, for the static deploy

    COMP_META,
  };
  return data;
}
