import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { flagEmoji } from '../data/glossary.js';
import { FACILITY_KIND_LABEL } from '../utils/facilityIcon.js';
import { facilityConnectivity } from '../engine/facilityNetwork.js';
import { siteWeight } from '../engine/facilities.js';
import { useFacilityPlayground } from './useFacilityPlayground.js';
import FacilitySearch from './FacilitySearch.jsx';
import FacilityGraph from './FacilityGraph.jsx';
import FacilityConnectionTable from './FacilityConnectionTable.jsx';
import FacilityConnectionDetail from './FacilityConnectionDetail.jsx';
import TrackButton from './TrackButton.jsx';
import Logo from './Logo.jsx';

/* ====================================================================
   FacilityExplorer — the compact entry point to the facility playground,
   living in the Layer-3 "Explore" tab.

   It is deliberately NOT a second explorer. State comes from the shared
   interaction reducer and the traversal from useFacilityPlayground, the
   same two sources the full-width Facility Playground reads, so:

     · switching from Explore to Events and back no longer erases the
       selected plant (it was local component state — a verified defect);
     · "Open in Playground" lands on exactly the plant, hop depth,
       direction, filters and expanded branches that are open here;
     · a link drawn here and a line drawn there cannot disagree, because
       there is one derivation (engine/facilityNetwork.js) underneath both.

   What it keeps of its own is scale: one hop, a smaller graph, fewer
   columns. Anything past that belongs at full width, and the button
   saying so is the first thing in the panel.
   ==================================================================== */

