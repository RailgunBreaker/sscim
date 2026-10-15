import { useState } from 'react';
import { RELEASES, KIND_LABEL, KIND_COLOR } from '../data/releases.js';
import { T, LANG_LABELS } from './i18n.js';
import SiteMap from '../components/SiteMap.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { BASE_CSS, FOOT_CSS } from '../ui/css.js';

/* ====================================================================
   Updates — the public changelog.

   Every date on this page is the date the work actually landed in the
   repository, and every entry says what was built rather than what it
   means. Release notes are the easiest place in a project to start
   overclaiming, so each release also carries a "still doesn't know"
   block: a reader who only ever reads this page should come away with an
   accurate sense of what the tool can and cannot do.

   The page chrome is translated; the release entries themselves are kept
   in English and labelled as such. Machine-translating technical release
   notes into three languages would produce three subtly different
   accounts of what the model does, which is precisely the kind of drift
   this project spends its effort avoiding.

   ON THE PRESENTATION. Each change used to be a bordered card with a
   coloured, letter-spaced, 8.5px all-caps pill welded to its left edge —
   a hundred boxes and a hundred pills down one page. The kind is now a
   word in a fixed column with a small dot beside it, and the changes
   share one set of hairline rules. The timeline rail stays, because a
   changelog is a sequence and the rail is the one piece of decoration
   here that says so.
   ==================================================================== */

const STYLE = `
${BASE_CSS}
${FOOT_CSS}

.lead-in{padding:var(--s7) 0 var(--s5);border-bottom:1px solid var(--rule)}
.lead-in h1{font-size:clamp(28px,3.4vw,40px);line-height:1.1;letter-spacing:-.022em}
.lead-in h1 em{font-style:normal;color:var(--accent)}
.lead-in .lede{margin-top:var(--s4);max-width:58ch}

.timeline{position:relative;padding:var(--s6) 0 var(--s5);max-width:860px}
.timeline::before{content:"";position:absolute;left:5px;top:0;bottom:var(--s6);width:1px;background:var(--rule)}

.rel{position:relative;padding:0 0 var(--s7) var(--s6)}
.rel::before{
  content:"";position:absolute;left:0;top:7px;width:11px;height:11px;border-radius:50%;
  background:var(--page);border:2px solid var(--control);
}
.rel.first::before{border-color:var(--accent);background:var(--accent)}
.relhead{display:flex;align-items:baseline;gap:var(--s3);flex-wrap:wrap}
.relhead time{font-size:var(--t-meta);color:var(--ink-3);font-variant-numeric:tabular-nums}
.relhead .ver{font-family:var(--mono);font-size:var(--t-meta);color:var(--ink-3)}
.relhead .newest{font-size:var(--t-meta);color:var(--accent);font-weight:600}
.rel h2{font-size:var(--t-h2);line-height:1.22;margin:var(--s2) 0 var(--s3);max-width:34ch}
.rel .relled{font-size:var(--t-body);color:var(--ink-2);line-height:1.6;max-width:66ch;margin-bottom:var(--s4)}

.changes{list-style:none;margin:0;padding:0;border-top:1px solid var(--rule)}
.changes > li{
  display:grid;grid-template-columns:7.5rem minmax(0,1fr);gap:var(--s2) var(--s4);
  padding:var(--s3) 0;border-bottom:1px solid var(--rule-soft);align-items:baseline;
}
.changes .kind{display:inline-flex;align-items:center;gap:7px;font-size:var(--t-meta);color:var(--ink-3)}
.changes .kind i{width:6px;height:6px;border-radius:50%;flex-shrink:0;display:inline-block}
.changes p{font-size:var(--t-small);color:var(--ink-2);line-height:1.6;margin:0}

.limits{margin-top:var(--s4);border-left:2px solid var(--warning);padding:var(--s2) 0 var(--s2) var(--s4);max-width:72ch}
.limits b{display:block;font-size:var(--t-meta);color:var(--ink-3);margin-bottom:3px;font-weight:600}
.limits{font-size:var(--t-small);color:var(--ink-2);line-height:1.65}

.langbar{display:flex;gap:2px;padding:2px;background:var(--sunken);border:1px solid var(--control);border-radius:var(--r2)}
.langbar button{min-height:26px;padding:0 9px;border:0;border-radius:var(--r1);background:transparent;color:var(--ink-2);font-size:var(--t-meta);cursor:pointer}
.langbar button:hover{color:var(--ink)}
.langbar button[aria-pressed="true"]{background:var(--accent);color:var(--on-accent);font-weight:600}

@media(max-width:640px){
  .langbar button{min-height:40px}
  .rel{padding-left:var(--s5)}
  .changes > li{grid-template-columns:minmax(0,1fr);gap:var(--s1)}
}
`;

const LANG_NAMES = { en: 'English', zh: '简体中文 — Simplified Chinese', tw: '繁體中文 — Traditional Chinese', ja: '日本語 — Japanese' };

export default function Updates() {
  const [lang, setLang] = useState('en');
  const t = (key) => T[key][lang] ?? T[key].en;

  return (
    <>
      <style>{STYLE}</style>

      <header className="site-head">
        <div className="shell bar">
          <a className="brand" href="index.html" aria-label="SSCIM home"><img src="sscim-logo.png" alt="SSCIM" /></a>
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="index.html">SSCIM</a>
            <span className="sep" aria-hidden="true">/</span>
            <span className="here" aria-current="page">Updates</span>
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
            <a href="intro.html">{t('navGuide')}</a>
            <a href="docs.html">{t('navDocs')}</a>
            <ThemeToggle />
            <a className="btn btn-primary btn-sm" href="sscim-app.html">{t('navDashboard')}</a>
          </nav>
        </div>
      </header>

      <div className="lead-in">
        <div className="shell">
          <h1>{t('h1a')} <em>{t('h1b')}</em></h1>
          <p className="lede">{t('lede')}</p>
          <p className="note" style={{ marginTop: 'var(--s4)', maxWidth: '66ch' }}>{t('noteEnglish')}</p>
        </div>
      </div>

      <div className="shell">
        <div className="timeline">
          {RELEASES.map((rel, i) => (
            <article key={rel.id} id={rel.id} className={`rel${i === 0 ? ' first' : ''}`}>
              <div className="relhead">
                <time dateTime={rel.date}>{rel.date}</time>
                <span className="ver">{rel.version}</span>
                {i === 0 && <span className="newest">{t('newest')}</span>}
              </div>
              <h2>{rel.title}</h2>
              <p className="relled">{rel.lede}</p>

              <ul className="changes">
                {rel.changes.map((ch) => (
                  <li key={ch.text}>
                    {/* The word carries the meaning; the dot only helps the
                        eye group them. Nobody has to tell the colours
                        apart to read this page. */}
                    <span className="kind">
                      <i aria-hidden="true" style={{ background: KIND_COLOR[ch.kind] }} />
                      {KIND_LABEL[ch.kind]}
                    </span>
                    <p>{ch.text}</p>
                  </li>
                ))}
              </ul>

              {rel.limits && (
                <p className="limits">
                  <b>{t('limitsLabel')}</b>
                  {rel.limits}
                </p>
              )}
            </article>
          ))}
        </div>

        <p className="meta" style={{ paddingBottom: 'var(--s5)' }}>
          {t('sourceNote')}{' '}
          <a href="docs/MODEL_ROADMAP.md.html">{t('roadmapLink')}</a>.
        </p>
      </div>

      <SiteMap current="updates" />
    </>
  );
}
