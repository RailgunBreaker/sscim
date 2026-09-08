import { useState } from 'react';
import { useVault } from '../data/VaultContext.jsx';
import { C } from '../theme.js';
import { measuredCapacityShares } from '../engine/observedAnalysis.js';
import { reviewedClaim } from '../engine/evidenceContract.js';
import FinancialEvidence from './FinancialEvidence.jsx';
import PredictionValidation from './PredictionValidation.jsx';
import OperationalEvidence from './OperationalEvidence.jsx';

function fraction(value) {
  if (value.low === value.high) return `${Math.round(value.low * 100)}%`;
  if (value.lowExclusive && value.high === 1) return `>${Math.round(value.low * 100)}%`;
  if (value.highExclusive && value.low === 0) return `<${Math.round(value.high * 100)}%`;
  return `${Math.round(value.low * 100)}–${Math.round(value.high * 100)}%`;
}
const cell = { padding: '12px 10px', textAlign: 'left', verticalAlign: 'top', borderBottom: `1px solid ${C.line}` };

export default function ObservedWorkspace({ onResearch }) {
  const { data } = useVault();
  const analysis = data.OBSERVED_ANALYSIS;
  const [relationshipId, setRelationshipId] = useState('');
  const [shock, setShock] = useState(100);
  const [period, setPeriod] = useState('2025-12-31');
  const [waferSize, setWaferSize] = useState(12);
  const links = analysis.relationships.filter(r => r.level === 'company');
  const selected = links.find(r => r.id === relationshipId) || links[0];
  const name = id => data.COMPANY_BY_ID[id]?.name || id.toUpperCase();
  const assessment = selected ? analysis.companyAssessment(selected.supplier) : null;
  const result = selected ? analysis.inputExposure(selected.customer, { productScope: selected.productScope,
    periodEnd: selected.periodEnd, supplierDisruptions: { [selected.supplier]: shock / 100 } }) : null;
  const population = data.OBSERVED_DATA.capacityPopulations?.find(r => r.units.startsWith(`${waferSize}-inch`));
  const capacities = data.OBSERVED_DATA.capacities || [];
  const capacityResult = measuredCapacityShares(capacities, { ...population, period, asOf: analysis.asOf });
  const capacityRows = capacities.filter(r => r.scope === population?.scope && r.units === population?.units && r.period === period
    && reviewedClaim(r, analysis.asOf) && r.period <= analysis.asOf
    && r.basis === 'issuer_reported_maximum' && Number.isFinite(r.capacity) && r.capacity >= 0);

  return <main style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '28px clamp(16px, 4vw, 64px)', fontFamily: 'Inter, Segoe UI, sans-serif', lineHeight: 1.55 }}>
    <div style={{ maxWidth: 1200, margin: 'auto' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <div><h1 style={{ marginBottom: 4 }}>SSCIM · Documented supply-chain evidence</h1>
          <p style={{ color: C.dim }}>Historical observations and disclosed supplier relationships. Evidence available through {analysis.asOf}.</p></div>
        <button data-testid="open-research" onClick={onResearch} style={{ padding: '12px 18px', cursor: 'pointer' }}>Explore assumption model</button>
      </header>
      {data.REFRESH_FAILED && <p role="status">The latest refresh failed. Showing the last successfully loaded dataset.</p>}
      {data.LIVE_GAPS?.filled?.includes('observedData') && <p role="status">The API has no observed-data section. These observations come from the bundled reference dataset.</p>}
      <h2>Reported recovery</h2>
      <p>Each result applies to the scope and date in its source. Tool availability, production capacity and shipments are different measurements.</p>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Scope / metric', 'Observed result', 'Observation date', 'Published / source'].map(h => <th key={h} style={cell}>{h}</th>)}</tr></thead>
        <tbody>{analysis.observations.map(row => <tr key={row.id}>
          <td style={cell}>{row.scope}<br /><small>{row.metric.replaceAll('_', ' ')}<br />Basis: {row.denominator}</small></td>
          <td style={cell}><b>{row.value ? fraction(row.value) : row.observationText}</b><br /><small>{row.limitations}</small></td>
          <td style={cell}>{row.observedAt || row.observationDateText}</td>
          <td style={cell}><a href={row.source.url} target="_blank" rel="noreferrer" style={{ color: C.copper }}>{row.source.publicationDate}</a><br /><small>{row.source.supportingSection}</small></td>
        </tr>)}</tbody>
      </table></div>
      {!analysis.observations.length && <p>No source-verified observations are available in this bundle.</p>}
      <FinancialEvidence evidence={data.FINANCIAL_EVIDENCE} />
      <PredictionValidation report={data.REVENUE_VALIDATION} snapshotFallback={data.LIVE_GAPS?.filled?.includes('revenueValidation')} />
      <OperationalEvidence data={data} />
      <h2>Reported fab capacity</h2>
      <p>UMC reports calculated maximum output by fab. The figures below preserve wafer size and reporting period. They are capacity estimates published by the operator, not actual wafer shipments.</p>
      <label>Year <select aria-label="Capacity year" value={period} onChange={e => setPeriod(e.target.value)}>{[2025, 2024, 2023, 2022].map(y => <option key={y} value={`${y}-12-31`}>{y}</option>)}</select></label>{' '}
      <label>Wafer size <select aria-label="Wafer size" value={waferSize} onChange={e => setWaferSize(Number(e.target.value))}>{[12, 8, 6].map(size => <option key={size} value={size}>{size} inch</option>)}</select></label>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Fab', 'Reported wafers / year', 'Share of this UMC population', 'Source'].map(h => <th key={h} style={cell}>{h}</th>)}</tr></thead>
        <tbody>{capacityRows.map(row => <tr key={row.id}><td style={cell}>{row.facilityName}</td><td style={cell}>{row.capacity.toLocaleString('en-US')}</td>
          <td style={cell}>{capacityResult.shares ? `${(100 * capacityResult.shares[row.facilityId]).toFixed(1)}%` : 'unavailable'}</td>
          <td style={cell}><a href={row.source.url} target="_blank" rel="noreferrer" style={{ color: C.copper }}>UMC report, p. 9</a></td></tr>)}</tbody>
      </table></div>
      <p>Denominator: {capacityResult.total?.toLocaleString('en-US') || 'unavailable'} {population?.units || ''} across {capacityRows.length} listed fabs. These shares do not measure global output or the substitutability of different products.</p>
      {!!analysis.manufacturingRoutes.length && <section aria-label="Reported manufacturing routes">
        <h2>Reported manufacturing routes</h2>
        {analysis.manufacturingRoutes.map(route => <article key={route.id} style={{ background: C.panel, padding: 16, margin: '12px 0', border: `1px solid ${C.line}` }}>
          <b>{route.from.name} → {route.to.name}</b>
          <p>{route.productScope}. Reported {route.reportedAt}.</p>
          <p>{route.limitations}</p>
          <a href={route.source.url} target="_blank" rel="noreferrer">Read the factory-visit report</a>
        </article>)}
      </section>}
      <h2>Documented company dependencies</h2>
      <p>{links.length} product-scoped disclosures. {analysis.facilityLinks.length} verified plant-to-plant links. Company disclosures identify suppliers; plant shipments require separate evidence.</p>
      {selected && <section style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: 20 }}>
        <label htmlFor="documented-dependency">Relationship and product scope</label><br />
        <select id="documented-dependency" value={selected.id} onChange={e => setRelationshipId(e.target.value)} style={{ maxWidth: '100%', padding: 10, margin: '8px 0' }}>
          {links.map(r => <option key={r.id} value={r.id}>{name(r.supplier)} → {name(r.customer)} · {r.productScope}</option>)}
        </select>
        <p>Disclosed for the period ending {selected.periodEnd}. <a href={selected.source.url} target="_blank" rel="noreferrer" style={{ color: C.copper }}>Read the supporting disclosure</a>.</p>
        <p>Documented customer reach from {name(selected.supplier)}: {assessment.documentedCustomerReach}. This counts reachable companies in the available disclosures; the graph is incomplete.</p>
        <ul>{assessment.downstream.map(company => <li key={company.id}>{name(company.id)}: {company.path.length} disclosed relationship{company.path.length === 1 ? '' : 's'} in path{company.inference ? '; indirect inference, product continuity unverified' : ''}.</li>)}</ul>
        <p>{selected.shareBasis}. {selected.limitations}</p>
        <label htmlFor="supplier-shock">Hypothetical reduction in {name(selected.supplier)} supply: {shock}%</label><br />
        <input id="supplier-shock" type="range" min="0" max="100" value={shock} onChange={e => setShock(Number(e.target.value))} style={{ width: 'min(100%, 440px)' }} />
        <p aria-live="polite"><b>Conditional input exposure: {result.value ? fraction(result.value) : 'unavailable'}</b><br />
          {result.reason} The calculation uses the selected relationship’s disclosed input share; it does not use supplier revenue shares.</p>
      </section>}
      <p>Current chain-wide production loss: <b>unavailable</b>. This sample has no complete measured plant-capacity denominator or validated chain-wide loss model.</p>
      <p style={{ color: C.dim }}>Source review: Codex research assistance, not independent human adjudication. The assumption model remains available for exploratory scenarios.</p>
    </div>
  </main>;
}
