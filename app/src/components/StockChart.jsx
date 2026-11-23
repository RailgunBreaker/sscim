import { useMemo, useRef, useState } from 'react';
import { C } from '../theme.js';
import { RANGES, seriesFor, windowChange, extent, project } from '../utils/quoteSeries.js';
import { formatPrice, quoteStatus } from '../utils/quoteFormat.js';

/* ====================================================================
   StockChart — the price line for one company.

   Display metadata, exactly like the quote line above it: the risk
   engine never reads a price. It is here because a reader looking at a
   company's exposure reasonably wants to know what the market did, and
   a number with no shape is hard to read against a year of news.

   THREE THINGS IT IS CAREFUL ABOUT.

   1. The baseline. Intraday is drawn against the previous close, so the
      chart agrees with the day change the quote prints. Longer windows
      are drawn against the first point IN THAT WINDOW, because "up 12%
      over six months" means against six months ago. The dashed line is
      whichever baseline applies, and it is always inside the frame.

   2. Gaps are gaps. Null closes are dropped rather than interpolated,
      so the line never runs through prices that did not happen.

   3. It says when it is from. A chart is the easiest place to imply
      liveness, so the caption carries the same market state and age the
      quote line does rather than letting a smooth line speak for it.
   ==================================================================== */

const H = 86;
const W = 320;

const tabStyle = (on) => ({
  background: on ? C.accent : 'transparent',
  color: on ? '#0C1218' : C.dim,
  border: `1px solid ${on ? C.accent : C.line}`,
  borderRadius: 4,
  fontSize: 12,
  padding: '2px 7px',
  cursor: 'pointer',
  lineHeight: 1.5,
});

export default function StockChart({ quote, history, compact = false }) {
  const [rangeId, setRangeId] = useState('1M');
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const width = compact ? 240 : W;
  const height = compact ? 62 : H;

  const { points, baseline, empty } = useMemo(
    () => seriesFor(history, rangeId),
    [history, rangeId],
  );
  const band = useMemo(() => extent(points, baseline), [points, baseline]);
  const proj = useMemo(
    () => (band ? project(points, { width, height, ...band }) : null),
    [points, band, width, height],
  );

  if (!history) return null;

  const change = windowChange(points, baseline);
  const dirColor = !change || change.dir === 'flat' ? C.dim : change.dir === 'up' ? C.green : C.red;
  const status = quoteStatus(quote);
  const shown = hover ?? (points.length ? points[points.length - 1] : null);

  const onMove = (e) => {
    if (!proj || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * width;
    setHover(proj.at(x));
  };

  /* Which ranges have data. A 1D tab on a company whose intraday series
     failed to fetch would be a button that silently draws nothing. */
  const available = RANGES.filter((r) => {
    const s = history[r.source];
    return s && Array.isArray(s.v) && s.v.length >= 2;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        {available.map((r) => (
          <button key={r.id} type="button" style={tabStyle(r.id === rangeId)}
            aria-pressed={r.id === rangeId}
            aria-label={`Show ${r.label}`}
            onClick={() => { setRangeId(r.id); setHover(null); }}>
            {r.id}
          </button>
        ))}
        {change && (
          <span className="mono" style={{ fontSize: 12, color: dirColor, marginLeft: 4 }}>
            {change.dir === 'up' ? '+' : change.dir === 'down' ? '−' : ''}
            {Math.abs(change.pct).toFixed(2)}% over {RANGES.find((r) => r.id === rangeId)?.label}
          </span>
        )}
      </div>

      {empty || !proj || !band ? (
        <div className="mono" style={{ fontSize: 12, color: C.faint, padding: '12px 0' }}>
          No price history for this range.
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          style={{ display: 'block', maxWidth: width, overflow: 'visible', cursor: 'crosshair' }}
          role="img"
          aria-label={`${quote?.ticker || 'Price'} chart, ${RANGES.find((r) => r.id === rangeId)?.label}: ${points.length} points, ${change ? `${change.pct.toFixed(2)} percent` : 'no change computed'}.`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* The baseline the change is measured against, always inside
              the frame so the reader can see what "up" is up from. */}
          {baseline != null && (
            <line x1="0" x2={width} y1={proj.yOf(baseline)} y2={proj.yOf(baseline)}
              stroke={C.line} strokeWidth="1" strokeDasharray="3 3" />
          )}
          <path d={proj.d} fill="none" stroke={dirColor} strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" />
          {shown && (
            <>
              <line x1={proj.xOf(shown.t)} x2={proj.xOf(shown.t)} y1="0" y2={height}
                stroke={C.faint} strokeWidth="0.8" opacity={hover ? 0.6 : 0} />
              <circle cx={proj.xOf(shown.t)} cy={proj.yOf(shown.v)} r="2.6" fill={dirColor} />
            </>
          )}
        </svg>
      )}

      <div className="mono" style={{ fontSize: 12, color: C.faint, marginTop: 5, lineHeight: 1.55 }}>
        {shown && (
          <span style={{ color: hover ? C.text : C.faint }}>
            {formatPrice({ price: shown.v, currency: quote?.currency })}
            {' · '}
            {new Date(shown.t).toLocaleString('en-US', {
              month: 'short', day: 'numeric',
              ...(rangeId === '1D' ? { hour: 'numeric', minute: '2-digit' } : {}),
            })}
          </span>
        )}
        {!hover && status.when && (
          <span> · {status.label.toLowerCase()}{status.age ? `, ${status.age}` : ''}</span>
        )}
        {hover && <span> · hover to read any point</span>}
      </div>
    </div>
  );
}
