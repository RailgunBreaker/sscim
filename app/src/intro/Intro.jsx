import { useState } from 'react';
import { T, LANG_LABELS } from './i18n.js';
import Tex from '../components/Tex.jsx';
import NewsTicker from '../components/NewsTicker.jsx';
import SiteMap from '../components/SiteMap.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { BASE_CSS, FOOT_CSS } from '../ui/css.js';

/* ====================================================================
   Intro — how to read the dashboard without misreading it.

   This is long-form reading, so it is set like a document: a text face at
   a reading measure, with the page's own sections tracked in a sticky
   rail, and the paper theme available. It is the same treatment as the
   generated documentation pages, because it is the same kind of thing —
   it was simply hand-written rather than compiled from Markdown.

   WHAT WAS REMOVED, and why. The hero carried two pieces of pure
   decoration: a 340px ring rotating on a twelve-second loop, and a row of
   six bars pulsing like an audio equaliser. Neither encoded anything.
   Both are the clearest possible signal that a page was assembled for
   effect rather than designed for a reader, and they were the first thing
   anyone saw. The language buttons were also clickable <b> elements,
   which no keyboard could reach; they are buttons now, like the ones on
   the landing page.
   ==================================================================== */

const STYLE = `
${BASE_CSS}
${FOOT_CSS}

.guide{display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:var(--s7);max-width:1080px;margin:0 auto;padding:var(--s6) var(--s5) var(--s8);align-items:start}

.lead-in{padding-bottom:var(--s5);margin-bottom:var(--s5);border-bottom:1px solid var(--rule)}
.lead-in h1{font-size:clamp(28px,3.4vw,40px);line-height:1.1;letter-spacing:-.022em;max-width:26ch}
.lead-in h1 em{font-style:normal;color:var(--accent)}
.lead-in .lede{margin-top:var(--s4);max-width:58ch}

/* Sections are separated by space and one rule, not by a border-top on
   every heading plus 20px of padding above it. */
.prose h2{margin-top:2.4em}

/* A numbered step. The number is a figure in the margin, not a filled
   square: a copper-filled rounded box with a bold white numeral in it is
   the visual language of an onboarding tour, and this is a reference. */
.steps{counter-reset:step;margin-top:var(--s5);border-top:1px solid var(--rule)}
.steps > li{
  counter-increment:step;
  display:grid;grid-template-columns:2.25rem minmax(0,1fr);gap:var(--s4);
  padding:var(--s5) 0;border-bottom:1px solid var(--rule-soft);
}
.steps > li::before{
  content:counter(step);
  font-family:var(--sans);font-variant-numeric:tabular-nums;
  font-size:var(--t-h3);font-weight:600;color:var(--accent);line-height:1.25;
}
.steps h3{font-family:var(--sans);font-size:var(--t-h4);margin:0 0 var(--s2)}
.steps p{font-size:var(--t-small);color:var(--ink-2);line-height:1.65;margin:0;max-width:66ch}
.steps p+p{margin-top:var(--s2)}
.steps .tip{margin-top:var(--s3);border-left:2px solid var(--accent-dim);padding-left:var(--s3);font-size:var(--t-meta);color:var(--ink-2);line-height:1.6;max-width:62ch}

/* The three layers of the dashboard, which is the one thing a reader has
   to hold in their head before anything else makes sense. */
.layers{margin-top:var(--s4);border:1px solid var(--rule);border-radius:var(--r3);overflow:hidden}
.layers > p{padding:var(--s4);font-size:var(--t-small);color:var(--ink-2);line-height:1.6;margin:0}
.layers > p+p{border-top:1px solid var(--rule-soft)}
.layers b,.layers strong{color:var(--ink);font-weight:600}

.legend{display:flex;gap:var(--s5);flex-wrap:wrap;margin-top:var(--s4);font-size:var(--t-small);color:var(--ink-2)}
.legend span{display:inline-flex;align-items:center;gap:7px}
.legend span::before{content:"";width:9px;height:9px;border-radius:50%;flex-shrink:0}
.legend .g::before{background:var(--mitigating)}
.legend .a::before{background:var(--warning)}
.legend .r::before{background:var(--adverse)}
.legend .c::before{background:var(--accent)}

.specimen{margin-top:var(--s4);background:var(--sunken);border:1px solid var(--rule);border-radius:var(--r3);padding:var(--s5);overflow-x:auto}
.specimen > div + div{margin-top:var(--s4);padding-top:var(--s4);border-top:1px solid var(--rule)}

.caveat{margin-top:var(--s4);border-left:2px solid var(--warning);padding:var(--s2) 0 var(--s2) var(--s4);font-size:var(--t-small);color:var(--ink-2);line-height:1.7;max-width:76ch}
.caveat b,.caveat strong{color:var(--ink)}

.on-this-page{position:sticky;top:76px;max-height:calc(100vh - 104px);overflow:auto}
.on-this-page p{font-size:var(--t-meta);font-weight:600;color:var(--ink-3);margin:0 0 var(--s2);padding-left:var(--s3)}
.on-this-page ul{list-style:none;margin:0;padding:0;border-left:1px solid var(--rule)}
.on-this-page a{display:block;padding:4px var(--s3);margin-left:-1px;border-left:2px solid transparent;color:var(--ink-3);font-size:var(--t-meta);line-height:1.4}
.on-this-page a:hover{color:var(--ink);text-decoration:none}

.langbar{display:flex;gap:2px;padding:2px;background:var(--sunken);border:1px solid var(--control);border-radius:var(--r2)}
.langbar button{min-height:26px;padding:0 9px;border:0;border-radius:var(--r1);background:transparent;color:var(--ink-2);font-size:var(--t-meta);cursor:pointer}
.langbar button:hover{color:var(--ink)}
.langbar button[aria-pressed="true"]{background:var(--accent);color:var(--on-accent);font-weight:600}

@media(max-width:1000px){.guide{grid-template-columns:minmax(0,1fr)}.on-this-page{display:none}}
@media(max-width:640px){.langbar button{min-height:40px}.steps > li{grid-template-columns:1.75rem minmax(0,1fr);gap:var(--s3)}}
`;

