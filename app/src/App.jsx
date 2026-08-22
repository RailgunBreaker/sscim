import { useState, useEffect, useMemo, useRef } from 'react';
import { C } from './theme.js';
import { t, setLangV } from './i18n/index.js';
import { VaultProvider, useVault } from './data/VaultContext.jsx';
import { WatchlistProvider } from './interaction/WatchlistContext.jsx';
import { buildModel, reviewDateISO } from './engine/buildModel.js';
import { InteractionProvider, useInteraction } from './interaction/InteractionContext.jsx';
import { encodeInteractionState, decodeInteractionState, encodeNetworkState, decodeNetworkState } from './interaction/urlState.js';
import { deriveAnalysisGraph } from './engine/networkOps.js';
import { findCentreRoutes } from './engine/networkPaths.js';

import Header from './components/Header.jsx';
import LiveBar from './components/LiveBar.jsx';
import TimeMachine from './components/TimeMachine.jsx';
import LensBar from './components/LensBar.jsx';
import TabBar from './components/TabBar.jsx';
import Pane from './components/Pane.jsx';
import OsmMap from './components/OsmMap.jsx';
import FlowGraph from './components/FlowGraph.jsx';
import NetworkGraph from './components/NetworkGraph.jsx';
import NetworkToolbar from './components/NetworkToolbar.jsx';
import NetworkRoutePanel from './components/NetworkRoutePanel.jsx';
import NetworkAnalysisPanel from './components/NetworkAnalysisPanel.jsx';
import NetworkComparePanel from './components/NetworkComparePanel.jsx';
import { buildBaseGraph } from './engine/network.js';
import Intel from './components/Intel.jsx';
import Guide from './components/Guide.jsx';
import Briefing from './components/Briefing.jsx';
import SiteMap from './components/SiteMap.jsx';

