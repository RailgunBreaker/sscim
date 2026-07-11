import { C } from '../theme.js';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { DRAFT_DIRECTIONS } from '../interaction/reducer.js';
import { draftToScenario } from '../interaction/scenarioDraft.js';
import { flagEmoji } from '../data/glossary.js';

/* ====================================================================
   ScenarioComposer — build a scenario directly from the map/graph
   (task §10). Shift-click (or, with this bar's builder mode on, plain
   click) a stage on the industry graph or a country on the world map to
   mark it as a shock source; the marked sources show here as removable
   chips. Pick a direction + severity and Preview/Play — it hands the draft
   to draftToScenario() and runs it through the identical propagation
   engine every preset uses. Nothing is invented: a country source expands
   only to stages it already participates in, in the static snapshot.
   ==================================================================== */

const DIR_META = {
  adverse: { label: 'Adverse', color: C.red },
  mitigating: { label: 'Mitigating', color: C.green },
  neutral: { label: 'Neutral', color: C.faint },
};

export default function ScenarioComposer({ onBuild, onReset, activeIsCustom }) {
  const { data, engine } = useVault();
  const { STAGE_BY_ID } = engine;
  const { state, draftToggleSource, draftSet, draftClear } = useInteraction();
  const { draft } = state;
  const neutral = draft.direction === 'neutral';

  const chipLabel = (s) =>
    s.type === 'stage'
      ? (STAGE_BY_ID[s.id]?.name || s.id)
      : `${flagEmoji(s.id)} ${data.COUNTRY_NAMES[s.id] || s.id}`;

  const canBuild = draft.sources.length > 0;
  const built = canBuild ? draftToScenario(draft, { stageById: STAGE_BY_ID }) : null;

  const build = (play) => {
    if (!built) return;
    onBuild(built, { play });
  };

  return (
    <div role="group" aria-label="Scenario composer" className="cbar"
      style={{ padding: '8px 16px', background: C.panel, borderBottom: `1px solid ${C.line}`, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <span className="mono" style={{ fontSize: 9.5, letterSpacing: 1.2, color: C.copper }}>✎ COMPOSE</span>

      {/* Source chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', flex: '1 1 220px', minWidth: 180 }}>
        {draft.sources.length === 0 ? (
          <span className="mono" style={{ fontSize: 10, color: C.faint }}>
            {draft.builderMode ? 'Click' : 'Shift-click'} stages on the graph or countries on the map to add shock sources…
          </span>
        ) : (
          draft.sources.map((s) => (
            <span key={`${s.type}:${s.id}`} className="mono"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, padding: '2px 4px 2px 8px', borderRadius: 12, background: C.panel2, border: `1px solid ${C.copperDim}`, color: C.text }}>
              <span style={{ color: C.faint, fontSize: 8.5 }}>{s.type === 'stage' ? 'STAGE' : 'CTRY'}</span>
              {chipLabel(s)}
              <button type="button" aria-label={`Remove ${chipLabel(s)}`} onClick={() => draftToggleSource(s)}
                style={{ border: 'none', background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 2px' }}>×</button>
            </span>
          ))
        )}
      </div>

      {/* Direction */}
      <div role="radiogroup" aria-label="Shock direction" style={{ display: 'flex', gap: 3 }}>
        {DRAFT_DIRECTIONS.map((d) => {
          const on = draft.direction === d;
          return (
            <button key={d} type="button" role="radio" aria-checked={on} onClick={() => draftSet({ direction: d })}
              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer',
                background: on ? DIR_META[d].color : 'transparent', color: on ? '#0C111C' : C.dim,
                border: `1px solid ${on ? DIR_META[d].color : C.line}`, fontWeight: on ? 700 : 400 }}>
              {DIR_META[d].label}
            </button>
          );
        })}
      </div>

      {/* Severity */}
      <label className="mono" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: neutral ? C.faint : C.dim, opacity: neutral ? 0.5 : 1 }}>
        SEV <b style={{ color: neutral ? C.faint : C.copper, fontSize: 12 }}>{neutral ? 0 : draft.severity}</b>
        <input type="range" min="1" max="10" value={draft.severity} disabled={neutral}
          onChange={(e) => draftSet({ severity: +e.target.value })}
          aria-label="Severity" style={{ width: 90, accentColor: C.copper }} />
      </label>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5 }}>
        <button type="button" onClick={() => build(false)} disabled={!canBuild}
          title="Run this draft through the engine and show its Δ"
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, fontFamily: 'inherit', cursor: canBuild ? 'pointer' : 'not-allowed',
            background: canBuild ? C.copper : 'transparent', color: canBuild ? '#0C111C' : C.faint, border: `1px solid ${canBuild ? C.copper : C.line}`, fontWeight: 700, opacity: canBuild ? 1 : 0.5 }}>
          Preview Δ
        </button>
        <button type="button" onClick={() => build(true)} disabled={!canBuild || neutral}
          title={neutral ? 'A neutral shock has nothing to play' : 'Build and play the propagation'}
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, fontFamily: 'inherit', cursor: (canBuild && !neutral) ? 'pointer' : 'not-allowed',
            background: 'transparent', color: (canBuild && !neutral) ? C.copper : C.faint, border: `1px solid ${(canBuild && !neutral) ? C.copper : C.line}`, opacity: (canBuild && !neutral) ? 1 : 0.5 }}>
          ▶ Build &amp; Play
        </button>
        <button type="button" onClick={draftClear} disabled={!draft.sources.length}
          style={{ fontSize: 11, padding: '5px 10px', borderRadius: 4, fontFamily: 'inherit', cursor: draft.sources.length ? 'pointer' : 'not-allowed', background: 'transparent', color: C.dim, border: `1px solid ${C.line}`, opacity: draft.sources.length ? 1 : 0.5 }}>
          Clear
        </button>
        {activeIsCustom && (
          <button type="button" onClick={onReset}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 4, fontFamily: 'inherit', cursor: 'pointer', background: 'transparent', color: C.dim, border: `1px solid ${C.line}` }}>
            Reset scenario
          </button>
        )}
      </div>

      {built && (
        <div className="mono" style={{ flexBasis: '100%', fontSize: 9, color: C.faint, lineHeight: 1.5 }}>
          {built.desc}
        </div>
      )}
    </div>
  );
}
