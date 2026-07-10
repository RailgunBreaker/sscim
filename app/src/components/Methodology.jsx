import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useModalA11y } from './useModalA11y.js';
import Tex from './Tex.jsx';

const S = ({ n, t, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div className="mono" style={{ fontSize: 11, color: C.copper, letterSpacing: 1, marginBottom: 4 }}>{n} · {t}</div>
    <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>{children}</div>
  </div>
);
const F = ({ tex, children }) => (
  <div className="mono" style={{ fontSize: 11, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: "6px 10px", margin: "5px 0", lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre-wrap" }}>{tex ? <Tex tex={tex} block /> : children}</div>
);

/* Every displayed number in the Layer 3 · Intelligence Panel, in one
   place — which formula it comes from and what its scale actually is.
   Hovering the number itself (or its tab's caption line) repeats this in
   the app; this table exists so it's also readable without hunting
   through §0–§13 first. */
const READING_ROWS = [
  ["EVENTS tab · “index”", "operationalIndex → toDisplayIndex (§4), for that one event's own propagated field", "0–10, 5 = neutral, >5 net adverse, <5 net mitigating"],
  ["EVENTS tab · “excluded from score”", "the event's declared assumption (§6) marks it hazard-signal / mixed / long-term-strategic", "not a number — see the card's own reason text"],
  ["COMPANIES tab · rank number", "systemic criticality (§9): full-disruption simulation, network-influence-weighted", "0–10"],
  ["MOVERS 7D tab · score", "a stage's baseline operational display index, replayed 7 days ago vs. now (§4)", "0–10, 5 = neutral; Δ is the difference"],
  ["CAPITAL tab · power number", "Capital Power (§10): Σ ownership share × company criticality", "unbounded — ranks owners against each other only, not a 0–10 score"],
  ["Flow graph · node number", "structural vulnerability (§0) — time-invariant, never includes an event/scenario term", "0–10"],
  ["Flow graph · “NI x.x”", "network influence (§1) — node dot/border size", "0–10"],
  ["Detail view · VULNERABILITY / CRITICALITY", "§9 — share-independent average impact / full-disruption simulation", "0–10"],
  ["Detail view · CONTRIBUTION", "§9 — share-weighted modeled effect; market share never cancels out", "unbounded — compare companies to each other, not to a 0–10 scale"],
];
const ReadingTable = () => (
  <div style={{ overflowX: "auto", margin: "6px 0 4px" }}>
    <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
      <thead>
        <tr style={{ textAlign: "left", color: C.copper }}>
          <th style={{ padding: "3px 8px 3px 0", borderBottom: `1px solid ${C.line}` }}>Where you see it</th>
          <th style={{ padding: "3px 8px", borderBottom: `1px solid ${C.line}` }}>What it is</th>
          <th style={{ padding: "3px 0 3px 8px", borderBottom: `1px solid ${C.line}` }}>Scale</th>
        </tr>
      </thead>
      <tbody>
        {READING_ROWS.map(([where, what, scale]) => (
          <tr key={where}>
            <td style={{ padding: "4px 8px 4px 0", color: C.text, verticalAlign: "top", whiteSpace: "nowrap" }}>{where}</td>
            <td style={{ padding: "4px 8px", color: C.dim, verticalAlign: "top" }}>{what}</td>
            <td style={{ padding: "4px 0 4px 8px", color: C.faint, verticalAlign: "top" }}>{scale}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* Every formula below is transcribed directly from app/src/engine/{priors,
   math,graph,index}.js and app/src/engine/event-assumptions.js — this
   overlay exists so nothing is described differently here than what the
   code actually computes. See MODEL_ROADMAP.md for the data-layer work
   this model still needs before any of these numbers could be calibrated. */
export default function Methodology({ onClose }) {
  const { engine } = useVault();
  const { MODEL_PRIORS } = engine;
  const { ref, onKeyDown } = useModalA11y(onClose);
  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="Model methodology" onKeyDown={onKeyDown} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 660, maxHeight: "85vh", overflowY: "auto", padding: "18px 20px", color: C.text, outline: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Model Methodology — {MODEL_PRIORS.modelVersion}</h3>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
        <div className="mono" style={{ fontSize: 10, color: C.amber, background: "#2A1E14", border: `1px solid ${C.copperDim}`, borderRadius: 5, padding: "7px 10px", marginBottom: 12, lineHeight: 1.6 }}>
          RESEARCH PROTOTYPE — a sensitivity/comparison tool over a frozen curated demonstration snapshot (dataset as of {MODEL_PRIORS.datasetAsOf}). Not a calibrated, causal, or probabilistic forecast; not measured trade flow; not investment advice. Every coefficient below is a declared, unvalidated prior — see §10 and MODEL_ROADMAP.md.
        </div>

        <S n="R" t="READING THE NUMBERS (Layer 3 · Intelligence Panel, and everywhere else)">
          Every displayed number is one of exactly two families — <b>structural</b> (§0, time-invariant, 0–10) or <b>operational</b> (§4, event/scenario-driven, 0–10, 5=neutral) — plus two company numbers that are deliberately <b>not</b> on a 0–10 scale at all (contribution, capital power). Hovering any number in the app repeats its own explanation; this table is the same information in one place.
          <ReadingTable />
        </S>

        <S n="0" t="STRUCTURAL VULNERABILITY (per stage — time-invariant)">
          Five components, renormalized to sum to 1 after excluding the event-driven term entirely. Three are graph/data-derived (network influence, geographic concentration, policy exposure); two are declared analyst judgments (substitutability, market sensitivity) — every breakdown bar is source-tagged [GRAPH/DATA] or [ANALYST].
          <F tex={"\\mathrm{struct}_n = w_{\\mathrm{ni}}\\,NI_n + w_{\\mathrm{geo}}\\,GEO_n + w_{\\mathrm{pol}}\\,POL_n + w_{\\mathrm{subst}}\\,\\mathrm{subst}_n + w_{\\mathrm{mkt}}\\,\\mathrm{mkt}_n"} />
          This never includes any event/scenario term — it is deliberately a separate, time-invariant number from the operational impact below (§4), so one score never stands in for both.
        </S>

        <S n="1" t="NETWORK INFLUENCE (Leontief-style sensitivity proxy)">
          For each stage: inject a unit adverse shock at that stage only, propagate it downstream over every reachable path (§3), weight each affected stage by its log-compressed economic weight, sum, then normalize 0–10 against the largest such sum in the graph.
          <F tex={"NI_j = 10\\cdot\\dfrac{\\sum_n EW_n\\cdot\\left|\\mathrm{propagate}_{\\downarrow}(j\\!\\to\\!1)_n\\right|}{\\max_k \\sum_n EW_n\\cdot\\left|\\mathrm{propagate}_{\\downarrow}(k\\!\\to\\!1)_n\\right|},\\qquad EW_n=\\dfrac{\\ln(1+v_n)}{\\max_m \\ln(1+v_m)}"} />
          This replaces raw graph-path-count "chokepoint centrality" (highly sensitive to how the graph happens to be drawn) with a magnitude-weighted propagation measure. It is a modeled sensitivity proxy, not a validated centrality metric or measured economic loss — the "CHOKE" name survives only as a compatibility alias; every visible label reads "Network influence."
        </S>

        <S n="2" t="DIRECTIONAL DEPENDENCE MATRICES (priors, not measured trade flow)">
          Two distinct matrices replace the old single value-weighted edge. For every edge a→b (a=supplier, b=buyer):
          <F tex={"D[b][a] = f_{\\downarrow}\\cdot\\underbrace{\\tfrac{1}{\\mathrm{indeg}(b)}}_{\\text{base input share}}\\cdot\\big(\\phi + (1-\\phi)\\cdot\\mathrm{spec}(a)\\big),\\qquad U[a][b] = \\dfrac{f_{\\uparrow}}{\\mathrm{outdeg}(a)}"} />
          <F tex={`f_{\\downarrow}=${MODEL_PRIORS.downstreamTransmission},\\quad f_{\\uparrow}=${MODEL_PRIORS.upstreamTransmission},\\quad \\phi=${MODEL_PRIORS.specificityFloor}\\ (\\text{specificity floor}),\\quad \\mathrm{spec}(a)=\\mathrm{clamp}(\\mathrm{subst}_a/10,0,1)`} />
          <b>D[b][a]</b> is a downstream <i>input-dependence</i> proxy: how much buyer stage b's output depends on supplier stage a, given b's in-degree (an equal-allocation prior across b's declared inputs) and a's substitutability-derived specificity. <b>U[a][b]</b> is an upstream <i>supplier-revenue-dependence</i> proxy: the demand-side echo felt by supplier a when buyer b is disrupted. Neither is a measured input–output coefficient or bilateral trade value — no facility/BOM/inventory data exists yet to build one (see MODEL_ROADMAP.md).
        </S>

        <S n="3" t="ALL-REACHABLE-PATHS PROPAGATION">
          A shock at any stage propagates downstream (topological order, via D) and/or upstream (reverse-topological order, via U) across <i>every</i> reachable path in the graph — not a fixed two-hop cutoff. At each node, contributions from all its direct predecessors (downstream) or successors (upstream) are combined via the bounded noisy-OR below (§5); propagation along a path stops once a contribution's magnitude falls below the tolerance <Tex tex={`\\tau=${MODEL_PRIORS.contributionTolerance}`} />, not after a fixed number of hops. The stage graph is validated first (no dangling edges, no duplicate edges, no cycles) — an invalid graph surfaces as a diagnostic rather than silently propagating.
        </S>

        <S n="4" t="EVENT MAGNITUDE, DECAY & OPERATIONAL IMPACT">
          <F tex={"s_0 = \\mathrm{sign}\\cdot\\mathrm{clamp}(\\mathrm{sev}/10,0,1)\\cdot\\mathrm{decay}(\\mathrm{age},H),\\qquad \\mathrm{decay}(\\mathrm{age},H)=2^{-\\mathrm{age}/H}"} />
          <F tex={`H=${MODEL_PRIORS.halfLifeDays}\\text{ days (a true half-life: decay}(H,H)=0.5\\text{, not }e^{-\\mathrm{age}/H}\\text{)}`} />
          <b>sign</b> is +1 (adverse) or −1 (mitigating), from the event's declared assumption (§6) — never inferred from severity. <b>age</b> is measured in days before the frozen snapshot date ({MODEL_PRIORS.datasetAsOf}), never the visitor's real-time clock. Confidence (High/Medium/Low/Simulated) is <b>never</b> multiplied into this magnitude — it is reported alongside as evidence-quality metadata only (§6).
          <F tex={"\\mathrm{operationalIndex}(\\mathrm{field}) = \\mathrm{clamp}_{[-1,1]}\\!\\left(\\dfrac{\\sum_n EW_n\\cdot\\mathrm{field}_n}{\\sum_n EW_n}\\right),\\qquad \\mathrm{displayIndex}=5+5\\cdot\\mathrm{operationalIndex}"} />
          Only events whose declared assumption marks them <b>operational: true</b> contribute to this single aggregate score; hazard-signal, mixed-reallocative, and long-term-strategic events are still displayed and individually propagated, but excluded from it (§6). A scenario's chain index is shown as <b>active</b> vs. <b>baseline</b> plus their signed delta — never as a silent overwrite of the historical series, which stays baseline-only. A deterministic <b>sensitivity envelope</b> (low/base/high) re-runs the same computation at ±30% on the transmission coefficients and half-life — bounds on model sensitivity, not a confidence interval.
        </S>

        <S n="5" t="COMBINING SIMULTANEOUS SHOCKS (bounded noisy-OR)">
          <F tex={"\\mathrm{combinePositive}(v_1,\\dots,v_k) = 1-\\prod_i(1-v_i),\\qquad \\mathrm{combinePositive}(0.4,0.5)=0.7"} />
          Signed values combine by separating positive (adverse) and negative (mitigating) magnitudes, combining each set with the formula above, then netting and clamping to [-1,1]. A second simultaneous adverse contribution can only add to, never subtract from, the combined effect, and the combined magnitude never exceeds 1 — replacing the old <code>Math.max</code> merge (which discarded all but the single largest shock) and naive summation (which was unbounded). This is a declared pragmatic aggregation prior, not a formula drawn from the cited literature (§10).
        </S>

        <S n="6" t="EVENT SEMANTICS — explicit, hand-curated, never inferred">
          Every event/scenario id is looked up in a small, versioned table (<code>event-assumptions.js</code>) giving its direction (adverse/mitigating/mixed), propagation channel (downstream/upstream/both), and whether it counts toward the scored operational aggregate at all. This is <b>not</b> inferred at runtime from prose — no LLM, no keyword matching, no sentiment analysis. An id with no recorded assumption defaults to "unclassified": displayed, but excluded from the score rather than guessed. In the current snapshot: export-control and material-licensing events are adverse/operational; a reported capacity increase is mitigating/operational; a hazard-signal event whose own text states no disruption occurred, a reallocative event with simultaneous winners and losers, and a long-term strategic/subsidy signal are all displayed but excluded — collapsing any of those three into one signed magnitude would misrepresent what they describe.
        </S>

        <S n="7" t="GEOGRAPHIC CONCENTRATION (HHI + explicit residual)">
          <F tex={"HHI = \\sum_i \\mathrm{share}_i^2 + \\mathrm{residual}^2,\\qquad \\mathrm{residual}=\\max(0,1-\\textstyle\\sum_i\\mathrm{share}_i)"} />
          <F tex={"\\{a\\!:\\!0.5,\\,b\\!:\\!0.25\\}\\ \\Rightarrow\\ \\mathrm{residual}=0.25\\ \\Rightarrow\\ HHI=0.375\\ \\Rightarrow\\ \\mathrm{score}_{10}=3.75"} />
          When a stage's disclosed country shares sum to less than 1, the shortfall is treated as an unmodeled "Other" and included in the index — omitting it (as the prior version did) understates concentration. Shares that sum to materially more than 1 are normalized for the computation and flagged as a diagnostic rather than silently accepted.
        </S>

        <S n="8" t="POLICY EXPOSURE (unchanged — not a flagged defect)">
          <F tex={"\\mathrm{policy}_n = \\mathrm{clamp}_{10}\\!\\left(\\mathrm{sev}_{\\max} + 0.4\\!\\!\\sum_{\\text{other}}\\mathrm{sev}\\right)"} />
          The highest-severity policy instrument touching a stage counts in full; every additional instrument counts at 40% weight, capped at 10.
        </S>

        <S n="9" t="COMPANY METRICS — three separately-labeled numbers">
          Never blended into one "impact index." A small and a large single-stage company can share the same vulnerability, but never the same contribution or criticality.
          <F tex={"\\mathrm{vulnerability}_c = 10\\cdot\\dfrac{1}{|S_c|}\\sum_{s\\in S_c}\\max(0,\\mathrm{field}_s)"} />
          Share-<b>independent</b>: the average adverse impact across the stages the company occupies, regardless of its relative size there.
          <F tex={"\\mathrm{contribution}_c = \\sum_{s\\in S_c}\\mathrm{share}_{c,s}\\cdot\\max(0,\\mathrm{field}_s)\\cdot EW_s"} />
          Share-<b>weighted</b>: market share does not cancel — a larger stake at the same impact level always yields a larger contribution. If a stage's disclosed company shares sum to more than 1, shares are normalized for this computation and flagged as "within modeled sample."
          <F tex={"\\mathrm{criticality}_c = 10\\cdot\\dfrac{\\sum_n \\max(0,\\mathrm{propagate}_{\\text{both}}(\\mathrm{stakes}_c))_n\\cdot NI_n}{\\sum_n NI_n}"} />
          "If this company were fully disrupted": inject a shock at every stage it occupies (sized to its within-stage share), propagate in both directions, and take the network-influence-weighted mean. Increasing a company's market share can never reduce this number.
        </S>

        <S n="10" t="CAPITAL LAYER (sample ownership data)">
          <F tex={"\\mathrm{CapitalPower}_o = \\sum_c \\mathrm{own}_{o,c}\\cdot \\mathrm{criticality}_c"} />
          Major-shareholder stakes from public filings (13F, annual reports, exchange disclosures), weighted by the company systemic-criticality number above (§9) — state-linked capital is flagged.
        </S>

        <S n="11" t="COUNTRIES & MAP LAYER">
          Country structural/operational scores are share-weighted aggregates of the stage-level numbers above (§0, §4) — production geography, not company headquarters. Company headquarters is shown separately and labeled "HQ:" throughout; it is never substituted for facility-level production exposure. Map links aggregate the sample's supplier-revenue relationships between company <i>headquarters</i> countries — labeled "modeled supplier-revenue relationship weight," never "trade intensity," since it measures neither bilateral trade nor buyer input dependence. Map data © OpenStreetMap contributors.
        </S>

        <S n="12" t="EVIDENCE FRAMEWORK">
          Every parameter and datum carries an evidence tier:
          <F>A · ACADEMIC — production-network shock propagation (Acemoglu et al.; Carvalho et al.; Barrot & Sauvagnat; Inoue & Todo; Baqaee & Farhi), Herfindahl concentration, aggregation-limitation critiques (Diem et al.), risk-exposure indices (Gao/Simchi-Levi/Teo/Yan).{"\n"}B · INSTITUTIONAL REPORTS — SIA/BCG resilience studies, SEMI capacity data, TrendForce/TechInsights/Gartner share estimates.{"\n"}C · OFFICIAL SOURCES — BIS/METI/MOFCOM rule texts, company filings (10-K/20-F/Annual Report, 13F).{"\n"}D · ANALYST JUDGMENT — declared expert inputs (substitutability, market sensitivity) against a written rubric.</F>
          These sources justify the model's <i>architecture and known limitations</i> — none of them are cited as evidence that the specific coefficients in §0–§9 are calibrated. They are not.
        </S>

        <S n="13" t="MODEL STATUS & LIMITATIONS">
          This is a static, curated demonstration snapshot with unvalidated propagation priors — not fit to any observed disruption episode. There is no facility-level, bill-of-materials, inventory-days, capacity/utilization, or time-to-recover data behind any number here. Nothing above is a causal or probabilistic forecast. Scores support comparison and sensitivity ranking within this snapshot only — company and country results are not predicted financial losses. See MODEL_ROADMAP.md for the data-layer work (facility geography, buyer-input vs. supplier-revenue dependence, DRAM/NAND/HBM and merchant/captive-accelerator denominator splits, evidence-tiered market-share estimates, and more) this model would need before any of these numbers could be calibrated.
        </S>
      </div>
    </div>
  );
}
