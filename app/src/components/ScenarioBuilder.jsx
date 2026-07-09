import { useState } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { riskColor } from '../utils/colors.js';

export default function ScenarioBuilder({ onClose, onRun }) {
  const { data } = useVault();
  const [picked, setPicked] = useState(new Set(["adv_fab"]));
  const [sev, setSev] = useState(7);
  const [name, setName] = useState("Custom shock");
  const toggle = (id) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 620, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "18px 20px", color: C.text }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Build a custom scenario</h3>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: C.dim }}>Pick the stages hit by your hypothetical shock and set severity. It runs through the identical propagation engine as live events.</p>
        <input value={name} onChange={(e) => setName(e.target.value)}
          style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, padding: "6px 10px", fontSize: 12.5, fontFamily: "inherit", width: "100%", outline: "none", marginBottom: 10 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
          {data.STAGES.map((s) => (
            <span key={s.id} onClick={() => toggle(s.id)}
              style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, cursor: "pointer",
                background: picked.has(s.id) ? C.copper : C.panel, color: picked.has(s.id) ? "#0C111C" : C.text,
                border: `1px solid ${picked.has(s.id) ? C.copper : C.line}`, fontWeight: picked.has(s.id) ? 700 : 400 }}>
              {s.name}
            </span>
          ))}
        </div>
        <div className="mono" style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>
          SEVERITY <b style={{ color: riskColor(sev), fontSize: 14 }}>{sev}</b> / 10
        </div>
        <input type="range" min="1" max="10" value={sev} onChange={(e) => setSev(+e.target.value)} style={{ width: "100%", accentColor: C.copper, marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button disabled={picked.size === 0}
            onClick={() => onRun({ id: "custom", name, desc: `User-defined severity-${sev} shock at ${picked.size} stage(s).`,
              event: { sev, daysAgo: 0, conf: "Simulated", stages: [...picked], countries: [] } })}
            style={{ background: C.copper, color: "#0C111C", border: "none", borderRadius: 4, padding: "6px 16px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, opacity: picked.size ? 1 : 0.4 }}>
            Run scenario →
          </button>
        </div>
      </div>
    </div>
  );
}
