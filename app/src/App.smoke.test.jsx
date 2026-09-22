// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('leaflet', () => {
  const layer = {};
  for (const key of ['addTo','on','bindTooltip','remove']) layer[key] = () => layer;
  return { default: { map: () => ({ remove() {} }), tileLayer: () => layer, layerGroup: () => layer, circleMarker: () => layer } };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));
import App from './App.jsx';
beforeEach(() => {
  global.fetch = vi.fn(() => Promise.reject(new Error('offline')));
  window.matchMedia ||= q => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} });
});
describe('Integrated evidence dashboard', () => {
  async function mount() {
    const container = document.createElement('div'); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<App />); await new Promise(r => setTimeout(r, 0)); });
    return { container, root };
  }
  async function company(container, id) {
    await act(async () => { const select = container.querySelector('[aria-label="Select company"]'); select.value = id; select.dispatchEvent(new Event('change', { bubbles: true })); });
  }
  async function tab(container, label) {
    await act(async () => { [...container.querySelectorAll('nav button')].find(b => b.textContent === label).click(); });
  }
  async function close({ root, container }) { await act(async () => root.unmount()); container.remove(); }
  it('opens the map, documented network and GF records together without a research gate', async () => {
    const m = await mount(), { container } = m;
    try {
      expect(container.querySelector('#pane-map')).not.toBeNull();
      expect(container.querySelector('#pane-flow')).not.toBeNull();
      expect(container.textContent).toContain('71% of SOI wafer spend');
      expect(container.textContent).toContain('625,000');
      expect(container.textContent).toContain('Unknown');
      expect(container.textContent).toContain('redacted');
      expect(container.querySelector('[data-testid="open-research"]')).toBeNull();
      expect(container.textContent).not.toContain('Systemic criticality');
    } finally { await close(m); }
  });
  it('changes company and capacity periods in the same dashboard', async () => {
    const m = await mount();
    try {
      await company(m.container, 'umc'); expect(m.container.textContent).toContain('3,131,000');
      await act(async () => { const s = m.container.querySelector('[aria-label="Capacity year"]'); s.value = '2024-12-31'; s.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(m.container.textContent).toContain('3,007,000');
      await company(m.container, 'tsmc'); expect(m.container.textContent).toContain('514,806');
      await company(m.container, 'renesas'); expect(m.container.querySelector('[aria-label="Reported recovery"]')).not.toBeNull();
    } finally { await close(m); }
  });
  it('keeps loss and validation results in the main intelligence panel', async () => {
    const m = await mount();
    try {
      await tab(m.container, 'Disruption losses');
      const verification = m.container.querySelector('[aria-label="Chain-wide loss verification"]');
      expect(verification.textContent).toContain('36 + 1 = 37 USD million');
      expect(verification.textContent).toContain('counted once across 3 representations');
      expect(verification.textContent).toContain('whole-chain loss remains unverified');
      expect(m.container.querySelector('[aria-label="Semiconductor loss follow-up"]').textContent).toContain('170 USD million');
      expect(m.container.querySelector('[aria-label="Supplier loss allocation"]')).not.toBeNull();
      expect(m.container.querySelector('[aria-label="Reported financial outcomes"]')).not.toBeNull();
      await tab(m.container, 'Validation');
      expect(m.container.querySelector('[aria-label="Data validation status"]')).not.toBeNull();
      expect(m.container.querySelector('[aria-label="Historical prediction validation"]').textContent).toContain('22 of 24');
      expect(m.container.querySelector('[aria-label="Prospective performance"]').textContent).toContain('awaiting an outcome');
      expect(m.container.querySelector('[aria-label="Recovery duration calibration"]')).not.toBeNull();
    } finally { await close(m); }
  });
  it('shows reviewed occurrence claims without generated severity or consequences', async () => {
    const m = await mount();
    try {
      await tab(m.container, 'News');
      expect(m.container.querySelectorAll('.evidence-event')).toHaveLength(3);
      expect(m.container.textContent).toContain('Severity scores and generated consequences are excluded');
      expect(m.container.textContent).not.toContain('own-field index');
    } finally { await close(m); }
  });
});
