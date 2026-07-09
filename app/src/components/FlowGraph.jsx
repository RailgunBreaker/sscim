import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { riskColor } from '../utils/colors.js';
import Logo from './Logo.jsx';
import Legend from './Legend.jsx';

/* ================= Flow Graph + stage subsection ================= */
export default function FlowGraph({ sel, setSel, hl, model, scenarioActive }) {
  const { data, engine } = useVault();
  const { STAGES, FLOW_EDGES, TIER_LABELS, COUNTRY_NAMES, COMPANY_BY_ID, CUSTOMERS } = data;
  const { STAGE_BY_ID, EDGE_W, IMPORTANCE, STAGE_COMPANIES } = engine;
  const dimAll = hl.s.size > 0;
  const subStage = sel.type === "stage" ? STAGE_BY_ID[sel.id] : null;
  return (
    <div style={{ padding: 10 }}>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox="0 0 1220 505" style={{ width: "100%", minWidth: 860, display: "block", background: C.panel2, borderRadius: 6, border: `1px solid ${C.line}` }}>
          {TIER_LABELS.map(([label, x]) => <text key={label} x={x} y={16} textAnchor="middle" className="mono" fill={C.faint} fontSize="8.5" letterSpacing="2">{label}</text>)}
          {FLOW_EDGES.map(([a, b], i) => {
            const sa = STAGE_BY_ID[a], sb = STAGE_BY_ID[b];
            const w = EDGE_W[a + ">" + b];
            const lit = hl.s.has(a) && hl.s.has(b);
            const x1 = sa.x + 47, x2 = sb.x - 47, midX = (x1 + x2) / 2;
            const d = sa.y === sb.y ? `M${x1},${sa.y} L${x2},${sb.y}` : `M${x1},${sa.y} L${midX},${sa.y} L${midX},${sb.y} L${x2},${sb.y}`;
            return <path key={i} d={d} fill="none" stroke={lit ? C.copper : C.copperDim}
              strokeWidth={0.6 + 2 * w} opacity={lit ? 1 : dimAll ? 0.15 : 0.5} />;
          })}
          {STAGES.map((st) => {
            const m = model.stages[st.id];
            const col = riskColor(m.score);
            const imp = IMPORTANCE[st.id];
            const active = hl.s.has(st.id);
            const isSel = sel.type === "stage" && sel.id === st.id;
            const delta = m.score - model.stagesBase[st.id];
            return (
              <g key={st.id} className="node" opacity={dimAll && !active ? 0.3 : 1} onClick={() => setSel({ type: "stage", id: st.id })} tabIndex={0} role="button">
                <rect x={st.x - 47} y={st.y - 20} width={94} height={40} rx={5}
                  fill={active ? "#1B2436" : C.panel} stroke={isSel ? C.text : active ? col : C.line} strokeWidth={isSel ? 1.5 : 0.6 + imp / 8} />
                <circle cx={st.x - 37} cy={st.y - 10} r={2 + imp / 3.2} fill={col}>
                  {active && <animate attributeName="opacity" values="1;.4;1" dur="1.6s" repeatCount="indefinite" />}
                </circle>
                <text x={st.x + 3} y={st.y - 3} textAnchor="middle" fill={C.text} fontSize="9.5" fontWeight="600">
                  {st.name.length > 19 ? st.name.slice(0, 18) + "…" : st.name}
                </text>
                <text x={st.x - 14} y={st.y + 12} textAnchor="middle" fill={col} fontSize="9.5" className="mono" fontWeight="600">
                  {m.score.toFixed(1)}{scenarioActive && delta > 0.05 ? ` +${delta.toFixed(1)}` : ""}
                </text>
                <text x={st.x + 28} y={st.y + 12} textAnchor="middle" fill={C.faint} fontSize="8" className="mono">
                  imp {imp.toFixed(1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ---- STAGE SUBSECTION: companies & shares of the selected stage ---- */}
      {subStage && (
        <div style={{ marginTop: 8, border: `1px solid ${C.copperDim}`, borderRadius: 6, background: C.panel2, padding: "8px 10px" }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: 2, color: C.copper, marginBottom: 6 }}>
            SUBSECTION · {subStage.name.toUpperCase()} · MAJOR COMPANIES & MARKET SHARES
            {model.shock[subStage.id] > 0.3 && <span style={{ color: riskColor(model.shock[subStage.id]), marginLeft: 8 }}>· stage shock {model.shock[subStage.id].toFixed(1)}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {STAGE_COMPANIES[subStage.id].map(([cid, sh]) => {
              const co = COMPANY_BY_ID[cid];
              const exp = sh * model.shock[subStage.id];
              return (
                <div key={cid} className="evcard" onClick={() => setSel({ type: "company", id: cid })}
                  style={{ minWidth: 128, border: `1px solid ${C.line}`, borderRadius: 6, background: C.panel, padding: "7px 9px", flexShrink: 0 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 5 }}><Logo cid={cid} size={15} />{co.name}</div>
                  <div className="mono" style={{ fontSize: 9, color: C.faint, margin: "2px 0 4px" }}>{COUNTRY_NAMES[co.country]}</div>
                  <div style={{ height: 5, background: C.panel2, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${sh * 100}%`, height: "100%", background: C.copper, opacity: 0.85 }} />
                  </div>
                  <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, marginTop: 3 }}>
                    <span style={{ color: C.copper }}>share {(sh * 100).toFixed(0)}%</span>
                    {exp > 0.2 && <span style={{ color: riskColor(exp) }}>exp {exp.toFixed(1)}</span>}
                  </div>
                  {(CUSTOMERS[cid] || []).length > 0 && (
                    <div className="mono" style={{ fontSize: 8.5, color: C.dim, marginTop: 3, lineHeight: 1.5 }}>
                      → {(CUSTOMERS[cid] || []).slice(0, 3).map(([c2, r]) => `${COMPANY_BY_ID[c2].name.split(" ")[0]} ${(r * 100).toFixed(0)}%`).join(" · ")}
                    </div>
                  )}
                </div>
              );
            })}
            {(() => {
              const tot = STAGE_COMPANIES[subStage.id].reduce((a, [, sh]) => a + sh, 0);
              return tot < 0.98 ? (
                <div className="mono" style={{ minWidth: 90, border: `1px dashed ${C.line}`, borderRadius: 6, padding: "7px 9px", fontSize: 10, color: C.faint, flexShrink: 0, alignSelf: "stretch", display: "flex", alignItems: "center" }}>
                  Others<br />{((1 - tot) * 100).toFixed(0)}% (sample)
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

      <Legend items={[["Edge width = downstream value share", C.copperDim], ["Dot & border size = importance", C.copper]]}
        note="Tap a stage → subsection of its companies · tap a company → chain impact & spread" />
    </div>
  );
}
