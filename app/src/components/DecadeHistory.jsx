import { useMemo, useState } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { getEventAssumption } from '../engine/event-assumptions.js';
import { analyzeIndexHistory, NEUTRAL_INDEX } from '../engine/timeseries.js';
import { TYPE_COLORS } from '../utils/colors.js';
import { onEnterSpace } from '../utils/a11y.js';

/* ================= Decade index history =================
   Browse every event in the vault's ten-year window and what each one did to
   the index. All numbers come from engine/timeseries.js, which replays the
   engine rather than re-deriving anything — see that file's header for why
   attribution is marginal rather than standalone.

   Deliberately a separate panel from IndexHistory: that chart is for browsing
   recent movement at a chosen range, this one is for reading the decade. */

const W = 620, PL = 26, PR = 8, PT = 12, PB = 20, H = 150, RUG = 12, DAY = 86400000;

const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const fmtMonth = (ms) => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
const signed = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;

function Stat({ label, value, sub, tone }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: '7px 9px', minWidth: 0 }}>
      <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1.1, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: tone || C.text, lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div className="mono" style={{ fontSize: 8.5, color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

export default function DecadeHistory({ onSelectEvent }) {
  const { data, engine } = useVault();
  const asOf = Date.parse(engine.MODEL_PRIORS.datasetAsOf);
  const [sort, setSort] = useState('impact');
  const [scoredOnly, setScoredOnly] = useState(true);
  const [hover, setHover] = useState(null);

  /* One replay for the whole panel: ~3,600 index samples plus two more per
     scored event for the marginal attribution. Memoized on the engine, so it
     runs once per dataset rather than once per interaction. */
  const analysis = useMemo(
    () => analyzeIndexHistory(engine, getEventAssumption, { asOfMs: asOf }),
    [engine, asOf],
  );

  const chart = useMemo(() => {
    const pts = analysis.points;
    const maxT = pts[0]?.daysAgo || 1;
    const yMin = Math.min(4.7, ...pts.map((p) => p.index));
    const yMax = Math.max(5.3, ...pts.map((p) => p.index)) + 0.1;
    const x = (d) => PL + (1 - d / maxT) * (W - PL - PR);
    const y = (v) => PT + RUG + (1 - (v - yMin) / (yMax - yMin)) * (H - PT - PB - RUG);
    const line = (arr) => arr.map((p) => `${x(p.daysAgo).toFixed(1)},${y(p.index).toFixed(1)}`).join(' ');
    const years = [];
    for (let yr = new Date(asOf - maxT * DAY).getUTCFullYear() + 1; yr <= new Date(asOf).getUTCFullYear(); yr++) {
      const d = Math.round((asOf - Date.parse(`${yr}-01-01`)) / DAY);
      if (d >= 0 && d <= maxT) years.push({ yr, px: x(d) });
    }
    const rug = analysis.impacts.filter((i) => i.operational && i.daysAgo <= maxT)
      .map((i) => ({ id: i.id, px: x(i.daysAgo), h: 3 + (i.sev / 10) * (RUG - 4) }));
    return { maxT, x, y, yMin, yMax, series: line(pts), trend: line(analysis.trend), years, rug, pts };
  }, [analysis, asOf]);

  const rows = useMemo(() => {
    const list = analysis.impacts.filter((i) => (scoredOnly ? i.operational : true));
    return sort === 'impact'
      ? [...list].sort((a, b) => Math.abs(b.marginal) - Math.abs(a.marginal))
      : [...list].sort((a, b) => a.daysAgo - b.daysAgo);
  }, [analysis, sort, scoredOnly]);

  const { stats } = analysis;
  const scoredCount = analysis.impacts.filter((i) => i.operational).length;
  const years = Math.round(stats.samples / 365.25);

  const move = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const mx = ((evt.clientX - rect.left) / rect.width) * W;
    const target = chart.maxT * (1 - (mx - PL) / (W - PL - PR));
    const point = chart.pts.reduce((best, p) => (Math.abs(p.daysAgo - target) < Math.abs(best.daysAgo - target) ? p : best), chart.pts[0]);
    setHover({
      ...point,
      near: analysis.impacts.filter((i) => i.operational && Math.abs(i.daysAgo - point.daysAgo) <= 3),
    });
  };

  return (
    <div>
      <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginBottom: 8, lineHeight: 1.5 }}>
        Every event in the {years}-year window, and what each did to the index. <b style={{ color: C.dim }}>Impact</b> is
        marginal: the index on the event&apos;s own date minus the same date with that event removed. Because
        simultaneous shocks combine through a saturating noisy-OR, marginal effects are smaller than
        standalone ones and do <b style={{ color: C.dim }}>not</b> sum to the index — that is the honest
        attribution, not a rounding artifact.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 6, marginBottom: 10 }}>
        <Stat label="EVENTS" value={analysis.impacts.length} sub={`${scoredCount} scored`} />
        <Stat label="MEAN INDEX" value={stats.mean.toFixed(2)} sub={`sd ${stats.sd.toFixed(2)}`} />
        <Stat label="DECADE PEAK" value={stats.max.toFixed(2)} sub={fmtMonth(asOf - stats.maxAt.daysAgo * DAY)} tone={C.red} />
        <Stat label="DAYS ABOVE 6" value={stats.daysAbove6} sub={`${(100 * stats.daysAbove6 / stats.samples).toFixed(1)}% of days`} />
        <Stat label="AT NEUTRAL" value={`${(100 * stats.daysFlat / stats.samples).toFixed(0)}%`} sub={`${stats.daysFlat} days at 5.00`} />
        <Stat label="LOWEST" value={stats.min.toFixed(2)} sub={fmtMonth(asOf - stats.minAt.daysAgo * DAY)} tone={C.green} />
      </div>

      <div style={{ border: `1px solid ${C.line}`, background: C.panel2, borderRadius: 8, padding: '8px 10px', marginBottom: 10, position: 'relative' }}>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.dim, marginBottom: 4 }}>
          DECADE REPLAY
          <span style={{ color: C.faint, letterSpacing: 0.2, marginLeft: 7 }}>daily · 5 neutral · ticks are scored events, sized by severity</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
          role="img" aria-label={`Computed chain index over the past ${years} years. Mean ${stats.mean.toFixed(2)}, peak ${stats.max.toFixed(2)}.`}
          onMouseMove={move} onMouseLeave={() => setHover(null)}>
          {chart.years.map((t) => (
            <g key={t.yr}>
              <line x1={t.px} y1={PT + RUG} x2={t.px} y2={H - PB} stroke={C.line} strokeWidth="1" />
              <text x={t.px} y={H - 6} textAnchor="middle" fill={C.faint} fontSize="8">{`'${String(t.yr).slice(2)}`}</text>
            </g>
          ))}
          <line x1={PL} y1={chart.y(NEUTRAL_INDEX)} x2={W - PR} y2={chart.y(NEUTRAL_INDEX)} stroke={C.line} />
          {[chart.yMax - 0.1, NEUTRAL_INDEX].map((v) => (
            <text key={v} x="2" y={chart.y(v) + 3} fill={C.faint} fontSize="8">{v.toFixed(1)}</text>
          ))}
          {chart.rug.map((r) => (
            <line key={r.id} x1={r.px} y1={PT + RUG - 1} x2={r.px} y2={PT + RUG - 1 - r.h} stroke={C.faint} strokeWidth="1" opacity="0.55" />
          ))}
          <polyline points={chart.trend} fill="none" stroke={C.dim} strokeWidth="1" opacity="0.75" />
          <polyline points={chart.series} fill="none" stroke={C.copper} strokeWidth="1.4" strokeLinejoin="round" />
          {hover && (
            <g pointerEvents="none">
              <line x1={chart.x(hover.daysAgo)} y1={PT + RUG} x2={chart.x(hover.daysAgo)} y2={H - PB} stroke={C.dim} strokeWidth=".75" />
              <circle cx={chart.x(hover.daysAgo)} cy={chart.y(hover.index)} r="3" fill="none" stroke={C.text} />
            </g>
          )}
        </svg>
        <div className="mono" style={{ fontSize: 8.5, color: C.faint, marginTop: 2 }}>
          grey line = 91-day centred mean (trend under the spikes)
        </div>
        {hover && (
          <div className="mono" style={{ position: 'absolute', left: `${Math.min(70, Math.max(2, (chart.x(hover.daysAgo) / W) * 100))}%`, top: 40, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, padding: '4px 8px', fontSize: 9.5, color: C.dim, pointerEvents: 'none', maxWidth: 250, zIndex: 5 }}>
            <span style={{ color: C.text }}>{fmtDate(asOf - hover.daysAgo * DAY)}</span> — index {hover.index.toFixed(2)}
            {hover.near.map((i) => <div key={i.id} style={{ color: i.marginal < 0 ? C.green : C.red, marginTop: 2 }}>{i.title}</div>)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 7 }}>
        <span className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.dim }}>EVENTS BY IMPACT</span>
        <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }}>
          {[['impact', 'IMPACT'], ['date', 'DATE']].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className="mono"
              style={{ border: `1px solid ${sort === k ? C.copper : C.line}`, background: sort === k ? 'rgba(201,138,63,.14)' : 'transparent', color: sort === k ? C.copper : C.dim, borderRadius: 4, fontSize: 9, padding: '3px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
          <button type="button" aria-pressed={!scoredOnly} onClick={() => setScoredOnly((v) => !v)} className="mono"
            style={{ border: `1px solid ${!scoredOnly ? C.copper : C.line}`, background: !scoredOnly ? 'rgba(201,138,63,.14)' : 'transparent', color: !scoredOnly ? C.copper : C.dim, borderRadius: 4, fontSize: 9, padding: '3px 6px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {scoredOnly ? 'SCORED ONLY' : 'ALL EVENTS'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        {rows.map((i) => {
          const mitigating = i.marginal < -0.005;
          const tone = !i.operational ? C.faint : mitigating ? C.green : C.red;
          return (
            <div key={i.id} role="button" tabIndex={0}
              onClick={() => onSelectEvent?.(i.id)} onKeyDown={onEnterSpace(() => onSelectEvent?.(i.id))}
              className="evcard"
              style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: '6px 9px', marginBottom: 5 }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontSize: 9.5, color: C.faint, minWidth: 74 }}>{fmtDate(asOf - i.daysAgo * DAY)}</span>
                <span className="mono" style={{ fontSize: 8.5, letterSpacing: 0.8, color: TYPE_COLORS[i.type] || C.copper }}>{i.type.toUpperCase()}</span>
                <span className="mono" style={{ fontSize: 9, color: C.faint }}>sev {i.sev}</span>
                <span className="mono" style={{ fontSize: 10.5, color: tone, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}
                  title={i.operational
                    ? `Marginal effect on the index on this date: ${signed(i.marginal)}. Alone it would have moved the index ${signed(i.standalone)}. Index that day: ${i.indexOnDate.toFixed(2)}.`
                    : i.reason}>
                  {i.operational ? `${signed(i.marginal)} index` : 'not scored'}
                </span>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 4, lineHeight: 1.35 }}>{i.title}</div>
              {i.operational && (
                <div className="mono" style={{ fontSize: 8.5, color: C.faint, marginTop: 3 }}>
                  index that day {i.indexOnDate.toFixed(2)} · alone {signed(i.standalone)} · {i.direction}/{i.channel}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.dim, marginBottom: 6 }}>BY YEAR</div>
      <div style={{ overflowX: 'auto', border: `1px solid ${C.line}`, borderRadius: 6, marginBottom: 10 }}>
        <table className="mono" style={{ borderCollapse: 'collapse', width: '100%', fontSize: 9.5 }}>
          <thead>
            <tr style={{ color: C.faint }}>
              {['YEAR', 'EVENTS', 'SCORED', 'MEAN', 'MAX', 'DAYS >6', 'AT 5.00'].map((h) => (
                <th key={h} scope="col" style={{ textAlign: h === 'YEAR' ? 'left' : 'right', padding: '5px 8px', borderBottom: `1px solid ${C.line}`, fontWeight: 400, letterSpacing: 0.8, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.byYear.map((y) => (
              <tr key={y.year} style={{ color: C.dim }}>
                <th scope="row" style={{ textAlign: 'left', padding: '4px 8px', color: C.text, fontWeight: 600 }}>{y.year}</th>
                <td style={{ textAlign: 'right', padding: '4px 8px' }}>{y.events}</td>
                <td style={{ textAlign: 'right', padding: '4px 8px' }}>{y.scored}</td>
                <td style={{ textAlign: 'right', padding: '4px 8px' }}>{y.mean.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '4px 8px', color: y.max > 6 ? C.red : C.dim }}>{y.max.toFixed(2)}</td>
                <td style={{ textAlign: 'right', padding: '4px 8px' }}>{y.daysAbove6}</td>
                <td style={{ textAlign: 'right', padding: '4px 8px' }}>{y.daysFlat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.dim, marginBottom: 6 }}>WHICH KIND OF SHOCK DROVE IT</div>
      <div style={{ marginBottom: 10 }}>
        {analysis.byType.map((r) => {
          const width = Math.max(1, Math.abs(r.total) / Math.max(...analysis.byType.map((q) => Math.abs(q.total))) * 100);
          return (
            <div key={r.type} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="mono" style={{ fontSize: 9.5, color: C.dim, width: 132, flex: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.type}</span>
              <span className="mono" style={{ fontSize: 9, color: C.faint, width: 26, flex: 'none', textAlign: 'right' }}>{r.count}</span>
              <div style={{ flex: 1, minWidth: 40, height: 8, background: C.panel, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${width}%`, height: '100%', background: r.total < 0 ? C.green : C.copper, borderRadius: 2 }} />
              </div>
              <span className="mono" style={{ fontSize: 9.5, color: C.dim, width: 46, flex: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{signed(r.total)}</span>
            </div>
          );
        })}
      </div>

      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.dim, marginBottom: 6 }}>LONGEST ELEVATED STRETCHES (INDEX ABOVE 6)</div>
      <div style={{ marginBottom: 10 }}>
        {analysis.elevatedRuns.slice(0, 6).map((r) => (
          <div key={r.fromDaysAgo} className="mono" style={{ fontSize: 9.5, color: C.dim, padding: '3px 0', borderBottom: `1px solid ${C.line}` }}>
            <span style={{ color: C.text }}>{r.samples}d</span>
            {' '}{fmtDate(asOf - r.fromDaysAgo * DAY)} → {fmtDate(asOf - r.toDaysAgo * DAY)}
            <span style={{ color: C.red, marginLeft: 6 }}>peak {r.peak.toFixed(2)}</span>
          </div>
        ))}
        {!analysis.elevatedRuns.length && <div className="mono" style={{ fontSize: 9.5, color: C.faint }}>The index never exceeded 6 in this window.</div>}
      </div>

      {analysis.densityCorrelation != null && (
        <div className="mono" style={{ fontSize: 9, color: C.faint, lineHeight: 1.55, border: `1px solid ${C.line}`, borderRadius: 6, padding: '7px 9px' }}>
          <b style={{ color: C.amber }}>Read the density caveat.</b> Correlation between the index and the trailing
          30-day severity mass of scored events is <b style={{ color: C.dim }}>r = {analysis.densityCorrelation.toFixed(2)}</b>.
          The index therefore partly measures how thoroughly each period was curated, not only what happened:
          a month with more ingested records scores higher than an equally eventful month with fewer.
          Compare the EVENTS and SCORED columns per year before reading a trend into the means.
          Snapshot date {data.META?.snapshotDate || engine.MODEL_PRIORS.datasetAsOf}.
        </div>
      )}
    </div>
  );
}
