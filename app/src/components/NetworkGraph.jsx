import { useMemo } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { deriveAnalysisGraph, neighborhood, filterConnections } from '../engine/networkOps.js';
import { metricValues, betweenness, METRICS } from '../engine/networkAnalysis.js';
import { layoutCentres, edgePath } from '../interaction/topologyLayout.js';
import { flagEmoji } from '../data/glossary.js';
import Legend from './Legend.jsx';

/* ================= Topology mode — functional-centre network (§9B) =======
   Renders the frontend-derived multilayer graph: functional supply centres
   (country × stage) laid out by supply-chain tier, connected by modeled
   stage-mediated connections (weight = source share × stage-edge prior ×
   destination share). This is the structure the old bilateral HQ map could
   not show. Selection is synchronized with every other panel via the shared
   interaction controller. Modeled connectivity — NOT verified shipments. */

const W = 1220;
const H = 580;

// Tier palette (Inputs & IP → End markets). Colour is paired with tier
// labels + stage text, never the only channel.
const TIER_COLORS = ['#6EA8FE', '#63C7B2', '#C98A3F', '#E0A458', '#D46A6A', '#B57EDC', '#8FBF6A'];
const tierColor = (tierId) => TIER_COLORS[tierId % TIER_COLORS.length] || C.copper;

