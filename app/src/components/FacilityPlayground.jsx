import { useMemo, useState } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { flagEmoji } from '../data/glossary.js';
import { FACILITY_KIND_LABEL } from '../utils/facilityIcon.js';
import { facilityConnectivity } from '../engine/facilityNetwork.js';
import { siteWeight } from '../engine/facilities.js';
import { RELATIONSHIP_CLASSES, EVIDENCE_TIERS } from '../engine/facilityTraversal.js';
import { useFacilityPlayground } from './useFacilityPlayground.js';
import FacilitySearch from './FacilitySearch.jsx';
import FacilityGraph from './FacilityGraph.jsx';
import FacilityConnectionTable from './FacilityConnectionTable.jsx';
import FacilityConnectionDetail from './FacilityConnectionDetail.jsx';
import TrackButton from './TrackButton.jsx';
import Logo from './Logo.jsx';

/* ====================================================================
   FacilityPlayground — pick one plant, trace the modeled network around
   it, at full width.

   This is the promotion of the compact Layer-3 "Explore" tab into a
   first-class view. The compact one stays, because a small explorer next
   to a selected entity is genuinely useful; what it could never be is the
   product concept, because a 760px graph squeezed into a 360px sidebar
   renders its own labels at roughly six pixels and the network past one
   hop has nowhere to go. Both surfaces read the SAME state and the SAME
   traversal (useFacilityPlayground.js), so opening a plant in one and
   switching to the other lands on the same picture.

   WHAT THE NETWORK IS. Modeled, stage-mediated relationships between
   named plants, composed from company-level supplier-revenue share and
   stage reachability. Nothing in this dataset records which plant ships
   to which plant. Multi-hop traversal compounds that — a two-hop path is
   two modeled relationships in sequence, not an observed route — and the
   copy says so at every depth rather than once at the bottom.
   ==================================================================== */

/* "All reachable" from a hub is most of the network. Past this many
   facilities the graph stops being readable, so the control warns, states
   the totals, and makes the reader confirm — rather than drawing it and
   letting the tab decide how it feels about 400 SVG groups. */
const BIG_NETWORK = 60;

