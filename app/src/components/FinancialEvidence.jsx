import { useState } from 'react';
import { C } from '../theme.js';
const cell = { padding: '10px 8px', textAlign: 'left', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
const label = metric => metric.replaceAll('_', ' ');
const amount = value => value.toLocaleString('en-US', { maximumFractionDigits: 6 });

export default function FinancialEvidence({ evidence }) {
  const [metric, setMetric] = useState('revenue_impact');
  if (!evidence?.outcomes.length) return null;
  const metrics = [...new Set(evidence.outcomes.map(r => r.metric))];
  const selectedMetric = metrics.includes(metric) ? metric : metrics[0];
  const outcomes = evidence.outcomes.filter(r => r.metric === selectedMetric);
  const comparisons = evidence.comparisons.filter(r => r.metric === selectedMetric);
  return <section aria-label="Reported financial outcomes">
    <h2>Reported financial outcomes</h2>
    <p>{evidence.outcomes.length} outcomes across {evidence.independentOutcomeIncidents} incidents. Company-attributed revenue effects, accounting costs and insurance proceeds are distinct measurements. These records do not establish the accuracy of SSCIM forecasts.</p>
    <label>Measurement <select aria-label="Financial measurement" value={selectedMetric} onChange={e => setMetric(e.target.value)}>
      {metrics.map(m => <option key={m} value={m}>{label(m)}</option>)}
    </select></label>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{['Company / incident', 'Reporting period', 'Reported amount', 'Basis / source'].map(h => <th key={h} style={cell}>{h}</th>)}</tr></thead>
      <tbody>{outcomes.map(r => <tr key={r.id}>
        <td style={cell}>{r.companyId.toUpperCase()}<br /><small>{label(r.incidentId)}</small></td>
        <td style={cell}>{r.periodStart} to {r.periodEnd}</td>
        <td style={cell}><b>{amount(r.amount)} {r.units}</b><br /><small>Reported precision: {amount(r.roundingUnit)} {r.units}</small></td>
        <td style={cell}>{r.limitations}<br /><a href={r.source.url} target="_blank" rel="noreferrer">Published {r.source.publicationDate}: {r.source.supportingSection}</a></td>
      </tr>)}</tbody>
    </table></div>
    {!!comparisons.length && <>
      <h3>Earlier issuer forecasts versus reported outcomes</h3>
      <p>Compared only within the same company, incident, quarter, currency and accounting basis. Forecasts were published before the quarter ended. Multiple metrics from one incident are not independent validation cases.</p>
      <ul>{comparisons.map(r => <li key={r.forecastId}>{label(r.incidentId)}, quarter ending {r.periodEnd}: {' '}
        <a href={r.forecastSource} target="_blank" rel="noreferrer">forecast {amount(r.forecast)}</a> versus {' '}
        <a href={r.outcomeSource} target="_blank" rel="noreferrer">reported {amount(r.actual)}</a> {r.units}; absolute error {amount(r.absoluteError)} {r.units}.
      </li>)}</ul>
      <p>Errors use the published rounded amounts. Reporting precision does not quantify statistical or causal uncertainty.</p>
    </>}
  </section>;
}
