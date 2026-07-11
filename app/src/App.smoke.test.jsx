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
    polyline: () => layer,
    tooltip: () => layer,
    marker: () => layer,
    control: { zoom: () => ({ addTo: () => {} }) },
  };
  return { default: L, ...L };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import App from './App.jsx';

beforeEach(() => {
  // Force the VaultProvider fetch to fail so it falls back to the bundled
  // static snapshot (the GitHub Pages path).
  global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
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
    expect(text.toUpperCase()).toContain('RESEARCH PROTOTYPE');

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
