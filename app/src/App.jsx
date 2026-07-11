import { useState, useEffect, useMemo, useRef } from 'react';
import { C } from './theme.js';
import { t, setLangV } from './i18n/index.js';
import { VaultProvider, useVault } from './data/VaultContext.jsx';
import { buildModel } from './engine/buildModel.js';
import { InteractionProvider, useInteraction } from './interaction/InteractionContext.jsx';
import { frameFromTrace } from './interaction/playback.js';
import { encodeInteractionState, decodeInteractionState } from './interaction/urlState.js';
import { draftToScenario } from './interaction/scenarioDraft.js';

import Header from './components/Header.jsx';
import ScenarioBar from './components/ScenarioBar.jsx';
import LensBar from './components/LensBar.jsx';
import PlaybackBar from './components/PlaybackBar.jsx';
import ScenarioComposer from './components/ScenarioComposer.jsx';
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
  .pulse { animation: pulse 1.4s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none !important; } }
  @keyframes pulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }
  .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
  .sscim-map { background: ${C.panel2}; }
  .sscim-map .osm-soft { filter: brightness(.75) invert(1) contrast(1.1) hue-rotate(200deg) saturate(.3); }
  .sscim-map .leaflet-control-attribution { background: rgba(12,17,28,.8); color: ${C.faint}; font-size: 9px; }
  .sscim-map .leaflet-control-attribution a { color: ${C.copperDim}; }
  .sscim-tip { background: ${C.panel} !important; color: ${C.text} !important; border: 1px solid ${C.line} !important; border-radius: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 10px; padding: 2px 6px; box-shadow: none !important; }
  .sscim-tip::before { display: none; }
  .sscim-tip.leaflet-popup .leaflet-popup-content-wrapper { background: ${C.panel}; color: ${C.text}; border: 1px solid ${C.copperDim}; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
  .sscim-tip.leaflet-popup .leaflet-popup-content { margin: 10px 12px; font-family: 'Space Grotesk', sans-serif; }
  .sscim-tip.leaflet-popup .leaflet-popup-tip { background: ${C.panel}; box-shadow: none; }
  .sscim-tip.leaflet-popup .leaflet-popup-close-button { color: ${C.faint} !important; }
  .sscim-tip.leaflet-popup .leaflet-popup-close-button:hover { color: ${C.copper} !important; }
  .sscim-label { background: transparent !important; border: none !important; box-shadow: none !important; color: ${C.text}; font-family: 'Space Grotesk', sans-serif; font-size: 10.5px; font-weight: 600; text-shadow: 0 0 4px #000; white-space: nowrap; }
  /* Deliberately a LOW z-index — just enough to lift the glow above its
     own siblings (e.g. the map/flow grid cells) without it ever
     out-stacking the floating tour card (zIndex 1400) or any modal
     (zIndex 1200): a target and the card sitting at the same z-index
     tier was exactly what made the "Next" card disappear behind a
     highlighted pane whenever the two visually overlapped. */
  .tour-target { position: relative; z-index: 2; scroll-margin: 90px; border-radius: 6px; outline: 3px solid ${C.copper}; outline-offset: 2px; box-shadow: 0 0 0 6px rgba(201,138,63,.18), 0 0 28px rgba(201,138,63,.35); animation: tourPulse 1.7s ease-in-out infinite; }
  @keyframes tourPulse { 0%,100% { outline-color: ${C.copper}; } 50% { outline-color: ${C.amber}; } }
  @media (prefers-reduced-motion: reduce) { .tour-target { animation: none !important; } }
  /* --- Small-screen (≈375–560px) refinements (task §12 mobile) ---
     The three tiers already collapse to one-at-a-time tabs below 1080px
     (TabBar). Here we make the many HTML control buttons tap-friendly and
     let the dense control bars breathe without forcing page-level
     horizontal scroll. SVG nodes are <g>/<rect>, not <button>, so the
     min-height never distorts the flow graph. */
  @media (max-width: 560px) {
    body { overflow-x: hidden; }
    button:not(.node) { min-height: 34px; }
    .mono { letter-spacing: .5px; }
    .cbar { padding: 7px 10px !important; gap: 7px !important; }
  }
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

/* Provides the shared interaction controller, then renders the real
   dashboard body. Splitting these means DashboardBody can consume
   useInteraction() while the provider still lives above it. */
function Dashboard() {
  const { data } = useVault();
  return (
    <InteractionProvider defaultSelected={{ type: 'event', id: data.EVENTS[0]?.id }}>
      <DashboardBody />
    </InteractionProvider>
  );
}

function DashboardBody() {
  const { data, engine, source } = useVault();
  const { EVENTS, SCENARIOS, COMPANY_BY_ID } = data;
  const { STAGE_BY_ID, OUT, COMPANY_CRITICALITY, COMPANY_RANK } = engine;

  const { state, setSel, clear, setScenarioActive, playback, setLens, setFocusedPath, draftSet } = useInteraction();
  const sel = state.selected || { type: 'event', id: EVENTS[0]?.id };

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
  const [tourTarget, setTourTarget] = useState(null);
  const [guideKey, setGuideKey] = useState(0);
  setLangV(lang);

  /* The header's "? Guide" button must always land back on the full
     step list — including while the guide is already open in its small
     tour-card mode (showGuide never goes false in that case, so simply
     calling setShowGuide(true) again would be a no-op and the button
     would appear to do nothing). Bumping guideKey forces Guide to
     remount, resetting its internal tour state, and clearing tourTarget
     drops any lingering highlight. */
  const openGuide = () => { setShowGuide(true); setTourTarget(null); setGuideKey((k) => k + 1); };

  /* Guided tour: a step can target more than just a DOM id to glow —
     "drill into a company" and "company rank" only make sense once
     something is actually showing in the Intel panel's own COMPANIES
     tab, which defaults to "events" and doesn't automatically follow the
     tour. Guide.jsx passes either a plain DOM-id string or a small
     descriptor { id, feedTab, selectTopCompany }; this normalizes it and
     drives feedTab/sel so the highlighted pane shows the content the
     step is actually describing, not just an empty/unrelated view. */
  const handleHighlight = (target) => {
    if (!target) { setTourTarget(null); return; }
    const { id, feedTab: ft, selectTopCompany } = typeof target === "string" ? { id: target } : target;
    setTourTarget(id);
    if (ft) setFeedTab(ft);
    if (selectTopCompany && COMPANY_RANK[0]) setSel({ type: "company", id: COMPANY_RANK[0].id });
  };

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1080px)");
    const fn = () => setWide(mq.matches);
    fn(); mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  /* Makes sure the current tourTarget is actually visible — switching
     tabs on the narrow layout if needed — then scrolls it into view. The
     .tour-target CSS class (GLOBAL_STYLE) supplies the pulsing highlight
     ring itself. Waits two animation frames (not one) before measuring:
     a single rAF can still land before React has painted a tab/feedTab
     switch that was set in the same render pass, which is exactly what
     made the Layer-3 target for "drill into a company" / "company rank"
     feel like it was scrolling to the wrong (or no) place. */
  useEffect(() => {
    if (!tourTarget) return;
    const paneTab = { "pane-map": "map", "pane-flow": "flow", "pane-intel": "intel" }[tourTarget];
    if (paneTab && !wide) setTab(paneTab);
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        document.getElementById(tourTarget)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [tourTarget, wide]);

  const scenario = scenarioId === "custom" ? custom : SCENARIOS.find((s) => s.id === scenarioId);
  const scenarioActive = Boolean(scenario?.event);

  const model = useMemo(() => buildModel({ data, engine, scenario }), [scenarioId, custom]);

  /* Hop-by-hop propagation trace for the active scenario shock — the
     playback source of truth (see engine.eventTrace / playback.js). Its
     final field is the scenario shock's own propagated field; the engine's
     baseline/active fields are never touched, so enabling playback cannot
     change any model result. Recomputed only when the scenario changes. */
  const trace = useMemo(
    () => (scenarioActive && scenario?.event ? engine.eventTrace(scenario.event) : null),
    [scenarioId, custom] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const frame = useMemo(
    () => frameFromTrace(trace, state.playback.step, STAGE_BY_ID),
    [trace, state.playback.step, STAGE_BY_ID]
  );
  // Overlay the map/graph with the playback frame only once the user has
  // engaged playback (play or manual step); at rest the panels keep showing
  // the normal lens so the scenario Δ heatmap stays available.
  const playbackEngaged = Boolean(trace) && (state.playback.status === 'playing' || state.playback.status === 'paused');
  const pb = playbackEngaged ? frame : null;

  /* Baseline / Scenario / Difference comparison (§12). An opt-in overlay on
     the world map + industry graph only: 'lens' (default) follows the global
     lens; 'baseline' shows the pre-scenario field; 'scenario' the active
     field; 'difference' the signed Δ. Decoupled from the global lens so the
     structural/share lenses stay usable. */
  const [compare, setCompare] = useState('lens');
  useEffect(() => { setCompare('lens'); }, [scenarioId, custom]);
  const compareLens = compare === 'difference' ? 'delta' : (compare === 'baseline' || compare === 'scenario') ? 'operational' : undefined;
  const displayModel = useMemo(
    () => (compare === 'baseline' ? { ...model, activeField: model.baselineField, countriesActive: model.countriesBase } : model),
    [model, compare]
  );

  const resetScenario = () => { setScenarioId("none"); setCustom(null); };
  const playScenario = () => playback({ status: 'playing', step: 0 });

  /* Build a scenario composed directly on the map/graph (§10): run it
     through the same custom-scenario path every other scenario uses. If the
     user asked to Play, the scenario-sync effect below starts playback once
     the new trace exists. */
  const playAfterBuildRef = useRef(false);
  const buildFromDraft = (scenarioObj, { play } = {}) => {
    playAfterBuildRef.current = Boolean(play);
    setCustom(scenarioObj);
    setScenarioId("custom");
  };

  // URL state (§12): a lens the URL asked for can only be applied AFTER the
  // scenario-sync effect below has run (activating a scenario forces the Δ
  // lens); this ref carries it across to that effect. urlRestoredRef gates
  // the write-back effect so we never clobber the incoming hash before it is
  // restored.
  const pendingLensRef = useRef(null);
  const urlRestoredRef = useRef(false);

  /* Keep the interaction controller in sync with the active scenario:
     activating a scenario flips the lens to Scenario Δ and opens the
     synthetic { type:'scenario' } entity in Layer 3 (so the old event
     explanation no longer masquerades as the scenario's — §9);
     deactivating clears that synthetic selection if it is still showing.
     Also (re)arms the playback clock to the new trace length at step 0 —
     or starts it playing when a Build & Play was just requested. */
  useEffect(() => {
    setScenarioActive(scenarioActive);
    const startPlaying = playAfterBuildRef.current && (trace?.trace.length || 0) > 0;
    playback({ length: trace?.trace.length || 0, step: 0, status: startPlaying ? 'playing' : 'idle' });
    playAfterBuildRef.current = false;
    if (scenarioActive) setSel({ type: 'scenario', id: 'active' });
    else if (state.selected?.type === 'scenario') clear();
    // Apply a lens the restored URL asked for, now that scenario activation
    // (which forces Δ) has been reconciled. setLens itself refuses an
    // unavailable lens, so a stale delta with no scenario is a safe no-op.
    if (pendingLensRef.current) { setLens(pendingLensRef.current); pendingLensRef.current = null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, custom]);

  /* Restore shareable state from the URL hash once, on mount (§12). Order:
     set the scenario first (so the sync effect above re-runs and reconciles
     the lens), stash the requested lens for it to apply, then restore the
     pinned entity, playback hop, and explained path. */
  useEffect(() => {
    const decoded = decodeInteractionState(window.location.hash);
    if (decoded.scenarioId && decoded.scenarioId !== 'none') {
      if (decoded.scenarioId === 'custom' && decoded.draft?.sources?.length) {
        draftSet({ sources: decoded.draft.sources, severity: decoded.draft.severity, direction: decoded.draft.direction });
        const built = draftToScenario(decoded.draft, { stageById: STAGE_BY_ID });
        if (built) { setCustom(built); setScenarioId('custom'); }
      } else if (SCENARIOS.some((s) => s.id === decoded.scenarioId)) {
        setScenarioId(decoded.scenarioId);
      }
    }
    if (decoded.lens) pendingLensRef.current = decoded.lens;
    if (decoded.selected) setSel(decoded.selected);
    if (decoded.focusedPath) {
      const paths = engine.topPaths(decoded.focusedPath.sourceId, decoded.focusedPath.targetId, { k: 1 });
      if (paths[0]) setFocusedPath({ sourceId: decoded.focusedPath.sourceId, targetId: decoded.focusedPath.targetId, path: paths[0] });
    }
    if (decoded.playbackStep) setTimeout(() => playback({ step: decoded.playbackStep }), 0);
    urlRestoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Write the shareable slice back to the URL hash (replaceState — no new
     history entry) whenever it changes, once the initial restore is done. */
  useEffect(() => {
    if (!urlRestoredRef.current) return;
    const qs = encodeInteractionState({
      lens: state.lens, selected: state.selected, scenarioId,
      draft: state.draft, playbackStep: state.playback.step, focusedPath: state.focusedPath,
    });
    const targetHash = qs ? `#${qs}` : '';
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', qs ? `#${qs}` : window.location.pathname + window.location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lens, state.selected, scenarioId, custom, state.playback.step, state.focusedPath, state.draft]);

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
    } else if (sel.type === "scenario" && scenario?.event) {
      // Make the active scenario visually obvious on both maps by lighting
      // its declared source stages/countries (§16 acceptance criterion).
      (scenario.event.stages || []).forEach((x) => { s.add(x); (OUT[x] || []).forEach((d) => s.add(d)); });
      (scenario.event.countries || []).forEach((x) => c.add(x));
    }
    return { s, c };
  }, [sel, scenarioId, custom]);

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
        setShowBuilder={setShowBuilder} setShowGuide={openGuide}
        setShowBriefing={setShowBriefing} setShowMethod={setShowMethod}
        tourTarget={tourTarget}
      />

      <ScenarioBar model={model} whatChanged={whatChanged} compare={compare} setCompare={setCompare} scenarioActive={scenarioActive} />
      <LensBar scenarioName={scenario?.name} />
      {(state.draft.builderMode || state.draft.sources.length > 0) && (
        <ScenarioComposer onBuild={buildFromDraft} onReset={resetScenario} activeIsCustom={scenarioId === 'custom'} />
      )}
      {scenarioActive && <PlaybackBar frame={frame} scenarioName={scenario?.name} />}

      {showBuilder && <ScenarioBuilder onClose={() => setShowBuilder(false)} onRun={(sc) => { setCustom(sc); setScenarioId("custom"); setShowBuilder(false); }} />}

      {!wide && <TabBar panes={panes} tab={tab} setTab={setTab} />}

      {wide ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.9fr", gap: 1, background: C.line }}>
            <Pane id="pane-map" highlight={tourTarget === "pane-map"} title="LAYER 1 · WORLD MAP · OPENSTREETMAP"><OsmMap model={displayModel} hl={hl} pb={pb} lensOverride={compareLens} /></Pane>
            <Pane id="pane-flow" highlight={tourTarget === "pane-flow"} title="LAYER 2 · INDUSTRY FLOW · TAP A STAGE FOR ITS SUBSECTION"><FlowGraph sel={sel} setSel={setSel} hl={hl} model={displayModel} scenarioActive={model.scenarioActive} pb={pb} lensOverride={compareLens} /></Pane>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            <Pane id="pane-intel" highlight={tourTarget === "pane-intel"} title="LAYER 3 · INTELLIGENCE PANEL">
              <Intel sel={sel} setSel={setSel} model={model} scenario={scenario} onResetScenario={resetScenario} onPlayScenario={playScenario} scenarioActive={model.scenarioActive} feedTab={feedTab} setFeedTab={setFeedTab} horizontal />
            </Pane>
          </div>
        </>
      ) : (
        <>
          {tab === "map" && <Pane id="pane-map" highlight={tourTarget === "pane-map"} title="LAYER 1 · WORLD MAP · OPENSTREETMAP"><OsmMap model={displayModel} hl={hl} pb={pb} lensOverride={compareLens} /></Pane>}
          {tab === "flow" && <Pane id="pane-flow" highlight={tourTarget === "pane-flow"} title="LAYER 2 · INDUSTRY FLOW"><FlowGraph sel={sel} setSel={setSel} hl={hl} model={displayModel} scenarioActive={model.scenarioActive} pb={pb} lensOverride={compareLens} /></Pane>}
          {tab === "intel" && <Pane id="pane-intel" highlight={tourTarget === "pane-intel"} title="LAYER 3 · INTELLIGENCE PANEL"><Intel sel={sel} setSel={setSel} model={model} scenario={scenario} onResetScenario={resetScenario} onPlayScenario={playScenario} scenarioActive={model.scenarioActive} feedTab={feedTab} setFeedTab={setFeedTab} /></Pane>}
        </>
      )}

      {showMethod && <Methodology onClose={() => setShowMethod(false)} />}
      {showGuide && (
        <Guide
          key={guideKey}
          onClose={() => { setShowGuide(false); setTourTarget(null); }}
          tourTarget={tourTarget} onHighlight={handleHighlight}
        />
      )}
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
