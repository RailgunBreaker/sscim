import { useState, useMemo, useEffect } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { briefingText } from './briefingText.js';
import { useModalA11y } from './useModalA11y.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

/* The briefing, live and archived.

   "Today" is generated in the browser from current model state, so it reacts
   to the active scenario immediately. Past days are read from the archive the
   pipeline writes on each run (server/scripts/archive-briefing.mjs), which
   uses this same briefingText() — so a historical entry is the real briefing
   from that date, not a reconstruction.

   Where a body comes from, in order: the recent bodies bundled into the
   snapshot, then the API. That ordering is what lets the static deploy open
   recent history with no backend, while a reachable backend (the PC) serves
   the full archive. A scenario is never archived — it is a hypothesis the
   reader is driving, not something that happened on a date. */
export default function Briefing({ onClose, model, scenario }) {
  const { data, engine } = useVault();
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState('today');
  const [archived, setArchived] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const live = useMemo(() => briefingText(model, scenario, data, engine), [model, scenario, data, engine]);

  const archive = data.BRIEFINGS || [];
  const bodies = data.BRIEFING_BODIES || {};

  useEffect(() => {
    if (selected === 'today') { setArchived(null); setLoadError(''); return undefined; }
    const bundled = bodies[selected];
    if (bundled) { setArchived(bundled); setLoadError(''); return undefined; }
    let cancelled = false;
    setLoading(true); setLoadError('');
    fetch(`${API_BASE}/api/briefings/${encodeURIComponent(selected)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((payload) => { if (!cancelled) setArchived(payload.body); })
      .catch(() => {
        if (cancelled) return;
        setArchived(null);
        setLoadError('This briefing is older than the copies bundled with the site. Start the local backend to read the full archive.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const showingArchive = selected !== 'today';
  const text = showingArchive ? (archived ?? '') : live;
  const entry = showingArchive ? archive.find((b) => b.dateISO === selected) : null;

  const copy = () => {
    try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  };
  const { ref, onKeyDown } = useModalA11y(onClose);

  const btn = (primary) => ({
    background: primary ? C.copper : 'transparent', color: primary ? '#0C111C' : C.copper,
    border: `1px solid ${C.copper}`, borderRadius: 4, padding: '4px 12px', cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: primary ? 700 : 400, fontSize: 12,
  });

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label="GP News daily briefing" onKeyDown={onKeyDown} style={{ position: "fixed", inset: 0, background: "rgba(6,9,16,.85)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{ background: C.panel2, border: `1px solid ${C.copper}`, borderRadius: 8, maxWidth: 680, width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: "16px 18px", color: C.text, outline: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>GP News — {showingArchive ? 'Archived Briefing' : 'Daily Briefing'}</h3>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={copy} disabled={!text} style={{ ...btn(true), opacity: text ? 1 : .45 }}>{copied ? "Copied ✓" : "Copy"}</button>
            <button disabled={!text} onClick={() => { const b = new Blob([text], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `gp-briefing-${showingArchive ? selected : 'today'}.txt`; a.click(); URL.revokeObjectURL(a.href); }}
              style={{ ...btn(false), opacity: text ? 1 : .45 }}>Download .txt</button>
            <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.dim, borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>Close</button>
          </div>
        </div>

        {archive.length > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <label className="mono" style={{ fontSize: 9.5, color: C.faint, letterSpacing: 1 }} htmlFor="briefing-date">ARCHIVE</label>
            <select
              id="briefing-date"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}`, borderRadius: 4, padding: '4px 8px', fontFamily: 'inherit', fontSize: 11.5, maxWidth: '100%' }}
            >
              <option value="today">Today — live model state{scenario?.event ? ' (scenario active)' : ''}</option>
              {archive.map((b) => (
                <option key={b.dateISO} value={b.dateISO}>
                  {b.dateISO} · index {b.chainIndex != null ? b.chainIndex.toFixed(2) : '—'}
                </option>
              ))}
            </select>
            {showingArchive && (
              <button onClick={() => setSelected('today')} style={{ background: 'transparent', border: 'none', color: C.copper, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, textDecoration: 'underline' }}>
                back to today
              </button>
            )}
          </div>
        )}

        {entry && (
          <div className="mono" style={{ fontSize: 10, color: C.dim, border: `1px solid ${C.line}`, background: C.panel, borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
            <span style={{ color: C.copper }}>{entry.dateISO}</span> · chain index {entry.chainIndex?.toFixed(2)} · {entry.eventCount} events
            <div style={{ color: C.faint, marginTop: 3 }}>{entry.headline}</div>
          </div>
        )}

        {loading && <p className="mono" style={{ fontSize: 11, color: C.dim }}>Loading archived briefing…</p>}
        {loadError && <p className="mono" style={{ fontSize: 11, color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 6, padding: '8px 10px' }}>{loadError}</p>}

        {text && (
          <pre className="mono" style={{ margin: 0, overflowY: "auto", fontSize: 11, lineHeight: 1.65, color: C.text, whiteSpace: "pre-wrap", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "12px 14px" }}>{text}</pre>
        )}

        <div className="mono" style={{ fontSize: 9.5, color: C.faint, marginTop: 8 }}>
          {showingArchive
            ? 'Archived exactly as generated on that date — scenarios are never archived, only the baseline record.'
            : 'Sensitivity/comparison analysis — not a calibrated forecast. Switch scenarios and regenerate to see the scenario delta ranking.'}
        </div>
      </div>
    </div>
  );
}
