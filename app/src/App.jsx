import { useState, useEffect, useMemo } from 'react';
import { C } from './theme.js';
import { t, setLangV } from './i18n/index.js';
import { VaultProvider, useVault } from './data/VaultContext.jsx';
import { buildModel } from './engine/buildModel.js';

import Header from './components/Header.jsx';
import ScenarioBar from './components/ScenarioBar.jsx';
import TabBar from './components/TabBar.jsx';
import Pane from './components/Pane.jsx';
import OsmMap from './components/OsmMap.jsx';
import FlowGraph from './components/FlowGraph.jsx';
import Intel from './components/Intel.jsx';
import Methodology from './components/Methodology.jsx';
import Guide from './components/Guide.jsx';
import Briefing from './components/Briefing.jsx';
import ScenarioBuilder from './components/ScenarioBuilder.jsx';

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 3px; }
  .node { cursor: pointer; transition: opacity .25s; }
  .evcard { cursor: pointer; transition: border-color .2s; }
  .evcard:hover { border-color: ${C.copper} !important; }
  button:focus-visible, .node:focus-visible { outline: 2px solid ${C.copper}; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none !important; } }
  @keyframes pulse { 0%,100% { opacity:.35 } 50% { opacity:.9 } }
  .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  .sscim-map { background: ${C.panel2}; }
  .sscim-map .osm-soft { filter: brightness(.75) invert(1) contrast(1.1) hue-rotate(200deg) saturate(.3); }
  .sscim-map .leaflet-control-attribution { background: rgba(12,17,28,.8); color: ${C.faint}; font-size: 9px; }
  .sscim-map .leaflet-control-attribution a { color: ${C.copperDim}; }
  .sscim-tip { background: ${C.panel} !important; color: ${C.text} !important; border: 1px solid ${C.line} !important; border-radius: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; padding: 2px 6px; box-shadow: none !important; }
  .sscim-tip::before { display: none; }
  .sscim-label { background: transparent !important; border: none !important; box-shadow: none !important; color: ${C.text}; font-family: 'Space Grotesk', sans-serif; font-size: 10.5px; font-weight: 600; text-shadow: 0 0 4px #000; white-space: nowrap; }
`;

export default function App() {
  return (
    <VaultProvider>
      <VaultGate />
    </VaultProvider>
  );
}

/* Renders a loading/error state until the vault (live API or static
   snapshot fallback) is ready, then mounts the real dashboard — all
   vault-dependent hooks live inside Dashboard so they only ever run
   once data actually exists. */
function VaultGate() {
  const { status, error } = useVault();
  if (status === 'error') {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', system-ui, sans-serif", padding: 24, textAlign: "center" }}>
        <style>{GLOBAL_STYLE}</style>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Can't load the SSCIM vault</div>
          <div className="mono" style={{ fontSize: 12, color: C.dim, maxWidth: 480 }}>{String(error?.message || error)}</div>
        </div>
      </div>
    );
  }
  if (status !== 'ready') {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.dim, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
        <style>{GLOBAL_STYLE}</style>
        <div className="mono">Loading SSCIM vault…</div>
      </div>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const { data, engine, source } = useVault();
  const { EVENTS, SCENARIOS, COMPANY_BY_ID } = data;
  const { STAGE_BY_ID, OUT, COMPANY_CRITICALITY } = engine;

  const [sel, setSel] = useState({ type: "event", id: EVENTS[0]?.id });
  const [scenarioId, setScenarioId] = useState("none");
  const [tab, setTab] = useState("flow");
  const [feedTab, setFeedTab] = useState("events");
  const [wide, setWide] = useState(true);
  const [showMethod, setShowMethod] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [custom, setCustom] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [lang, setLang] = useState("en");
  setLangV(lang);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1080px)");
    const fn = () => setWide(mq.matches);
    fn(); mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const scenario = scenarioId === "custom" ? custom : SCENARIOS.find((s) => s.id === scenarioId);

  const model = useMemo(() => buildModel({ data, engine, scenario }), [scenarioId, custom]);

  const hl = useMemo(() => {
    const s = new Set(), c = new Set();
    if (sel.type === "event") {
      const e = EVENTS.find((x) => x.id === sel.id);
      e?.stages.forEach((x) => { s.add(x); (OUT[x] || []).forEach((d) => s.add(d)); });
      e?.countries.forEach((x) => c.add(x));
    } else if (sel.type === "stage") {
      s.add(sel.id);
      Object.keys(STAGE_BY_ID[sel.id]?.shares || {}).forEach((x) => c.add(x));
    } else if (sel.type === "country") {
      c.add(sel.id);
      Object.values(STAGE_BY_ID).forEach((st) => st.shares[sel.id] >= 0.1 && s.add(st.id));
    } else if (sel.type === "company") {
      const co = COMPANY_BY_ID[sel.id];
      c.add(co.country);
      Object.entries(COMPANY_CRITICALITY[sel.id].field).forEach(([sid, v]) => Math.abs(v) > 0.15 && s.add(sid));
    }
    return { s, c };
  }, [sel]);

  const whatChanged = !model.scenarioActive
    ? "Jul 03 (snapshot) — AI-chip export-control shock spread from NVIDIA / SK hynix / TSMC outward: highest company contribution now in packaging and systems tiers."
    : `SCENARIO ACTIVE — ${scenario.name}: ${scenario.desc} Company/country/stage figures below are recomputed through the same engine and ranked by their marginal delta vs. baseline.`;

  const panes = { map: t("Map"), flow: t("Flow"), intel: t("Intel") };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
      <style>{GLOBAL_STYLE}</style>

      <Header
        lang={lang} setLang={setLang} setSel={setSel}
        scenarioId={scenarioId} setScenarioId={setScenarioId} custom={custom}
        setShowBuilder={setShowBuilder} setShowGuide={setShowGuide}
        setShowBriefing={setShowBriefing} setShowMethod={setShowMethod}
      />

      <ScenarioBar model={model} whatChanged={whatChanged} />

      {showBuilder && <ScenarioBuilder onClose={() => setShowBuilder(false)} onRun={(sc) => { setCustom(sc); setScenarioId("custom"); setShowBuilder(false); }} />}

      {!wide && <TabBar panes={panes} tab={tab} setTab={setTab} />}

      {wide ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.9fr", gap: 1, background: C.line }}>
            <Pane title="LAYER 1 · WORLD MAP · OPENSTREETMAP"><OsmMap sel={sel} setSel={setSel} hl={hl} model={model} scenarioActive={model.scenarioActive} /></Pane>
            <Pane title="LAYER 2 · INDUSTRY FLOW · TAP A STAGE FOR ITS SUBSECTION"><FlowGraph sel={sel} setSel={setSel} hl={hl} model={model} scenarioActive={model.scenarioActive} /></Pane>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            <Pane title="LAYER 3 · INTELLIGENCE PANEL">
              <Intel sel={sel} setSel={setSel} model={model} scenarioActive={model.scenarioActive} feedTab={feedTab} setFeedTab={setFeedTab} horizontal />
            </Pane>
          </div>
        </>
      ) : (
        <>
          {tab === "map" && <Pane title="LAYER 1 · WORLD MAP · OPENSTREETMAP"><OsmMap sel={sel} setSel={setSel} hl={hl} model={model} scenarioActive={model.scenarioActive} /></Pane>}
          {tab === "flow" && <Pane title="LAYER 2 · INDUSTRY FLOW"><FlowGraph sel={sel} setSel={setSel} hl={hl} model={model} scenarioActive={model.scenarioActive} /></Pane>}
          {tab === "intel" && <Pane title="LAYER 3 · INTELLIGENCE PANEL"><Intel sel={sel} setSel={setSel} model={model} scenarioActive={model.scenarioActive} feedTab={feedTab} setFeedTab={setFeedTab} /></Pane>}
        </>
      )}

      {showMethod && <Methodology onClose={() => setShowMethod(false)} />}
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
      {showBriefing && <Briefing onClose={() => setShowBriefing(false)} model={model} scenario={scenario} />}

      <footer className="mono" style={{ padding: "10px 16px", fontSize: 10, color: C.faint, borderTop: `1px solid ${C.line}`, lineHeight: 1.6 }}>
        RESEARCH PROTOTYPE · A sensitivity/comparison tool over a frozen curated demonstration snapshot (as of {model.datasetAsOf}) — not a calibrated, causal, or probabilistic forecast, and not investment advice.
        Map data © OpenStreetMap contributors · model {model.modelVersion}.
        {source === 'static' && (
          <span style={{ color: C.amber }}> · STATIC SNAPSHOT — no vault API connected, showing a build-time data snapshot instead of the live backend.</span>
        )}
        {!model.graphValid && (
          <span style={{ color: C.red }}> · MODEL DIAGNOSTIC: the stage graph failed validation — see ⓘ Methodology.</span>
        )}
      </footer>
    </div>
  );
}
