import { useState } from 'react';
import { T, LANG_LABELS } from './i18n.js';
import Tex from '../components/Tex.jsx';

const STYLE = `
  :root{--bg:#0C111C;--panel:#141B2B;--panel2:#0F1626;--line:#243149;--copper:#C98A3F;--copperDim:#8A6230;--red:#E25C4A;--amber:#DFA83D;--green:#4FA97F;--text:#E9E4D8;--dim:#8C96A8;--faint:#5A6478}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'Space Grotesk',system-ui,sans-serif;line-height:1.65}
  .mono{font-family:'IBM Plex Mono',ui-monospace,monospace}
  .wrap{max-width:820px;margin:0 auto;padding:0 20px}
  a{color:var(--copper);text-decoration:none}
  header{border-bottom:1px solid var(--line);padding:14px 0;position:sticky;top:0;background:rgba(12,17,28,.92);backdrop-filter:blur(6px);z-index:10}
  header .wrap{display:flex;align-items:center;gap:14px;flex-wrap:wrap;max-width:980px}
  .logo{font-weight:700;font-size:19px;letter-spacing:1px}
  .btn{display:inline-block;border-radius:5px;padding:8px 16px;font-weight:700;font-size:13.5px;border:1px solid var(--copper)}
  .btn.solid{background:var(--copper);color:#0C111C}
  h1{font-size:clamp(26px,4.5vw,38px);line-height:1.15;margin:48px 0 10px}
  h1 em{color:var(--copper);font-style:normal}
  .lede{color:var(--dim);font-size:16px;max-width:640px;margin-bottom:8px}
  h2{font-size:21px;margin:44px 0 12px;padding-top:20px;border-top:1px solid var(--line)}
  h3{font-size:15px;margin:18px 0 4px}
  p{color:var(--dim);font-size:14px;margin-bottom:10px}
  p strong{color:var(--text)}
  .k{font-size:9.5px;letter-spacing:2px;color:var(--copper)}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin:14px 0}
  .step{display:flex;gap:12px;margin:16px 0}
  .step .n{flex-shrink:0;width:26px;height:26px;border-radius:5px;background:var(--copper);color:#0C111C;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:13px;font-family:'IBM Plex Mono',monospace}
  .step h3{margin:0 0 3px}
  .step p{margin-bottom:4px}
  .tip{border-left:3px solid var(--copper);background:var(--panel2);padding:8px 12px;font-size:12.5px;color:var(--dim);margin:8px 0;border-radius:0 5px 5px 0}
  .legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--dim);margin:10px 0}
  .legend span::before{content:"●";margin-right:5px}
  .g::before{color:var(--green)} .a::before{color:var(--amber)} .r::before{color:var(--red)} .c::before{color:var(--copper)}
  .formula{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 14px;font-size:11.5px;overflow-x:auto;margin:10px 0}
  .langbar b{cursor:pointer;border:1px solid var(--line);border-radius:3px;padding:2px 7px;font-size:10px;color:var(--faint);font-weight:700}
  .langbar b.on{background:var(--copper);color:#0C111C;border-color:var(--copper)}
  footer{margin-top:56px;padding:24px 0;border-top:1px solid var(--line);font-size:10.5px;color:var(--faint);line-height:1.7}
`;

const Html = ({ tag: Tag = 'span', html, ...rest }) => <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;

function Step({ n, titleKey, tipKey, t, children }) {
  return (
    <div className="step">
      <div className="n">{n}</div>
      <div>
        <h3>{t(titleKey)}</h3>
        {children}
        {tipKey && <div className="tip">{t(tipKey)}</div>}
      </div>
    </div>
  );
}

