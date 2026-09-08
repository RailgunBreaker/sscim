import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { chainLossAccounts } from './chainLossAccounts.js';
const data = JSON.parse(readFileSync(new URL('../../../docs/reference/chain-loss-evidence.json',import.meta.url)));
it('retains published qualifiers and refuses overlapping periods or issuer additions', () => {
  const a = chainLossAccounts(data,'2026-09-08');
  expect(a.estimates).toHaveLength(4);
  expect(a.aggregate(['spglobal_2021_light_vehicle_loss'])).toMatchObject({ reportedValueSum: 9500000, qualifier: 'greater_than', exactTotal: null });
  expect(() => a.aggregate(['spglobal_2021_light_vehicle_loss','spglobal_2021q3_light_vehicle_loss'])).toThrow(/Overlapping/);
  expect(() => a.aggregate(['spglobal_2021_light_vehicle_loss','ford_2021q1_lost_units'])).toThrow(/issuer/);
  expect(a.aggregate(['spglobal_2021_light_vehicle_loss','spglobal_2022_light_vehicle_loss']).qualifier).toBe('mixed_reported_precision');
  expect(a.allIndustryLoss).toBeNull();
  expect(chainLossAccounts(data,'2022-01-01').estimates).toHaveLength(0);
});
it('rejects cross-sector accounting, duplicates and future outcome disclosures', () => {
  const bad = structuredClone(data); bad.sectorEstimates[1].scopeId = 'another_sector';
  const a = chainLossAccounts(bad,'2026-09-08');
  expect(() => a.aggregate([bad.sectorEstimates[1].id,bad.sectorEstimates[2].id])).toThrow(/Incompatible/);
  const future = structuredClone(data); future.sectorEstimates[0].periodEnd = '2024-01-01';
  expect(chainLossAccounts(future,'2026-09-08').rejected).toContain(future.sectorEstimates[0].id);
  expect(() => chainLossAccounts({sectorEstimates:[data.sectorEstimates[0],data.sectorEstimates[0]]},'2026-09-08')).toThrow(/Duplicate/);
});
