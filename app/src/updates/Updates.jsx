import ThemeControl from '../components/ThemeControl.jsx';
import { useState } from 'react';
import { RELEASES, KIND_LABEL, KIND_COLOR } from '../data/releases.js';
import { T, LANG_LABELS } from './i18n.js';
import SiteMap from '../components/SiteMap.jsx';

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
   ==================================================================== */

const STYLE = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
  .mono{font-family:inherit;font-variant-numeric:tabular-nums}
  .wrap{max-width:880px;margin:0 auto;padding:0 20px}
  a{color:var(--copper);text-decoration:none}
  a:hover{text-decoration:underline}
  header{border-bottom:1px solid var(--line);padding:14px 0;position:sticky;top:0;background:var(--panel);backdrop-filter:blur(6px);z-index:10}
  header .wrap{display:flex;align-items:center;gap:12px;flex-wrap:wrap;max-width:980px}
  .logo{display:flex;align-items:center}.logo img{display:block;width:104px;height:auto;filter:grayscale(1) brightness(0) invert(1)}
  .tag{font-size:12px;letter-spacing:2px;color:var(--copper)}
  .btn{display:inline-block;border-radius:5px;padding:8px 16px;font-weight:700;font-size:13.5px;border:1px solid var(--copper);transition:transform .15s ease,box-shadow .15s ease}
  .btn.solid{background:var(--copper);color:var(--onAccent)}
  .btn:hover{background:var(--hover);text-decoration:none}
  .langbar b{cursor:pointer;border:1px solid var(--line);border-radius:3px;padding:2px 7px;font-size:12px;color:var(--faint);font-weight:700}
  .langbar b.on{background:var(--copper);color:var(--onAccent);border-color:var(--copper)}
  .hero{padding:46px 0 30px;border-bottom:1px solid var(--line)}
  .hero h1{font-size:clamp(26px,4.5vw,38px);line-height:1.15;margin-bottom:10px}
  .hero h1 em{color:var(--copper);font-style:normal}
  .lede{color:var(--dim);font-size:15.5px;max-width:660px}
  .note{border-left:3px solid var(--copperDim);background:var(--panel2);padding:9px 13px;font-size:12px;color:var(--dim);margin:18px 0 0;border-radius:0 5px 5px 0;max-width:660px}

  .timeline{position:relative;padding:34px 0 10px}
  .timeline::before{content:"";position:absolute;left:9px;top:0;bottom:0;width:1px;background:var(--line)}
  .rel{position:relative;padding:0 0 34px 40px}
  .rel::before{content:"";position:absolute;left:3px;top:6px;width:13px;height:13px;border-radius:50%;background:var(--bg);border:2px solid var(--copperDim)}
  .rel.first::before{border-color:var(--copper);box-shadow:0 0 0 4px rgba(201,138,63,.16)}
  .relhead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px}
  .date{font-size:12px;letter-spacing:1.2px;color:var(--copper)}
  .ver{font-size:12px;letter-spacing:1px;color:var(--faint);border:1px solid var(--line);border-radius:3px;padding:1px 6px}
  .newest{font-size:12px;letter-spacing:1.2px;color:var(--onAccent);background:var(--copper);border-radius:3px;padding:2px 7px;font-weight:700}
  .rel h2{font-size:19px;line-height:1.3;margin:2px 0 6px}
  .rel .relled{color:var(--dim);font-size:14px;margin-bottom:14px;max-width:640px}
  ul.changes{list-style:none;display:grid;gap:9px}
  ul.changes li{display:flex;gap:10px;align-items:flex-start;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 13px}
  .kind{flex-shrink:0;font-size:8.5px;letter-spacing:1.1px;font-weight:700;border-radius:3px;padding:2px 6px;margin-top:2px;min-width:62px;text-align:center}
  .changes p{font-size:13px;color:var(--dim);line-height:1.6}
  .limits{margin-top:12px;border:1px solid var(--copperDim);background:rgba(223,168,61,.055);border-radius:6px;padding:11px 14px;font-size:12.5px;color:var(--amber);line-height:1.65}
  .limits b{display:block;font-size:9px;letter-spacing:1.6px;margin-bottom:4px}
  @media (max-width:640px){header .wrap{gap:8px}.rel{padding-left:30px}.timeline::before{left:6px}.rel::before{left:0}ul.changes li{flex-direction:column;gap:5px}.kind{min-width:0;align-self:flex-start}}
`;

export default function Updates() {
  const [lang, setLang] = useState('en');
  const t = (key) => T[key][lang] ?? T[key].en;

  return (
    <>
      <style>{STYLE}</style>

      <header>
        <div className="wrap">
          <a className="logo" href="index.html" aria-label="SSCIM home"><img src="sscim-logo.png" alt="SSCIM" /></a>
          <span className="tag mono">{t('tag')}</span>
          <ThemeControl />
          <span className="langbar mono" style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            {Object.entries(LANG_LABELS).map(([l, label]) => (
              <b key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{label}</b>
            ))}
          </span>
          <a href="intro.html" style={{ fontSize: 13 }}>{t('navGuide')}</a>
          <a href="docs.html" style={{ fontSize: 13 }}>{t('navDocs')}</a>
          <a className="btn solid" href="sscim-app.html">{t('navDashboard')}</a>
        </div>
      </header>

      <div className="hero">
        <div className="wrap">
          <h1>{t('h1a')} <em>{t('h1b')}</em></h1>
          <p className="lede">{t('lede')}</p>
          <div className="note">{t('noteEnglish')}</div>
        </div>
      </div>

      <div className="wrap">
        <div className="timeline">
          {RELEASES.map((rel, i) => (
            <article key={rel.id} id={rel.id} className={`rel${i === 0 ? ' first' : ''}`}>
              <div className="relhead">
                <time className="date mono" dateTime={rel.date}>{rel.date}</time>
                <span className="ver mono">{rel.version}</span>
                {i === 0 && <span className="newest mono">{t('newest')}</span>}
              </div>
              <h2>{rel.title}</h2>
              <p className="relled">{rel.lede}</p>

              <ul className="changes">
                {rel.changes.map((ch) => (
                  <li key={ch.text}>
                    <span className="kind mono" style={{
                      color: KIND_COLOR[ch.kind],
                      border: `1px solid ${KIND_COLOR[ch.kind]}`,
                    }}>
                      {KIND_LABEL[ch.kind]}
                    </span>
                    <p>{ch.text}</p>
                  </li>
                ))}
              </ul>

              {rel.limits && (
                <div className="limits">
                  <b className="mono">{t('limitsLabel')}</b>
                  {rel.limits}
                </div>
              )}
            </article>
          ))}
        </div>

        <p style={{ color: 'var(--faint)', fontSize: 12, paddingBottom: 6 }}>
          {t('sourceNote')}{' '}
          <a href="docs/MODEL_ROADMAP.md.html">{t('roadmapLink')}</a>.
        </p>
      </div>

      <SiteMap current="updates" />
    </>
  );
}
