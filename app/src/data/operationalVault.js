import { buildVaultData } from './buildVaultData.js';
import { factualEligibility } from '../engine/evidence.js';
import { reviewedClaim, sourceAvailable, validDate } from '../engine/evidenceContract.js';

// The dashboard consumes this projection, never the illustrative score engine.
// Historical research inputs remain in the vault for reproducibility.
export function buildOperationalVault(bundle) {
  const data = buildVaultData(bundle), asOf = bundle.meta?.snapshotDate;
  const capacities = (data.OBSERVED_DATA.capacities || []).filter(r => reviewedClaim(r, asOf) && r.period <= asOf);
  const facilities = (bundle.facilities || []).filter(f => capacities.some(r => r.facilityId === f.id)
    || (f.evidence?.claimStatus === 'verified_scoped' && validDate(f.evidence.verifiedAt)
      && f.evidence.verifiedAt <= asOf && /^https?:\/\//.test(f.evidence.url) && f.evidence.supportingSection));
  const records = (data.OPERATING_EVIDENCE.records || []).filter(r => reviewedClaim(r, asOf)
    && (!r.periodEnd || r.periodEnd <= asOf) && (!r.periodStart || r.periodStart <= asOf));
  const events = data.EVENTS.filter(e => {
    const result = factualEligibility(e, asOf);
    return result.factual && result.eligible;
  }).map(e => ({ id: e.id, dateISO: e.dateISO,
    // Use the reviewed occurrence claim, not generated summaries or consequences.
    claim: e.evidence.occurrence.claim,
    sources: e.evidence.sources.filter(s => s.supports?.includes('occurrence') && sourceAvailable(s, asOf)),
    review: e.evidence.review,
  }));
  return { ...data, COMPANIES: data.COMPANIES.map(({ stakes, ...company }) => company),
    COMPANY_BY_ID: Object.fromEntries(data.COMPANIES.map(({ stakes, ...company }) => [company.id, company])),
    EVENTS: events, STAGES: [], FLOW_EDGES: [], TIER_LABELS: [], CUSTOMERS: {}, SUPPLIERS: {},
    POLICIES: [], OWNERS: {}, SCENARIOS: [], BRIEFINGS: [], BRIEFING_BODIES: {}, COMP_META: {}, MEASUREMENT_EVIDENCE: [], DATA_NOTES: [],
    FACILITY_LAYER: null, FACILITY_NETWORK: null,
    FACILITIES: facilities.map(f => ({ id: f.id, name: f.name, company: f.company, country: f.country,
      lat: f.lat, lng: f.lng, evidence: f.evidence?.claimStatus === 'verified_scoped' ? f.evidence : null,
      capacities: capacities.filter(r => r.facilityId === f.id), locationBasis: 'Approximate reference location; coordinates are not independently verified' })),
    OPERATING_EVIDENCE: { ...data.OPERATING_EVIDENCE, records },
    EXCLUDED: bundle.meta?.dataPolicy === 'reviewed-operational-v1' && bundle.excluded ? bundle.excluded : { events: data.EVENTS.length - events.length, facilities: (bundle.facilities || []).length - facilities.length,
      relationships: Object.values(bundle.customers || {}).reduce((n, rows) => n + rows.length, 0) },
  };
}
