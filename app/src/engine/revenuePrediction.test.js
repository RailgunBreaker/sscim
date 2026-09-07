import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { predictRevenue, evaluateRevenuePrediction, validateRevenueRows, logErrorRadius, attachRevenueVintages } from './revenuePrediction.js';
const read = path => JSON.parse(readFileSync(new URL(`../../../docs/reference/${path}`, import.meta.url)));
const data = read('tsmc-monthly-revenue.json');
const protocol = read('revenue-prediction-protocol.json');
const audit = JSON.parse(readFileSync(new URL('../../../docs/benchmarks/revenue-vintage-audit.json', import.meta.url)));
describe('chronological revenue prediction', () => {
  it('verifies original releases and dates every reconstructed nowcast before outcome disclosure', () => {
    const verified = attachRevenueVintages(data, audit);
    const r = evaluateRevenuePrediction(verified, protocol);
    expect(r.historicalVintagesVerified).toBe(true);
    expect(r.predictions.every(p => p.issuedOn.startsWith(p.period) && p.issuedOn < p.outcomeAvailableBy)).toBe(true);
    const incorrect = structuredClone(audit);
    incorrect.records[0].amountInOriginalDisclosure += 1;
    expect(() => attachRevenueVintages(data, incorrect)).toThrow(/Unverified/);
    const late = structuredClone(verified.records.filter(r => r.period < '2024-01'));
    late.at(-1).availableBy = '2024-02-10';
    expect(() => predictRevenue(late, '2024-01')).toThrow(/unavailable/);
  });
  it('reproduces the locked comparison and independently computes all test errors', () => {
    const r = evaluateRevenuePrediction(data, protocol);
    expect(r.selectedWindow).toBe(3);
    expect(r.predictions).toHaveLength(24);
    expect(r.test.mae).toBeCloseTo(r.predictions.reduce((s, p) => s + Math.abs(p.actual - p.prediction), 0) / 24);
    expect(r.test.coverage).toBe(22 / 24);
    expect(r.prospectiveValidated).toBe(false);
    expect(r.disruptionCausalityValidated).toBe(false);
    expect(r.globalParametersCalibrated).toEqual([]);
    expect(r.comparisons.every(c => c.differenceInterval.low < c.differenceInterval.high)).toBe(true);
  });
  it('prevents test outcomes from selecting the model or widening calibration intervals', () => {
    const altered = structuredClone(data);
    altered.records.filter(r => r.period >= protocol.testStart).forEach(r => r.amount *= 10);
    const a = evaluateRevenuePrediction(data, protocol), b = evaluateRevenuePrediction(altered, protocol);
    expect(b.selection).toEqual(a.selection);
    expect(b.calibration).toEqual(a.calibration);
    expect(b.predictions[0].prediction).toBe(a.predictions[0].prediction);
    expect(b.status).toBe('historical_benchmark_fail');
  });
  it('rejects unavailable months, target leakage and a changed target definition', () => {
    const history = data.records.filter(r => r.period < '2024-01');
    expect(() => predictRevenue(data.records, '2024-01')).toThrow(/leaked/);
    expect(() => predictRevenue(history.slice(0, -1), '2024-01')).toThrow(/history/);
    expect(() => validateRevenueRows([history[0], history[0]])).toThrow(/Duplicate/);
    expect(() => validateRevenueRows([{ period: '2024-13', amount: 1 }])).toThrow(/month/);
    expect(() => evaluateRevenuePrediction({ ...data, units: 'USD million' }, protocol)).toThrow(/target/);
    expect(() => evaluateRevenuePrediction(data, { ...protocol, testStart: protocol.calibrationEnd })).toThrow(/Overlapping/);
    expect(() => evaluateRevenuePrediction(data, { ...protocol, baselineModels: [] })).toThrow(/baselines/);
  });
  it('uses the finite-sample calibration rank and rejects an undersized calibration set', () => {
    expect(logErrorRadius(Array.from({ length: 24 }, (_, i) => ({ actual: Math.exp(i / 100), prediction: 1 })))).toBeCloseTo(.19);
    expect(() => logErrorRadius([{ actual: 1, prediction: 1 }])).toThrow(/Insufficient/);
  });
});
