import { C } from '../theme.js';
import LossReconciliation from './LossReconciliation.jsx';
import SupplierLossAllocation from './SupplierLossAllocation.jsx';
import SemiconductorLossFollowup from './SemiconductorLossFollowup.jsx';
import RecoveryCalibration from './RecoveryCalibration.jsx';
import PhysicalLosses from './PhysicalLosses.jsx';
const cell = { padding: '10px 8px', textAlign: 'left', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
export default function OperationalEvidence({ data }) {
  const loss = data.CHAIN_LOSS, performance = data.PROSPECTIVE_PERFORMANCE, news = data.PROSPECTIVE_NEWS;
  return <>
    {data.LIVE_GAPS?.filled?.some(key => ['chainLossEvidence','lossReconciliations','supplierLossAllocations','semiconductorLossFollowup','recoveryCalibration','physicalLosses','lagTwoValidation','lossFilingMonitor','prospectivePerformance','prospectiveNewsPerformance','structuredCatalog','prospectiveNowcasts'].includes(key)) && <p role="status">Some operational-evidence sections are missing from the API. Those sections use the dated bundled snapshot.</p>}
    <RecoveryCalibration report={data.RECOVERY_CALIBRATION} />
    <PhysicalLosses report={data.PHYSICAL_LOSSES} />
    <SemiconductorLossFollowup report={data.SEMICONDUCTOR_LOSS_FOLLOWUP} monitor={data.LOSS_FILING_MONITOR} />
    <SupplierLossAllocation report={data.SUPPLIER_LOSS_ALLOCATION} />
    <LossReconciliation report={data.LOSS_RECONCILIATION} />
    <section aria-label="Downstream disruption losses">
      <h2>Reported downstream disruption losses</h2>
      <p>Company-attributed shortfalls from the semiconductor shortage. A reported production shortfall is distinct from an independently identified loss caused by one supplier.</p>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Company / period','Measurement','Value / status','Source'].map(h => <th key={h} style={cell}>{h}</th>)}</tr></thead>
        <tbody>{loss.records.map(r => <tr key={r.id}><td style={cell}>{r.companyId.toUpperCase()}<br />{r.periodStart} to {r.periodEnd}</td>
          <td style={cell}>{r.metric.replaceAll('_',' ')}<br /><small>{r.precision}<br />{r.causeScope?.replaceAll('_',' ')}</small></td>
          <td style={cell}>{r.units === 'fraction' ? `${(100*r.value).toFixed(0)}%` : `${r.value.toLocaleString('en-US')} ${r.units}`}<br /><b>{r.kind === 'issuer_forecast' ? 'Earlier issuer forecast' : 'Reported outcome'}</b></td>
          <td style={cell}><a href={r.source.url} target="_blank" rel="noreferrer">{r.source.publicationDate}</a></td></tr>)}</tbody>
      </table></div>
      {loss.transmission.map(r => <p key={r.id}><b>{r.supplierCompanyId.toUpperCase()} → {r.customerCompanyId.toUpperCase()}</b>: {r.claim} {r.limitations}</p>)}
      <p>Chain-wide loss: <b>unavailable</b>. {loss.reason}</p>
    </section>
    <section aria-label="Sector-wide loss estimates">
      <h2>Sector-wide automotive loss estimates</h2>
      <p>Published retrospective estimates of global light-vehicle production losses from semiconductor shortages. These include overlapping company losses and must not be added to those company figures.</p>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Period','Published estimate','Basis / source'].map(h => <th key={h} style={cell}>{h}</th>)}</tr></thead>
        <tbody>{data.CHAIN_ACCOUNTS.estimates.map(r => <tr key={r.id}>
          <td style={cell}>{r.periodStart} to {r.periodEnd}</td>
          <td style={cell}>{r.qualifier === 'greater_than' ? 'More than' : 'Approximately'} {r.value.toLocaleString('en-US')} {r.units}</td>
          <td style={cell}>{r.method}<br /><a href={r.source.url} target="_blank" rel="noreferrer">{r.estimator}, {r.source.publicationDate}</a></td>
        </tr>)}</tbody>
      </table></div>
      <p>Underlying allocations have not been independently reproduced. Other semiconductor end markets and supplier-by-supplier loss allocations remain unmeasured.</p>
    </section>
    {performance && <section aria-label="Prospective performance">
      <h2>Prospective performance</h2>
      <p>{performance.captured} forecast captured; {performance.scored} scored; {performance.pending} awaiting an outcome. A pending forecast contributes no accuracy or coverage result.</p>
      {(performance.metrics || []).map(m => <p key={m.modelId}>
        <b>{m.modelId}</b>: mean absolute error {m.mae == null ? 'awaiting outcomes' : `${(m.mae/1000).toFixed(2)} billion TWD`};
        {' '}baseline error {m.baselineMae == null ? 'awaiting outcomes' : `${(m.baselineMae/1000).toFixed(2)} billion TWD`};
        {' '}interval coverage {m.intervalCoverage == null ? 'awaiting outcomes' : `${(m.intervalCoverage*100).toFixed(1)}%`}.
        {m.missingCaptureMonths.length > 0 && ` Missing capture months: ${m.missingCaptureMonths.join(', ')}.`}
      </p>)}
      <p>Last scoring check: {performance.asOf} (UTC).</p>
      {(performance.releaseStatus || []).map(r => <p key={`${r.modelId}-${r.targetPeriod}`}>Revenue outcome {r.targetPeriod}: {r.status.replaceAll('_',' ')}.
        {r.scheduledAt && <> Scheduled publication: {r.scheduledAt} (UTC). <a href={r.sourceUrl} target="_blank" rel="noreferrer">Issuer calendar</a>.</>}</p>)}
      {data.LAG_TWO_VALIDATION && <p>The exact two-month-lag rule was also tested retrospectively over {data.LAG_TWO_VALIDATION.test.months} months: mean absolute error {(data.LAG_TWO_VALIDATION.test.mae/1000).toFixed(2)} billion TWD; intervals covered {data.LAG_TWO_VALIDATION.test.covered} outcomes. This reused historical sample is distinct from the pending prospective forecast.</p>}
      {data.PROSPECTIVE_NOWCASTS.map(p => <article key={`${p.modelId}-${p.targetPeriod}`}>
        <p><b>TSMC {p.targetPeriod}: {(p.prediction/1000).toFixed(2)} billion TWD</b>. Nominal {(100*p.nominalCoverage).toFixed(0)}% interval: {(p.lower/1000).toFixed(2)}–{(p.upper/1000).toFixed(2)} billion TWD.</p>
        <p>Recorded {p.capturedAt} (UTC). Latest input month: {p.lastInputPeriod}. Experimental model using inputs two months before the target; the earlier one-month historical test does not validate this horizon.</p>
      </article>)}
      <p>Inputs, protocol and engine code were archived with each forecast. Local hashes detect changes but do not provide independent timestamp attestation. Operational performance is not yet established.</p>
      {news && <p>News monitoring began {news.startedAt} (UTC): {news.newEligibleRecords} qualifying new reports, {news.backfilledRecords} backfilled reports, {news.invalidOrMissingTiming} with missing or invalid timing. Classification accuracy and incident recall await independent labels.</p>}
    </section>}
    {data.STRUCTURED_CATALOG && <section aria-label="Structured data coverage"><h2>Structured data coverage</h2>
      <p>{data.STRUCTURED_CATALOG.datasets.length} datasets; {data.STRUCTURED_CATALOG.records.toLocaleString('en-US')} records; {data.STRUCTURED_CATALOG.fields.toLocaleString('en-US')} typed fields. Exported {data.STRUCTURED_CATALOG.exportedAt}.</p>
      <p>The JSON and SQLite catalog retains source links, dates, units, original payloads and evidence status. Counts include multiple representations of evidence and are not independent incident counts.</p>
    </section>}
  </>;
}
