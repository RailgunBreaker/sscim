import { useState } from 'react';
import { C } from './theme.js';
import { VaultProvider, useVault } from './data/VaultContext.jsx';
import Header from './components/Header.jsx';
import Pane from './components/Pane.jsx';
import DocumentedMap from './components/DocumentedMap.jsx';
import DocumentedNetwork from './components/DocumentedNetwork.jsx';
import CompanyEvidence from './components/CompanyEvidence.jsx';
import FinancialEvidence from './components/FinancialEvidence.jsx';
import OperationalEvidence from './components/OperationalEvidence.jsx';
import PredictionValidation from './components/PredictionValidation.jsx';
import ValidationStatus from './components/ValidationStatus.jsx';
import PilotWorkspace from './components/PilotWorkspace.jsx';
import './ui/evidence-dashboard.css';

const GLOBAL_STYLE = `
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 3px; }
  .node { cursor: pointer; transition: opacity .25s; }
  .evcard { cursor: pointer; transition: border-color .2s; }
  .evcard:hover { border-color: ${C.copper} !important; }
  /* ONE focus definition, applied to everything focusable. A control
     without a visible focus ring is unusable from a keyboard, so this is
     deliberately broad rather than opt-in. */
  button:focus-visible, a:focus-visible, [role="tab"]:focus-visible, [role="radio"]:focus-visible,
  input:focus-visible, select:focus-visible, summary:focus-visible, .node:focus-visible {
    outline: 2px solid ${C.copper}; outline-offset: 2px; border-radius: 3px;
  }
  /* Interactive things respond to a pointer; non-interactive rows do not.
     Every row looking hoverable was a large part of why the dashboard read
     as a wall of buttons. */
  .ui-button:hover:not(:disabled) { background: var(--hover); }
  .ui-button[aria-checked="true"]:hover, .ui-button[aria-selected="true"]:hover { filter: brightness(1.06); }
  .ui-button:disabled { cursor: not-allowed; opacity: .45; }
  .row-interactive { cursor: pointer; }
  .row-interactive:hover { background: var(--hover); }
  .row-static { cursor: default; }
  .pulse { animation: pulse 1.4s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none !important; } }
  @keyframes pulse { 0%,100% { opacity:.4 } 50% { opacity:1 } }
  /* Historically named for a monospace family it never set. What every
     call site actually wanted is figures that line up in a column, which
     is a font FEATURE and not a family. Kept under the old name because
     fifty files use it; it no longer pretends to be monospace. */
  .mono { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
  .sscim-map { background: ${C.panel2}; }
  .sscim-map .osm-soft { filter: var(--mapFilter); }
  .sscim-map .leaflet-control-attribution { background: var(--panel); color: ${C.faint}; font-size: 9px; }
  .sscim-map .leaflet-control-attribution a { color: ${C.copperDim}; }
  .sscim-tip { background: ${C.panel} !important; color: ${C.text} !important; border: 1px solid ${C.line} !important; border-radius: 4px; font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; padding: 3px 7px; box-shadow: none !important; }
  .sscim-tip::before { display: none; }
  .sscim-tip.leaflet-popup .leaflet-popup-content-wrapper { background: ${C.panel}; color: ${C.text}; border: 1px solid ${C.copperDim}; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
  .sscim-tip.leaflet-popup .leaflet-popup-content { margin: 10px 12px; font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .sscim-tip.leaflet-popup .leaflet-popup-tip { background: ${C.panel}; box-shadow: none; }
  .sscim-tip.leaflet-popup .leaflet-popup-close-button { color: ${C.faint} !important; }
  .sscim-tip.leaflet-popup .leaflet-popup-close-button:hover { color: ${C.copper} !important; }
  .sscim-label { background: transparent !important; border: none !important; box-shadow: none !important; color: ${C.text}; font-family: Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 600; text-shadow: var(--labelShadow); white-space: nowrap; }
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
    /* 44px is the touch-target floor, not 34. Applies to every control
       that is not an SVG graph node. */
    button:not(.node), a.ui-button { min-height: 44px; }
    .cbar { padding: 8px 12px !important; gap: 8px !important; }
  }
`;


