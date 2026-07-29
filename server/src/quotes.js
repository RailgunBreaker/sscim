/* Market-quote refresh, shared by scripts/fetch-quotes.mjs (batch, run by the
   pipeline) and routes/public.js (on demand, when the API is serving a live
   dashboard).

   Why both: on the static GitHub Pages deploy the quotes are whatever the last
   build baked into vault-snapshot.json, so they are up to a day old and there
   is nothing the page can do about it. But when the dashboard is talking to a
   real backend — this PC, per docs/SYSTEM_ARCHITECTURE.md — the data can be
   current, and serving a day-old price in that situation is a self-inflicted
   limitation rather than an architectural one.

   Quotes remain display metadata. Nothing here feeds the risk engine, so a
   failed refresh degrades to "slightly older prices", never to a wrong score.

   Yahoo's batch endpoint needs a cookie + crumb handshake but no API key. */
import { db } from './db.js';
import { COMPANY_TICKERS } from './tickers.js';

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

/* How old stored quotes may be before an API read triggers a refresh, and the
   floor between refresh attempts. The floor matters most when the upstream is
   failing: without it every request would retry a broken handshake. */
export const STALE_AFTER_MS = 15 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;

let lastAttempt = 0;
let inFlight = null;

async function yahooSession() {
  const r = await fetch('https://fc.yahoo.com', { headers: UA, redirect: 'manual' }).catch((e) => e);
  const cookie = (r.headers?.get?.('set-cookie') || '').split(';')[0];
  if (!cookie) throw new Error('No Yahoo session cookie');
  const cr = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { ...UA, cookie } });
  const crumb = (await cr.text()).trim();
  if (!cr.ok || !crumb || crumb.includes('{')) throw new Error(`No crumb (HTTP ${cr.status})`);
  return { cookie, crumb };
}

async function fetchBatch(symbols, { cookie, crumb }) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(','))}&crumb=${encodeURIComponent(crumb)}`;
  const r = await fetch(url, { headers: { ...UA, cookie } });
  if (!r.ok) throw new Error(`Quote request failed: HTTP ${r.status}`);
  const j = await r.json();
  return j.quoteResponse?.result ?? [];
}

/* ISO timestamp of the freshest stored quote, or null when the table is empty. */
export function quotesAsOf() {
  return db.prepare('SELECT MAX(as_of) AS as_of FROM quotes').get()?.as_of ?? null;
}

export function quotesAreStale(maxAgeMs = STALE_AFTER_MS) {
  const asOf = quotesAsOf();
  if (!asOf) return true;
  const age = Date.now() - Date.parse(asOf);
  return !Number.isFinite(age) || age > maxAgeMs;
}

export async function refreshQuotes() {
  const entries = Object.entries(COMPANY_TICKERS).filter(([, sym]) => sym);
  const bySymbol = new Map(entries.map(([id, sym]) => [sym, id]));
  const symbols = entries.map(([, sym]) => sym);

  const session = await yahooSession();
  const results = [];
  for (let i = 0; i < symbols.length; i += 40) {
    results.push(...await fetchBatch(symbols.slice(i, i + 40), session));
  }

  const upsert = db.prepare(`INSERT INTO quotes (company_id, ticker, price, currency, change_pct, trailing_pe, forward_pe, market_cap, as_of)
    VALUES (@company_id, @ticker, @price, @currency, @change_pct, @trailing_pe, @forward_pe, @market_cap, @as_of)
    ON CONFLICT(company_id) DO UPDATE SET ticker=excluded.ticker, price=excluded.price, currency=excluded.currency,
      change_pct=excluded.change_pct, trailing_pe=excluded.trailing_pe, forward_pe=excluded.forward_pe,
      market_cap=excluded.market_cap, as_of=excluded.as_of`);

  const asOf = new Date().toISOString();
  let ok = 0;
  db.transaction(() => {
    for (const q of results) {
      const companyId = bySymbol.get(q.symbol);
      if (!companyId || q.regularMarketPrice == null) continue;
      upsert.run({
        company_id: companyId, ticker: q.symbol,
        price: q.regularMarketPrice, currency: q.currency ?? null,
        change_pct: q.regularMarketChangePercent ?? null,
        trailing_pe: q.trailingPE ?? null, forward_pe: q.forwardPE ?? null,
        market_cap: q.marketCap ?? null, as_of: asOf,
      });
      ok++;
    }
  })();
  db.pragma('wal_checkpoint(TRUNCATE)');

  const missing = symbols.filter((s) => !results.some((q) => q.symbol === s && q.regularMarketPrice != null));
  return { ok, total: symbols.length, unlisted: Object.keys(COMPANY_TICKERS).length - symbols.length, asOf, missing };
}

/* Fire-and-forget refresh for the read path: never awaited by the request, so
   a slow or dead upstream cannot delay the response. Concurrent callers share
   one in-flight attempt. Returns whether a refresh was started. */
export function refreshQuotesInBackground() {
  if (inFlight) return false;
  if (Date.now() - lastAttempt < MIN_REFRESH_INTERVAL_MS) return false;
  lastAttempt = Date.now();
  inFlight = refreshQuotes()
    .catch((err) => { console.warn(`Quote refresh failed: ${err.message}`); })
    .finally(() => { inFlight = null; });
  return true;
}
