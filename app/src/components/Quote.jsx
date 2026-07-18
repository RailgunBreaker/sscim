import { C } from '../theme.js';

/* Market-quote line for a company (price, day change, trailing/forward P/E).
   Pure display metadata sourced from the vault's `quotes` table (see server/
   scripts/fetch-quotes.mjs) — never an input to any risk computation. On the
   static GitHub Pages deploy the values are as of the last build (the
   timestamp is always shown); against a live backend they are as fresh as the
   last fetch run. Unlisted companies render a "not listed" note instead. */

const fmtPrice = (q) => {
  const p = q.price >= 1000 ? q.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : q.price.toFixed(2);
  return q.currency === 'USD' ? `$${p}` : `${p} ${q.currency || ''}`.trim();
};

export default function Quote({ quote, compact = false }) {
  if (!quote) {
    return compact ? null : (
      <span className="mono" style={{ fontSize: 10, color: C.faint }}>not publicly listed — no market quote</span>
    );
  }
  const chg = quote.changePct;
  const chgColor = chg == null ? C.faint : chg >= 0 ? C.green : C.red;
  const pe = quote.trailingPE;
  if (compact) {
    return (
      <span className="mono" style={{ fontSize: 9.5, color: C.dim, whiteSpace: 'nowrap' }} title={`${quote.ticker} · as of ${new Date(quote.asOf).toLocaleString()}`}>
        {fmtPrice(quote)}{pe != null ? ` · PE ${pe.toFixed(1)}` : ''}
      </span>
    );
  }
  return (
    <span className="mono" style={{ fontSize: 11, color: C.dim }} title={`As of ${new Date(quote.asOf).toLocaleString()} — quotes are display metadata only, never a model input.`}>
      <b style={{ color: C.text }}>{quote.ticker}</b>{' '}
      <b style={{ color: C.text }}>{fmtPrice(quote)}</b>
      {chg != null && <span style={{ color: chgColor }}> {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</span>}
      {pe != null
        ? <span> · P/E <b style={{ color: C.text }}>{pe.toFixed(1)}</b>{quote.forwardPE != null && <span style={{ color: C.faint }}> (fwd {quote.forwardPE.toFixed(1)})</span>}</span>
        : <span style={{ color: C.faint }}> · P/E n/a</span>}
      <span style={{ color: C.faint }}> · as of {new Date(quote.asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
    </span>
  );
}
