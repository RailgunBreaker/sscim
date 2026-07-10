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

  return (
    <div style={{ marginTop: 8 }}>
      <div className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.faint, marginBottom: 4 }}>
        COUNTRIES · KEYBOARD LIST (alternative to the map)
      </div>
      <ul role="listbox" aria-label="Countries" style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 132, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 3 }}>
        {rows.map(({ id, name, e }) => {
          const on = selected?.type === 'country' && selected.id === id;
          return (
            <li key={id} role="option" aria-selected={on} tabIndex={0}
              onClick={() => setSel({ type: 'country', id })}
              onKeyDown={onEnterSpace(() => setSel({ type: 'country', id }))}
              aria-label={`${name}: ${e?.aria || ''}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderRadius: 4,
                padding: '3px 7px', fontSize: 11, border: `1px solid ${on ? C.copper : C.line}`,
                background: on ? '#1A2132' : C.panel, color: C.text,
              }}>
              <span aria-hidden style={{ fontSize: 12 }}>{flagEmoji(id)}</span>
              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              {e?.badge && <span className="mono" style={{ fontSize: 9.5, color: e.color }}>{e.badge}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
