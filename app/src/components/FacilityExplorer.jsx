import { useMemo, useState } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { facilityConnectivity } from '../engine/facilityNetwork.js';
import { siteWeight } from '../engine/facilities.js';
import { FACILITY_KIND_LABEL } from '../utils/facilityIcon.js';
import { flagEmoji } from '../data/glossary.js';
import { pct } from '../interaction/lensEncoding.js';
import Logo from './Logo.jsx';
import TrackButton from './TrackButton.jsx';
import FacilityGraph from './FacilityGraph.jsx';

/* ====================================================================
   FacilityExplorer — pick one plant, walk its connections.

   The facility panel already lists a site's strongest links, and the map can
   draw them. Neither lets you TRAVEL: you could see that TSMC Fab 18 supplies
   an assembly site, but following that site's own connections meant going
   back to the map, finding it, and clicking it again.

   This is that walk. One plant is the focus; everything it connects to is
   listed in both directions; clicking any neighbour makes it the new focus
   and pushes the old one onto a trail you can walk back. It is the same link
   set the map draws, from engine/facilityNetwork.js — no second derivation,
   so a link shown here and a line drawn there cannot disagree.

   WHAT A LINK IS, restated because this panel makes it easy to forget: a
   MODELED connection, composed from company-level supplier-revenue share and
   stage reachability. It is not a shipment route. Nothing in this dataset
   records which plant ships to which plant, and the strength shown is a
   relative ordering against the strongest modeled link, not a volume.
   ==================================================================== */

const MAX_ROWS = 40;