export default function FacilityExplorer({ setSel, model }) {
  const { data, engine } = useVault();
  const { FACILITY_NETWORK, COMPANY_BY_ID, COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;

  const pg = useFacilityPlayground({ maxNodes: 120 });
  const {
    fac, focus, traversal, selectedLinkObj, routeLinkKeys,
    facFocus, facBack, facForward, facReset, facSet, facToggleExpand, facSelectLink,
    setViewMode, requestFlyTo,
  } = pg;

  const openFull = () => setViewMode('playground');

  if (!focus) {
    return (
      <div>
        <Header onOpenFull={openFull} />
        <p style={{ fontSize: 11, color: C.faint, lineHeight: 1.6, margin: '0 0 9px' }}>
          Pick a plant to see the modeled network around it. Connections are{' '}
          <b style={{ color: C.dim }}>modeled stage-mediated relationships</b>, not confirmed shipments or contracts.
        </p>
        <FacilitySearch onPick={(id) => facFocus(id, { asRoot: true })} suggestionCount={6} />
      </div>
    );
  }

  const conn = facilityConnectivity(FACILITY_NETWORK, focus.id);
  const edges = FACILITY_NETWORK?.linksByFacility?.[focus.id] || { inbound: [], outbound: [] };

  return (
    <div>
      <Header onOpenFull={openFull} />

      {/* trail + traversal shape, the compact subset */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 7, flexWrap: 'wrap' }}>
        <button type="button" onClick={facBack} disabled={!fac.trail.length} style={btn(fac.trail.length)} aria-label="Back to the previously centred facility">← Back</button>
        <button type="button" onClick={facForward} disabled={!fac.forward.length} style={btn(fac.forward.length)} aria-label="Forward in the exploration history">Fwd →</button>
        <button type="button" onClick={facReset} style={chipStyle}>Change plant</button>
        <span style={{ width: 1, height: 14, background: C.line }} aria-hidden />
        <div role="group" aria-label="Traversal direction" style={{ display: 'flex', gap: 3 }}>
          {[['upstream', '←'], ['downstream', '→'], ['both', '↔']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => facSet({ direction: k })} aria-pressed={fac.direction === k}
              aria-label={{ upstream: 'Upstream only', downstream: 'Downstream only', both: 'Both directions' }[k]}
              style={{ ...chipStyle, borderColor: fac.direction === k ? C.copper : C.line, color: fac.direction === k ? C.copper : C.dim }}>
              {label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Hop depth" style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 8.5, letterSpacing: 0.8, color: C.faint }}>HOPS</span>
          {[1, 2].map((h) => (
            <button key={h} type="button" onClick={() => facSet({ hops: h })} aria-pressed={fac.hops === h}
              style={{ ...chipStyle, borderColor: fac.hops === h ? C.copper : C.line, color: fac.hops === h ? C.copper : C.dim }}>
              {h}
            </button>
          ))}
          {fac.hops > 2 && (
            <span className="mono" style={{ fontSize: 8.5, color: C.copper }} title="Set in the full playground">{fac.hops === Infinity ? 'all' : fac.hops}</span>
          )}
        </div>
      </div>

      {/* the focused plant */}
      <div style={{ border: `1px solid ${C.copperDim}`, borderRadius: 6, padding: '9px 11px', background: C.panel, marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
          <span aria-hidden style={{ fontSize: 13 }}>{flagEmoji(focus.country)}</span>
          <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 600 }}>{focus.name}</span>
          <TrackButton type="facility" id={focus.id} />
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: C.copper, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <Logo cid={focus.company} size={12} />
          {COMPANY_BY_ID[focus.company]?.name || focus.company}
          {' · '}{FACILITY_KIND_LABEL[focus.kind] || focus.kind}
          {' · '}{COUNTRY_NAMES[focus.country] || focus.country}
        </div>
        <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.5, marginTop: 4 }}>{focus.output}</div>
        <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span><b style={{ color: C.text }}>{conn.degree}</b> modeled links</span>
          <span>{edges.outbound.length} out · {edges.inbound.length} in</span>
          <span>{(focus.stages || []).map((s) => STAGE_BY_ID[s]?.name || s).join(', ')}</span>
          {siteWeight(focus) === 0 && <span style={{ color: C.amber }}>no output to lose yet</span>}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
          <button type="button" onClick={openFull} style={{ ...chipStyle, borderColor: C.copper, color: C.copper }}>
            Open in Playground
          </button>
          <button type="button" onClick={() => setSel({ type: 'facility', id: focus.id })} style={chipStyle}>Full profile</button>
          <button type="button" onClick={() => { setSel({ type: 'facility', id: focus.id }); requestFlyTo?.(focus.country); }} style={chipStyle}>Show on map</button>
          <button type="button" onClick={() => setSel({ type: 'company', id: focus.company })} style={chipStyle}>Operator</button>
        </div>
      </div>

      {conn.degree > 0 && (
        <div style={{ marginBottom: 10 }}>
          <FacilityGraph
            focusId={focus.id}
            traversal={traversal}
            model={model}
            compact
            maxPerColumn={10}
            expanded={fac.expanded}
            selectedLink={fac.selectedLink}
            routeLinkKeys={routeLinkKeys}
            onFocus={(id) => facFocus(id)}
            onSelect={setSel}
            onSelectLink={facSelectLink}
            onToggleExpand={facToggleExpand}
          />
        </div>
      )}

      {selectedLinkObj && (
        <div style={{ marginBottom: 10 }}>
          <FacilityConnectionDetail link={selectedLinkObj} viewFrom={focus.id}
            onFocus={(id) => facFocus(id)} onSelect={setSel} onClose={() => facSelectLink(null)} />
        </div>
      )}

      <FacilityConnectionTable
        facilityId={focus.id}
        onFocus={(id) => facFocus(id)}
        onSelect={setSel}
        onSelectLink={facSelectLink}
        selectedLink={fac.selectedLink}
        linkFilter={pg.linkFilter}
        compact
      />
    </div>
  );
}

function Header({ onOpenFull }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
      <span className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.copper }}>⇄ FACILITY PLAYGROUND · COMPACT</span>
      <button type="button" onClick={onOpenFull} style={{ ...chipStyle, marginLeft: 'auto', borderColor: C.copperDim }}>
        Open full view →
      </button>
    </div>
  );
}

const chipStyle = {
  fontSize: 10, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
  background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, minHeight: 0,
};
function btn(enabled) {
  return { ...chipStyle, cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.45 };
}
