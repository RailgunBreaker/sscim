import { useEffect, useState } from 'react';
import { C } from '../theme.js';
import {
  formatPrice, formatChange, quoteStatus, fetchLag,
} from '../utils/quoteFormat.js';

/* Market-quote line for a company, in the shape an ordinary quote screen
   uses: price, the signed change in both cash and percent, and a status
   line saying what the market is doing and when this price is from.

   Pure display metadata from the vault's `quotes` table (server/scripts/
   fetch-quotes.mjs) — never an input to any risk computation. Against a
   live backend the vault polls quotes every 60 seconds; on the static
   deploy they are as of the last build. Either way the headline age is
   the age of the PRICE, not of our fetch, because on a weekend those are
   two days apart and only one of them is what the reader is asking about.

   Unlisted companies render a "not listed" note rather than nothing, so
   the absence is stated instead of looking like a loading failure. */

/* The clock ticks so "4 min ago" does not sit frozen on an open market.
   Thirty seconds is enough for a minute-resolution label and cheap
   enough to run on every mounted quote. */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const PULSE = `
  @keyframes q-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
  .q-live { animation: q-pulse 2s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .q-live { animation: none; } }
`;

export default function Quote({ quote, compact = false }) {
  const now = useNow(Boolean(quote));

  if (!quote) {
    return compact ? null : (
      <span className="mono" style={{ fontSize: 12, color: C.faint }}>not publicly listed — no market quote</span>
    );
  }

  const status = quoteStatus(quote, now);
  const change = formatChange(quote);
  const lag = fetchLag(quote, now);
  const dirColor = !change || change.dir === 'flat' ? C.dim : change.dir === 'up' ? C.green : C.red;
  const arrow = !change || change.dir === 'flat' ? '' : change.dir === 'up' ? '▲' : '▼';
  const pe = quote.trailingPE;

  const title = [
    `${quote.ticker}${quote.exchange ? ` · ${quote.exchange}` : ''}`,
    status.when ? `${status.label}: ${status.when}${status.age ? ` (${status.age})` : ''}` : null,
    quote.prevClose != null ? `Previous close ${formatPrice({ ...quote, price: quote.prevClose })}` : null,
    lag ? `Our copy fetched ${lag}` : null,
    'Display metadata only — never a model input.',
  ].filter(Boolean).join('\n');

  if (compact) {
    return (
      <span className="mono" style={{ fontSize: 12, color: C.dim, whiteSpace: 'nowrap' }} title={title}>
        {formatPrice(quote)}
        {change?.pctText && <span style={{ color: dirColor }}> {change.pctText}</span>}
      </span>
    );
  }

  return (
    <span className="mono" style={{ fontSize: 12, color: C.dim, display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 7 }} title={title}>
      <style>{PULSE}</style>

      <b style={{ color: C.text }}>{quote.ticker}</b>
      <b style={{ color: C.text, fontSize: 14 }}>{formatPrice(quote)}</b>

      {change && (
        <span style={{ color: dirColor }}>
          {arrow && <span aria-hidden="true">{arrow} </span>}
          {change.text}
        </span>
      )}

      {/* Status: what the market is doing, and when this price is from.
          The dot pulses only while the price can actually move. */}
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, color: C.faint }}>
        <span
          className={status.live ? 'q-live' : undefined}
          aria-hidden="true"
          style={{
            width: 6, height: 6, borderRadius: '50%', alignSelf: 'center',
            background: status.live ? C.green : C.faint,
          }}
        />
        <span>{status.label}</span>
        {status.when && <span>· {status.when}</span>}
        {status.age && <span>· {status.age}</span>}
      </span>

      {/* Staleness is stated, not implied by an old date the reader has
          to do arithmetic on. */}
      {status.stale && (
        <span style={{ color: C.amber }}>
          · not a live price{status.fromFetchTime ? ' (no exchange timestamp on this record)' : ''}
        </span>
      )}
      {lag && <span style={{ color: C.faint }}>· our copy {lag}</span>}

      {pe != null
        ? <span>· P/E <b style={{ color: C.text }}>{pe.toFixed(1)}</b>{quote.forwardPE != null && <span style={{ color: C.faint }}> (fwd {quote.forwardPE.toFixed(1)})</span>}</span>
        : <span style={{ color: C.faint }}>· P/E n/a</span>}
    </span>
  );
}
