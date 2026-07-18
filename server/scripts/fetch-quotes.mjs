/* Refreshes the `quotes` table (price, day change, trailing/forward P/E,
   market cap) for every company with a public listing in src/tickers.js,
   using Yahoo Finance's batch quote endpoint (cookie + crumb handshake,
   no API key). Quotes are display metadata only — the risk engine never
   reads them — so a failed refresh is never fatal: the CI step runs this
   best-effort and falls back to whatever the committed database holds.

   Run from server/:  node scripts/fetch-quotes.mjs
   Then re-export the snapshot:  cd ../app && npm run snapshot  */
import { db } from '../src/db.js';
import { COMPANY_TICKERS } from '../src/tickers.js';

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

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
console.log(`Quotes refreshed: ${ok}/${symbols.length} listed companies (${Object.keys(COMPANY_TICKERS).length - symbols.length} unlisted, no quote by design). As of ${asOf}.`);
if (missing.length) console.warn(`No quote returned for: ${missing.join(', ')}`);
