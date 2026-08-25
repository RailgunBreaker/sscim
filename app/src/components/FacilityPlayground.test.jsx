// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* Component tests for the facility playground and its compact sibling.

   These mount the real components against the real snapshot, through the
   real interaction provider — because the defects being fixed were all
   about wiring, not arithmetic: state that lived in the wrong place, a
   caption that disagreed with the list beneath it, a list that stopped at
   40 of 53 with nothing saying so.

   jsdom does no layout, so nothing here asserts pixels; the geometry is
   covered by scripts/browser-smoke.mjs against a real engine. What is
   asserted here is what the components SAY and what they let you reach. */

vi.mock('leaflet', () => {
  const chain = () => layer;
  const layer = { addTo: chain, on: chain, bindTooltip: chain, bindPopup: chain, openPopup: chain, setLatLng: chain, setContent: chain, remove: chain, addLayer: chain, clearLayers: chain, removeLayer: chain };
  const map = { addTo: chain, on: chain, remove: () => {}, flyTo: () => {}, getZoom: () => 2, removeLayer: () => {} };
  const L = {
    map: () => map, tileLayer: () => layer, layerGroup: () => layer, circleMarker: () => layer,
    circle: () => layer, divIcon: () => ({}), polyline: () => layer, tooltip: () => layer,
    marker: () => layer, control: { zoom: () => ({ addTo: () => {} }) },
  };
  return { default: L, ...L };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));

import { VaultProvider } from '../data/VaultContext.jsx';
import { InteractionProvider, useInteraction } from '../interaction/InteractionContext.jsx';
import { WatchlistProvider } from '../interaction/WatchlistContext.jsx';
import FacilityPlayground from './FacilityPlayground.jsx';
import FacilityExplorer from './FacilityExplorer.jsx';
import FacilityConnectionTable from './FacilityConnectionTable.jsx';
import { useVault } from '../data/VaultContext.jsx';

const FAB18 = 'tsmc_fab18';

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
  if (!window.matchMedia) {
    window.matchMedia = (q) => ({ matches: true, media: q, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} });
  }
  window.history.replaceState(null, '', '/');
});

async function flush(ms = 0) {
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
}

/* Renders `children` inside the real providers, and exposes the interaction
   API so a test can drive the shared state the way the UI does. */
function Harness({ children, onReady }) {
  return (
    <VaultProvider>
      <Gate onReady={onReady}>{children}</Gate>
    </VaultProvider>
  );
}

function Gate({ children, onReady }) {
  const { status } = useVault();
  if (status !== 'ready') return <div data-loading />;
  return (
    <InteractionProvider>
      <WatchlistProvider>
        <Expose onReady={onReady} />
        {children}
      </WatchlistProvider>
    </InteractionProvider>
  );
}

function Expose({ onReady }) {
  const api = useInteraction();
  onReady?.(api);
  return null;
}

async function mount(children) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  let api = null;
  await act(async () => { root.render(<Harness onReady={(a) => { api = a; }}>{children}</Harness>); });
  await flush(50);
  return { host, root, api: () => api, text: () => host.textContent || '' };
}

describe('FacilityPlayground — starting state', () => {
  it('opens on a search field rather than 275 rows of facilities', async () => {
    const { host, text } = await mount(<FacilityPlayground />);
    expect(host.querySelector('input[type="search"]')).toBeTruthy();
    // 275 plants must not all be listed on arrival.
    expect(host.querySelectorAll('li').length).toBeLessThan(30);
    expect(text()).toMatch(/modeled stage-mediated relationship/i);
  });

  it('says what the network is, and what it is not', async () => {
    const { text } = await mount(<FacilityPlayground />);
    expect(text()).toMatch(/not a confirmed shipment, customer\s*contract, or trade route/i);
  });

  it('suggests a few real facilities from the current data', async () => {
    const { text } = await mount(<FacilityPlayground />);
    expect(text()).toMatch(/most connected plants/i);
    expect(text()).toMatch(/\d+ links/);
  });
});

