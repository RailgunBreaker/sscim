import { C } from '../theme.js';
import { LANGV, t } from '../i18n/index.js';
import { useModalA11y } from './useModalA11y.js';

/* ================= In-app quick guide ================= */
export default function Guide({ onClose }) {
  const { ref, onKeyDown } = useModalA11y(onClose);
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
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={LANGV === "en" ? "How to use SSCIM" : t("guideTitle")} onKeyDown={onKeyDown} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 560, maxHeight: "85vh", overflowY: "auto", padding: "18px 20px", color: C.text, outline: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{LANGV === "en" ? "How to use SSCIM" : t("guideTitle")}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
        <div className="mono" style={{ fontSize: 10, color: C.faint, marginBottom: 12, lineHeight: 1.6 }}>
          {LANGV === "en" ? (<>Three synchronized layers: tap anything in one layer and the other two respond. Colors are structural vulnerability: <span style={{ color: C.green }}>green &lt;5.5 moderate</span> · <span style={{ color: C.amber }}>amber 5.5–7.5 elevated</span> · <span style={{ color: C.red }}>red ≥7.5 high</span>.</>) : t("g0")}
        </div>
        {LANGV === "en" ? (<>
        <G n="1" t="Start with the event feed (Intelligence panel)">Tap any event card. Affected countries light up on the map, affected stages in the flow, and the detail view shows the engine formula, first/second-order effects, and the hop-by-hop company spread tree. Events tagged hazard-signal-only, mixed, or long-term strategic are shown but excluded from the scored operational impact — the card says why.</G>
        <G n="2" t="Explore the flow graph">Tap a stage (e.g. Deposition) to open its subsection: major companies, market shares, and modeled contribution. Node color/size = structural vulnerability; edge width = a modeled input-dependence prior (not a measured value flow); a copper +Δ badge shows the current operational scenario delta separately.</G>
        <G n="3" t="Drill into a company">Three separate numbers, never blended: systemic criticality (simulated disruption originating at that company), vulnerability (share-independent average exposure), and contribution (share-weighted, so market share never cancels out). Plus HQ, customers/suppliers with sales shares, and two-layer upstream origins.</G>
        <G n="4" t="Company rank & capital board">COMPANIES ranks by systemic criticality. CAPITAL ranks shareholders by ownership % × company systemic criticality — state-linked capital in amber.</G>
        <G n="5" t="Run a scenario — or build your own">Header buttons inject preset hypothetical events through the identical propagation engine. ✦ Build scenario: pick stages, set severity, run it. Copper deltas show the scenario's marginal change vs. the untouched baseline — history is never rewritten.</G>
        <G n="6" t="Track change over time">The sparkline recomputes the baseline chain index for each of the past 21 days with the same decay formula. MOVERS 7D lists this week's biggest baseline stage moves. Use search to jump anywhere.</G>
        <G n="7" t="Generate the briefing">⚡ GP Briefing composes a briefing from the current state — ranked by scenario delta when a scenario is active, by baseline operational impact otherwise. Copy or download. ⓘ Methodology documents every formula exactly as implemented — no black boxes.</G>
        </>) : (<>
        {[1,2,3,4,5,6,7].map((n) => <G key={n} n={String(n)} t={t("g"+n+"t")}>{t("g"+n+"b")}</G>)}
        </>)}
        <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 4 }}>
          {LANGV === "en" ? "Research prototype over a frozen curated demonstration snapshot. Sensitivity/comparison tool only — not a calibrated, causal, or probabilistic forecast, and not investment advice." : t("gNote")}
        </div>
      </div>
    </div>
  );
}