const GLOBAL_STYLE = `
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
  .mono { font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-variant-numeric: tabular-nums; }
  .sscim-map { background: ${C.panel2}; }
  .sscim-map .osm-soft { filter: brightness(.75) invert(1) contrast(1.1) hue-rotate(200deg) saturate(.3); }
  .sscim-map .leaflet-control-attribution { background: rgba(12,17,28,.8); color: ${C.faint}; font-size: 9px; }
  .sscim-map .leaflet-control-attribution a { color: ${C.copperDim}; }
  .sscim-tip { background: ${C.panel} !important; color: ${C.text} !important; border: 1px solid ${C.line} !important; border-radius: 4px; font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; padding: 3px 7px; box-shadow: none !important; }
  .sscim-tip::before { display: none; }
  .sscim-tip.leaflet-popup .leaflet-popup-content-wrapper { background: ${C.panel}; color: ${C.text}; border: 1px solid ${C.copperDim}; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
  .sscim-tip.leaflet-popup .leaflet-popup-content { margin: 10px 12px; font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .sscim-tip.leaflet-popup .leaflet-popup-tip { background: ${C.panel}; box-shadow: none; }
  .sscim-tip.leaflet-popup .leaflet-popup-close-button { color: ${C.faint} !important; }
  .sscim-tip.leaflet-popup .leaflet-popup-close-button:hover { color: ${C.copper} !important; }
  .sscim-label { background: transparent !important; border: none !important; box-shadow: none !important; color: ${C.text}; font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; text-shadow: 0 0 4px #000; white-space: nowrap; }
  /* Facility markers are divIcons carrying an SVG glyph (utils/facilityIcon.js).
     Leaflet's default .leaflet-div-icon paints a white box behind them, which
     would put a paper square under every one of the 244 plants. */
  .sscim-site { background: transparent !important; border: none !important; }
  .sscim-site-tracked svg { filter: drop-shadow(0 0 3px rgba(223,168,61,.95)); }
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
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', padding: 24, textAlign: "center" }}>
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
      <div style={{ minHeight: "100vh", background: C.bg, color: C.dim, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
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
      <WatchlistProvider>
        <DashboardBody />
      </WatchlistProvider>
    </InteractionProvider>
  );
}

function DashboardBody() {
  const { data, engine, source } = useVault();
  const { EVENTS, COMPANY_BY_ID } = data;
  const { STAGE_BY_ID, OUT, COMPANY_CRITICALITY, COMPANY_RANK } = engine;

  const { state, setSel, clear, setScenarioActive, setLens, setFocusedPath, setViewMode, setMetric, setRoute, pgSet } = useInteraction();
  const sel = state.selected || { type: 'event', id: EVENTS[0]?.id };

  const [tab, setTab] = useState("flow");
  const [feedTab, setFeedTab] = useState("events");
  const [wide, setWide] = useState(true);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [lang, setLang] = useState("en");
  const [tourTarget, setTourTarget] = useState(null);
  const [guideKey, setGuideKey] = useState(0);
  setLangV(lang);

  /* THE TWO WAYS THE VIEW LEAVES "LIVE", and they are different in kind.

     asOfDaysAgo  history review — the chain as it actually stood on a past
                  date. A fact about the record.
     hazard       the one remaining hypothesis: a screening shock drawn on
                  the map. Everything else that used to author what-ifs
                  (preset scenarios, the draft composer, the builder modal,
                  propagation playback) is gone. The dashboard is a live
                  read of the vault; the only counterfactual it will state
                  is a bounded one you place yourself. */
  const [asOfDaysAgo, setAsOfDaysAgo] = useState(0);
  const [hazard, setHazard] = useState(null);

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

  const scenario = hazard;
  const scenarioActive = Boolean(scenario?.event);

  /* One model for the whole dashboard, derived from the reviewed date and
     the hazard overlay together. Reviewing a past date with a hazard applied
     answers "what would this have done, then" — and the baseline in that
     case is the reviewed date, so the Δ stays meaningful. */
  const model = useMemo(
    () => buildModel({ data, engine, scenario, asOfDaysAgo }),
    [data, engine, scenario, asOfDaysAgo],
  );

  // Immutable frontend-derived multilayer graph (functional centres +
  // stage-mediated connections). Built once per vault; the topology view and
  // network-analysis tools derive from it without mutating it (§7).
  const baseGraph = useMemo(() => buildBaseGraph({ data, engine }), [data, engine]);
  const viewMode = state.viewMode;

  const displayModel = model;

  const resetScenario = () => setHazard(null);

  // URL state (§12): a lens the URL asked for can only be applied AFTER the
  // hazard-sync effect below has run (an active hazard forces the Δ lens);
  // this ref carries it across to that effect. urlRestoredRef gates the
  // write-back effect so we never clobber the incoming hash before it is
  // restored.
  const pendingLensRef = useRef(null);
  const urlRestoredRef = useRef(false);

  /* Keep the interaction controller in sync with the hazard overlay:
     applying one flips the lens to Δ and opens the synthetic
     { type:'scenario' } entity in Layer 3 (so the previously-pinned event's
     explanation cannot masquerade as the hazard's); clearing it drops that
     synthetic selection if it is still showing. */
  useEffect(() => {
    setScenarioActive(scenarioActive);
    if (scenarioActive) setSel({ type: 'scenario', id: 'active' });
    else if (state.selected?.type === 'scenario') clear();
    // Apply a lens the restored URL asked for, now that hazard activation
    // (which forces Δ) has been reconciled. setLens itself refuses an
    // unavailable lens, so a stale delta with no hazard is a safe no-op.
    if (pendingLensRef.current) { setLens(pendingLensRef.current); pendingLensRef.current = null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  /* Restore shareable state from the URL hash once, on mount (§12).

     A scenario id is no longer restored: the preset and custom scenarios it
     referred to are gone, and a hazard is a transient screening overlay
     rather than a view worth sharing. An old link carrying one simply opens
     on the live view, which is the correct fallback — it never silently
     shows a hypothesis the reader did not ask for. */
  useEffect(() => {
    const decoded = decodeInteractionState(window.location.hash);
    if (decoded.viewMode) setViewMode(decoded.viewMode);
    if (decoded.lens) pendingLensRef.current = decoded.lens;
    if (decoded.selected) setSel(decoded.selected);
    if (decoded.focusedPath) {
      const paths = engine.topPaths(decoded.focusedPath.sourceId, decoded.focusedPath.targetId, { k: 1 });
      if (paths[0]) setFocusedPath({ sourceId: decoded.focusedPath.sourceId, targetId: decoded.focusedPath.targetId, path: paths[0] });
    }
    if (Number.isFinite(decoded.asOfDaysAgo)) setAsOfDaysAgo(Math.max(0, decoded.asOfDaysAgo));

    // Network-playground state (§33): metric, temporary removals, pinned route.
    const net = decodeNetworkState(window.location.hash);
    if (net.analysisMetric) setMetric(net.analysisMetric);
    if (net.removedNodeIds || net.removedEdgeIds) pgSet({ removedNodeIds: net.removedNodeIds || [], removedEdgeIds: net.removedEdgeIds || [] });
    if (net.route) {
      const g = deriveAnalysisGraph(baseGraph, { removedNodeIds: net.removedNodeIds, removedEdgeIds: net.removedEdgeIds });
      const [r] = findCentreRoutes(g, net.route.origin, net.route.dest, { objective: net.route.objective, k: 1 });
      if (r) {
        setRoute(r);
        const edges = r.edges.map((e) => ({ from: e.sourceStage, to: e.targetStage, dir: 'downstream' }));
        const nodes = [r.edges[0]?.sourceStage, ...r.edges.map((e) => e.targetStage)].filter(Boolean);
        if (nodes.length) setFocusedPath({ sourceId: nodes[0], targetId: nodes.at(-1), path: { nodes, edges, attenuation: r.weightProduct, channel: 'downstream' } });
      }
    }
    urlRestoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Write the shareable slice back to the URL hash (replaceState — no new
     history entry) whenever it changes, once the initial restore is done. */
  useEffect(() => {
    if (!urlRestoredRef.current) return;
    const core = encodeInteractionState({
      lens: state.lens, viewMode: state.viewMode, selected: state.selected,
      focusedPath: state.focusedPath, asOfDaysAgo,
    });
    const sr = state.selectedRoute;
    const net = encodeNetworkState({
      analysisMetric: state.analysisMetric,
      removedNodeIds: state.playground.removedNodeIds,
      removedEdgeIds: state.playground.removedEdgeIds,
      route: sr ? { origin: sr.centres[0], dest: sr.centres[sr.centres.length - 1], objective: sr.objective } : null,
    });
    const qs = [core, net].filter(Boolean).join('&');
    const targetHash = qs ? `#${qs}` : '';
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', qs ? `#${qs}` : window.location.pathname + window.location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lens, state.viewMode, state.selected, asOfDaysAgo, state.focusedPath, state.analysisMetric, state.playground.removedNodeIds, state.playground.removedEdgeIds, state.selectedRoute]);

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
      // Make the applied hazard visually obvious on both maps by lighting the
      // stages and countries it shocks (§16 acceptance criterion).
      (scenario.event.stages || []).forEach((x) => { s.add(x); (OUT[x] || []).forEach((d) => s.add(d)); });
      (scenario.event.countries || []).forEach((x) => c.add(x));
    }
    return { s, c };
  }, [sel, scenario]);

  /* The one-line "what am I looking at" for the status bar. Three states, in
     priority order: an applied hazard (a hypothesis), a reviewed past date (a
     fact about the record), or live (the newest reviewed event). */
  const whatChanged = useMemo(() => {
    const events = model.reviewing ? engine.eventsAsOf(asOfDaysAgo) : EVENTS;
    if (model.scenarioActive && scenario) {
      return `HAZARD APPLIED — ${scenario.desc} Figures below are recomputed through the same engine and ranked by their marginal delta against ${model.reviewing ? reviewDateISO(engine, asOfDaysAgo) : 'the live reading'}.`;
    }
    if (!events.length) {
      return model.reviewing
        ? `Nothing was inside the decay window on ${reviewDateISO(engine, asOfDaysAgo)} — the index sits at neutral for that date.`
        : 'No reviewed events are available in the current vault.';
    }
    const newestAge = Math.min(...events.map((event) => Number(event.daysAgo ?? Infinity)));
    const newest = events.filter((event) => Number(event.daysAgo ?? Infinity) === newestAge);
    const ranked = newest.map((event) => {
      const field = engine.eventField(event).field;
      const index = engine.toDisplayIndex(engine.operationalIndex(field));
      return { event, index };
    }).sort((a, b) => Math.abs(b.index - 5) - Math.abs(a.index - 5));
    const lead = ranked[0];
    const prefix = model.reviewing
      ? `AS OF ${reviewDateISO(engine, asOfDaysAgo)} — newest then:`
      : `${source === 'live' ? 'live vault' : 'snapshot'} —`;
    return `${prefix} ${lead.event.title} (${lead.event.date}) — own-field index ${lead.index.toFixed(2)}.`;
  }, [model.scenarioActive, model.reviewing, asOfDaysAgo, scenario, EVENTS, engine, source]);

  const panes = { map: t("Map"), flow: t("Flow"), intel: t("Intel") };

  // Layer-1 content follows the view mode (§9): world map, functional-centre
  // topology network, or both stacked.
  const mapPane = <OsmMap model={displayModel} hl={hl} onApplyHazard={setHazard} />;
  const networkPane = <><NetworkGraph baseGraph={baseGraph} /><NetworkRoutePanel baseGraph={baseGraph} /><NetworkAnalysisPanel baseGraph={baseGraph} /><NetworkComparePanel baseGraph={baseGraph} /></>;
  const layer1 = viewMode === 'topology' ? networkPane
    : viewMode === 'split' ? (<>{mapPane}{networkPane}</>)
      : mapPane;
  const layer1Title = viewMode === 'topology' ? 'LAYER 1 · FUNCTIONAL-CENTRE NETWORK · MODELED STAGE-MEDIATED CONNECTIVITY'
    : viewMode === 'split' ? 'LAYER 1 · WORLD MAP + FUNCTIONAL-CENTRE NETWORK'
      : 'LAYER 1 · WORLD MAP · OPENSTREETMAP';

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <style>{GLOBAL_STYLE}</style>

      <Header
        lang={lang} setLang={setLang} setSel={setSel}
        setShowGuide={openGuide} setShowBriefing={setShowBriefing}
        tourTarget={tourTarget}
      />

      <LiveBar model={model} whatChanged={whatChanged} hazard={scenario} onClearHazard={resetScenario} />
      <TimeMachine asOfDaysAgo={asOfDaysAgo} setAsOfDaysAgo={setAsOfDaysAgo} setSel={setSel}
        selectedId={sel.type === 'event' ? sel.id : null} />
      <LensBar scenarioName={scenario?.name} />
      {viewMode !== 'geographic' && <NetworkToolbar />}

      {!wide && <TabBar panes={panes} tab={tab} setTab={setTab} />}

      {wide ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: viewMode === 'geographic' ? "1fr 1.9fr" : "1.9fr 1fr", gap: 1, background: C.line }}>
            <Pane id="pane-map" highlight={tourTarget === "pane-map"} title={layer1Title}>{layer1}</Pane>
            <Pane id="pane-flow" highlight={tourTarget === "pane-flow"} title="LAYER 2 · INDUSTRY FLOW · TAP A STAGE FOR ITS SUBSECTION"><FlowGraph sel={sel} setSel={setSel} hl={hl} model={displayModel} scenarioActive={model.scenarioActive} /></Pane>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            <Pane id="pane-intel" highlight={tourTarget === "pane-intel"} title="LAYER 3 · INTELLIGENCE PANEL">
              <Intel sel={sel} setSel={setSel} model={model} scenario={scenario} onResetScenario={resetScenario} scenarioActive={model.scenarioActive} feedTab={feedTab} setFeedTab={setFeedTab} baseGraph={baseGraph} horizontal />
            </Pane>
          </div>
        </>
      ) : (
        <>
          {tab === "map" && <Pane id="pane-map" highlight={tourTarget === "pane-map"} title={layer1Title}>{layer1}</Pane>}
          {tab === "flow" && <Pane id="pane-flow" highlight={tourTarget === "pane-flow"} title="LAYER 2 · INDUSTRY FLOW"><FlowGraph sel={sel} setSel={setSel} hl={hl} model={displayModel} scenarioActive={model.scenarioActive} /></Pane>}
          {tab === "intel" && <Pane id="pane-intel" highlight={tourTarget === "pane-intel"} title="LAYER 3 · INTELLIGENCE PANEL"><Intel sel={sel} setSel={setSel} model={model} scenario={scenario} onResetScenario={resetScenario} scenarioActive={model.scenarioActive} feedTab={feedTab} setFeedTab={setFeedTab} baseGraph={baseGraph} /></Pane>}
        </>
      )}

      {showGuide && (
        <Guide
          key={guideKey}
          onClose={() => { setShowGuide(false); setTourTarget(null); }}
          tourTarget={tourTarget} onHighlight={handleHighlight}
        />
      )}
      {showBriefing && <Briefing onClose={() => setShowBriefing(false)} model={model} scenario={scenario} />}

      <footer className="mono" style={{ padding: "10px 16px", fontSize: 10, color: C.faint, borderTop: `1px solid ${C.line}`, lineHeight: 1.6 }}>
        SSCIM INTELLIGENCE · Supply-chain sensitivity and comparison analysis (data as of {model.datasetAsOf}) — not a calibrated, causal, or probabilistic forecast, and not investment advice.
        Map data © OpenStreetMap contributors · model {model.modelVersion}.
        {source === 'static' && (
          <span style={{ color: C.amber }}> · DATA SERVICE UNAVAILABLE — showing the latest available dataset.</span>
        )}
        {!model.graphValid && (
          <span style={{ color: C.red }}> · MODEL DIAGNOSTIC: the stage graph failed validation — see <a href="docs/METHODOLOGY.md.html" style={{ color: C.copper }}>Methodology</a>.</span>
        )}
      </footer>

      <SiteMap current="dashboard" />
    </div>
  );
}
