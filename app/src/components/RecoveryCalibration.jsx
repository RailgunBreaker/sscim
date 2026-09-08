import { C } from '../theme.js';
const cell = { padding: '10px 8px', textAlign: 'left', borderBottom: `1px solid ${C.line}` };
const number = value => Number.isFinite(value) ? value.toFixed(1) : 'unavailable';
export default function RecoveryCalibration({ report }) {
  if (!report?.fit || !report?.chronologicalTest?.metrics) return null;
  const test = report.chronologicalTest;
  return <section aria-label="Recovery duration calibration">
    <h2>Recovery duration calibration</h2>
    <p>The fitted median is <b>{number(report.fit.medianDays)} days</b> from partial restart to full wafer-input capacity, using {report.fit.records} factory recoveries across {report.fit.incidents} Renesas incidents. This is an experimental estimate for this sample.</p>
    <p>The earlier-incidents fit predicted {number(test.fit.medianDays)} days. The later temporal test has {test.testIncidentIds.length} incident(s); it was reconstructed after the outcomes were known.</p>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={cell}>Predictor</th><th style={cell}>Mean absolute error (days)</th></tr></thead>
      <tbody>{[['Fitted recovery duration','candidate'],['Current recovery assumption','registry'],['Earlier empirical median','empiricalMedian'],['Latest earlier incident','lastIncident']].map(([label,key]) => <tr key={key}><td style={cell}>{label}</td><td style={cell}>{number(test.metrics[key]?.maeDays)}</td></tr>)}</tbody>
    </table>
    <p>On {test.issuerComparison.records} comparable record(s), the issuer target error was {number(test.issuerComparison.issuerTargetMaeDays)} days, versus {number(test.issuerComparison.candidateMaeDays)} for the fitted model.</p>
    <p>Across all {report.rollingTests.length} expanding-history tests, the fitted model's mean error was {number(report.rollingMetrics?.candidate.maeDays)} days, versus {number(report.rollingMetrics?.empiricalMedian.maeDays)} for the earlier empirical median. The fitted model has not established an advantage over simple baselines across these tests.</p>
    {test.predictions.map(p => <p key={p.id}>Observed recovery: {p.actualDays} days. <a href={p.sourceUrl} target="_blank" rel="noreferrer">Issuer completion disclosure</a>.</p>)}
    <p>The bootstrap interval for the fitted median is {number(report.parameterUncertainty.lowerDays)} to {number(report.parameterUncertainty.upperDays)} days. It describes parameter uncertainty within this small sample; it is not a recovery prediction interval.</p>
    <p>Global model defaults remain assumptions. These endpoints do not validate the recovery trajectory, lost output, supplier transmission or chain-wide financial losses. Evaluation date: {report.asOf}.</p>
  </section>;
}
