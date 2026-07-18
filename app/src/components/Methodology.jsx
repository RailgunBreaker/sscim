import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useModalA11y } from './useModalA11y.js';
import { LANGV } from '../i18n/index.js';
import { METHODOLOGY_I18N } from '../i18n/methodology.js';
import Tex from './Tex.jsx';

/* Translated title + summary for the current language (zh/tw/ja) render
   above each section's canonical English detail — formulas, symbols, and
   parameter tables stay in English as the shared notation (see the `note`
   line in methodology.js, shown in the overlay header when translated). */
const S = ({ n, t, k, children }) => {
  const tr = METHODOLOGY_I18N[LANGV]?.[k];
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="mono" style={{ fontSize: 11, color: C.copper, letterSpacing: 1, marginBottom: 4 }}>{n} · {t}{tr && <span style={{ color: C.text }}> · {tr.t}</span>}</div>
      {tr && <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.7, marginBottom: 5 }}>{tr.b}</div>}
      <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
};
const F = ({ tex, children }) => (
  <div className="mono" style={{ fontSize: 11, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: "6px 10px", margin: "5px 0", lineHeight: 1.6, overflowX: "auto", whiteSpace: "pre-wrap" }}>{tex ? <Tex tex={tex} block /> : children}</div>
);

/* Parameter legend rendered under each formula: every symbol, what it means,
   its value/range in this snapshot, and HOW THE NUMBER IS FOUND — measured
   from the vault graph, taken from a sourced table in the database, or a
   declared prior. Source cells reuse the §12 evidence tiers [A/B/C/D];
   [GRAPH] = computed from the vault's stage graph itself. */
