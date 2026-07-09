import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildEngine } from '../engine/index.js';
import { COMP_META } from './compMeta.js';
import snapshot from './vault-snapshot.json';

/* ====================================================================
   The vault: all company/stage/customer/policy/event/owner data lives
   in the backend's SQLite database (server/), not in the JS bundle.
   This context fetches it once on load and builds the derived engine
   (risk scores, shock propagation, rankings) from whatever comes back —
   so updating the data means writing to the vault's admin API, not
   editing and redeploying this app.

   Fallback: if no vault API is reachable (e.g. a static-only deploy with
   no backend hosted yet), this falls back to `vault-snapshot.json` — a
   build-time snapshot of the same seed data the backend seeds from (see
   scripts/build-vault-snapshot.mjs) — so the site still works standalone.
   The moment a real backend is configured (VITE_API_BASE_URL) and
   reachable, live data takes over automatically; no code change needed. */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

const VaultCtx = createContext(null);

function buildVaultState(bundle, source) {
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
    COMP_META,
  };
  const engine = buildEngine({
    STAGES: data.STAGES, FLOW_EDGES: data.FLOW_EDGES, COMPANIES: data.COMPANIES,
    CUSTOMERS: data.CUSTOMERS, POLICIES: data.POLICIES, EVENTS: data.EVENTS, OWNERS: data.OWNERS,
  });
  return { status: 'ready', data, engine, source, error: null };
}

export function VaultProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', data: null, source: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/bundle`)
      .then((r) => {
        if (!r.ok) throw new Error(`Vault API returned ${r.status}`);
        return r.json();
      })
      .then((bundle) => {
        if (cancelled) return;
        setState(buildVaultState(bundle, 'live'));
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('SSCIM: vault API unreachable, falling back to static snapshot.', err);
        setState(buildVaultState(snapshot, 'static'));
      });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => state, [state]);
  return <VaultCtx.Provider value={value}>{children}</VaultCtx.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultCtx);
  if (!ctx) throw new Error('useVault() must be called inside <VaultProvider>');
  return ctx;
}