const Html = ({ tag: Tag = 'span', html, ...rest }) => <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;

const LANG_NAMES = { en: 'English', zh: '简体中文 — Simplified Chinese', tw: '繁體中文 — Traditional Chinese', ja: '日本語 — Japanese' };

function Step({ titleKey, tipKey, bodyKey, t }) {
  return (
    <li>
      <div>
        <h3>{t(titleKey)}</h3>
        <Html tag="p" html={t(bodyKey)} />
        {tipKey && <p className="tip">{t(tipKey)}</p>}
      </div>
    </li>
  );
}

export default function Intro() {
  const [lang, setLang] = useState('en');
  const t = (key) => T[key][lang] ?? T[key].en;

  const SECTIONS = [
    ['what', t('h2_1')],
    ['reading', t('h2_2')],
    ['steps', t('h2_3')],
    ['maths', t('h2_4')],
    ['limits', t('h2_5')],
  ];

  return (
    <>
      <style>{STYLE}</style>

      <header className="site-head">
        <div className="shell bar">
          <a className="brand" href="index.html" aria-label="SSCIM home"><img src="sscim-logo.png" alt="SSCIM" /></a>
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="index.html">SSCIM</a>
            <span className="sep" aria-hidden="true">/</span>
            <span className="here" aria-current="page">Guide</span>
          </nav>
          <nav className="site-nav" aria-label="Site">
            <div className="langbar" role="group" aria-label="Language">
              {Object.entries(LANG_LABELS).map(([l, label]) => (
                <button key={l} type="button" aria-pressed={lang === l}
                  aria-label={LANG_NAMES[l] || label} onClick={() => setLang(l)}>
                  {label}
                </button>
              ))}
            </div>
            <a href="docs.html">Documentation</a>
            <a href="updates.html">Updates</a>
            <ThemeToggle />
            <a className="btn btn-primary btn-sm" href="sscim-app.html">{t('launchDashboard')}</a>
          </nav>
        </div>
      </header>

      <NewsTicker />

      <div className="guide">
        <main>
          <div className="lead-in">
            <Html tag="h1" html={t('h1')} />
            <p className="lede">{t('currentLede')}</p>
          </div>

          <div className="prose">
            <h2 id="what">{t('h2_1')}</h2>
            <p>{t('s1p1')}</p>
            <p>{t('s1p2')}</p>
            <div className="layers">
              <Html tag="p" html={t('layer1')} />
              <Html tag="p" html={t('layer2')} />
              <Html tag="p" html={t('layer3')} />
            </div>
            <div className="layers" style={{ marginTop: 'var(--s3)' }}>
              <Html tag="p" html={t('netCard')} />
            </div>
            <p>{t('s1Under')}</p>

            <h2 id="reading">{t('h2_2')}</h2>
            <div className="legend">
              <span className="g">{t('legendG')}</span>
              <span className="a">{t('legendA')}</span>
              <span className="r">{t('legendR')}</span>
              <span className="c">{t('legendC')}</span>
            </div>
            <Html tag="p" html={t('s2Body')} />

            <h2 id="steps">{t('h2_3')}</h2>
          </div>

          <ol className="steps bare">
            <Step titleKey="step1" tipKey="tip1" bodyKey="step1Body" t={t} />
            <Step titleKey="step2" bodyKey="step2Body" t={t} />
            <Step titleKey="step3" tipKey="tip3" bodyKey="step3Body" t={t} />
            <Step titleKey="step4" bodyKey="step4Body" t={t} />
            <Step titleKey="step5" bodyKey="step5Body" t={t} />
            <Step titleKey="step5b" bodyKey="step5bBody" t={t} />
            <Step titleKey="step6" bodyKey="step6Body" t={t} />
            <Step titleKey="step7" bodyKey="step7Body" t={t} />
          </ol>

          <div className="prose">
            <h2 id="maths">{t('h2_4')}</h2>
            <div className="specimen">
              <div><Tex tex={"\\text{struct}_s = w_{\\text{ni}}NI_s + w_{\\text{geo}}GEO_s + w_{\\text{pol}}POL_s + w_{\\nu}(10\\nu_s) + w_{\\text{mkt}}\\,\\text{mkt}_s"} block /></div>
              <div><Tex tex={"z_{e,s} = d_{e,s}\\,g(q_e)\\,\\alpha_{e,s}\\,R_e(t)"} block /></div>
              <div><Tex tex={"x^{d}_{b}=\\operatorname{clip}_{[0,1]}\\Big(z_b+\\textstyle\\sum_{a\\in IN(b)}D_{ba}x^{d}_{a}\\Big),\\qquad p_{s}=\\operatorname{clip}_{[-1,1]}\\big[z_s+(x^{d}_{s}-z_s)+(x^{u}_{s}-z_s)\\big]"} block /></div>
            </div>
            <Html tag="p" html={t('s4Body')} />

            <h2 id="limits">{t('h2_5')}</h2>
            <Html tag="div" className="caveat" html={t('currentDisclaimer')} />
          </div>

          <p style={{ marginTop: 'var(--s6)' }}>
            <a className="btn btn-primary" href="sscim-app.html">{t('launchDashboardBottom')}</a>
          </p>

          <p className="meta" style={{ marginTop: 'var(--s6)', paddingTop: 'var(--s4)', borderTop: '1px solid var(--rule)', maxWidth: '86ch', lineHeight: 1.7 }}>
            {t('currentFooter')}
          </p>
        </main>

        <nav className="on-this-page" aria-label="On this page">
          <p>On this page</p>
          <ul>
            {SECTIONS.map(([id, label]) => <li key={id}><a href={`#${id}`}>{label}</a></li>)}
          </ul>
        </nav>
      </div>

      <SiteMap current="intro" />
    </>
  );
}
