import { useMemo, useState } from 'react';
import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { getEventAssumption } from '../engine/event-assumptions.js';

/* Long-run computed chain-index history (engine.LONG_HISTORY): the §4.6
   operational-impact computation re-run at weekly offsets (plus each event's
   own date) back to the oldest vault event. Baseline series only — an active
   scenario never rewrites it. Single series → no legend; the title names it.
   Event markers are colored by declared direction (adverse/mitigating), with
   excluded (non-operational) events in faint ink — identity is also in the
   tooltip text, never color alone. */

const W = 560, H = 132, PL = 30, PR = 10, PT = 10, PB = 20;
const DAY = 86400000;

export default function IndexHistory({ engine, events, onSelectEvent }) {
  const { LONG_HISTORY, MODEL_PRIORS } = engine;
  const [hover, setHover] = useState(null);
  const asOf = Date.parse(MODEL_PRIORS.datasetAsOf);

  const { pts, x, y, maxT, yMin, yMax, years, markers } = useMemo(() => {
    const maxT = LONG_HISTORY[0]?.daysAgo ?? 1;
    const vals = LONG_HISTORY.map((p) => p.index);
    const yMin = Math.min(4.85, ...vals), yMax = Math.max(5.15, ...vals) + 0.05;
    const x = (tDays) => PL + (1 - tDays / maxT) * (W - PL - PR);
    const y = (v) => PT + (1 - (v - yMin) / (yMax - yMin)) * (H - PT - PB);
    const pts = LONG_HISTORY.map((p) => ({ ...p, px: x(p.daysAgo), py: y(p.index), date: new Date(asOf - p.daysAgo * DAY) }));
    const years = [];
    for (let yr = new Date(asOf - maxT * DAY).getFullYear() + 1; yr <= new Date(asOf).getFullYear(); yr++) {
      const tDays = Math.round((asOf - Date.parse(`${yr}-01-01`)) / DAY);
      if (tDays > 0 && tDays < maxT) years.push({ yr, px: x(tDays) });
    }
    const byT = new Map(LONG_HISTORY.map((p) => [p.daysAgo, p.index]));
    const markers = (events || [])
      .filter((e) => (e.daysAgo ?? 0) > 0 && (e.daysAgo ?? 0) <= maxT)
      .map((e) => {
        const a = getEventAssumption(e.id);
        const v = byT.get(e.daysAgo) ?? 5;
        return { e, a, px: x(e.daysAgo), py: y(v), v };
      });
    return { pts, x, y, maxT, yMin, yMax, years, markers };
  }, [LONG_HISTORY, events, asOf]);

  const line = pts.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ');
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const onMove = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const mx = ((evt.clientX - rect.left) / rect.width) * W;
    let best = null;
    for (const p of pts) if (!best || Math.abs(p.px - mx) < Math.abs(best.px - mx)) best = p;
    const near = markers.filter((m) => Math.abs(m.e.daysAgo - best.daysAgo) <= 3);
    setHover({ ...best, near });
  };

  const markerColor = (m) => !m.a.operational ? C.faint : m.a.direction === 'mitigating' ? C.green : C.red;

  return (
    <div style={{ border: `1px solid ${C.line}`, background: C.panel2, borderRadius: 6, padding: '8px 10px', marginBottom: 10, position: 'relative' }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.dim, marginBottom: 4 }}>
        {t('COMPUTED CHAIN-INDEX HISTORY')} · 2021 → {MODEL_PRIORS.datasetAsOf}
        <span style={{ color: C.faint, letterSpacing: 0.5, marginLeft: 8 }}>5 = neutral · baseline events only · §4.6 re-run per date</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', cursor: 'crosshair' }} role="img"
        aria-label="Computed chain risk index, 2021 to present, from backfilled vault events"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {/* recessive grid: year ticks + neutral line */}
        {years.map(({ yr, px }) => (
          <g key={yr}>
            <line x1={px} y1={PT} x2={px} y2={H - PB} stroke={C.line} strokeWidth="1" />
            <text x={px + 3} y={H - 7} fill={C.faint} fontSize="8.5" className="mono">{yr}</text>
          </g>
        ))}
        <line x1={PL} y1={y(5)} x2={W - PR} y2={y(5)} stroke={C.line} strokeWidth="1" strokeDasharray="3 3" />
        {[yMax - 0.05, 5].map((v) => (
          <text key={v} x={2} y={y(v) + 3} fill={C.faint} fontSize="8.5" className="mono">{v.toFixed(1)}</text>
        ))}
        <polyline points={line} fill="none" stroke={C.copper} strokeWidth="1.6" strokeLinejoin="round" />
        {/* event markers: 3px dot, 8px invisible hit target; click selects the event */}
        {markers.map((m) => (
          <g key={m.e.id} onClick={() => onSelectEvent && onSelectEvent(m.e.id)} style={{ cursor: 'pointer' }}>
            <circle cx={m.px} cy={m.py} r="8" fill="transparent">
              <title>{`${m.e.date} — ${m.e.title}${m.a.operational ? '' : ' (excluded from score)'}`}</title>
            </circle>
            <circle cx={m.px} cy={m.py} r="2.6" fill={markerColor(m)} stroke={C.panel2} strokeWidth="1" pointerEvents="none" />
          </g>
        ))}
        {hover && (
          <g pointerEvents="none">
            <line x1={hover.px} y1={PT} x2={hover.px} y2={H - PB} stroke={C.dim} strokeWidth="0.75" />
            <circle cx={hover.px} cy={hover.py} r="3" fill="none" stroke={C.text} strokeWidth="1.2" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="mono" style={{ position: 'absolute', left: `${Math.min(78, Math.max(2, (hover.px / W) * 100))}%`, top: 22, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 4, padding: '4px 8px', fontSize: 9.5, color: C.dim, pointerEvents: 'none', maxWidth: 210, zIndex: 5 }}>
          <span style={{ color: C.text }}>{fmt(hover.date)}</span> · index {hover.index.toFixed(2)}
          {hover.near.map((m) => (
            <div key={m.e.id} style={{ color: markerColor(m), marginTop: 2 }}>{m.e.title}{m.a.operational ? '' : ' · excluded'}</div>
          ))}
        </div>
      )}
    </div>
  );
}
