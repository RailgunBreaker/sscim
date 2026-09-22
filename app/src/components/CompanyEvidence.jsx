import { useState } from 'react';
import { measuredCapacityShares } from '../engine/observedAnalysis.js';
import { reviewedClaim } from '../engine/evidenceContract.js';

const Source = ({ source }) => <a href={source.url} target="_blank" rel="noreferrer">Published {source.publicationDate || 'date unspecified'}</a>;
const format = value => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 6 }) : 'Unknown';
const label = s => s?.replaceAll('_', ' ');
export default function CompanyEvidence({ data, companyId }) {
  const [year, setYear] = useState('2025-12-31'), [size, setSize] = useState(12);
  const analysis = data.OBSERVED_ANALYSIS;
  const operating = data.OPERATING_EVIDENCE.records.filter(r => r.companyId === companyId || r.supplierCompanyId === companyId);
  const numeric = operating.filter(r => typeof r.value === 'number');
  const contracts = operating.filter(r => r.kind === 'reported_supply_contract');
  const links = analysis.relationships.filter(r => r.supplier === companyId || r.customer === companyId);
  const observations = analysis.observations.filter(r => r.companyId === companyId);
  const allCapacities = data.OBSERVED_DATA.capacities || [];
  const capacityRows = allCapacities.filter(r => r.companyId === companyId && r.period === year && r.units.startsWith(`${size}-inch`) && reviewedClaim(r, analysis.asOf));
  const population = data.OBSERVED_DATA.capacityPopulations?.find(r => r.units.startsWith(`${size}-inch`) && capacityRows.some(c => c.scope === r.scope));
  const capacity = measuredCapacityShares(allCapacities, { ...population, period: year, asOf: analysis.asOf });
  const name = id => data.COMPANY_BY_ID[id]?.name || id.toUpperCase();
  const revenue = companyId === 'tsmc' ? (data.REVENUE_CURRENT?.records || []).slice(-12) : [];
  return <div className="evidence-content" aria-label="Selected company evidence">
    <h2>{name(companyId)}</h2>
    {!operating.length && !links.length && !observations.length && !allCapacities.some(r => r.companyId === companyId) && !revenue.length && <p>No reviewed operating measurements collected for this company. Missing data does not imply zero exposure.</p>}
    {!!numeric.length && <section aria-label="Reported operating measurements"><h3>Reported operating measurements</h3>
      <div className="evidence-table"><table><thead><tr><th>Measurement</th><th>Period</th><th>Reported value</th><th>Basis and source</th></tr></thead><tbody>
        {numeric.map(r => <tr key={r.id}><td>{label(r.metric)}</td><td>{r.periodStart && `${r.periodStart} to `}{r.periodEnd}</td>
          <td>{r.units === 'fraction_of_soi_wafer_spend' ? `${format(r.value*100)}% of SOI wafer spend` : `${format(r.value)} ${label(r.units)}`}</td>
          <td>{r.precision}. {r.limitations}<br /><Source source={r.source} /></td></tr>)}
      </tbody></table></div>
      {data.OPERATING_VALIDATION && <p>{data.OPERATING_VALIDATION.inventory.filter(r => r.status === 'reconciled').length} inventory snapshots reconcile. Physical safety-stock days and site allocations remain unknown.</p>}
    </section>}
    {!!contracts.length && <section aria-label="Reported supply contracts"><h3>Supply contracts</h3>{contracts.map(r => <article key={r.id}>
      <p><b>{r.parties.join(' → ')}</b> · Effective {r.effectiveDate} · {r.productScope.join(', ')}</p>
      <p>Supplying affiliate: {r.supplierAffiliate}. Committed volumes, prices and plant allocations: <b>Unknown — redacted</b>.</p>
      <Source source={r.source} />
    </article>)}</section>}
    {!!links.length && <section aria-label="Company supplier disclosures"><h3>Supplier and customer disclosures</h3><div className="evidence-table"><table><thead><tr><th>Supplier → customer</th><th>Product / period</th><th>Disclosed share</th><th>Source</th></tr></thead><tbody>
      {links.map(r => <tr key={r.id}><td>{name(r.supplier)} → {name(r.customer)}</td><td>{r.productScope}<br />{r.periodEnd}</td>
        <td>{r.shareBasis}<br /><small>{r.limitations}</small></td><td><Source source={r.source} /></td></tr>)}
    </tbody></table></div><p>Documented downstream reach: {analysis.companyAssessment(companyId).documentedCustomerReach} companies. Indirect paths do not establish product continuity or lost output.</p></section>}
    {allCapacities.some(r => r.companyId === companyId) && <section aria-label="Reported fab capacity"><h3>Reported fab capacity</h3>
      <label>Year <select aria-label="Capacity year" value={year} onChange={e => setYear(e.target.value)}>{[2025,2024,2023,2022].map(y => <option key={y} value={`${y}-12-31`}>{y}</option>)}</select></label>{' '}
      <label>Wafer size <select aria-label="Wafer size" value={size} onChange={e => setSize(Number(e.target.value))}>{[12,8,6].map(s => <option key={s} value={s}>{s} inch</option>)}</select></label>
      <div className="evidence-table"><table><thead><tr><th>Fab</th><th>Wafers / year</th><th>Share of defined population</th><th>Source</th></tr></thead><tbody>{capacityRows.map(r => <tr key={r.id}><td>{r.facilityName}</td><td>{format(r.capacity)}</td><td>{capacity.shares ? `${(100*capacity.shares[r.facilityId]).toFixed(1)}%` : 'Unknown'}</td><td><Source source={r.source} /></td></tr>)}</tbody></table></div>
      <p>Denominator: {format(capacity.total)} {population?.units}. Operator-reported maximum capacity; actual output and substitution are not established.</p>
    </section>}
    {!!observations.length && <section aria-label="Reported recovery"><h3>Reported recovery</h3><div className="evidence-table"><table><thead><tr><th>Factory / measurement</th><th>Result</th><th>Date</th><th>Source</th></tr></thead><tbody>{observations.map(r => <tr key={r.id}><td>{r.scope}<br />{label(r.metric)}</td><td>{r.value ? `${r.value.lowExclusive ? '>' : ''}${format(100*r.value.low)}–${r.value.highExclusive ? '<' : ''}${format(100*r.value.high)}%` : r.observationText}<br />{r.limitations}</td><td>{r.observedAt || r.observationDateText}</td><td><Source source={r.source} /></td></tr>)}</tbody></table></div></section>}
    {!!revenue.length && <section aria-label="Reported monthly revenue"><h3>Latest monthly revenue disclosures</h3><div className="evidence-table"><table><thead><tr><th>Month</th><th>Consolidated revenue (TWD million)</th><th>Available</th></tr></thead><tbody>{revenue.map(r => <tr key={r.period}><td>{r.period}</td><td>{format(r.amount)}</td><td><a href={r.sourceUrl} target="_blank" rel="noreferrer">{r.availableBy}</a></td></tr>)}</tbody></table></div></section>}
    {analysis.manufacturingRoutes.filter(r => r.from.companyId === companyId || r.to.companyId === companyId).map(r => <section key={r.id} aria-label="Reported manufacturing routes"><h3>Manufacturing route</h3><p>{r.from.name} → {r.to.name}</p><p>{r.productScope}. {r.limitations}</p><Source source={r.source} /></section>)}
    {data.FACILITIES.filter(f => f.company === companyId && f.evidence).map(f => <section key={f.id}><h3>{f.name}</h3><p>{f.evidence.claim}</p><p>{f.evidence.limitations}</p><a href={f.evidence.url} target="_blank" rel="noreferrer">Facility source</a></section>)}
  </div>;
}
