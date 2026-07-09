import { Fragment } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { riskColor } from '../utils/colors.js';
import Logo from './Logo.jsx';

/* ================= Customer-graph spread: one company → its customers → theirs ================= */
export default function CustomerSpreadTree({ cid, shock, setSel }) {
  const { data, engine } = useVault();
  const { COMPANY_BY_ID } = data;
  const { customerSpread, companyExposure } = engine;
  const [h1, h2] = customerSpread(cid, shock);
  if (!h1.length) return null;
  const cols = [
    { t: "SOURCE", rows: [{ cid, rel: 1, exp: companyExposure(COMPANY_BY_ID[cid], shock) }] },
    { t: "DIRECT CUSTOMERS", rows: h1 },
    { t: "THEIR CUSTOMERS", rows: h2 },
  ];
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.copper, margin: "10px 0 5px" }}>
        CUSTOMER-GRAPH SPREAD · % = SHARE OF SUPPLIER'S SALES · EXP = ENGINE EXPOSURE
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", alignItems: "stretch" }}>
        {cols.map((col, h) => (
          <Fragment key={h}>
            {h > 0 && <div style={{ alignSelf: "center", color: C.copper, fontSize: 16, flexShrink: 0 }}>→</div>}
            <div style={{ minWidth: 148, flex: 1 }}>
              <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1, color: C.faint, marginBottom: 4 }}>{col.t}</div>
              {col.rows.length === 0 && <div className="mono" style={{ fontSize: 10, color: C.faint }}>—</div>}
              {col.rows.map((r) => (
                <div key={r.cid} className="evcard" onClick={() => setSel({ type: "company", id: r.cid })}
                  style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${riskColor(r.exp)}`, borderRadius: 4, background: C.panel, padding: "5px 7px", marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={r.cid} size={13} />{COMPANY_BY_ID[r.cid].name}</span>
                    <span className="mono" style={{ fontSize: 10, color: riskColor(r.exp), fontWeight: 600 }}>{r.exp.toFixed(1)}</span>
                  </div>
                  {h > 0 && <div className="mono" style={{ fontSize: 8.5, color: C.faint }}>{h === 1 ? "buys" : "path weight"} {(r.rel * 100).toFixed(0)}%</div>}
                </div>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
