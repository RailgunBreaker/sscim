import { Fragment } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import Logo from './Logo.jsx';

/* ================= Upstream origins: two supplier layers behind a company ================= */
export default function UpstreamTree({ cid, setSel }) {
  const { data, engine } = useVault();
  const { COMPANY_BY_ID, COUNTRY_NAMES } = data;
  const { supplierSpread } = engine;
  const [h1, h2] = supplierSpread(cid);
  if (!h1.length) return null;
  const cols = [
    { t: "TIER-2 ORIGINS", rows: h2 },
    { t: "DIRECT SUPPLIERS", rows: h1 },
    { t: "COMPANY", rows: [{ cid, rel: 1 }] },
  ];
  return (
    <div>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 2, color: C.copper, margin: "10px 0 5px" }}>
        UPSTREAM ORIGINS · TWO LAYERS BEFORE · % = SUPPLIER'S SALES SHARE ALONG PATH
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
                  style={{ border: `1px solid ${C.line}`, borderLeft: `3px solid ${h === 2 ? C.copper : C.copperDim}`, borderRadius: 4, background: C.panel, padding: "5px 7px", marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Logo cid={r.cid} size={13} />{COMPANY_BY_ID[r.cid].name}</span>
                    {h < 2 && <span className="mono" style={{ fontSize: 10, color: C.dim }}>{(r.rel * 100).toFixed(0)}%</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 8.5, color: C.faint }}>{COUNTRY_NAMES[COMPANY_BY_ID[r.cid].country]}</div>
                </div>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