const P = ({ rows }) => (
  <div style={{ overflowX: "auto", margin: "4px 0 6px" }}>
    <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
      <thead>
        <tr style={{ textAlign: "left", color: C.faint }}>
          <th style={{ padding: "2px 8px 2px 0", borderBottom: `1px solid ${C.line}`, fontWeight: 400, letterSpacing: 1 }}>TERM</th>
          <th style={{ padding: "2px 8px", borderBottom: `1px solid ${C.line}`, fontWeight: 400, letterSpacing: 1 }}>MEANING</th>
          <th style={{ padding: "2px 8px", borderBottom: `1px solid ${C.line}`, fontWeight: 400, letterSpacing: 1 }}>VALUE / RANGE</th>
          <th style={{ padding: "2px 0 2px 8px", borderBottom: `1px solid ${C.line}`, fontWeight: 400, letterSpacing: 1 }}>HOW IT'S FOUND</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([sym, meaning, value, source], i) => (
          <tr key={i}>
            <td style={{ padding: "3px 8px 3px 0", color: C.text, verticalAlign: "top", whiteSpace: "nowrap" }}>{typeof sym === 'string' ? <Tex tex={sym} /> : sym}</td>
            <td style={{ padding: "3px 8px", color: C.dim, verticalAlign: "top" }}>{meaning}</td>
            <td style={{ padding: "3px 8px", color: C.text, verticalAlign: "top", whiteSpace: "nowrap" }}>{value}</td>
            <td style={{ padding: "3px 0 3px 8px", color: C.faint, verticalAlign: "top" }}>{source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
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
          {METHODOLOGY_I18N[LANGV] && (
            <div style={{ marginTop: 5, color: C.text }}>
              {METHODOLOGY_I18N[LANGV].disc}
              <div style={{ color: C.dim, marginTop: 3 }}>{METHODOLOGY_I18N[LANGV].note}</div>
            </div>
          )}
        </div>

        <S n="R" k="R" t="READING THE NUMBERS (Layer 3 · Intelligence Panel, and everywhere else)">
          Every displayed number is one of exactly two families — <b>structural</b> (§0, time-invariant, 0–10) or <b>operational</b> (§4, event/scenario-driven, 0–10, 5=neutral) — plus two company numbers that are deliberately <b>not</b> on a 0–10 scale at all (contribution, capital power). Hovering any number in the app repeats its own explanation; this table is the same information in one place.
          <ReadingTable />
        </S>

        <S n="0" k="s0" t="STRUCTURAL VULNERABILITY (per stage — time-invariant)">
          Five components, renormalized to sum to 1 after excluding the event-driven term entirely. Three are graph/data-derived (network influence, geographic concentration, policy exposure); two are declared analyst judgments (substitutability, market sensitivity) — every breakdown bar is source-tagged [GRAPH/DATA] or [ANALYST].
          <F tex={"\\mathrm{struct}_n = w_{\\mathrm{ni}}\\,NI_n + w_{\\mathrm{geo}}\\,GEO_n + w_{\\mathrm{pol}}\\,POL_n + w_{\\mathrm{subst}}\\,\\mathrm{subst}_n + w_{\\mathrm{mkt}}\\,\\mathrm{mkt}_n"} />
          <P rows={[
            ["n", "a stage (one of the 24 supply-chain stages in the vault's stages table)", "24 nodes", "curated stage decomposition of the semiconductor chain [B: SIA/BCG, SEMI]"],
            ["w_{\\mathrm{ni}},w_{\\mathrm{geo}},w_{\\mathrm{pol}},w_{\\mathrm{subst}},w_{\\mathrm{mkt}}", <>component weights (<code>MODEL_PRIORS.componentWeights</code>), renormalized to sum to 1</>, `${MODEL_PRIORS.componentWeights.choke}/${MODEL_PRIORS.componentWeights.geo}/${MODEL_PRIORS.componentWeights.policy}/${MODEL_PRIORS.componentWeights.subst}/${MODEL_PRIORS.componentWeights.market}`, "declared prior [D] — no fitting; sensitivity-checked, not calibrated"],
            ["NI_n", "network influence (§1)", "0–10", "[GRAPH] computed by propagation over the stage graph"],
            ["GEO_n", "geographic concentration (§7), HHI of the stage's country production shares", "0–10", "shares from stages.shares_json — market/capacity estimates [B: TrendForce, SEMI, company disclosures]; provenance per stage in data_notes"],
            ["POL_n", "policy exposure (§8) from the policy-instrument table", "0–10", "policies table — curated from official rule texts [C: BIS/METI/MOFCOM]"],
            ["\\mathrm{subst}_n", "substitutability: how replaceable this stage's output is (10 = hardest to substitute)", "0–10 per stage", "declared analyst judgment [D], written rubric — stages.subst column"],
            ["\\mathrm{mkt}_n", "market sensitivity: demand-side cyclicality/exposure", "0–10 per stage", "declared analyst judgment [D] — stages.market column"],
          ]} />
          This never includes any event/scenario term — it is deliberately a separate, time-invariant number from the operational impact below (§4), so one score never stands in for both.
        </S>

        <S n="1" k="s1" t="NETWORK INFLUENCE (Leontief-style sensitivity proxy)">
          For each stage: inject a unit adverse shock at that stage only, propagate it downstream over every reachable path (§3), weight each affected stage by its log-compressed economic weight, sum, then normalize 0–10 against the largest such sum in the graph.
          <F tex={"NI_j = 10\\cdot\\dfrac{\\sum_n EW_n\\cdot\\left|\\mathrm{propagate}_{\\downarrow}(j\\!\\to\\!1)_n\\right|}{\\max_k \\sum_n EW_n\\cdot\\left|\\mathrm{propagate}_{\\downarrow}(k\\!\\to\\!1)_n\\right|},\\qquad EW_n=\\dfrac{\\ln(1+v_n)}{\\max_m \\ln(1+v_m)}"} />
          <P rows={[
            ["j,k,n,m", "stage indices: j = the stage being scored, n = each stage its shock reaches, k/m range over all 24 stages for normalization", "24 stages", "[GRAPH]"],
            ["\\mathrm{propagate}_{\\downarrow}(j\\!\\to\\!1)_n", "the field at stage n after injecting a unit (magnitude-1) adverse shock at j and propagating downstream over all reachable paths (§3)", "0–1 per node", "[GRAPH] computed — D matrix (§2) + noisy-OR (§5)"],
            ["v_n", "the stage's annual economic value (US$B), stages.value column", "per stage", "segment-size estimates [B: SIA/WSTS, SEMI, Gartner-tier reports]; provenance in data_notes"],
            ["EW_n", "log-compressed economic weight — ln(1+v) tempers the largest segments so they inform, not dominate", "0–1 (max stage = 1)", "derived from v_n; the log form is a declared modeling choice [D]"],
            ["10\\cdot(\\cdot)/\\max_k(\\cdot)", "normalization against the largest observed sum in this snapshot", "0–10", "derived — 10 means “most influential stage here,” not an absolute ceiling"],
          ]} />
          This replaces raw graph-path-count "chokepoint centrality" (highly sensitive to how the graph happens to be drawn) with a magnitude-weighted propagation measure. It is a modeled sensitivity proxy, not a validated centrality metric or measured economic loss — the "CHOKE" name survives only as a compatibility alias; every visible label reads "Network influence."
        </S>

        <S n="2" k="s2" t="DIRECTIONAL DEPENDENCE MATRICES (priors, not measured trade flow)">
          Two distinct matrices replace the old single value-weighted edge. For every edge a→b (a=supplier, b=buyer):
          <F tex={"D[b][a] = f_{\\downarrow}\\cdot\\underbrace{\\tfrac{1}{\\mathrm{indeg}(b)}}_{\\text{base input share}}\\cdot\\big(\\phi + (1-\\phi)\\cdot\\mathrm{spec}(a)\\big),\\qquad U[a][b] = \\dfrac{f_{\\uparrow}}{\\mathrm{outdeg}(a)}"} />
          <F tex={`f_{\\downarrow}=${MODEL_PRIORS.downstreamTransmission},\\quad f_{\\uparrow}=${MODEL_PRIORS.upstreamTransmission},\\quad \\phi=${MODEL_PRIORS.specificityFloor}\\ (\\text{specificity floor}),\\quad \\mathrm{spec}(a)=\\mathrm{clamp}(\\mathrm{subst}_a/10,0,1)`} />
          <P rows={[
            ["a\\to b", "a directed edge in the stage graph: a supplies b (flow_edges table, e.g. litho → adv_fab)", "34 edges", "curated process-flow topology — which stage feeds which [B: industry process references]; validated acyclic (§3)"],
            ["f_{\\downarrow}", "downstream transmission: fraction of a supplier disruption passed to a buyer per edge", String(MODEL_PRIORS.downstreamTransmission), "declared prior [D] — unvalidated; the ±30% sensitivity envelope (§4) exists because of it"],
            ["f_{\\uparrow}", "upstream transmission: demand-echo fraction passed back from a disrupted buyer to its supplier", String(MODEL_PRIORS.upstreamTransmission), "declared prior [D] — set below f↓: losing a customer hurts less, per-edge, than losing an input"],
            ["\\mathrm{indeg}(b),\\ \\mathrm{outdeg}(a)", "b's number of declared input stages / a's number of declared buyer stages", "per node", "[GRAPH] counted from flow_edges — an equal-allocation prior in lieu of real input-share (BOM) data"],
            ["\\phi", "specificity floor: even a fully substitutable input transmits this residual fraction", String(MODEL_PRIORS.specificityFloor), "declared prior [D]"],
            ["\\mathrm{spec}(a)", "supplier a's input specificity, its substitutability rescaled to 0–1", "0–1", "derived from stages.subst — analyst judgment [D] (§0)"],
          ]} />
          <b>D[b][a]</b> is a downstream <i>input-dependence</i> proxy: how much buyer stage b's output depends on supplier stage a, given b's in-degree (an equal-allocation prior across b's declared inputs) and a's substitutability-derived specificity. <b>U[a][b]</b> is an upstream <i>supplier-revenue-dependence</i> proxy: the demand-side echo felt by supplier a when buyer b is disrupted. Neither is a measured input–output coefficient or bilateral trade value — no facility/BOM/inventory data exists yet to build one (see MODEL_ROADMAP.md).
        </S>

        <S n="3" k="s3" t="ALL-REACHABLE-PATHS PROPAGATION">
          A shock at any stage propagates downstream (topological order, via D) and/or upstream (reverse-topological order, via U) across <i>every</i> reachable path in the graph — not a fixed two-hop cutoff. At each node, contributions from all its direct predecessors (downstream) or successors (upstream) are combined via the bounded noisy-OR below (§5); propagation along a path stops once a contribution's magnitude falls below the tolerance <Tex tex={`\\tau=${MODEL_PRIORS.contributionTolerance}`} />, not after a fixed number of hops. The stage graph is validated first (no dangling edges, no duplicate edges, no cycles) — an invalid graph surfaces as a diagnostic rather than silently propagating.
        </S>

        <S n="4" k="s4" t="EVENT MAGNITUDE, DECAY & OPERATIONAL IMPACT">
          <F tex={"s_0 = \\mathrm{sign}\\cdot\\mathrm{clamp}(\\mathrm{sev}/10,0,1)\\cdot\\mathrm{decay}(\\mathrm{age},H),\\qquad \\mathrm{decay}(\\mathrm{age},H)=2^{-\\mathrm{age}/H}"} />
          <F tex={`H=${MODEL_PRIORS.halfLifeDays}\\text{ days (a true half-life: decay}(H,H)=0.5\\text{, not }e^{-\\mathrm{age}/H}\\text{)}`} />
          <P rows={[
            ["\\mathrm{sev}", "the event's severity, 1–10, set once when the event is curated — a magnitude judgment about realized scale (capacity share affected, duration, breadth), not market reaction", "1–10 per event", "hand-curated per event against its cited sources (events.source: official rule texts [C], filings [C], institutional/trade coverage [B]) — see the event card"],
            ["\\mathrm{sign}", "+1 adverse / −1 mitigating", "±1", "declared per-id in event-assumptions.js [D] — a person read the event text once; never inferred at runtime"],
            ["\\mathrm{age}", "days between the event's date and the frozen snapshot date — for the 2021–2026 backfill, derived from the event's authoritative dateISO, never hand-set", `vs ${MODEL_PRIORS.datasetAsOf}`, "events.days_ago, computed at seed/backfill time (server/src/history-events.js)"],
            ["H", "half-life of an event shock", `${MODEL_PRIORS.halfLifeDays} days`, "declared prior [D] — swept ±30% by the sensitivity envelope"],
            ["s_0", "the event's signed origin magnitude injected at each of its tagged stages (events.stages_json)", "[−1, 1]", "derived; stage tags are hand-curated per event from its sources"],
          ]} />
          <b>sign</b> is +1 (adverse) or −1 (mitigating), from the event's declared assumption (§6) — never inferred from severity. <b>age</b> is measured in days before the frozen snapshot date ({MODEL_PRIORS.datasetAsOf}), never the visitor's real-time clock. Confidence (High/Medium/Low/Simulated) is <b>never</b> multiplied into this magnitude — it is reported alongside as evidence-quality metadata only (§6).
          <F tex={"\\mathrm{operationalIndex}(\\mathrm{field}) = \\mathrm{clamp}_{[-1,1]}\\!\\left(\\dfrac{\\sum_n EW_n\\cdot\\mathrm{field}_n}{\\sum_n EW_n}\\right),\\qquad \\mathrm{displayIndex}=5+5\\cdot\\mathrm{operationalIndex}"} />
          <P rows={[
            ["\\mathrm{field}_n", "the signed combined shock at stage n after every operational event's s₀ is propagated (§3) and merged (§5)", "[−1, 1] per stage", "[GRAPH] computed"],
            ["EW_n", "log-compressed economic weight (§1) — bigger stages move the chain index more", "0–1", "derived from stages.value [B]"],
            ["\\mathrm{displayIndex}", "the chain index shown in the header, sparkline, and 2021→present history chart", "0–10, 5 = neutral", "derived — >5 net adverse, <5 net mitigating"],
          ]} />
          Only events whose declared assumption marks them <b>operational: true</b> contribute to this single aggregate score; hazard-signal, mixed-reallocative, and long-term-strategic events are still displayed and individually propagated, but excluded from it (§6). A scenario's chain index is shown as <b>active</b> vs. <b>baseline</b> plus their signed delta — never as a silent overwrite of the historical series, which stays baseline-only. A deterministic <b>sensitivity envelope</b> (low/base/high) re-runs the same computation at ±30% on the transmission coefficients and half-life — bounds on model sensitivity, not a confidence interval.
        </S>

        <S n="5" k="s5" t="COMBINING SIMULTANEOUS SHOCKS (bounded noisy-OR)">
          <F tex={"\\mathrm{combinePositive}(v_1,\\dots,v_k) = 1-\\prod_i(1-v_i),\\qquad \\mathrm{combinePositive}(0.4,0.5)=0.7"} />
          <P rows={[
            ["v_1,\\dots,v_k", "the k same-sign shock magnitudes arriving at one stage simultaneously (from different events, or different paths of one event)", "each 0–1", "[GRAPH] outputs of §3 propagation"],
            ["1-\\prod_i(1-v_i)", "noisy-OR: treat each contribution as an independent “chance of loss” and combine the survivals", "0–1, monotone, bounded", "declared aggregation prior [D] — not from the cited literature (§12)"],
          ]} />
          Signed values combine by separating positive (adverse) and negative (mitigating) magnitudes, combining each set with the formula above, then netting and clamping to [-1,1]. A second simultaneous adverse contribution can only add to, never subtract from, the combined effect, and the combined magnitude never exceeds 1 — replacing the old <code>Math.max</code> merge (which discarded all but the single largest shock) and naive summation (which was unbounded). This is a declared pragmatic aggregation prior, not a formula drawn from the cited literature (§10).
        </S>

        <S n="6" k="s6" t="EVENT SEMANTICS — explicit, hand-curated, never inferred">
          Every event/scenario id is looked up in a small, versioned table (<code>event-assumptions.js</code>) giving its direction (adverse/mitigating/mixed), propagation channel (downstream/upstream/both), and whether it counts toward the scored operational aggregate at all. This is <b>not</b> inferred at runtime from prose — no LLM, no keyword matching, no sentiment analysis. An id with no recorded assumption defaults to "unclassified": displayed, but excluded from the score rather than guessed. In the current snapshot: export-control and material-licensing events are adverse/operational; a reported capacity increase is mitigating/operational; a hazard-signal event whose own text states no disruption occurred, a reallocative event with simultaneous winners and losers, and a long-term strategic/subsidy signal are all displayed but excluded — collapsing any of those three into one signed magnitude would misrepresent what they describe.
        </S>

        <S n="7" k="s7" t="GEOGRAPHIC CONCENTRATION (HHI + explicit residual)">
          <F tex={"HHI = \\sum_i \\mathrm{share}_i^2 + \\mathrm{residual}^2,\\qquad \\mathrm{residual}=\\max(0,1-\\textstyle\\sum_i\\mathrm{share}_i)"} />
          <F tex={"\\{a\\!:\\!0.5,\\,b\\!:\\!0.25\\}\\ \\Rightarrow\\ \\mathrm{residual}=0.25\\ \\Rightarrow\\ HHI=0.375\\ \\Rightarrow\\ \\mathrm{score}_{10}=3.75"} />
          <P rows={[
            ["\\mathrm{share}_i", "country i's share of this stage's production/capacity (stages.shares_json)", "0–1 per country", "market/capacity estimates [B: TrendForce, SEMI, company capacity disclosures]; per-stage provenance in data_notes; disclosed shares often sum <1 by design"],
            ["\\mathrm{residual}", "the undisclosed remainder, treated as one unmodeled “Other” country", "0–1", "derived — 1 minus the disclosed sum, never dropped"],
            ["HHI", "Herfindahl–Hirschman concentration; ×10 gives the 0–10 GEO score of §0", "0–1 → 0–10", "standard concentration index [A]"],
          ]} />
          When a stage's disclosed country shares sum to less than 1, the shortfall is treated as an unmodeled "Other" and included in the index — omitting it (as the prior version did) understates concentration. Shares that sum to materially more than 1 are normalized for the computation and flagged as a diagnostic rather than silently accepted.
        </S>

        <S n="8" k="s8" t="POLICY EXPOSURE (unchanged — not a flagged defect)">
          <F tex={"\\mathrm{policy}_n = \\mathrm{clamp}_{10}\\!\\left(\\mathrm{sev}_{\\max} + 0.4\\!\\!\\sum_{\\text{other}}\\mathrm{sev}\\right)"} />
          <P rows={[
            ["\\mathrm{sev}", "a policy instrument's severity, 1–10, and the stages it touches (policies table: 7 instruments — export-control regimes, subsidy acts, licensing regimes)", "1–10 per instrument", "curated from official rule texts [C: BIS/METI/MOFCOM/EU]; severity itself is analyst judgment [D]"],
            ["\\mathrm{sev}_{\\max}", "the single most severe instrument touching stage n", "1–10", "derived"],
            ["0.4", "diminishing weight on each additional instrument beyond the first", "0.4", "declared prior [D]"],
          ]} />
          The highest-severity policy instrument touching a stage counts in full; every additional instrument counts at 40% weight, capped at 10.
        </S>

        <S n="9" k="s9" t="COMPANY METRICS — three separately-labeled numbers">
          Never blended into one "impact index." A small and a large single-stage company can share the same vulnerability, but never the same contribution or criticality.
          <F tex={"\\mathrm{vulnerability}_c = 10\\cdot\\dfrac{1}{|S_c|}\\sum_{s\\in S_c}\\max(0,\\mathrm{field}_s)"} />
          Share-<b>independent</b>: the average adverse impact across the stages the company occupies, regardless of its relative size there.
          <F tex={"\\mathrm{contribution}_c = \\sum_{s\\in S_c}\\mathrm{share}_{c,s}\\cdot\\max(0,\\mathrm{field}_s)\\cdot EW_s"} />
          Share-<b>weighted</b>: market share does not cancel — a larger stake at the same impact level always yields a larger contribution. If a stage's disclosed company shares sum to more than 1, shares are normalized for this computation and flagged as "within modeled sample."
          <F tex={"\\mathrm{raw}_c = \\dfrac{\\sum_n \\max(0,\\mathrm{propagate}_{\\text{both}}(\\mathrm{stakes}_c))_n\\cdot NI_n}{\\sum_n NI_n},\\qquad \\mathrm{criticality}_c = 10\\cdot\\dfrac{\\mathrm{raw}_c}{\\max_k \\mathrm{raw}_k}"} />
          <P rows={[
            ["c", "a company (109 in the vault's companies table)", "109", "curated sample of the chain's principal firms [B]"],
            ["S_c,\\ \\mathrm{stakes}_c,\\ \\mathrm{share}_{c,s}", "the stages company c produces in, and its within-stage market share (companies.stakes_json)", "0–1 per stage", "market-share estimates [B: TrendForce, TechInsights, Gartner-tier, company filings]; per-company provenance in data_notes; “within modeled sample” when a stage's disclosed shares exceed 1"],
            ["\\mathrm{field}_s", "the active operational field at stage s (§4) — vulnerability/contribution read the CURRENT field; criticality instead injects its own full-disruption shock", "[−1,1]", "[GRAPH] computed"],
            ["EW_s,\\ NI_n", "economic weight (§1) / network influence (§1) as weights", "0–1 / 0–10", "derived as above"],
            ["\\mathrm{propagate}_{\\text{both}}", "shock injected at every stage in S_c, sized to c's share there, propagated downstream AND upstream", "[GRAPH]", "computed — the “what if this company vanished” simulation"],
          ]} />
          "If this company were fully disrupted": inject a shock at every stage it occupies (sized to its within-stage share), propagate in both directions, and take the network-influence-weighted mean — then normalize against the largest raw value actually achieved across every company in the snapshot, the same max-observed approach network influence uses (§1), rather than the theoretical, practically-unreachable ceiling of every stage saturating at once (which squashed every company's score into a sliver near 0, indistinguishable from each other). Increasing a company's market share can never reduce this number, and the single most critical company in the current snapshot scores at (or near) 10.
        </S>

        <S n="10" k="s10" t="CAPITAL LAYER (sample ownership data)">
          <F tex={"\\mathrm{CapitalPower}_o = \\sum_c \\mathrm{own}_{o,c}\\cdot \\mathrm{criticality}_c"} />
          <P rows={[
            ["o", "an owner (asset manager, state fund, founding family, …) appearing in the owners table", "75 stake rows", "public filings [C: 13F, annual reports, exchange disclosures]"],
            ["\\mathrm{own}_{o,c}", "o's disclosed ownership share of company c", "0–1", "same filings [C] — major holders only, not a complete register"],
            ["\\mathrm{criticality}_c", "company systemic criticality (§9)", "0–10", "[GRAPH] computed"],
          ]} />
          Major-shareholder stakes from public filings (13F, annual reports, exchange disclosures), weighted by the company systemic-criticality number above (§9) — state-linked capital is flagged.
        </S>

        <S n="11" k="s11" t="COUNTRIES & MAP LAYER">
          Country structural/operational scores are share-weighted aggregates of the stage-level numbers above (§0, §4) — production geography, not company headquarters. Company headquarters is shown separately and labeled "HQ:" throughout; it is never substituted for facility-level production exposure. Map links aggregate the sample's supplier-revenue relationships between company <i>headquarters</i> countries — labeled "modeled supplier-revenue relationship weight," never "trade intensity," since it measures neither bilateral trade nor buyer input dependence. Map data © OpenStreetMap contributors.
        </S>

        <S n="12" k="s12" t="EVIDENCE FRAMEWORK">
          Every parameter and datum carries an evidence tier:
          <F>A · ACADEMIC — production-network shock propagation (Acemoglu et al.; Carvalho et al.; Barrot & Sauvagnat; Inoue & Todo; Baqaee & Farhi), Herfindahl concentration, aggregation-limitation critiques (Diem et al.), risk-exposure indices (Gao/Simchi-Levi/Teo/Yan).{"\n"}B · INSTITUTIONAL REPORTS — SIA/BCG resilience studies, SEMI capacity data, TrendForce/TechInsights/Gartner share estimates.{"\n"}C · OFFICIAL SOURCES — BIS/METI/MOFCOM rule texts, company filings (10-K/20-F/Annual Report, 13F).{"\n"}D · ANALYST JUDGMENT — declared expert inputs (substitutability, market sensitivity) against a written rubric.</F>
          These sources justify the model's <i>architecture and known limitations</i> — none of them are cited as evidence that the specific coefficients in §0–§9 are calibrated. They are not.
        </S>

        <S n="D" k="sD" t="WHERE THE DATA COMES FROM (and how to change it)">
          Every number above is computed from the committed SQLite vault (<code>server/data/sscim.db</code>) — the single source of truth this site's bundled snapshot is exported from at build time. Each table, what it holds, and how its values were found:
          <P rows={[
            [<code>stages</code>, "24 stages: economic value ($B), substitutability, market sensitivity, per-country production shares", "24 rows", "value/shares: institutional estimates [B: SIA/WSTS, SEMI, TrendForce]; subst/market: analyst rubric [D]"],
            [<code>flow_edges</code>, "which stage supplies which — the propagation graph", "34 edges", "curated from published process-flow descriptions [B]; validated acyclic at load"],
            [<code>companies</code>, "109 companies with within-stage market shares (stakes)", "109 rows", "share estimates [B: TrendForce, TechInsights, Gartner-tier, filings]"],
            [<code>customers</code>, "supplier→customer revenue-share relationships", "243 rows", "company filings & disclosed customer concentration [C], supplemented by trade-press estimates [B] — top customers only, sums <100% by design"],
            [<code>owners</code>, "major-shareholder stakes", "75 rows", "public filings [C: 13F, annual reports, exchange disclosures]"],
            [<code>policies</code>, "policy instruments with severity and touched stages", "7 rows", "official rule texts [C: BIS, METI, MOFCOM, EU]; severity is analyst judgment [D]"],
            [<code>events</code>, "6 current-window sample events + 36 real 2021–2026 historical events (sev, stages, countries, sources, timeline)", "42 rows", "historical set: real, dated, per-event source citations [B/C] (server/src/history-events.js); current-window set: illustrative sample"],
            [<code>data_notes</code>, "the per-datum citation trail behind headline figures", "grows over time", "each note names its scope (company:tsmc, stage:litho), evidence tier, and source"],
            [<code>quotes</code>, "market price, day change, trailing/forward P/E per listed company", "92 rows", "Yahoo Finance batch quotes via a curated ticker map (server/src/tickers.js), refreshed each build + daily — display metadata ONLY, never a model input"],
          ]} />
          Updating any of it never touches application code: edit the vault (admin API or SQL), re-export the snapshot, commit the database — README §6.6 documents the exact workflow, and every derived number in §0–§10 recomputes from whatever the vault holds.
        </S>

        <S n="13" k="s13" t="MODEL STATUS & LIMITATIONS">
          This is a static, curated demonstration snapshot with unvalidated propagation priors — not fit to any observed disruption episode. There is no facility-level, bill-of-materials, inventory-days, capacity/utilization, or time-to-recover data behind any number here. Nothing above is a causal or probabilistic forecast. Scores support comparison and sensitivity ranking within this snapshot only — company and country results are not predicted financial losses. See MODEL_ROADMAP.md for the data-layer work (facility geography, buyer-input vs. supplier-revenue dependence, DRAM/NAND/HBM and merchant/captive-accelerator denominator splits, evidence-tiered market-share estimates, and more) this model would need before any of these numbers could be calibrated.
        </S>
      </div>
    </div>
  );
}
