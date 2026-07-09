import { C } from '../theme.js';
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

export default function Methodology({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 660, maxHeight: "85vh", overflowY: "auto", padding: "18px 20px", color: C.text }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Risk & Impact Algorithm — v4 Methodology</h3>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Close</button>
        </div>
        <S n="0" t="RISK SCORE (per node)">
          <F tex={"\\text{risk}=0.25\\,C_{\\text{choke}}+0.20\\,C_{\\text{geo}}+0.20\\,C_{\\text{policy}}+0.15\\,C_{\\text{subst}}+0.10\\,C_{\\text{shock}}+0.10\\,C_{\\text{mkt}}"} />
          Four components computed, two declared analyst inputs — every breakdown bar is source-tagged.
        </S>
        <S n="1" t="STAGE IMPORTANCE & VALUE-WEIGHTED EDGES">
          <F tex={"\\begin{aligned} I_n &= 10\\left(0.6\\,\\tfrac{C_{\\text{choke}}}{10}+0.4\\,\\tfrac{\\ln v_n}{\\ln v_{\\max}}\\right)\\\\[2pt] w_{a\\to b} &= \\tfrac{v_b}{\\sum_{c\\in\\mathrm{out}(a)} v_c},\\quad f_{\\downarrow}=0.55(0.5+0.5w),\\;\\; f_{\\uparrow}=0.30 \\end{aligned}"} />
        </S>
        <S n="2" t="EVENT SHOCK & CHAIN IMPACT INDEX">
          <F tex={"s_0=\\sigma\\cdot\\kappa_{\\text{conf}}\\cdot e^{-d/12},\\qquad \\mathrm{EII}=\\frac{\\sum_n s_n I_n}{\\sum_n I_n}"} />
        </S>
        <S n="3" t="COMPANY→COMPANY SPREAD (new in v4)">
          The spread tree translates stage-level propagation to the company level. Stages are grouped by hop distance from the event source (hop 0, 1, 2 downstream); within each hop, every company's exposure is its within-stage production share multiplied by the propagated shock at that stage. Companies appear at their earliest hop; the top five per hop are shown.
          <F tex={"e_{c,s}=\\text{share}_{c,s}\\times s_s,\\qquad \\bar e_c=\\frac{\\sum_s \\text{share}_{c,s}\\, s_s}{\\sum_s \\text{share}_{c,s}}"} />
          This is how one event at ASML becomes measurable pressure on TSMC (hop 1), then NVIDIA and SK hynix (hop 2).
        </S>
        <S n="3b" t="CUSTOMER GRAPH (sample revenue shares)">
          A supplier→customer relationship dataset holds each company's customers and the share of the supplier's sales they represent (e.g., ASML → TSMC 35%; SK hynix → NVIDIA 45% of HBM). The customer-graph spread resolves hop-1/hop-2 at named-relationship level: hop-2 path weight = product of the two sales shares along the path. Sales-share percentages describe the supplier's revenue mix, not the customer's input dependence — the engine exposure number captures the latter via stage shares.
        </S>
        <S n="4" t="COMPANY IMPACT INDEX">
          <F tex={"s_0(s)=10\\cdot\\text{share}_{c,s}\\;\\Rightarrow\\;\\mathrm{CII}_c=\\frac{\\sum_n s_n I_n}{\\sum_n I_n}"} />
        </S>
        <S n="5" t="COUNTRY SCORES & MAP LAYER">
          Country components are share-weighted aggregates of stage components (plus direct country-tagged event shock, max-combined); no hand-set values. The map is OpenStreetMap via Leaflet — real geography, dark-filtered tiles, node radius = Σ stage participation. Map data © OpenStreetMap contributors.
        </S>
        <S n="6" t="ONE ENGINE, THREE USES">
          Live events, hypothetical scenarios, and company disruptions run through the same propagation code path.
        </S>
        <S n="7" t="KNOWN LIMITATIONS">
          Shares, stakes and values are illustrative samples; spread shows the top five companies per hop only; edges are value-weighted but not capacity-constrained; propagation factors are priors pending calibration against historical episodes.
        </S>
        <S n="8" t="EVIDENCE FRAMEWORK — how the production system is grounded">
          Every parameter and datum carries an evidence tier, and the model design draws on four source classes:
          <F>A · ACADEMIC — peer-reviewed foundations: production-network shock propagation (network economics, e.g. sectoral-shock literature), Herfindahl concentration from industrial-organization economics, path centrality from network science.{"\n"}B · INSTITUTIONAL REPORTS — SIA/BCG resilience studies, SEMI capacity data, CSET Supply Chain Explorer, TrendForce/TechInsights/Gartner share estimates.{"\n"}C · OFFICIAL SOURCES — BIS/METI/MOFCOM rule texts, NIST & CHIPS Program documents, EU Chips Act, company filings (10-K/20-F, 13F).{"\n"}D · ANALYST JUDGMENT — declared expert inputs (substitutability, market sensitivity) scored against a written rubric.</F>
          Production data points display [tier · citation · date]; a claim supported by A+B+C ranks above any single class. Where classes conflict, the model shows the range rather than picking silently. Weights and propagation factors are treated as D-tier priors until calibrated (Section 7) — the combination of all four classes, checked against observed episodes, is the evaluation standard.
        </S>
        <S n="9" t="CAPITAL LAYER (sample)">
          Major-shareholder stakes come from public filings (13F, annual reports, exchange disclosures). Capital Power Index below; a first-order measure of who holds rights over the chain's most critical capacity, with state-linked capital flagged.<F tex={"\\mathrm{CPI}_o=\\sum_c \\mathrm{own}_{o,c}\\cdot \\mathrm{CII}_c"} /> Roadmap: capex and subsidy flow tracking (CHIPS/EU/METI disbursements, announced fab investments) as directed money-flow edges on the same graph.
        </S>
      </div>
    </div>
  );
}