export default function FacilityExplorer({ setSel, model }) {
  const { data, engine } = useVault();
  const { FACILITY_LAYER, FACILITY_NETWORK, COMPANY_BY_ID, COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;
  const { requestFlyTo } = useInteraction();

  const [focusId, setFocusId] = useState(null);
  const [trail, setTrail] = useState([]);
  const [query, setQuery] = useState('');

  const focus = focusId ? FACILITY_LAYER.FACILITY_BY_ID[focusId] : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return FACILITY_LAYER.FACILITIES
      .filter((f) => f.name.toLowerCase().includes(q)
        || (COMPANY_BY_ID[f.company]?.name || '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, FACILITY_LAYER, COMPANY_BY_ID]);

  const edges = focus ? (FACILITY_NETWORK?.linksByFacility?.[focus.id] || { inbound: [], outbound: [] }) : null;
  const conn = focus ? facilityConnectivity(FACILITY_NETWORK, focus.id) : null;

  const goTo = (id, { push = true } = {}) => {
    if (push && focusId) setTrail((t) => [...t.slice(-9), focusId]);
    setFocusId(id);
    setQuery('');
  };
  const back = () => {
    setTrail((t) => {
      if (!t.length) return t;
      setFocusId(t[t.length - 1]);
      return t.slice(0, -1);
    });
  };

  /* ---- the picker, when nothing is focused yet ---- */
  if (!focus) {
    const busiest = [...FACILITY_LAYER.FACILITIES]
      .map((f) => ({ f, c: facilityConnectivity(FACILITY_NETWORK, f.id) }))
      .filter((x) => x.c.degree > 0)
      .sort((a, b) => b.c.total - a.c.total)
      .slice(0, 8);

    return (
      <div>
        <Header />
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a plant or operator…" aria-label="Search for a facility"
          style={inputStyle} />
        {matches.length > 0 && (
          <ul style={listStyle}>
            {matches.map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => goTo(f.id, { push: false })} style={rowButtonStyle}>
                  {flagEmoji(f.country)} {f.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.faint, margin: '12px 0 5px' }}>
          OR START FROM THE MOST CONNECTED SITES
        </div>
        <ul style={listStyle}>
          {busiest.map(({ f, c }) => (
            <li key={f.id}>
              <button type="button" onClick={() => goTo(f.id, { push: false })} style={rowButtonStyle}>
                <span style={{ flex: 1 }}>{flagEmoji(f.country)} {f.name}</span>
                <span className="mono" style={{ fontSize: 9.5, color: C.copper }}>{c.degree} links</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* ---- the focused view ---- */
  const linkRow = (l, dir) => {
    const otherId = dir === 'out' ? l.to : l.from;
    const other = FACILITY_LAYER.FACILITY_BY_ID[otherId];
    if (!other) return null;
    const otherConn = facilityConnectivity(FACILITY_NETWORK, otherId);
    return (
      <li key={`${dir}:${l.from}:${l.to}`}>
        <button type="button" onClick={() => goTo(otherId)} style={{ ...rowButtonStyle, alignItems: 'flex-start' }}>
          <span aria-hidden style={{ fontSize: 10, marginTop: 1 }}>{flagEmoji(other.country)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 11, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {other.name}
            </span>
            <span className="mono" style={{ fontSize: 8.5, color: C.faint }}>
              {COMPANY_BY_ID[other.company]?.name || other.company}
              {' · '}{STAGE_BY_ID[dir === 'out' ? l.toStage : l.fromStage]?.name || ''}
              {l.flow === 'service' ? ' · service' : ''}
              {otherConn.degree ? ` · ${otherConn.degree} further links` : ''}
            </span>
          </span>
          <span className="mono" style={{ fontSize: 9.5, color: C.copper, width: 34, textAlign: 'right' }}>
            {pct(l.rel ?? 0)}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div>
      <Header />

      {/* trail */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, flexWrap: 'wrap' }}>
        <button type="button" onClick={back} disabled={!trail.length}
          style={{ ...chipStyle, cursor: trail.length ? 'pointer' : 'not-allowed', opacity: trail.length ? 1 : 0.45 }}>
          ← Back
        </button>
        <button type="button" onClick={() => { setFocusId(null); setTrail([]); }} style={chipStyle}>Change plant</button>
        {trail.length > 0 && (
          <span className="mono" style={{ fontSize: 9, color: C.faint }}>
            {trail.length} step{trail.length === 1 ? '' : 's'} back available
          </span>
        )}
      </div>

      {/* the focused plant */}
      <div style={{ border: `1px solid ${C.copperDim}`, borderRadius: 6, padding: '9px 11px', background: C.panel, marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
          <span aria-hidden style={{ fontSize: 13 }}>{flagEmoji(focus.country)}</span>
          <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 600 }}>{focus.name}</span>
          <TrackButton type="facility" id={focus.id} />
        </div>
        <div className="mono" style={{ fontSize: 9.5, color: C.copper, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Logo cid={focus.company} size={12} />
          {COMPANY_BY_ID[focus.company]?.name || focus.company}
          {' · '}{FACILITY_KIND_LABEL[focus.kind] || focus.kind}
          {' · '}{COUNTRY_NAMES[focus.country] || focus.country}
        </div>
        <div style={{ fontSize: 10.5, color: C.dim, lineHeight: 1.5, marginTop: 4 }}>{focus.output}</div>
        <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span><b style={{ color: C.text }}>{conn.degree}</b> modeled links</span>
          <span>{edges.outbound.length} out · {edges.inbound.length} in</span>
          {siteWeight(focus) === 0 && <span style={{ color: C.amber }}>no output to lose yet</span>}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setSel({ type: 'facility', id: focus.id }); }} style={chipStyle}>
            Full profile
          </button>
          <button type="button" onClick={() => { setSel({ type: 'facility', id: focus.id }); requestFlyTo?.(focus.country); }} style={chipStyle}>
            Show on map
          </button>
          <button type="button" onClick={() => setSel({ type: 'company', id: focus.company })} style={chipStyle}>
            Operator
          </button>
        </div>
      </div>

      {/* The graph first: shape reads faster than a list, and the list below
          is the complete version of the same thing. */}
      {conn.degree > 0 && (
        <div style={{ marginBottom: 10 }}>
          <FacilityGraph focusId={focus.id} model={model} onFocus={goTo} onSelect={setSel} />
        </div>
      )}

      {conn.degree === 0 ? (
        <div className="mono" style={{ fontSize: 10, color: C.faint, lineHeight: 1.7 }}>
          No modeled link touches this plant. That happens when its operator has no customer edge in the sample, or
          when no stage it feeds reaches a customer&apos;s stage — not necessarily that the site is unconnected in
          reality.
        </div>
      ) : (
        <>
          {edges.outbound.length > 0 && (
            <>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.faint, margin: '0 0 4px' }}>
                SUPPLIES → ({edges.outbound.length})
              </div>
              <ul style={listStyle}>{edges.outbound.slice(0, MAX_ROWS).map((l) => linkRow(l, 'out'))}</ul>
            </>
          )}
          {edges.inbound.length > 0 && (
            <>
              <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.faint, margin: '10px 0 4px' }}>
                ← SUPPLIED BY ({edges.inbound.length})
              </div>
              <ul style={listStyle}>{edges.inbound.slice(0, MAX_ROWS).map((l) => linkRow(l, 'in'))}</ul>
            </>
          )}
        </>
      )}

      <div className="mono" style={{ fontSize: 8.5, color: C.faint, marginTop: 9, lineHeight: 1.65 }}>
        A modeled link, not a shipment route: company-level supplier-revenue share × each site&apos;s share of its stage
        × the engine&apos;s reach prior. The percentage is strength relative to the strongest modeled link in the
        snapshot — an ordering, not a volume. Click any row to make that plant the focus and keep walking.
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.copper, marginBottom: 8 }}>
      ⇄ CONNECTION EXPLORER
    </div>
  );
}

const listStyle = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 };
const rowButtonStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 7, textAlign: 'left',
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4,
  padding: '5px 8px', fontFamily: 'inherit', fontSize: 11, color: C.text, cursor: 'pointer', minHeight: 0,
};
const chipStyle = {
  fontSize: 10, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
  background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, minHeight: 0,
};
const inputStyle = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4,
  color: C.text, fontFamily: 'inherit', fontSize: 11.5, padding: '5px 8px', marginBottom: 6,
};
