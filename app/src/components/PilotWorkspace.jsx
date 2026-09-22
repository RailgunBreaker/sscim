import { useEffect, useRef, useState } from 'react';
import PilotIntake from './PilotIntake.jsx';
import PilotAudit from './PilotAudit.jsx';
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
const values = form => Object.fromEntries(new FormData(form));
const today = () => new Date().toISOString().slice(0, 10);
function DeliveryCard({ record, outcome, save, busy }) {
  const d = record.payload;
  return <article className="pilot-card">
    <b>{d.orderReference}: {d.productScope}</b>
    <p>{outcome.status.replaceAll('_', ' ')}. Received {outcome.receivedQuantity} of {d.orderedQuantity} {d.units}; outstanding {outcome.outstandingQuantity}.
      {outcome.lateDays != null && <> Completed {outcome.completedOn}; {outcome.lateDays} days late.</>}</p>
    <details><summary>Add receipt or correct delivery record</summary>
      <form className="pilot-form" key={record.version} onSubmit={async e => {
        e.preventDefault(); const v = values(e.currentTarget);
        const receipts = d.receipts.map((r, i) => ({ receivedOn: v[`date${i}`], quantity: Number(v[`qty${i}`]), reference: v[`ref${i}`] }));
        if (v.receivedOn || v.quantity || v.reference) receipts.push({ receivedOn: v.receivedOn, quantity: Number(v.quantity), reference: v.reference });
        await save('delivery', { ...d, promisedOn: v.promisedOn, orderedQuantity: Number(v.orderedQuantity), receipts }, record, v.reason);
      }}>
        <label>Promised date<input name="promisedOn" type="date" required defaultValue={d.promisedOn} /></label>
        <label>Ordered quantity<input name="orderedQuantity" type="number" min="0.000001" step="any" required defaultValue={d.orderedQuantity} /></label>
        {d.receipts.map((r, i) => <fieldset key={i}><legend>Receipt {i + 1}</legend>
          <label>Received date<input name={`date${i}`} type="date" max={today()} required defaultValue={r.receivedOn} /></label>
          <label>Received quantity<input name={`qty${i}`} type="number" min="0.000001" step="any" required defaultValue={r.quantity} /></label>
          <label>Receipt reference<input name={`ref${i}`} required defaultValue={r.reference} /></label>
        </fieldset>)}
        <fieldset><legend>New receipt (optional)</legend>
          <label>Received date<input name="receivedOn" type="date" max={today()} /></label>
          <label>Received quantity<input name="quantity" type="number" min="0.000001" step="any" /></label>
          <label>Receipt reference<input name="reference" /></label>
        </fieldset>
        <label>Reason for this update<input name="reason" required placeholder="Receipt recorded or correction explained" /></label>
        <button disabled={busy}>Save delivery update</button>
      </form>
    </details>
  </article>;
}

