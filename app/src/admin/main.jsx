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

const chip = (text, color) => <span style={{ border: `1px solid ${color}`, color, borderRadius: 4, padding: '1px 5px', fontSize: 10, marginRight: 4, whiteSpace: 'nowrap' }}>{text}</span>;

/* A candidate's own title if the drafter produced one, else the headline the
   feed supplied. Never a bare "Undrafted candidate" — that told the reviewer
   nothing about two dozen rows that looked identical in the list. */
const titleOf = (item) => item.proposal?.title || item.raw?.title || `${item.source_feed} record`;

/* ai_notes carries the drafter's uncertainty, or the reason a draft failed.
   A failed run used to write kilobytes there (see analyze-claude-code.mjs),
   and the detail pane rendered every byte. Cap it regardless of what the
   server sends, so one bad record can never wall off the UI again. */
const NOTE_CAP = 600;
const capped = (text) => {
  const value = String(text ?? '');
  return value.length > NOTE_CAP ? `${value.slice(0, NOTE_CAP)}…` : value;
};

/* The three groups, in the order a reviewer should meet them: what needs a
   person first, then the two the machine would handle on its own. */
const GROUPS = [
  { key: 'review', label: 'Needs you', color: C.amber, blurb: 'Ambiguous, low-confidence, flagged as a duplicate, or undrafted.' },
  { key: 'autoApprove', label: 'Would auto-approve', color: C.green, blurb: 'Relevant at High confidence with no duplicate flag.' },
  { key: 'autoReject', label: 'Would auto-reject', color: C.red, blurb: 'Judged not a supply-chain event, above Low confidence.' },
];

