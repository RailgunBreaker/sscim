import { COMP_META } from './compMeta.js';
import { buildFacilityLayer } from '../engine/facilities.js';
import { buildObservedAnalysis } from '../engine/observedAnalysis.js';
import { buildFinancialEvidence } from '../engine/financialEvidence.js';
import { chainLossEvidence } from '../engine/chainLossEvidence.js';
import { chainLossAccounts } from '../engine/chainLossAccounts.js';
import { lossReconciliation } from '../engine/lossReconciliation.js';
import { supplierLossAllocation } from '../engine/supplierLossAllocation.js';
import { semiconductorLossFollowup } from '../engine/semiconductorLossFollowup.js';

/* Shapes a raw vault bundle into the object the engine and the UI consume.

   Extracted from VaultContext.jsx so it can run outside React: the nightly
   briefing archiver (server/scripts/archive-briefing.mjs) needs exactly this
   shape to rebuild the engine from an exported snapshot, and duplicating the
   derivation would let the archived briefing drift from the live one. */
export function buildVaultData(bundle) {

  const COUNTRY_NAMES = Object.fromEntries(bundle.countries.map((c) => [c.id, c.name]));
  const COUNTRY_POS = Object.fromEntries(bundle.countries.map((c) => [c.id, [c.lat, c.lng]]));
  const COMPANY_BY_ID = Object.fromEntries(bundle.companies.map((c) => [c.id, c]));
  const DOMAINS = Object.fromEntries(bundle.companies.filter((c) => c.domain).map((c) => [c.id, c.domain]));
  const SUPPLIERS = {};
  Object.entries(bundle.customers).forEach(([supId, list]) => {
    list.forEach(([custId, sh]) => (SUPPLIERS[custId] ||= []).push([supId, sh]));
  });
  /* Site-level geography (engine/facilities.js). A bundle exported before the
     facilities table existed simply has none — the layer degrades to empty
     indices and every consumer renders the country view it always did. */
  const FACILITY_LAYER = buildFacilityLayer(bundle.facilities || []);

  const data = {
    OBSERVED_DATA: bundle.observedData || { observations: [], relationships: [], capacities: [] },
    OBSERVED_ANALYSIS: buildObservedAnalysis({ ...bundle.observedData, asOf: bundle.meta?.snapshotDate }),
    FINANCIAL_EVIDENCE: buildFinancialEvidence(bundle.observedData?.financialOutcomes, bundle.meta?.snapshotDate),
    REVENUE_VALIDATION: bundle.revenueValidation || null,
    CHAIN_LOSS: chainLossEvidence(bundle.chainLossEvidence || {}, bundle.meta?.snapshotDate),
    CHAIN_ACCOUNTS: chainLossAccounts(bundle.chainLossEvidence || {}, bundle.meta?.snapshotDate),
    LOSS_RECONCILIATION: lossReconciliation(bundle.lossReconciliations || {}, bundle.meta?.snapshotDate),
    SUPPLIER_LOSS_ALLOCATION: supplierLossAllocation(bundle.supplierLossAllocations || {}, bundle.meta?.snapshotDate),
    SEMICONDUCTOR_LOSS_FOLLOWUP: semiconductorLossFollowup(bundle.semiconductorLossFollowup || {}, bundle.meta?.snapshotDate),
    LOSS_FILING_MONITOR: Array.isArray(bundle.lossFilingMonitor?.checks) && Array.isArray(bundle.lossFilingMonitor?.candidates) ? bundle.lossFilingMonitor : null,
    RECOVERY_CALIBRATION: bundle.recoveryCalibration?.status === 'exploratory_empirical_fit' ? bundle.recoveryCalibration : null,
    PHYSICAL_LOSSES: Array.isArray(bundle.physicalLosses?.records) ? bundle.physicalLosses : null,
    LAG_TWO_VALIDATION: bundle.lagTwoValidation?.status === 'retrospective_horizon_diagnostic' ? bundle.lagTwoValidation : null,
    PROSPECTIVE_PERFORMANCE: bundle.prospectivePerformance || null,
    PROSPECTIVE_NEWS: bundle.prospectiveNewsPerformance || null,
    PROSPECTIVE_NOWCASTS: bundle.prospectiveNowcasts || [],
    STRUCTURED_CATALOG: bundle.structuredCatalog || null,
    STAGES: bundle.stages,
    FLOW_EDGES: bundle.flowEdges,
    TIER_LABELS: bundle.tierLabels,
    COUNTRY_NAMES, COUNTRY_POS,
    FACILITIES: FACILITY_LAYER.FACILITIES,
    FACILITY_LAYER,
    COMPANIES: bundle.companies, COMPANY_BY_ID, DOMAINS,
    CUSTOMERS: bundle.customers, SUPPLIERS,
    POLICIES: bundle.policies,
    EVENTS: bundle.events.map((event) => ({ ...event, recordKind: 'factual' })),
    SCENARIOS: bundle.scenarios,
    OWNERS: bundle.owners,
    DATA_NOTES: bundle.dataNotes,
    MEASUREMENT_EVIDENCE: bundle.measurementEvidence || [],
    QUOTES: bundle.quotes || {}, // market quotes (price/PE) — display metadata, never an engine input
    META: bundle.meta || {},     // snapshot date + last pipeline run, for the freshness readout
    BRIEFINGS: bundle.briefings || [],           // archive index (no bodies)
    BRIEFING_BODIES: bundle.briefingBodies || {}, // recent bodies, for the static deploy

    COMP_META,
  };
  return data;
}
