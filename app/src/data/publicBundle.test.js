import { it, expect } from 'vitest';
import snapshot from './vault-snapshot.json';
import { publicBundle } from '../../../server/src/public-bundle.js';
import { buildOperationalVault } from './operationalVault.js';
import { reconcileBundle } from './reconcileBundle.js';
it('serves reviewed occurrences and dependencies without private or legacy fields', () => {
  const raw = { ...snapshot, pilotRecords: [{ secret: 'private purchase' }] };
  const b = publicBundle(raw), serialized = JSON.stringify(b);
  expect(b.events).toHaveLength(3);
  expect(b.facilities).toHaveLength(4);
  expect(b.companies.every(c => !('stakes' in c))).toBe(true);
  expect(b.events.every(e => !('sev' in e) && !('summary' in e))).toBe(true);
  expect(b.customers).toEqual({});
  expect(b.stages).toEqual([]);
  expect(b.briefings).toEqual([]);
  expect(serialized).not.toContain('private purchase');
  expect(buildOperationalVault(b).EVENTS).toEqual(buildOperationalVault(snapshot).EVENTS);
  expect(buildOperationalVault(b).EXCLUDED).toEqual(buildOperationalVault(snapshot).EXCLUDED);
});
it('preserves explicit withdrawals when the operational API is merged with an older research snapshot', () => {
  const b = publicBundle(snapshot);
  b.facilities = []; b.companies = []; b.events = [];
  const result = reconcileBundle(b, snapshot);
  for (const field of ['facilities', 'companies', 'events', 'stages']) expect(result.bundle[field]).toEqual([]);
  expect(result.bundle.customers).toEqual({});
  expect(result.filled).not.toContain('customers');
});