export default function App() {
  return <VaultProvider><Dashboard /></VaultProvider>;
}
function Dashboard() {
  const { status, error, data } = useVault();
  const [companyId, setCompanyId] = useState('gf');
  const [tab, setTab] = useState('company');
  if (status !== 'ready') return <main style={{ padding: 32, color: C.text, background: C.bg, minHeight: '100vh' }} role="status">
    {status === 'error' ? 'Unable to load data: ' + String(error?.message || error) : 'Loading supply-chain data…'}
  </main>;
  const selected = data.COMPANY_BY_ID[companyId] ? companyId : data.COMPANIES[0]?.id;
  const analysis = data.OBSERVED_ANALYSIS;
  return <div className="dashboard-shell evidence-dashboard" style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Inter, Segoe UI, sans-serif' }}>
    <style>{GLOBAL_STYLE}</style>
    <Header documented companyId={selected} onCompanyChange={setCompanyId} />
    <div className="dashboard-title"><div><h1>Supply chain overview</h1><p>Explore documented dependencies, reported operations and disruption losses.</p></div></div>
    {data.REFRESH_FAILED && <p className="evidence-notice" role="status">Refresh failed. Showing the last successfully loaded data.</p>}
    {data.LIVE_GAPS?.filled?.length > 0 && <p className="evidence-notice" role="status">Some data sections are missing from the API. Their dated bundled copies are shown until the API is updated.</p>}
    <div className="evidence-summary" aria-label="Supply chain coverage">
      <article><strong>{analysis.relationships.length}</strong><span>Reviewed company disclosures</span></article>
      <article><strong>{data.FACILITIES.length}</strong><span>Sites with activity or capacity evidence</span></article>
      <article><strong>{data.EVENTS.length}</strong><span>Reviewed occurrence records</span></article>
      <article><strong>Unknown</strong><span>Current chain-wide loss</span></article>
    </div>
    <div className="workspace-grid evidence-workspace">
      <Pane id="pane-map" title="World map" hint="Documented facilities · approximate locations"><DocumentedMap facilities={data.FACILITIES} companyId={selected} onSelect={setCompanyId} /></Pane>
      <Pane id="pane-flow" title="Supplier network" hint="Documented company relationships"><DocumentedNetwork analysis={analysis} companies={data.COMPANY_BY_ID} companyId={selected} onSelect={setCompanyId} /></Pane>
    </div>
    <div className="intelligence-section">
      <nav className="evidence-tabs" aria-label="Intelligence sections">{[['company','Company data'],['investigations','Investigations'],['losses','Disruption losses'],['validation','Validation'],['news','News']].map(([id,label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <Pane id="pane-intel" title={tab === 'company' ? 'Company intelligence' : tab === 'investigations' ? 'Supplier investigations' : tab === 'losses' ? 'Disruption losses' : tab === 'validation' ? 'Validation' : 'Reviewed news'}>
        {tab === 'investigations' && <PilotWorkspace data={data} companyId={selected} onCompanyChange={setCompanyId} />}
        {tab === 'company' && <CompanyEvidence data={data} companyId={selected} />}
        {tab === 'losses' && <div className="evidence-content"><OperationalEvidence data={data} view="losses" /><FinancialEvidence evidence={data.FINANCIAL_EVIDENCE} /></div>}
        {tab === 'validation' && <div className="evidence-content"><ValidationStatus data={data} /><PredictionValidation report={data.REVENUE_VALIDATION} snapshotFallback={data.LIVE_GAPS?.filled?.includes('revenueValidation')} /><OperationalEvidence data={data} view="validation" /></div>}
        {tab === 'news' && <div className="evidence-content"><h2>Reviewed occurrences</h2><p>Claims below have supporting source review. Severity scores and generated consequences are excluded.</p>
          {data.EVENTS.length ? data.EVENTS.map(event => <article key={event.id} className="evidence-event"><p>{event.claim}</p>{event.sources.map(source => <p key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher || 'Original disclosure'}</a> · Published {source.publicationDate}<br /><small>{source.supportingSection}</small></p>)}</article>) : <p>No reviewed occurrences available.</p>}
        </div>}
      </Pane>
    </div>
    <footer className="evidence-footer">SSCIM Intelligence · Evidence is limited to its stated scope and reporting date. Current production risk and chain-wide loss remain unknown where observations are missing.</footer>
  </div>;
}