export default function PilotWorkspace({ data, companyId: selectedCompanyId, onCompanyChange }) {
  const [companyId, setCompanyId] = useState(selectedCompanyId);
  useEffect(() => { setCompanyId(selectedCompanyId); setChosenSource(null); }, [selectedCompanyId]);
  const [token, setToken] = useState(''), [workspace, setWorkspace] = useState(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [selectedId, setSelectedId] = useState('');
  const connection = useRef(0);
  const pendingCreates = useRef(new Map());
  const issuers = workspace?.proposedProtocol?.companies || [];
  const records = workspace?.records || [], name = id => data.COMPANY_BY_ID[id]?.name || issuers.find(c => c.id === id)?.name || id;
  function selectCompany(id) { setCompanyId(id); setChosenSource(null); if (data.COMPANY_BY_ID[id]) onCompanyChange(id); }
  const investigations = records.filter(r => r.type === 'investigation' && r.payload.companyId === companyId);
  const current = investigations.find(r => r.id === selectedId) || investigations[0];
  const sources = [...data.OBSERVED_ANALYSIS.relationships.filter(r => r.supplier === companyId || r.customer === companyId),
    ...data.OPERATING_EVIDENCE.records.filter(r => r.companyId === companyId || r.supplierCompanyId === companyId)].map(r => r.source);
  const sourceChoices = [...new Map(sources.map(s => [s.url, s])).values()];
  const [chosenSource, setChosenSource] = useState(null);
  async function request(path = '', method = 'GET', body, credential = token) {
    const r = await fetch(`${API}/api/admin/pilot${path}`, { method, headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
      cache: 'no-store', signal: AbortSignal.timeout(15000), ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || 'Workspace request failed.');
    return result;
  }
  async function run(action) {
    const generation = connection.current; setBusy(true); setError('');
    try { const result = await action(); if (generation === connection.current) { setWorkspace(result); return true; } }
    catch (e) { if (generation === connection.current) setError(e.message); }
    finally { if (generation === connection.current) setBusy(false); }
    return false;
  }
  async function save(type, payload, previous, reason) {
    const key = JSON.stringify([type, payload]);
    if (!previous && !pendingCreates.current.has(key)) pendingCreates.current.set(key, crypto.randomUUID());
    const succeeded = await run(async () => {
      await request(previous ? `/records/${previous.id}` : '/records', previous ? 'PUT' : 'POST',
        previous ? { payload, version: previous.version, reason } : { type, payload, requestId: pendingCreates.current.get(key) });
      return request();
    });
    if (succeeded) pendingCreates.current.delete(key);
    return succeeded;
  }
  async function review(payload) {
    const key = JSON.stringify(['review', payload]);
    if (!pendingCreates.current.has(key)) pendingCreates.current.set(key, crypto.randomUUID());
    if (await run(() => request('/reviews', 'POST', { ...payload, requestId: pendingCreates.current.get(key) }))) pendingCreates.current.delete(key);
  }
  async function labelAudit(payload) {
    const key = JSON.stringify(['audit-label', payload]);
    if (!pendingCreates.current.has(key)) pendingCreates.current.set(key, crypto.randomUUID());
    if (await run(() => request('/audit-labels', 'POST', { ...payload, requestId: pendingCreates.current.get(key) }))) pendingCreates.current.delete(key);
  }
  function disconnect() { connection.current++; pendingCreates.current.clear(); setWorkspace(null); setToken(''); setBusy(false); setError(''); setSelectedId(''); }
  function exportRecords() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `sscim-private-pilot-${today()}.json`; a.click(); URL.revokeObjectURL(url);
  }
  async function downloadHandoff(batchId) {
    const handoff = await request(`/audits/${batchId}/handoff`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(handoff, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `sscim-review-package-${batchId.slice(0, 12)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="evidence-content" aria-label="Supplier investigations">
    <h2>Supplier investigations</h2>
    <p>Track a defined supplier portfolio, investigate source reports, and record actions and delivery outcomes.</p>
    {error && <p role="alert">{error} Your entered record remains in the form. Reload the workspace before retrying a conflicting edit.</p>}
    {!workspace ? <>
      <p>Connect to your private local workspace to save records. Public company evidence remains available in the other tabs.</p>
      <form className="pilot-form" onSubmit={e => { e.preventDefault(); run(() => request()); }}>
        <label>Workspace access token<input type="password" autoComplete="off" required value={token} onChange={e => setToken(e.target.value)} /></label>
        <button disabled={busy}>{busy ? 'Connecting...' : 'Connect workspace'}</button>
      </form>
      <p><small>Use the local API administrator token. The token is kept in memory while this view is open. Pilot records stay in a separate local database and are excluded from public snapshots and evidence exports. This workspace supports one operator.</small></p>
    </> : <>
      <div className="pilot-controls"><button onClick={() => run(() => request())} disabled={busy}>Reload workspace</button><button onClick={exportRecords} disabled={busy}>Export private records</button><button onClick={disconnect}>Disconnect</button></div>
      <PilotIntake workspace={workspace} busy={busy} name={name} activate={() => run(() => request('/activate', 'POST', {}))} review={review}
        openInvestigation={(id, investigationId) => { selectCompany(id); setSelectedId(investigationId); }} />
      <PilotAudit workspace={workspace} busy={busy} name={name} freeze={collectionDigest => run(() => request('/audits', 'POST', { collectionDigest }))}
        label={labelAudit} loadSource={(batchId, caseId) => request(`/audits/${batchId}/sources/${caseId}`)}
        downloadHandoff={downloadHandoff} previewResponse={payload => request('/audit-import-preview', 'POST', payload)}
        importResponse={payload => run(() => request('/audit-imports', 'POST', payload))} />
      <div className="evidence-summary"><article><strong>{workspace.summary.trackedCompanies}</strong><span>Watched companies</span></article>
        <article><strong>{workspace.summary.openInvestigations}</strong><span>Open investigations</span></article>
        <article><strong>{workspace.summary.completedDeliveries}</strong><span>Completed deliveries</span></article>
        <article><strong>{workspace.summary.overduePending}</strong><span>Overdue pending deliveries</span></article></div>
      <p>{workspace.summary.lateCompleted} completed deliveries were late; {workspace.summary.pending} remain pending. {workspace.summary.limitation}</p>
      <h3>Watchlist</h3>
      <label>Pilot company<select aria-label="Pilot company" value={companyId} onChange={e => selectCompany(e.target.value)}>{[...new Map([...data.COMPANIES, ...issuers].map(c => [c.id, c])).values()].sort((a,b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="pilot-controls">{records.filter(r => r.type === 'watch').map(r => <button key={r.id} aria-pressed={r.payload.companyId === companyId} onClick={() => selectCompany(r.payload.companyId)}>{name(r.payload.companyId)}: {r.payload.productScope}</button>)}</div>
      {records.some(r => r.type === 'watch' && r.payload.companyId === companyId) ? <p>Monitoring objective: {records.find(r => r.type === 'watch' && r.payload.companyId === companyId).payload.objective}</p> :
        <form className="pilot-form" key={`watch-${companyId}`} onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await save('watch', { ...values(form), companyId })) form.reset(); }}>
          <p>Add {name(companyId)} to your watchlist. A watchlist entry records your interest; it does not establish a supplier relationship.</p>
          <label>Product or business scope<input name="productScope" required maxLength={300} /></label>
          <label>Monitoring objective<input name="objective" required maxLength={2000} placeholder="The decision this monitoring should support" /></label>
          <button disabled={busy}>Add company to watchlist</button>
        </form>}
      <h3>Investigate {name(companyId)}</h3>
      <details><summary>Start a source-linked investigation</summary>
        <div className="pilot-controls">{sourceChoices.map(s => <button key={s.url} title={s.supportingSection} onClick={() => setChosenSource({ ...s, companyId })}>Use {s.publicationDate}: {s.supportingSection?.slice(0, 70) || 'Company disclosure'}</button>)}</div>
        <form className="pilot-form" key={`case-${companyId}-${chosenSource?.companyId === companyId ? chosenSource.url : ''}`} onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await save('investigation', { ...values(form), companyId, status: 'open' })) form.reset(); }}>
          <label>Question to investigate<textarea name="question" required maxLength={2000} /></label>
          <label>Product or business scope<input name="productScope" required maxLength={300} /></label>
          <label>Evidence URL<input name="sourceUrl" type="url" required defaultValue={chosenSource?.companyId === companyId ? chosenSource.url : ''} /></label>
          <label>Source publication date<input name="sourceDate" type="date" required max={today()} defaultValue={chosenSource?.companyId === companyId ? chosenSource.publicationDate : ''} /></label>
          <button disabled={busy}>Create investigation</button>
        </form>
      </details>
      {current ? <>
        <label>Investigation<select aria-label="Investigation" value={current.id} onChange={e => setSelectedId(e.target.value)}>{investigations.map(r => <option value={r.id} key={r.id}>{r.payload.question}</option>)}</select></label>
        <p>{current.payload.productScope}: <a href={current.payload.sourceUrl} target="_blank" rel="noreferrer">Source dated {current.payload.sourceDate}</a>. Linked by the operator; incident attribution is not independently adjudicated.</p>
        {workspace.protocol?.historicalInvestigations.some(r => r.investigationId === current.id) && <p>Historical reference imported at pilot activation. This is not a new incident, prospective prediction or recorded operator action.</p>}
        <form className="pilot-form" key={`status-${current.id}-${current.version}`} onSubmit={e => { e.preventDefault(); const v = values(e.currentTarget); save('investigation', { ...current.payload, status: v.status, resolution: v.resolution }, current, v.reason); }}>
          <label>Status<select name="status" defaultValue={current.payload.status}>{['open','awaiting_confirmation','monitoring','closed'].map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></label>
          <label>Resolution or current finding<textarea name="resolution" defaultValue={current.payload.resolution} /></label>
          <label>Reason for status update<input name="reason" required /></label><button disabled={busy}>Update investigation</button>
        </form>
        <p>Closing an investigation does not establish that production recovered or losses were settled.</p>
        <h3>Actions taken</h3>
        {records.filter(r => r.type === 'action' && r.payload.investigationId === current.id).map(r => <p key={r.id}>{r.payload.occurredOn}: {r.payload.description} ({r.payload.reference})</p>)}
        <form className="pilot-form" key={`action-${current.id}`} onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; if (await save('action', { ...values(form), companyId, investigationId: current.id })) form.reset(); }}>
          <label>Action taken<textarea name="description" required maxLength={2000} /></label><label>Action date<input name="occurredOn" type="date" required max={today()} /></label>
          <label>Supporting reference<input name="reference" required placeholder="For example, internal review or supplier call reference" /></label><button disabled={busy}>Record action</button>
        </form>
        <h3>Delivery outcomes</h3>
        {records.filter(r => r.type === 'delivery' && r.payload.investigationId === current.id).map(r => <DeliveryCard key={r.id} record={r} outcome={workspace.summary.outcomes.find(o => o.id === r.id)} save={save} busy={busy} />)}
        <details><summary>Track an expected delivery</summary><form className="pilot-form" key={`delivery-${current.id}`} onSubmit={async e => { e.preventDefault(); const form = e.currentTarget, v = values(form); if (await save('delivery', { ...v, orderedQuantity: Number(v.orderedQuantity), receipts: [], companyId, investigationId: current.id })) form.reset(); }}>
          <label>Order or order-line reference<input name="orderReference" required /></label><label>Part or product<input name="productScope" required /></label>
          <label>Promised delivery date<input name="promisedOn" type="date" required /></label><label>Ordered quantity<input name="orderedQuantity" type="number" step="any" min="0.000001" required /></label>
          <label>Quantity units<input name="units" required placeholder="For example, wafers or units" /></label><button disabled={busy}>Track delivery</button>
        </form></details>
      </> : <p>No investigations recorded for this company.</p>}
      <details><summary>Change history ({workspace.history.length})</summary>{workspace.history.map(h => <p key={`${h.recordId}-${h.version}`}>{h.recordedAt}: {h.reason} (revision {h.version}, {records.find(r => r.id === h.recordId)?.type})</p>)}</details>
    </>}
  </section>;
}
