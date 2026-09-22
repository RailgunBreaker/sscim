export default function ValidationStatus({ data }) {
  const source = data.SOURCE_AVAILABILITY, operating = data.OPERATING_VALIDATION;
  const extension = data.LAG_TWO_VALIDATION?.laterPeriodDiagnostic;
  return <section aria-label="Data validation status">
    <h2>Data validation</h2>
    <div className="evidence-summary">
      <article><strong>{operating?.inventory.filter(r => r.status === 'reconciled').length ?? 'Unknown'}</strong><span>Inventory snapshots reconciled</span></article>
      <article><strong>{data.PROSPECTIVE_PERFORMANCE?.scored ?? 0}</strong><span>Prospective revenue outcomes scored</span></article>
      <article><strong>Unresolved</strong><span>Chain-wide loss validation</span></article>
    </div>
    {operating && <p>{operating.records} operating records checked on {operating.asOf}. Accounting reconciliation verifies arithmetic; it does not establish predictive accuracy.</p>}
    {source && <><p>Source retrieval checked {source.checkedAt}: {source.results.filter(r => r.status === 'retrieved').length}/{source.results.length} documents available; {source.results.filter(r => r.matchesReviewedArtifact === false).length} differ from reviewed copies.</p>
      {source.results.filter(r => r.status !== 'retrieved' || r.matchesReviewedArtifact === false).map(r => <p key={r.url}><a href={r.url} target="_blank" rel="noreferrer">Source requiring attention</a>: {r.status !== 'retrieved' ? `retrieval unavailable${r.httpStatus ? ` (HTTP ${r.httpStatus})` : ''}` : 'document changed; re-review needed'}. Earlier evidence remains dated to its original review.</p>)}</>}
    <p>{data.EXCLUDED.events} unsupported event records and {data.EXCLUDED.relationships} assumed company links are excluded from this dashboard. Source review establishes the specific cited claim, not every field in an issuer's disclosure.</p>
    {extension && <section aria-label="Latest revenue validation"><h3>Additional retrospective revenue validation</h3>
      <p>{extension.test.start} to {extension.test.end}: {extension.test.months} additional months evaluated with the existing two-month-lag rule and fixed 2022–2023 interval calibration.</p>
      <div className="evidence-table"><table><thead><tr><th>Method</th><th>Mean absolute error (TWD billion)</th></tr></thead><tbody>
        <tr><td>Existing seasonal-growth rule</td><td>{(extension.test.mae/1000).toFixed(2)}</td></tr>
        {extension.comparisons.map(r => <tr key={r.model}><td>{r.model.replaceAll('_',' ')}</td><td>{(r.mae/1000).toFixed(2)}</td></tr>)}
      </tbody></table></div>
      <p>Nominal 80% intervals covered {extension.test.covered} of {extension.test.months} outcomes. {extension.beatsEveryBaseline ? 'Lower average error than all listed baselines in this period.' : 'The model did not outperform every listed baseline in this period.'}</p>
      <details><summary>Inspect monthly predictions and outcomes</summary><div className="evidence-table"><table><thead><tr><th>Month</th><th>Reconstructed prediction</th><th>Reported revenue</th><th>Interval result</th></tr></thead><tbody>{extension.predictions.map(r => <tr key={r.period}><td>{r.period}</td><td>{(r.prediction/1000).toFixed(2)} billion TWD</td><td><a href={r.sourceUrl} target="_blank" rel="noreferrer">{(r.actual/1000).toFixed(2)} billion TWD</a></td><td>{r.actual >= r.lower && r.actual <= r.upper ? 'Within interval' : 'Outside interval'}</td></tr>)}</tbody></table></div></details>
      <p>{extension.assessment} This revenue test does not measure disruption-caused losses.</p>
    </section>}
  </section>;
}
