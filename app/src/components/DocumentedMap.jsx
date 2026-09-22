import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { C } from '../theme.js';

export default function DocumentedMap({ facilities, companyId, onSelect }) {
  const host = useRef(null), map = useRef(null);
  const [tiles, setTiles] = useState('loading');
  useEffect(() => {
    map.current = L.map(host.current, { center: [25, 20], zoom: 2, scrollWheelZoom: false });
    const tilesLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 18,
    });
    tilesLayer.on('tileload', () => setTiles('ready')).on('tileerror', () => setTiles(current => current === 'ready' ? current : 'unavailable')).addTo(map.current);
    return () => { map.current.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const layer = L.layerGroup().addTo(map.current);
    for (const f of facilities.filter(f => Number.isFinite(f.lat) && Number.isFinite(f.lng))) {
      const label = document.createElement('div');
      label.textContent = `${f.name}. ${f.locationBasis}.`;
      L.circleMarker([f.lat, f.lng], { radius: f.company === companyId ? 9 : 6,
        color: f.company === companyId ? C.copper : C.dim, fillOpacity: .8, weight: 2 })
        .bindTooltip(label).on('click', () => onSelect(f.company)).addTo(layer);
    }
    return () => layer.remove();
  }, [facilities, companyId, onSelect]);
  return <div><div ref={host} role="region" aria-label="Map of documented facilities" style={{ height: 310, background: C.panel2 }} />
    {tiles !== 'ready' && <p role="status" style={{ padding: '0 16px', fontSize: 12 }}>{tiles === 'loading' ? 'Loading map background…' : 'Map background unavailable. Use the company controls below to inspect the documented sites.'}</p>}
    <p style={{ padding: '0 16px', color: C.dim, fontSize: 12 }}>{facilities.length} sites with reviewed activity or capacity evidence. Approximate locations; marker size highlights selection, not production capacity.</p>
    <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[...new Set(facilities.map(f => f.company))].map(id => <button key={id} onClick={() => onSelect(id)}>{id.toUpperCase()} sites</button>)}</div>
  </div>;
}
