/* ====================================================================
   quoteFormat — how a market quote is worded.

   Pulled out of the component because the wording makes claims that are
   easy to get wrong and worth testing directly.

   THE TRAP THIS EXISTS TO AVOID. A quote has two timestamps that are
   routinely days apart:

     asOf        when WE fetched it
     marketTime  when the price last TRADED on the exchange

   A screen showing "as of 30 seconds ago" against a Friday close tells
   a reader, on a Sunday, that the market is open and this is the live
   price. Both of those are false. So the headline age is always the age
   of the PRICE, and the fetch time is secondary — shown only where it
   adds something, which is when our copy is itself behind.

   Every label here is one an ordinary quote screen would use, because a
   reader already knows what "At close" and "After hours" mean and does
   not need this product to invent vocabulary for them.
   ==================================================================== */

/* Yahoo's marketState values, and what each one means for a reader.
   `live` drives the pulse: it is true only while the price can actually
   move, which pre- and post-market trading counts as. */
const MARKET_STATE = {
  REGULAR: { label: 'Market open', live: true },
  PRE: { label: 'Pre-market', live: true },
  PREPRE: { label: 'Before pre-market', live: false },
  POST: { label: 'After hours', live: true },
  POSTPOST: { label: 'After hours closed', live: false },
  CLOSED: { label: 'At close', live: false },
};

export function marketState(state) {
  if (!state) return { label: 'Last trade', live: false, known: false };
  const hit = MARKET_STATE[String(state).toUpperCase()];
  /* An unrecognised state is reported rather than flattened to
     "closed": if the upstream adds a value, a reader should see it. */
  return hit ? { ...hit, known: true } : { label: String(state), live: false, known: false };
}

/* "4 min ago", "2 days ago". Deliberately coarse: a quote that is three
   days old does not become more useful for being told it is 71 hours
   old, and false precision on a stale number reads as freshness. */
export function relativeTime(iso, now = Date.now()) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const secs = Math.round((now - t) / 1000);
  if (secs < 0) return 'just now';          // clock skew; never say "in 3 minutes"
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/* The age that matters is the PRICE's, so marketTime wins when present
   and asOf is only the fallback for a record that predates it. */
export function priceAge(quote, now = Date.now()) {
  const iso = quote?.marketTime || quote?.asOf || null;
  if (!iso) return { iso: null, ms: null, text: null, fromFetchTime: false };
  const ms = now - Date.parse(iso);
  return {
    iso,
    ms: Number.isFinite(ms) ? ms : null,
    text: relativeTime(iso, now),
    fromFetchTime: !quote?.marketTime,
  };
}

/* Past a trading day old the number is history, not a quote, and the
   interface says so rather than printing it as if it were current. */
export const STALE_PRICE_MS = 36 * 60 * 60 * 1000;

export function isStalePrice(quote, now = Date.now()) {
  const { ms } = priceAge(quote, now);
  return ms == null ? true : ms > STALE_PRICE_MS;
}

export function formatPrice(quote) {
  if (!quote || quote.price == null) return '—';
  const p = Math.abs(quote.price) >= 1000
    ? quote.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : quote.price.toFixed(2);
  return quote.currency === 'USD' ? `$${p}` : `${p} ${quote.currency || ''}`.trim();
}

/* The signed line a quote screen puts under the price. The absolute
   change is derived from the previous close when the feed omits it,
   because "−14.01%" with no cash figure is half a quote. */
export function formatChange(quote) {
  if (!quote) return null;
  const pct = quote.changePct;
  let abs = quote.change;
  if (abs == null && quote.prevClose != null && quote.price != null) abs = quote.price - quote.prevClose;
  if (abs == null && pct == null) return null;

  const dir = (abs ?? pct) > 0 ? 'up' : (abs ?? pct) < 0 ? 'down' : 'flat';
  const sign = dir === 'up' ? '+' : dir === 'down' ? '−' : '';
  const absText = abs == null ? null
    : `${sign}${(Math.abs(abs) >= 1000
      ? Math.abs(abs).toLocaleString('en-US', { maximumFractionDigits: 0 })
      : Math.abs(abs).toFixed(2))}`;
  const pctText = pct == null ? null : `${sign}${Math.abs(pct).toFixed(2)}%`;
  return { dir, absText, pctText, text: [absText, pctText && `(${pctText})`].filter(Boolean).join(' ') };
}

/* The one line under the price: what the market is doing and when this
   price is from. Returns parts rather than a string so the component can
   style the live indicator without re-parsing prose. */
export function quoteStatus(quote, now = Date.now()) {
  const state = marketState(quote?.marketState);
  const age = priceAge(quote, now);
  const stale = isStalePrice(quote, now);
  const when = age.iso
    ? new Date(age.iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
    : null;
  /* A "live" state on a price that is a day old is a contradiction, and
     the price wins: the state field is a label, the timestamp is
     evidence. This is what keeps a cached REGULAR from pulsing. */
  const live = state.live && !stale;
  return { ...state, live, stale, when, age: age.text, fromFetchTime: age.fromFetchTime };
}

/* Shown only when our copy is meaningfully behind the exchange, which
   is the case the fetch timestamp is actually informative for. */
export function fetchLag(quote, now = Date.now()) {
  if (!quote?.asOf || !quote?.marketTime) return null;
  const fetched = Date.parse(quote.asOf);
  const traded = Date.parse(quote.marketTime);
  if (!Number.isFinite(fetched) || !Number.isFinite(traded)) return null;
  const sinceFetch = now - fetched;
  if (sinceFetch < 10 * 60 * 1000) return null;     // our copy is current enough
  return relativeTime(quote.asOf, now);
}
