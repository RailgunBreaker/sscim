import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {attachRevenueVintages} from './revenuePrediction.js';
import {evaluateLagTwoValidation} from './lagTwoValidation.js';
const load=p=>JSON.parse(readFileSync(new URL('../../../'+p,import.meta.url),'utf8'));
const data=attachRevenueVintages(load('docs/reference/tsmc-monthly-revenue.json'),load('docs/benchmarks/revenue-vintage-audit.json'));
const protocol=load('docs/reference/prospective-protocol.json');
it('replays the captured interval and point rule with all calibration labels available',()=>{
  const report=evaluateLagTwoValidation(data,protocol);
  const captured=load('docs/prospective/tsmc-revenue-lag2-prospective-v1-2026-09.json').record;
  expect(report.calibration.logErrorRadius).toBe(captured.calibration.logErrorRadius);
  expect(report.predictions).toHaveLength(24);
  expect(Date.parse(report.predictions[0].originDate)).toBeGreaterThan(Date.parse(report.calibration.availableBy));
  expect(report.test.mae).toBeCloseTo(20927.8541,3);
  expect(report.test.covered).toBe(22);
  expect(report.predictions[0].lastInputPeriod).toBe('2023-11');
  expect(report.predictions[0].baselineLastInputPeriod).toBe('2023-12');
  expect(report.predictions[0].baselines.latest_available_month).toBe(data.records.find(r=>r.period==='2023-12').amount);
  expect(report.beatsEveryBaseline).toBe(true);
  expect(report.prospectiveValidated).toBe(false);
});
it('never changes the first prediction or interval when its target outcome changes',()=>{
  const before=evaluateLagTwoValidation(data,protocol), changed=structuredClone(data);
  changed.records.find(r=>r.period==='2024-01').amount*=2;
  const after=evaluateLagTwoValidation(changed,protocol);
  for(const field of ['prediction','lower','upper']) expect(after.predictions[0][field]).toBe(before.predictions[0][field]);
  expect(after.calibration).toEqual(before.calibration);
  expect(after.test.mae).not.toBe(before.test.mae);
});
it('rejects unavailable calibration labels and missing target months',()=>{
  const late=structuredClone(data); late.records.find(r=>r.period==='2023-12').availableBy='2024-03-01';
  expect(()=>evaluateLagTwoValidation(late,protocol)).toThrow(/unavailable|Unavailable/);
  expect(()=>evaluateLagTwoValidation({...data,records:data.records.filter(r=>r.period!=='2024-06')},protocol)).toThrow(/missing/);
});
it('rejects changed targets, horizons and overlapping periods',()=>{
  expect(()=>evaluateLagTwoValidation({...data,units:'USD'},protocol)).toThrow(/target/);
  expect(()=>evaluateLagTwoValidation(data,{...protocol,informationLagMonths:1})).toThrow(/protocol/);
  expect(()=>evaluateLagTwoValidation(data,protocol,{testStart:'2023-01',testEnd:'2025-12'})).toThrow(/Overlapping/);
});
