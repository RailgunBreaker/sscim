import { useState } from 'react';
import { T, LANG_LABELS } from './i18n.js';
import Tex from '../components/Tex.jsx';

const STYLE = `
  :root{--bg:#0C111C;--panel:#141B2B;--panel2:#0F1626;--line:#243149;--copper:#C98A3F;--copperDim:#8A6230;--red:#E25C4A;--amber:#DFA83D;--green:#4FA97F;--text:#E9E4D8;--dim:#8C96A8;--faint:#5A6478}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:'Space Grotesk',system-ui,sans-serif;line-height:1.6}
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  .mono{font-family:'IBM Plex Mono',ui-monospace,monospace}
  .wrap{max-width:980px;margin:0 auto;padding:0 20px}
  a{color:var(--copper);text-decoration:none}
  header{border-bottom:1px solid var(--line);padding:16px 0;position:sticky;top:0;background:rgba(12,17,28,.92);backdrop-filter:blur(6px);z-index:10}
  header .wrap{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
  .logo{font-weight:700;font-size:20px;letter-spacing:1px}
  .tag{font-size:10px;letter-spacing:2px;color:var(--copper)}
  .btn{display:inline-block;border-radius:5px;padding:9px 18px;font-weight:700;font-size:14px;cursor:pointer;border:1px solid var(--copper)}
  .btn.solid{background:var(--copper);color:#0C111C}
  .hero{padding:72px 0 52px;border-bottom:1px solid var(--line);background:
    radial-gradient(ellipse 60% 50% at 70% 10%, rgba(201,138,63,.08), transparent),
    repeating-linear-gradient(90deg, transparent 0 99px, rgba(36,49,73,.35) 99px 100px)}
  .hero h1{font-size:clamp(30px,5.5vw,52px);line-height:1.12;letter-spacing:-.5px;max-width:760px}
  .hero h1 em{color:var(--copper);font-style:normal}
  .hero p{color:var(--dim);max-width:620px;margin:18px 0 26px;font-size:16.5px}
  .ticker{border-bottom:1px solid var(--line);background:var(--panel2);padding:8px 0;font-size:11.5px;color:var(--dim);overflow:hidden;white-space:nowrap}
  section{padding:56px 0;border-bottom:1px solid var(--line)}
  h2{font-size:24px;margin-bottom:8px}
  .sub{color:var(--dim);margin-bottom:28px;max-width:640px}
  .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px}
  .card h3{font-size:15px;margin-bottom:6px}
  .card .k{font-size:9.5px;letter-spacing:2px;color:var(--copper);display:block;margin-bottom:8px}
  .card p{font-size:13px;color:var(--dim)}
  .formula{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;font-size:11.5px;color:var(--text);overflow-x:auto}
  .langbar b{cursor:pointer;border:1px solid var(--line);border-radius:3px;padding:2px 7px;font-size:10px;color:var(--faint);font-weight:700}
  .langbar b.on{background:var(--copper);color:#0C111C;border-color:var(--copper)}
  footer{padding:28px 0;font-size:10.5px;color:var(--faint);line-height:1.7}
`;

const Html = ({ tag: Tag = 'span', html, ...rest }) => <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;

export default function Landing() {
  const [lang, setLang] = useState('en');
  const t = (key) => T[key][lang] ?? T[key].en;

  return (
    <>
      <style>{STYLE}</style>

      <header>
        <div className="wrap">
          <span className="logo">SSCIM</span>
          <span className="tag mono">SEMICONDUCTOR SUPPLY CHAIN INTELLIGENCE MAP</span>
          <span className="langbar mono" style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            {Object.entries(LANG_LABELS).map(([l, label]) => (
              <b key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{label}</b>
            ))}
          </span>
          <a href="intro.html" style={{ fontSize: 13 }}>{t('navIntro')}</a>
          <a className="btn solid" href="sscim-app.html">{t('launchDemo')}</a>
        </div>
      </header>

      <div className="ticker mono">
        WHAT CHANGED · U.S. expands AI-chip export controls — chain impact 2.41 · TSMC accelerates CoWoS — packaging shock easing · China Ga/Ge licensing — decay day 9 of 12 · illustrative event feed
      </div>

      <div className="hero">
        <div className="wrap">
          <Html tag="h1" html={t('heroH1')} />
          <p>{t('heroP')}</p>
          <a className="btn solid" href="sscim-app.html">{t('openDashboard')}</a>
        </div>
      </div>

      <section>
        <div className="wrap">
          <h2>{t('h2Ask')}</h2>
          <p className="sub">{t('subAsk')}</p>
          <div className="grid">
            <div className="card"><span className="k mono">EVENT → CHAIN</span><h3>"BIS just expanded AI-chip rules. Who is exposed?"</h3><p>The event lands on the graph, decays over time, and propagates along value-weighted edges: logic/AI → packaging → systems, with named companies and exposure numbers at every hop.</p></div>
            <div className="card"><span className="k mono">COMPANY → CHAIN</span><h3>"If ASML is disrupted, how far does it spread?"</h3><p>Company Impact Index simulates full disruption: 10 × market share injected at every stage held, propagated through the same engine. Customer-graph view names who buys what percentage.</p></div>
            <div className="card"><span className="k mono">SCENARIO → BRIEFING</span><h3>"Write me the Taiwan Strait crisis briefing."</h3><p>One tap generates the GP News daily watch: what changed, most-shocked nodes, company exposure leaders, country risk board, watch-next — straight from the model.</p></div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>{t('h2Explain')}</h2>
          <p className="sub">{t('subExplain')}</p>
          <div className="formula mono">
            <div><Tex tex={"\\text{risk}=0.25\\,C_{\\text{choke}}+0.20\\,C_{\\text{geo}}+0.20\\,C_{\\text{policy}}+0.15\\,C_{\\text{subst}}+0.10\\,C_{\\text{shock}}+0.10\\,C_{\\text{mkt}}"} block /></div>
            <div><Tex tex={"s_0=\\sigma\\cdot\\kappa_{\\text{conf}}\\cdot e^{-d/12},\\qquad f_{\\downarrow}=0.55(0.5+0.5w),\\quad f_{\\uparrow}=0.30"} block /></div>
            <div style={{ marginTop: 6, fontSize: 10.5 }}>
              sources: <span style={{ color: 'var(--copper)' }}>[GRAPH]</span> <span style={{ color: 'var(--copper)' }}>[HHI]</span> <span style={{ color: 'var(--copper)' }}>[POLICY DB]</span> <span style={{ color: 'var(--copper)' }}>[EVENT ENGINE]</span> <span style={{ color: 'var(--amber)' }}>[ANALYST ×2]</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>{t('h2DataSource')}</h2>
          <div className="grid">
            <div className="card"><h3>A live data vault, not a hardcoded file</h3><p>Companies, stages, the customer graph and shareholder table live in a real backend database, not baked into the page — headline figures carry a source and evidence tier in the vault's citation log.</p></div>
            <div className="card"><h3>Human-reviewed events</h3><p>Official sources (BIS, METI, MOFCOM, company IR) and trusted media, classified and mapped to the graph with confidence labels before anything reaches you.</p></div>
            <div className="card"><h3>Calibrated propagation</h3><p>Engine parameters are backtested against documented episodes — the 2021 substrate shortage, 2023 Ga/Ge licensing, successive export-control rounds.</p></div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <p><strong style={{ color: 'var(--dim)' }}>SSCIM</strong> · a GP News product · map data © OpenStreetMap contributors</p>
          <p>{t('footerText')}</p>
        </div>
      </footer>
    </>
  );
}
