import { useMemo, useState } from 'react';
import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { getEventAssumption } from '../engine/event-assumptions.js';

const W = 560, PL = 30, PR = 10, PT = 10, PB = 22, DAY = 86400000;
const RANGES = [['3D', 3], ['7D', 7], ['30D', 30], ['6M', 183], ['1Y', 365], ['5Y', 1826], ['10Y', 3652], ['ALL', Infinity]];

export default function IndexHistory({ engine, events, onSelectEvent }) {
  const { LONG_HISTORY, MODEL_PRIORS } = engine;
  const [range, setRange] = useState('ALL');
  const [height, setHeight] = useState(170);
  const [hover, setHover] = useState(null);
  const asOf = Date.parse(MODEL_PRIORS.datasetAsOf);
  const rangeDays = RANGES.find(([id]) => id === range)?.[1] ?? Infinity;

  /* The replay is memoized separately from the geometry. Over the ten-year
     ALL range this is ~3,600 chainIndexAt calls; folding it into the geometry
     memo would re-run all of them on every step of the height slider. */
  const raw = useMemo(() => {
    const maxT = Math.max(1, Math.min(rangeDays, LONG_HISTORY[0]?.daysAgo ?? 1));
    // Every displayed point comes from the same baseline replay used by the
    // engine. There is no chart interpolation or separate scoring path.
    return Array.from({ length: maxT + 1 }, (_, i) => {
      const daysAgo = maxT - i;
      return { daysAgo, index: engine.chainIndexAt(daysAgo), date: new Date(asOf - daysAgo * DAY) };
    });
  }, [LONG_HISTORY, rangeDays, asOf, engine]);

  const chart = useMemo(() => {
    const maxT = raw[0].daysAgo;
    const yMin = Math.min(4.85, ...raw.map((p) => p.index));
    const yMax = Math.max(5.15, ...raw.map((p) => p.index)) + 0.05;
    const x = (d) => PL + (1 - d / maxT) * (W - PL - PR);
    const y = (v) => PT + (1 - (v - yMin) / (yMax - yMin)) * (height - PT - PB);
    const pts = raw.map((p) => ({ ...p, px: x(p.daysAgo), py: y(p.index) }));
    const byDay = new Map(pts.map((p) => [p.daysAgo, p.index]));
    const markers = (events || []).filter((e) => (e.daysAgo ?? 0) <= maxT).map((e) => {
      const a = getEventAssumption(e.id);
      const value = byDay.get(e.daysAgo) ?? engine.chainIndexAt(e.daysAgo);
      return { e, a, px: x(e.daysAgo), py: y(value) };
    });
    const count = maxT <= 7 ? maxT : 5;
    const ticks = Array.from({ length: count + 1 }, (_, i) => {
      const daysAgo = Math.round(maxT - (maxT * i) / count);
      return { daysAgo, px: x(daysAgo), label: new Date(asOf - daysAgo * DAY).toLocaleDateString('en-US', maxT > 365 ? { year: 'numeric', month: 'short' } : { month: 'short', day: 'numeric' }) };
    });
    return { maxT, y, yMin, yMax, pts, markers, ticks };
  }, [raw, height, asOf, events, engine]);

  const color = (m) => !m.a.operational ? C.faint : m.a.direction === 'mitigating' ? C.green : C.red;
  const line = chart.pts.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
  const move = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const mx = ((evt.clientX - rect.left) / rect.width) * W;
    const point = chart.pts.reduce((best, p) => Math.abs(p.px - mx) < Math.abs(best.px - mx) ? p : best, chart.pts[0]);
    setHover({ ...point, near: chart.markers.filter((m) => Math.abs(m.e.daysAgo - point.daysAgo) <= 2) });
  };

  return <div style={{ border: `1px solid ${C.line}`, background: C.panel2, borderRadius: 8, padding: '10px 12px', marginBottom: 10, position: 'relative' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.dim }}>{t('COMPUTED CHAIN-INDEX HISTORY')}<span style={{ color: C.faint, letterSpacing: 0.2, marginLeft: 7 }}>baseline replay - 5 neutral</span></div>
      <div style={{ display: 'flex', gap: 3, marginLeft: 'auto' }} aria-label="History time range">
        {RANGES.map(([id]) => <button key={id} type="button" aria-pressed={range === id} onClick={() => { setRange(id); setHover(null); }} style={{ border: `1px solid ${range === id ? C.copper : C.line}`, background: range === id ? 'rgba(201,138,63,.14)' : 'transparent', color: range === id ? C.copper : C.dim, borderRadius: 4, fontSize: 9, padding: '3px 5px', cursor: 'pointer', fontFamily: 'inherit' }}>{id}</button>)}
      </div>
      <label className="mono" style={{ fontSize: 8.5, color: C.faint, display: 'flex', alignItems: 'center', gap: 4 }}>HEIGHT <input type="range" min="120" max="280" step="10" value={height} onChange={(e) => setHeight(Number(e.target.value))} aria-label="History chart height" style={{ width: 64, accentColor: C.copper }} /></label>
    </div>
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', display: 'block', cursor: 'crosshair' }} role="img" aria-label="Computed chain index history" onMouseMove={move} onMouseLeave={() => setHover(null)}>
      {chart.ticks.map((tick) => <g key={tick.daysAgo}><line x1={tick.px} y1={PT} x2={tick.px} y2={height - PB} stroke={C.line} strokeWidth="1" /><text x={tick.px} y={height - 7} textAnchor="middle" fill={C.faint} fontSize="8.5">{tick.label}</text></g>)}
      <line x1={PL} y1={chart.y(5)} x2={W - PR} y2={chart.y(5)} stroke={C.line} strokeDasharray="3 3" />
      {[chart.yMax - .05, 5].map((v) => <text key={v} x="2" y={chart.y(v) + 3} fill={C.faint} fontSize="8.5">{v.toFixed(1)}</text>)}
      <polyline points={line} fill="none" stroke={C.copper} strokeWidth="1.8" strokeLinejoin="round" className="history-line" />
      {chart.markers.map((m) => <g key={m.e.id} onClick={() => onSelectEvent?.(m.e.id)} style={{ cursor: 'pointer' }}><circle cx={m.px} cy={m.py} r="8" fill="transparent" /><circle cx={m.px} cy={m.py} r="2.7" fill={color(m)} stroke={C.panel2} /></g>)}
      {hover && <g pointerEvents="none"><line x1={hover.px} y1={PT} x2={hover.px} y2={height - PB} stroke={C.dim} strokeWidth=".75" /><circle cx={hover.px} cy={hover.py} r="3" fill="none" stroke={C.text} /></g>}
    </svg>
    {hover && <div className="mono" style={{ position: 'absolute', left: `${Math.min(75, Math.max(2, hover.px / W * 100))}%`, top: 48, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, padding: '4px 8px', fontSize: 9.5, color: C.dim, pointerEvents: 'none', maxWidth: 230, zIndex: 5 }}><span style={{ color: C.text }}>{hover.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span> - index {hover.index.toFixed(2)}{hover.near.map((m) => <div key={m.e.id} style={{ color: color(m), marginTop: 2 }}>{m.e.title}{m.a.operational ? '' : ' - excluded'}</div>)}</div>}
  </div>;
}
