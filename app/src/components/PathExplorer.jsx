import { useState, useMemo, useEffect } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';

/* ====================================================================
   PathExplorer — "explain a path" between two stages (task §11). Picks an
   origin and destination stage and lists the strongest modeled propagation
   routes between them (engine.topPaths), each with its per-edge dependence
   coefficient and the multiplicative attenuation along the chain.

   These are MODELED routes over unvalidated propagation priors — not
   measured shipment paths — and the panel says so. Also offers a compact,
   keyboard-navigable edge list (the "non-graph" way to inspect edges), so
   edges are usable without pixel-precise clicking on the SVG.
   ==================================================================== */

const fmtC = (v) => (v == null ? '—' : v.toFixed(3));

export default function PathExplorer({ defaultOrigin, activePath, onPick }) {
  const { data, engine } = useVault();
  const { STAGES, FLOW_EDGES } = data;
  const { STAGE_BY_ID, D, topPaths } = engine;

  const [origin, setOrigin] = useState(defaultOrigin || STAGES[0]?.id);
  const [dest, setDest] = useState('');
  const [showEdges, setShowEdges] = useState(false);

  // Follow the pinned stage selection when it changes (convenience only).
  useEffect(() => { if (defaultOrigin) setOrigin(defaultOrigin); }, [defaultOrigin]);

  const paths = useMemo(
    () => (origin && dest && origin !== dest ? topPaths(origin, dest, { k: 3 }) : []),
    [origin, dest, topPaths]
  );

  const name = (id) => STAGE_BY_ID[id]?.name || id;
  const activeKey = (p) => p.edges.map((e) => `${e.from}|${e.to}`).join('>');
  const activeSig = activePath ? activeKey(activePath) : null;

  const selectStyle = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: '3px 6px', fontSize: 11, fontFamily: 'inherit', outline: 'none' };

  return (
    <div style={{ marginTop: 8, border: `1px solid ${C.line}`, borderRadius: 6, background: C.panel2, padding: '8px 10px' }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: 2, color: C.copper, marginBottom: 6 }}>PROPAGATION PATHS · EXPLAIN A ROUTE</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label className="mono" style={{ fontSize: 10, color: C.dim, display: 'flex', gap: 4, alignItems: 'center' }}>
          FROM
          <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={selectStyle} aria-label="Path origin stage">
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="mono" style={{ fontSize: 10, color: C.dim, display: 'flex', gap: 4, alignItems: 'center' }}>
          TO
          <select value={dest} onChange={(e) => setDest(e.target.value)} style={selectStyle} aria-label="Path destination stage">
            <option value="">— select —</option>
            {STAGES.filter((s) => s.id !== origin).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {activePath && (
          <button type="button" onClick={() => onPick(null)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, cursor: 'pointer', fontFamily: 'inherit' }}>
            Clear highlight
          </button>
        )}
      </div>

      {origin && dest && origin !== dest && paths.length === 0 && (
        <div className="mono" style={{ fontSize: 10, color: C.faint, lineHeight: 1.5 }}>
          No modeled propagation route connects {name(origin)} → {name(dest)} in either direction within the graph.
        </div>
      )}

      {paths.map((p, i) => {
        const on = activeSig === activeKey(p);
        return (
          <button key={i} type="button" onClick={() => onPick(on ? null : p)}
            aria-pressed={on}
            style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6, padding: '6px 8px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
              background: on ? 'rgba(201,138,63,.14)' : C.panel, border: `1px solid ${on ? C.copper : C.line}`, color: C.text }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 9, color: C.faint }}>ROUTE {i + 1} · {p.channel === 'upstream' ? 'upstream echo' : 'downstream'}</span>
              <span className="mono" style={{ fontSize: 10, color: C.copper }} title="Product of the per-edge dependence coefficients along the route (multiplicative attenuation).">attenuation {fmtC(p.attenuation)}</span>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, margin: '3px 0', lineHeight: 1.4 }}>
              {p.nodes.map((n, j) => (
                <span key={n}>
                  {name(n)}
                  {j < p.nodes.length - 1 && <span style={{ color: C.copperDim }}> {p.channel === 'upstream' ? '←' : '→'} </span>}
                </span>
              ))}
            </div>
            <div className="mono" style={{ fontSize: 8.5, color: C.faint, lineHeight: 1.5 }}>
              {p.edges.map((e, j) => `${name(e.from)}→${name(e.to)} ${fmtC(e.coeff)}`).join(' · ')}
            </div>
          </button>
        );
      })}

      <div style={{ marginTop: 6 }}>
        <button type="button" onClick={() => setShowEdges((v) => !v)} aria-expanded={showEdges}
          style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 4, background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showEdges ? '▾' : '▸'} All modeled edges ({FLOW_EDGES.length})
        </button>
        {showEdges && (
          <ul role="list" style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, maxHeight: 150, overflowY: 'auto' }}>
            {[...FLOW_EDGES]
              .map(([a, b]) => ({ a, b, coeff: D[b]?.[a] ?? 0 }))
              .sort((x, y) => y.coeff - x.coeff)
              .map(({ a, b, coeff }) => (
                <li key={`${a}|${b}`}>
                  <button type="button" onClick={() => { setOrigin(a); setDest(b); }}
                    title="Set this edge as the from→to route"
                    style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, padding: '3px 6px', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.line}`, color: C.text, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10.5, textAlign: 'left' }}>
                    <span>{name(a)} <span style={{ color: C.copperDim }}>→</span> {name(b)}</span>
                    <span className="mono" style={{ color: C.copper }}>D {fmtC(coeff)}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="mono" style={{ fontSize: 8.5, color: C.faint, lineHeight: 1.5, marginTop: 6 }}>
        Routes rank by the product of edge input-dependence coefficients (D) — unvalidated propagation priors built from graph structure and stage specificity, <b style={{ color: C.dim }}>not measured shipment paths</b>.
      </div>
    </div>
  );
}