export default function FacilityPlayground({ model, compact = false }) {
  const { data, engine } = useVault();
  const { FACILITY_LAYER, FACILITY_NETWORK, COMPANY_BY_ID, COUNTRY_NAMES, EVENTS } = data;
  const { STAGE_BY_ID } = engine;

  const pg = useFacilityPlayground();
  const {
    fac, focus, filters, traversal, reachable, selectedLinkObj, routeLinkKeys,
    facFocus, facBack, facForward, facHome, facReset, facSet, facSetFilters,
    facToggleExpand, facToggleCollapse, facToggleHidden, facClearHidden,
    facSelectLink, facSetRoute, setSel, setViewMode, requestFlyTo,
  } = pg;

  const [showAllWarned, setShowAllWarned] = useState(false);
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');

  /* Events that name this plant's country and one of its stages: the
     hazard/event thread from the playground back to the rest of SSCIM.
     Deliberately a POSSIBLE-RELEVANCE filter, not an assertion that the
     event hit this plant — the events table records stages and countries,
     never individual facilities, and the copy beside it says so.

     Computed above the "nothing selected yet" return, not below it: hooks
     have to run in the same order on every render, and putting a useMemo
     after a conditional return is exactly the "rendered more hooks than
     during the previous render" crash. */
  const relatedEvents = useMemo(() => {
    if (!focus) return [];
    return (EVENTS || [])
      .filter((e) => (e.countries || []).includes(focus.country)
        && (e.stages || []).some((s) => (focus.stages || []).includes(s)))
      .sort((a, b) => (a.daysAgo ?? 0) - (b.daysAgo ?? 0))
      .slice(0, 4);
  }, [EVENTS, focus]);

  /* ---------------- starting state ---------------- */
  if (!focus) {
    return (
      <div style={{ padding: compact ? 0 : '4px 2px' }}>
        <p style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.65, margin: '0 0 12px', maxWidth: 760 }}>
          Pick one plant and trace the modeled network around it. Every connection here is a{' '}
          <b style={{ color: C.text }}>modeled stage-mediated relationship</b> — composed from a company-level supply
          relationship and stage reachability — <b style={{ color: C.text }}>not a confirmed shipment, customer
          contract, or trade route</b>. Nothing in this dataset records which plant ships to which plant.
        </p>
        <div style={{ maxWidth: 620 }}>
          <FacilitySearch onPick={(id) => facFocus(id, { asRoot: true })} autoFocus={!compact} />
        </div>
      </div>
    );
  }

  /* ---------------- focused state ---------------- */
  const conn = facilityConnectivity(FACILITY_NETWORK, focus.id);
  const edges = FACILITY_NETWORK?.linksByFacility?.[focus.id] || { inbound: [], outbound: [] };
  const drawn = traversal ? traversal.nodes.length - 1 : 0;
  const bigWarning = reachable > BIG_NETWORK;

  const stageNames = (focus.stages || []).map((s) => STAGE_BY_ID[s]?.name || s);

  const visibleIds = traversal ? traversal.nodes.map((n) => n.id) : [];

  const setHops = (h) => {
    if (h === Infinity && bigWarning && !showAllWarned) { setShowAllWarned(true); return; }
    facSet({ hops: h });
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* ---- toolbar: navigation and traversal shape ---- */}
      <div className="cbar" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Exploration history" style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={facBack} disabled={!fac.trail.length} style={btn(fac.trail.length)}
            aria-label="Back to the previously centred facility">← Back</button>
          <button type="button" onClick={facForward} disabled={!fac.forward.length} style={btn(fac.forward.length)}
            aria-label="Forward to the next facility in the exploration history">Forward →</button>
          <button type="button" onClick={facHome} disabled={!fac.rootId || fac.rootId === fac.focusId} style={btn(fac.rootId && fac.rootId !== fac.focusId)}
            aria-label="Return to the facility this exploration started from">⌂ Start</button>
          <button type="button" onClick={facReset} style={btn(true)} aria-label="Reset the playground and choose another facility">Reset</button>
        </div>

        <span style={{ width: 1, height: 18, background: C.line }} aria-hidden />

        <div role="group" aria-label="Traversal direction" style={{ display: 'flex', gap: 4 }}>
          {[['upstream', '← Upstream only'], ['downstream', 'Downstream only →'], ['both', 'Both directions']].map(([k, label]) => (
            <button key={k} type="button" onClick={() => facSet({ direction: k })} aria-pressed={fac.direction === k}
              style={{ ...chipStyle, borderColor: fac.direction === k ? C.copper : C.line, color: fac.direction === k ? C.copper : C.dim }}>
              {label}
            </button>
          ))}
        </div>

        <span style={{ width: 1, height: 18, background: C.line }} aria-hidden />

        <div role="group" aria-label="Hop depth" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: 12, color: C.faint }}>Hops</span>
          {[1, 2, 3].map((h) => (
            <button key={h} type="button" onClick={() => setHops(h)} aria-pressed={fac.hops === h}
              style={{ ...chipStyle, borderColor: fac.hops === h ? C.copper : C.line, color: fac.hops === h ? C.copper : C.dim }}>
              {h}
            </button>
          ))}
          <button type="button" onClick={() => setHops(Infinity)} aria-pressed={fac.hops === Infinity}
            style={{ ...chipStyle, borderColor: fac.hops === Infinity ? C.copper : C.line, color: fac.hops === Infinity ? C.copper : C.dim }}>
            All reachable
          </button>
        </div>
      </div>

      {showAllWarned && fac.hops !== Infinity && (
        <div role="alert" className="mono" style={{ fontSize: 12, color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 6, padding: '8px 11px', lineHeight: 1.6 }}>
          <b>{reachable} facilities</b> are reachable from {focus.name} in the {fac.direction === 'both' ? 'combined' : fac.direction} direction.
          That is more than this graph can lay out legibly — the connection table below stays complete and searchable at any
          depth, and is the better tool for a network this size.
          <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
            <button type="button" onClick={() => { facSet({ hops: Infinity }); setShowAllWarned(false); }} style={{ ...chipStyle, borderColor: C.amber, color: C.amber }}>
              Draw it anyway
            </button>
            <button type="button" onClick={() => { facSet({ hops: 3 }); setShowAllWarned(false); }} style={chipStyle}>
              Three hops instead
            </button>
            <button type="button" onClick={() => setShowAllWarned(false)} style={chipStyle}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) minmax(280px, 340px)', alignItems: 'start' }}>
        {/* ---- left: the graph ---- */}
        <div style={{ minWidth: 0 }}>
          {conn.degree === 0 ? (
            <div className="mono" style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, border: `1px solid ${C.line}`, borderRadius: 6, padding: 14 }}>
              No modeled link touches {focus.name}. That happens when its operator has no customer edge in the sample, or
              when no stage it feeds reaches a customer&apos;s stage — not that the site is unconnected in reality.
            </div>
          ) : (
            <FacilityGraph
              focusId={focus.id}
              traversal={traversal}
              model={model}
              compact={compact}
              maxPerColumn={compact ? 12 : 16}
              expanded={fac.expanded}
              selectedLink={fac.selectedLink}
              routeLinkKeys={routeLinkKeys}
              onFocus={(id) => facFocus(id)}
              onSelect={setSel}
              onSelectLink={facSelectLink}
              onToggleExpand={facToggleExpand}
            />
          )}

          {/* Route highlight between two visible plants */}
          {drawn > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 9 }}>
              <span className="mono" style={{ fontSize: 12, color: C.faint }}>Highlight a route</span>
              <select value={routeFrom} onChange={(e) => setRouteFrom(e.target.value)} aria-label="Route start facility" style={selectStyle}>
                <option value="">from…</option>
                {visibleIds.map((id) => <option key={id} value={id}>{FACILITY_LAYER.FACILITY_BY_ID[id]?.name || id}</option>)}
              </select>
              <select value={routeTo} onChange={(e) => setRouteTo(e.target.value)} aria-label="Route end facility" style={selectStyle}>
                <option value="">to…</option>
                {visibleIds.map((id) => <option key={id} value={id}>{FACILITY_LAYER.FACILITY_BY_ID[id]?.name || id}</option>)}
              </select>
              <button type="button" disabled={!routeFrom || !routeTo} style={btn(routeFrom && routeTo)}
                onClick={() => facSetRoute({ from: routeFrom, to: routeTo })}>Show route</button>
              {fac.route && <button type="button" onClick={() => facSetRoute(null)} style={chipStyle}>Clear route</button>}
              {fac.route && !pg.route && (
                <span className="mono" style={{ fontSize: 12, color: C.amber }}>No modeled path between those two in the current view.</span>
              )}
              {pg.route && (
                <span className="mono" style={{ fontSize: 12, color: C.green }}>
                  {pg.route.links.length} modeled hop{pg.route.links.length === 1 ? '' : 's'} — a sequence of modeled
                  relationships, not an observed route.
                </span>
              )}
            </div>
          )}

          {/* Expanded / collapsed / hidden bookkeeping, always reversible */}
          {(fac.expanded.length > 0 || fac.collapsed.length > 0 || fac.hidden.length > 0) && (
            <div className="mono" style={{ fontSize: 12, color: C.faint, marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {fac.expanded.length > 0 && <span>{fac.expanded.length} branch{fac.expanded.length === 1 ? '' : 'es'} expanded</span>}
              {fac.collapsed.length > 0 && (
                <>
                  <span>{fac.collapsed.length} collapsed</span>
                  <button type="button" onClick={() => fac.collapsed.forEach(facToggleCollapse)} style={chipStyle}>Expand all</button>
                </>
              )}
              {fac.hidden.length > 0 && (
                <>
                  <span style={{ color: C.amber }}>
                    {fac.hidden.length} facility hidden — <b>topology only</b>: this changes what the graph can reach and
                    nothing else. It does not feed the risk model and is not a capacity estimate.
                  </span>
                  <button type="button" onClick={facClearHidden} style={chipStyle}>Restore all</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ---- right: the focused plant, filters, connections ---- */}
        <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          <section aria-label="Focused facility" style={{ border: `1px solid ${C.copperDim}`, borderRadius: 6, padding: '10px 12px', background: C.panel }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
              <span aria-hidden style={{ fontSize: 14 }}>{flagEmoji(focus.country)}</span>
              <h3 style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{focus.name}</h3>
              <TrackButton type="facility" id={focus.id} />
            </div>
            <div className="mono" style={{ fontSize: 12, color: C.copper, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <Logo cid={focus.company} size={12} />
              {COMPANY_BY_ID[focus.company]?.name || focus.company}
            </div>

            <dl style={{ margin: '8px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 9px', fontSize: 12 }}>
              {field('Location', `${COUNTRY_NAMES[focus.country] || focus.country}`)}
              {field('Type', FACILITY_KIND_LABEL[focus.kind] || focus.kind)}
              {field('Stage / function', stageNames.join(', ') || '—')}
              {field('Status', statusLabel(focus.status))}
              {field('Modeled significance', `${focus.scale ?? '—'} of 5 — an analyst ordinal, not measured capacity`)}
              {field('Evidence', focus.source || 'No source recorded for this site.')}
              {field('Relationships', `${edges.inbound.length} inbound · ${edges.outbound.length} outbound · ${conn.degree} total`)}
            </dl>

            {siteWeight(focus) === 0 && (
              <div className="mono" style={{ fontSize: 12, color: C.amber, marginTop: 6, lineHeight: 1.55 }}>
                This site carries no exposure weight yet ({statusLabel(focus.status)}), so it has no output to lose and
                the network builder gives it no links.
              </div>
            )}
            {focus.output && <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.55, marginTop: 6 }}>{focus.output}</div>}

            <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setSel({ type: 'facility', id: focus.id })} style={chipStyle}>Full profile</button>
              <button type="button" onClick={() => { setViewMode('geographic'); setSel({ type: 'facility', id: focus.id }); requestFlyTo?.(focus.country); }} style={chipStyle}>
                Open on the map
              </button>
              <button type="button" onClick={() => setSel({ type: 'company', id: focus.company })} style={chipStyle}>Operator</button>
              {(focus.stages || []).map((s) => (
                <button key={s} type="button" onClick={() => setSel({ type: 'stage', id: s })} style={chipStyle}>
                  {STAGE_BY_ID[s]?.name || s} stage
                </button>
              ))}
              <button type="button" onClick={() => facToggleHidden(focus.id)} disabled={focus.id === fac.rootId} style={btn(focus.id !== fac.rootId)}
                title="Topology only — hides this plant from the graph so you can see how reachability changes. It does not feed the risk model.">
                Hide (topology only)
              </button>
            </div>

            {relatedEvents.length > 0 && (
              <>
                <div className="mono" style={{ fontSize: 12, color: C.faint, margin: '10px 0 4px' }}>
                  EVENTS TOUCHING THIS COUNTRY AND STAGE
                </div>
                <div className="mono" style={{ fontSize: 12, color: C.faint, lineHeight: 1.5, marginBottom: 4 }}>
                  Possible relevance only — the events table records stages and countries, never individual plants.
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }}>
                  {relatedEvents.map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => setSel({ type: 'event', id: e.id })} style={{ ...chipStyle, width: '100%', textAlign: 'left' }}>
                        {e.date} — {e.title.length > 56 ? `${e.title.slice(0, 55)}…` : e.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <PlaygroundFilters filters={filters} setFilters={facSetFilters} active={pg.filtersActive} />

          {selectedLinkObj && (
            <FacilityConnectionDetail
              link={selectedLinkObj}
              viewFrom={focus.id}
              onFocus={(id) => facFocus(id)}
              onSelect={setSel}
              onClose={() => facSelectLink(null)}
            />
          )}

          <section aria-label="Complete connection table" style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: '10px 12px', background: C.panel2 }}>
            <FacilityConnectionTable
              facilityId={focus.id}
              onFocus={(id) => facFocus(id)}
              onSelect={setSel}
              onSelectLink={facSelectLink}
              selectedLink={fac.selectedLink}
              linkFilter={pg.linkFilter}
              compact={compact}
            />
          </section>

          <div style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: '10px 12px', background: C.panel }}>
            <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 5 }}>Change plant</div>
            <FacilitySearch onPick={(id) => facFocus(id, { asRoot: true })} suggestionCount={0} label="Search another facility" />
          </div>
        </div>
      </div>
    </div>
  );
}

