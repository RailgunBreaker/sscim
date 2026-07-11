import { useState, useMemo, useEffect } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { deriveAnalysisGraph } from '../engine/networkOps.js';
import { findCentreRoutes, ROUTE_OBJECTIVES } from '../engine/networkPaths.js';
import { flagEmoji } from '../data/glossary.js';

/* ================= Pathfinding playground (§16/§17) =====================
   Pick an origin and destination functional centre and a path objective;
   lists the strongest / alternative modeled routes between them over the
   current (post-removal) analysis graph. Pinning a route highlights it in
   the topology view and the industry graph (via focusedPath). Routes are
   modeled stage-mediated connectivity, NOT verified physical shipments. */

const fmt = (v) => v.toFixed(3);

export default function NetworkRoutePanel({ baseGraph }) {
  const { data, engine } = useVault();
  const { COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;
  const { state, setRoute, setFocusedPath } = useInteraction();
  const { selected, playground, selectedRoute } = state;

  const analysis = useMemo(
    () => deriveAnalysisGraph(baseGraph, { removedNodeIds: playground.removedNodeIds, removedEdgeIds: playground.removedEdgeIds }),
    [baseGraph, playground.removedNodeIds, playground.removedEdgeIds]
  );

  const centreOptions = useMemo(
    () => baseGraph.centres.slice().sort((a, b) => a.tierId - b.tierId || a.countryId.localeCompare(b.countryId) || a.stageId.localeCompare(b.stageId)),
    [baseGraph]
  );
  const label = (c) => `${flagEmoji(c.countryId)} ${COUNTRY_NAMES[c.countryId] || c.countryId} · ${STAGE_BY_ID[c.stageId]?.name || c.stageId}`;
  const labelById = (id) => { const c = baseGraph.centreById[id]; return c ? label(c) : id; };

  const [origin, setOrigin] = useState(centreOptions[0]?.id || '');
  const [dest, setDest] = useState('');
  const [objective, setObjective] = useState('strongest');

  // "Trace from here": follow the pinned centre selection into the origin.
  useEffect(() => { if (selected?.type === 'centre') setOrigin(selected.id); }, [selected]);

  const routes = useMemo(
    () => (origin && dest && origin !== dest ? findCentreRoutes(analysis, origin, dest, { objective, k: 3 }) : []),
    [analysis, origin, dest, objective]
  );

  const pinRoute = (r) => {
    setRoute(r);
    // Mirror onto the industry graph via the stage-level focused path.
    const edges = r.edges.map((e) => ({ from: e.sourceStage, to: e.targetStage, dir: 'downstream' }));
    const nodes = [r.edges[0]?.sourceStage, ...r.edges.map((e) => e.targetStage)].filter(Boolean);
    setFocusedPath({ sourceId: nodes[0], targetId: nodes.at(-1), path: { nodes, edges, attenuation: r.weightProduct, channel: 'downstream' } });
  };
  const clearRoute = () => { setRoute(null); setFocusedPath(null); };

  const routeDescription = (r) => r.centres.map((id) => {
    const c = baseGraph.centreById[id];
    return c ? `${COUNTRY_NAMES[c.countryId] || c.countryId}, ${STAGE_BY_ID[c.stageId]?.name || c.stageId}` : id;
  }).join(' to ');

  const selStyle = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: '4px 6px', fontSize: 11, fontFamily: 'inherit', maxWidth: 230 };
  const pinnedKey = selectedRoute?.centres?.join('>');

  return (
    <div style={{ padding: 10, borderTop: `1px solid ${C.line}` }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: 2, color: C.copper, marginBottom: 6 }}>PATHFINDING · TRACE A SUPPLY-CHAIN ROUTE</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label className="mono" style={{ fontSize: 10, color: C.dim, display: 'flex', gap: 4, alignItems: 'center' }}>
          FROM
          <select value={origin} onChange={(e) => setOrigin(e.target.value)} style={selStyle} aria-label="Route origin centre">
            {centreOptions.map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
          </select>
        </label>
        <label className="mono" style={{ fontSize: 10, color: C.dim, display: 'flex', gap: 4, alignItems: 'center' }}>
          TO
          <select value={dest} onChange={(e) => setDest(e.target.value)} style={selStyle} aria-label="Route destination centre">
            <option value="">— select —</option>
            {centreOptions.filter((c) => c.id !== origin).map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
          </select>
        </label>
        <label className="mono" style={{ fontSize: 10, color: C.dim, display: 'flex', gap: 4, alignItems: 'center' }}>
          OBJECTIVE
          <select value={objective} onChange={(e) => setObjective(e.target.value)} style={selStyle} aria-label="Path objective">
            {ROUTE_OBJECTIVES.map((o) => <option key={o.id} value={o.id} title={o.hint}>{o.label}</option>)}
          </select>
        </label>
        {selectedRoute && (
          <button type="button" onClick={clearRoute} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, cursor: 'pointer', fontFamily: 'inherit' }}>Clear route</button>
        )}
      </div>

      {origin && dest && origin !== dest && routes.length === 0 && (
        <div className="mono" style={{ fontSize: 10, color: C.faint, lineHeight: 1.5 }}>
          No modeled downstream route connects {labelById(origin)} → {labelById(dest)} in the current graph (try removing a shock, or pick an origin upstream of the destination).
        </div>
      )}

      {routes.map((r, i) => {
        const on = pinnedKey === r.centres.join('>');
        return (
          <button key={i} type="button" onClick={() => (on ? clearRoute() : pinRoute(r))} aria-pressed={on}
            aria-label={`Route ${i + 1}: ${routeDescription(r)}. ${r.hops} stage transitions, cumulative modeled weight ${fmt(r.weightProduct)}.`}
            style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6, padding: '6px 8px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', background: on ? 'rgba(201,138,63,.14)' : C.panel, border: `1px solid ${on ? C.copper : C.line}`, color: C.text }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 9, color: C.faint }}>ROUTE {i + 1} · {r.hops} hop{r.hops === 1 ? '' : 's'}</span>
              <span className="mono" style={{ fontSize: 9.5, color: C.copper }} title="Product of edge weights (multiplicative attenuation) · widest-path bottleneck">Π {fmt(r.weightProduct)} · ⌵ {fmt(r.bottleneck)}</span>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, margin: '3px 0', lineHeight: 1.4 }}>
              {r.centres.map((id, j) => {
                const c = baseGraph.centreById[id];
                return (
                  <span key={id}>
                    <span className="mono" style={{ color: C.faint, fontSize: 8.5 }}>{j + 1}.</span> {c ? `${flagEmoji(c.countryId)} ${STAGE_BY_ID[c.stageId]?.name || c.stageId}` : id}
                    {j < r.centres.length - 1 && <span style={{ color: C.copperDim }}> → </span>}
                  </span>
                );
              })}
            </div>
            <div className="mono" style={{ fontSize: 8.5, color: C.faint, lineHeight: 1.5 }}>
              {r.edges.map((e) => `${e.sourceCountry}·${STAGE_BY_ID[e.sourceStage]?.name}→${e.targetCountry}·${STAGE_BY_ID[e.targetStage]?.name} ${fmt(e.rawDisplayWeight)}`).join('  ·  ')}
            </div>
          </button>
        );
      })}

      <div className="mono" style={{ fontSize: 8.5, color: C.faint, lineHeight: 1.6, marginTop: 4 }}>
        Routes rank by the chosen objective over modeled stage-mediated connection weights (share × stage-edge prior × share) — an illustrative supply-chain route / modeled propagation path, <b style={{ color: C.dim }}>not a verified physical shipment itinerary</b>.
      </div>
    </div>
  );
}
