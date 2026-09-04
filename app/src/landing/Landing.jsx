import { useState } from 'react';
import { T, LANG_LABELS } from './i18n.js';
import Tex from '../components/Tex.jsx';
import NewsTicker from '../components/NewsTicker.jsx';
import SiteMap from '../components/SiteMap.jsx';

const STYLE = `
  :root{--bg:#0C111C;--panel:#141B2B;--panel2:#0F1626;--line:#243149;--copper:#C98A3F;--copperDim:#8A6230;--red:#E25C4A;--amber:#DFA83D;--green:#4FA97F;--text:#E9E4D8;--dim:#8C96A8;--faint:#79849A}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;font-size:15px}
  .mono{font-variant-numeric:tabular-nums}
  .wrap{max-width:1120px;margin:0 auto;padding:0 24px}
  a{color:var(--copper);text-decoration:none}
  a:focus-visible,button:focus-visible{outline:2px solid var(--copper);outline-offset:2px;border-radius:3px}
  header{border-bottom:1px solid var(--line);padding:14px 0;position:sticky;top:0;background:rgba(12,17,28,.94);z-index:10}
  header .wrap{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  .logo{display:flex;align-items:center}.logo img{display:block;width:100px;height:auto;filter:grayscale(1) brightness(0) invert(1)}
  .productname{font-size:13px;color:var(--faint)}
  header nav{margin-left:auto;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  header nav a{font-size:14px;color:var(--dim)}
  header nav a:hover{color:var(--text)}
  /* ONE primary action, and it does not lift, glow or slide. A button that
     animates on hover reads as a marketing page; a button that changes
     shade reads as a control. */
  .btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;border-radius:5px;padding:0 20px;font-weight:600;font-size:15px;cursor:pointer;border:1px solid var(--line);color:var(--text);background:transparent}
  .btn.solid{background:var(--copper);color:#0C111C;border-color:var(--copper)}
  .btn:hover{background:rgba(255,255,255,.06)}
  .btn.solid:hover{filter:brightness(1.06);background:var(--copper)}
  .hero{padding:64px 0 48px;border-bottom:1px solid var(--line)}
  .hero .cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:44px;align-items:center}
  .hero h1{font-size:clamp(28px,3.4vw,40px);line-height:1.2;letter-spacing:-.4px;font-weight:600;max-width:22ch}
  .hero p{color:var(--dim);margin:18px 0 26px;font-size:16px;max-width:52ch}
  .cta{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
  .shot{border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel2)}
  .shot img{display:block;width:100%;height:auto}
  .shotcap{font-size:13px;color:var(--faint);margin-top:10px;max-width:58ch}
  @media (max-width:900px){ .hero .cols{grid-template-columns:minmax(0,1fr);gap:28px} .hero h1{max-width:none} }
  section{padding:52px 0;border-bottom:1px solid var(--line)}
  h2{font-size:22px;font-weight:600;margin-bottom:6px;letter-spacing:0}
  .sub{color:var(--dim);margin-bottom:26px;max-width:62ch;font-size:15px}
  .grid{display:grid;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:8px;overflow:hidden;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
  /* Cards share one boundary and are separated by the grid gap showing the
     border colour through. Four independent bordered boxes with their own
     hover lift is what made this read as a template. */
  .card{background:var(--panel);padding:20px}
  .card h3{font-size:15px;font-weight:600;margin-bottom:6px;line-height:1.35}
  .card .k{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:10px}
  .card p{font-size:14px;color:var(--dim)}
  .formula{background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:16px;font-size:13px;color:var(--text);overflow-x:auto}
  .formula > div + div{margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
  details.peek summary{cursor:pointer;color:var(--copper);font-size:14px;list-style:none;padding:6px 0;display:inline-flex;align-items:center;gap:8px}
  details.peek summary::-webkit-details-marker{display:none}
  details.peek summary::before{content:"›";display:inline-block}
  details.peek[open] summary::before{transform:rotate(90deg)}
  details.peek > div{padding-top:12px}
  .langbar button{cursor:pointer;background:transparent;font-family:inherit;border:1px solid var(--line);border-radius:3px;padding:0 9px;min-height:28px;font-size:13px;color:var(--dim);font-weight:500}
  .langbar button:hover{color:var(--text)}
  .langbar button[aria-pressed="true"]{background:var(--copper);color:#0C111C;border-color:var(--copper);font-weight:600}
  .limits{border-left:2px solid var(--copperDim);background:var(--panel2);border-radius:0 6px 6px 0;padding:14px 18px;color:var(--dim);font-size:14px;line-height:1.65;max-width:76ch}
  .disclaimer{border-left:2px solid var(--copperDim);background:var(--panel2);border-radius:0 6px 6px 0;padding:14px 18px;color:var(--dim);font-size:13px;line-height:1.7}
  footer{padding:28px 0;font-size:13px;color:var(--faint);line-height:1.7}
  @media (max-width:640px){
    header .wrap{gap:10px}
    header nav{gap:12px;width:100%;margin-left:0}
    .btn{min-height:44px}
    .langbar button{min-height:44px}
  }
`;

const Html = ({ tag: Tag = 'span', html, ...rest }) => <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;

/* "EN"/"简"/"繁"/"日" are legible to a reader who already reads that
   script and opaque to a screen reader, so each button carries the
   language's full name as its accessible name. */
const LANG_NAMES = { en: 'English', zh: '简体中文 — Simplified Chinese', tw: '繁體中文 — Traditional Chinese', ja: '日本語 — Japanese' };

