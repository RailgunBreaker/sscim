import { useState } from 'react';
import { C } from '../theme.js';
const cell = {padding:8,textAlign:'left',borderBottom:`1px solid ${C.line}`};
const amount = value => value == null ? 'Unknown' : value.toLocaleString('en-US',{maximumFractionDigits:3});
export default function SupplierLossAllocation({report}) {
  const [sector,setSector] = useState('all');
  const name = id => report.entities.find(e => e.id === id)?.name || id;
  const accounts = report.accounts.filter(a => sector === 'all' || a.sector === sector);
  return <section aria-label="Supplier loss allocation">
    <h2>Supplier loss allocation and additional sectors</h2>
    <p>Named cost-sharing agreements partition a disclosed cost base. Historical estimates and charges retain their original currency and scope. Payments and losses beyond that scope need separate evidence.</p>
    <label>Sector <select aria-label="Supplier allocation sector" value={sector} onChange={e=>setSector(e.target.value)}>
      <option value="all">All covered sectors</option><option value="semiconductors">Semiconductors</option><option value="batteries_and_vehicles">Batteries and vehicles</option>
    </select></label>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead><tr>{['Disclosed base','Supplier allocation','Remainder / status'].map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead>
      <tbody>{accounts.map(a=><tr key={a.id}>
        <td style={cell}><b>{a.boundaryLabel}</b><br />{a.qualifier && 'Approximately '}{amount(a.value)} {a.units}<br />
          {a.kind === 'reported_outcome' ? 'Reported charge' : 'Issuer estimate'} · <a href={a.source.url} target="_blank" rel="noreferrer">Source: {a.source.publicationDate}</a>
          <p>{a.valueTiming || `${a.periodStart} to ${a.periodEnd}`}</p>
        </td>
        <td style={cell}>{a.allocations.length ? a.allocations.map(r=><p key={r.ruleId}>
          {name(r.supplierCompanyId)}: {r.qualifier && 'approximately '}{amount(r.amount)} {r.units}<br />
          {r.derived ? 'Calculated from disclosed cost share' : 'Estimated recovery'}<br />{r.settlementStatus.replaceAll('_',' ')}
        </p>) : 'No eligible supplier allocation disclosed'}</td>
        <td style={cell}>{amount(a.remainder)} {a.remainder != null && a.units}<br />
          {a.remainder != null ? 'Base less named supplier allocation; not final cash loss.' : 'Company charge does not establish supplier responsibility.'}
          {a.reason && <p role="status">{a.reason}</p>}
        </td>
      </tr>)}</tbody>
    </table></div>
    <p>GM and LG’s Bolt estimates overlap and use different currencies and perspectives. Kioxia and Western Digital report different accounting bases and fiscal periods. These rows cannot be added into a chain-wide total.</p>
    <details><summary>Losses still outside the measured boundaries</summary>
      {report.scopeGaps.filter(g=>sector==='all'||g.sectors.includes(sector)).map(g=><p key={g.incidentId}><b>{g.incidentId.replaceAll('_',' ')}:</b> {g.unmeasured.join('; ')}. {g.reason}</p>)}
    </details>
  </section>;
}
