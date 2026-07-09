import { Fragment } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { riskColor } from '../utils/colors.js';
import Logo from './Logo.jsx';

/* ================= Stage-level spread tree (hop columns) ================= */
export default function SpreadTree({ sourceStages, shock, exclude, setSel, title }) {
  const { data, engine } = useVault();
  const { COMPANY_BY_ID } = data;
  const { STAGE_BY_ID, companySpread } = engine;
  const hops = companySpread(sourceStages, shock, exclude);
  const titles = ["HOP 0 · SOURCE", "HOP 1 · DIRECT DOWNSTREAM", "HOP 2 · SECOND ORDER"];
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.copper, margin: "10px 0 5px" }}>
        {title || "IMPACT SPREAD · COMPANY → COMPANY (exposure = share × propagated shock)"}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", alignItems: "stretch" }}>
        {hops.map((rows, h) => (
          <Fragment key={h}>
            {h > 0 && <div style={{ alignSelf: "center", color: C.copper, fontSize: 16, flexShrink: 0 }}>→</div>}
            <div style={{ minWidth: 148, flex: 1 }}>
              <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, color: C.faint, marginBottom: 4 }}>{titles[h]}</div>
              {rows.length === 0 && <div className="mono" style={{ fontSize: 10, color: C.faint }}>—</div>}
              {rows.map((r) => {
                const co = COMPANY_BY_ID[r.cid];
                return (
                  <div key={r.cid} className="evcard" onClick={() => setSel({ type: "company", id: r.cid })}
                    style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${riskColor(r.exp)}`, borderRadius: 4, background: C.panel, padding: "5px 7px", marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={r.cid} size={13} />{co.name}</span>
                      <span className="mono" style={{ fontSize: 10, color: riskColor(r.exp), fontWeight: 600 }}>{r.exp.toFixed(1)}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 8.5, color: C.faint }}>via {STAGE_BY_ID[r.sid].name}</div>
                  </div>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
