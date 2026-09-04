import { useMemo, useState } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { getEventAssumption, publicClassificationNote } from '../engine/event-assumptions.js';
import { TYPE_COLORS } from '../utils/colors.js';
import { onEnterSpace } from '../utils/a11y.js';
import {
  EMPTY_EVENT_FILTERS, eventFiltersActive, filterEvents, sortEventsChronologically,
} from '../engine/eventSelection.js';
import IndexHistory from './IndexHistory.jsx';

/* ====================================================================
   EventFeed — the Events tab of the intelligence panel.

   TWO PROBLEMS IT FIXES.

   1. The feed rendered all 167 events into a 420px-tall scroller with no
      count and no controls, so the panel read as "a handful of events and
      then nothing" while 150 more sat below an internal scrollbar the
      reader had no reason to suspect. It now states how many match, pages
      the list rather than dumping it, and says explicitly when there are
      more below.

   2. Every card exposed `assumption.reason` in a tooltip. Eight of those
      reasons were internal review-workflow strings — "Published: Review:
      reject cand_webz_news_04f59e…" — putting internal candidate ids and
      approval commands on a public page. The public surface now reads
      publicClassificationNote(), which returns the classification
      explanation and never the audit trail; see event-assumptions.js.

   Sorting stays chronological, newest first, at every filter setting.
   ==================================================================== */

const PAGE = 25;