export default function NetworkGraph({ baseGraph, filters = {}, pb = null }) {
  const { engine } = useVault();
  const { STAGE_BY_ID } = engine;
  const { state, select, hover, clearHover, pgToggleMulti } = useInteraction();
  const { selected, hovered, playground, selectedRoute, analysisMetric } = state;

  // Scenario playback overlay (§28): a centre lights up when its stage is
  // reached at the current hop, in lockstep with the map + industry graph.
  const pbActive = Boolean(pb);
  const pbStageEdges = useMemo(() => {
    const s = new Set();
    (pb?.edges || []).forEach((e) => s.add(`${e.from}|${e.to}`));
    return s;
  }, [pb]);

  // A pinned route (§18): its centres/edges are emphasized with numbered hop
  // markers; unrelated elements dim.
  const routeCentreIds = useMemo(() => new Set(selectedRoute?.centres || []), [selectedRoute]);
  const routeHopIndex = useMemo(() => {
    const m = {};
    (selectedRoute?.centres || []).forEach((id, i) => { m[id] = i; });
    return m;
  }, [selectedRoute]);
  const routeEdgeKeys = useMemo(() => new Set((selectedRoute?.edges || []).map((e) => e.id)), [selectedRoute]);

  // Post-removal analysis graph drives edges/metrics; layout is over ALL base
  // centres so positions stay stable and removed centres can still be drawn
  // as ghosts (§26). Removals come from the reversible playground state.
  const analysis = useMemo(
    () => deriveAnalysisGraph(baseGraph, { removedNodeIds: playground.removedNodeIds, removedEdgeIds: playground.removedEdgeIds }),
    [baseGraph, playground.removedNodeIds, playground.removedEdgeIds]
  );
  const removedNodes = useMemo(() => new Set(playground.removedNodeIds), [playground.removedNodeIds]);
  const multiSet = useMemo(() => new Set(playground.multi.filter((m) => m.type === 'centre').map((m) => m.id)), [playground.multi]);
  const pos = useMemo(() => layoutCentres(baseGraph.centres, { width: W, height: H }), [baseGraph]);

  // Node size can encode the active network-analysis metric (§23/§29); by
  // default it encodes the country's share of the stage.
  const sizeMetric = analysisMetric === 'removal_impact' ? 'betweenness' : analysisMetric;
  const metricVals = useMemo(
    () => (sizeMetric ? metricValues(analysis, sizeMetric, { betweenness: sizeMetric === 'betweenness' ? betweenness(analysis) : undefined }) : null),
    [analysis, sizeMetric]
  );
  const metricMax = useMemo(() => (metricVals ? Math.max(...Object.values(metricVals), 1e-9) : 1), [metricVals]);
  const sizeLabel = sizeMetric ? (METRICS.find((m) => m.id === sizeMetric)?.label || sizeMetric) : 'country share of stage';

  const selId = selected?.type === 'centre' ? selected.id : null;
  const hovId = hovered?.type === 'centre' ? hovered.id : null;

  // Progressive disclosure (§30): when a centre is pinned show its up/down
  // neighborhood; otherwise show the strongest connections globally.
  const shownEdges = useMemo(() => {
    if (pbActive) return analysis.centreEdges.filter((e) => pb.reachedStages.has(e.sourceStage) && pb.reachedStages.has(e.targetStage));
    if (selectedRoute?.edges?.length) return selectedRoute.edges; // pinned route dominates (§18)
    if (selId && analysis.centreById[selId]) {
      const { edgeIds } = neighborhood(analysis, selId, { direction: 'both', hops: 2 });
      return [...edgeIds].map((id) => analysis.edgeById[id]).filter(Boolean);
    }
    return filterConnections(analysis.centreEdges, { topN: filters.topN ?? 60, minWeight: filters.minWeight ?? 0 });
  }, [analysis, selId, selectedRoute, pbActive, pb, filters.topN, filters.minWeight]);

  const shownNodeIds = useMemo(() => {
    const s = new Set();
    shownEdges.forEach((e) => { s.add(e.sourceId); s.add(e.targetId); });
    if (selId) s.add(selId);
    routeCentreIds.forEach((id) => s.add(id));
    return s;
  }, [shownEdges, selId, routeCentreIds]);

  const maxNorm = Math.max(...shownEdges.map((e) => e.normalizedDisplayWeight), 1e-9);

  const hoverIncident = useMemo(() => {
    const s = new Set();
    if (!hovId) return s;
    (analysis.outAdj[hovId] || []).forEach((eid) => s.add(eid));
    (analysis.inAdj[hovId] || []).forEach((eid) => s.add(eid));
    return s;
  }, [hovId, analysis]);

  const centreLabel = (c) => `${flagEmoji(c.countryId)} ${STAGE_BY_ID[c.stageId]?.name || c.stageId}`;
  const centreAria = (c) => `${c.countryId} ${STAGE_BY_ID[c.stageId]?.name || c.stageId} functional centre, tier ${c.tierLabel}, country share ${(c.countryShare * 100).toFixed(0)} percent`;

  const legendItems = (baseGraph.tiers || []).map((t) => [t.tierLabel, tierColor(t.tierId)]);

  return (
    <div style={{ padding: 10 }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: 1, color: C.copper, marginBottom: 6 }}>
        FUNCTIONAL-CENTRE NETWORK · {analysis.centres.length} CENTRES · {shownEdges.length} SHOWN CONNECTIONS
        <span style={{ color: C.faint }}> · node colour: tier · node size: {sizeLabel}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 900, display: 'block', background: C.panel2, borderRadius: 6, border: `1px solid ${C.line}` }}
          role="img" aria-label="Functional-centre supply-chain network (modeled stage-mediated connectivity, not verified shipments)">
          <defs>
            <marker id="ng-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.copper} />
            </marker>
          </defs>

          {/* tier column labels */}
          {(baseGraph.tiers || []).map((t) => {
            const anyInTier = analysis.centres.find((c) => c.tierId === t.tierId);
            const x = anyInTier ? pos[anyInTier.id]?.x : null;
            if (x == null) return null;
            return <text key={t.tierId} x={x} y={16} textAnchor="middle" className="mono" fill={C.faint} fontSize="8.5" letterSpacing="1.5">{t.tierLabel}</text>;
          })}

          {/* edges */}
          {shownEdges.map((e) => {
            const p1 = pos[e.sourceId], p2 = pos[e.targetId];
            if (!p1 || !p2) return null;
            const w = 0.5 + 3 * (e.normalizedDisplayWeight / maxNorm || 0.3);
            const onHop = pbActive && (pbStageEdges.has(`${e.sourceStage}|${e.targetStage}`) || pbStageEdges.has(`${e.targetStage}|${e.sourceStage}`));
            const onRoute = !pbActive && routeEdgeKeys.has(e.id);
            const onHover = !pbActive && hoverIncident.has(e.id);
            const emph = onHop || onRoute || onHover;
            return (
              <path key={e.id} d={edgePath(p1, p2)} fill="none"
                className={emph ? 'pulse' : undefined}
                stroke={emph ? C.copper : C.copperDim}
                strokeWidth={onRoute ? w + 1.6 : emph ? w + 1 : w}
                markerEnd="url(#ng-arrow)"
                opacity={emph ? 1 : pbActive ? 0.55 : 0.5}>
                <title>{`${e.sourceCountry} · ${STAGE_BY_ID[e.sourceStage]?.name} → ${e.targetCountry} · ${STAGE_BY_ID[e.targetStage]?.name} · modeled weight ${e.rawDisplayWeight.toFixed(4)} (share×prior×share) — modeled stage-mediated connectivity, not a verified shipment`}</title>
              </path>
            );
          })}

          {/* nodes — all base centres; removed ones drawn as ghosts (§26) */}
          {baseGraph.centres.map((c) => {
            const p = pos[c.id];
            if (!p) return null;
            const isRemoved = removedNodes.has(c.id);
            const shown = shownNodeIds.has(c.id);
            const isSel = c.id === selId;
            const isHov = c.id === hovId;
            const isMulti = multiSet.has(c.id);
            const pbReached = pbActive && pb.reachedStages.has(c.stageId);
            const pbNew = pbActive && pb.newStages.has(c.stageId);
            const r = metricVals ? 3.5 + 9 * ((metricVals[c.id] || 0) / metricMax) : 3.5 + 9 * c.countryShare;
            const col = tierColor(c.tierId);
            const opacity = isRemoved ? 0.28
              : pbActive ? (pbReached ? 1 : 0.1)
              : (shown || isSel ? 1 : 0.12);
            // Shift-click marks the centre for multi-selection (§14); a plain
            // click inspects it (or, when removed, still inspects to restore).
            const onActivate = (ev) => (ev.shiftKey ? pgToggleMulti({ type: 'centre', id: c.id }) : select({ type: 'centre', id: c.id }));
            return (
              <g key={c.id} className="node" opacity={opacity}
                transform={`translate(${p.x},${p.y})`}
                onClick={onActivate}
                onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onActivate(ev))}
                onMouseEnter={() => hover({ type: 'centre', id: c.id })} onMouseLeave={clearHover}
                tabIndex={0} role="button" aria-label={`${isRemoved ? 'Temporarily removed. ' : ''}${isMulti ? 'Multi-selected. ' : ''}${centreAria(c)}`}>
                {pbNew && <circle className="pulse" r={r + 6} fill="none" stroke={C.copper} strokeWidth={2} />}
                {isSel && <circle r={r + 5} fill="none" stroke={C.copper} strokeWidth={2} />}
                {isMulti && !isSel && <circle r={r + 5} fill="none" stroke={C.amber} strokeWidth={1.6} strokeDasharray="3 2" />}
                {isHov && !isSel && !isMulti && <circle r={r + 4} fill="none" stroke={C.copper} strokeWidth={1.3} strokeDasharray="2 3" />}
                <circle r={r} fill={col} fillOpacity={isRemoved ? 0.25 : 0.85} stroke={isSel ? C.text : col} strokeWidth={isSel ? 1.4 : 0.5} />
                {isRemoved && <g stroke={C.red} strokeWidth={1.4}><line x1={-r} y1={-r} x2={r} y2={r} /><line x1={-r} y1={r} x2={r} y2={-r} /></g>}
                {routeCentreIds.has(c.id) && (
                  <g>
                    <circle r={r + 7} fill="none" stroke={C.copper} strokeWidth={1.6} />
                    <circle cx={r + 4} cy={-r - 4} r={6} fill={C.copper} />
                    <text x={r + 4} y={-r - 1.5} textAnchor="middle" fill="#0C111C" fontSize="8" fontWeight="700" style={{ pointerEvents: 'none' }}>{routeHopIndex[c.id] + 1}</text>
                  </g>
                )}
                {(isSel || isHov || isMulti || routeCentreIds.has(c.id) || r > 8) && (
                  <text x={0} y={-r - 4} textAnchor="middle" fill={isRemoved ? C.faint : C.text} fontSize="8.5" fontWeight="600" style={{ pointerEvents: 'none' }}>
                    {centreLabel(c)}
                  </text>
                )}
                <title>{centreAria(c)}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <Legend items={legendItems} note="Node = functional centre (country × stage); size = country share of the stage. Edge = modeled stage-mediated connection (share × stage-edge prior × share). Modeled connectivity — not verified shipments. Click a centre to focus its upstream/downstream neighborhood." />
    </div>
  );
}
