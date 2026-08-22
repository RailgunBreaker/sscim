import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { mapEncoding, fmtSigned, pct } from '../interaction/lensEncoding.js';
import { riskLabel } from '../utils/colors.js';
import { buildTooltipEl, buildCountryPopupEl, buildFacilityPopupEl } from '../utils/tooltip.js';
import { introForCountry, flagEmoji } from '../data/glossary.js';
import { hazardFootprint, facilityImpact, siteWeight } from '../engine/facilities.js';
import { facilityConnectivity } from '../engine/facilityNetwork.js';
import { facilityIconHtml, facilityLegendItems, IDLE_COLOR, FACILITY_KIND_LABEL as KIND_LABEL } from '../utils/facilityIcon.js';
import { useWatchlist } from '../interaction/WatchlistContext.jsx';
import Legend from './Legend.jsx';
import CountryList from './CountryList.jsx';
import HazardPanel, { facilityImpactLine } from './HazardPanel.jsx';

/* Sites are drawn at EVERY zoom. They used to be hidden below zoom 4, on the
   theory that a few hundred plant markers at world zoom would be a smear —
   which was wrong twice over. It made the layer invisible on load, so the
   honest reading of the map was "there are no facilities"; and it made the
   one question the site layer exists to answer — where in the WORLD is this
   industry — the one question you could not ask, because you can only see a
   region at a time from zoom 4.

   What actually needed solving was legibility, not visibility: markers shrink
   with the zoom so the world view reads as a distribution and the regional
   view reads as individual plants. The SITES toggle turns the layer off for
   anyone who wants the country markers alone. */
const siteZoomScale = (zoom) => Math.max(0.45, Math.min(1, (Number(zoom ?? 2) - 1) / 4));

/* ================= OpenStreetMap layer =================
   Country markers are encoded by the ACTIVE LENS (structural / operational
   / scenario Δ / selected-share), not always structural — see §4/§5 and
   interaction/lensEncoding.js. Rich hover tooltips and permanent labels
   are kept on SEPARATE Leaflet layers (a single layer supports only one
   bound tooltip; the old code bound a permanent label on top of the rich
   tooltip on the same layer, silently hiding the hover detail for the
   highest-weight countries). Links are the sample's modeled
   supplier-revenue relationship between company HQ countries — not
   measured bilateral trade. */
function legendFor(lens, legend) {
  if (lens === 'operational' || lens === 'delta') {
    return {
      items: [['adverse', C.red], ['moderate', C.amber], ['mitigating', C.green], ['~neutral', C.faint]],
      note: legend.note,
    };
  }
  if (lens === 'share') {
    return {
      items: [['higher share', C.copper], ['lower share', C.copperDim], ['none', C.faint]],
      note: legend.encoding + ' · ' + legend.note,
    };
  }
  return {
    items: [['Moderate < 5.5', C.green], ['Elevated 5.5–7.5', C.amber], ['High ≥ 7.5', C.red]],
    note: legend.encoding + ' · ' + legend.note,
  };
}

