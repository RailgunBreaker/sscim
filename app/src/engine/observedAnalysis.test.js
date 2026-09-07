import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildObservedAnalysis, measuredCapacityShares } from './observedAnalysis.js';
import { evaluateRecoveryOutcomes } from './outcomeEvaluation.js';
const data = JSON.parse(readFileSync(new URL('../../../docs/reference/observed-data.json', import.meta.url)));
const asOf = '2026-09-07';
const build = overrides => buildObservedAnalysis({ ...data, asOf, ...overrides });

describe('observed analysis, independent of illustrative seed coefficients', () => {
  it('traces only documented process routes without inventing shipment allocations', () => {
    const route = build().traceManufacturing('intel_kulim_diesort');
    expect(route.map(r => r.id)).toEqual(['intel_penang_assembly']);
    expect(route[0].productionImpact).toBeNull();
    expect(build({ manufacturingRoutes: [] }).traceManufacturing('intel_kulim_diesort')).toEqual([]);
    expect(build({ asOf: '2023-09-17' }).manufacturingRoutes).toEqual([]);
  });
  it('company edge ablation changes the actual documented dependency calculation', () => {
    const full = build(), empty = build({ relationships: [] });
    const row = data.relationships[0];
    const args = { supplierDisruptions: { tsmc: .5 }, productScope: row.productScope, periodEnd: row.periodEnd };
    expect(full.inputExposure('amd', args).value).toEqual({ low: .5, high: .5 });
    expect(empty.inputExposure('amd', args).value).toBeNull();
    expect(full.companyAssessment('tsmc').documentedCustomerReach).toBe(2);
    expect(empty.companyAssessment('tsmc').documentedCustomerReach).toBe(0);
    expect(full.facilityLinks).toEqual([]);
  });
  it('does not turn unquantified relationships into precise shares or production loss', () => {
    const row = data.relationships.find(r => r.supplier === 'gf');
    const result = build().inputExposure('amd', { supplierDisruptions: { gf: 1 }, productScope: row.productScope, periodEnd: row.periodEnd });
    expect(result.value).toEqual({ low: 0, high: 1 });
    expect(result.productionImpact).toBeNull();
  });
  it('uses a reported buyer input share and marks multi-hop paths as unquantified inferences', () => {
    const row = data.relationships.find(r => r.id === 'soitec_gf_soi_2024');
    const analysis = build();
    const result = analysis.inputExposure('gf', { productScope: row.productScope, periodEnd: row.periodEnd,
      supplierDisruptions: { soitec: .5 } });
    expect(result.value.low).toBeCloseTo(.305);
    expect(result.value.high).toBeCloseTo(.695);
    const amd = analysis.companyAssessment('soitec').downstream.find(r => r.id === 'amd');
    expect(amd.inference).toBe(true);
    expect(amd.productionImpact).toBeNull();
    expect(build({ relationships: data.relationships.filter(r => r.id !== row.id) }).companyAssessment('soitec').documentedCustomerReach).toBe(0);
  });
  it('gates source dates, false citations, malformed dates and forecasts', () => {
    const row = structuredClone(data.observations[0]);
    for (const change of [r => r.source.publicationDate = '2027-01-01', r => r.source.url = 'javascript:alert(1)',
      r => r.observedAt = '2021-02-30', r => r.kind = 'forecast', r => r.review = null]) {
      const altered = structuredClone(row); change(altered);
      expect(build({ observations: [altered] }).observations).toHaveLength(0);
    }
  });
  it('does not backdate evidence or claim a historical recovery is current', () => {
    expect(build({ asOf: '2021-04-18', observations: [data.observations[0]] }).observations).toHaveLength(0);
    const row = data.observations[0];
    expect(build().latestObservation(row.scope, row.metric).currentValue).toBeNull();
  });
  it('normalizes only a complete, compatible, source-supported capacity population', () => {
    const pop = data.capacityPopulations.find(p => p.units.startsWith('12-inch'));
    const opts = { ...pop, period: '2025-12-31', asOf };
    const r = measuredCapacityShares(data.capacities, opts);
    expect(r.status).toBe('issuer_reported_maximum');
    expect(r.total).toBe(3131000);
    expect(r.shares.umc_fab12a).toBeCloseTo(1629 / 3131);
    expect(measuredCapacityShares(data.capacities.filter(r => r.facilityId !== 'umc_xiamen'), opts).shares).toBeNull();
    expect(measuredCapacityShares(data.capacities, { ...opts, asOf: '2025-12-31' }).shares).toBeNull();
    const ordinals = data.capacities.map(r => ({ ...r, basis: 'analyst_ordinal' }));
    expect(measuredCapacityShares(ordinals, opts).shares).toBeNull();
    const mixed = structuredClone(data.capacities);
    mixed.find(r => r.period === opts.period && r.units === opts.units).basis = 'measured';
    expect(measuredCapacityShares(mixed, opts).shares).toBeNull();
    expect(measuredCapacityShares(data.capacities, { ...opts, expectedFacilityIds: [...opts.expectedFacilityIds, opts.expectedFacilityIds[0]] }).shares).toBeNull();
  });
  it('holds out whole incidents and retains failure against independent outcomes', () => {
    const options = { asOf, trainingIncidentIds: ['renesas_naka_fire_2021'], holdoutIncidentIds: ['fukushima_earthquake_2022'] };
    expect(evaluateRecoveryOutcomes(data.observations, options).status).toBe('incompatible_recovery_targets');
    const r = evaluateRecoveryOutcomes(data.observations, { ...options, allowCrossMetricDiagnostic: true });
    expect(r.holdoutRecords).toBe(3);
    expect(r.candidateMAE).toBeGreaterThan(.1);
    expect(r.calibratedParameters).toEqual([]);
    expect(() => evaluateRecoveryOutcomes(data.observations, { ...options, holdoutIncidentIds: options.trainingIncidentIds })).toThrow(/leakage/);
  });
});
