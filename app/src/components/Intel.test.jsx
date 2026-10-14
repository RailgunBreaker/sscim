// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* The Layer-3 intelligence panel: its tab semantics, its sizing rules, and
   the Events feed's search and filters.

   WHAT THIS FILE CAN AND CANNOT ASSERT. jsdom performs no layout — every
   element measures 0×0 — so the blank-space defect itself (a 420px feed
   inside a 1317px panel) is unmeasurable here and is covered by
   scripts/browser-smoke.mjs against a real engine, at all five viewports.

   What IS assertable here is the CSS the panel declares, and that is worth
   pinning because the defect was a declared value: `maxHeight: 420`. So
   these tests check that no fixed pixel height is declared, that the
   scrolling contract (flex + min-height: 0 + overflow-y) is present in the
   horizontal layout and absent in the narrow one, and that every tab is
   reachable and correctly announced. */

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

import { VaultProvider, useVault } from '../data/VaultContext.jsx';
import { InteractionProvider } from '../interaction/InteractionContext.jsx';
import { WatchlistProvider } from '../interaction/WatchlistContext.jsx';
import { buildModel } from '../engine/buildModel.js';
import { defaultEventSelection } from '../engine/eventSelection.js';
import Intel from './Intel.jsx';

const TABS = ['watch', 'explore', 'events', 'history', 'companies', 'movers', 'capital'];

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

function Panel({ horizontal, initialTab = 'events' }) {
  const { data, engine, status } = useVault();
  const [feedTab, setFeedTab] = useState(initialTab);
  const [sel, setSel] = useState(null);
  if (status !== 'ready') return <div data-loading />;
  const model = buildModel({ data, engine, scenario: null, asOfDaysAgo: 0 });
  const selection = sel || defaultEventSelection(data.EVENTS) || { type: 'none', id: null };
  return (
    <Intel
      sel={selection} setSel={setSel} model={model}
      scenario={null} onResetScenario={() => {}} scenarioActive={false}
      feedTab={feedTab} setFeedTab={setFeedTab} horizontal={horizontal}
    />
  );
}

async function mount(props = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <VaultProvider>
        <InteractionProvider>
          <WatchlistProvider>
            <Panel {...props} />
          </WatchlistProvider>
        </InteractionProvider>
      </VaultProvider>,
    );
  });
  await flush(60);
  return {
    host,
    text: () => host.textContent || '',
    tabs: () => [...host.querySelectorAll('[role="tab"]')],
    panel: () => host.querySelector('[role="tabpanel"]'),
  };
}

