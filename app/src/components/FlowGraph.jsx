import { useMemo } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { graphEncoding, signedColor, fmtSigned } from '../interaction/lensEncoding.js';
import { riskColor } from '../utils/colors.js';
import { onEnterSpace } from '../utils/a11y.js';
import { STAGE_INTRO, introForCompany } from '../data/glossary.js';
import Logo from './Logo.jsx';
import Legend from './Legend.jsx';
import PathExplorer from './PathExplorer.jsx';

/* ================= Flow Graph + stage subsection =================
   Node COLOR + primary badge follow the ACTIVE LENS (structural /
   operational / scenario Δ / selected-share — see §4/§6 and
   interaction/lensEncoding.js). Dot & border SIZE stay network influence
   (an orthogonal encoding, so color is never the only channel). Edge
   width = the downstream input-dependence proxy D[b][a] — an unvalidated
   propagation prior, NOT a measured trade flow. Hovering a country (on the
   map) or a company temporarily rings the stages it participates in,
   without disturbing the pinned selection. */
function legendFor(lens, legend) {
  if (lens === 'operational' || lens === 'delta') {
    return { items: [['adverse', C.red], ['moderate', C.amber], ['mitigating', C.green], ['~neutral', C.faint]], note: legend.encoding + ' · ' + legend.note + ' · dot size = network influence' };
  }
  if (lens === 'share') {
    return { items: [['higher share', C.copper], ['lower share', C.copperDim], ['none', C.faint]], note: legend.encoding + ' · ' + legend.note };
  }
  return { items: [['Moderate < 5.5', C.green], ['Elevated 5.5–7.5', C.amber], ['High ≥ 7.5', C.red]], note: legend.encoding + ' · dot/border size = network influence · edge = input-dependence prior' };
}

