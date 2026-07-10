import { useEffect, useRef, useState } from 'react';
import { C } from '../theme.js';
import { LANGV, t } from '../i18n/index.js';
import { onEnterSpace } from '../utils/a11y.js';
import { useModalA11y } from './useModalA11y.js';

/* Step -> what to highlight. Most steps just need a DOM id (a Pane or a
   Header button — see App.jsx/Header.jsx), but "drill into a company"
   and "company rank" describe content that only appears inside the
   Intel panel's own COMPANIES tab (it defaults to "events"), and step 3
   specifically describes a company's detail view — so those two carry a
   richer descriptor (see App.jsx's handleHighlight) that also switches
   Intel's internal tab and selects the #1-ranked company, instead of
   just glowing an outer pane whose visible content doesn't match what
   the step is talking about. Shared across languages since ids/keys
   never change with locale. */
const STEP_TARGET = {
  1: { id: 'pane-intel', feedTab: 'events' },
  2: { id: 'pane-flow' },
  3: { id: 'pane-intel', feedTab: 'companies', selectTopCompany: true },
  4: { id: 'pane-intel', feedTab: 'companies' },
  5: { id: 'header-scenarios' },
  6: { id: 'btn-briefing' },
  7: { id: 'btn-methodology' },
};

const EN_TITLE = {
  1: 'Start with the event feed (Intelligence panel)',
  2: 'Explore the flow graph',
  3: 'Drill into a company',
  4: 'Company rank & capital board',
  5: 'Run a scenario — or build your own',
  6: 'Generate the briefing',
  7: 'Verify anything',
};
const EN_BODY = {
  1: 'Tap any event card. Affected countries light up on the map, affected stages in the flow, and the detail view shows the engine formula, first/second-order effects, and the hop-by-hop company spread tree. Events tagged hazard-signal-only, mixed, or long-term strategic are shown but excluded from the scored operational impact — the card says why.',
  2: 'Tap a stage (e.g. Deposition) to open its subsection: major companies, market shares, and modeled contribution. Node color/size = structural vulnerability; edge width = a modeled input-dependence prior (not a measured value flow); a copper +Δ badge shows the current operational scenario delta separately.',
  3: 'Three separate numbers, never blended: systemic criticality (simulated disruption originating at that company), vulnerability (share-independent average exposure), and contribution (share-weighted, so market share never cancels out). Plus HQ, customers/suppliers with sales shares, and two-layer upstream origins.',
  4: 'COMPANIES ranks by systemic criticality. CAPITAL ranks shareholders by ownership % × company systemic criticality — state-linked capital in amber.',
  5: 'Header buttons inject preset hypothetical events through the identical propagation engine. ✦ Build scenario: pick stages, set severity, run it. Copper deltas show the scenario\'s marginal change vs. the untouched baseline — history is never rewritten.',
  6: '⚡ GP Briefing composes a briefing from the current state — ranked by scenario delta when a scenario is active, by baseline operational impact otherwise. Copy or download.',
  7: 'ⓘ Methodology documents every formula exactly as implemented, every propagation prior, and the full model-status statement — no black boxes.',
};

/* ================= In-app quick guide =================
   Doubles as an interactive tutorial: clicking a step highlights the
   exact dashboard region it describes (a pulsing outline via the
   .tour-target class — see App.jsx GLOBAL_STYLE) and switches to a small
   floating step card so the highlighted area stays visible and clickable
   underneath, instead of being hidden behind a full-screen modal. */
