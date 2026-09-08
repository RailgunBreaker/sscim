import {C} from '../theme.js';
const cell={padding:'10px 8px',textAlign:'left',borderBottom:`1px solid ${C.line}`};
export default function PhysicalLosses({report}) {
  if(!report?.records?.length) return null;
  return <section aria-label="Physical production losses"><h2>Physical production losses after capacity restoration</h2>
    <p>Reported lost work-in-process and missed production remain a separate balance after wafer-input capacity recovers. The {report.records.length} observations below use each line or factory's own normal production as the denominator.</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Scope','Reported gross shortfall','Wafer-input recovery','Source'].map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead>
      <tbody>{report.records.map(r=><tr key={r.id}><td style={cell}>{r.scope}</td><td style={cell}>Approximately {r.value} local production days</td><td style={cell}>Restored {r.completionDate}; subsequent catch-up unquantified</td><td style={cell}><a href={r.source.url} target="_blank" rel="noreferrer">{r.source.publicationDate}</a></td></tr>)}</tbody></table></div>
    <p>These local days cannot be summed across lines. Net permanent loss, downstream customer loss and supplier allocation remain unquantified. A reported recovery date supersedes an assumed date only for the stated capacity measure.</p>
  </section>;
}
