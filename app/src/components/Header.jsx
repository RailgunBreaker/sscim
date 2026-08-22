import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { useVault } from '../data/VaultContext.jsx';
import SearchBox from './SearchBox.jsx';
import Freshness from './Freshness.jsx';

export default function Header({
  lang, setLang, setSel, setShowGuide, setShowBriefing, tourTarget,
}) {
  const { data } = useVault();
  const { COMPANIES } = data;
  return (
    <header style={{ borderBottom: `1px solid ${C.line}`, padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <a href="index.html" title="Back to home" aria-label="SSCIM home" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}><img src="sscim-logo.png" alt="SSCIM" style={{ display: 'block', width: 96, height: 'auto', filter: 'grayscale(1) brightness(0) invert(1)' }} /></a>
          <span className="mono" style={{ color: C.copper, fontSize: 10, letterSpacing: 2 }}>v4 · OSM MAP · COMPANY SPREAD</span>
        </div>
        <div style={{ color: C.dim, fontSize: 11.5, marginTop: 2 }}>
          {lang === "en" ? "Semiconductor Supply Chain Intelligence Map" : t("fullname")} · 24 · {COMPANIES.length} · 16
          <span style={{ marginLeft: 8 }}><Freshness /></span>
        </div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span className="mono" style={{ display: "flex", gap: 2 }}>
          {[["en", "EN"], ["zh", "简"], ["tw", "繁"], ["ja", "日"]].map(([l, label]) => (
            <button key={l} onClick={() => setLang(l)}
              style={{ background: lang === l ? C.copper : "transparent", color: lang === l ? "#0C111C" : C.faint, border: `1px solid ${lang === l ? C.copper : C.line}`, borderRadius: 3, padding: "3px 7px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              {label}
            </button>
          ))}
        </span>
        <SearchBox setSel={setSel} />
        {/* The scenario picker and the "Build scenario" button used to sit
            here. Both are gone: the dashboard reads live, reviews the past,
            and states exactly one hypothesis — a hazard placed on the map,
            which lives with the map rather than in the chrome. */}
        <button onClick={() => setShowGuide(true)}
          style={{ background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
          {t("? Guide")}
        </button>
        <button id="btn-briefing" onClick={() => setShowBriefing(true)}
          className={tourTarget === "btn-briefing" ? "tour-target" : undefined}
          style={{ background: C.copper, color: "#0C111C", border: `1px solid ${C.copper}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
          {t("⚡ GP Briefing")}
        </button>
        <a id="btn-methodology" href="docs/METHODOLOGY.md.html"
          className={tourTarget === "btn-methodology" ? "tour-target" : undefined}
          style={{ background: "transparent", color: C.copper, border: `1px dashed ${C.copperDim}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "none" }}>
          {t("Documentation")}
        </a>
      </div>
    </header>
  );
}