export default function FlowGraph({ sel, setSel, hl, model, scenarioActive, pb, lensOverride }) {
  const { data, engine } = useVault();
  const { STAGES, FLOW_EDGES, TIER_LABELS, COUNTRY_NAMES, COMPANY_BY_ID, CUSTOMERS, SUPPLIERS } = data;
  const { STAGE_BY_ID, D, NETWORK_INFLUENCE, STAGE_COMPANIES, companyContribution } = engine;
  const { state, hover, clearHover, draftToggleSource, setFocusedPath } = useInteraction();
  const { hovered, draft, focusedPath } = state;
  // The comparison toggle (§12) can override the global lens for this panel.
  const lens = lensOverride ?? state.lens;

  // Explain-path highlight (§11): edges belonging to the pinned route are
  // drawn bold copper with direction arrowheads, on top of everything else.
  const pathEdgeKeys = useMemo(() => {
    const m = new Map(); // "a|b" -> direction ('downstream'|'upstream')
    (focusedPath?.path?.edges || []).forEach((e) => m.set(`${e.from}|${e.to}`, e.dir));
    return m;
  }, [focusedPath]);
  const pickPath = (p) => setFocusedPath(p ? { sourceId: p.nodes[0], targetId: p.nodes.at(-1), path: p } : null);

  // Shift-click (or Compose builder mode) marks a stage as a scenario shock
  // source instead of inspecting it (§10); a plain click still inspects.
  const draftStageIds = useMemo(() => new Set(draft.sources.filter((s) => s.type === 'stage').map((s) => s.id)), [draft.sources]);
  const onNodeActivate = (ev, id) => {
    if (ev.shiftKey || draft.builderMode) draftToggleSource({ type: 'stage', id });
    else setSel({ type: 'stage', id });
  };

  // Playback overlay: while a propagation hop is engaged, reached stages
  // stay lit (signed cumulative contribution), unreached ones fade, and the
  // current hop's edges highlight — all driven by the shared frame (pb).
  const pbActive = Boolean(pb);
  const pbCurEdges = useMemo(() => {
    const m = new Set();
    (pb?.edges || []).forEach((e) => m.add(`${e.from}|${e.to}`));
    return m;
  }, [pb]);

  const dimAll = hl.s.size > 0;
  const subStage = sel.type === 'stage' ? STAGE_BY_ID[sel.id] : null;
  const maxD = Math.max(...FLOW_EDGES.map(([a, b]) => D[b]?.[a] ?? 0), 1e-9);

  const { enc: gEnc, legend } = graphEncoding({ lens, model, engine, data, selected: sel });
  const lg = legendFor(lens, legend);

  // Ephemeral hover-highlight — stages related to whatever is hovered on
  // another panel (a country on the map, or a company). Temporary and
  // additive; never replaces the pinned selection (§6).
  const hoverStages = useMemo(() => {
    const s = new Set();
    if (!hovered) return s;
    if (hovered.type === 'stage') s.add(hovered.id);
    else if (hovered.type === 'country') STAGES.forEach((st) => (st.shares?.[hovered.id] ?? 0) >= 0.05 && s.add(st.id));
    else if (hovered.type === 'company') Object.keys(COMPANY_BY_ID[hovered.id]?.stakes || {}).forEach((sid) => s.add(sid));
    return s;
  }, [hovered, STAGES, COMPANY_BY_ID]);

  return (
    <div style={{ padding: 10 }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: 1, color: C.copper, marginBottom: 6 }}>{legend.title.toUpperCase()}</div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox="0 0 1220 505" style={{ width: '100%', minWidth: 860, display: 'block', background: C.panel2, borderRadius: 6, border: `1px solid ${C.line}` }}>
          <defs>
            <marker id="fg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={C.copper} />
            </marker>
          </defs>
          {TIER_LABELS.map(([label, x]) => <text key={label} x={x} y={16} textAnchor="middle" className="mono" fill={C.faint} fontSize="8.5" letterSpacing="2">{label}</text>)}
          {FLOW_EDGES.map(([a, b], i) => {
            const sa = STAGE_BY_ID[a], sb = STAGE_BY_ID[b];
            const coeff = D[b]?.[a] ?? 0;
            const w = coeff / maxD;
            const x1 = sa.x + 47, x2 = sb.x - 47, midX = (x1 + x2) / 2;
            const d = sa.y === sb.y ? `M${x1},${sa.y} L${x2},${sb.y}` : `M${x1},${sa.y} L${midX},${sa.y} L${midX},${sb.y} L${x2},${sb.y}`;
            const edgeTitle = `${sa.name} → ${sb.name} · input-dependence prior D=${coeff.toFixed(3)} · unvalidated propagation prior, not a measured trade flow`;
            if (pbActive) {
              // Edges can carry the shock in either direction (downstream
              // buyer-dependence or upstream supplier-echo), so check both
              // orientations against this hop's active edge set.
              const onHop = pbCurEdges.has(`${a}|${b}`) || pbCurEdges.has(`${b}|${a}`);
              const reached = pb.reachedStages.has(a) && pb.reachedStages.has(b);
              return <path key={i} d={d} fill="none" className={onHop ? 'pulse' : undefined}
                stroke={onHop ? C.copper : reached ? C.copperDim : C.line}
                strokeWidth={onHop ? 1.4 + 2 * w : 0.6 + 2 * w}
                markerEnd={onHop ? 'url(#fg-arrow)' : undefined}
                opacity={onHop ? 1 : reached ? 0.55 : 0.1}><title>{edgeTitle}</title></path>;
            }
            // Explain-path route edges win the styling and get an arrowhead.
            const onPath = pathEdgeKeys.has(`${a}|${b}`);
            if (onPath) {
              return <path key={i} d={d} fill="none" className="pulse" stroke={C.copper}
                strokeWidth={1.8 + 2 * w} markerEnd="url(#fg-arrow)" opacity={1}><title>{edgeTitle}</title></path>;
            }
            const lit = (hl.s.has(a) && hl.s.has(b)) || (hoverStages.has(a) && hoverStages.has(b));
            const routePinned = pathEdgeKeys.size > 0;
            return <path key={i} d={d} fill="none" stroke={lit ? C.copper : C.copperDim}
              strokeWidth={0.6 + 2 * w} style={{ cursor: 'help' }}
              opacity={routePinned ? 0.12 : lit ? 1 : dimAll ? 0.15 : 0.5}><title>{edgeTitle}</title></path>;
          })}
          {STAGES.map((st) => {
            const e = gEnc[st.id] || {};
            const ni = NETWORK_INFLUENCE[st.id];
            const active = hl.s.has(st.id);
            const hoverLit = hoverStages.has(st.id);
            const isSel = sel.type === 'stage' && sel.id === st.id;
            const delta = model.stageDelta[st.id] ?? 0;

            // Playback overrides the lens encoding for this node while a hop
            // is engaged: reached stages carry their signed cumulative
            // contribution, newly-reached ones pulse, unreached fade out.
            const pbReached = pbActive && pb.reachedStages.has(st.id);
            const pbNew = pbActive && pb.newStages.has(st.id);
            const pbVal = pbReached ? (pb.cumulative[st.id] ?? 0) : 0;
            const col = pbActive ? (pbReached ? signedColor(pbVal) : C.faint) : (e.color || C.faint);
            const badge = pbActive ? (pbReached ? fmtSigned(pbVal) : '') : (e.badge || '');
            const extraDelta = !pbActive && lens === 'structural' && scenarioActive && Math.abs(delta) > 0.01 ? ` ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}Δ` : '';
            const groupOpacity = pbActive ? (pbReached ? 1 : 0.12) : (dimAll && !active && !hoverLit ? 0.3 : 1);
            const isDraftSrc = draftStageIds.has(st.id);
            return (
              <g key={st.id} className="node" opacity={groupOpacity}
                onClick={(ev) => onNodeActivate(ev, st.id)}
                onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onNodeActivate(ev, st.id))}
                onMouseEnter={() => hover({ type: 'stage', id: st.id })} onMouseLeave={clearHover}
                tabIndex={0} role="button" aria-label={`${st.name}. ${isDraftSrc ? 'Scenario shock source. ' : ''}${pbActive ? (pbReached ? `reached, contribution ${fmtSigned(pbVal)}` : 'not yet reached') : `${legend.title}: ${e.aria || badge}`}. ${draft.builderMode ? 'Click to toggle as shock source. ' : ''}${STAGE_INTRO[st.id] ?? ''}`}>
                <title>{STAGE_INTRO[st.id]}</title>
                {isDraftSrc && <rect x={st.x - 53} y={st.y - 26} width={106} height={52} rx={8} fill="none" stroke={C.amber} strokeWidth={1.6} strokeDasharray="4 3" />}
                {isSel && <rect x={st.x - 51} y={st.y - 24} width={102} height={48} rx={7} fill="none" stroke={C.copper} strokeWidth={2} />}
                {pbNew && <rect className="pulse" x={st.x - 51} y={st.y - 24} width={102} height={48} rx={7} fill="none" stroke={C.copper} strokeWidth={2} />}
                <rect x={st.x - 47} y={st.y - 20} width={94} height={40} rx={5}
                  fill={active || hoverLit ? '#1B2436' : C.panel} stroke={isSel ? C.text : active ? col : hoverLit ? C.copper : C.line} strokeWidth={isSel ? 1.6 : 0.6 + ni / 8} />
                <circle cx={st.x - 37} cy={st.y - 10} r={2 + ni / 3.2} fill={col}>
                  {(active || pbNew) && <animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite" />}
                </circle>
                <text x={st.x + 3} y={st.y - 3} textAnchor="middle" fill={C.text} fontSize="9.5" fontWeight="600">
                  {st.name.length > 19 ? st.name.slice(0, 18) + '…' : st.name}
                </text>
                <text x={st.x - 14} y={st.y + 12} textAnchor="middle" fill={col} fontSize="9.5" className="mono" fontWeight="600">
                  {badge}{extraDelta}
                </text>
                <text x={st.x + 30} y={st.y + 12} textAnchor="middle" fill={C.faint} fontSize="8" className="mono">
                  NI {ni.toFixed(1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ---- STAGE SUBSECTION: companies & shares of the selected stage ---- */}
      {subStage && (
        <div style={{ marginTop: 8, border: `1px solid ${C.copperDim}`, borderRadius: 6, background: C.panel2, padding: '8px 10px' }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: 2, color: C.copper, marginBottom: 4 }}>
            SUBSECTION · {subStage.name.toUpperCase()} · MAJOR COMPANIES & MARKET SHARES
            {Math.abs(model.activeField[subStage.id] ?? 0) > 0.05 && <span style={{ color: riskColor((model.activeField[subStage.id] + 1) * 5), marginLeft: 8 }}>· operational impact {model.activeField[subStage.id].toFixed(2)}</span>}
          </div>
          <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginBottom: 8 }}>{STAGE_INTRO[subStage.id]}</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {STAGE_COMPANIES[subStage.id].map(([cid, sh]) => {
              const co = COMPANY_BY_ID[cid];
              const contribution = companyContribution(co, model.activeField);
              return (
                <div key={cid} className="evcard" onClick={() => setSel({ type: 'company', id: cid })}
                  role="button" tabIndex={0} onKeyDown={onEnterSpace(() => setSel({ type: 'company', id: cid }))}
                  onMouseEnter={() => hover({ type: 'company', id: cid })} onMouseLeave={clearHover}
                  title={introForCompany(co, { STAGE_BY_ID, COUNTRY_NAMES, CUSTOMERS, SUPPLIERS })}
                  style={{ minWidth: 128, border: `1px solid ${C.line}`, borderRadius: 6, background: C.panel, padding: '7px 9px', flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 5 }}><Logo cid={cid} size={15} />{co.name}</div>
                  <div className="mono" style={{ fontSize: 9, color: C.faint, margin: '2px 0 4px' }}>HQ: {COUNTRY_NAMES[co.country]}</div>
                  <div style={{ height: 5, background: C.panel2, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${sh * 100}%`, height: '100%', background: C.copper, opacity: 0.85 }} />
                  </div>
                  <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginTop: 3 }}>
                    <span style={{ color: C.copper }}>share {(sh * 100).toFixed(0)}%</span>
                    {contribution > 0.02 && <span style={{ color: riskColor(contribution * 10) }}>contrib {contribution.toFixed(3)}</span>}
                  </div>
                  {(CUSTOMERS[cid] || []).length > 0 && (
                    <div className="mono" style={{ fontSize: 8.5, color: C.dim, marginTop: 3, lineHeight: 1.5 }}>
                      → {(CUSTOMERS[cid] || []).slice(0, 3).map(([c2, r]) => `${COMPANY_BY_ID[c2].name.split(' ')[0]} ${(r * 100).toFixed(0)}%`).join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
            {(() => {
              const tot = STAGE_COMPANIES[subStage.id].reduce((a, [, sh]) => a + sh, 0);
              return tot < 0.98 ? (
                <div className="mono" style={{ minWidth: 90, border: `1px dashed ${C.line}`, borderRadius: 6, padding: '7px 9px', fontSize: 10, color: C.faint, flexShrink: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                  Others<br />{((1 - tot) * 100).toFixed(0)}% (unmodeled residual)
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

      <PathExplorer defaultOrigin={sel.type === 'stage' ? sel.id : undefined} activePath={focusedPath?.path} onPick={pickPath} />

      <Legend items={lg.items} note={lg.note} />
    </div>
  );
}
