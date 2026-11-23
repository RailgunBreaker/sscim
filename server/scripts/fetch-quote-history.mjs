/* Refreshes `quote_history` — the series behind the per-company price
   chart — for every company with a public listing in src/tickers.js.

   Separate from fetch-quotes.mjs because it is a different cost profile:
   quotes are one batched request for all 92 symbols, history is two
   requests per symbol and takes a couple of minutes. The pipeline can
   run quotes often and history rarely without the two fighting.

   Display metadata only — the risk engine never reads it — so a failed
   refresh leaves the previous series in place rather than blanking a
   chart.

   Run from server/:  node scripts/fetch-quote-history.mjs
   Then re-export the snapshot:  cd ../app && npm run snapshot  */
import { refreshQuoteHistory } from '../src/quotes.js';

let done = 0;
const { ok, total, failed, asOf } = await refreshQuoteHistory({
  onProgress: () => {
    done += 1;
    if (done % 10 === 0) process.stdout.write(`  …${done} companies\n`);
  },
});

console.log(`Quote history refreshed: ${ok}/${total} series. As of ${asOf}.`);
if (failed.length) {
  console.warn(`${failed.length} series failed:`);
  for (const f of failed.slice(0, 20)) console.warn(`  - ${f}`);
  if (failed.length > 20) console.warn(`  … and ${failed.length - 20} more`);
}
