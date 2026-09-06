import { useMemo, useState } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useWatchlist } from '../interaction/WatchlistContext.jsx';
import { resolveWatchlist, WATCH_TYPE_LABEL, WATCH_TYPES, routeId, MAX_WATCHED } from '../interaction/watchlist.js';
import { fmtSigned } from '../interaction/lensEncoding.js';
import { riskColor } from '../utils/colors.js';
import { onEnterSpace } from '../utils/a11y.js';
import Logo from './Logo.jsx';

/* ====================================================================
   Watchlist — 追蹤清單. What this reader is following, in one place.

   The dashboard's default view is the whole chain, which is the right
   default and the wrong daily view: a buyer cares about four suppliers,
   one product and the plant that makes it. This panel is that view.

   A row shows the target's headline reading and, separately, any active
   operational effect on it. The two are kept apart on purpose — a
   structurally fragile stage with nothing happening to it today is not the
   same as a robust one that is currently disrupted, and a single blended
   number would erase that distinction.

   Rows whose target has left the vault are shown struck through rather
   than dropped. A supplier disappearing from the dataset is precisely the
   event someone tracking it needs to see.
   ==================================================================== */

const TYPE_GLYPH = { company: '▣', stage: '◆', facility: '⌂', route: '⇄' };

export default function Watchlist({ model, setSel }) {
  const { data, engine } = useVault();
  const { items, toggle, remove, clearAll, full } = useWatchlist();
  const [adding, setAdding] = useState(null); // null | 'company' | 'stage' | 'facility' | 'route'
  const [query, setQuery] = useState('');
  const [routeFrom, setRouteFrom] = useState('');

  const rows = useMemo(
    () => resolveWatchlist(items, {
      COMPANY_BY_ID: data.COMPANY_BY_ID,
      STAGE_BY_ID: engine.STAGE_BY_ID,
      FACILITY_LAYER: data.FACILITY_LAYER,
      engine,
      model,
    }),
    [items, data, engine, model],
  );

  /* Candidates for the picker, filtered by the typed query. Capped because a
     244-plant list in a dropdown is not a chooser, it is a scroll. */
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (name) => !q || name.toLowerCase().includes(q);
    if (adding === 'company') {
      return data.COMPANIES.filter((c) => match(c.name)).slice(0, 40)
        .map((c) => ({ type: 'company', id: c.id, label: c.name }));
    }
    if (adding === 'stage') {
      return data.STAGES.filter((s) => match(s.name)).slice(0, 40)
        .map((s) => ({ type: 'stage', id: s.id, label: s.name }));
    }
    if (adding === 'facility') {
      return (data.FACILITIES || []).filter((f) => match(f.name)).slice(0, 40)
        .map((f) => ({ type: 'facility', id: f.id, label: f.name }));
    }
    if (adding === 'route') {
      // Two-step: pick the origin stage, then a stage it actually reaches.
      if (!routeFrom) {
        return data.STAGES.filter((s) => match(s.name)).slice(0, 40)
          .map((s) => ({ type: 'routeFrom', id: s.id, label: s.name }));
      }
      const reachable = (engine.OUT[routeFrom] || []);
      return data.STAGES.filter((s) => reachable.includes(s.id) && match(s.name))
        .map((s) => ({ type: 'route', id: routeId(routeFrom, s.id), label: `${engine.STAGE_BY_ID[routeFrom]?.name} → ${s.name}` }));
    }
    return [];
  }, [adding, query, routeFrom, data, engine]);

  const pick = (cand) => {
    if (cand.type === 'routeFrom') { setRouteFrom(cand.id); setQuery(''); return; }
    toggle({ type: cand.type, id: cand.id });
    setAdding(null); setQuery(''); setRouteFrom('');
  };

  const openRow = (row) => {
    if (row.missing) return;
    if (row.type === 'route') {
      const [from] = String(row.id).split('>');
      setSel({ type: 'stage', id: from });
      return;
    }
    setSel({ type: row.type, id: row.id });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
        <span className="mono" style={{ fontSize: 12, color: C.copper }}>
          ★ WATCHLIST · 追蹤清單
        </span>
        <span className="mono" style={{ fontSize: 12, color: C.faint }}>{items.length}/{MAX_WATCHED}</span>
        {items.length > 0 && (
          <button type="button" onClick={clearAll}
            style={{ marginLeft: 'auto', fontSize: 12, padding: '2px 8px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer', background: 'transparent', color: C.dim, border: `1px solid ${C.line}` }}>
            Clear all
          </button>
        )}
      </div>

      {/* --- add controls --- */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 7 }}>
        {WATCH_TYPES.map((tp) => {
          const on = adding === tp;
          return (
            <button key={tp} type="button" disabled={full && !on}
              onClick={() => { setAdding(on ? null : tp); setQuery(''); setRouteFrom(''); }}
              title={full ? `Watchlist is full (${MAX_WATCHED})` : `Track a ${WATCH_TYPE_LABEL[tp].toLowerCase()}`}
              style={{ fontSize: 12, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit',
                cursor: full && !on ? 'not-allowed' : 'pointer', opacity: full && !on ? 0.45 : 1,
                background: on ? C.copper : 'transparent', color: on ? C.onAccent : C.dim,
                border: `1px solid ${on ? C.copper : C.line}`, fontWeight: on ? 700 : 400 }}>
              ＋ {WATCH_TYPE_LABEL[tp]}
            </button>
          );
        })}
      </div>

      {adding && (
        <div style={{ border: `1px solid ${C.copperDim}`, borderRadius: 5, padding: 7, marginBottom: 8, background: C.panel }}>
          {adding === 'route' && routeFrom && (
            <div className="mono" style={{ fontSize: 12, color: C.copper, marginBottom: 4 }}>
              from {engine.STAGE_BY_ID[routeFrom]?.name} — now pick where it goes
              <button type="button" onClick={() => setRouteFrom('')}
                style={{ marginLeft: 6, background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer', font: 'inherit' }}>×</button>
            </div>
          )}
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
            placeholder={adding === 'route' && !routeFrom ? 'Search an origin stage…' : `Search ${WATCH_TYPE_LABEL[adding].toLowerCase()}…`}
            aria-label={`Search ${WATCH_TYPE_LABEL[adding]}`}
            style={{ width: '100%', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, fontFamily: 'inherit', fontSize: 12, padding: '4px 7px' }} />
          <ul style={{ listStyle: 'none', margin: '5px 0 0', padding: 0, maxHeight: 150, overflowY: 'auto', display: 'grid', gap: 2 }}>
            {candidates.length === 0 && (
              <li className="mono" style={{ fontSize: 12, color: C.faint, padding: '3px 2px' }}>
                {adding === 'route' && routeFrom ? 'This stage feeds nothing downstream in the graph.' : 'No match.'}
              </li>
            )}
            {candidates.map((cand) => (
              <li key={`${cand.type}:${cand.id}`}>
                <button type="button" onClick={() => pick(cand)}
                  style={{ width: '100%', textAlign: 'left', fontSize: 12, padding: '3px 7px', borderRadius: 3, fontFamily: 'inherit', cursor: 'pointer', background: 'transparent', color: C.text, border: `1px solid ${C.line}` }}>
                  {cand.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* --- the list --- */}
      {rows.length === 0 ? (
        <div className="mono" style={{ fontSize: 12, color: C.faint, lineHeight: 1.7 }}>
          Nothing tracked yet. Add the companies you buy from, the products you depend on, the plants that make them,
          or a route through the chain — and this panel becomes your daily view instead of the whole world.
          The list is kept in this browser only; it is never put in a shared link.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 }}>
          {rows.map((row) => (
            <li key={`${row.type}:${row.id}`}
              role="button" tabIndex={0}
              onClick={() => openRow(row)} onKeyDown={onEnterSpace(() => openRow(row))}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 4,
                border: `1px solid ${row.missing ? C.red : C.line}`, background: C.panel,
                cursor: row.missing ? 'default' : 'pointer', opacity: row.missing ? 0.65 : 1 }}>
              <span aria-hidden className="mono" style={{ fontSize: 12, color: C.copper, width: 12, flexShrink: 0 }}>{TYPE_GLYPH[row.type]}</span>
              {row.type === 'company' && <Logo cid={row.id} size={13} />}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: C.text, textDecoration: row.missing ? 'line-through' : 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.label}
                </span>
                <span className="mono" style={{ fontSize: 12, color: row.missing ? C.red : C.faint }}>{row.sublabel}</span>
              </span>
              {row.value != null && (
                <span className="mono" style={{ fontSize: 12, color: riskColor(row.value), width: 30, textAlign: 'right' }}>
                  {row.value.toFixed(1)}
                </span>
              )}
              <span className="mono" style={{ fontSize: 12, width: 46, textAlign: 'right',
                color: Math.abs(row.signed) < 0.02 ? C.faint : row.signed > 0 ? C.red : C.green }}>
                {Math.abs(row.signed) < 0.02 ? 'quiet' : fmtSigned(row.signed)}
              </span>
              <button type="button" aria-label={`Stop tracking ${row.label}`}
                onClick={(e) => { e.stopPropagation(); remove(row); }}
                style={{ background: 'transparent', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px', minHeight: 0 }}>×</button>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="mono" style={{ fontSize: 12, color: C.faint, marginTop: 6, lineHeight: 1.6 }}>
          Left figure is the standing structural reading (0–10); right figure is any active operational effect right now.
          A fragile thing with nothing happening to it is not the same as a robust thing currently disrupted, so the two
          are never blended.
        </div>
      )}
    </div>
  );
}
