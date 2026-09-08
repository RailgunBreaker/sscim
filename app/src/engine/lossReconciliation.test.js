import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lossReconciliation } from './lossReconciliation.js';
const data=JSON.parse(readFileSync(new URL('../../../docs/reference/loss-reconciliations.json',import.meta.url)));
it('reconciles Sony in three dimensions and keeps Renesas rounding visible',()=>{
  const r=lossReconciliation(data,'2026-09-08');
  expect(r.rejected).toEqual([]);
  expect(r.bridges.filter(b=>b.status==='reconciled')).toHaveLength(4);
  expect(r.bridges.find(b=>b.id==='renesas_countermeasures')).toMatchObject({status:'consistent_with_source_rounding',coverage:'complete_for_declared_parent'});
  expect(r.subtotal(['sony_fy16_semiconductors','sony_fy16_imaging','sony_fy16_corporate']).value).toBeCloseTo(52.8);
  expect(r.scopedAccounts.find(a=>a.parentId==='sony_fy16_consolidated')).toMatchObject({disclosedScopeComplete:true,disclosedImpact:52.8});
  expect(r.subtotal(['wdc_power_cost_fy2020','wdc_power_recovery_fy2021','wdc_power_recovery_fy2022'])).toMatchObject({value:-14,permanentEconomicLoss:null});
});
it('rejects parent-child double counting, currencies, missing partitions and forecasts',()=>{
  const r=lossReconciliation(data,'2026-09-08');
  expect(()=>r.subtotal(['sony_fy16_consolidated','sony_fy16_semiconductors'])).toThrow(/double-count/);
  expect(()=>r.subtotal(['sony_fy16_consolidated','sony_fy16_q1'])).toThrow(/double-count/);
  expect(()=>r.subtotal(['sony_fy16_damage','wdc_contamination_fy2022'])).toThrow(/boundary/);
  const missing=structuredClone(data);missing.bridges[0].childIds.pop();
  expect(lossReconciliation(missing,'2026-09-08').bridges[0].status).toBe('invalid_partition');
  expect(lossReconciliation(missing,'2026-09-08').scopedAccounts.find(a=>a.parentId==='sony_fy16_consolidated').disclosedImpact).toBeNull();
  const forecast=structuredClone(data);forecast.records[0].kind='issuer_forecast';
  expect(lossReconciliation(forecast,'2026-09-08').rejected).toContain(forecast.records[0].id);
  expect(lossReconciliation(data,'2016-01-01').records).toHaveLength(0);
});
it('does not equate deferred sales with permanent loss or force a bad sum to match',()=>{
  const r=lossReconciliation(data,'2026-09-08');
  expect(r.records.find(r=>r.id==='nokia_factory_closures_2020')).toMatchObject({value:200,majorityExpectedDeferred:true,recoveryObserved:false,permanentEconomicLoss:null});
  const bad=structuredClone(data);bad.records.find(r=>r.id==='sony_fy16_imaging').value=20;
  expect(lossReconciliation(bad,'2026-09-08').bridges[0].status).toBe('unreconciled');
});
