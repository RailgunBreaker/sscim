import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { useVault } from '../data/VaultContext.jsx';
import { getEventAssumption } from '../engine/event-assumptions.js';
import { TYPE_COLORS, riskColor } from '../utils/colors.js';
import { onEnterSpace } from '../utils/a11y.js';
import { STAGE_INTRO, introForCompany } from '../data/glossary.js';
import Logo from './Logo.jsx';
import Detail from './Detail.jsx';

/* ================= Intelligence Panel ================= */
export default function Intel({ sel, setSel, model, scenarioActive, horizontal, feedTab, setFeedTab }) {
  const { data, engine } = useVault();
  const { EVENTS, COMPANY_BY_ID, COUNTRY_NAMES, SUPPLIERS, CUSTOMERS } = data;
  const { STAGE_BY_ID, CAP_RANK, MOVERS7D, COMPANY_CRITICALITY, COMPANY_RANK, eventField, operationalIndex, toDisplayIndex } = engine;
  return (
    <div style={{ display: horizontal ? "grid" : "block", gridTemplateColumns: horizontal ? "1.5fr 1fr" : undefined }}>
      <div style={{ padding: 12, borderRight: horizontal ? `1px solid ${C.line}` : "none", borderBottom: horizontal ? "none" : `1px solid ${C.line}` }}>
        <Detail sel={sel} setSel={setSel} model={model} scenarioActive={scenarioActive} />
      </div>
      <div>
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.line}` }}>
          {[["events", "EVENTS"], ["companies", "COMPANIES"], ["movers", "MOVERS 7D"], ["capital", "CAPITAL"]].map(([k, v]) => [k, t(v)]).map(([k, v]) => (
            <button key={k} onClick={() => setFeedTab(k)} className="mono"
              style={{ flex: 1, padding: "8px 0", background: "transparent", border: "none", borderBottom: feedTab === k ? `2px solid ${C.copper}` : "2px solid transparent", color: feedTab === k ? C.copper : C.dim, fontSize: 9.5, letterSpacing: 1.5, cursor: "pointer", fontFamily: "inherit" }}>
              {v}
            </button>
          ))}
        </div>
        <div style={{ overflowY: "auto", padding: "8px 12px 12px", maxHeight: horizontal ? 420 : 440 }}>
          {feedTab === "events" && EVENTS.map((e) => {
            const active = sel.type === "event" && sel.id === e.id;
            const assumption = getEventAssumption(e.id);
            const ownIndex = toDisplayIndex(operationalIndex(eventField(e).field));
            return (
              <div key={e.id} className="evcard" onClick={() => setSel({ type: "event", id: e.id })}
                role="button" tabIndex={0} onKeyDown={onEnterSpace(() => setSel({ type: "event", id: e.id }))}
                style={{ border: `1px solid ${active ? C.copper : C.line}`, background: active ? "#1A2132" : C.panel, borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: TYPE_COLORS[e.type] || C.copper, border: `1px solid ${TYPE_COLORS[e.type] || C.copper}`, borderRadius: 3, padding: "1px 6px" }}>{e.type.toUpperCase()}</span>
                  <span className="mono" style={{ fontSize: 10, color: C.faint }}>{e.date}</span>
                  <span className="mono" style={{ fontSize: 10, color: assumption.operational ? C.copper : C.faint, marginLeft: "auto" }}>
                    {assumption.operational ? `index ${ownIndex.toFixed(2)}` : "excluded from score"}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 5, lineHeight: 1.35 }}>{e.title}</div>
              </div>
            );
          })}
          {feedTab === "capital" && (
            <>
              <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginBottom: 8, lineHeight: 1.5 }}>
                CAPITAL POWER = Σ ownership% × company systemic criticality. <span style={{ color: C.amber }}>Amber = state-linked capital.</span> Sample data from public filings.
              </div>
              {CAP_RANK.slice(0, 14).map((r, i) => (
                <div key={r.o} style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: "7px 10px", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="mono" style={{ fontSize: 10, color: C.faint, width: 20 }}>#{i + 1}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, color: r.gov ? C.amber : C.text }}>{r.o}</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: C.copper }}>{r.power.toFixed(2)}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 8.5, color: C.faint, marginTop: 3, lineHeight: 1.5 }}>
                    {r.holdings.slice(0, 4).map(([cid, sh]) => `${COMPANY_BY_ID[cid].name} ${(sh * 100).toFixed(1)}%`).join(" · ")}
                  </div>
                </div>
              ))}
            </>
          )}
          {feedTab === "movers" && MOVERS7D.slice(0, 12).map((m) => {
            const st = STAGE_BY_ID[m.id];
            const up = m.d >= 0;
            return (
              <div key={m.id} className="evcard" onClick={() => setSel({ type: "stage", id: m.id })}
                role="button" tabIndex={0} onKeyDown={onEnterSpace(() => setSel({ type: "stage", id: m.id }))}
                title={STAGE_INTRO[m.id]}
                style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: "7px 10px", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{st.name}</span>
                <span className="mono" style={{ fontSize: 10, color: C.dim }}>{m.now.toFixed(1)}</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: Math.abs(m.d) < 0.03 ? C.faint : up ? C.red : C.green, width: 52, textAlign: "right" }}>
                  {Math.abs(m.d) < 0.03 ? "—" : `${up ? "▲" : "▼"} ${Math.abs(m.d).toFixed(2)}`}
                </span>
              </div>
            );
          })}
          {feedTab === "companies" && COMPANY_RANK.slice(0, 18).map((co, i) => {
            const active = sel.type === "company" && sel.id === co.id;
            const criticality = COMPANY_CRITICALITY[co.id].value;
            return (
              <div key={co.id} className="evcard" onClick={() => setSel({ type: "company", id: co.id })}
                role="button" tabIndex={0} onKeyDown={onEnterSpace(() => setSel({ type: "company", id: co.id }))}
                title={introForCompany(co, { STAGE_BY_ID, COUNTRY_NAMES, CUSTOMERS, SUPPLIERS })}
                style={{ border: `1px solid ${active ? C.copper : C.line}`, background: active ? "#1A2132" : C.panel, borderRadius: 6, padding: "7px 10px", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <span className="mono" style={{ fontSize: 10, color: C.faint, width: 20 }}>#{i + 1}</span>
                <Logo cid={co.id} />
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{co.name}</span>
                <span className="mono" style={{ fontSize: 9.5, color: C.dim }}>HQ: {COUNTRY_NAMES[co.country]}</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: riskColor(criticality) }}>{criticality.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
