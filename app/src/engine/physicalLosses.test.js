import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {physicalLosses} from './physicalLosses.js';
const load=p=>JSON.parse(readFileSync(new URL('../../../docs/reference/'+p,import.meta.url),'utf8'));
const data=load('physical-losses.json'),recovery=load('recovery-durations.json'),asOf='2026-09-09';
it('retains a reported gross loss after full input recovery without inventing net or downstream losses',()=>{
  const report=physicalLosses(data,recovery,asOf);
  expect(report.rejected).toEqual([]);
  expect(report.records.map(r=>r.value)).toEqual([14,21,10,7]);
  expect(report.records.every(r=>r.capacityRestored&&r.permanentLoss===null&&r.downstreamLoss===null)).toBe(true);
  expect(report.chainWideLoss).toBeNull();
  expect(report.normalizedDaysSubtotal).toBeNull();
  expect(report.incidentCount).toBe(2);
  expect(report.records[0].endpointLinearDiagnosticDays).toBe(5.5);
});
it('rejects forecasts, mismatched facility joins and cross-metric substitutions',()=>{
  for(const mutate of [r=>r.kind='issuer_forecast',r=>r.facilityId='tsmc',r=>r.units='USD',r=>r.metric='tools_restored',r=>r.components=[]]) {
    const modified=structuredClone(data);mutate(modified.records[0]);
    expect(physicalLosses(modified,recovery,asOf).rejected).toContain(data.records[0].id);
  }
});
it('rejects duplicate denominators and unavailable outcomes',()=>{
  expect(physicalLosses({...data,records:[...data.records,{...data.records[0],id:'duplicate'}]},recovery,asOf).rejected).toContain('duplicate');
  expect(physicalLosses(data,recovery,'2022-03-18').records).toHaveLength(0);
});
it('does not accept a qualitative completed state if source evidence is withdrawn',()=>{
  const changed=structuredClone(recovery);changed.records.find(r=>r.id==='naka_2022_quake_duration').claimStatus='unreviewed';
  const report=physicalLosses(data,changed,asOf);
  expect(report.records).toHaveLength(2);
  expect(report.rejectedRecoveryRecords).toHaveLength(1);
});
