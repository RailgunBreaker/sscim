import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildFinancialEvidence, scoreFinancialPredictions } from './financialEvidence.js';
const data = JSON.parse(readFileSync(new URL('../../../docs/reference/observed-data.json', import.meta.url)));
const asOf = '2026-09-07';
describe('reported financial outcomes', () => {
  it('compares like-for-like forecasts to later outcomes without treating correlated metrics as independent incidents', () => {
    const result = buildFinancialEvidence(data.financialOutcomes, asOf);
    expect(result.rejected).toEqual([]);
    expect(result.comparisons).toHaveLength(6);
    expect(result.comparedIncidents).toBe(2);
    const fire = result.comparisons.find(r => r.incidentId === 'renesas_naka_fire_2021' && r.metric === 'revenue_impact');
    expect(fire.forecast).toBe(-17);
    expect(fire.actual).toBe(-12.6);
    expect(fire.absoluteError).toBeCloseTo(4.4);
    expect(fire.absoluteErrorRoundingBounds.low).toBeCloseTo(4.3);
    expect(fire.absoluteErrorRoundingBounds.high).toBeCloseTo(4.5);
    expect(result.modelValidated).toBe(false);
  });
  it('keeps forecasts and future disclosures out of observed history and rejects conflicting IDs', () => {
    expect(buildFinancialEvidence(data.financialOutcomes, '2021-05-01').outcomes.some(r => r.periodEnd === '2021-06-30')).toBe(false);
    const r = data.financialOutcomes[0];
    expect(buildFinancialEvidence([r, { ...r, amount: 100 }], asOf).outcomes).toEqual([]);
  });
  it('refuses mismatched targets, hindsight forecasts and incident leakage', () => {
    const actual = data.financialOutcomes.find(r => r.incidentId === 'renesas_naka_fire_2021' && r.metric === 'revenue_impact' && r.kind === 'reported_outcome');
    const prediction = { ...actual, id: 'test', modelId: 'fixture', issuedAt: '2021-04-28', amount: -17 };
    const options = { asOf, modelId: 'fixture' };
    expect(scoreFinancialPredictions(data.financialOutcomes, [prediction], options).scores[0].absoluteError).toBeCloseTo(4.4);
    expect(scoreFinancialPredictions(data.financialOutcomes, [{ ...prediction, units: 'USD billion' }], options).scores).toEqual([]);
    expect(() => scoreFinancialPredictions(data.financialOutcomes, [{ ...prediction, issuedAt: '2021-07-29' }], options)).toThrow(/after/);
    expect(() => scoreFinancialPredictions(data.financialOutcomes, [prediction], { ...options, trainingIncidentIds: [prediction.incidentId] })).toThrow(/leakage/);
  });
  it('rejects a forecast that became available only after its target quarter ended', () => {
    const forecast = data.financialOutcomes.find(r => r.kind === 'issuer_forecast');
    const delayed = { ...forecast, source: { ...forecast.source, informationAvailableDate: '2026-01-01' } };
    expect(buildFinancialEvidence([delayed], asOf).forecasts).toEqual([]);
  });
});
