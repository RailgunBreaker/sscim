import { useState, useEffect } from 'react';
import { color, space, font, radius, typeStyle } from '../ui/tokens.js';
import { SegmentedControl, Button, StatusBadge } from '../ui/primitives.jsx';
import { useVault } from '../data/VaultContext.jsx';
import { useInteraction } from '../interaction/InteractionContext.jsx';
import { LENSES, LENS_LABELS, VIEW_MODES } from '../interaction/reducer.js';

/* WHAT THIS BAR USED TO BE. One row holding two radiogroups of identical
   appearance — VIEW (Geographic / Topology / Split / ⇄ Facility Playground)
   and LENS (Structural / Operational / Hazard Δ / Selected share) — plus a
   focus breadcrumb and two history buttons, all at 9 to 11px with 1.5px of
   letter-spacing on the group labels. Two different KINDS of choice, drawn
   the same way, are read as one list of eight peers.

   They are not peers. The first picks WHICH WORKSPACE you are in; the
   second picks WHICH MEASUREMENT is shaded within it. So the workspace
   choice is now primary and named for the task ("Map", "Network",
   "Facilities"), and the lens is a secondary control that reads as
   subordinate to it.

   Split view is not removed. It is a modifier on the two graph workspaces —
   "show the other one alongside" — which is what it actually is, rather
   than a fourth peer competing with them. */

const WORKSPACES = [
  { value: 'geographic', label: 'Map', title: 'World map of facilities and country exposure' },
  { value: 'topology', label: 'Network', title: 'Functional-centre network graph' },
  { value: 'playground', label: 'Facilities', title: 'Trace the modeled network around one plant. Modeled relationships, not shipments.' },
];

/* Which workspace a split view belongs to. Split shows both graphs, so the
   primary control marks whichever single view the reader last chose. */
const primaryFor = (viewMode, lastSingle) => (viewMode === 'split' ? lastSingle : viewMode);

function entityLabel(sel, { COUNTRY_NAMES, STAGE_BY_ID, COMPANY_BY_ID, EVENTS }, scenarioName) {
  if (!sel) return null;
  if (sel.type === 'scenario') return { kind: 'Scenario', name: scenarioName || 'Active scenario' };
  if (sel.type === 'centre') {
    const [cid, sid] = String(sel.id).split('::');
    return { kind: 'Centre', name: `${COUNTRY_NAMES[cid] || cid} · ${STAGE_BY_ID[sid]?.name || sid}` };
  }
  if (sel.type === 'country') return { kind: 'Country', name: COUNTRY_NAMES[sel.id] || sel.id };
  if (sel.type === 'stage') return { kind: 'Stage', name: STAGE_BY_ID[sel.id]?.name || sel.id };
  if (sel.type === 'company') return { kind: 'Company', name: COMPANY_BY_ID[sel.id]?.name || sel.id };
  if (sel.type === 'event') return { kind: 'Event', name: EVENTS.find((e) => e.id === sel.id)?.title || sel.id };
  return { kind: sel.type, name: sel.id };
}

export default function LensBar({ scenarioName }) {
  const { data, engine } = useVault();
  const { state, setLens, clear, back, lensAvailable, setViewMode } = useInteraction();
  const { lens, selected, history, scenarioActive, viewMode } = state;
  const [lastSingle, setLastSingle] = useState(viewMode === 'split' ? 'geographic' : viewMode);

  useEffect(() => {
    if (viewMode !== 'split' && VIEW_MODES.includes(viewMode)) setLastSingle(viewMode);
  }, [viewMode]);

  const names = {
    COUNTRY_NAMES: data.COUNTRY_NAMES, STAGE_BY_ID: engine.STAGE_BY_ID,
    COMPANY_BY_ID: data.COMPANY_BY_ID, EVENTS: data.EVENTS,
  };
  const label = entityLabel(selected, names, scenarioName);
  const workspace = primaryFor(viewMode, lastSingle);
  const isGraphWorkspace = workspace === 'geographic' || workspace === 'topology';
  const splitOn = viewMode === 'split';

  /* Only the lens applies to every workspace; the split modifier applies to
     the two graph workspaces. Facilities has its own controls, which live
     with the graph rather than in the chrome. */
  return (
    <nav
      className="cbar"
      aria-label="Workspace"
      style={{
        display: 'flex', alignItems: 'center', gap: space.md, flexWrap: 'wrap',
        padding: `${space.sm}px ${space.lg}px`,
        background: color.surface.sunken,
        borderBottom: `1px solid ${color.border.default}`,
      }}
    >
      <SegmentedControl
        label="Workspace"
        options={WORKSPACES.map((w) => ({ value: w.value, label: w.label, title: w.title }))}
        value={workspace}
        onChange={(v) => setViewMode(v)}
      />

      {isGraphWorkspace && (
        <Button
          variant="quiet"
          size="sm"
          aria-pressed={splitOn}
          onClick={() => setViewMode(splitOn ? lastSingle : 'split')}
          title={workspace === 'geographic'
            ? 'Show the network graph beside the map'
            : 'Show the world map beside the network graph'}
          style={splitOn ? { color: color.text.accent, background: color.surface.selected } : undefined}
        >
          {splitOn ? 'Side by side · on' : 'Side by side'}
        </Button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0 }}>
        <span id="lens-label" style={{ ...typeStyle.meta, whiteSpace: 'nowrap' }}>Shading</span>
        <SegmentedControl
          size="sm"
          label="Metric shown on the graph"
          options={LENSES.map((l) => ({
            value: l,
            label: LENS_LABELS[l],
            disabled: !lensAvailable(l),
            title: !lensAvailable(l)
              ? 'Available only while a hazard is placed on the map'
              : `Shade by ${LENS_LABELS[l]}`,
          }))}
          value={lens}
          onChange={setLens}
        />
      </div>

      {/* minWidth 0 is what actually stops the page scrolling sideways. A
          flex item defaults to min-width:auto, so this group refused to
          shrink below its content and pushed the document to 476px at a
          375px viewport — the selection readout alone is 380px of one long
          event title. Constraining the group, and letting the readout be
          the part that gives, keeps every control reachable. */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
        {scenarioActive && <StatusBadge tone="warning">Hazard applied</StatusBadge>}

        {/* The selection is announced to assistive technology when it
            changes, because a graph highlight is invisible to a reader who
            is not looking at the graph. */}
        <span
          aria-live="polite"
          style={{
            ...typeStyle.meta,
            flex: '1 1 auto', minWidth: 0, maxWidth: 380,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {label ? (
            <>
              Selected: <span style={{ color: color.text.accent }}>{label.kind}</span>{' '}
              <span style={{ color: color.text.secondary }}>{label.name}</span>
            </>
          ) : 'Nothing selected'}
        </span>

        <Button variant="quiet" size="sm" onClick={back} disabled={!history.length} aria-label="Back to previous selection">
          Back
        </Button>
        <Button variant="quiet" size="sm" onClick={clear} disabled={!selected} aria-label="Clear selection">
          Clear
        </Button>
      </div>
    </nav>
  );
}
