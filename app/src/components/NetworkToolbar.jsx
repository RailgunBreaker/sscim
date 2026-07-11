import { C } from '../theme.js';
import { useInteraction } from '../interaction/InteractionContext.jsx';

/* ================= Network playground toolbar (§13/§26/§32) ================
   The reversible-action hub for the functional-centre network: temporarily
   remove the selected centre or connection (hypothetical node/edge-removal
   sensitivity), undo/redo those changes, reset to the untouched baseline,
   and manage the multi-selection. Every action here is reversible and never
   mutates the immutable base graph or the snapshot. */

function btn(disabled, primary) {
  return {
    fontSize: 10.5, padding: '4px 9px', borderRadius: 4, fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
    background: primary ? 'rgba(201,138,63,.16)' : 'transparent',
    color: primary ? C.copper : C.dim, border: `1px solid ${primary ? C.copper : C.line}`,
  };
}

export default function NetworkToolbar() {
  const { state, pgToggleNode, pgToggleEdge, pgUndo, pgRedo, pgReset, pgClearMulti } = useInteraction();
  const { selected, playground: pg } = state;

  const modified = pg.removedNodeIds.length + pg.removedEdgeIds.length;
  const selIsCentre = selected?.type === 'centre';
  const selIsEdge = selected?.type === 'edge';
  const centreRemoved = selIsCentre && pg.removedNodeIds.includes(selected.id);
  const edgeRemoved = selIsEdge && pg.removedEdgeIds.includes(selected.id);

  return (
    <div className="cbar" role="toolbar" aria-label="Network playground tools"
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '7px 16px', background: C.panel, borderBottom: `1px solid ${C.line}` }}>
      <span className="mono" style={{ fontSize: 9.5, letterSpacing: 1.2, color: C.copper }}>⚙ NETWORK TOOLS</span>

      {selIsCentre && (
        <button type="button" onClick={() => pgToggleNode(selected.id)} style={btn(false, !centreRemoved)}
          title="Temporarily remove this functional centre from the analysis graph (hypothetical removal)">
          {centreRemoved ? '↺ Restore centre' : '✕ Remove centre'}
        </button>
      )}
      {selIsEdge && (
        <button type="button" onClick={() => pgToggleEdge(selected.id)} style={btn(false, !edgeRemoved)}
          title="Temporarily remove this connection from the analysis graph">
          {edgeRemoved ? '↺ Restore connection' : '✕ Remove connection'}
        </button>
      )}
      {!selIsCentre && !selIsEdge && (
        <span className="mono" style={{ fontSize: 10, color: C.faint }}>select a centre or connection to remove it…</span>
      )}

      <span style={{ width: 1, alignSelf: 'stretch', background: C.line }} aria-hidden="true" />

      <button type="button" onClick={pgUndo} disabled={!pg.past.length} style={btn(!pg.past.length)} aria-label="Undo">↶ Undo</button>
      <button type="button" onClick={pgRedo} disabled={!pg.future.length} style={btn(!pg.future.length)} aria-label="Redo">↷ Redo</button>
      <button type="button" onClick={pgReset} disabled={!modified} style={btn(!modified)} aria-label="Reset network to baseline">⟲ Reset to baseline</button>

      {modified > 0 && (
        <span className="mono" style={{ fontSize: 9.5, color: C.amber, border: `1px solid ${C.copperDim}`, borderRadius: 3, padding: '2px 8px' }}>
          PLAYGROUND MODIFIED · {modified} temporary change{modified === 1 ? '' : 's'} · baseline available
        </span>
      )}

      {pg.multi.length > 0 && (
        <span className="mono" style={{ fontSize: 9.5, color: C.dim, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {pg.multi.length} centre{pg.multi.length === 1 ? '' : 's'} multi-selected
          <button type="button" onClick={pgClearMulti} style={btn(false)}>Clear</button>
        </span>
      )}
    </div>
  );
}
