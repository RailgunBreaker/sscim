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
  header .wrap{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .logo{font-weight:700;font-size:20px;letter-spacing:1px}
  .tag{font-size:10px;letter-spacing:2px;color:var(--copper)}
  .badge{font-size:9px;letter-spacing:1.5px;color:var(--amber);border:1px solid var(--amber);border-radius:3px;padding:2px 7px;font-family:'IBM Plex Mono',monospace;white-space:nowrap}
  .btn{display:inline-block;border-radius:5px;padding:9px 18px;font-weight:700;font-size:14px;cursor:pointer;border:1px solid var(--copper);transition:transform .15s ease,box-shadow .15s ease}
  .btn.solid{background:var(--copper);color:#0C111C}
  .btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(201,138,63,.22)}
  .hero{padding:72px 0 52px;border-bottom:1px solid var(--line);background:
    radial-gradient(ellipse 60% 50% at 70% 10%, rgba(201,138,63,.08), transparent),
    repeating-linear-gradient(90deg, transparent 0 99px, rgba(36,49,73,.35) 99px 100px)}
  .hero h1{font-size:clamp(30px,5.5vw,52px);line-height:1.12;letter-spacing:-.5px;max-width:760px}
  .hero h1 em{color:var(--copper);font-style:normal}
  .hero p{color:var(--dim);max-width:640px;margin:18px 0 26px;font-size:16.5px}
  .ticker{border-bottom:1px solid var(--line);background:var(--panel2);padding:8px 0;font-size:11px;color:var(--dim);overflow:hidden;white-space:nowrap;position:relative}
  .ticker::after{content:"";position:absolute;top:0;right:0;bottom:0;width:60px;background:linear-gradient(90deg,transparent,var(--panel2))}
  section{padding:56px 0;border-bottom:1px solid var(--line)}
  h2{font-size:24px;margin-bottom:8px}
  .sub{color:var(--dim);margin-bottom:28px;max-width:640px}
  .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px;transition:border-color .15s ease,transform .15s ease}
  .card:hover{border-color:var(--copperDim);transform:translateY(-2px)}
  .card h3{font-size:15px;margin-bottom:6px}
  .card .k{font-size:9.5px;letter-spacing:2px;color:var(--copper);display:block;margin-bottom:8px}
  .card p{font-size:13px;color:var(--dim)}
  .formula{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px 16px;font-size:11.5px;color:var(--text);overflow-x:auto}
  .formula > div + div{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)}
  .langbar b{cursor:pointer;border:1px solid var(--line);border-radius:3px;padding:2px 7px;font-size:10px;color:var(--faint);font-weight:700;transition:background .15s ease,color .15s ease}
  .langbar b.on{background:var(--copper);color:#0C111C;border-color:var(--copper)}
  .disclaimer{border:1px solid var(--copperDim);background:rgba(223,168,61,.06);border-radius:6px;padding:12px 14px;color:var(--amber);font-size:11px;line-height:1.7}
  footer{padding:28px 0;font-size:10.5px;color:var(--faint);line-height:1.7}
  @media (max-width:640px){ header .wrap{gap:8px} .badge{display:none} }
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
          <span className="badge">{t('badge')}</span>
          <span className="langbar mono" style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            {Object.entries(LANG_LABELS).map(([l, label]) => (
              <b key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{label}</b>
            ))}
          </span>
          <a href="intro.html" style={{ fontSize: 13 }}>{t('navIntro')}</a>
          <a className="btn solid" href="sscim-app.html">{t('launchDemo')}</a>
        </div>
      </header>

      <div className="ticker mono">{t('ticker')}</div>

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
            <div className="card"><span className="k mono">{t('card1K')}</span><h3>{t('card1H')}</h3><p>{t('card1P')}</p></div>
            <div className="card"><span className="k mono">{t('card2K')}</span><h3>{t('card2H')}</h3><p>{t('card2P')}</p></div>
            <div className="card"><span className="k mono">{t('card3K')}</span><h3>{t('card3H')}</h3><p>{t('card3P')}</p></div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>{t('h2Network')}</h2>
          <p className="sub">{t('subNetwork')}</p>
          <div className="grid">
            <div className="card"><span className="k mono">{t('cardN1K')}</span><h3>{t('cardN1H')}</h3><p>{t('cardN1P')}</p></div>
            <div className="card"><span className="k mono">{t('cardN2K')}</span><h3>{t('cardN2H')}</h3><p>{t('cardN2P')}</p></div>
            <div className="card"><span className="k mono">{t('cardN3K')}</span><h3>{t('cardN3H')}</h3><p>{t('cardN3P')}</p></div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>{t('h2Explain')}</h2>
          <p className="sub">{t('subExplain')}</p>
          <div className="formula mono">
            <div><Tex tex={"\\text{struct}_n = w_{\\text{ni}}\\,NI_n + w_{\\text{geo}}\\,GEO_n + w_{\\text{pol}}\\,POL_n + w_{\\text{subst}}\\,\\text{subst}_n + w_{\\text{mkt}}\\,\\text{mkt}_n"} block /></div>
            <div><Tex tex={"\\text{decay}(\\text{age},H)=2^{-\\text{age}/H},\\ H{=}12\\text{d},\\qquad \\text{combinePositive}(v)=1-\\textstyle\\prod_i(1-v_i)"} block /></div>
            <div style={{ marginTop: 6, fontSize: 10.5 }}>
              {t('formulaNote')} <span style={{ color: 'var(--copper)' }}>{t('sourcesTag')}</span>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>{t('h2DataSource')}</h2>
          <div className="grid">
            <div className="card"><h3>{t('card4H')}</h3><p>{t('card4P')}</p></div>
            <div className="card"><h3>{t('card5H')}</h3><p>{t('card5P')}</p></div>
            <div className="card"><h3>{t('card6H')}</h3><p>{t('card6P')}</p></div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <p style={{ marginBottom: 10 }}><strong style={{ color: 'var(--dim)' }}>SSCIM</strong> · a GP News product · map data © OpenStreetMap contributors</p>
          <div className="disclaimer">{t('footerText')}</div>
        </div>
      </footer>
    </>
  );
}
