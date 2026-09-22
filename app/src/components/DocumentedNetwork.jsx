import { C } from '../theme.js';
export default function DocumentedNetwork({ analysis, companies, companyId, onSelect }) {
  const links = analysis.relationships.filter(r => r.level === 'company');
  const neighbors = links.filter(r => r.supplier === companyId || r.customer === companyId);
  const upstream = [...new Set(neighbors.filter(r => r.customer === companyId).map(r => r.supplier))];
  const downstream = [...new Set(neighbors.filter(r => r.supplier === companyId).map(r => r.customer))];
  const positions = new Map([[companyId, [350, 175]]]);
  for (const [ids, x] of [[upstream, 110], [downstream, 590]]) ids.forEach((id,i) => positions.set(id, [x, 45 + i * 260 / Math.max(1, ids.length - 1)]));
  const name = id => companies[id]?.name || id.toUpperCase();
  return <div>
    <svg role="img" aria-label={`Documented suppliers and customers of ${name(companyId)}`} viewBox="0 0 700 350" style={{ width: '100%', minHeight: 260 }}>
      <defs><marker id="documented-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill={C.copper} /></marker></defs>
      {[...new Set(neighbors.map(r => `${r.supplier}|${r.customer}`))].map(key => {
        const [from,to] = key.split('|'), a = positions.get(from), b = positions.get(to);
        return <line key={key} x1={a[0]+72} y1={a[1]} x2={b[0]-76} y2={b[1]} stroke={C.copper} strokeWidth="2" markerEnd="url(#documented-arrow)" />;
      })}
      {[...positions].map(([id,[x,y]]) => <g key={id} role="button" tabIndex="0" aria-label={`Select ${name(id)}`} onClick={() => onSelect(id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } }} style={{ cursor: 'pointer' }}>
        <rect x={x-74} y={y-22} width="148" height="44" rx="8" fill={id === companyId ? C.panel2 : C.bg} stroke={id === companyId ? C.copper : C.line} />
        <text x={x} y={y+4} fill={C.text} fontSize="12" textAnchor="middle">{name(id).length > 22 ? name(id).slice(0,20)+'…' : name(id)}</text>
      </g>)}
    </svg>
    <p style={{ padding: '0 16px', fontSize: 12, color: C.dim }}>{neighbors.length ? `${neighbors.length} product- and period-specific disclosures. Arrows show supplier → customer; equal line widths carry no volume estimate.` : 'No reviewed supplier/customer disclosure for this company in the collected dataset.'}</p>
    <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>{[...new Set(links.flatMap(r => [r.supplier,r.customer]))].map(id => <button key={id} onClick={() => onSelect(id)} aria-pressed={id === companyId}>{name(id)}</button>)}</div>
  </div>;
}
