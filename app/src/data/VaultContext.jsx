import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { buildOperationalVault } from './operationalVault.js';
import { reconcileBundle, staleLiveMessage } from './reconcileBundle.js';
import snapshot from './operational-snapshot.json';

/* ====================================================================
   The vault: all company/stage/customer/policy/event/owner data lives
   in the backend's SQLite database (server/), not in the JS bundle.
   This context refreshes the bundle and exposes reviewed evidence to the
   dashboard. The legacy score and inferred-facility engines are not run.

   Fallback: if no vault API is reachable (e.g. the GitHub Pages deploy,
   which is static-only), this falls back to `vault-snapshot.json` — a
   build-time export of the same committed SQLite database the backend
   serves (see scripts/build-vault-snapshot.mjs) — so the site works
   standalone and still reflects the latest committed vault edits.
   The moment a real backend is configured (VITE_API_BASE_URL) and
   reachable, live data takes over automatically; no code change needed. */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export const VaultCtx = createContext(null);

function buildVaultState(rawBundle, source) {
  /* A live API can be older than the build talking to it — it answers 200
     with valid JSON that simply has no `facilities` key, because the running
     process still holds the previous bundle.js. Fill only the sections it
     omits entirely, from the snapshot this build shipped with, and keep a
     record so the interface can say so instead of rendering an empty map.
     See reconcileBundle.js for why a smaller-but-present section is left
     alone. */
  const { bundle, filled, dropped, stale } = source === 'live'
    ? reconcileBundle(rawBundle, snapshot)
    : { bundle: rawBundle, filled: [], dropped: 0, stale: false };

  const data = buildOperationalVault(bundle);
  data.LIVE_GAPS = { filled, dropped, stale, message: staleLiveMessage({ filled, dropped }) };
  if (stale) {
    console.warn(`SSCIM: ${staleLiveMessage({ filled, dropped })}`);
  }
  return { status: 'ready', data, engine: null, source, error: null };
}

/* Quotes and the evidence bundle refresh independently every minute. A failed
   bundle refresh retains the last successful data and exposes its status. */
const QUOTE_POLL_MS = 60_000;

export function VaultProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', data: null, source: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/bundle`, { signal: AbortSignal.timeout(15000) })
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

  // Refresh reviewed incidents as well as quotes. An API connection alone did
  // not previously refresh the news dataset after the initial page load.
  useEffect(() => {
    let cancelled = false, pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`${API_BASE}/api/bundle`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`bundle ${response.status}`);
        const bundle = await response.json();
        if (!cancelled) setState(buildVaultState(bundle, 'live'));
      } catch {
        if (!cancelled) setState(previous => previous.data ? { ...previous,
          data: { ...previous.data, REFRESH_FAILED: true } } : previous);
      } finally { pending = false; }
    };
    const timer = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (state.source !== 'live') return undefined; // static deploy: quotes are as of the last build
    let cancelled = false;
    const poll = () => {
      fetch(`${API_BASE}/api/quotes`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`quotes ${r.status}`))))
        .then((payload) => {
          if (cancelled || !payload?.quotes) return;
          setState((prev) => (prev.data
            ? { ...prev, data: { ...prev.data, QUOTES: payload.quotes, QUOTES_AS_OF: payload.asOf, QUOTES_STALE: payload.stale } }
            : prev));
        })
        .catch(() => { /* keep the quotes already on screen */ });
    };
    const timer = setInterval(poll, QUOTE_POLL_MS);
    poll();
    return () => { cancelled = true; clearInterval(timer); };
  }, [state.source]);

  const value = useMemo(() => state, [state]);
  return <VaultCtx.Provider value={value}>{children}</VaultCtx.Provider>;
}

export function useVault() {
  const ctx = useContext(VaultCtx);
  if (!ctx) throw new Error('useVault() must be called inside <VaultProvider>');
  return ctx;
}
