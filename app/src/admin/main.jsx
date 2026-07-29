import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';
const colors = { bg: '#0C111C', panel: '#141B2B', line: '#243149', copper: '#C98A3F', text: '#E9E4D8', dim: '#8C96A8', red: '#E25C4A', green: '#4FA97F' };
const button = (primary = false) => ({ border: `1px solid ${primary ? colors.copper : colors.line}`, background: primary ? colors.copper : 'transparent', color: primary ? colors.bg : colors.dim, borderRadius: 5, padding: '7px 10px', font: '600 12px system-ui', cursor: 'pointer' });

function request(path, token, options = {}) {
  return fetch(`${API}/api/admin${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Reviewer': 'admin-ui', ...(options.headers || {}) } })
    .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`); return body; });
}

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('sscim-admin-token') || '');
  const [candidate, setCandidate] = useState(null);
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  const load = async () => {
    setError('');
    try { const result = await request('/review/candidates', token); setQueue(result.candidates); setCandidate((current) => result.candidates.find((x) => x.id === current?.id) || result.candidates[0] || null); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { if (token) load(); }, []); // token is deliberately entered only on this unlinked route
  const connect = () => { sessionStorage.setItem('sscim-admin-token', token); load(); };
  const decide = async (action) => {
    if (!candidate) return;
    if (action === 'approve' && !candidate.proposal) return setError('This candidate has no AI draft and needs manual entry.');
    setBusy(true); setError('');
    try {
      const body = action === 'approve' ? { reason } : { reason };
      const result = await request(`/review/candidates/${encodeURIComponent(candidate.id)}/${action}`, token, { method: 'POST', body: JSON.stringify(body) });
      setReason(result.published ? `Published: ${result.message}` : `Recorded locally; publication will retry. ${result.error || ''}`);
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!sessionStorage.getItem('sscim-admin-token')) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: colors.bg, color: colors.text, fontFamily: 'system-ui', padding: 20 }}><section style={{ width: 360, padding: 24, border: `1px solid ${colors.line}`, borderRadius: 10, background: colors.panel }}><div style={{ color: colors.copper, fontSize: 11, letterSpacing: 2 }}>SSCIM / PRIVATE REVIEW</div><h1 style={{ fontSize: 22 }}>Review queue</h1><p style={{ color: colors.dim, fontSize: 13 }}>This unlinked page requires the server-side admin token. It is kept only for this browser session.</p><input type="password" value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && connect()} placeholder="Admin token" aria-label="Admin token" style={{ width: '100%', padding: 10, borderRadius: 5, border: `1px solid ${colors.line}`, background: colors.bg, color: colors.text, marginBottom: 10 }} /><button onClick={connect} style={button(true)}>Open review queue</button>{error && <p style={{ color: colors.red }}>{error}</p>}</section></main>;

  return <main style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: 'system-ui', padding: '28px clamp(16px, 4vw, 56px)' }}><header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'end', borderBottom: `1px solid ${colors.line}`, paddingBottom: 18, marginBottom: 18 }}><div><div style={{ color: colors.copper, letterSpacing: 2, fontSize: 11 }}>SSCIM / PRIVATE REVIEW</div><h1 style={{ margin: '5px 0', fontSize: 26 }}>Candidate queue</h1><div style={{ color: colors.dim, fontSize: 13 }}>{queue.length} pending - approval writes a classification, validates the snapshot, commits, and pushes from the server.</div></div><button onClick={() => { sessionStorage.removeItem('sscim-admin-token'); location.reload(); }} style={button()}>End session</button></header><div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, .75fr) minmax(0, 2fr)', gap: 16 }}><aside style={{ border: `1px solid ${colors.line}`, borderRadius: 8, overflow: 'auto', maxHeight: 'calc(100vh - 160px)' }}>{queue.map((item) => <button key={item.id} onClick={() => { setCandidate(item); setReason(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 13, background: candidate?.id === item.id ? 'rgba(201,138,63,.1)' : 'transparent', border: 'none', borderBottom: `1px solid ${colors.line}`, color: colors.text, cursor: 'pointer' }}><div style={{ color: colors.copper, fontSize: 10 }}>{item.date_iso} / {item.source_feed}</div><div style={{ fontWeight: 650, fontSize: 13, marginTop: 3 }}>{item.proposal?.title || 'Undrafted candidate'}</div><div style={{ color: colors.dim, fontSize: 11, marginTop: 4 }}>{item.proposal?.relevant ? `AI relevant - severity ${item.proposal.proposedSev}` : 'AI did not mark as relevant'}</div></button>)}</aside><section style={{ border: `1px solid ${colors.line}`, borderRadius: 8, padding: 20, background: colors.panel }}>{candidate ? <><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><div style={{ color: colors.copper, fontSize: 11 }}>{candidate.date_iso} / {candidate.source_feed}</div><h2 style={{ margin: '5px 0 10px', fontSize: 22 }}>{candidate.proposal?.title || 'Undrafted candidate'}</h2></div><a href={candidate.raw?.url} target="_blank" rel="noreferrer" style={{ color: colors.copper, fontSize: 12 }}>Open source</a></div><p style={{ color: colors.dim, lineHeight: 1.55 }}>{candidate.proposal?.summary || candidate.ai_notes || 'No AI proposal was created for this source record.'}</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, margin: '16px 0' }}>{[['Classification', candidate.proposal ? `${candidate.proposal.proposedDirection} / ${candidate.proposal.proposedChannel}` : 'Undrafted'], ['Model impact', candidate.proposal?.proposedOperational ? `Scored / ${candidate.proposal.proposedSev}` : 'Displayed, excluded'], ['Confidence', candidate.proposal?.confidence || 'Not assessed']].map(([label, value]) => <div key={label} style={{ padding: 10, border: `1px solid ${colors.line}`, borderRadius: 6 }}><div style={{ color: colors.dim, fontSize: 10 }}>{label.toUpperCase()}</div><div style={{ fontSize: 13, marginTop: 4 }}>{value}</div></div>)}</div><div style={{ borderTop: `1px solid ${colors.line}`, paddingTop: 14 }}><div style={{ color: colors.dim, fontSize: 11, marginBottom: 5 }}>AI uncertainty / reviewer note</div><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required context, duplicate warning, or decision rationale" rows="3" style={{ width: '100%', resize: 'vertical', padding: 9, borderRadius: 5, border: `1px solid ${colors.line}`, background: colors.bg, color: colors.text }} /></div><details style={{ marginTop: 14 }}><summary style={{ cursor: 'pointer', color: colors.dim }}>Raw source record</summary><pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: colors.dim }}>{JSON.stringify(candidate.raw, null, 2)}</pre></details><div style={{ display: 'flex', gap: 8, marginTop: 16 }}><button disabled={busy || !candidate.proposal} onClick={() => decide('approve')} style={{ ...button(true), opacity: !candidate.proposal ? .45 : 1 }}>{busy ? 'Working...' : 'Approve and publish'}</button><button disabled={busy} onClick={() => decide('reject')} style={{ ...button(), color: colors.red, borderColor: colors.red }}>{busy ? 'Working...' : 'Reject candidate'}</button></div>{reason && <p style={{ color: reason.startsWith('Published') ? colors.green : colors.dim, fontSize: 12 }}>{reason}</p>}</> : <p style={{ color: colors.dim }}>No pending candidates.</p>}{error && <p style={{ color: colors.red }}>{error}</p>}</section></div></main>;
}

createRoot(document.getElementById('root')).render(<App />);
