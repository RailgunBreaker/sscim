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
  it('opens on documented evidence and computes the selected capacity population', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<App />); });
    await flush(0);
    expect(container.textContent).toContain('Documented supply-chain evidence');
    expect(container.textContent).toContain('1,629,000');
    expect(container.textContent).toContain('3,131,000');
    expect(container.textContent).not.toContain('Systemic criticality');
    await act(async () => {
      const select = container.querySelector('[aria-label="Capacity year"]');
      select.value = '2024-12-31';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('1,556,000');
    expect(container.textContent).toContain('3,007,000');
    const financial = container.querySelector('[aria-label="Reported financial outcomes"]');
    expect(financial.textContent).toContain('-12.6 JPY billion');
    expect(financial.textContent).toContain('forecast -17');
    await act(async () => {
      const select = financial.querySelector('[aria-label="Financial measurement"]');
      select.value = 'insurance_proceeds';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(financial.textContent).toContain('177 USD million');
    expect(financial.textContent).not.toContain('forecast -17');
    expect(container.querySelector('[aria-label="Reported manufacturing routes"]').textContent).toContain('Kulim');
    const validation = container.querySelector('[aria-label="Historical prediction validation"]');
    expect(validation.textContent).toContain('22 of 24');
    expect(validation.textContent).toContain('prospective performance is untested');
    expect(validation.querySelectorAll('details tbody tr')).toHaveLength(24);
    await act(async () => root.unmount());
    container.remove();
  });

  it('mounts the dashboard without throwing and shows the lens control', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<App />); });
    await flush(0);
    await act(async () => { container.querySelector('[data-testid="open-research"]').click(); });
    // let the snapshot fallback resolve and effects run
    await flush(0);
    await flush(0);

    const text = container.textContent || '';
    // The workspace bar and research-language footer should render once the
    // vault is ready (snapshot fallback). The lens group used to be labelled
    // "LENS" in 9px caps; it is now "Shading", subordinate to the workspace
    // control rather than a peer of it.
    expect(text).toContain('Shading');
    expect(text).toContain('Map');
    expect(text).toContain('Network');
    expect(text).toContain('Facilities');
    expect(text.toUpperCase()).toContain('SSCIM INTELLIGENCE');

    /* The header carried a hand-written build label reading
       "v4 · OSM MAP · COMPANY SPREAD" — two model versions and one
       application version out of date. It must not come back. */
    expect(text).not.toContain('OSM MAP · COMPANY SPREAD');
    expect(text).not.toContain('v4 ·');

    /* Primary actions are named, not decorated. */
    expect(text).not.toContain('GP Briefing');
    expect(text).not.toContain('? Guide');
    expect(text).toContain('Generate briefing');
    expect(text).toContain('Help');

    /* Internal architecture stays in the developer documentation. */
    expect(text).not.toContain('LAYER 1');
    expect(text).not.toContain('LAYER 2');
    expect(text).not.toContain('LAYER 3');

    await act(async () => { root.unmount(); });
    container.remove();
  });

  /* The site layer was invisible on load for its whole first life: markers
     were gated behind zoom 4 and the map opens at zoom 2, so the honest
     reading of the default view was "this project models no facilities". The
     mocked map still reports zoom 2 — so if this ever draws nothing, the gate
     is back.

     Deliberately NOT one marker per facility any more: overlapping plants are
     grouped into count markers at low zoom (engine/facilityCluster.js), and
     the guarantee that grouping loses nothing is asserted there, against the
     clustering itself, rather than inferred from a render count here. */
  it('draws the site layer at the default world zoom, grouped rather than hidden', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<App />); });
    await flush(0);
    await act(async () => { container.querySelector('[data-testid="open-research"]').click(); });
    await flush(0);
    await flush(0);

    const { FACILITIES } = snapshot;
    expect(FACILITIES.length).toBeGreaterThan(200);

    // Something is drawn...
    expect(calls.marker.length).toBeGreaterThan(0);
    expect(calls.divIcon.length).toBe(calls.marker.length);
    // ...and at world zoom it is grouped, not one glyph per plant.
    expect(calls.marker.length).toBeLessThan(FACILITIES.length);

    // Every icon carries real geometry rather than being an empty box.
    calls.divIcon.forEach((opts) => {
      expect(opts.html).toContain('<svg');
      expect(opts.iconSize[0]).toBeGreaterThan(3);
    });

    // At least one is a count marker standing in for a group.
    expect(calls.divIcon.some((o) => o.className.includes('sscim-cluster'))).toBe(true);

    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('renders the decade history panel with per-event index attribution', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<App />); });
    await flush(0);
    await act(async () => { container.querySelector('[data-testid="open-research"]').click(); });
    await flush(0);
    await flush(0);

    // Switch the Layer-3 feed to the HISTORY tab. It replays a decade of the
    // index and attributes every event, so a mount-time crash or a divide-by-
    // zero in the analysis would only ever show up here.
    const historyTab = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'History');
    expect(historyTab).toBeTruthy();
    /* A tab is a tab, not a styled div: the roving-tabindex contract has to
       survive the restyling. */
    expect(historyTab.getAttribute('role')).toBe('tab');
    await act(async () => { historyTab.click(); });
    await flush(0);

    const text = container.textContent || '';
    expect(text).toContain('Ten-year replay');
    expect(text).toContain('Events by impact');
    // The year table should cover more than a single year of history.
    expect(text).toContain('By year');
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
    await act(async () => { container.querySelector('[data-testid="open-research"]').click(); });
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
