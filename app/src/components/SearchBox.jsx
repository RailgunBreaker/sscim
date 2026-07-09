import { useState, useMemo } from 'react';
import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { useVault } from '../data/VaultContext.jsx';

export default function SearchBox({ setSel }) {
  const { data } = useVault();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const term = q.trim().toLowerCase();
    const out = [];
    data.STAGES.forEach((s) => s.name.toLowerCase().includes(term) && out.push({ type: "stage", id: s.id, label: s.name, k: "STAGE" }));
    data.COMPANIES.forEach((c) => c.name.toLowerCase().includes(term) && out.push({ type: "company", id: c.id, label: c.name, k: "CO" }));
    Object.entries(data.COUNTRY_NAMES).forEach(([id, n]) => n.toLowerCase().includes(term) && out.push({ type: "country", id, label: n, k: "CTRY" }));
    return out.slice(0, 8);
  }, [q, data]);
  return (
    <div style={{ position: "relative" }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search…")}
        style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: "5px 9px", fontSize: 11.5, fontFamily: "inherit", width: 110, outline: "none" }} />
      {results.length > 0 && (
        <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 100, background: C.panel, border: `1px solid ${C.copper}`, borderRadius: 6, minWidth: 220, overflow: "hidden" }}>
          {results.map((r) => (
            <div key={r.type + r.id} onClick={() => { setSel({ type: r.type, id: r.id }); setQ(""); }}
              style={{ padding: "6px 10px", fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10, borderBottom: `1px solid ${C.line}` }}>
              <span>{r.label}</span><span className="mono" style={{ fontSize: 8.5, color: C.copper }}>{r.k}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
