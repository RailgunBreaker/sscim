import { buildOperationalVault } from '../../app/src/data/operationalVault.js';

// Public consumers get the same evidence boundary as the dashboard. The raw
// research vault remains local; never add private pilot records to this list.
const evidenceSections = ['operatingValidation', 'sourceAvailability', 'revenueCurrent', 'revenueValidation',
  'chainLossEvidence', 'chainLossVerification', 'lossReconciliations', 'supplierLossAllocations',
  'semiconductorLossFollowup', 'recoveryCalibration', 'physicalLosses', 'lagTwoValidation',
  'lossFilingMonitor', 'prospectivePerformance', 'prospectiveNewsPerformance', 'structuredCatalog', 'prospectiveNowcasts'];
export function publicBundle(raw) {
  const data = buildOperationalVault(raw);
  return {
    ...Object.fromEntries(evidenceSections.filter(key => key in raw).map(key => [key, raw[key]])),
    meta: { ...raw.meta, dataPolicy: 'reviewed-operational-v1' }, excluded: data.EXCLUDED,
    countries: (raw.countries || []).map(({ id, name, lat, lng }) => ({ id, name, lat, lng })),
    companies: data.COMPANIES.map(({ id, name, country, domain }) => ({ id, name, country, domain })),
    facilities: data.FACILITIES,
    events: data.EVENTS.map(e => ({ id: e.id, dateISO: e.dateISO, recordKind: 'factual', evidence: {
      occurrence: { status: 'verified', claim: e.claim }, sources: e.sources, review: e.review,
      baseline: { eligible: true, reason: 'reviewed_occurrence_only' },
    } })),
    observedData: { ...data.OBSERVED_DATA, observations: data.OBSERVED_ANALYSIS.observations,
      relationships: data.OBSERVED_ANALYSIS.relationships, manufacturingRoutes: data.OBSERVED_ANALYSIS.manufacturingRoutes },
    operatingEvidence: data.OPERATING_EVIDENCE,
    stages: [], flowEdges: [], tierLabels: [], customers: {}, owners: {}, policies: [], scenarios: [],
    dataNotes: [], measurementEvidence: [], briefings: [], briefingBodies: {}, quotes: raw.quotes || {},
  };
}
