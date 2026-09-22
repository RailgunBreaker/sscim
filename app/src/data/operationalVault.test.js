import { it, expect } from 'vitest';
import snapshot from './vault-snapshot.json';
import { buildOperationalVault } from './operationalVault.js';
import { reconcileBundle } from './reconcileBundle.js';
it('removes assumed scores, generated narratives and unreviewed relationships from the operational data', () => {
  const data = buildOperationalVault(snapshot);
  expect(data.EVENTS.length).toBeGreaterThan(0);
  expect(data.EXCLUDED.events).toBeGreaterThan(100);
  expect(data.EVENTS.every(e => !('sev' in e) && !('summary' in e) && !('second' in e) && e.claim && e.sources.length)).toBe(true);
  expect(data.STAGES).toEqual([]);
  expect(data.CUSTOMERS).toEqual({});
  expect(data.FACILITY_NETWORK).toBeNull();
  expect(data.FACILITIES.every(f => !('scale' in f) && (f.evidence || f.capacities.length))).toBe(true);
  expect(data.COMPANIES.every(c => !('stakes' in c))).toBe(true);
  expect(data.OBSERVED_ANALYSIS.relationships.length).toBeGreaterThan(0);
});
it('honors operating-record withdrawal and rejects claims unavailable at the snapshot date', () => {
  const live = { ...snapshot, operatingEvidence: { records: [] } };
  const merged = reconcileBundle(live, snapshot);
  expect(buildOperationalVault(merged.bundle).OPERATING_EVIDENCE.records).toEqual([]);
  expect(merged.filled).not.toContain('operatingEvidence');
  const changed = structuredClone(snapshot);
  changed.operatingEvidence.records.forEach(r => r.source.informationAvailableDate = '2099-01-01');
  expect(buildOperationalVault(changed).OPERATING_EVIDENCE.records).toEqual([]);
});
