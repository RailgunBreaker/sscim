/* Refreshes the `quotes` table (price, day change, trailing/forward P/E,
   market cap) for every company with a public listing in src/tickers.js.
   Quotes are display metadata only — the risk engine never reads them — so a
   failed refresh is never fatal: the CI step runs this best-effort and falls
   back to whatever the committed database holds.

   The fetching itself lives in src/quotes.js, shared with the public API so a
   live backend can refresh on demand instead of only at build time.

   Run from server/:  node scripts/fetch-quotes.mjs
   Then re-export the snapshot:  cd ../app && npm run snapshot  */
import { refreshQuotes } from '../src/quotes.js';

const { ok, total, unlisted, asOf, missing } = await refreshQuotes();
console.log(`Quotes refreshed: ${ok}/${total} listed companies (${unlisted} unlisted, no quote by design). As of ${asOf}.`);
if (missing.length) console.warn(`No quote returned for: ${missing.join(', ')}`);