export default function EventFeed({ sel, setSel, engine, events }) {
  const { data } = useVault();
  const { EVENTS } = data;
  const { eventField, operationalIndex, toDisplayIndex } = engine;
  const list = events || EVENTS;

  const [filters, setFilters] = useState(EMPTY_EVENT_FILTERS);
  const [limit, setLimit] = useState(PAGE);
  const patch = (p) => { setFilters((f) => ({ ...f, ...p })); setLimit(PAGE); };

  const types = useMemo(
    () => [...new Set(list.map((e) => e.type).filter(Boolean))].sort(),
    [list],
  );

  const matches = useMemo(
    () => sortEventsChronologically(filterEvents(list, filters, { assumptionOf: (e) => getEventAssumption(e.id) })),
    [list, filters],
  );

  const active = eventFiltersActive(filters);
  const visible = matches.slice(0, limit);
  const remaining = matches.length - visible.length;

  return (
    <>
      <IndexHistory engine={engine} events={list} onSelectEvent={(id) => setSel({ type: 'event', id })} />

      {/* ---- search and filters ---- */}
      <div style={{ display: 'grid', gap: 6, margin: '10px 0 8px' }}>
        <input type="search" value={filters.query} onChange={(e) => patch({ query: e.target.value })}
          placeholder="Search events — title, summary, stage, country…" aria-label="Search events"
          style={{ width: '100%', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text, fontFamily: 'inherit', fontSize: 12, padding: '6px 9px' }} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={selWrap}>
            <span className="mono" style={selLabel}>Type</span>
            <select value={filters.type} onChange={(e) => patch({ type: e.target.value })} style={selectStyle} aria-label="Filter by event type">
              <option value="all">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={selWrap}>
            <span className="mono" style={selLabel}>Scoring</span>
            <select value={filters.scored} onChange={(e) => patch({ scored: e.target.value })} style={selectStyle} aria-label="Filter by whether the event is scored">
              <option value="all">Scored and excluded</option>
              <option value="scored">Scored only</option>
              <option value="excluded">Excluded from score only</option>
            </select>
          </label>
          <label style={selWrap}>
            <span className="mono" style={selLabel}>Direction</span>
            <select value={filters.direction} onChange={(e) => patch({ direction: e.target.value })} style={selectStyle} aria-label="Filter by direction">
              <option value="all">Any direction</option>
              <option value="adverse">Adverse</option>
              <option value="mitigating">Mitigating</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
          <label style={selWrap}>
            <span className="mono" style={selLabel}>Date range</span>
            <select value={filters.within} onChange={(e) => patch({ within: e.target.value })} style={selectStyle} aria-label="Filter by date range">
              <option value="all">All dates</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </label>
          {active && (
            <button type="button" onClick={() => { setFilters(EMPTY_EVENT_FILTERS); setLimit(PAGE); }} style={chipStyle}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="mono" aria-live="polite" style={{ fontSize: 12, color: C.copper, marginBottom: 8, fontWeight: 600 }}>
        {matches.length} matching event{matches.length === 1 ? '' : 's'}
        {active ? ` of ${list.length}` : ''}
        {remaining > 0 ? ` · showing the ${visible.length} most recent` : ''}
        <span style={{ color: C.faint, fontWeight: 400 }}> · newest first</span>
      </div>

      <div className="mono" style={{ fontSize: 12, color: C.faint, marginBottom: 8, lineHeight: 1.5 }}>
        &quot;index&quot; = this event&apos;s own operational-impact display index (0–10, 5 = neutral, &gt;5 net adverse,
        &lt;5 net mitigating) — propagated through the graph alone, not combined with other events.{' '}
        <span style={{ color: C.faint }}>&quot;excluded from score&quot; = a hazard-signal/mixed/strategic event, shown
        but not scored — see its card for why.</span>
      </div>

      {matches.length === 0 && (
        <div className="mono" style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, padding: '10px 0' }}>
          No event matches these filters. {list.length} events are in the current snapshot — clear the filters to see them.
        </div>
      )}

      {visible.map((e) => {
        const isActive = sel.type === 'event' && sel.id === e.id;
        const assumption = getEventAssumption(e.id);
        const ownIndex = toDisplayIndex(operationalIndex(eventField(e).field));
        return (
          <div key={e.id} className="evcard" onClick={() => setSel({ type: 'event', id: e.id })}
            role="button" tabIndex={0} onKeyDown={onEnterSpace(() => setSel({ type: 'event', id: e.id }))}
            aria-label={`${e.type} event, ${e.date}: ${e.title}`}
            style={{ border: `1px solid ${isActive ? C.copper : C.line}`, background: isActive ? '#1A2132' : C.panel, borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="mono" style={{ fontSize: 12, color: TYPE_COLORS[e.type] || C.copper, border: `1px solid ${TYPE_COLORS[e.type] || C.copper}`, borderRadius: 3, padding: '1px 6px' }}>
                {e.type.toUpperCase()}
              </span>
              <span className="mono" style={{ fontSize: 12, color: C.faint }}>{e.date}</span>
              {/* The tooltip is publicClassificationNote(), never assumption.reason:
                  the raw field can hold internal review-workflow text. */}
              <span className="mono" style={{ fontSize: 12, color: assumption.operational ? C.copper : C.faint, marginLeft: 'auto' }}
                title={assumption.operational
                  ? 'Operational-impact display index for this event alone: 0–10, 5=neutral, above 5=net adverse, below 5=net mitigating.'
                  : publicClassificationNote(e.id)}>
                {assumption.operational ? `index ${ownIndex.toFixed(2)} / 10` : 'excluded from score'}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 5, lineHeight: 1.35 }}>{e.title}</div>
          </div>
        );
      })}

      {remaining > 0 && (
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0 10px' }}>
          <button type="button" onClick={() => setLimit((l) => l + PAGE)} style={{ ...chipStyle, borderColor: C.copper, color: C.copper }}>
            Show {Math.min(PAGE, remaining)} more
          </button>
          <button type="button" onClick={() => setLimit(matches.length)} style={chipStyle}>
            Show all {matches.length}
          </button>
          <span className="mono" style={{ fontSize: 12, color: C.amber }}>
            {remaining} older event{remaining === 1 ? '' : 's'} not shown yet
          </span>
        </div>
      )}
      {remaining === 0 && matches.length > PAGE && (
        <div className="mono" style={{ fontSize: 12, color: C.faint, padding: '4px 0 10px' }}>
          End of the feed — all {matches.length} matching events are listed above.
        </div>
      )}
    </>
  );
}

const chipStyle = {
  fontSize: 12, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
  background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, minHeight: 0,
};
const selectStyle = {
  background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4, color: C.text,
  fontFamily: 'inherit', fontSize: 12, padding: '4px 6px', maxWidth: '100%',
};
const selWrap = { display: 'grid', gap: 2, minWidth: 0 };
const selLabel = { fontSize: 12, color: C.faint };
