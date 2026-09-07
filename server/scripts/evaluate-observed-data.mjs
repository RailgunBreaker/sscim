import { readFileSync, writeFileSync } from 'node:fs';
import { buildObservedAnalysis, measuredCapacityShares } from '../../app/src/engine/observedAnalysis.js';
import { evaluateRecoveryOutcomes } from '../../app/src/engine/outcomeEvaluation.js';
import { buildFinancialEvidence } from '../../app/src/engine/financialEvidence.js';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('docs/reference/observed-data.json', root), 'utf8'));
const asOf = data.reviewedAt;
const analysis = buildObservedAnalysis({ ...data, asOf });
const financialEvidence = buildFinancialEvidence(data.financialOutcomes, asOf);
if (financialEvidence.rejected.length) throw new Error(JSON.stringify(financialEvidence.rejected));
if (analysis.rejected.length) throw new Error(JSON.stringify(analysis.rejected));
const capacityChecks = data.capacityPopulations.flatMap(pop => [2022, 2023, 2024, 2025].map(year => {
  const result = measuredCapacityShares(data.capacities, { ...pop, period: `${year}-12-31`, asOf });
  if (!result.shares) throw new Error(`Invalid capacity population: ${JSON.stringify(result)}`);
  return result;
}));
const recovery = evaluateRecoveryOutcomes(data.observations, { asOf, allowCrossMetricDiagnostic: true,
  trainingIncidentIds: ['renesas_naka_fire_2021'], holdoutIncidentIds: ['fukushima_earthquake_2022'] });
const withoutLinks = buildObservedAnalysis({ observations: data.observations, relationships: [], asOf });
const graphAblation = { tsmcReach: analysis.companyAssessment('tsmc').documentedCustomerReach,
  withoutLinks: withoutLinks.companyAssessment('tsmc').documentedCustomerReach,
  stageAssumptionsUsed: false, synthesizedPlantLinks: analysis.facilityLinks.length };
if (graphAblation.tsmcReach <= graphAblation.withoutLinks) throw new Error('Observed graph ablation failed');
const report = { asOf, records: { capacity: data.capacities.length, observations: analysis.observations.length,
  companyRelationships: analysis.relationships.length, financialOutcomes: financialEvidence.outcomes.length,
  issuerForecasts: financialEvidence.forecasts.length, reportedManufacturingRoutes: analysis.manufacturingRoutes.length },
  capacityChecks, graphAblation, recovery, financialEvidence,
  routeAblation: { withRoute: analysis.traceManufacturing('intel_kulim_diesort').length,
    withoutRoute: withoutLinks.traceManufacturing('intel_kulim_diesort').length, productionLossEstimated: false } };
writeFileSync(new URL('docs/benchmarks/observed-data-evaluation.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ records: report.records, graphAblation, recovery: { status: recovery.status,
  candidateHalfLifeDays: recovery.candidateHalfLifeDays, baselineMAE: recovery.baselineMAE, candidateMAE: recovery.candidateMAE } }, null, 2));
