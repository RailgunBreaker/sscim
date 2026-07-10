import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { LENSES, LENS_LABELS } from '../interaction/reducer.js';

/* Global analytical-lens control + focus breadcrumb, shared by the world
   map and industry graph (task §4 / §11). Sits directly under the scenario
   bar. The lens buttons drive both maps at once; Scenario Δ is disabled
   until a scenario is active. The breadcrumb shows what is pinned and
   offers Back / Clear — the cross-panel Clear and Back controls required
   by §3. */
function entityLabel(sel, { COUNTRY_NAMES, STAGE_BY_ID, COMPANY_BY_ID, EVENTS }, scenarioName) {
  if (!sel) return null;
  if (sel.type === 'scenario') return { kind: 'Scenario', name: scenarioName || 'Active scenario' };
  if (sel.type === 'country') return { kind: 'Country', name: COUNTRY_NAMES[sel.id] || sel.id };
  if (sel.type === 'stage') return { kind: 'Stage', name: STAGE_BY_ID[sel.id]?.name || sel.id };
  if (sel.type === 'company') return { kind: 'Company', name: COMPANY_BY_ID[sel.id]?.name || sel.id };
  if (sel.type === 'event') return { kind: 'Event', name: EVENTS.find((e) => e.id === sel.id)?.title || sel.id };
  return { kind: sel.type, name: sel.id };
}

export default function LensBar({ scenarioName }) {
  const { data, engine } = useVault();
  const { state, setLens, clear, back, lensAvailable, draftSet } = useInteraction();
  const { lens, selected, history, scenarioActive, draft } = state;
  const composing = draft.builderMode || draft.sources.length > 0;
  const names = { COUNTRY_NAMES: data.COUNTRY_NAMES, STAGE_BY_ID: engine.STAGE_BY_ID, COMPANY_BY_ID: data.COMPANY_BY_ID, EVENTS: data.EVENTS };
  const label = entityLabel(selected, names, scenarioName);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '6px 16px', background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
      <span className="mono" style={{ fontSize: 9, letterSpacing: 1.5, color: C.faint, flexShrink: 0 }}>LENS</span>
      <div role="radiogroup" aria-label="Analytical lens" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {LENSES.map((l) => {
          const on = lens === l;
          const avail = lensAvailable(l);
          return (
            <button key={l} type="button" role="radio" aria-checked={on} disabled={!avail}
              onClick={() => setLens(l)}
              title={!avail ? 'Scenario Δ is available only while a scenario is active' : `Show ${LENS_LABELS[l]}`}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 4, fontFamily: 'inherit', cursor: avail ? 'pointer' : 'not-allowed',
                background: on ? C.copper : 'transparent', color: on ? '#0C111C' : avail ? C.dim : C.faint,
                border: `1px solid ${on ? C.copper : C.line}`, fontWeight: on ? 700 : 400, opacity: avail ? 1 : 0.5,
              }}>
              {LENS_LABELS[l]}
            </button>
          );
        })}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {scenarioActive && (
          <span className="mono" style={{ fontSize: 9, letterSpacing: 1, color: '#0C111C', background: C.copper, borderRadius: 3, padding: '2px 7px', fontWeight: 700 }}>
            SCENARIO ACTIVE
          </span>
        )}
        {label ? (
          <span className="mono" style={{ fontSize: 10.5, color: C.dim }}>
            <span style={{ color: C.faint }}>Focused: </span>
            <span style={{ color: C.copper }}>{label.kind}</span> · {label.name}
          </span>
        ) : (
          <span className="mono" style={{ fontSize: 10.5, color: C.faint }}>Nothing pinned</span>
        )}
        <button type="button" onClick={() => draftSet({ builderMode: !draft.builderMode })}
          aria-pressed={composing} title="Compose a scenario by marking shock sources on the map/graph (shift-click)"
          style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
            background: composing ? 'rgba(201,138,63,.16)' : 'transparent', color: composing ? C.copper : C.dim,
            border: `1px solid ${composing ? C.copper : C.line}`, fontWeight: composing ? 700 : 400 }}>
          ＋ Compose{draft.sources.length ? ` (${draft.sources.length})` : ''}
        </button>
        <button type="button" onClick={back} disabled={!history.length} aria-label="Back to previous selection"
          style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', background: 'transparent', color: history.length ? C.dim : C.faint, border: `1px solid ${C.line}`, cursor: history.length ? 'pointer' : 'not-allowed', opacity: history.length ? 1 : 0.5 }}>
          ← Back
        </button>
        <button type="button" onClick={clear} disabled={!selected} aria-label="Clear selection"
          style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 4, fontFamily: 'inherit', background: 'transparent', color: selected ? C.dim : C.faint, border: `1px solid ${C.line}`, cursor: selected ? 'pointer' : 'not-allowed', opacity: selected ? 1 : 0.5 }}>
          Clear
        </button>
      </div>
    </div>
  );
}
