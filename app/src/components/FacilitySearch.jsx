import { useMemo, useState, useId } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { flagEmoji } from '../data/glossary.js';
import { FACILITY_KIND_LABEL } from '../utils/facilityIcon.js';
import { searchFacilities } from '../engine/facilityTraversal.js';
import { facilityConnectivity } from '../engine/facilityNetwork.js';

/* ====================================================================
   FacilitySearch — the way into the playground.

   Searches name, operator, city, country, semiconductor stage and
   facility type. There is no `city` column in the facility table: the
   city lives inside the name ("Analog Devices — Beaverton, Oregon"), so
   the city term matches there rather than against an invented field. See
   engine/facilityTraversal.js#facilitySearchText.

   It deliberately does NOT list all 275 plants on arrival. A wall of 275
   rows is not a starting state, it is a data dump — the reader has to
   already know which plant they want to get anything from it. What they
   get instead is a search field, a sentence saying what the network
   actually represents, and a handful of suggestions drawn from the
   current data (the most-connected plants in this snapshot), which give
   the traversal something to demonstrate itself on.
   ==================================================================== */

export default function FacilitySearch({ onPick, suggestionCount = 8, autoFocus = false, label = 'Search a facility' }) {
  const { data, engine } = useVault();
  const { FACILITY_LAYER, FACILITY_NETWORK, COMPANY_BY_ID, COUNTRY_NAMES } = data;
  const { STAGE_BY_ID } = engine;
  const [query, setQuery] = useState('');
  const listId = useId();

  const ctx = useMemo(
    () => ({ COMPANY_BY_ID, COUNTRY_NAMES, STAGE_BY_ID, KIND_LABELS: FACILITY_KIND_LABEL }),
    [COMPANY_BY_ID, COUNTRY_NAMES, STAGE_BY_ID],
  );

  const matches = useMemo(
    () => searchFacilities(FACILITY_LAYER.FACILITIES, query, ctx, 20),
    [FACILITY_LAYER, query, ctx],
  );

  /* Suggestions come from the data, not a hand-written list, so they can
     never drift out of sync with the snapshot. Most-connected first:
     those are the plants where a one-hop traversal shows something. */
  const suggestions = useMemo(() => [...FACILITY_LAYER.FACILITIES]
    .map((f) => ({ f, c: facilityConnectivity(FACILITY_NETWORK, f.id) }))
    .filter((x) => x.c.degree > 0)
    .sort((a, b) => b.c.degree - a.c.degree || a.f.name.localeCompare(b.f.name))
    .slice(0, suggestionCount), [FACILITY_LAYER, FACILITY_NETWORK, suggestionCount]);

  const rowFor = (f, right) => (
    <li key={f.id}>
      <button type="button" onClick={() => onPick?.(f.id)} style={rowButtonStyle}>
        <span aria-hidden style={{ fontSize: 11 }}>{flagEmoji(f.country)}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 11.5, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.name}
          </span>
          <span className="mono" style={{ fontSize: 9, color: C.faint }}>
            {COMPANY_BY_ID[f.company]?.name || f.company}
            {' · '}{FACILITY_KIND_LABEL[f.kind] || f.kind}
            {' · '}{COUNTRY_NAMES[f.country] || f.country}
            {(f.stages || []).length ? ` · ${(f.stages || []).map((s) => STAGE_BY_ID[s]?.name || s).join(', ')}` : ''}
          </span>
        </span>
        {right}
      </button>
    </li>
  );

  return (
    <div>
      <label htmlFor={listId} className="mono" style={{ display: 'block', fontSize: 9, letterSpacing: 1.2, color: C.faint, marginBottom: 4 }}>
        {label.toUpperCase()} — NAME, OPERATOR, CITY, COUNTRY, STAGE OR TYPE
      </label>
      <input id={listId} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        placeholder="e.g. ASML, Kumamoto, lithography, Taiwan, packaging…"
        style={inputStyle} />

      {query.trim() && (
        <div className="mono" aria-live="polite" style={{ fontSize: 9.5, color: C.faint, margin: '6px 0 4px' }}>
          {matches.length === 0
            ? `No facility in this snapshot matches “${query.trim()}”.`
            : `${matches.length} match${matches.length === 1 ? '' : 'es'}${matches.length === 20 ? ' (showing the first 20 — narrow the search)' : ''}.`}
        </div>
      )}

      {matches.length > 0 && (
        <ul style={listStyle}>
          {matches.map((f) => rowFor(f, (
            <span className="mono" style={{ fontSize: 9, color: C.copper, whiteSpace: 'nowrap' }}>
              {facilityConnectivity(FACILITY_NETWORK, f.id).degree} links
            </span>
          )))}
        </ul>
      )}

      {!query.trim() && suggestions.length > 0 && (
        <>
          <div className="mono" style={{ fontSize: 9, letterSpacing: 1.2, color: C.faint, margin: '12px 0 5px' }}>
            OR START FROM ONE OF THE MOST CONNECTED PLANTS IN THIS SNAPSHOT
          </div>
          <ul style={listStyle}>
            {suggestions.map(({ f, c }) => rowFor(f, (
              <span className="mono" style={{ fontSize: 9, color: C.copper, whiteSpace: 'nowrap' }}>{c.degree} links</span>
            )))}
          </ul>
        </>
      )}
    </div>
  );
}

const listStyle = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 3 };
const rowButtonStyle = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4,
  padding: '6px 9px', fontFamily: 'inherit', fontSize: 11.5, color: C.text, cursor: 'pointer', minHeight: 0,
};
const inputStyle = {
  width: '100%', background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 4,
  color: C.text, fontFamily: 'inherit', fontSize: 12.5, padding: '7px 10px',
};