export default function Landing() {
  const [lang, setLang] = useState('en');
  const t = (key) => T[key][lang] ?? T[key].en;

  return (
    <>
      <style>{STYLE}</style>

      {/* The badge read "SSCIM INTELLIGENCE" next to a logo reading SSCIM,
          in a header that already carried the full product name in 10px
          all-caps with 2px of letter-spacing. Three statements of identity
          and no product state among them. One name, one plain subtitle. */}
      <header>
        <div className="wrap">
          <a className="logo" href="index.html" aria-label="SSCIM home"><img src="sscim-logo.png" alt="SSCIM" /></a>
          <span className="productname">{t('productName')}</span>
          <nav aria-label="Site">
            <div className="langbar" role="group" aria-label="Language" style={{ display: 'flex', gap: 3 }}>
              {Object.entries(LANG_LABELS).map(([l, label]) => (
                <button key={l} type="button" aria-pressed={lang === l}
                  aria-label={LANG_NAMES[l] || label} onClick={() => setLang(l)}>
                  {label}
                </button>
              ))}
            </div>
            <a href="intro.html">{t('navIntro')}</a>
            <a href="updates.html">{t('navUpdates')}</a>
            <a href="docs.html">Documentation</a>
          </nav>
        </div>
      </header>

      <NewsTicker />

      {/* The hero used to be a headline, a paragraph and a button on the
          left with nothing at all on the right — half the fold empty, and
          the reader had still not seen the product. It now shows the
          dashboard, captured from the real build by the same run that
          writes the screenshot record, so the page cannot advertise a
          product that no longer looks like this. */}
      <div className="hero">
        <div className="wrap cols">
          <div>
            <Html tag="h1" html={t('heroH1')} />
            <p>{t('heroP')}</p>
            <div className="cta">
              <a className="btn solid" href="sscim-app.html">{t('openDashboard')}</a>
              <a className="btn" href="docs/METHODOLOGY.md.html">{t('viewMethodology')}</a>
            </div>
          </div>
          <div>
            <div className="shot">
              <img src="product-dashboard.png" alt={t('heroShotAlt')} width="1366" height="936" loading="eager" />
            </div>
            <p className="shotcap">{t('shotCaption')}</p>
          </div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <h2>{t('h2Ask')}</h2>
          <p className="sub">{t('subAsk')}</p>
          {/* Placed HERE, beside the first claim the page makes about what
              the numbers mean, rather than in a footer a reader reaches
              after they have already formed an impression. */}
          <p className="limits" style={{ marginBottom: 26 }}>{t('limitsShort')}</p>
          <div className="grid">
            <div className="card"><span className="k mono">{t('card1K')}</span><h3>{t('card1H')}</h3><p>{t('card1P')}</p></div>
            <div className="card"><span className="k mono">{t('card2K')}</span><h3>{t('card2H')}</h3><p>{t('card2P')}</p></div>
            <div className="card"><span className="k mono">{t('card3K')}</span><h3>{t('card3H')}</h3><p>{t('card3P')}</p></div>
            {/* The Facility Playground — the headline capability, and
                previously not mentioned on this page at all. */}
            <div className="card" style={{ borderColor: 'var(--copperDim)' }}>
              <span className="k mono">{t('card4K')}</span><h3>{t('card4Hd')}</h3><p>{t('card4Pd')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* An explicit inventory of what the product does today. Added
          because the page advertised two workflows that no longer exist
          (a one-tap hypothetical scenario, a Taiwan Strait crisis
          briefing) while omitting the one that had become the headline. */}
      <section>
        <div className="wrap">
          <h2>{t('h2Does')}</h2>
          <p className="sub">{t('subDoes')}</p>
          <ul style={{ display: 'grid', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
            {t('doesList').map((item) => (
              <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--dim)' }}>
                <span aria-hidden style={{ color: 'var(--copper)', flexShrink: 0 }}>▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
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
          {/* The two governing equations used to sit high on the page, open,
              in 11.5px type. Transparency is the point of this product, so
              they stay — one click away, at a size that can be read, after
              the page has said what the product is for. */}
          <details className="peek">
            <summary>{t('methodologyPeek')}</summary>
            <div>
          <div className="formula mono">
            <div><Tex tex={"\\text{struct}_s = w_{\\text{ni}}NI_s + w_{\\text{geo}}GEO_s + w_{\\text{pol}}POL_s + w_{\\nu}(10\\nu_s) + w_{\\text{mkt}}\\,\\text{mkt}_s"} block /></div>
            <div><Tex tex={"z_{e,s}=d_{e,s}\\,g(q_e)\\,\\alpha_{e,s}\\,R_e(t),\\qquad D_{ba}=f_d\\,q_{ba}\\big[\\phi+(1-\\phi)\\nu_a\\big]"} block /></div>
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--dim)' }}>
              {t('formulaNote')} <span style={{ color: 'var(--copper)' }}>{t('sourcesTag')}</span>
            </div>
          </div>
            </div>
          </details>
        </div>
      </section>

      <section>
        <div className="wrap">
          <h2>{t('h2DataSource')}</h2>
          {/* The scope sentence, stated once and in full, with every figure
              interpolated from the shipped snapshot rather than typed —
              including the scored/host-only country split that "16
              countries" used to elide. */}
          <p className="sub" style={{ maxWidth: 760 }}>{t('scopeNote')}</p>
          <div className="grid">
            <div className="card"><h3>{t('currentCard4H')}</h3><p>{t('currentCard4P')}</p></div>
            <div className="card"><h3>{t('card5H')}</h3><p>{t('card5P')}</p></div>
            <div className="card"><h3>{t('card6H')}</h3><p>{t('card6P')}</p></div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="disclaimer">{t('currentFooter')}</div>
        </div>
      </footer>

      <SiteMap current="home" />
    </>
  );
}