describe('FacilityPlayground — a focused facility', () => {
  async function focused(id = FAB18, patch = {}) {
    const m = await mount(<FacilityPlayground />);
    await act(async () => { m.api().facFocus(id, { asRoot: true }); });
    if (Object.keys(patch).length) await act(async () => { m.api().facSet(patch); });
    await flush(30);
    return m;
  }

  it('shows the facility’s identity, function, status and significance', async () => {
    const { text } = await focused();
    const t = text();
    expect(t).toMatch(/TSMC/i);
    expect(t).toMatch(/Taiwan/i);
    expect(t).toMatch(/Location/);
    expect(t).toMatch(/Stage \/ function/);
    expect(t).toMatch(/Status/);
    expect(t).toMatch(/Modeled significance/);
    expect(t).toMatch(/analyst ordinal, not measured capacity/i);
    expect(t).toMatch(/Evidence/);
  });

  it('reports the inbound and outbound relationship counts', async () => {
    const { text } = await focused();
    expect(text()).toMatch(/53 inbound · 7 outbound · 60 total/);
  });

  /* The verified contradiction: 53 suppliers, 14 drawn, 40 listed, and a
     caption claiming the list held all of them. */
  it('states the exact visible-of-total supplier count on the graph', async () => {
    const { text } = await focused();
    expect(text()).toMatch(/showing the strongest \d+ of 53 suppliers/i);
    expect(text()).not.toMatch(/the list below has all of them/i);
  });

  it('states an exact visible-of-total count on the connection table', async () => {
    const { text } = await focused();
    expect(text()).toMatch(/Showing \d+ of \d+ matching connections/i);
  });

  it('offers a control that reveals the remainder', async () => {
    const { host } = await focused();
    const showAll = [...host.querySelectorAll('button')].find((b) => /^Show all \d+$/.test(b.textContent));
    expect(showAll).toBeTruthy();
    expect(showAll.textContent).toBe('Show all 60');
  });

  it('offers traversal controls for direction and depth', async () => {
    const { host } = await focused();
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toContain('← Upstream only');
    expect(labels).toContain('Downstream only →');
    expect(labels).toContain('Both directions');
    expect(labels).toContain('All reachable');
  });

  it('offers back, forward, start and reset', async () => {
    const { host } = await focused();
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent);
    ['← Back', 'Forward →', '⌂ Start', 'Reset'].forEach((l) => expect(labels).toContain(l));
  });

  it('links out to the map, the profile, the operator and the stages', async () => {
    const { host } = await focused();
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toContain('Full profile');
    expect(labels).toContain('Open on the map');
    expect(labels).toContain('Operator');
    expect(labels.some((l) => /stage$/.test(l))).toBe(true);
  });

  it('labels a temporary removal as topology-only', async () => {
    const { host } = await focused();
    const hide = [...host.querySelectorAll('button')].find((b) => /Hide \(topology only\)/.test(b.textContent));
    expect(hide).toBeTruthy();
    expect(hide.getAttribute('title')).toMatch(/does not feed the risk model/i);
  });

  it('warns instead of drawing when "all reachable" would be unreadable', async () => {
    const m = await focused();
    const btn = [...m.host.querySelectorAll('button')].find((b) => b.textContent === 'All reachable');
    await act(async () => { btn.click(); });
    await flush(20);
    expect(m.text()).toMatch(/facilities are reachable/i);
    expect(m.text()).toMatch(/Draw it anyway/);
  });
});

describe('FacilityConnectionTable — nothing hidden silently', () => {
  async function table(id = FAB18) {
    return mount(<FacilityConnectionTable facilityId={id} />);
  }

  it('reports the totals for both directions in its heading', async () => {
    const { text } = await table();
    expect(text()).toMatch(/ALL MODELED CONNECTIONS — 53 INBOUND · 7 OUTBOUND/);
  });

  it('pages rather than truncating, and says so', async () => {
    const { host, text } = await table();
    const rows = () => host.querySelectorAll('ul > li').length;
    expect(rows()).toBe(40);
    expect(text()).toMatch(/Showing 40 of 60 matching connections/);

    const showAll = [...host.querySelectorAll('button')].find((b) => /^Show all 60$/.test(b.textContent));
    await act(async () => { showAll.click(); });
    await flush(20);
    expect(rows()).toBe(60);
    expect(text()).toMatch(/Showing all 60/);
  });

  /* Every one of the 53 inbound relationships must be reachable — the
     specific acceptance criterion. */
  it('reaches all 53 inbound relationships once expanded', async () => {
    const { host } = await table();
    const showAll = [...host.querySelectorAll('button')].find((b) => /^Show all 60$/.test(b.textContent));
    await act(async () => { showAll.click(); });
    await flush(20);
    const inbound = [...host.querySelectorAll('ul > li')].filter((li) => /← in/.test(li.textContent));
    expect(inbound).toHaveLength(53);
  });

  it('narrows with a direction filter without losing the count', async () => {
    const { host, text } = await table();
    const inboundBtn = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Inbound');
    await act(async () => { inboundBtn.click(); });
    await flush(20);
    expect(text()).toMatch(/Showing 40 of 53 matching connections/);
  });

  it('labels both percentage scales instead of showing two bare numbers', async () => {
    const { text } = await table();
    expect(text()).toMatch(/share of the strongest modeled link|snapshot-wide scale/i);
    expect(text()).toMatch(/not comparable/i);
  });

  it('says nothing is hidden when a plant has few connections', async () => {
    const { text } = await table('asml_wilton');
    expect(text()).toMatch(/Showing all \d+ matching connection/);
    expect(text()).not.toMatch(/Showing \d+ of \d+/);
  });
});

describe('FacilityExplorer — the compact surface', () => {
  it('shares state with the full playground rather than holding its own', async () => {
    const m = await mount(<FacilityExplorer setSel={() => {}} />);
    expect(m.host.querySelector('input[type="search"]')).toBeTruthy();

    await act(async () => { m.api().facFocus(FAB18, { asRoot: true }); });
    await flush(30);
    expect(m.text()).toMatch(/TSMC/);

    // The state lives in the reducer, which is what makes tab switching safe.
    expect(m.api().state.facility.focusId).toBe(FAB18);
  });

  it('offers a route into the full-width playground', async () => {
    const m = await mount(<FacilityExplorer setSel={() => {}} />);
    await act(async () => { m.api().facFocus(FAB18, { asRoot: true }); });
    await flush(30);
    const open = [...m.host.querySelectorAll('button')].find((b) => /Open in Playground/.test(b.textContent));
    expect(open).toBeTruthy();
    await act(async () => { open.click(); });
    expect(m.api().state.viewMode).toBe('playground');
  });

  it('reaches every connection here too, not just in the full view', async () => {
    const m = await mount(<FacilityExplorer setSel={() => {}} />);
    await act(async () => { m.api().facFocus(FAB18, { asRoot: true }); });
    await flush(30);
    expect(m.text()).toMatch(/53 INBOUND · 7 OUTBOUND/);
    const showAll = [...m.host.querySelectorAll('button')].find((b) => /^Show all 60$/.test(b.textContent));
    expect(showAll).toBeTruthy();
  });
});
