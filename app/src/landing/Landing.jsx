import { useState } from 'react';
import { T, LANG_LABELS } from './i18n.js';
import Tex from '../components/Tex.jsx';
import NewsTicker from '../components/NewsTicker.jsx';
import SiteMap from '../components/SiteMap.jsx';
import { BASE_CSS, FOOT_CSS } from '../ui/css.js';

/* ====================================================================
   Landing — one page that says what this is and shows it.

   The palette, the type scale and every control come from ui/css.js, the
   one stylesheet the whole site loads. This file used to carry its own
   copy of the palette, with `--dim` and `--faint` set to values that
   disagreed with the other four pages.

   What the structure is for:

   - The feature grid is gone. Four bordered cards of identical weight is
     the shape of a template, and it made the headline capability (the
     Facility Playground) look exactly as important as a footnote. The
     same content is now a definition list with hairline rules: the eye
     runs down the terms, and only one of them is marked.
   - Nothing lifts or glows on hover. A button changes shade.
   - There is one all-caps label on the page, and it is the one above the
     specimen figures.
   ==================================================================== */

const STYLE = `
${BASE_CSS}
${FOOT_CSS}

/* --- hero ------------------------------------------------------------ */

.hero{padding:var(--s8) 0 var(--s7);border-bottom:1px solid var(--rule)}
.hero .cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.22fr);gap:var(--s7);align-items:center}
.hero h1{font-size:clamp(30px,3.6vw,44px);line-height:1.08;letter-spacing:-.025em;max-width:22ch}
.hero h1 em{font-style:normal;color:var(--accent)}
.hero .lede{margin:var(--s4) 0 var(--s5);max-width:48ch}
.cta{display:flex;gap:var(--s3);flex-wrap:wrap;align-items:center}
.cta .btn{min-height:42px;font-size:var(--t-body)}
.shot{border:1px solid var(--rule);border-radius:var(--r3);overflow:hidden;background:var(--sunken)}
.shot img{display:block;width:100%;height:auto}
.shotcap{font-size:var(--t-meta);color:var(--ink-3);margin-top:var(--s3);max-width:60ch;line-height:1.55}

/* --- sections -------------------------------------------------------- */

section.band{padding:var(--s7) 0;border-bottom:1px solid var(--rule)}
section.band > .shell > h2{font-size:var(--t-h2);max-width:30ch}
section.band .sub{margin-top:var(--s2);max-width:62ch;color:var(--ink-2);font-size:var(--t-body)}

/* A definition list under hairline rules, not a deck of cards. Each term
   is a claim and each definition qualifies it, which is the shape the
   content always had. */
.defs{margin-top:var(--s5);border-top:1px solid var(--rule)}
.defs > div{display:grid;grid-template-columns:minmax(0,13rem) minmax(0,1fr);gap:var(--s3) var(--s6);padding:var(--s4) 0;border-bottom:1px solid var(--rule-soft)}
.defs > div:last-child{border-bottom:0}
.defs dt{font-size:var(--t-lede);font-weight:600;color:var(--ink);line-height:1.3}
.defs dd{font-size:var(--t-small);color:var(--ink-2);line-height:1.6;max-width:66ch}
.defs .k{display:block;font-size:var(--t-meta);color:var(--ink-3);margin-bottom:3px;font-variant-numeric:tabular-nums}
/* The one marked row: the headline capability. A 2px rule, not a
   coloured box — it needs to read as "this one", not as a promotion. */
.defs > div.lead{box-shadow:inset 2px 0 var(--accent);padding-left:var(--s4)}
@media(max-width:760px){.defs > div{grid-template-columns:minmax(0,1fr);gap:var(--s2)}}

.does{margin-top:var(--s5);display:grid;gap:var(--s3);max-width:76ch}
.does li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--s3);font-size:var(--t-small);color:var(--ink-2);line-height:1.6}
.does li span[aria-hidden]{color:var(--accent-dim)}

.specimen{margin-top:var(--s4);background:var(--sunken);border:1px solid var(--rule);border-radius:var(--r3);padding:var(--s5);overflow-x:auto}
.specimen > div + div{margin-top:var(--s4);padding-top:var(--s4);border-top:1px solid var(--rule)}
.specimen .after{font-size:var(--t-small);color:var(--ink-2);line-height:1.6}

details.peek summary{
  cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:var(--s2);
  color:var(--accent);font-size:var(--t-small);padding:var(--s2) 0;
}
details.peek summary::-webkit-details-marker{display:none}
details.peek summary::before{content:"▸";font-size:10px}
details.peek[open] summary::before{content:"▾"}

.langbar{display:flex;gap:2px;padding:2px;background:var(--sunken);border:1px solid var(--control);border-radius:var(--r2)}
.langbar button{
  min-height:26px;padding:0 9px;border:0;border-radius:var(--r1);
  background:transparent;color:var(--ink-2);font-size:var(--t-meta);cursor:pointer;
}
.langbar button:hover{color:var(--ink)}
.langbar button[aria-pressed="true"]{background:var(--accent);color:var(--on-accent);font-weight:600}

.closing{padding:var(--s7) 0}

@media(max-width:900px){
  .hero{padding:var(--s6) 0 var(--s5)}
  .hero .cols{grid-template-columns:minmax(0,1fr);gap:var(--s5)}
  .hero h1{max-width:none}
}
@media(max-width:640px){
  .langbar button{min-height:40px}
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

  const Def = ({ k, term, body, lead }) => (
    <div className={lead ? 'lead' : undefined}>
      <dt>{k && <span className="k">{k}</span>}{term}</dt>
      <dd>{body}</dd>
    </div>
  );

  return (
    <>
      <style>{STYLE}</style>

      {/* The header used to state the product's identity three times — a
          logo reading SSCIM, a badge reading "SSCIM INTELLIGENCE", and the
          full product name in 10px all-caps — and the product's state not
          at all. One name, one plain subtitle. */}
      <header className="site-head">
        <div className="shell bar">
          <a className="brand" href="index.html" aria-label="SSCIM home"><img src="sscim-logo.png" alt="SSCIM" /></a>
          <span className="meta" style={{ minWidth: 0 }}>{t('productName')}</span>
          <nav className="site-nav" aria-label="Site">
            <div className="langbar" role="group" aria-label="Language">
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
            <a className="btn btn-primary btn-sm" href="sscim-app.html">{t('openDashboard')}</a>
          </nav>
        </div>
      </header>

      <NewsTicker />

      {/* The hero shows the dashboard, captured from the real build by the
          same run that writes the screenshot record — so the page cannot
          advertise a product that no longer looks like this. */}
      <div className="hero">
        <div className="shell cols">
          <div>
            <Html tag="h1" html={t('heroH1')} />
            <p className="lede">{t('heroP')}</p>
            <div className="cta">
              <a className="btn btn-primary" href="sscim-app.html">{t('openDashboard')}</a>
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

      <section className="band">
        <div className="shell">
          <h2>{t('h2Ask')}</h2>
          <p className="sub">{t('subAsk')}</p>
          {/* Placed HERE, beside the first claim the page makes about what
              the numbers mean, rather than in a footer a reader reaches
              after they have already formed an impression. */}
          <p className="note" style={{ marginTop: 'var(--s4)', maxWidth: '76ch' }}>{t('limitsShort')}</p>
          <dl className="defs">
            <Def k={t('card1K')} term={t('card1H')} body={t('card1P')} />
            <Def k={t('card2K')} term={t('card2H')} body={t('card2P')} />
            <Def k={t('card3K')} term={t('card3H')} body={t('card3P')} />
            {/* The Facility Playground — the headline capability, and once
                not mentioned on this page at all. */}
            <Def k={t('card4K')} term={t('card4Hd')} body={t('card4Pd')} lead />
          </dl>
        </div>
      </section>

      {/* An explicit inventory of what the product does today. Added
          because the page advertised two workflows that no longer exist
          (a one-tap hypothetical scenario, a Taiwan Strait crisis
          briefing) while omitting the one that had become the headline. */}
      <section className="band">
        <div className="shell">
          <h2>{t('h2Does')}</h2>
          <p className="sub">{t('subDoes')}</p>
          <ul className="does bare">
            {t('doesList').map((item) => (
              <li key={item}>
                <span aria-hidden="true">—</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band">
        <div className="shell">
          <h2>{t('h2Network')}</h2>
          <p className="sub">{t('subNetwork')}</p>
          <dl className="defs">
            <Def k={t('cardN1K')} term={t('cardN1H')} body={t('cardN1P')} />
            <Def k={t('cardN2K')} term={t('cardN2H')} body={t('cardN2P')} />
            <Def k={t('cardN3K')} term={t('cardN3H')} body={t('cardN3P')} />
          </dl>
        </div>
      </section>

      <section className="band">
        <div className="shell">
          <h2>{t('h2Explain')}</h2>
          <p className="sub">{t('subExplain')}</p>
          {/* The two governing equations used to sit high on the page, open,
              in 11.5px type. Transparency is the point of this product, so
              they stay — one click away, at a size that can be read, after
              the page has said what the product is for. */}
          <details className="peek" style={{ marginTop: 'var(--s3)' }}>
            <summary>{t('methodologyPeek')}</summary>
            <div className="specimen">
              <div><Tex tex={"\\text{struct}_s = w_{\\text{ni}}NI_s + w_{\\text{geo}}GEO_s + w_{\\text{pol}}POL_s + w_{\\nu}(10\\nu_s) + w_{\\text{mkt}}\\,\\text{mkt}_s"} block /></div>
              <div><Tex tex={"z_{e,s}=d_{e,s}\\,g(q_e)\\,\\alpha_{e,s}\\,R_e(t),\\qquad D_{ba}=f_d\\,q_{ba}\\big[\\phi+(1-\\phi)\\nu_a\\big]"} block /></div>
              <div className="after">
                {t('formulaNote')} <span className="eyebrow" style={{ color: 'var(--accent)' }}>{t('sourcesTag')}</span>
              </div>
            </div>
          </details>
        </div>
      </section>

      <section className="band">
        <div className="shell">
          <h2>{t('h2DataSource')}</h2>
          {/* The scope sentence, stated once and in full, with every figure
              interpolated from the shipped snapshot rather than typed —
              including the scored/host-only country split that "16
              countries" used to elide. */}
          <p className="sub">{t('scopeNote')}</p>
          <dl className="defs">
            <Def term={t('currentCard4H')} body={t('currentCard4P')} />
            <Def term={t('card5H')} body={t('card5P')} />
            <Def term={t('card6H')} body={t('card6P')} />
          </dl>
        </div>
      </section>

      <div className="closing">
        <div className="shell">
          <div className="cta" style={{ marginBottom: 'var(--s5)' }}>
            <a className="btn btn-primary" href="sscim-app.html">{t('openDashboard')}</a>
            <a className="btn" href="intro.html">{t('navIntro')}</a>
          </div>
          <p className="note" style={{ maxWidth: '86ch' }}>{t('currentFooter')}</p>
        </div>
      </div>

      <SiteMap current="home" />
    </>
  );
}
