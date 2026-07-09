import { C } from '../theme.js';
import { LANGV, t } from '../i18n/index.js';

/* ================= In-app quick guide ================= */
export default function Guide({ onClose }) {
  const G = ({ n, t: title, children }) => (
    <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
      <span className="mono" style={{ color: "#0C111C", background: C.copper, borderRadius: 4, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.55 }}>{children}</div>
      </div>
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 560, maxHeight: "85vh", overflowY: "auto", padding: "18px 20px", color: C.text }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{LANGV === "en" ? "How to use SSCIM" : t("guideTitle")}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
        <div className="mono" style={{ fontSize: 10, color: C.faint, marginBottom: 12, lineHeight: 1.6 }}>
          {LANGV === "en" ? (<>Three synchronized layers: tap anything in one layer and the other two respond. Colors: <span style={{ color: C.green }}>green &lt;5.5 moderate</span> · <span style={{ color: C.amber }}>amber 5.5–7.5 elevated</span> · <span style={{ color: C.red }}>red ≥7.5 high</span>.</>) : t("g0")}
        </div>
        {LANGV === "en" ? (<>
        <G n="1" t="Start with the event feed (Intelligence panel)">Tap any event card. Affected countries light up on the map, affected stages in the flow, and the detail view shows the engine math, first/second-order effects, and the hop-by-hop company spread tree.</G>
        <G n="2" t="Explore the flow graph">Tap a stage (e.g. Deposition) to open its subsection: major companies, market shares, shock exposure, and their top customers with percentages. Edge thickness = value flow; dot size = importance.</G>
        <G n="3" t="Drill into a company">Company Impact Index (simulated full disruption), production footprint, customers & suppliers with sales shares, two-layer upstream origins, and two spread trees.</G>
        <G n="4" t="Company rank & capital board">COMPANIES ranks by chain impact. CAPITAL ranks shareholders by ownership × chain impact — state-linked capital in amber.</G>
        <G n="5" t="Run a scenario — or build your own">Header buttons inject preset simulated events. ✦ Build scenario: pick stages, set severity, run the identical engine. Copper +deltas show change vs baseline.</G>
        <G n="6" t="Track change over time">The sparkline recomputes the chain index for each of the past 21 days with the same decay math. MOVERS 7D lists this week's biggest stage moves. Use search to jump anywhere.</G>
        <G n="7" t="Generate the briefing">⚡ GP Briefing composes the daily briefing from the current state — copy or download. ⓘ Methodology documents every formula; no black boxes.</G>
        </>) : (<>
        {[1,2,3,4,5,6,7].map((n) => <G key={n} n={String(n)} t={t("g"+n+"t")}>{t("g"+n+"b")}</G>)}
        </>)}
        <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 4 }}>
          {LANGV === "en" ? "Demo runs on curated sample data. Descriptive analysis only — not investment advice." : t("gNote")}
        </div>
      </div>
    </div>
  );
}
