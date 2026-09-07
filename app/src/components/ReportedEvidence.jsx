import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { reviewedClaim } from '../engine/evidenceContract.js';

const box = { border: `1px solid ${C.line}`, padding: 10, margin: '10px 0', fontSize: 12, lineHeight: 1.6 };

export function ReportedCompanyEvidence({ companyId }) {
  const { data } = useVault();
  const analysis = data.OBSERVED_ANALYSIS;
  if (!analysis) return null;
  const rows = analysis.relationships.filter(r => r.level === 'company' && (r.supplier === companyId || r.customer === companyId));
  const assessment = analysis.companyAssessment(companyId);
  const name = id => data.COMPANY_BY_ID[id]?.name || id.toUpperCase();
  return <section aria-label="Documented company evidence" style={box}>
    <b>Documented supplier relationships</b>
    {rows.length ? <ul style={{ paddingLeft: 20 }}>{rows.map(r => <li key={r.id}>
      {name(r.supplier)} → {name(r.customer)}: {r.productScope}. Input share: {r.inputShare == null ? 'unknown' : `${Math.round(r.inputShare * 100)}%`}.
      {' '}<a href={r.source.url} target="_blank" rel="noreferrer">Disclosure for {r.periodEnd}</a>
    </li>)}</ul> : <p>No reviewed supplier disclosure for this company in the current ledger. This does not establish that it has no suppliers or customers.</p>}
    <p>Documented downstream reach: {assessment.documentedCustomerReach} companies. Counts use disclosed relationships; indirect paths do not establish product continuity or lost output.</p>
  </section>;
}

export function ReportedFacilityEvidence({ facilityId }) {
  const { data } = useVault();
  const asOf = data.OBSERVED_ANALYSIS?.asOf;
  const rows = (data.OBSERVED_DATA?.capacities || []).filter(r => r.facilityId === facilityId && reviewedClaim(r, asOf) && r.period <= asOf
    && r.basis === 'issuer_reported_maximum' && Number.isFinite(r.capacity) && r.capacity >= 0)
    .sort((a, b) => b.period.localeCompare(a.period));
  if (!rows.length) return null;
  const row = rows[0];
  return <section aria-label="Reported facility capacity" style={box}>
    <b>Issuer-reported maximum capacity</b>
    <p>{row.capacity.toLocaleString('en-US')} {row.units} for {row.period.slice(0, 4)}. Calculated maximum capacity; actual shipments and customer allocations are not measured by this figure.</p>
    <a href={row.source.url} target="_blank" rel="noreferrer">Supporting report: {row.source.supportingSection}</a>
  </section>;
}
