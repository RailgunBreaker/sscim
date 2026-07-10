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
  header .wrap{display:flex;align-items:center;gap:12px;flex-wrap:wrap;max-width:980px}
  .logo{font-weight:700;font-size:19px;letter-spacing:1px}
  .badge{font-size:9px;letter-spacing:1.5px;color:var(--amber);border:1px solid var(--amber);border-radius:3px;padding:2px 7px;font-family:'IBM Plex Mono',monospace;white-space:nowrap}
  .btn{display:inline-block;border-radius:5px;padding:8px 16px;font-weight:700;font-size:13.5px;border:1px solid var(--copper);transition:transform .15s ease,box-shadow .15s ease}
  .btn.solid{background:var(--copper);color:#0C111C}
  .btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(201,138,63,.22)}
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
  .formula{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;font-size:11.5px;overflow-x:auto;margin:10px 0}
  .formula > div + div{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)}
  .langbar b{cursor:pointer;border:1px solid var(--line);border-radius:3px;padding:2px 7px;font-size:10px;color:var(--faint);font-weight:700;transition:background .15s ease,color .15s ease}
  .langbar b.on{background:var(--copper);color:#0C111C;border-color:var(--copper)}
  .disclaimer{border:1px solid var(--copperDim);background:rgba(223,168,61,.06);border-radius:6px;padding:12px 14px;color:var(--amber);font-size:11.5px;line-height:1.7;margin:14px 0}
  footer{margin-top:56px;padding:24px 0;border-top:1px solid var(--line);font-size:10.5px;color:var(--faint);line-height:1.7}
  @media (max-width:640px){ header .wrap{gap:8px} .badge{display:none} }
`;

const Html = ({ tag: Tag = 'span', html, ...rest }) => <Tag {...rest} dangerouslySetInnerHTML={{ __html: html }} />;

function Step({ n, titleKey, tipKey, bodyKey, t }) {
  return (
    <div className="step">
      <div className="n">{n}</div>
      <div>
        <h3>{t(titleKey)}</h3>
        <Html tag="p" html={t(bodyKey)} />
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
          <span className="badge">RESEARCH PROTOTYPE</span>
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
        <p>{t('s1p1')}</p>
        <p>{t('s1p2')}</p>
        <div className="card">
          <Html tag="p" html={t('layer1')} />
          <Html tag="p" html={t('layer2')} />
          <Html tag="p" html={t('layer3')} />
        </div>
        <p>{t('s1Under')}</p>

        <h2>{t('h2_2')}</h2>
        <div className="legend">
          <span className="g">{t('legendG')}</span>
          <span className="a">{t('legendA')}</span>
          <span className="r">{t('legendR')}</span>
          <span className="c">{t('legendC')}</span>
        </div>
        <Html tag="p" html={t('s2Body')} />

        <h2>{t('h2_3')}</h2>

        <Step n="1" titleKey="step1" tipKey="tip1" bodyKey="step1Body" t={t} />
        <Step n="2" titleKey="step2" bodyKey="step2Body" t={t} />
        <Step n="3" titleKey="step3" tipKey="tip3" bodyKey="step3Body" t={t} />
        <Step n="4" titleKey="step4" bodyKey="step4Body" t={t} />
        <Step n="5" titleKey="step5" bodyKey="step5Body" t={t} />
        <Step n="6" titleKey="step6" bodyKey="step6Body" t={t} />
        <Step n="7" titleKey="step7" bodyKey="step7Body" t={t} />

        <h2>{t('h2_4')}</h2>
        <div className="formula mono">
          <div><Tex tex={"\\text{struct}_n = w_{\\text{ni}}\\,NI_n + w_{\\text{geo}}\\,GEO_n + w_{\\text{pol}}\\,POL_n + w_{\\text{subst}}\\,\\text{subst}_n + w_{\\text{mkt}}\\,\\text{mkt}_n"} block /></div>
          <div><Tex tex={"\\text{decay}(\\text{age},H)=2^{-\\text{age}/H},\\ H{=}12\\text{d}"} block /></div>
          <div><Tex tex={"\\text{vulnerability}_c=10\\cdot\\overline{\\max(0,\\text{field})},\\qquad \\text{contribution}_c=\\textstyle\\sum_s \\text{share}_{c,s}\\cdot\\max(0,\\text{field}_s)\\cdot EW_s"} block /></div>
        </div>
        <Html tag="p" html={t('s4Body')} />

        <h2>{t('h2_5')}</h2>
        <div className="disclaimer">
          <Html tag="span" html={t('s5Body')} />
        </div>

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
