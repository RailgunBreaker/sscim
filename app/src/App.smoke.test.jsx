// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* Runtime smoke test: mounts the whole dashboard against the static
   snapshot (Leaflet mocked, no network) to catch mount-time crashes in the
   interaction-controller wiring — lens bar, scenario sync, Layer-3 routing,
   OsmMap/FlowGraph/CountryList — that unit tests and the build don't
   exercise. Not a visual test; it asserts the tree renders and the lens
   control is present. */

/* Records what the map was asked to draw. vi.hoisted because vi.mock is
   hoisted above the imports, so a plain const would not exist yet. */
const calls = vi.hoisted(() => ({ divIcon: [], marker: [] }));

// Minimal chainable Leaflet stub — every method used by OsmMap is a no-op.
vi.mock('leaflet', () => {
  const chain = () => layer;
  const layer = {
    addTo: chain, on: chain, bindTooltip: chain, bindPopup: chain,
    openPopup: chain, setLatLng: chain, setContent: chain, remove: chain,
    addLayer: chain, clearLayers: chain, removeLayer: chain,
  };
  const map = {
    addTo: chain, on: chain, remove: () => {}, flyTo: () => {},
    getZoom: () => 2, removeLayer: () => {},
  };
  const L = {
    map: () => map,
    tileLayer: () => layer,
    layerGroup: () => layer,
    circleMarker: () => layer,
    circle: () => layer,
    /* divIcon was missing here for as long as the site layer existed, and the
       suite stayed green: markers were gated behind zoom 4, the mocked map
       reports zoom 2, so the facility-marker path never ran in a test. The
       gate is gone and this mount now genuinely exercises it. */
    divIcon: (opts) => { calls.divIcon.push(opts); return {}; },
    polyline: () => layer,
    tooltip: () => layer,
    marker: (...a) => { calls.marker.push(a); return layer; },
    control: { zoom: () => ({ addTo: () => {} }) },
  };
  return { default: L, ...L };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import App from './App.jsx';
import snapshotBundle from './data/vault-snapshot.json';

const snapshot = { FACILITIES: snapshotBundle.facilities || [] };

beforeEach(() => {
  // Force the VaultProvider fetch to fail so it falls back to the bundled
  // static snapshot (the GitHub Pages path).
  global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
  calls.divIcon.length = 0;
  calls.marker.length = 0;
  // jsdom lacks matchMedia (used by the responsive layout effect).
  if (!window.matchMedia) {
    window.matchMedia = (q) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} });
  }
});

async function flush(ms = 0) {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
}

describe('App smoke (static snapshot, Leaflet mocked)', () => {
  it('mounts the dashboard without throwing and shows the lens control', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<App />); });
    // let the snapshot fallback resolve and effects run
    await flush(0);
    await flush(0);

    const text = container.textContent || '';
    // The interaction lens bar and research-language footer should render
    // once the vault is ready (snapshot fallback).
    expect(text).toContain('LENS');
    expect(text.toUpperCase()).toContain('SSCIM INTELLIGENCE');

    await act(async () => { root.unmount(); });
    container.remove();
  });

  /* The site layer was invisible on load for its whole first life: markers
     were gated behind zoom 4 and the map opens at zoom 2, so the honest
     reading of the default view was "this project models no facilities". The
     mocked map still reports zoom 2 — so if this assertion ever fails, the
     gate is back. */
  it('draws a marker for every modeled facility at the default world zoom', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<App />); });
    await flush(0);
    await flush(0);

    const { FACILITIES } = snapshot;
    expect(FACILITIES.length).toBeGreaterThan(200);
    expect(calls.marker.length).toBe(FACILITIES.length);
    expect(calls.divIcon.length).toBe(FACILITIES.length);

    // Every icon carries real geometry, and shrinks at world zoom rather than
    // being hidden — the fix that replaced the gate.
    calls.divIcon.forEach((opts) => {
      expect(opts.html).toContain('<svg');
      expect(opts.iconSize[0]).toBeGreaterThan(3);
      expect(opts.iconSize[0]).toBeLessThan(14);
    });

    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('renders the decade history panel with per-event index attribution', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<App />); });
    await flush(0);
    await flush(0);

    // Switch the Layer-3 feed to the HISTORY tab. It replays a decade of the
    // index and attributes every event, so a mount-time crash or a divide-by-
    // zero in the analysis would only ever show up here.
    const historyTab = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'HISTORY');
    expect(historyTab).toBeTruthy();
    await act(async () => { historyTab.click(); });
    await flush(0);

    const text = container.textContent || '';
    expect(text).toContain('DECADE REPLAY');
    expect(text).toContain('EVENTS BY IMPACT');
    // The year table should cover more than a single year of history.
    expect(text).toContain('BY YEAR');
    expect(text).toMatch(/20(1[6-9]|2[0-6])/);

    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('restores topology view from the URL hash and mounts the functional-centre network', async () => {
    window.location.hash = '#view=topology';
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<App />); });
    await flush(0);
    await flush(0);

    const text = container.textContent || '';
    // The topology renderer (functional-centre network) should be on screen.
    expect(text.toUpperCase()).toContain('FUNCTIONAL-CENTRE NETWORK');

    await act(async () => { root.unmount(); });
    container.remove();
    window.location.hash = '';
  });
});