function CandidateRow({ item, verdict, selected, checked, onSelect, onCheck }) {
  return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: `1px solid ${C.line}`, background: selected ? 'rgba(201,138,63,.1)' : 'transparent', padding: '9px 10px' }}>
    {onCheck && <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Select ${titleOf(item)}`} style={{ marginTop: 4, accentColor: C.copper, cursor: 'pointer' }} />}
    <button onClick={onSelect} style={{ flex: 1, minWidth: 0, display: 'block', textAlign: 'left', border: 'none', background: 'transparent', color: C.text, cursor: 'pointer', padding: 0 }}>
      <div style={{ color: C.copper, fontSize: 10 }}>{item.date_iso} · {item.source_feed}</div>
      <div style={{ fontSize: 13, fontWeight: 650, margin: '3px 0 5px' }}>{titleOf(item)}</div>
      <div>
        {item.proposal?.relevant && chip(`sev ${item.proposal.proposedSev}`, C.text)}
        {item.proposal?.confidence && chip(item.proposal.confidence, item.proposal.confidence === 'High' ? C.green : item.proposal.confidence === 'Low' ? C.red : C.amber)}
        {item.proposal?.relevant === false && chip('not an event', C.faint)}
        {!item.proposal && chip('no draft', C.red)}
        {item.proposal?.relevant && item.proposal.proposedOperational === false && chip('not scored', C.faint)}
        {item.duplicate_of && chip('possible duplicate', C.amber)}
        {item.status !== 'pending' && chip(item.status, item.status === 'approved' ? C.green : C.red)}
      </div>
      {verdict?.reason && <div style={{ color: C.faint, fontSize: 11, marginTop: 5, lineHeight: 1.4 }}>{capped(verdict.reason)}</div>}
    </button>
  </div>;
}

function QueueView({ tab, list, triage, selected, setSelected, selectedIds, setSelectedIds, note, setNote, busy, decide, runTriage, bulkAct }) {
  const byId = new Map(list.map((item) => [item.id, item]));
  /* The server decided the verdicts; the UI only groups by them. Keeping the
     rule in one place is what stops the list from showing one thing and the
     Run-triage button from doing another. */
  const verdictById = new Map();
  if (triage) for (const key of ['review', 'autoApprove', 'autoReject']) for (const row of triage[key] || []) verdictById.set(row.id, { group: key, ...row.triage });

  const grouped = tab === 'queue' && triage
    ? GROUPS.map((g) => ({ ...g, items: (triage[g.key] || []).map((row) => byId.get(row.id)).filter(Boolean) }))
    : [{ key: 'all', label: tab === 'history' ? 'All candidates' : 'Queue', color: C.dim, blurb: '', items: list }];

  const toggle = (id) => setSelectedIds((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleGroup = (items) => setSelectedIds((old) => {
    const next = new Set(old);
    const every = items.length > 0 && items.every((i) => next.has(i.id));
    for (const i of items) { if (every) next.delete(i.id); else next.add(i.id); }
    return next;
  });

  const chosen = [...selectedIds].filter((id) => byId.get(id)?.status === 'pending');
  const p = selected?.proposal;
  const selectedVerdict = selected ? verdictById.get(selected.id) : null;
  const selectedGroup = selectedVerdict ? GROUPS.find((g) => g.key === selectedVerdict.group) : null;
  const automatic = triage ? triage.counts.autoApprove + triage.counts.autoReject : 0;

  return <>
    {tab === 'queue' && triage && <section style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 9, padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 13, fontWeight: 650 }}>Automatic triage</div>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>
          {triage.counts.autoReject} to reject, {triage.counts.autoApprove} to approve, <b style={{ color: C.amber }}>{triage.counts.review} for you</b>.
          {!triage.settings.autoApprove && ' Auto-approve is off.'}
          {!triage.settings.autoReject && ' Auto-reject is off.'}
        </div>
      </div>
      <button disabled={busy || automatic === 0} onClick={runTriage} style={{ ...button(true), opacity: automatic === 0 ? .45 : 1 }}>
        {busy ? 'Working…' : `Run triage (${automatic})`}
      </button>
    </section>}

    {chosen.length > 0 && <section style={{ border: `1px solid ${C.copper}`, borderRadius: 9, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 13 }}><b>{chosen.length}</b> selected</span>
      <button disabled={busy} onClick={() => bulkAct('approve', chosen)} style={button(true)}>Approve selected</button>
      <button disabled={busy} onClick={() => bulkAct('reject', chosen)} style={button(false, true)}>Reject selected</button>
      <button disabled={busy} onClick={() => setSelectedIds(new Set())} style={button()}>Clear</button>
    </section>}

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,.9fr) minmax(0,2fr)', gap: 14 }}>
      <aside style={{ border: `1px solid ${C.line}`, borderRadius: 9, overflow: 'auto', maxHeight: 'calc(100vh - 270px)' }}>
        {grouped.map((g) => g.items.length === 0 ? null : <div key={g.key}>
          <div style={{ position: 'sticky', top: 0, background: C.panel2, borderBottom: `1px solid ${C.line}`, padding: '8px 10px', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ color: g.color, fontSize: 11, fontWeight: 700, letterSpacing: .6 }}>{g.label.toUpperCase()} ({g.items.length})</span>
              {g.items.some((i) => i.status === 'pending') && <button onClick={() => toggleGroup(g.items.filter((i) => i.status === 'pending'))} style={{ ...button(), padding: '2px 6px', fontSize: 10 }}>Select all</button>}
            </div>
            {g.blurb && <div style={{ color: C.faint, fontSize: 10, marginTop: 3 }}>{g.blurb}</div>}
          </div>
          {g.items.map((item) => <CandidateRow key={item.id} item={item} verdict={verdictById.get(item.id)}
            selected={selected?.id === item.id} checked={selectedIds.has(item.id)}
            onSelect={() => { setSelected(item); setNote(''); }}
            onCheck={item.status === 'pending' ? () => toggle(item.id) : null} />)}
        </div>)}
        {grouped.every((g) => g.items.length === 0) && <p style={{ color: C.dim, padding: 14 }}>Queue is clear.</p>}
      </aside>

      <article style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: 20, background: C.panel }}>{selected ? <>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><div style={{ color: C.copper, fontSize: 11 }}>{selected.date_iso} · {selected.source_feed}</div>
            <h2 style={{ fontSize: 22, margin: '5px 0 10px' }}>{titleOf(selected)}</h2></div>
          {selected.raw?.url && <a href={selected.raw.url} target="_blank" rel="noreferrer" style={{ color: C.copper, fontSize: 12, whiteSpace: 'nowrap' }}>Open source</a>}
        </div>

        {selectedGroup && <p style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 9, fontSize: 12, color: C.dim }}>
          <b style={{ color: selectedGroup.color }}>{selectedGroup.label}</b>{' — '}{capped(selectedVerdict.reason)}
        </p>}

        {selected.duplicate_of && <p style={{ border: `1px solid ${C.amber}`, color: C.amber, borderRadius: 6, padding: 9, fontSize: 12 }}>Flagged as a possible duplicate of <b>{selected.duplicate_of}</b>. Confirm this is a distinct event before approving.</p>}

        <p style={{ color: C.dim, lineHeight: 1.55 }}>{p?.summary || (p ? '' : 'No AI proposal is available for this source record.')}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, margin: '16px 0' }}>
          {[['Classification', p ? `${p.proposedDirection} / ${p.proposedChannel}` : 'Undrafted'],
            ['Model impact', p?.proposedOperational ? `Scored / ${p.proposedSev}` : 'Excluded from score'],
            ['Confidence', p?.confidence || 'Not assessed']].map(([k, v]) => <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 9 }}>
              <div style={{ fontSize: 10, color: C.dim }}>{k.toUpperCase()}</div><div style={{ fontSize: 13, marginTop: 4 }}>{v}</div></div>)}
        </div>

        {p?.uncertainty && <p style={{ color: C.amber, fontSize: 12, lineHeight: 1.5 }}><b>Could not establish:</b> {capped(p.uncertainty)}</p>}
        {selected.ai_notes && !p && <p style={{ color: C.faint, fontSize: 12, lineHeight: 1.5, wordBreak: 'break-word' }}>{capped(selected.ai_notes)}</p>}

        <details><summary style={{ color: C.dim, cursor: 'pointer' }}>Raw source record</summary>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: C.dim, fontSize: 11 }}>{JSON.stringify(selected.raw, null, 2)}</pre></details>

        {selected.status === 'pending' && <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows="3" placeholder="Decision rationale or duplicate warning" style={{ width: '100%', marginTop: 14, background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: 9, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button disabled={busy || !p} onClick={() => decide('approve')} style={{ ...button(true), opacity: p ? 1 : .45 }}>{busy ? 'Working…' : 'Approve'}</button>
            <button disabled={busy} onClick={() => decide('reject')} style={button(false, true)}>Reject</button>
          </div>
        </>}
        {note && <p style={{ color: note.startsWith('Published') ? C.green : C.dim, fontSize: 12 }}>{note}</p>}
      </> : <p style={{ color: C.dim }}>No candidates in this view.</p>}</article>
    </section>
  </>;
}

/* ---------------- events: the historical record ----------------------------
   The queue decides what enters the index. This decides what stays in it.

   The column that matters is Δ-if-removed, not severity. Severity says how
   bad the event was; it does not say what deleting it does to the published
   number, because effects decay with age and overlapping events saturate
   through the engine's bounded, saturating aggregation. A severity-9 export control from 2022 moves
   today's index by nothing, and one of five near-identical earthquake records
   moves it far less than it would alone. The server computes both from the
   same engine the dashboard renders, so this screen and the published index
   cannot disagree. */
const signed = (n, places = 3) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(places)}`;

/* Removing an event that raised the index LOWERS the number, so a positive
   removalDelta is a fall. Colour by what happens to the index, not by sign. */
const deltaColor = (d) => (Math.abs(d) < 0.0005 ? C.faint : d > 0 ? C.green : C.red);

const EDIT_FIELDS = [
  ['title', 'Title', 'text'],
  ['summary', 'Summary', 'area'],
  ['sev', 'Severity (1-10)', 'number'],
  ['type', 'Type', 'text'],
  ['conf', 'Confidence', 'select'],
  ['dateISO', 'Date (YYYY-MM-DD)', 'text'],
];

function EventRow({ event, selected, checked, onSelect, onCheck }) {
  const d = event.removalDelta;
  return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: `1px solid ${C.line}`, background: selected ? 'rgba(201,138,63,.1)' : 'transparent', padding: '9px 10px' }}>
    <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Select ${event.title}`} style={{ marginTop: 4, accentColor: C.copper, cursor: 'pointer' }} />
    <button onClick={onSelect} style={{ flex: 1, minWidth: 0, display: 'block', textAlign: 'left', border: 'none', background: 'transparent', color: C.text, cursor: 'pointer', padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: C.copper, fontSize: 10 }}>{event.dateISO || event.date} · {event.type}</span>
        <span style={{ color: deltaColor(d ?? 0), fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {event.operational ? signed(-(d ?? 0)) : '—'}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 650, margin: '3px 0 5px' }}>{event.title}</div>
      <div>
        {chip(`sev ${event.sev}`, C.text)}
        {chip(event.origin, event.origin === 'code-defined' ? C.faint : C.copper)}
        {!event.operational && chip('not scored', C.faint)}
        {event.override && chip('edited', C.amber)}
      </div>
    </button>
  </div>;
}

function EventsView({ events, eventSel, setEventSel, selectedEvent, setSelectedEvent, draft, setDraft, busy, note,
                     sortBy, setSortBy, onPreview, preview, onDelete, onRestore, onSave, onPublish }) {
  if (!events) return <p style={{ color: C.dim }}>Loading the event record…</p>;

  const sorted = [...events.events].sort((a, b) => (sortBy === 'impact'
    ? Math.abs(b.removalDelta ?? 0) - Math.abs(a.removalDelta ?? 0)
    : String(b.dateISO || '').localeCompare(String(a.dateISO || ''))));

  const toggle = (id) => setEventSel((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const chosen = [...eventSel];
  const e = selectedEvent;

  return <>
    <section style={{ border: `1px solid ${C.line}`, background: C.panel, borderRadius: 9, padding: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 10, color: C.dim, letterSpacing: 1 }}>CHAIN INDEX</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: C.copper }}>{events.currentIndex?.toFixed(3) ?? '—'}</div>
      </div>
      <div style={{ flex: 1, minWidth: 220, color: C.dim, fontSize: 12, lineHeight: 1.6 }}>
        {events.counts.total} events · {events.counts.scored} scored · {events.counts.codeDefined} code-defined · {events.counts.vaultOnly} vault-only
        {events.counts.overridden > 0 && <><br /><span style={{ color: C.amber }}>{events.counts.overridden} edited, {events.counts.deleted} deleted — not yet committed unless you have published.</span></>}
        <br /><span style={{ color: C.faint }}>Snapshot {events.snapshotDate}. Δ is what the index does if the event is removed.</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => setSortBy(sortBy === 'impact' ? 'date' : 'impact')} style={button()}>Sort: {sortBy === 'impact' ? 'impact' : 'date'}</button>
        <button disabled={busy} onClick={onPublish} style={button(true)}>{busy ? 'Working…' : 'Commit changes'}</button>
      </div>
    </section>

    {chosen.length > 0 && <section style={{ border: `1px solid ${C.copper}`, borderRadius: 9, padding: '10px 14px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13 }}><b>{chosen.length}</b> selected</span>
        <button disabled={busy} onClick={() => onPreview(chosen)} style={button()}>Preview removal</button>
        <button disabled={busy} onClick={() => onDelete(chosen)} style={button(false, true)}>Delete selected</button>
        <button disabled={busy} onClick={() => setEventSel(new Set())} style={button()}>Clear</button>
      </div>
      {preview && <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
        Index would move <b style={{ color: deltaColor(preview.delta) }}>{preview.currentIndex.toFixed(3)} → {preview.indexAfter.toFixed(3)}</b> ({signed(-preview.delta)}), removing {preview.scoredRemoved} scored event(s).
        {Math.abs(preview.delta - preview.sumOfIndividualDeltas) > 0.001 && <div style={{ color: C.faint, marginTop: 4 }}>
          Individually these sum to {signed(-preview.sumOfIndividualDeltas)}. The combined figure is larger because overlapping events saturate — each one looks small only while the others are still there.
        </div>}
        {preview.notFound?.length > 0 && <div style={{ color: C.red, marginTop: 4 }}>Not found: {preview.notFound.join(', ')}</div>}
      </div>}
    </section>}

    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,1fr) minmax(0,1.4fr)', gap: 14 }}>
      <aside style={{ border: `1px solid ${C.line}`, borderRadius: 9, overflow: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
        {sorted.map((item) => <EventRow key={item.id} event={item}
          selected={e?.id === item.id} checked={eventSel.has(item.id)}
          onSelect={() => { setSelectedEvent(item); setDraft(null); }}
          onCheck={() => toggle(item.id)} />)}
        {events.deleted.length > 0 && <div>
          <div style={{ position: 'sticky', top: 0, background: C.panel2, borderBottom: `1px solid ${C.line}`, padding: '8px 10px', color: C.red, fontSize: 11, fontWeight: 700, letterSpacing: .6 }}>
            DELETED ({events.deleted.length})
          </div>
          {events.deleted.map((d) => <div key={d.id} style={{ padding: '9px 10px', borderBottom: `1px solid ${C.line}`, fontSize: 12 }}>
            <div style={{ color: C.dim }}>{d.id}</div>
            {d.reason && <div style={{ color: C.faint, fontSize: 11, marginTop: 3 }}>{d.reason}</div>}
            <button disabled={busy} onClick={() => onRestore(d.id)} style={{ ...button(), marginTop: 6, padding: '2px 7px', fontSize: 10 }}>Restore</button>
          </div>)}
        </div>}
      </aside>

      <article style={{ border: `1px solid ${C.line}`, borderRadius: 9, padding: 20, background: C.panel }}>{e ? <>
        <div style={{ color: C.copper, fontSize: 11 }}>{e.dateISO || e.date} · {e.origin}</div>
        <h2 style={{ fontSize: 20, margin: '5px 0 10px' }}>{e.title}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, margin: '14px 0' }}>
          {[['Δ if removed', e.operational ? signed(-(e.removalDelta ?? 0)) : 'none — not scored'],
            ['Index without it', e.operational ? (e.indexWithout?.toFixed(3) ?? '—') : '—'],
            ['Contributed on its date', e.operational ? signed(e.marginal ?? 0) : '—']].map(([k, v]) => <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 9 }}>
              <div style={{ fontSize: 10, color: C.dim }}>{k.toUpperCase()}</div><div style={{ fontSize: 14, marginTop: 4 }}>{v}</div></div>)}
        </div>

        {e.classification && <p style={{ color: C.faint, fontSize: 12, lineHeight: 1.5 }}>
          <b style={{ color: C.dim }}>{e.classification.direction} / {e.classification.channel}</b> — {capped(e.classification.reason)}
        </p>}

        {e.origin === 'code-defined' && <p style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: 9, fontSize: 12, color: C.dim }}>
          Defined in code (history-events.js / decade-events.js / seed-data.js). Edits and deletions here are recorded as overrides, so the next <code>sync-events</code> run will not undo them. <i>Restore</i> hands the event back to its source file.
        </p>}

        {e.override && <p style={{ border: `1px solid ${C.amber}`, color: C.amber, borderRadius: 6, padding: 9, fontSize: 12 }}>
          Overridden by {e.override.actor || 'admin'} on {e.override.updated_at}. {e.override.reason || ''}
          <button disabled={busy} onClick={() => onRestore(e.id)} style={{ ...button(), marginLeft: 8, padding: '2px 7px', fontSize: 10 }}>Undo override</button>
        </p>}

        <p style={{ color: C.dim, lineHeight: 1.55, fontSize: 13 }}>{capped(e.summary)}</p>

        {draft ? <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 14, paddingTop: 14 }}>
          {EDIT_FIELDS.map(([key, label, kind]) => <label key={key} style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ display: 'block', fontSize: 10, color: C.dim, marginBottom: 3 }}>{label.toUpperCase()}</span>
            {kind === 'area'
              ? <textarea rows="3" value={draft[key] ?? ''} onChange={(ev) => setDraft({ ...draft, [key]: ev.target.value })}
                  style={{ width: '100%', background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: 8, resize: 'vertical' }} />
              : kind === 'select'
                ? <select value={draft[key] ?? ''} onChange={(ev) => setDraft({ ...draft, [key]: ev.target.value })}
                    style={{ width: '100%', background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: 8 }}>
                    {['High', 'Medium', 'Low'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                : <input type={kind} value={draft[key] ?? ''} onChange={(ev) => setDraft({ ...draft, [key]: kind === 'number' ? Number(ev.target.value) : ev.target.value })}
                    style={{ width: '100%', background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: 8 }} />}
          </label>)}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button disabled={busy} onClick={() => onSave(e.id, draft)} style={button(true)}>{busy ? 'Saving…' : 'Save edit'}</button>
            <button disabled={busy} onClick={() => setDraft(null)} style={button()}>Cancel</button>
          </div>
        </div> : <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button disabled={busy} onClick={() => setDraft(Object.fromEntries(EDIT_FIELDS.map(([k]) => [k, e[k]])))} style={button(true)}>Edit</button>
          <button disabled={busy} onClick={() => onDelete([e.id])} style={button(false, true)}>Delete</button>
        </div>}

        {note && <p style={{ color: note.startsWith('Committed') ? C.green : C.dim, fontSize: 12, marginTop: 12 }}>{note}</p>}
      </> : <p style={{ color: C.dim }}>Select an event to see what it is worth to the index.</p>}</article>
    </section>
  </>;
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
  const [triage, setTriage] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [events, setEvents] = useState(null);
  const [eventSel, setEventSel] = useState(new Set());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState(null);
  const [sortBy, setSortBy] = useState('impact');

  const load = async (nextTab = tab) => {
    setError('');
    try {
      const status = nextTab === 'queue' ? 'pending' : nextTab === 'history' ? 'all' : null;
      /* The triage preview is fetched alongside the list rather than derived
         in the browser: the same rules decide what the Run-triage button does,
         and a UI that grouped by its own copy of them would eventually show
         one thing and do another. Queue tab only — triage is about pending. */
      const [dash, candidates, plan] = await Promise.all([
        api('/dashboard', token),
        status ? api(`/review/candidates?status=${status}`, token) : Promise.resolve({ candidates: [] }),
        nextTab === 'queue' ? api('/review/triage', token) : Promise.resolve(null),
      ]);
      setSummary(dash); setList(candidates.candidates); setTriage(plan);
      setSelected((old) => candidates.candidates.find((x) => x.id === old?.id) || candidates.candidates[0] || null);
      /* Drop selections whose candidate is gone (decided, or filtered out by a
         tab change) so a stale id cannot be submitted in the next bulk call. */
      setSelectedIds((old) => new Set([...old].filter((id) => candidates.candidates.some((c) => c.id === id && c.status === 'pending'))));
    } catch (e) { setError(e.message); }
  };
  const connect = () => { sessionStorage.setItem('sscim-admin-token', token); load('queue'); };
  useEffect(() => { if (sessionStorage.getItem('sscim-admin-token')) load('queue'); }, []);
  const changeTab = (next) => {
    setTab(next); setNote(''); setPreview(null); setDraft(null);
    if (next === 'events') { if (!events) loadEvents(); } else { load(next); }
  };
  const decide = async (action) => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const result = await api(`/review/candidates/${encodeURIComponent(selected.id)}/${action}`, token, { method: 'POST', body: JSON.stringify({ reason: note }) });
      setNote(`Recorded. ${result.unpublished} decision(s) awaiting publication.${autoPublishNote(result.autoPublish, result.pending)}`);
      await load('queue');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  /* Apply both automatic verdicts in one call. The server re-derives the plan
     rather than trusting the ids the browser is holding — the queue may have
     moved since this page rendered it. */
  const runTriage = async () => {
    setBusy(true); setError('');
    try {
      const r = await api('/review/triage', token, { method: 'POST' });
      const failed = [...r.rejected.failed, ...r.approved.failed];
      setNote(`Triage: ${r.rejected.succeeded} rejected, ${r.approved.succeeded} approved, ${r.remaining} left for you.`
        + (failed.length ? ` ${failed.length} could not be applied: ${failed.map((f) => `${f.id} (${f.error})`).join('; ')}` : '')
        + autoPublishNote(r.autoPublish, r.remaining));
      setSelectedIds(new Set());
      await load('queue');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const bulkAct = async (action, ids) => {
    setBusy(true); setError('');
    try {
      const r = await api('/review/bulk', token, { method: 'POST', body: JSON.stringify({ ids, action, reason: note || undefined }) });
      setNote(`${r.succeeded}/${r.attempted} ${action === 'approve' ? 'approved' : 'rejected'}.`
        + (r.failed.length ? ` Failed: ${r.failed.map((f) => `${f.id} (${f.error})`).join('; ')}` : '')
        + ` ${r.unpublished} decision(s) awaiting publication.${autoPublishNote(r.autoPublish, r.pending)}`);
      setSelectedIds(new Set());
      await load('queue');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  /* Events tab. Loaded on demand rather than with the dashboard: the impact
     column costs an engine build plus one index evaluation per scored event,
     which is cheap (~200ms) but pointless until someone opens the screen. */
  const loadEvents = async () => {
    setError('');
    try { setEvents(await api('/events/admin', token)); }
    catch (e) { setError(e.message); }
  };

  const onPreview = async (ids) => {
    setBusy(true); setError('');
    try { setPreview(await api('/events/removal-preview', token, { method: 'POST', body: JSON.stringify({ ids }) })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const onDeleteEvents = async (ids) => {
    setBusy(true); setError('');
    try {
      const results = [];
      for (const id of ids) {
        try { results.push({ id, ...(await api(`/events/${encodeURIComponent(id)}`, token, { method: 'DELETE' })) }); }
        catch (err) { results.push({ id, error: err.message }); }
      }
      const failed = results.filter((r) => r.error);
      setNote(`Deleted ${results.length - failed.length}/${ids.length}.`
        + (failed.length ? ` Failed: ${failed.map((f) => `${f.id} (${f.error})`).join('; ')}` : '')
        + ' Nothing is published until you commit.');
      setEventSel(new Set()); setPreview(null); setSelectedEvent(null);
      await loadEvents();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const onSaveEvent = async (id, patch) => {
    setBusy(true); setError('');
    try {
      await api(`/events/${encodeURIComponent(id)}`, token, { method: 'PUT', body: JSON.stringify(patch) });
      setNote('Saved. Recorded as an override so the next sync will not revert it. Commit when you are done.');
      setDraft(null);
      await loadEvents();
      setSelectedEvent((old) => old && { ...old, ...patch });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const onRestoreEvent = async (id) => {
    setBusy(true); setError('');
    try {
      const r = await api(`/events/${encodeURIComponent(id)}/restore`, token, { method: 'POST' });
      setNote(r.note);
      await loadEvents();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  /* Commit. Rebuilds the snapshot and runs the audit BEFORE the commit, so a
     set of edits that breaks the data never reaches the deployed site — the
     same gate pipeline.mjs enforces. */
  const onPublishEvents = async () => {
    setBusy(true); setError('');
    try {
      const r = await api('/events/publish', token, { method: 'POST' });
      setNote(r.published ? `Committed: ${r.message}` : `Not committed (${r.stage}) — the vault still holds your edits. ${r.error || ''}`);
      await loadEvents();
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
    <nav style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.line}`, marginBottom: 16 }}>{[['queue', `Review queue (${pending})`], ['history', 'Decision history'], ['events', `Events (${summary?.events ?? '-'})`], ['operations', 'Operations']].map(([id, label]) => <button key={id} onClick={() => changeTab(id)} style={{ border: 'none', borderBottom: `2px solid ${tab === id ? C.copper : 'transparent'}`, background: 'transparent', color: tab === id ? C.copper : C.dim, padding: '10px 12px', cursor: 'pointer', fontSize: 12 }}>{label}</button>)}</nav>
    {error && <div style={{ border: `1px solid ${C.red}`, color: C.red, padding: 12, borderRadius: 7, marginBottom: 14, fontSize: 13 }}>{error}<div style={{ color: C.dim, marginTop: 5 }}>Local fix: run <code>npm run api:restart</code> in <code>server/</code>, with <code>ADMIN_TOKEN</code> set in <code>server/.env</code>. Public fix: host the API at an HTTPS URL, set GitHub Actions variable <code>VITE_API_BASE_URL</code>, then rebuild Pages.</div></div>}
    {tab === 'events' ? <EventsView {...{ events, eventSel, setEventSel, selectedEvent, setSelectedEvent, draft, setDraft, busy, note, sortBy, setSortBy, onPreview, preview, onDelete: onDeleteEvents, onRestore: onRestoreEvent, onSave: onSaveEvent, onPublish: onPublishEvents }} /> : tab === 'operations' ? <section style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}><div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 18 }}><h2 style={{ marginTop: 0, fontSize: 16 }}>Pipeline status</h2><p style={{ color: C.dim }}>Last run: <b style={{ color: C.text }}>{summary?.meta?.last_run_at || 'Not recorded'}</b></p><p style={{ color: C.dim }}>Status: <b style={{ color: summary?.meta?.last_run_status === 'ok' ? C.green : C.amber }}>{summary?.meta?.last_run_status || 'Unknown'}</b></p><p style={{ color: C.dim }}>Dataset date: <b style={{ color: C.text }}>{summary?.meta?.snapshot_date || 'Unknown'}</b></p>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Auto-publish</h2>
      <p style={{ color: C.dim, margin: '4px 0' }}>{summary?.autoPublish?.enabled ? <>On — a review batch publishes itself after <b style={{ color: C.text }}>{Math.round((summary.autoPublish.idleMs || 0) / 1000)}s</b> of no decisions, or as soon as the queue empties.</> : <>Off (<code>REVIEW_AUTOPUBLISH=off</code>) — publish manually.</>}</p>
      {summary?.autoPublish?.scheduledFor && <p style={{ color: C.amber, margin: '4px 0' }}>Next automatic publish: <b>{summary.autoPublish.scheduledFor}</b></p>}
      {summary?.autoPublish?.lastStatus && <p style={{ color: summary.autoPublish.lastStatus === 'published' ? C.green : C.red, margin: '4px 0' }}>Last attempt: {summary.autoPublish.lastStatus} · {summary.autoPublish.lastAt}{summary.autoPublish.lastError ? ` · ${String(summary.autoPublish.lastError).split('\n')[0]}` : ''}</p>}
      {summary?.meta?.last_autopublish_status && <p style={{ color: C.faint, margin: '4px 0', fontSize: 12 }}>Recorded: {summary.meta.last_autopublish_status}</p>}</div><div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 18 }}><h2 style={{ marginTop: 0, fontSize: 16 }}>Recent decisions</h2>{summary?.recentReviews?.length ? summary.recentReviews.map((r) => <div key={r.id} style={{ padding: '7px 0', borderBottom: `1px solid ${C.line}`, fontSize: 12 }}><b>{r.proposal?.title || r.id}</b><div style={{ color: r.status === 'approved' ? C.green : C.red }}>{r.status} · {r.reviewed_at || 'pending publication'}</div></div>) : <p style={{ color: C.dim }}>No reviewed candidates yet.</p>}</div></section> : <QueueView {...{ tab, list, triage, selected, setSelected, selectedIds, setSelectedIds, note, setNote, busy, decide, runTriage, bulkAct }} />}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
