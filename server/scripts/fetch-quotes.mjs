/* Refreshes the `quotes` table (price, day change, trailing/forward P/E,
   market cap) for every company with a public listing in src/tickers.js.
   Quotes are display metadata only — the risk engine never reads them — so a
   failed refresh is never fatal: the CI step runs this best-effort and falls
   back to whatever the committed database holds.

   The fetching itself lives in src/quotes.js, shared with the public API so a
   live backend can refresh on demand instead of only at build time.

   Run from server/:  node scripts/fetch-quotes.mjs
   Then re-export the snapshot:  cd ../app && npm run snapshot  */
import { writeSync } from 'node:fs';
import { refreshQuotes } from '../src/quotes.js';

const { ok, total, unlisted, asOf, missing } = await refreshQuotes();
writeSync(1, `Quotes refreshed: ${ok}/${total} listed companies (${unlisted} unlisted, no quote by design). As of ${asOf}.
`);
if (missing.length) writeSync(2, `No quote returned for: ${missing.join(', ')}
`);

/* Exits explicitly for the same reason build-vault-snapshot.mjs does: this
   script writes to the vault, and letting V8 tear the heap down destroys
   leftover better-sqlite3 statement wrappers, which aborts the process. Here
   the CI step is `|| echo ::warning::`, so that abort would have been reported
   as a failed quote refresh rather than as the addon crash it is. */
process.exit(0);
