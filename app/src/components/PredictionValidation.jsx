import { C } from '../theme.js';
const cell = { padding: '10px 8px', textAlign: 'left', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
const billions = value => (value / 1000).toFixed(2);
const percent = value => `${(value * 100).toFixed(1)}%`;
const names = { last_month: 'Previous month', same_month_last_year: 'Same month last year', trailing_12_month_mean: 'Trailing 12-month average' };
export default function PredictionValidation({ report, snapshotFallback }) {
  if (!report?.test || !report.predictions?.length) return null;
  return <section aria-label="Historical prediction validation">
    <h2>Historical prediction validation</h2>
    <p><b>TSMC monthly consolidated revenue nowcast.</b> The prediction estimates the current month after the preceding month's disclosure. Revenue includes price, currency and product-mix effects; this test does not estimate disruption-caused production loss.</p>
    {snapshotFallback && <p role="status">This evaluation comes from the bundled reference report because the API omitted it.</p>}
    <p>Test period: {report.test.start} to {report.test.end}, {report.test.months} months. {report.status === 'historical_benchmark_pass' ? 'Passed the recorded historical benchmark criteria.' : 'Did not pass all recorded historical benchmark criteria.'} Evaluated {report.evaluatedAt?.slice(0, 10)}.</p>
    <p>{report.historicalVintagesVerified ? 'Values were checked against dated original SEC disclosures; each reconstructed nowcast uses information available before the outcome disclosure.' : 'Historical source vintages have not been verified.'} These are reconstructed predictions; prospective performance is untested.</p>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{['Method', 'Mean absolute error (TWD billion)', 'Absolute error / total revenue'].map(h => <th style={cell} key={h}>{h}</th>)}</tr></thead>
      <tbody><tr><td style={cell}>Selected seasonal-growth model</td><td style={cell}>{billions(report.test.mae)}</td><td style={cell}>{percent(report.test.wape)}</td></tr>
        {report.comparisons.map(r => <tr key={r.model}><td style={cell}>{names[r.model]}</td><td style={cell}>{billions(r.mae)}</td><td style={cell}>{percent(r.wape)}</td></tr>)}
      </tbody>
    </table></div>
    <p>The nominal {percent(report.calibration.nominalCoverage)} intervals covered {Math.round(report.test.coverage * report.test.months)} of {report.test.months} outcomes. Their average width was {percent(report.test.meanRelativeWidth)} of actual revenue. Coverage can change over time.</p>
    <details><summary>Inspect all {report.test.months} predictions and original outcome disclosures</summary>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Target month', 'Reconstructed issuance', 'Prediction / interval (TWD billion)', 'Reported outcome (TWD billion)'].map(h => <th style={cell} key={h}>{h}</th>)}</tr></thead>
        <tbody>{report.predictions.map(r => <tr key={r.period}>
          <td style={cell}>{r.period}</td><td style={cell}>{r.issuedOn || 'unverified'}</td>
          <td style={cell}>{billions(r.prediction)} / {billions(r.lower)}–{billions(r.upper)}</td>
          <td style={cell}><a href={r.sourceUrl} target="_blank" rel="noreferrer">{billions(r.actual)}</a>{r.actual < r.lower || r.actual > r.upper ? ' · outside interval' : ''}<br /><small>Filed {r.outcomeAvailableBy || 'date unverified'}</small></td>
        </tr>)}</tbody>
      </table></div>
    </details>
    <p>Model selection used 2019–2021; interval calibration used 2022–2023. Test results did not select the model or interval width. One company's revenue history does not validate the seven global supply-chain parameters.</p>
  </section>;
}
