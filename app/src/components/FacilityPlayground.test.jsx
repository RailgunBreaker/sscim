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
import { FLOW_PARTICLES, flowParticleKeys } from './FacilityGraph.jsx';
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

  /* The playground used to open at one hop, which draws the focus plant
     and the ring of plants directly attached to it — and because a plant's
     nearest neighbours are dominated by whoever it already trades with,
     that ring reads as one company's orbit rather than as a chain. */
  it('opens on the chain, not on one plant’s immediate ring', async () => {
    const { host, text } = await focused();
    // Every node past the first hop is labelled with its depth.
    expect(text()).toMatch(/hop 2/);
    expect(host.querySelectorAll('g.fg-node').length).toBeGreaterThan(20);
    // More than one operator is on screen — that is the point of the change.
    const operators = new Set(
      [...host.querySelectorAll('g.fg-node text')].map((t) => t.textContent),
    );
    expect(operators.size).toBeGreaterThan(4);
  });

  it('still lets a reader ask for the immediate ring back', async () => {
    const m = await focused(FAB18, { hops: 1 });
    expect(m.text()).not.toMatch(/hop 2/);
  });

  /* Fab 18's own deeper columns fit, so it says nothing — the line is not
     decoration that fires on every graph. Foxconn Zhengzhou sits far enough
     downstream that hop 2 overflows the column cap, and there the reader
     has to be told, because the connection table below covers the FOCUSED
     plant only and reaches none of those deeper facilities. */
  it('states what is reachable but not drawn beyond the first hop', async () => {
    expect((await focused()).text()).not.toMatch(/at hop 2 or deeper/i);
    const { text } = await focused('foxconn_zhengzhou');
    expect(text()).toMatch(/\d+ more facilities at hop 2 or deeper are reachable but not drawn/i);
    expect(text()).toMatch(/centre on a nearer plant/i);
  });

  /* A glyph in a column whose connecting edge cannot be drawn — because
     the plant it was reached through fell outside the cap — is a plant
     floating with nothing joining it to the chain. Three of the 275 roots
     produced one once the default depth moved past a single hop. */
  it('never draws a plant whose link to the chain is not on screen', async () => {
    for (const root of ['foxconn_zhengzhou', 'foxconn_bacgiang', 'apple_cupertino']) {
      const { host } = await focused(root);
      const drawn = new Set([...host.querySelectorAll('g[data-node]')].map((g) => g.getAttribute('data-node')));
      const joined = new Set();
      host.querySelectorAll('path[role="button"][aria-label]').forEach((p) => {
        const m = /between (.+) and (.+), \d/.exec(p.getAttribute('aria-label'));
        if (m) { joined.add(m[1]); joined.add(m[2]); }
      });
      const names = [...host.querySelectorAll('g[data-node] > text:first-of-type')].map((t) => t.textContent);
      expect(drawn.size).toBeGreaterThan(0);
      // Every drawn plant's name turns up as an endpoint of a drawn edge.
      names.forEach((n) => {
        const truncated = n.endsWith('…');
        expect([...joined].some((j) => (truncated ? j.startsWith(n.slice(0, -1)) : j === n))).toBe(true);
      });
    }
  });

  it('animates flow along edges, within the frame budget', async () => {
    const { host, text } = await focused();
    const dots = host.querySelectorAll('circle.fg-flow');
    expect(dots.length).toBeGreaterThan(0);
    expect(dots.length).toBeLessThanOrEqual(FLOW_PARTICLES);
    expect(text()).toMatch(/Co-input links carry no dot/i);
    // Motion is decoration; it must switch itself off when asked to.
    const css = [...host.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    expect(css).toMatch(/prefers-reduced-motion/);
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

/* ====================================================================
   Flow particles. The entrance and hover animations carry no meaning and
   need no test; this one does, because a dot travelling between two
   plants asserts that output moves that way — and for one of the three
   relationship classes that assertion would be false.
   ==================================================================== */
describe('flowParticleKeys — motion only where the model has a direction', () => {
  const placed = { a: {}, b: {}, c: {} };
  const link = (from, to, flow, weight, stage = 's1') => ({ from, to, flow, weight, fromStage: stage, toStage: 's2' });

  it('animates a forward link and a service link', () => {
    const keys = flowParticleKeys([link('a', 'b', 'forward', 1), link('a', 'c', 'service', 1)], placed);
    expect(keys.size).toBe(2);
  });

  /* Co-input means both ends feed a COMMON downstream step. Neither
     supplies the other, so a dot travelling between them would draw a
     flow the dataset does not contain. */
  it('never animates a co-input link, however strong it is', () => {
    expect(flowParticleKeys([link('a', 'b', 'co-input', 999)], placed).size).toBe(0);
  });

  it('skips a link whose far end fell outside the column cap', () => {
    expect(flowParticleKeys([link('a', 'not_drawn', 'forward', 1)], placed).size).toBe(0);
  });

  it('drops the weakest, not the strongest, when the frame budget bites', () => {
    const many = Array.from({ length: FLOW_PARTICLES + 10 }, (_, i) => link('a', 'b', 'forward', i, `s${i}`));
    const keys = flowParticleKeys(many, placed);
    expect(keys.size).toBe(FLOW_PARTICLES);
    expect(keys.has('a>b|s0>s2|forward')).toBe(false);
    expect(keys.has(`a>b|s${FLOW_PARTICLES + 9}>s2|forward`)).toBe(true);
  });

  it('does not reorder the caller’s link array', () => {
    const links = [link('a', 'b', 'forward', 1), link('a', 'c', 'forward', 9)];
    flowParticleKeys(links, placed);
    expect(links.map((l) => l.weight)).toEqual([1, 9]);
  });
});
