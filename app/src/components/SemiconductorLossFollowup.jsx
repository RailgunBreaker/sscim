const amount = value => value==null?'Not disclosed':value.toLocaleString('en-US',{maximumFractionDigits:3});
export default function SemiconductorLossFollowup({report,monitor}) {
  return <section aria-label="Semiconductor loss follow-up">
    <h2>Semiconductor recoveries and customer-loss evidence</h2>
    {report.accounts.map(a=><article key={a.id}>
      <h3>{a.companyId.toUpperCase()}: {a.incidentId.replaceAll('_',' ')}</h3>
      <p>Reported charge: {amount(a.value)} {a.units}. <a href={a.source.url} target="_blank" rel="noreferrer">Disclosure: {a.source.publicationDate}</a></p>
      {a.recognizedRecovery!=null && <p>Selected recognized recovery: {amount(a.recognizedRecovery)} {a.units}; charge less that recovery: <b>{amount(a.netOfSelectedRecoveries)} {a.units}</b>.</p>}
      {a.insurerCashReceived!=null && <p>Insurer cash received: {amount(a.insurerCashReceived)} {a.units}, included within the recognized total. The total and this component must not be added together.</p>}
      <p>Material-supplier reimbursement: {a.materialSupplierRecoveries.length===0?'not identified in the reviewed disclosures':'see named records'}. Final outstanding claim and final cash loss remain unknown.</p>
      {a.recoveries.map(r=><p key={r.id}><a href={r.source.url} target="_blank" rel="noreferrer">{r.label}: {r.source.publicationDate}</a></p>)}
      {a.reason&&<p role="status">{a.reason}</p>}
    </article>)}
    <h3>Customer outcomes requiring causal separation</h3>
    {report.downstream.map(r=><p key={r.id}><b>{r.companyId.toUpperCase()}: {amount(r.value)} {r.units}</b> {r.metric.replaceAll('_',' ')}. {r.exclusionReason} <a href={r.source.url} target="_blank" rel="noreferrer">Source</a></p>)}
    <details><summary>Evidence needed to resolve the remaining amounts</summary>{report.questions.map(q=><p key={q.id}>{q.needed}. {q.nextAction}</p>)}</details>
    {monitor&&<p>Filing monitor: {monitor.checks.length} checks; {monitor.candidates.filter(c=>c.reviewState==='reviewed').length} candidates linked to reviewed claims; {monitor.candidates.filter(c=>!['reviewed','irrelevant'].includes(c.reviewState)).length} awaiting review or more data; {monitor.unavailable} unavailable sources. Last check: {monitor.checkedAt}. Keyword matches do not enter loss calculations automatically.</p>}
  </section>;
}
