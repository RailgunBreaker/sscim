import { useState } from 'react';
import { C } from '../theme.js';
const cell={padding:'8px',textAlign:'left',borderBottom:`1px solid ${C.line}`};
const value=n=>n.toLocaleString('en-US',{maximumFractionDigits:3});
export default function LossReconciliation({report}) {
  const [company,setCompany]=useState('sony');
  const records=report.records.filter(r=>r.companyId===company);
  const bridges=report.bridges.filter(b=>records.some(r=>r.id===b.parentId));
  return <section aria-label="Reconciled incident accounts">
    <h2>Reconciled incident accounts</h2>
    <p>Source-reported costs and issuer estimates across semiconductor manufacturing, imaging and telecom equipment. Positive figures are adverse impacts; negative figures are recoveries. A revenue delay is not a measured permanent loss.</p>
    <label>Company <select aria-label="Incident accounting company" value={company} onChange={e=>setCompany(e.target.value)}>
      {[...new Set(report.records.map(r=>r.companyId))].map(id=><option key={id} value={id}>{id.toUpperCase()}</option>)}
    </select></label>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead><tr>{['Component / period','Reported amount','Evidence'].map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead>
      <tbody>{records.map(r=><tr key={r.id}>
        <td style={cell}>{r.label}<br /><small>{r.periodStart} to {r.periodEnd}</small></td>
        <td style={cell}>{value(r.value)} {r.units}</td>
        <td style={cell}>{r.kind==='issuer_retrospective_estimate'?'Retrospective issuer estimate':'Reported accounting amount'}<br />
          <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.publicationDate}</a>
          {r.majorityExpectedDeferred && <p>Most sales expected to shift to future periods; recovery has not been observed here.</p>}
          {r.limitations && <p>{r.limitations}</p>}
        </td>
      </tr>)}</tbody>
    </table></div>
    {bridges.map(b=><p key={b.id}>
      <b>{b.dimension.replaceAll('_',' ')}: {b.status.replaceAll('_',' ')}</b>
      {b.parentValue!=null && ` — reported ${value(b.parentValue)}; components ${value(b.childSum)}; residual ${value(b.residual)} ${b.units}.`}
      {b.status==='consistent_with_source_rounding' && ' The residual is retained within the source rounding tolerance.'}
    </p>)}
    {company==='sony' && <p>Sony’s FY2016 estimate excludes insurance recoveries. Semiconductor, imaging and corporate components reconcile to its disclosed consolidated boundary; annual totals and their quarterly or category breakdowns are alternative views, not additive losses.</p>}
    {company==='wdc' && <p>The 2019 power-outage records imply 68 − 75 − 7 = −14 million USD of net recognized cost through FY2022: a net credit. This is company accounting after transfers, not a negative social loss. The 2022 contamination is a separate incident. Western Digital’s filing describes a wafer-purchase forecast generally equal to 50% of Flash Ventures output; that share does not establish a total incident loss by doubling Western Digital’s charges.</p>}
    <p>Arithmetic reconciliation is established for the listed matching partitions. Independent causal validation and complete global loss coverage remain unestablished.</p>
  </section>;
}
