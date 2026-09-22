import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { reconcileInventorySnapshots } from '../../../server/src/operating-evidence.js';
const data = JSON.parse(readFileSync(new URL('../../../docs/reference/gf-operating-evidence.json', import.meta.url)));
const snapshot = data.records.filter(r => r.snapshotGroup === 'gf_inventory_2026-06-30');
describe('operating inventory boundaries', () => {
  it('reconciles signed accounting balances without inventing buffer days', () => {
    expect(reconcileInventorySnapshots(snapshot)[0]).toMatchObject({ status: 'reconciled', difference: 0, inventoryDays: null });
    const changed = structuredClone(snapshot);
    changed.find(r => r.metric === 'inventory_reserves').value *= -1;
    expect(reconcileInventorySnapshots(changed)[0].status).toBe('unreconciled');
  });
  it('rejects missing, duplicate, mixed-unit and mixed-period components', () => {
    for (const rows of [snapshot.slice(1), [...snapshot, snapshot[0]],
      snapshot.map((r, i) => i ? r : { ...r, units: 'wafers' }),
      snapshot.map((r, i) => i ? r : { ...r, periodEnd: '2025-12-31' })]) {
      expect(reconcileInventorySnapshots(rows)[0].status).toBe('incompatible_or_incomplete');
    }
  });
});
