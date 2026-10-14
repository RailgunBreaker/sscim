import { useMemo } from 'react';
import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { mapEncoding } from '../interaction/lensEncoding.js';
import { flagEmoji } from '../data/glossary.js';
import { onEnterSpace } from '../utils/a11y.js';

/* Keyboard-accessible, screen-reader-friendly alternative to clicking
   Leaflet markers (task §5 accessibility). It is synchronized with the
   map: it reflects the active lens value per country, marks the pinned
   country, and selecting a row selects the country everywhere (which also
   flies the map to it). Leaflet's own markers remain mouse-first; this
   list is the reliable non-mouse path. */
export default function CountryList({ model }) {
  const { data, engine } = useVault();
  const { COUNTRY_NAMES } = data;
  const { state, setSel } = useInteraction();
  const { lens, selected } = state;

  const rows = useMemo(() => {
    const { enc } = mapEncoding({ lens, model, engine, data, selected });
    return Object.keys(model.countriesActive)
      .map((id) => ({ id, name: COUNTRY_NAMES[id] || id, e: enc[id] }))
      // sort by the current lens magnitude so the list ranks like the map
      .sort((a, b) => Math.abs(b.e?.value ?? 0) - Math.abs(a.e?.value ?? 0));
  }, [lens, model, selected, engine, data, COUNTRY_NAMES]);

  /* Sixteen bordered rectangles in a grid, each carrying a full 1px border
     whether or not it was selected, read as sixteen buttons — and a reader
     scanning for the highest score had to find it among sixteen equally
     loud boxes. A border now means SELECTED and nothing else; the rest is a
     plain ranked list separated by hairlines, which is what it is. */
  return (
    <div style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 2px' }}>Countries by exposure</h3>
      <p style={{ fontSize: 12, color: C.faint, margin: '0 0 6px' }}>
        Ranked on the metric currently shaded. A keyboard-reachable alternative to the map markers.
      </p>
      <ul role="listbox" aria-label="Countries by exposure" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 168, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 0 }}>
        {rows.map(({ id, name, e }) => {
          const on = selected?.type === 'country' && selected.id === id;
          return (
            <li key={id} role="option" aria-selected={on} tabIndex={0}
              className="row-interactive"
              onClick={() => setSel({ type: 'country', id })}
              onKeyDown={onEnterSpace(() => setSel({ type: 'country', id }))}
              aria-label={`${name}: ${e?.aria || ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, borderRadius: 4,
                padding: '6px 8px', fontSize: 13,
                /* Depth by background, structure by a hairline, border only
                   for selection. */
                border: on ? `1px solid ${C.copper}` : '1px solid transparent',
                borderBottom: on ? `1px solid ${C.copper}` : `1px solid ${C.line}`,
                background: on ? 'rgba(201,138,63,.12)' : 'transparent',
                color: C.text,
              }}>
              <span aria-hidden style={{ fontSize: 14 }}>{flagEmoji(id)}</span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              {e?.badge && <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: e.color }}>{e.badge}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
