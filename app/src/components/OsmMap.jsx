import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { riskColor, riskLabel } from '../utils/colors.js';
import { buildTooltipEl } from '../utils/tooltip.js';
import Legend from './Legend.jsx';

/* ================= OpenStreetMap layer =================
   leaflet is a real npm dependency now — imported directly instead of
   injected from a CDN <script>, so there's no loading-state hook needed.
   Country circles are colored/sized by STRUCTURAL vulnerability (time-
   invariant); the operational scenario delta is shown separately in the
   tooltip and the permanent label, never blended into one number. Links
   are the sample's supplier-revenue relationship between company
   headquarters countries — not a measurement of bilateral trade or
   physical shipping routes. */
export default function OsmMap({ sel, setSel, hl, model, scenarioActive }) {
  const { data, engine } = useVault();
  const { COUNTRY_NAMES, COUNTRY_POS } = data;
  const { COUNTRY_LINKS } = engine;
  const divRef = useRef(null), mapRef = useRef(null), layerRef = useRef(null);
  const selRef = useRef(setSel); selRef.current = setSel;
  const [tileStatus, setTileStatus] = useState("loading");

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, {
      center: [32, 70], zoom: 2, minZoom: 1, maxZoom: 7,
      worldCopyJump: true, zoomControl: false, attributionControl: true,
    });
    /* CARTO dark basemap (OpenStreetMap data, natively dark — no filter needed) */
    let fellBack = false, loaded = false;
    const carto = L.tileLayer("https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap contributors © CARTO", subdomains: "abcd",
    }).addTo(map);
    carto.on("tileload", () => { loaded = true; setTileStatus("ok"); });
    carto.on("tileerror", () => {
      if (fellBack) return; fellBack = true;
      map.removeLayer(carto);
      const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors", className: "osm-soft",
      }).addTo(map);
      osm.on("tileload", () => { loaded = true; setTileStatus("ok"); });
    });
    setTimeout(() => { if (!loaded) setTileStatus("failed"); }, 6000);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    const g = layerRef.current;
    g.clearLayers();
    const dimAll = hl.c.size > 0;
    const countries = model.countriesActive;
    const countriesBase = model.countriesBase;

    COUNTRY_LINKS.slice(0, 30).forEach((l) => {
      const involved = hl.c.has(l.a) || hl.c.has(l.b);
      const lit = (hl.c.has(l.a) && hl.c.has(l.b)) || (sel.type === "country" && (sel.id === l.a || sel.id === l.b));
      const line = L.polyline([COUNTRY_POS[l.a], COUNTRY_POS[l.b]], {
        color: lit ? C.copper : C.copperDim,
        weight: 0.6 + 2.4 * Math.min(1, l.w / 1.2),
        opacity: lit ? 0.95 : dimAll ? (involved ? 0.5 : 0.08) : 0.3,
        dashArray: "4 7",
      });
      line.bindTooltip(
        () => buildTooltipEl([
          { text: `${COUNTRY_NAMES[l.a]} (HQ) → ${COUNTRY_NAMES[l.b]} (HQ)`, bold: true },
          { text: l.top.join(" · "), size: "10px" },
          { text: l.ex.join(" · "), color: C.faint, size: "9px" },
          { text: "modeled supplier-revenue relationship weight — sample coverage only, not measured bilateral trade", color: C.faint, size: "8.5px" },
        ]),
        { className: "sscim-tip", sticky: true }
      );
      line.addTo(g);
    });

    const maxW = Math.max(...Object.values(countries).map((c) => c.weight), 1e-9);
    Object.entries(countries).forEach(([id, c]) => {
      const col = riskColor(c.structural);
      const active = hl.c.has(id);
      const isSel = sel.type === "country" && sel.id === id;
      const r = 6 + 12 * (c.weight / maxW);
      const opDelta = c.operational - (countriesBase[id]?.operational ?? c.operational);
      const halo = L.circleMarker(COUNTRY_POS[id], {
        radius: r, color: col, weight: active ? 1.5 : 0, fillColor: col,
        fillOpacity: dimAll && !active ? 0.06 : 0.16, opacity: 0.8,
      }).addTo(g);
      const core = L.circleMarker(COUNTRY_POS[id], {
        radius: r * 0.5, color: isSel ? C.text : col, weight: isSel ? 2 : 1,
        fillColor: col, fillOpacity: dimAll && !active ? 0.3 : 0.9,
      }).addTo(g);
      const tipLines = [
        { text: COUNTRY_NAMES[id], bold: true },
        { text: `structural vulnerability ${c.structural.toFixed(1)} ${riskLabel(c.structural)}`, color: col, size: "10px" },
        { text: `operational impact ${c.operational >= 0 ? "+" : ""}${c.operational.toFixed(2)}`, color: C.faint, size: "10px" },
      ];
      if (scenarioActive && Math.abs(opDelta) > 0.02) {
        tipLines.push({ text: `scenario Δ ${opDelta >= 0 ? "+" : ""}${opDelta.toFixed(2)} vs baseline`, color: C.copper, size: "10px" });
      }
      core.bindTooltip(() => buildTooltipEl(tipLines), { className: "sscim-tip", direction: "top", offset: [0, -r * 0.5 - 2] });
      if (c.weight / maxW > 0.35) {
        core.bindTooltip(
          () => buildTooltipEl([{ text: `${COUNTRY_NAMES[id]} ${c.structural.toFixed(1)}`, color: col }]),
          { permanent: true, className: "sscim-label", direction: "bottom", offset: [0, r * 0.5 + 2] }
        );
      }
      const go = () => selRef.current({ type: "country", id });
      halo.on("click", go); core.on("click", go);
    });
  }, [model, sel, hl, scenarioActive]);

  return (
    <div style={{ padding: 10 }}>
      <div style={{ position: "relative" }}>
        <div ref={divRef} className="sscim-map" style={{ height: 350, borderRadius: 6, border: `1px solid ${C.line}` }} />
        {tileStatus === "failed" && (
          <div className="mono" style={{ position: "absolute", top: 8, left: 8, zIndex: 500, background: "rgba(20,27,43,.92)", border: `1px solid ${C.amber}`, color: C.amber, borderRadius: 5, padding: "5px 9px", fontSize: 10, maxWidth: 260, lineHeight: 1.5 }}>
            Map tiles blocked in this preview. Nodes & links remain interactive — deploy the HTML to any host to see the full basemap.
          </div>
        )}
      </div>
      <Legend items={[["Moderate < 5.5", C.green], ["Elevated 5.5–7.5", C.amber], ["High ≥ 7.5", C.red], ["Link width = modeled supplier-revenue relationship weight (HQ↔HQ, sample only)", C.copperDim]]}
        note="Color/size = structural vulnerability · hover a country for its operational impact & scenario Δ · links aggregate sample supplier-revenue shares between company headquarters, not measured trade" />
    </div>
  );
}
