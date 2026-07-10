import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { getEventAssumption } from '../engine/event-assumptions.js';
import { riskColor, riskLabel, confColor, TYPE_COLORS } from '../utils/colors.js';
import { onEnterSpace } from '../utils/a11y.js';
import { STAGE_INTRO, introForCompany, introForCountry } from '../data/glossary.js';
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
const MetricTag = ({ kind }) => {
  const label = kind === 'structural' ? 'STRUCTURAL' : kind === 'scenario' ? 'SCENARIO Δ' : 'OPERATIONAL';
  const color = kind === 'structural' ? C.dim : kind === 'scenario' ? C.copper : C.amber;
  return <span className="mono" style={{ fontSize: 7.5, letterSpacing: 1, color, border: `1px solid ${color}`, borderRadius: 3, padding: "0 4px", marginLeft: 5 }}>{label}</span>;
};

export default function Detail({ sel, setSel, model, scenarioActive }) {
  const { data: vault, engine } = useVault();
  const { COMPANY_BY_ID, COMPANIES, COUNTRY_NAMES, SUPPLIERS, CUSTOMERS, EVENTS, POLICIES, OWNERS } = vault;
  const {
    STAGE_BY_ID, NETWORK_INFLUENCE, NETWORK_INFLUENCE_RANK, STRUCTURAL_VULNERABILITY, STRUCTURAL_WEIGHTS,
    structuralComponents, COUNTRY_LINKS, eventField, operationalIndex, toDisplayIndex,
    COMPANY_CRITICALITY, COMPANY_RANK, companyVulnerability, companyContribution,
  } = engine;

  /* ---- EVENT: summary + engine math + company-to-company spread ---- */
  if (sel.type === "event") {
    const e = EVENTS.find((x) => x.id === sel.id);
    const assumption = getEventAssumption(e.id);
    const { field, magnitude } = eventField(e);
    const ownIndex = toDisplayIndex(operationalIndex(field));
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: TYPE_COLORS[e.type] || C.copper, border: `1px solid ${TYPE_COLORS[e.type] || C.copper}`, borderRadius: 3, padding: "1px 6px" }}>{e.type.toUpperCase()}</span>
          <span className="mono" style={{ fontSize: 10, color: confColor(e.conf) }}>evidence: {e.conf} <span style={{ color: C.faint }}>(metadata, not an impact multiplier)</span></span>
        </div>
        <h3 style={{ margin: "6px 0", fontSize: 15, lineHeight: 1.35 }}>{e.title}</h3>
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: C.dim, lineHeight: 1.5 }}>{e.summary}</p>
        {!assumption.operational && (
          <div className="mono" style={{ fontSize: 10.5, color: C.amber, background: "#2A1E14", border: `1px solid ${C.copperDim}`, borderRadius: 5, padding: "6px 9px", marginBottom: 6, lineHeight: 1.5 }}>
            EXCLUDED FROM OPERATIONAL IMPACT SCORE · {assumption.reason}
          </div>
        )}
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
          ENGINE · <Tex tex={`s_0=\\mathrm{clamp}(${e.sev}/10,0,1)\\times 2^{-${e.daysAgo}/12}=${magnitude.toFixed(3)}`} /> · directional all-paths propagation ({assumption.channel}) · <Tex tex={`\\mathrm{index}=${ownIndex.toFixed(2)}`} /><MetricTag kind="operational" />
        </div>
        {(() => { const topCo = COMPANIES.map((c) => ({ c, contribution: companyContribution(c, field) })).sort((a, b) => b.contribution - a.contribution).slice(0, 6);
          return (<><div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "8px 0 4px" }}>TOP MODELED CONTRIBUTION — COMPANIES (SHARE-WEIGHTED)</div>
          {topCo.map(({ c, contribution }) => (
            <div key={c.id} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, cursor: "pointer" }} onClick={() => setSel({ type: "company", id: c.id })} onKeyDown={onEnterSpace(() => setSel({ type: "company", id: c.id }))}>
              <span className="mono" style={{ fontSize: 10, color: C.text, width: 150, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={c.id} size={13} />{c.name}</span>
              <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, contribution * 100)}%`, height: "100%", background: riskColor(contribution * 10), opacity: 0.75 }} />
              </div>
              <span className="mono" style={{ fontSize: 10, width: 34, textAlign: "right", color: C.dim }}>{contribution.toFixed(3)}</span>
            </div>
          ))}</>); })()}
        <SpreadTree sourceStages={e.stages} field={field} setSel={setSel} />
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

  /* ---- COMPANY: vulnerability / contribution / criticality + spread ---- */
  if (sel.type === "company") {
    const co = COMPANY_BY_ID[sel.id];
    const { field, value: criticality } = COMPANY_CRITICALITY[sel.id];
    const rank = COMPANY_RANK.findIndex((x) => x.id === sel.id) + 1;
    const vulnerability = companyVulnerability(co, model.activeField);
    const contribution = companyContribution(co, model.activeField);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <Logo cid={co.id} size={26} />
          <h3 style={{ margin: 0, fontSize: 16 }}>{co.name}</h3>
          <span className="mono" style={{ fontSize: 10, color: C.dim }}>HQ: {COUNTRY_NAMES[co.country]}</span>
          <span className="mono" style={{ fontSize: 10, color: C.copper, marginLeft: "auto" }}>criticality rank #{rank} of {COMPANIES.length}</span>
        </div>
        <p style={{ margin: "6px 0 4px", fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>{introForCompany(co, { STAGE_BY_ID, COUNTRY_NAMES, CUSTOMERS, SUPPLIERS })}</p>
        <div className="mono" style={{ margin: "8px 0", fontSize: 12, display: "flex", flexWrap: "wrap", gap: 14 }}>
          <span>SYSTEMIC CRITICALITY <b style={{ fontSize: 16, color: riskColor(criticality) }}>{criticality.toFixed(2)}</b><span style={{ color: C.faint }}>/10</span></span>
          <span>VULNERABILITY <b style={{ fontSize: 16, color: riskColor(vulnerability) }}>{vulnerability.toFixed(2)}</b><span style={{ color: C.faint }}>/10 (share-independent)</span></span>
          <span>CONTRIBUTION <b style={{ fontSize: 16, color: C.copper }}>{contribution.toFixed(3)}</b><span style={{ color: C.faint }}> (share-weighted)</span></span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: C.faint, marginBottom: 8, lineHeight: 1.5 }}>
          Criticality = modeled chain effect if this company's production were fully disrupted (network-influence-weighted, then scaled against the most critical company in the snapshot — so 10 means "the most systemically critical company here," not a theoretical ceiling no company can reach). Vulnerability = average adverse impact across its stages, independent of market share — a small and a large single-stage company can share this number. Contribution = market-share-weighted modeled effect; share does not cancel here.
          <Tex tex={"\\mathrm{criticality}_c=\\mathrm{clamp}_{10}\\!\\left(10\\cdot\\frac{\\mathrm{raw}_c}{\\max_k \\mathrm{raw}_k}\\right),\\quad \\mathrm{raw}_c=\\frac{\\sum_n \\max(0,\\mathrm{field}_n)\\cdot NI_n}{\\sum_n NI_n}"} />
        </div>
        <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "8px 0 4px" }}>PRODUCTION FOOTPRINT (WITHIN-STAGE SHARE)</div>
        {Object.entries(co.stakes).sort((a, b) => b[1] - a[1]).map(([sid, sh]) => (
          <div key={sid} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, cursor: "pointer" }} onClick={() => setSel({ type: "stage", id: sid })} onKeyDown={onEnterSpace(() => setSel({ type: "stage", id: sid }))}>
            <span className="mono" style={{ fontSize: 10, color: C.dim, width: 160, flexShrink: 0 }}>{STAGE_BY_ID[sid].name}</span>
            <div style={{ flex: 1, height: 6, background: C.panel, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${sh * 100}%`, height: "100%", background: C.copper, opacity: 0.8 }} />
            </div>
            <span className="mono" style={{ fontSize: 10, width: 34, textAlign: "right", color: C.copper }}>{(sh * 100).toFixed(0)}%</span>
          </div>
        ))}

        {(CUSTOMERS[co.id] || []).length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "10px 0 4px" }}>CUSTOMERS (SHARE OF {co.name.toUpperCase()} SALES — SUPPLIER-REVENUE SHARE)</div>
            {(CUSTOMERS[co.id] || []).map(([c2, r]) => (
              <div key={c2} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, cursor: "pointer" }} onClick={() => setSel({ type: "company", id: c2 })} onKeyDown={onEnterSpace(() => setSel({ type: "company", id: c2 }))}>
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
        <CustomerSpreadTree cid={co.id} field={model.activeField} setSel={setSel} />
        <SpreadTree sourceStages={Object.keys(co.stakes)} field={field} exclude={co.id} setSel={setSel} title="STAGE-LEVEL SPREAD (CRITICALITY VIEW)" />
      </div>
    );
  }

  /* ---- STAGE / COUNTRY ---- */
  const isStage = sel.type === "stage";
  const node = isStage ? STAGE_BY_ID[sel.id] : null;
  const structural = isStage ? STRUCTURAL_VULNERABILITY[sel.id] : model.countriesActive[sel.id]?.structural;
  const operationalNow = isStage ? model.activeField[sel.id] : model.countriesActive[sel.id]?.operational;
  const operationalBase = isStage ? model.baselineField[sel.id] : model.countriesBase[sel.id]?.operational;
  const delta = (operationalNow ?? 0) - (operationalBase ?? 0);
  const name = isStage ? node.name : COUNTRY_NAMES[sel.id];
  const related = EVENTS.filter((e) => (isStage ? e.stages : e.countries).includes(sel.id));
  const policies = isStage ? POLICIES.filter((p) => p.stages.includes(sel.id)) : [];
  const impRank = isStage ? NETWORK_INFLUENCE_RANK.indexOf(sel.id) + 1 : null;
  const comp = isStage ? structuralComponents(node) : model.countriesActive[sel.id]?.structComp;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{name}</h3>
        <span className="mono" style={{ fontSize: 16, fontWeight: 600, color: riskColor(structural) }}>{structural?.toFixed(2)}</span>
        <span className="mono" style={{ fontSize: 10, color: riskColor(structural), border: `1px solid ${riskColor(structural)}`, borderRadius: 3, padding: "1px 6px" }}>{riskLabel(structural)}<MetricTag kind="structural" /></span>
        {scenarioActive && Math.abs(delta) > 0.01 && (
          <span className="mono" style={{ fontSize: 11, color: delta >= 0 ? C.red : C.green }}>{delta >= 0 ? "▲" : "▼"} operational Δ {delta >= 0 ? "+" : ""}{delta.toFixed(3)}<MetricTag kind="scenario" /></span>
        )}
      </div>
      <p style={{ margin: "6px 0 4px", fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>
        {isStage ? STAGE_INTRO[sel.id] : introForCountry(sel.id, { COUNTRY_NAMES, STAGE_BY_ID, COMPANIES }, model)}
      </p>
      <div className="mono" style={{ fontSize: 10.5, color: C.dim, margin: "6px 0" }}>
        Operational impact (current): <b style={{ color: (operationalNow ?? 0) > 0 ? C.red : (operationalNow ?? 0) < 0 ? C.green : C.dim }}>{(operationalNow ?? 0).toFixed(3)}</b> (positive = adverse, negative = mitigating)<MetricTag kind="operational" />
      </div>
      {isStage && (
        <div className="mono" style={{ fontSize: 10.5, color: C.dim, margin: "6px 0" }}>
          Network influence <span style={{ color: C.copper, fontWeight: 600 }}>{NETWORK_INFLUENCE[sel.id].toFixed(2)}</span> (rank #{impRank}/24, modeled sensitivity proxy — not measured economic loss) · sample value ~${node.value}B · subsection shown under the flow graph
        </div>
      )}
      {!isStage && (
        <div className="mono" style={{ fontSize: 10.5, color: C.dim, margin: "6px 0 8px", lineHeight: 1.6 }}>
          Derived from (geography, not headquarters): {model.countriesActive[sel.id]?.stages.slice(0, 5).map(([sid, sh]) => `${STAGE_BY_ID[sid]?.name} (${(sh * 100).toFixed(0)}%)`).join(" · ")}
        </div>
      )}
      {!isStage && (() => {
        const outL = COUNTRY_LINKS.filter((l) => l.a === sel.id).slice(0, 4);
        const inL = COUNTRY_LINKS.filter((l) => l.b === sel.id).slice(0, 4);
        return (outL.length + inL.length) > 0 ? (
          <>
            <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 4px" }}>MODELED SUPPLIER-REVENUE RELATIONSHIPS (BY COMPANY HEADQUARTERS)</div>
            {outL.map((l) => (
              <div key={"o" + l.b} role="button" tabIndex={0} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2, cursor: "pointer" }} onClick={() => setSel({ type: "country", id: l.b })} onKeyDown={onEnterSpace(() => setSel({ type: "country", id: l.b }))}>
                <span style={{ color: C.copper }}>supplies →</span> {COUNTRY_NAMES[l.b]} · {l.top.join(", ")} <span style={{ color: C.faint }}>({l.ex[0]})</span>
              </div>
            ))}
            {inL.map((l) => (
              <div key={"i" + l.a} role="button" tabIndex={0} className="mono" style={{ fontSize: 10.5, color: C.dim, marginBottom: 2, cursor: "pointer" }} onClick={() => setSel({ type: "country", id: l.a })} onKeyDown={onEnterSpace(() => setSel({ type: "country", id: l.a }))}>
                <span style={{ color: C.green }}>← sources from</span> {COUNTRY_NAMES[l.a]} · {l.top.join(", ")} <span style={{ color: C.faint }}>({l.ex[0]})</span>
              </div>
            ))}
          </>
        ) : null;
      })()}
      {!isStage && COMPANIES.some((c) => c.country === sel.id) && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "6px 0 4px" }}>HEADQUARTERED HERE (not necessarily produced here)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
            {COMPANIES.filter((c) => c.country === sel.id).map((c) => (
              <Chip key={c.id} label={c.name} onClick={() => setSel({ type: "company", id: c.id })} />
            ))}
          </div>
        </>
      )}

      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.dim, margin: "8px 0 4px" }}>STRUCTURAL VULNERABILITY BREAKDOWN (TIME-INVARIANT)</div>
      {comp && Object.keys(STRUCTURAL_WEIGHTS).map((k) => {
        const val = Math.min(10, Math.max(0, comp[k]));
        const label = { networkInfluence: 'Network influence', geo: 'Geographic concentration (HHI+Other)', policy: 'Policy exposure', subst: 'Substitutability risk', market: 'Market sensitivity' }[k];
        const analyst = k === 'subst' || k === 'market';
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: C.dim, width: 200, flexShrink: 0 }}>
              {label} <span style={{ color: analyst ? C.amber : C.copper, fontSize: 8.5 }}>[{analyst ? "ANALYST" : "GRAPH/DATA"}]</span> <span style={{ color: C.faint }}>×{STRUCTURAL_WEIGHTS[k].toFixed(2)}</span>
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
            <div key={e.id} role="button" tabIndex={0} onClick={() => setSel({ type: "event", id: e.id })} onKeyDown={onEnterSpace(() => setSel({ type: "event", id: e.id }))} style={{ fontSize: 12, color: C.copper, cursor: "pointer", marginBottom: 3 }}>→ {e.title}</div>
          ))}
        </>
      )}
    </div>
  );
}