export default function Intro() {
  const [lang, setLang] = useState('en');
  const t = (key) => T[key][lang] ?? T[key].en;

  return (
    <>
      <style>{STYLE}</style>

      <header>
        <div className="wrap">
          <span className="logo">SSCIM</span>
          <span className="k mono">INTRODUCTION & USER GUIDE</span>
          <span className="langbar mono" style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            {Object.entries(LANG_LABELS).map(([l, label]) => (
              <b key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{label}</b>
            ))}
          </span>
          <span><a href="index.html">{t('navHome')}</a> &nbsp;·&nbsp; <a className="btn solid" href="sscim-app.html">{t('launchDashboard')}</a></span>
        </div>
      </header>

      <div className="wrap">
        <Html tag="h1" html={t('h1')} />
        <p className="lede">{t('lede')}</p>

        <h2>{t('h2_1')}</h2>
        <p>Semiconductors are the most geopolitically concentrated industry on earth: one company in the Netherlands makes every EUV lithography machine, one island fabricates most leading-edge logic, one country dominates HBM memory. Excellent static maps of this structure exist — but they can't tell you <strong>what changed today, which nodes are newly exposed, and how a shock will travel</strong>.</p>
        <p>SSCIM fills that gap with three synchronized layers over one computational engine:</p>
        <div className="card">
          <p><strong>Layer 1 — World Map.</strong> Real OpenStreetMap geography with all 16 countries participating in the chain. Node size shows how much of the chain a country touches; color shows its current risk level. Every country score is derived from its stage participation — nothing is hand-set.</p>
          <p><strong>Layer 2 — Industry Flow.</strong> The complete production pipeline: 24 stages from research/IP and EDA through wafers, chemicals, five equipment categories, three fab types, chip products, packaging, and end markets — connected by 34 value-weighted dependency edges.</p>
          <p><strong>Layer 3 — Intelligence Panel.</strong> The event feed, the company impact ranking, and a detail view that always shows its work: score breakdowns, engine arithmetic, first- and second-order effects, and hop-by-hop impact spread.</p>
        </div>
        <p>Underneath sits <strong>one propagation engine with three uses</strong>: live events, hypothetical scenarios, and company-disruption simulations all run through the identical code path. When an event lands, it decays over time (half-strength in about twelve days), travels downstream along value-weighted edges, and echoes one hop upstream — and every affected node, company, and country updates at once.</p>

        <h2>{t('h2_2')}</h2>
        <div className="legend">
          <span className="g">Moderate risk &lt; 5.5</span>
          <span className="a">Elevated 5.5 – 7.5</span>
          <span className="r">High ≥ 7.5</span>
          <span className="c">Copper = importance, value flow, and scenario deltas</span>
        </div>
        <p>In the flow graph, <strong>edge thickness</strong> is the share of value flowing down that path, and each stage's <strong>dot and border size</strong> is its computed importance (structural centrality blended with economic value). The <strong>WHAT CHANGED</strong> strip at the top always summarizes the current state in one line — it turns copper when a scenario is active.</p>

        <h2>{t('h2_3')}</h2>

        <Step n="1" titleKey="step1" tipKey="tip1" t={t}>
          <p>Start with the top card — the U.S. export-control expansion. The map highlights affected countries, the flow highlights affected stages, and the detail view shows the engine arithmetic (severity × confidence × time decay), the chain-impact index, and the <strong>impact spread tree</strong>: source companies at hop 0, their direct downstream at hop 1, second-order at hop 2, each with an exposure number.</p>
        </Step>

        <Step n="2" titleKey="step2" t={t}>
          <p>Tap any stage in the flow — say <strong>Deposition</strong>. A subsection opens beneath the graph listing the major companies with their market shares (Applied Materials 30%, Lam Research 15%, Tokyo Electron 15%…), their current shock exposure, and each one's top customers with percentages.</p>
        </Step>

        <Step n="3" titleKey="step3" tipKey="tip3" t={t}>
          <p>Tap a company card. You get its <strong>Company Impact Index</strong> — a simulated full disruption injected as 10 × market share at every stage it occupies and propagated through the engine — plus its production footprint, its customers and suppliers with sales shares, and two spread trees: the <strong>customer-graph view</strong> (ASML → TSMC 35% → NVIDIA/Apple…) and the structural stage-level view.</p>
        </Step>

        <Step n="4" titleKey="step4" t={t}>
          <p>The second tab of the intelligence panel ranks every company by chain impact. TSMC, ASML and NVIDIA emerge at the top from the mathematics, not by assertion — tap any name to see why.</p>
        </Step>

        <Step n="5" titleKey="step5" t={t}>
          <p>The header buttons inject simulated events — <strong>Taiwan Strait crisis</strong>, <strong>China materials ban</strong>, <strong>Export controls max</strong> — into the same engine. Copper +deltas appear on every affected stage and country; company exposures recompute. <strong>Baseline</strong> resets everything.</p>
        </Step>

        <Step n="6" titleKey="step6" t={t}>
          <p>The <strong>⚡ GP Briefing</strong> button composes a full daily intelligence briefing from the current model state — what changed, most-shocked nodes, company exposure leaders, country risk board, watch-next — ready to copy. Run it in a scenario and you get the scenario briefing. This is the product GP News subscribers receive each morning.</p>
        </Step>

        <Step n="7" titleKey="step7" t={t}>
          <p>The <strong>ⓘ Methodology</strong> button documents every formula, every propagation factor, which components are computed versus analyst judgment, and the known limitations. The <strong>? Guide</strong> button inside the app repeats this walkthrough in short form.</p>
        </Step>

        <h2>{t('h2_4')}</h2>
        <div className="formula mono">
          <div><Tex tex={"\\text{risk}=0.25\\,C_{\\text{choke}}+0.20\\,C_{\\text{geo}}+0.20\\,C_{\\text{policy}}+0.15\\,C_{\\text{subst}}+0.10\\,C_{\\text{shock}}+0.10\\,C_{\\text{mkt}}"} block /></div>
          <div><Tex tex={"s_0=\\sigma\\cdot\\kappa\\cdot e^{-d/12},\\qquad f_{\\downarrow}=0.55(0.5+0.5w),\\qquad \\mathrm{CII}_c=\\frac{\\sum_n s_n I_n}{\\sum_n I_n},\\qquad e_{c,s}=\\text{share}_{c,s}\\times s_s"} block /></div>
        </div>
        <p>Four of six risk components are computed; two are declared analyst inputs, tagged as such on every breakdown bar. Explainability isn't a feature here — it's the entire trust model.</p>

        <h2>{t('h2_5')}</h2>
        <p>The current build has been through a <strong>best-effort real-data pass</strong>: company market shares, customer relationships and shareholder stakes now draw on public filings and market-share trackers wherever a reliable source exists, and headline corrections are logged with their citation in the vault's data notes. Figures without a logged citation are still carried-over analyst judgment, not yet individually sourced — policy entries and events remain illustrative. Propagation parameters get calibrated against documented historical episodes before scores ship without any caveat. Everything SSCIM produces is descriptive supply-chain analysis — <strong>never investment advice</strong>.</p>

        <p style={{ marginTop: 28 }}><a className="btn solid" href="sscim-app.html">{t('launchDashboardBottom')}</a></p>
      </div>

      <footer>
        <div className="wrap">
          <p><strong style={{ color: 'var(--dim)' }}>SSCIM</strong> · a GP News product · map data © OpenStreetMap contributors · {t('footerText')}</p>
        </div>
      </footer>
    </>
  );
}