function field(label, value) {
  return (
    <>
      <dt className="mono" style={{ fontSize: 12, color: C.faint, whiteSpace: 'nowrap' }}>{label}</dt>
      <dd style={{ margin: 0, color: C.text, lineHeight: 1.5 }}>{value}</dd>
    </>
  );
}

function statusLabel(status) {
  return { operating: 'Operating', ramping: 'Ramping', construction: 'Under construction', idle: 'Idle' }[status] || status || 'unknown';
}

/* ====================================================================
   Filters. Every one of them is built from data already in the snapshot —
   no invented attributes — and every one applies to BOTH the graph and
   the connection table, because a filter that hid a row from the list
   while leaving its line on the graph is the same class of lie as a
   silent truncation.
   ==================================================================== */
function PlaygroundFilters({ filters, setFilters, active }) {
  const { data, engine } = useVault();
  const { FACILITY_LAYER, COMPANY_BY_ID, COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;
  const [open, setOpen] = useState(false);

  const companies = useMemo(() => [...new Set(FACILITY_LAYER.FACILITIES.map((f) => f.company))]
    .map((id) => ({ id, name: COMPANY_BY_ID[id]?.name || id }))
    .sort((a, b) => a.name.localeCompare(b.name)), [FACILITY_LAYER, COMPANY_BY_ID]);
  const countries = useMemo(() => [...new Set(FACILITY_LAYER.FACILITIES.map((f) => f.country))]
    .map((id) => ({ id, name: COUNTRY_NAMES[id] || id }))
    .sort((a, b) => a.name.localeCompare(b.name)), [FACILITY_LAYER, COUNTRY_NAMES]);
  const stages = useMemo(() => [...new Set(FACILITY_LAYER.FACILITIES.flatMap((f) => f.stages || []))]
    .map((id) => ({ id, name: STAGE_BY_ID[id]?.name || id }))
    .sort((a, b) => a.name.localeCompare(b.name)), [FACILITY_LAYER, STAGE_BY_ID]);
  const kinds = useMemo(() => [...new Set(FACILITY_LAYER.FACILITIES.map((f) => f.kind))], [FACILITY_LAYER]);

  const sel = (label, key, options, placeholder) => (
    <label style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <span className="mono" style={{ fontSize: 12, color: C.faint }}>{label}</span>
      <select value={filters[key]} onChange={(e) => setFilters({ [key]: e.target.value })} style={selectStyle}>
        <option value={key === 'relClass' || key === 'status' || key === 'evidence' ? 'all' : ''}>{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>
  );

  return (
    <section aria-label="Network filters" style={{ border: `1px solid ${active ? C.copperDim : C.line}`, borderRadius: 6, padding: '9px 11px', background: C.panel }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          style={{ ...chipStyle, borderColor: active ? C.copper : C.line, color: active ? C.copper : C.dim }}>
          {open ? '▾' : '▸'} Filters{active ? ' · active' : ''}
        </button>
        {active && <button type="button" onClick={() => setFilters(null)} style={chipStyle}>Clear all</button>}
        <span className="mono" style={{ fontSize: 12, color: C.faint, marginLeft: 'auto' }}>graph + table</span>
      </div>

      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 7, marginTop: 9 }}>
          {sel('Relationship', 'relClass', Object.values(RELATIONSHIP_CLASSES).map((r) => ({ id: r.id, name: r.label })), 'Any relationship')}
          {sel('COMPANY', 'company', companies, 'Any company')}
          {sel('COUNTRY', 'country', countries, 'Any country')}
          {sel('STAGE', 'stage', stages, 'Any stage')}
          {sel('Facility type', 'kind', kinds.map((k) => ({ id: k, name: FACILITY_KIND_LABEL[k] || k })), 'Any type')}
          {sel('STATUS', 'status', ['operating', 'ramping', 'construction'].map((s) => ({ id: s, name: statusLabel(s) })), 'Any status')}
          {sel('Evidence', 'evidence', Object.values(EVIDENCE_TIERS).map((e) => ({ id: e.id, name: e.label })), 'Any evidence tier')}
          <label style={{ display: 'grid', gap: 2 }}>
            <span className="mono" style={{ fontSize: 12, color: C.faint }}>
              MIN. STRENGTH — {(Number(filters.minRel) * 100).toFixed(0)}% (snapshot scale)
            </span>
            <input type="range" min="0" max="0.5" step="0.01" value={filters.minRel}
              onChange={(e) => setFilters({ minRel: Number(e.target.value) })}
              aria-label="Minimum modeled relationship strength, as a share of the strongest modeled link in the snapshot"
              aria-valuetext={`${(Number(filters.minRel) * 100).toFixed(0)} percent of the strongest modeled link in the snapshot`} />
          </label>
        </div>
      )}
    </section>
  );
}

const chipStyle = {
  fontSize: 12, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
  background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, minHeight: 0,
};
const selectStyle = {
  background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text,
  fontFamily: 'inherit', fontSize: 12, padding: '4px 6px', minWidth: 0, maxWidth: '100%',
};
function btn(enabled) {
  return { ...chipStyle, cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.45 };
}