export default function Guide({ onClose, onHighlight }) {
  const [activeStep, setActiveStepRaw] = useState(null);
  const { ref, onKeyDown } = useModalA11y(onClose);
  const cardRef = useRef(null);

  useEffect(() => {
    if (activeStep) cardRef.current?.focus();
  }, [activeStep === null]);

  const goToStep = (n) => {
    setActiveStepRaw(n);
    onHighlight?.(n ? STEP_TARGET[n] : null);
  };
  const exitTour = () => goToStep(null);

  const stepTitle = (n) => (LANGV === 'en' ? EN_TITLE[n] : t('g' + n + 't'));
  const stepBody = (n) => (LANGV === 'en' ? EN_BODY[n] : t('g' + n + 'b'));

  const G = ({ n, t: title, children }) => (
    <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
      <span className="mono" style={{ color: "#0C111C", background: C.copper, borderRadius: 4, width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.55 }}>{children}</div>
      </div>
    </div>
  );

  if (activeStep) {
    const n = activeStep;
    const navBtn = (disabled) => ({
      background: "transparent", border: `1px solid ${disabled ? C.line : C.copperDim}`, color: disabled ? C.faint : C.copper,
      borderRadius: 4, padding: "4px 10px", fontSize: 11, cursor: disabled ? "default" : "pointer", fontFamily: "inherit",
    });
    return (
      <div ref={cardRef} tabIndex={-1} role="dialog" aria-label={`${stepTitle(n)} (step ${n} of 7)`}
        onKeyDown={(e) => e.key === 'Escape' && exitTour()}
        style={{ position: "fixed", bottom: 20, right: 20, left: "auto", zIndex: 1200, maxWidth: 320, width: "calc(100vw - 40px)", background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, padding: "14px 16px", boxShadow: "0 10px 34px rgba(0,0,0,.55)", color: C.text, outline: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span className="mono" style={{ fontSize: 9, letterSpacing: 1.3, color: C.copper }}>STEP {n} OF 7 · LOOK FOR THE GLOW</span>
          <button onClick={onClose} aria-label="Close guide" style={{ background: "transparent", border: "none", color: C.faint, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{stepTitle(n)}</div>
        <div style={{ fontSize: 11.5, color: C.dim, lineHeight: 1.55, marginBottom: 10 }}>{stepBody(n)}</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
          <button disabled={n <= 1} onClick={() => goToStep(n - 1)} style={navBtn(n <= 1)}>← Prev</button>
          <button onClick={exitTour} style={{ ...navBtn(false), color: C.dim, borderColor: C.line }}>Full guide</button>
          <button disabled={n >= 7} onClick={() => goToStep(n + 1)} style={navBtn(n >= 7)}>Next →</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={LANGV === "en" ? "How to use SSCIM" : t("guideTitle")} onKeyDown={onKeyDown} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 560, maxHeight: "85vh", overflowY: "auto", padding: "18px 20px", color: C.text, outline: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{LANGV === "en" ? "How to use SSCIM" : t("guideTitle")}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
        <div className="mono" style={{ fontSize: 10, color: C.faint, marginBottom: 12, lineHeight: 1.6 }}>
          {LANGV === "en" ? (<>Three synchronized layers: tap anything in one layer and the other two respond. Colors are structural vulnerability: <span style={{ color: C.green }}>green &lt;5.5 moderate</span> · <span style={{ color: C.amber }}>amber 5.5–7.5 elevated</span> · <span style={{ color: C.red }}>red ≥7.5 high</span>. <span style={{ color: C.copper }}>Click any step below to highlight the exact part of the dashboard it describes.</span></>) : t("g0")}
        </div>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <div key={n} role="button" tabIndex={0} onClick={() => goToStep(n)} onKeyDown={onEnterSpace(() => goToStep(n))}
            className="evcard" style={{ borderRadius: 6, padding: "6px 8px", margin: "0 -8px 4px", border: "1px solid transparent" }}>
            <G n={String(n)} t={stepTitle(n)}>{stepBody(n)}</G>
            <div className="mono" style={{ fontSize: 9, color: C.copper, marginLeft: 30, marginTop: -6 }}>▸ tap to highlight on the dashboard</div>
          </div>
        ))}
        <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 4 }}>
          {LANGV === "en" ? "Research prototype over a frozen curated demonstration snapshot. Sensitivity/comparison tool only — not a calibrated, causal, or probabilistic forecast, and not investment advice." : t("gNote")}
        </div>
      </div>
    </div>
  );
}