export default function OsmMap({ model, hl, lensOverride, onApplyHazard }) {
  const { data, engine } = useVault();
  const { COUNTRY_NAMES, COUNTRY_POS, COMPANIES, COMPANY_BY_ID, FACILITY_LAYER, FACILITY_NETWORK } = data;
  const { COUNTRY_LINKS, STAGE_BY_ID } = engine;
  const { state, select, hover, clearHover, subscribeFlyTo } = useInteraction();
  const { selected, scenarioActive } = state;
  const { items: watched, toggle: toggleWatch } = useWatchlist();
  // The comparison toggle (§12) can override the global lens for this panel.
  const lens = lensOverride ?? state.lens;
  const sel = selected || { type: null, id: null };

  const divRef = useRef(null), mapRef = useRef(null), layerRef = useRef(null);
  const siteLayerRef = useRef(null), siteNetLayerRef = useRef(null), hazardLayerRef = useRef(null);
  const coreByCountry = useRef({});
  const [tileStatus, setTileStatus] = useState('loading');
  const [mapHeight, setMapHeight] = useState(350);

  /* ---- site layer + hazard tool (§ facility scale) ---------------------- */
  const [zoom, setZoom] = useState(2);
  const [sitesOn, setSitesOn] = useState(true);
  const [linksOn, setLinksOn] = useState(false);
  const [hazardMode, setHazardMode] = useState(false);
  const [hazard, setHazard] = useState(null);        // { lat, lng } epicentre
  const [radiusKm, setRadiusKm] = useState(200);
  const hazardModeRef = useRef(hazardMode); hazardModeRef.current = hazardMode;

  const footprint = useMemo(
    () => (hazard ? hazardFootprint({ ...hazard, radiusKm }, FACILITY_LAYER) : null),
    [hazard, radiusKm, FACILITY_LAYER],
  );
  const insideIds = useMemo(
    () => new Set((footprint?.hits || []).map((h) => h.facility.id)),
    [footprint],
  );
  const sitesVisible = sitesOn;

  // Stable handler refs so the flyTo subscription and marker callbacks always
  // see the latest select/hover/watchlist state without re-subscribing or
  // forcing the heavy marker effect to rebuild on every change.
  const selectRef = useRef(select); selectRef.current = select;
  const hoverRef = useRef(hover); hoverRef.current = hover;
  const clearHoverRef = useRef(clearHover); clearHoverRef.current = clearHover;
  const toggleWatchRef = useRef(toggleWatch); toggleWatchRef.current = toggleWatch;

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      center: [32, 70], zoom: 2, minZoom: 1, maxZoom: 7,
      worldCopyJump: true, zoomControl: false, attributionControl: true,
    });
    let fellBack = false, loaded = false;
    const carto = L.tileLayer('https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO', subdomains: 'abcd',
    }).addTo(map);
    carto.on('tileload', () => { loaded = true; setTileStatus('ok'); });
    carto.on('tileerror', () => {
      if (fellBack) return; fellBack = true;
      map.removeLayer(carto);
      const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', className: 'osm-soft',
      }).addTo(map);
      osm.on('tileload', () => { loaded = true; setTileStatus('ok'); });
    });
    setTimeout(() => { if (!loaded) setTileStatus('failed'); }, 6000);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    // Added after the country group, so plant markers draw above it: once you
    // are zoomed in far enough to see sites, a click near a country centroid
    // means the plant, not the country.
    siteNetLayerRef.current = L.layerGroup().addTo(map);
    siteLayerRef.current = L.layerGroup().addTo(map);
    hazardLayerRef.current = L.layerGroup().addTo(map);

    // Zoom drives how large the plant markers are drawn (siteZoomScale).
    setZoom(map.getZoom());
    map.on('zoomend', () => setZoom(map.getZoom()));

    // In hazard mode a click on the basemap places the epicentre. Read the
    // mode from a ref so this handler is bound once and never restaged.
    map.on('click', (ev) => {
      if (!hazardModeRef.current) return;
      setHazard({ lat: ev.latlng.lat, lng: ev.latlng.lng });
      setHazardMode(false);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // The crosshair cursor is the only signal that the next click means
  // something different, so keep it tied to the mode rather than to a button.
  useEffect(() => {
    const el = divRef.current;
    if (el) el.style.cursor = hazardMode ? 'crosshair' : '';
  }, [hazardMode]);

  // Cross-panel selection → fly the map to the country and open its popup (§5).
  useEffect(() => {
    return subscribeFlyTo((cid) => {
      const map = mapRef.current;
      if (!map || !COUNTRY_POS[cid]) return;
      map.flyTo(COUNTRY_POS[cid], Math.max(map.getZoom(), 3), { duration: 0.6 });
      const core = coreByCountry.current[cid];
      if (core) setTimeout(() => core.openPopup(), 640);
    });
  }, [subscribeFlyTo, COUNTRY_POS]);

  // Rebuild markers/links when the model, lens, or pinned selection changes.
  // Deliberately NOT keyed on `hovered` — hover only lights the industry
  // graph, so the map does not tear down and rebuild every layer on
  // pointer move (see §7 performance).
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    const g = layerRef.current;
    g.clearLayers();
    coreByCountry.current = {};
    const dimAll = hl.c.size > 0;
    const countries = model.countriesActive;
    const countriesBase = model.countriesBase;
    const { enc, legend } = mapEncoding({ lens, model, engine, data, selected: sel });

    COUNTRY_LINKS.slice(0, 30).forEach((l) => {
      const involved = hl.c.has(l.a) || hl.c.has(l.b);
      const lit = (hl.c.has(l.a) && hl.c.has(l.b)) || (sel.type === 'country' && (sel.id === l.a || sel.id === l.b));
      const line = L.polyline([COUNTRY_POS[l.a], COUNTRY_POS[l.b]], {
        color: lit ? C.copper : C.copperDim,
        weight: 0.6 + 2.4 * Math.min(1, l.w / 1.2),
        opacity: lit ? 0.95 : dimAll ? (involved ? 0.5 : 0.08) : 0.3,
        dashArray: '4 7',
      });
      line.bindTooltip(
        () => buildTooltipEl([
          { text: `${COUNTRY_NAMES[l.a]} (HQ) → ${COUNTRY_NAMES[l.b]} (HQ)`, bold: true },
          { text: l.top.join(' · '), size: '10px' },
          { text: l.ex.join(' · '), color: C.faint, size: '9px' },
          { text: 'modeled supplier-revenue relationship weight — sample coverage only, not measured bilateral trade', color: C.faint, size: '8.5px' },
        ]),
        { className: 'sscim-tip', sticky: true }
      );
      line.addTo(g);
    });

    Object.entries(countries).forEach(([id, c]) => {
      const e = enc[id] || {};
      const col = e.color || C.faint;
      const active = hl.c.has(id);
      const isSel = sel.type === 'country' && sel.id === id;
      const r = 6 + 14 * (e.sizeFactor ?? 0.3);
      const opDelta = c.operational - (countriesBase[id]?.operational ?? c.operational);

      const halo = L.circleMarker(COUNTRY_POS[id], {
        radius: r, color: col, weight: active ? 1.5 : 0, fillColor: col,
        fillOpacity: dimAll && !active ? 0.06 : 0.16, opacity: 0.8,
      }).addTo(g);
      const core = L.circleMarker(COUNTRY_POS[id], {
        radius: r * 0.5, color: col, weight: 1, fillColor: col,
        fillOpacity: dimAll && !active ? 0.3 : 0.9,
      }).addTo(g);
      coreByCountry.current[id] = core;

      // Selected-country outline — independent of the marker color (§5).
      if (isSel) {
        L.circleMarker(COUNTRY_POS[id], {
          radius: r + 4, color: C.text, weight: 2, fill: false, dashArray: '3 4', opacity: 0.95,
        }).addTo(g);
      }

      // Rich hover tooltip (kept on the core layer).
      const tipLines = [
        { text: COUNTRY_NAMES[id], bold: true },
        { text: `structural vulnerability ${c.structural.toFixed(1)} ${riskLabel(c.structural)}`, color: C.dim, size: '10px' },
        { text: `operational impact ${fmtSigned(c.operational)}`, color: C.faint, size: '10px' },
      ];
      if (lens === 'share' && sel.type === 'stage') {
        const share = STAGE_BY_ID[sel.id]?.shares?.[id] ?? 0;
        tipLines.push({ text: `share of ${STAGE_BY_ID[sel.id]?.name}: ${pct(share)}`, color: C.copper, size: '10px' });
      }
      if (scenarioActive && Math.abs(opDelta) > 0.02) {
        tipLines.push({ text: `scenario Δ ${fmtSigned(opDelta)} vs baseline`, color: C.copper, size: '10px' });
      }
      core.bindTooltip(() => buildTooltipEl(tipLines), { className: 'sscim-tip', direction: 'top', offset: [0, -r * 0.5 - 2] });

      // Permanent label for high-participation / high-value countries — on a
      // SEPARATE standalone tooltip layer, so it never displaces the rich
      // hover tooltip above (the previous bug).
      if ((e.sizeFactor ?? 0) > 0.35 || (e.badge && lens === 'share' && e.value > 0.25)) {
        const label = L.tooltip({
          permanent: true, direction: 'bottom', className: 'sscim-label',
          offset: [0, r * 0.5 + 2], interactive: false,
        }).setLatLng(COUNTRY_POS[id]).setContent(`${COUNTRY_NAMES[id]}${e.badge ? ' ' + e.badge : ''}`);
        g.addLayer(label);
      }

      const hqCompanies = COMPANIES.filter((co) => co.country === id);
      core.bindPopup(() => buildCountryPopupEl({
        flag: flagEmoji(id), name: COUNTRY_NAMES[id],
        intro: introForCountry(id, { COUNTRY_NAMES, STAGE_BY_ID, COMPANIES }, model),
        companies: hqCompanies, colors: C,
        onSelectCompany: (cid) => selectRef.current({ type: 'company', id: cid }),
      }), { className: 'sscim-tip', maxWidth: 280 });

      // A click inspects the country and opens its popup. (Shift-click used to
      // mark a scenario shock source; scenario authoring is gone — the map is
      // a live read, and hypotheses come from the hazard tool alone.)
      const go = () => {
        selectRef.current({ type: 'country', id }, { fly: false });
        core.openPopup();
      };
      halo.on('click', go); core.on('click', go);
      // Hovering a country lights its related industry stages (§5) via shared state.
      const onOver = () => hoverRef.current({ type: 'country', id });
      const onOut = () => clearHoverRef.current();
      halo.on('mouseover', onOver); core.on('mouseover', onOver);
      halo.on('mouseout', onOut); core.on('mouseout', onOut);
    });
  }, [model, lens, sel.type, sel.id, hl, scenarioActive]);

  /* ---- site layer -------------------------------------------------------
     One marker per modeled plant, on its OWN overlay group so panning past
     zooming or moving the hazard never rebuilds the country markers above.
     Colour is the current operational field at the stages the site feeds —
     the same signed field the country markers use — so a recovery event reads
     green here exactly as it does there. Size is the site's ordinal scale;
     a construction site is drawn hollow because it has no output to lose. */
  useEffect(() => {
    const g = siteLayerRef.current;
    if (!g) return;
    g.clearLayers();
    if (!sitesVisible) return;

    const field = model.activeField || {};
    const watchedSites = new Set(watched.filter((w) => w.type === 'facility').map((w) => w.id));

    FACILITY_LAYER.FACILITIES.forEach((f) => {
      const impact = facilityImpact(f, field);
      const live = siteWeight(f) > 0;
      const inside = insideIds.has(f.id);
      const pinned = sel.type === 'facility' && sel.id === f.id;
      const tracked = watchedSites.has(f.id);
      /* Size carries significance gently — the ordinal is a judgement, and a
         5 at three times the area of a 2 would read as a measurement — and is
         then scaled by zoom so the same layer works as a world distribution
         and as a regional plant map. Shape carries function, colour carries
         state; see utils/facilityIcon.js for why those two were split. */
      const size = Math.round((11 + 1.8 * (f.scale ?? 1)) * siteZoomScale(zoom));

      const marker = L.marker([f.lat, f.lng], {
        icon: L.divIcon({
          className: tracked ? 'sscim-site sscim-site-tracked' : 'sscim-site',
          html: facilityIconHtml({ kind: f.kind, impact, live, size, selected: pinned, inHazard: inside }),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        keyboard: false,
        zIndexOffset: pinned ? 600 : inside ? 400 : tracked ? 200 : 0,
      }).addTo(g);

      const stageNames = (f.stages || []).map((sid) => STAGE_BY_ID[sid]?.name || sid);
      marker.bindTooltip(
        () => buildTooltipEl([
          { text: f.name, bold: true },
          { text: `${KIND_LABEL[f.kind] || f.kind} · ${COMPANY_BY_ID[f.company]?.name || f.company}`, color: C.copper, size: '10px' },
          { text: f.output || '', color: C.dim, size: '9.5px' },
          { text: stageNames.join(' · '), color: C.faint, size: '9px' },
          tracked ? { text: '★ on your watchlist', color: C.amber, size: '9px' } : null,
        ].filter(Boolean)),
        { className: 'sscim-tip', direction: 'top', offset: [0, -size / 2 - 2] },
      );

      const conn = facilityConnectivity(FACILITY_NETWORK, f.id);
      marker.bindPopup(() => buildFacilityPopupEl({
        facility: f,
        operatorName: COMPANY_BY_ID[f.company]?.name || f.company,
        stageNames,
        impactLine: facilityImpactLine(impact),
        shareLines: [
          ...(f.stages || []).map((sid) => {
            const share = FACILITY_LAYER.shareOfStage(f, sid);
            return `${Math.round(share * 100)}% of modeled ${STAGE_BY_ID[sid]?.name || sid} sites`;
          }),
          conn.degree ? `${conn.degree} modeled site-to-site link${conn.degree === 1 ? '' : 's'}` : null,
        ].filter(Boolean),
        colors: C,
        tracked,
        onSelectCompany: (cid) => selectRef.current({ type: 'company', id: cid }),
        onOpenProfile: (site) => selectRef.current({ type: 'facility', id: site.id }, { fly: false }),
        onToggleTrack: (site) => toggleWatchRef.current({ type: 'facility', id: site.id }),
      }), { className: 'sscim-tip', maxWidth: 300 });

      // Clicking a plant pins it everywhere, which is what opens its profile
      // panel; the popup stays as the on-map summary.
      marker.on('click', () => {
        selectRef.current({ type: 'facility', id: f.id }, { fly: false });
        marker.openPopup();
      });
    });
  }, [sitesVisible, zoom, model.activeField, insideIds, sel.type, sel.id, watched, FACILITY_LAYER, FACILITY_NETWORK, STAGE_BY_ID, COMPANY_BY_ID]);

  /* ---- site-to-site network --------------------------------------------
     Modeled links, not shipment routes (engine/facilityNetwork.js). Drawn on
     their own group beneath the markers, and only when the site layer is
     showing — links between markers you cannot see are noise. When a site is
     pinned, only its own links are drawn, which is the difference between a
     hairball and an answer. */
  useEffect(() => {
    const g = siteNetLayerRef.current;
    if (!g) return;
    g.clearLayers();
    if (!linksOn || !sitesVisible || !FACILITY_NETWORK) return;

    const pinned = sel.type === 'facility' ? sel.id : null;
    // Pinned: every link that touches this site. Unpinned: the capped set,
    // because 800 lines over a world map is a texture, not a network.
    const links = pinned
      ? [...(FACILITY_NETWORK.linksByFacility[pinned]?.outbound || []),
         ...(FACILITY_NETWORK.linksByFacility[pinned]?.inbound || [])]
      : FACILITY_NETWORK.displayLinks;
    const maxW = links.reduce((m, l) => Math.max(m, l.weight), 1e-9);

    links.forEach((l) => {
      const a = FACILITY_LAYER.FACILITY_BY_ID[l.from];
      const b = FACILITY_LAYER.FACILITY_BY_ID[l.to];
      if (!a || !b) return;
      const rel = l.weight / maxW;
      const line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
        color: pinned ? C.copper : C.copperDim,
        weight: 0.4 + 2.2 * rel,
        opacity: pinned ? 0.85 : 0.16 + 0.5 * rel,
        // A service relationship (the invoice and the die move opposite ways,
        // as with an OSAT packaging a fabless firm's silicon) is dashed, so
        // the two kinds of link are never read as the same thing.
        dashArray: l.flow === 'service' ? '3 5' : null,
        interactive: true,
      }).addTo(g);
      line.bindTooltip(
        () => buildTooltipEl([
          { text: `${a.name} → ${b.name}`, bold: true },
          { text: l.flow === 'service'
            ? `${STAGE_BY_ID[l.toStage]?.name || l.toStage} → ${STAGE_BY_ID[l.fromStage]?.name || l.fromStage} (service relationship: the die flows toward the supplier and back)`
            : `${STAGE_BY_ID[l.fromStage]?.name || l.fromStage} → ${STAGE_BY_ID[l.toStage]?.name || l.toStage}`, color: C.copper, size: '10px' },
          { text: `${COMPANY_BY_ID[l.fromCompany]?.name || l.fromCompany} → ${COMPANY_BY_ID[l.toCompany]?.name || l.toCompany} · supplier-revenue share ${Math.round(l.companyShare * 100)}%`, color: C.dim, size: '9.5px' },
          { text: `modeled link weight ${l.weight.toFixed(4)}`, color: C.faint, size: '9px' },
          { text: 'modeled site-to-site link — company revenue share × site shares × input-dependence prior. Not a shipment route.', color: C.faint, size: '8.5px' },
        ]),
        { className: 'sscim-tip', sticky: true },
      );
    });
  }, [linksOn, sitesVisible, FACILITY_NETWORK, FACILITY_LAYER, sel.type, sel.id, STAGE_BY_ID, COMPANY_BY_ID]);

  /* ---- hazard ring ------------------------------------------------------
     The radius is a SCREENING circle, not a damage model: it says which
     modeled plants are close enough that a human should look, which is
     exactly what the USGS ingest filter does upstream (server/src/ingest/
     usgs.mjs FAB_CLUSTERS). Nothing here models shaking intensity. */
  useEffect(() => {
    const g = hazardLayerRef.current;
    if (!g) return;
    g.clearLayers();
    if (!hazard) return;
    L.circle([hazard.lat, hazard.lng], {
      radius: radiusKm * 1000,
      color: C.amber, weight: 1.6, dashArray: '5 6', fillColor: C.amber, fillOpacity: 0.06,
      interactive: false,
    }).addTo(g);
    L.circleMarker([hazard.lat, hazard.lng], {
      radius: 4, color: C.amber, weight: 2, fillColor: C.amber, fillOpacity: 0.9, interactive: false,
    }).addTo(g);
  }, [hazard, radiusKm]);

  const { legend } = mapEncoding({ lens, model, engine, data, selected: sel });
  const lg = legendFor(lens, legend);

  return (
    <div style={{ padding: 10 }}>
      <div className="mono" style={{ fontSize: 9.5, letterSpacing: 1, color: C.copper, marginBottom: 6 }}>
        {legend.title.toUpperCase()}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '-1px 0 6px' }}>
        <button type="button" onClick={() => setSitesOn((v) => !v)} aria-pressed={sitesOn}
          title={`Show the ${FACILITY_LAYER.FACILITIES.length} modeled plants. Drawn at every zoom; markers grow as you zoom in.`}
          style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
            background: sitesOn ? C.copper : 'transparent', color: sitesOn ? '#0C111C' : C.dim,
            border: `1px solid ${sitesOn ? C.copper : C.line}`, fontWeight: sitesOn ? 700 : 400 }}>
          ▦ SITES
        </button>
        <button type="button" onClick={() => setLinksOn((v) => !v)} aria-pressed={linksOn}
          title="Draw the modeled site-to-site links. Pin a plant to see only its own links."
          style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
            background: linksOn ? C.copperDim : 'transparent', color: linksOn ? '#0C111C' : C.dim,
            border: `1px solid ${linksOn ? C.copperDim : C.line}`, fontWeight: linksOn ? 700 : 400 }}>
          ⇄ LINKS
        </button>
        <button type="button" onClick={() => { setHazardMode((v) => !v); }} aria-pressed={hazardMode}
          title="Click the map to place a hazard epicentre and see which plants fall inside the radius"
          style={{ fontSize: 10, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
            background: hazardMode ? C.amber : 'transparent', color: hazardMode ? '#0C111C' : C.dim,
            border: `1px solid ${hazardMode ? C.amber : C.line}`, fontWeight: hazardMode ? 700 : 400 }}>
          ⌖ HAZARD
        </button>
        <span className="mono" style={{ fontSize: 9, color: C.faint }}>
          {hazardMode ? 'click the map to drop an epicentre'
            : sitesVisible ? `${FACILITY_LAYER.FACILITIES.length} plants${linksOn
              ? sel.type === 'facility'
                ? ' · showing every link of the pinned plant'
                : ` · drawing the strongest ${FACILITY_NETWORK?.stats.shown ?? 0} of ${FACILITY_NETWORK?.stats.built ?? 0} modeled links — pin a plant for all of its own`
              : ''}` : ''}
        </span>
        <label className="mono" style={{ fontSize: 9, color: C.faint, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>MAP SIZE
          <input type="range" min="260" max="620" step="20" value={mapHeight} onChange={(e) => { setMapHeight(Number(e.target.value)); setTimeout(() => mapRef.current?.invalidateSize(), 0); }} aria-label="Map height" style={{ width: 84, accentColor: C.copper }} />
          <span style={{ color: C.dim }}>{mapHeight}px</span>
        </label>
      </div>
      <div style={{ position: 'relative' }}>
        <div ref={divRef} className="sscim-map" style={{ height: mapHeight, borderRadius: 8, border: `1px solid ${C.line}`, transition: 'height .2s ease' }} />
        {tileStatus === 'failed' && (
          <div className="mono" style={{ position: 'absolute', top: 8, left: 8, zIndex: 500, background: 'rgba(20,27,43,.92)', border: `1px solid ${C.amber}`, color: C.amber, borderRadius: 5, padding: '5px 9px', fontSize: 10, maxWidth: 260, lineHeight: 1.5 }}>
            Map tiles blocked in this preview. Nodes & links remain interactive — deploy the HTML to any host to see the full basemap.
          </div>
        )}
      </div>
      <Legend items={lg.items} note={lg.note} />

      {/* Shape key. Drawn with the same generator as the markers, so the key
          cannot drift from the map it explains. Only shown when sites are. */}
      {sitesVisible && (
        <div style={{ marginTop: 6 }}>
          <div className="mono" style={{ fontSize: 8.5, letterSpacing: 1.2, color: C.faint, marginBottom: 3 }}>
            PLANT SHAPE = FUNCTION IN THE CHAIN · COLOUR = LIVE EFFECT
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {facilityLegendItems(12).map((it) => (
              <span key={it.kind} className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: C.dim }}>
                <span aria-hidden style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: it.html }} />
                {it.label}
              </span>
            ))}
            <span className="mono" style={{ fontSize: 9, color: C.faint, display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: IDLE_COLOR }}>● quiet</span>
              <span style={{ color: C.amber }}>● moderate</span>
              <span style={{ color: C.red }}>● adverse</span>
              <span style={{ color: C.green }}>● mitigating</span>
              <span>· hollow = no output to lose (construction or idle) · white ring = pinned · amber ring = in the hazard radius</span>
            </span>
          </div>
        </div>
      )}

      {footprint && (
        <HazardPanel footprint={footprint} radiusKm={radiusKm} onApplyHazard={onApplyHazard}
          onRadiusChange={setRadiusKm} onClear={() => { setHazard(null); setHazardMode(false); onApplyHazard?.(null); }} />
      )}
      <CountryList model={model} />
    </div>
  );
}
