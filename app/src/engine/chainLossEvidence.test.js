import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { chainLossEvidence } from './chainLossEvidence.js';
const data = JSON.parse(readFileSync(new URL('../../../docs/reference/chain-loss-evidence.json', import.meta.url)));
it('retains reported downstream effects without inventing an allocated plant loss', () => {
  const a = chainLossEvidence(data, '2026-09-08');
  expect(a.rejected).toEqual([]);
  expect(a.attributedEffects('renesas_naka_fire_2021')[0].allocatedLoss).toBeNull();
  expect(a.attributedEffects('renesas_naka_fire_2021')[0].downstreamRecords.length).toBe(5);
  expect(chainLossEvidence({ ...data, transmissionEvidence: [] }, '2026-09-08').attributedEffects('renesas_naka_fire_2021')).toEqual([]);
  expect(a.chainWideLoss).toBeNull();
});
it('prevents forecasts, fractions and overlapping company periods from being summed', () => {
  const a = chainLossEvidence(data, '2026-09-08');
  expect(a.reportedSubtotal(['ford_2021q1_lost_units','stellantis_2021q3_lost_units']).value).toBe(800000);
  expect(() => a.reportedSubtotal(['ford_2021q2_loss_forecast'])).toThrow(/reported/);
  expect(() => a.reportedSubtotal(['stellantis_2021q3_lost_fraction'])).toThrow(/Nonadditive/);
  const duplicate = { ...data.records[0], id: 'another_claim', periodEnd: '2021-02-28' };
  const b = chainLossEvidence({ ...data, records: [...data.records, duplicate] }, '2026-09-08');
  expect(() => b.reportedSubtotal([duplicate.id,data.records[0].id])).toThrow(/Overlapping/);
  expect(chainLossEvidence(data, '2021-04-01').records).toHaveLength(0);
});
