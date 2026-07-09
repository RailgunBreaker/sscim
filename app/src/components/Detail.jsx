import { C, WEIGHTS } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { riskColor, riskLabel, confColor, TYPE_COLORS } from '../utils/colors.js';
import Tex from './Tex.jsx';
import Logo from './Logo.jsx';
import Chip from './Chip.jsx';
import SpreadTree from './SpreadTree.jsx';
import UpstreamTree from './UpstreamTree.jsx';
import CustomerSpreadTree from './CustomerSpreadTree.jsx';

const Field = ({ k, v, copper }) => (
  <div style={{ marginBottom: 6 }}>
    <span className="mono" style={{ fontSize: 9, letterSpacing: 2, color: copper ? C.copper : C.dim }}>{k}</span>
    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: copper ? C.copper : C.text }}>{v}</div>
  </div>
);

export default function Detail({ sel, setSel, model, scenarioActive }) {
  const { data: vault, engine } = useVault();
  const { COMPANY_BY_ID, COMPANIES, COMP_META, COUNTRY_NAMES, SUPPLIERS, CUSTOMERS, EVENTS, POLICIES, OWNERS } = vault;
  const { STAGE_BY_ID, IMP_RANK, IMPORTANCE, CHOKE, COUNTRY_LINKS, CONF_W, clamp10, chainImpact, eventShock, COMPANY_IMPACTS, COMPANY_RANK, companyExposure } = engine;
  /* ---- EVENT: summary + engine math + company→company spread ---- */
  if (sel.type === "event") {
    const e = EVENTS.find((x) => x.id === sel.id);
    const base = e.sev * (CONF_W[e.conf] ?? 0.75) * Math.exp(-e.daysAgo / 12);
    const shock = eventShock(e);
    const eii = chainImpact(shock);
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: TYPE_COLORS[e.type] || C.copper, border: `1px solid ${TYPE_COLORS[e.type] || C.copper}`, borderRadius: 3, padding: "1px 6px" }}>{e.type.toUpperCase()}</span>
          <span className="mono" style={{ fontSize: 10, color: confColor(e.conf) }}>conf: {e.conf}</span>
        </div>
        <h3 style={{ margin: "6px 0", fontSize: 15, lineHeight: 1.35 }}>{e.title}</h3>
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{e.summary}</p>
        {e.detail && (<><div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 3px" }}>BACKGROUND</div>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: C.dim, lineHeight: 1.55 }}>{e.detail}</p></>)}
        {e.source && <div className="mono" style={{ fontSize: 10, color: C.faint, marginBottom: 6 }}>SOURCE · {e.source}</div>}
        {e.timeline && (<><div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 3px" }}>TIMELINE</div>
        {e.timeline.map(([d, txt]) => (
          <div key={d + txt} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2 }}>
            <span style={{ color: C.copper, display: "inline-block", width: 58 }}>{d}</span>{txt}
          </div>
        ))}</>)}
        <div className="mono" style={{ fontSize: 10.5, color: C.copper, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 5, padding: "6px 9px", margin: "8px 0 4px", lineHeight: 1.7 }}>
          ENGINE · <Tex tex={`s_0=${e.sev}\\times ${CONF_W[e.conf]}\\times e^{-${e.daysAgo}/12}=${base.toFixed(2)}`} /> · value-weighted hops · <Tex tex={`\\mathrm{EII}=${eii.toFixed(2)}`} />
        </div>
        {(() => { const topExp = COMPANIES.map((c) => ({ c, exp: companyExposure(c, shock) })).sort((a, b) => b.exp - a.exp).slice(0, 6);
          return (<><div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "8px 0 4px" }}>MOST-EXPOSED COMPANIES (COMPUTED)</div>
          {topExp.map(({ c, exp }) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, cursor: "pointer" }} onClick={() => setSel({ type: "company", id: c.id })}>
              <span className="mono" style={{ fontSize: 10, color: C.text, width: 150, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={c.id} size={13} />{c.name}</span>
              <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${exp * 10}%`, height: "100%", background: riskColor(exp), opacity: 0.75 }} />
              </div>
              <span className="mono" style={{ fontSize: 10, width: 28, textAlign: "right", color: C.dim }}>{exp.toFixed(1)}</span>
            </div>
          ))}</>); })()}
        <SpreadTree sourceStages={e.stages} shock={shock} setSel={setSel} />
        <div style={{ marginTop: 10 }}>
          <Field k="FIRST-ORDER" v={e.first} />
          <Field k="SECOND-ORDER" v={e.second} />
          <Field k="WATCH NEXT" v={e.watch} copper />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {e.stages.map((id) => <Chip key={id} label={STAGE_BY_ID[id]?.name} onClick={() => setSel({ type: "stage", id })} />)}
          {e.countries.map((id) => <Chip key={id} label={COUNTRY_NAMES[id]} onClick={() => setSel({ type: "country", id })} outline />)}
        </div>
      </div>
    );
  }

  /* ---- COMPANY: footprint + CII + its own company→company spread ---- */
  if (sel.type === "company") {
    const co = COMPANY_BY_ID[sel.id];
    const { shock, index } = COMPANY_IMPACTS[sel.id];
    const rank = COMPANY_RANK.findIndex((x) => x.id === sel.id) + 1;
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <Logo cid={co.id} size={26} />
          <h3 style={{ margin: 0, fontSize: 16 }}>{co.name}</h3>
          <span className="mono" style={{ fontSize: 10, color: C.dim }}>{COUNTRY_NAMES[co.country]}</span>
          <span className="mono" style={{ fontSize: 10, color: C.copper, marginLeft: "auto" }}>impact rank #{rank} of {COMPANIES.length}</span>
        </div>
        <div className="mono" style={{ margin: "8px 0", fontSize: 13 }}>
          COMPANY IMPACT INDEX: <span style={{ fontSize: 18, fontWeight: 700, color: riskColor(index * 2.5) }}>{index.toFixed(2)}</span>
          <span style={{ color: C.faint, fontSize: 10 }}> / 10 · </span><Tex tex={"s_0(s)=10\\cdot\\text{share}_{c,s}\\Rightarrow\\mathrm{CII}=\\tfrac{\\sum s_n I_n}{\\sum I_n}"} />
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "8px 0 4px" }}>PRODUCTION FOOTPRINT (WITHIN-STAGE SHARE)</div>
        {Object.entries(co.stakes).sort((a, b) => b[1] - a[1]).map(([sid, sh]) => (
          <div key={sid} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, cursor: "pointer" }} onClick={() => setSel({ type: "stage", id: sid })}>
            <span className="mono" style={{ fontSize: 10, color: C.dim, width: 160, flexShrink: 0 }}>{STAGE_BY_ID[sid].name}</span>
            <div style={{ flex: 1, height: 6, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${sh * 100}%`, height: "100%", background: C.copper, opacity: 0.8 }} />
            </div>
            <span className="mono" style={{ fontSize: 10, width: 34, textAlign: "right", color: C.copper }}>{(sh * 100).toFixed(0)}%</span>
          </div>
        ))}

        {(CUSTOMERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>CUSTOMERS IN THE CHAIN (SHARE OF {co.name.toUpperCase()} SALES)</div>
            {(CUSTOMERS[co.id] || []).map(([c2, r]) => (
              <div key={c2} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, cursor: "pointer" }} onClick={() => setSel({ type: "company", id: c2 })}>
                <span className="mono" style={{ fontSize: 10, color: C.text, width: 160, flexShrink: 0 }}>{COMPANY_BY_ID[c2].name}</span>
                <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${r * 100}%`, height: "100%", background: C.green, opacity: 0.6 }} />
                </div>
                <span className="mono" style={{ fontSize: 10, width: 34, textAlign: "right", color: C.dim }}>{(r * 100).toFixed(0)}%</span>
              </div>
            ))}
          </>
        )}
        {(SUPPLIERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>KEY SUPPLIERS (THEIR SALES SHARE TO {co.name.toUpperCase()})</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(SUPPLIERS[co.id] || []).slice(0, 8).map(([sup, r]) => (
                <Chip key={sup} label={`${COMPANY_BY_ID[sup].name} ${(r * 100).toFixed(0)}%`} onClick={() => setSel({ type: "company", id: sup })} />
              ))}
            </div>
          </>
        )}

        {(OWNERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>MAJOR SHAREHOLDERS (SAMPLE, PUBLIC FILINGS)</div>
            {(OWNERS[co.id] || []).map(([o, sh]) => (
              <div key={o} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span className="mono" style={{ fontSize: 10, color: /gov|SOE|METI/.test(o) ? C.amber : C.text, width: 180, flexShrink: 0 }}>{o}</span>
                <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, sh * 100)}%`, height: "100%", background: /gov|SOE|METI/.test(o) ? C.amber : C.copper, opacity: 0.7 }} />
                </div>
                <span className="mono" style={{ fontSize: 10, width: 40, textAlign: "right", color: C.dim }}>{(sh * 100).toFixed(1)}%</span>
              </div>
            ))}
          </>
        )}
        <UpstreamTree cid={co.id} setSel={setSel} />
        <CustomerSpreadTree cid={co.id} shock={shock} setSel={setSel} />
        <SpreadTree sourceStages={Object.keys(co.stakes)} shock={shock} exclude={co.id} setSel={setSel} title="STAGE-LEVEL SPREAD (ENGINE VIEW)" />
      </div>
    );
  }

  /* ---- STAGE / COUNTRY ---- */
  const isStage = sel.type === "stage";
  const node = isStage ? STAGE_BY_ID[sel.id] : null;
  const data = isStage ? model.stages[sel.id] : model.countries[sel.id];
  const baseScore = isStage ? model.stagesBase[sel.id] : model.countriesBase[sel.id]?.score;
  const name = isStage ? node.name : COUNTRY_NAMES[sel.id];
  const related = EVENTS.filter((e) => (isStage ? e.stages : e.countries).includes(sel.id));
  const policies = isStage ? POLICIES.filter((p) => p.stages.includes(sel.id)) : [];
  const impRank = isStage ? IMP_RANK.indexOf(sel.id) + 1 : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{name}</h3>
        <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: riskColor(data.score) }}>{data.score.toFixed(2)}</span>
        <span className="mono" style={{ fontSize: 10, color: riskColor(data.score), border: `1px solid ${riskColor(data.score)}`, borderRadius: 3, padding: "1px 6px" }}>{riskLabel(data.score)}</span>
        {scenarioActive && data.score - baseScore > 0.05 && (
          <span className="mono" style={{ fontSize: 11, color: C.copper }}>▲ +{(data.score - baseScore).toFixed(2)} vs baseline</span>
        )}
      </div>
      {isStage && (
        <div className="mono" style={{ fontSize: 10.5, color: C.dim, margin: "6px 0" }}>
          Importance <span style={{ color: C.copper, fontWeight: 600 }}>{IMPORTANCE[sel.id].toFixed(2)}</span> (rank #{impRank}/24) · value ~${node.value}B (sample) · centrality {CHOKE[sel.id].toFixed(1)} · subsection shown under the flow graph
        </div>
      )}
      {!isStage && (
        <div className="mono" style={{ fontSize: 10.5, color: C.dim, margin: "6px 0 8px", lineHeight: 1.6 }}>
          Derived from: {data.stages.slice(0, 5).map(([sid, sh]) => `${STAGE_BY_ID[sid]?.name} (${(sh * 100).toFixed(0)}%)`).join(" · ")}
        </div>
      )}
      {!isStage && (() => {
        const outL = COUNTRY_LINKS.filter((l) => l.a === sel.id).slice(0, 4);
        const inL = COUNTRY_LINKS.filter((l) => l.b === sel.id).slice(0, 4);
        return (outL.length + inL.length) > 0 ? (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 4px" }}>CHAIN CONNECTIONS (FROM CUSTOMER GRAPH)</div>
            {outL.map((l) => (
              <div key={"o" + l.b} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2, cursor: "pointer" }} onClick={() => setSel({ type: "country", id: l.b })}>
                <span style={{ color: C.copper }}>supplies →</span> {COUNTRY_NAMES[l.b]} · {l.top.join(", ")} <span style={{ color: C.faint }}>({l.ex[0]})</span>
              </div>
            ))}
            {inL.map((l) => (
              <div key={"i" + l.a} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2, cursor: "pointer" }} onClick={() => setSel({ type: "country", id: l.a })}>
                <span style={{ color: C.green }}>← sources from</span> {COUNTRY_NAMES[l.a]} · {l.top.join(", ")} <span style={{ color: C.faint }}>({l.ex[0]})</span>
              </div>
            ))}
          </>
        ) : null;
      })()}
      {!isStage && COMPANIES.some((c) => c.country === sel.id) && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 4px" }}>HEADQUARTERED HERE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
            {COMPANIES.filter((c) => c.country === sel.id).map((c) => (
              <Chip key={c.id} label={c.name} onClick={() => setSel({ type: "company", id: c.id })} />
            ))}
          </div>
        </>
      )}

      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "8px 0 4px" }}>COMPUTED SCORE BREAKDOWN</div>
      {Object.keys(WEIGHTS).map((k) => {
        const val = clamp10(data.comp[k]);
        const [label, source] = COMP_META[k];
        const analyst = source === "ANALYST";
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: C.dim, width: 176, flexShrink: 0 }}>
              {label} <span style={{ color: analyst ? C.amber : C.copper, fontSize: 8.5 }}>[{source}]</span> <span style={{ color: C.faint }}>×{WEIGHTS[k]}</span>
            </span>
            <div style={{ flex: 1, height: 6, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${val * 10}%`, height: "100%", background: riskColor(val), opacity: 0.7 }} />
            </div>
            <span className="mono" style={{ fontSize: 10, width: 30, textAlign: "right", color: C.dim }}>{val.toFixed(1)}</span>
          </div>
        );
      })}

      {policies.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>ACTIVE POLICY INSTRUMENTS</div>
          {policies.map((p) => (
            <div key={p.id} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2 }}>
              <span style={{ color: riskColor(p.sev) }}>sev {p.sev}</span> · {p.name}
            </div>
          ))}
        </>
      )}
      {related.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>ATTACHED EVENTS</div>
          {related.map((e) => (
            <div key={e.id} onClick={() => setSel({ type: "event", id: e.id })} style={{ fontSize: 12, color: C.copper, cursor: "pointer", marginBottom: 3 }}>→ {e.title}</div>
          ))}
        </>
      )}
    </div>
  );
}