describe('Layer 3 sizing', () => {
  /* The defect, stated as the value that caused it. */
  it('declares no fixed pixel height on the feed panel', async () => {
    const { panel } = await mount({ horizontal: true });
    const style = panel().getAttribute('style') || '';
    expect(style).not.toMatch(/max-height:\s*4[24]0px/);
    expect(style).not.toMatch(/height:\s*\d+px/);
  });

  it('uses the flex + min-height:0 + overflow contract in the horizontal layout', async () => {
    const { host, panel } = await mount({ horizontal: true });
    const style = panel().getAttribute('style') || '';
    expect(style).toMatch(/flex:\s*1 1 auto/);
    expect(style).toMatch(/min-height:\s*0/);
    expect(style).toMatch(/overflow-y:\s*auto/);

    // The column above it must be the flex container, or flex:1 means nothing.
    const column = panel().parentElement.getAttribute('style') || '';
    expect(column).toMatch(/display:\s*flex/);
    expect(column).toMatch(/flex-direction:\s*column/);
    expect(column).toMatch(/min-height:\s*0/);

    // And the grid must stretch its two columns to a common height.
    const grid = panel().parentElement.parentElement.getAttribute('style') || '';
    expect(grid).toMatch(/display:\s*grid/);
    expect(grid).toMatch(/align-items:\s*stretch/);
    void host;
  });

  /* A viewport-relative floor rather than a magic number, so 1366x768 and
     1920x1080 both get a usable panel. */
  it('floors the panel height in viewport units, not pixels', async () => {
    const { panel } = await mount({ horizontal: true });
    const grid = panel().parentElement.parentElement.getAttribute('style') || '';
    expect(grid).toMatch(/min-height:\s*clamp\(/);
    expect(grid).toMatch(/vh/);
  });

  /* Narrow layouts must not put a small scrolling box inside the page. */
  it('has no nested scroller in the narrow layout', async () => {
    const { panel } = await mount({ horizontal: false });
    const style = panel().getAttribute('style') || '';
    expect(style).toMatch(/overflow-y:\s*visible/);
    expect(style).toMatch(/max-height:\s*none/);
    expect(style).not.toMatch(/overflow-y:\s*auto/);
  });

  it('applies the same contract to every one of the seven tabs', async () => {
    const m = await mount({ horizontal: true });
    for (const tab of m.tabs()) {
      await act(async () => { tab.click(); });
      await flush(20);
      const style = m.panel().getAttribute('style') || '';
      expect(style, tab.textContent).toMatch(/overflow-y:\s*auto/);
      expect(style, tab.textContent).toMatch(/min-height:\s*0/);
      expect(style, tab.textContent).not.toMatch(/max-height:\s*\d+px/);
    }
  });
});

describe('Layer 3 tab semantics', () => {
  it('is a real tablist with all seven tabs', async () => {
    const m = await mount({ horizontal: true });
    expect(m.host.querySelector('[role="tablist"]')).toBeTruthy();
    expect(m.tabs()).toHaveLength(TABS.length);
  });

  it('marks exactly one tab selected, and points it at the panel', async () => {
    const m = await mount({ horizontal: true });
    const selected = m.tabs().filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute('aria-controls')).toBe(m.panel().id);
    expect(m.panel().getAttribute('aria-labelledby')).toBe(selected[0].id);
  });

  it('uses a roving tabindex so the group is one tab stop', async () => {
    const m = await mount({ horizontal: true });
    const focusable = m.tabs().filter((t) => t.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
  });

  it('lets the tab bar scroll rather than crushing seven labels', async () => {
    const m = await mount({ horizontal: true });
    const bar = m.host.querySelector('[role="tablist"]').getAttribute('style') || '';
    expect(bar).toMatch(/overflow-x:\s*auto/);
    m.tabs().forEach((t) => expect(t.getAttribute('style')).toMatch(/white-space:\s*nowrap/));
  });

  it('switches content when a tab is activated', async () => {
    const m = await mount({ horizontal: true, initialTab: 'events' });
    expect(m.text()).toMatch(/matching event/i);
    const capital = m.tabs().find((t) => /CAPITAL/i.test(t.textContent));
    await act(async () => { capital.click(); });
    await flush(20);
    expect(m.text()).toMatch(/CAPITAL POWER/);
    expect(capital.getAttribute('aria-selected')).toBe('true');
  });

  it('every tab renders content without throwing', async () => {
    const m = await mount({ horizontal: true });
    for (const tab of m.tabs()) {
      await act(async () => { tab.click(); });
      await flush(20);
      expect(m.panel().textContent.trim().length, tab.textContent).toBeGreaterThan(0);
    }
  });
});

describe('the Events feed', () => {
  const feed = () => mount({ horizontal: true, initialTab: 'events' });

  it('reports how many events match', async () => {
    const { text } = await feed();
    expect(text()).toMatch(/\d+ matching events/);
  });

  it('keeps the history chart above the list', async () => {
    const { host } = await feed();
    expect(host.querySelector('svg')).toBeTruthy();
  });

  it('offers search and the four filters', async () => {
    const { host } = await feed();
    expect(host.querySelector('input[type="search"]')).toBeTruthy();
    const labels = [...host.querySelectorAll('select')].map((s) => s.getAttribute('aria-label'));
    expect(labels).toContain('Filter by event type');
    expect(labels).toContain('Filter by whether the event is scored');
    expect(labels).toContain('Filter by direction');
    expect(labels).toContain('Filter by date range');
  });

  it('narrows the list and the count together when searching', async () => {
    const m = await feed();
    const input = m.host.querySelector('input[type="search"]');
    const before = Number((m.text().match(/(\d+) matching events/) || [])[1]);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'earthquake');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush(20);
    const after = Number((m.text().match(/(\d+) matching event/) || [])[1]);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
    expect(m.text()).toMatch(/of \d+/); // says what it filtered out of
  });

  it('pages the list rather than dumping 167 cards, and says there are more', async () => {
    const m = await feed();
    expect(m.text()).toMatch(/showing the \d+ most recent/i);
    expect(m.text()).toMatch(/older events? not shown yet/i);
    const showMore = [...m.host.querySelectorAll('button')].find((b) => /Show \d+ more/.test(b.textContent));
    expect(showMore).toBeTruthy();
  });

  it('reveals everything when asked, and then says so', async () => {
    const m = await feed();
    const showAll = [...m.host.querySelectorAll('button')].find((b) => /Show all \d+/.test(b.textContent));
    await act(async () => { showAll.click(); });
    await flush(30);
    expect(m.text()).toMatch(/End of the feed/i);
  });

  it('states that the order is newest first', async () => {
    const { text } = await feed();
    expect(text()).toMatch(/newest first/i);
  });

  /* The public-output rule, at the render boundary. */
  it('puts no internal review text in any tooltip it renders', async () => {
    const m = await feed();
    const showAll = [...m.host.querySelectorAll('button')].find((b) => /Show all \d+/.test(b.textContent));
    await act(async () => { showAll.click(); });
    await flush(40);
    const titles = [...m.host.querySelectorAll('[title]')].map((e) => e.getAttribute('title')).join(' || ');
    expect(titles).not.toMatch(/Published:\s*Review/i);
    expect(titles).not.toMatch(/Review:\s*(approve|reject)/i);
    expect(titles).not.toMatch(/cand_[a-z0-9_]{8,}/i);
    expect(m.host.innerHTML).not.toMatch(/cand_[a-z0-9_]{8,}/i);
  });
});
