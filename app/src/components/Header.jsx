import { C } from '../theme.js';
import { t } from '../i18n/index.js';
import { useVault } from '../data/VaultContext.jsx';
import SearchBox from './SearchBox.jsx';

export default function Header({
  lang, setLang, setSel, scenarioId, setScenarioId, custom,
  setShowBuilder, setShowGuide, setShowBriefing, setShowMethod,
}) {
  const { data } = useVault();
  const { COMPANIES, SCENARIOS } = data;
  return (
    <header style={{ borderBottom: `1px solid ${C.line}`, padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <a href="index.html" title="Back to home" style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1, color: C.text, textDecoration: "none" }}>SSCIM</a>
          <span className="mono" style={{ color: C.copper, fontSize: 10, letterSpacing: 2 }}>v4 · OSM MAP · COMPANY SPREAD</span>
        </div>
        <div style={{ color: C.dim, fontSize: 11.5, marginTop: 2 }}>
          {lang === "en" ? "Semiconductor Supply Chain Intelligence Map" : t("fullname")} · 24 · {COMPANIES.length} · 16
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
        {SCENARIOS.map((sc) => (
          <button key={sc.id} onClick={() => setScenarioId(sc.id)}
            style={{ background: scenarioId === sc.id ? C.copper : "transparent", color: scenarioId === sc.id ? "#0C111C" : C.dim,
              border: `1px solid ${scenarioId === sc.id ? C.copper : C.line}`, borderRadius: 4, padding: "5px 9px",
              fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", fontWeight: scenarioId === sc.id ? 700 : 400 }}>
            {lang === "en" ? sc.name : t("scn_" + sc.id)}
          </button>
        ))}
        <button onClick={() => (scenarioId === "custom" && custom ? setScenarioId("custom") : setShowBuilder(true))}
          onDoubleClick={() => setShowBuilder(true)}
          style={{ background: scenarioId === "custom" ? C.copper : "transparent", color: scenarioId === "custom" ? "#0C111C" : C.dim,
            border: `1px dashed ${scenarioId === "custom" ? C.copper : C.copperDim}`, borderRadius: 4, padding: "5px 9px",
            fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", fontWeight: scenarioId === "custom" ? 700 : 400 }}>
          {custom ? "✦ " + custom.name : t("✦ Build scenario")}
        </button>
        <button onClick={() => setShowGuide(true)}
          style={{ background: "transparent", color: C.dim, border: `1px solid ${C.line}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
          {t("? Guide")}
        </button>
        <button onClick={() => setShowBriefing(true)}
          style={{ background: C.copper, color: "#0C111C", border: `1px solid ${C.copper}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
          {t("⚡ GP Briefing")}
        </button>
        <button onClick={() => setShowMethod(true)}
          style={{ background: "transparent", color: C.copper, border: `1px dashed ${C.copperDim}`, borderRadius: 4, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
          {t("ⓘ Methodology")}
        </button>
      </div>
    </header>
  );
}
