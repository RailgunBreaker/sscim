import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
const C = { bg: '#0C111C', panel: '#141B2B', panel2: '#0F1626', line: '#243149', copper: '#C98A3F', text: '#E9E4D8', dim: '#8C96A8', faint: '#5A6478', red: '#E25C4A', green: '#4FA97F', amber: '#DFA83D' };
const styles = `*{box-sizing:border-box}body{margin:0;background:${C.bg};color:${C.text};font-family:Inter,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}button,input,textarea{font:inherit}button:focus-visible{outline:2px solid ${C.copper};outline-offset:2px}`;
const button = (primary = false, danger = false) => ({ border: `1px solid ${danger ? C.red : primary ? C.copper : C.line}`, background: primary ? C.copper : 'transparent', color: danger ? C.red : primary ? C.bg : C.dim, borderRadius: 6, padding: '8px 11px', fontWeight: 650, fontSize: 12, cursor: 'pointer' });

async function api(path, token, options = {}) {
  let response;
  try { response = await fetch(`${API}/api/admin${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Reviewer': 'admin-ui', ...(options.headers || {}) } }); }
  catch { throw new Error(`Cannot reach ${API}. The deployed website needs a public HTTPS backend URL; local use requires the API server running on port 8787.`); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

function Metric({ label, value, color = C.text }) { return <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: 14, background: C.panel }}><div style={{ fontSize: 10, color: C.dim, letterSpacing: 1 }}>{label}</div><div style={{ color, fontSize: 28, fontWeight: 700, marginTop: 5 }}>{value}</div></div>; }

/* Tell the reviewer when the automatic publish is due, so recording a decision
   never leaves them wondering whether they still have to do something. */
function autoPublishNote(auto, pending) {
  if (!auto) return '';
  if (!auto.enabled) return ' Auto-publish is off — publish when you are done.';
  if (!auto.scheduledFor) return '';
  const seconds = Math.max(0, Math.round((Date.parse(auto.scheduledFor) - Date.now()) / 1000));
  return pending === 0
    ? ` Queue is clear — publishing in ${seconds}s.`
    : ` Publishing automatically in ${seconds}s unless you decide another.`;
}

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('sscim-admin-token') || '');
  const [tab, setTab] = useState('queue');
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (nextTab = tab) => {
    setError('');
    try {
      const status = nextTab === 'queue' ? 'pending' : nextTab === 'history' ? 'all' : null;
      const [dash, candidates] = await Promise.all([api('/dashboard', token), status ? api(`/review/candidates?status=${status}`, token) : Promise.resolve({ candidates: [] })]);
      setSummary(dash); setList(candidates.candidates); setSelected((old) => candidates.candidates.find((x) => x.id === old?.id) || candidates.candidates[0] || null);
    } catch (e) { setError(e.message); }
  };
  const connect = () => { sessionStorage.setItem('sscim-admin-token', token); load('queue'); };
  useEffect(() => { if (sessionStorage.getItem('sscim-admin-token')) load('queue'); }, []);
  const changeTab = (next) => { setTab(next); setNote(''); load(next); };
  const decide = async (action) => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const result = await api(`/review/candidates/${encodeURIComponent(selected.id)}/${action}`, token, { method: 'POST', body: JSON.stringify({ reason: note }) });
      setNote(`Recorded. ${result.unpublished} decision(s) awaiting publication.${autoPublishNote(result.autoPublish, result.pending)}`);
      await load('queue');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  /* One commit per review session, not per click. The batch publishes itself
     once you stop deciding (or finish the queue); this button is the "now"
     override — see server/src/review-queue.js. */
  const publish = async () => {
    setBusy(true); setError('');
    try {
      const result = await api('/review/publish', token, { method: 'POST' });
      setNote(result.published ? `Published: ${result.message}` : `Publish failed — decisions are still saved and will be retried. ${result.error || ''}`);
      await load(tab);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!sessionStorage.getItem('sscim-admin-token')) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}><style>{styles}</style><section style={{ width: 390, padding: 25, border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel }}><div style={{ color: C.copper, letterSpacing: 2, fontSize: 10 }}>SSCIM / ADMIN</div><h1 style={{ fontSize: 24, margin: '7px 0' }}>Operations dashboard</h1><p style={{ color: C.dim, fontSize: 13, lineHeight: 1.5 }}>Enter the backend <code>ADMIN_TOKEN</code>. It remains in this browser tab only.</p><input type="password" value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && connect()} placeholder="Admin token" aria-label="Admin token" style={{ width: '100%', padding: 10, border: `1px solid ${C.line}`, borderRadius: 6, background: C.bg, color: C.text, marginBottom: 10 }} /><button onClick={connect} style={button(true)}>Open dashboard</button>{error && <p style={{ color: C.red, fontSize: 12 }}>{error}</p>}</section></main>;

  const pending = summary?.counts?.pending ?? '-';
  const unpublished = summary?.unpublished ?? 0;
  return <main style={{ minHeight: '100vh', padding: '22px clamp(16px,4vw,54px)' }}><style>{styles}</style><header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, paddingBottom: 18, borderBottom: `1px solid ${C.line}` }}><div><div style={{ color: C.copper, letterSpacing: 2, fontSize: 10 }}>SSCIM / ADMIN</div><h1 style={{ margin: '5px 0', fontSize: 26 }}>Operations dashboard</h1><p style={{ color: C.dim, margin: 0, fontSize: 13 }}>Review pipeline candidates, publication status, and current vault health.</p></div><div style={{ display: 'flex', gap: 8 }}><button disabled={busy || !unpublished} onClick={publish} title={unpublished ? `Commit and push ${unpublished} recorded decision(s) now, as one commit — otherwise this happens automatically once you stop reviewing` : 'No decisions awaiting publication'} style={{ ...button(unpublished > 0), opacity: unpublished ? 1 : .45 }}>{busy ? 'Working…' : `Publish${unpublished ? ` (${unpublished})` : ''}`}</button><button onClick={() => load(tab)} style={button()}>Refresh</button><button onClick={() => { sessionStorage.removeItem('sscim-admin-token'); location.reload(); }} style={button()}>End session</button></div></header>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, margin: '18px 0' }}><Metric label="PENDING REVIEW" value={pending} color={C.amber} /><Metric label="APPROVED" value={summary?.counts?.approved ?? '-'} color={C.green} /><Metric label="REJECTED" value={summary?.counts?.rejected ?? '-'} /><Metric label="LIVE EVENTS" value={summary?.events ?? '-'} color={C.copper} /></section>
    <nav style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.line}`, marginBottom: 16 }}>{[['queue', `Review queue (${pending})`], ['history', 'Decision history'], ['operations', 'Operations']].map(([id, label]) => <button key={id} onClick={() => changeTab(id)} style={{ border: 'none', borderBottom: `2px solid ${tab === id ? C.copper : 'transparent'}`, background: 'transparent', color: tab === id ? C.copper : C.dim, padding: '10px 12px', cursor: 'pointer', fontSize: 12 }}>{label}</button>)}</nav>
    {error && <div style={{ border: `1px solid ${C.red}`, color: C.red, padding: 12, borderRadius: 7, marginBottom: 14, fontSize: 13 }}>{error}<div style={{ color: C.dim, marginTop: 5 }}>Local fix: run <code>./start-api.ps1</code> in the backend folder. Public fix: host the API at an HTTPS URL, set GitHub Actions variable <code>VITE_API_BASE_URL</code>, then rebuild Pages.</div></div>}
    {tab === 'operations' ? <section style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}><div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 18 }}><h2 style={{ marginTop: 0, fontSize: 16 }}>Pipeline status</h2><p style={{ color: C.dim }}>Last run: <b style={{ color: C.text }}>{summary?.meta?.last_run_at || 'Not recorded'}</b></p><p style={{ color: C.dim }}>Status: <b style={{ color: summary?.meta?.last_run_status === 'ok' ? C.green : C.amber }}>{summary?.meta?.last_run_status || 'Unknown'}</b></p><p style={{ color: C.dim }}>Dataset date: <b style={{ color: C.text }}>{summary?.meta?.snapshot_date || 'Unknown'}</b></p>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Auto-publish</h2>
      <p style={{ color: C.dim, margin: '4px 0' }}>{summary?.autoPublish?.enabled ? <>On — a review batch publishes itself after <b style={{ color: C.text }}>{Math.round((summary.autoPublish.idleMs || 0) / 1000)}s</b> of no decisions, or as soon as the queue empties.</> : <>Off (<code>REVIEW_AUTOPUBLISH=off</code>) — publish manually.</>}</p>
      {summary?.autoPublish?.scheduledFor && <p style={{ color: C.amber, margin: '4px 0' }}>Next automatic publish: <b>{summary.autoPublish.scheduledFor}</b></p>}
      {summary?.autoPublish?.lastStatus && <p style={{ color: summary.autoPublish.lastStatus === 'published' ? C.green : C.red, margin: '4px 0' }}>Last attempt: {summary.autoPublish.lastStatus} · {summary.autoPublish.lastAt}{summary.autoPublish.lastError ? ` · ${String(summary.autoPublish.lastError).split('\n')[0]}` : ''}</p>}
      {summary?.meta?.last_autopublish_status && <p style={{ color: C.faint, margin: '4px 0', fontSize: 12 }}>Recorded: {summary.meta.last_autopublish_status}</p>}</div><div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 18 }}><h2 style={{ marginTop: 0, fontSize: 16 }}>Recent decisions</h2>{summary?.recentReviews?.length ? summary.recentReviews.map((r) => <div key={r.id} style={{ padding: '7px 0', borderBottom: `1px solid ${C.line}`, fontSize: 12 }}><b>{r.proposal?.title || r.id}</b><div style={{ color: r.status === 'approved' ? C.green : C.red }}>{r.status} · {r.reviewed_at || 'pending publication'}</div></div>) : <p style={{ color: C.dim }}>No reviewed candidates yet.</p>}</div></section> : <section style={{ display: 'grid', gridTemplateColumns: 'minmax(250px,.8fr) minmax(0,2fr)', gap: 14 }}><aside style={{ border: `1px solid ${C.line}`, borderRadius: 9, overflow: 'auto', maxHeight: 'calc(100vh - 270px)' }}>{list.map((item) => <button key={item.id} onClick={() => { setSelected(item); setNote(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', borderBottom: `1px solid ${C.line}`, background: selected?.id === item.id ? 'rgba(201,138,63,.1)' : 'transparent', padding: 12, color: C.text, cursor: 'pointer' }}><div style={{ color: C.copper, fontSize: 10 }}>{item.date_iso} · {item.source_feed}</div><div style={{ fontSize: 13, fontWeight: 650, marginTop: 3 }}>{item.proposal?.title || 'Undrafted candidate'}</div><div style={{ color: item.status === 'approved' ? C.green : item.status === 'rejected' ? C.red : C.dim, fontSize: 11, marginTop: 4 }}>{item.status} {item.proposal?.relevant ? `· severity ${item.proposal.proposedSev}` : ''}{item.duplicate_of && <span style={{ color: C.amber }}> · possible duplicate</span>}</div></button>)}</aside><article style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: 20, background: C.panel }}>{selected ? <><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><div style={{ color: C.copper, fontSize: 11 }}>{selected.date_iso} · {selected.source_feed}</div><h2 style={{ fontSize: 22, margin: '5px 0 10px' }}>{selected.proposal?.title || 'Undrafted candidate'}</h2></div>{selected.raw?.url && <a href={selected.raw.url} target="_blank" rel="noreferrer" style={{ color: C.copper, fontSize: 12 }}>Open source</a>}</div>{selected.duplicate_of && <p style={{ border: `1px solid ${C.amber}`, color: C.amber, borderRadius: 6, padding: 9, fontSize: 12 }}>Flagged as a possible duplicate of <b>{selected.duplicate_of}</b>. Confirm this is a distinct event before approving.</p>}<p style={{ color: C.dim, lineHeight: 1.55 }}>{selected.proposal?.summary || selected.ai_notes || 'No AI proposal is available for this source record.'}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, margin: '16px 0' }}>{[['Classification', selected.proposal ? `${selected.proposal.proposedDirection} / ${selected.proposal.proposedChannel}` : 'Undrafted'], ['Model impact', selected.proposal?.proposedOperational ? `Scored / ${selected.proposal.proposedSev}` : 'Excluded from score'], ['Confidence', selected.proposal?.confidence || 'Not assessed']].map(([k, v]) => <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 9 }}><div style={{ fontSize: 10, color: C.dim }}>{k.toUpperCase()}</div><div style={{ fontSize: 13, marginTop: 4 }}>{v}</div></div>)}</div><details><summary style={{ color: C.dim, cursor: 'pointer' }}>Raw source record</summary><pre style={{ whiteSpace: 'pre-wrap', color: C.dim, fontSize: 11 }}>{JSON.stringify(selected.raw, null, 2)}</pre></details>{selected.status === 'pending' && <><textarea value={note} onChange={(e) => setNote(e.target.value)} rows="3" placeholder="Decision rationale or duplicate warning" style={{ width: '100%', marginTop: 14, background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: 9, resize: 'vertical' }} /><div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button disabled={busy || !selected.proposal} onClick={() => decide('approve')} style={{ ...button(true), opacity: selected.proposal ? 1 : .45 }}>{busy ? 'Working…' : 'Approve'}</button><button disabled={busy} onClick={() => decide('reject')} style={button(false, true)}>Reject</button></div></>}{note && <p style={{ color: note.startsWith('Published') ? C.green : C.dim, fontSize: 12 }}>{note}</p>}</> : <p style={{ color: C.dim }}>No candidates in this view.</p>}</article></section>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
