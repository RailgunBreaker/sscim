import { useLanguage } from '../i18n/useLanguage.js';
import { t as ui } from '../i18n/index.js';
import LanguagePicker from '../components/LanguagePicker.jsx';
import ThemeControl from '../components/ThemeControl.jsx';
import { T, LANG_LABELS } from './i18n.js';
import Tex from '../components/Tex.jsx';
import NewsTicker from '../components/NewsTicker.jsx';
import SiteMap from '../components/SiteMap.jsx';

const STYLE = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
  .mono{font-family:inherit;font-variant-numeric:tabular-nums}
  .wrap{max-width:820px;margin:0 auto;padding:0 20px}
  a{color:var(--copper);text-decoration:none}
  header{border-bottom:1px solid var(--line);padding:14px 0;position:sticky;top:0;background:var(--panel);backdrop-filter:blur(6px);z-index:10}
  header .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;max-width:980px}
  .header-brand,.header-actions{display:flex;align-items:center;gap:10px;min-width:0}.header-actions{margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
  .logo{display:flex;align-items:center}.logo img{display:block;width:104px;height:auto;filter:grayscale(1) brightness(0) invert(1)}
  .badge{font-size:12px;letter-spacing:1.2px;color:var(--amber);border:1px solid var(--amber);border-radius:3px;padding:2px 7px;font-family:inherit;font-weight:600;white-space:nowrap}
  .btn{display:inline-block;border-radius:5px;padding:8px 16px;font-weight:700;font-size:13.5px;border:1px solid var(--copper);transition:transform .15s ease,box-shadow .15s ease}
  .btn.solid{background:var(--copper);color:var(--onAccent)}
  .btn:hover{background:var(--hover)}
  .intro-hero{position:relative;overflow:hidden;padding:52px 0 34px}.intro-hero::before{display:none}.intro-hero>*{position:relative}.signal{display:none}.signal i{width:5px;background:var(--copper);border-radius:8px;opacity:.75;animation:signal 1.6s ease-in-out infinite}.signal i:nth-child(2){height:70%;animation-delay:.15s}.signal i:nth-child(3){height:42%;animation-delay:.3s}.signal i:nth-child(4){height:100%;animation-delay:.45s}.signal i:nth-child(5){height:56%;animation-delay:.6s}.signal i:nth-child(6){height:80%;animation-delay:.75s}@keyframes signal{0%,100%{transform:scaleY(.45);opacity:.3}50%{transform:scaleY(1);opacity:1}}@keyframes orbit{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.intro-hero::before,.signal i{animation:none}}
  h1{font-size:clamp(26px,4.5vw,38px);line-height:1.15;margin:48px 0 10px}
  h1 em{color:var(--copper);font-style:normal}
  .lede{color:var(--dim);font-size:16px;max-width:640px;margin-bottom:8px}
  h2{font-size:21px;margin:44px 0 12px;padding-top:20px;border-top:1px solid var(--line)}
  h3{font-size:15px;margin:18px 0 4px}
  p{color:var(--dim);font-size:14px;margin-bottom:10px}
  p strong{color:var(--text)}
  .k{font-size:12px;letter-spacing:2px;color:var(--copper)}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin:14px 0}
  .step{display:flex;gap:12px;margin:16px 0}
  .step .n{flex-shrink:0;width:26px;height:26px;border-radius:5px;background:var(--copper);color:var(--onAccent);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:13px;font-family:inherit}
  .step h3{margin:0 0 3px}
  .step p{margin-bottom:4px}
  .tip{border-left:3px solid var(--copper);background:var(--panel2);padding:8px 12px;font-size:12.5px;color:var(--dim);margin:8px 0;border-radius:0 5px 5px 0}
  .legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:var(--dim);margin:10px 0}
  .legend span::before{content:"●";margin-right:5px}
  .g::before{color:var(--green)} .a::before{color:var(--amber)} .r::before{color:var(--red)} .c::before{color:var(--copper)}
  .formula{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;font-size:12px;overflow-x:auto;margin:10px 0}
  .formula > div + div{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)}
  .langbar b{cursor:pointer;border:1px solid var(--line);border-radius:3px;padding:2px 7px;font-size:12px;color:var(--faint);font-weight:700;transition:background .15s ease,color .15s ease}
  .langbar b.on{background:var(--copper);color:var(--onAccent);border-color:var(--copper)}
  .disclaimer{border:1px solid var(--copperDim);background:rgba(223,168,61,.06);border-radius:6px;padding:12px 14px;color:var(--amber);font-size:12px;line-height:1.7;margin:14px 0}
  footer{margin-top:56px;padding:24px 0;border-top:1px solid var(--line);font-size:12px;color:var(--faint);line-height:1.7}
  @media (max-width:700px){header .wrap{gap:8px}.header-actions{width:100%;margin-left:0}.badge{display:none}}@media (max-width:440px){.header-actions{gap:7px}.header-actions a{font-size:12px}.header-actions .btn{padding:7px 10px}.langbar b{padding:2px 5px}}
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
  const [lang] = useLanguage();
  const t = (key) => T[key][lang] ?? T[key].en;

  return (
    <>
      <style>{STYLE}</style>

      <header>
        <div className="wrap">
          <div className="header-brand">
            <a className="logo" href="index.html" aria-label="SSCIM home"><img src="sscim-logo.png" alt="SSCIM" /></a>
            <span className="k mono">INTRODUCTION & USER GUIDE</span>
            <span className="badge">SSCIM INTELLIGENCE</span>
          </div>
          <div className="header-actions">
            <ThemeControl />
            <LanguagePicker />
            <a href="index.html">{t('navHome')}</a>
            <a href="docs.html">Docs</a>
            <a className="btn solid" href="sscim-app.html">{t('launchDashboard')}</a>
          </div>
        </div>
      </header>

      <NewsTicker />

      <div className="wrap intro-hero">
        <Html tag="h1" html={t('h1')} />
        <p className="lede">{t('currentLede')}</p>
        <div className="signal" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>

        <h2>{t('h2_1')}</h2>
        <p>{t('s1p1')}</p>
        <p>{t('s1p2')}</p>
        <div className="card">
          <Html tag="p" html={t('layer1')} />
          <Html tag="p" html={t('layer2')} />
          <Html tag="p" html={t('layer3')} />
        </div>
        <div className="card">
          <Html tag="p" html={t('netCard')} />
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
        <Step n="6" titleKey="step5b" bodyKey="step5bBody" t={t} />
        <Step n="7" titleKey="step6" bodyKey="step6Body" t={t} />
        <Step n="8" titleKey="step7" bodyKey="step7Body" t={t} />

        <h2>{t('h2_4')}</h2>
        <div className="formula mono">
          <div><Tex tex={"\\text{struct}_s = w_{\\text{ni}}NI_s + w_{\\text{geo}}GEO_s + w_{\\text{pol}}POL_s + w_{\\nu}(10\\nu_s) + w_{\\text{mkt}}\\,\\text{mkt}_s"} block /></div>
          <div><Tex tex={"z_{e,s} = d_{e,s}\\,g(q_e)\\,\\alpha_{e,s}\\,R_e(t)"} block /></div>
          <div><Tex tex={"x^{d}_{b}=\\operatorname{clip}_{[0,1]}\\Big(z_b+\\textstyle\\sum_{a\\in IN(b)}D_{ba}x^{d}_{a}\\Big),\\qquad p_{s}=\\operatorname{clip}_{[-1,1]}\\big[z_s+(x^{d}_{s}-z_s)+(x^{u}_{s}-z_s)\\big]"} block /></div>
        </div>
        <Html tag="p" html={t('s4Body')} />

        <h2>{t('h2_5')}</h2>
        <div className="disclaimer">
          <Html tag="span" html={t('currentDisclaimer')} />
        </div>

        <p style={{ marginTop: 28 }}><a className="btn solid" href="sscim-app.html">{t('launchDashboardBottom')}</a></p>
      </div>

      <footer>
        <div className="wrap">
          <p>{t('currentFooter')}</p>
        </div>
      </footer>

      <SiteMap current="intro" />
    </>
  );
}
