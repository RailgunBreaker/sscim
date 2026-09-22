// @vitest-environment jsdom
import { it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { VaultProvider, useVault } from './VaultContext.jsx';
import snapshot from './vault-snapshot.json';
import { buildOperationalVault } from './operationalVault.js';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function Readout() {
  const { data } = useVault();
  return <span>{data ? `${data.EVENTS.length}|${Boolean(data.REFRESH_FAILED)}` : 'loading'}</span>;
}
it('refreshes event data after load and exposes failed refreshes without losing the last dataset', async () => {
  vi.useFakeTimers();
  let bundle = structuredClone(snapshot), fail = false;
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (String(url).endsWith('/api/quotes')) return { ok: true, json: async () => ({ quotes: {} }) };
    if (fail) throw new Error('offline');
    return { ok: true, json: async () => bundle };
  }));
  const container = document.createElement('div'), root = createRoot(container);
  try {
    await act(async () => root.render(<VaultProvider><Readout /></VaultProvider>));
    const eligible = buildOperationalVault(snapshot).EVENTS;
    expect(container.textContent).toBe(`${eligible.length}|false`);
    bundle = { ...bundle, events: bundle.events.filter(r => r.id !== eligible[0].id) };
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(container.textContent).toBe(`${eligible.length - 1}|false`);
    fail = true;
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(container.textContent).toBe(`${eligible.length - 1}|true`);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals(); vi.useRealTimers();
  }
});
