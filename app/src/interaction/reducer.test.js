import { describe, it, expect } from 'vitest';
import { interactionReducer, initInteraction, lensAvailable, sameSel, isDraftSource, VIEW_MODES, initFacilityPlayground, DEFAULT_FACILITY_HOPS } from './reducer.js';

const S = (type, id) => ({ type, id });

describe('interactionReducer — selection', () => {
  it('SELECT pins a selection and pushes the previous one onto the back-stack', () => {
    let s = initInteraction(S('event', 'e1'));
    s = interactionReducer(s, { type: 'SELECT', payload: S('country', 'tw') });
    expect(s.selected).toEqual(S('country', 'tw'));
    expect(s.history).toEqual([S('event', 'e1')]);
  });

  it('HOVER does not replace the pinned selection', () => {
    let s = initInteraction(S('country', 'tw'));
    s = interactionReducer(s, { type: 'HOVER', payload: S('stage', 'litho') });
    expect(s.hovered).toEqual(S('stage', 'litho'));
    expect(s.selected).toEqual(S('country', 'tw')); // unchanged
  });

  it('CLEAR_HOVER only clears the hover', () => {
    let s = initInteraction(S('country', 'tw'));
    s = interactionReducer(s, { type: 'HOVER', payload: S('stage', 'litho') });
    s = interactionReducer(s, { type: 'CLEAR_HOVER' });
    expect(s.hovered).toBeNull();
    expect(s.selected).toEqual(S('country', 'tw'));
  });

  it('CLEAR drops selection, hover, and focused path', () => {
    let s = initInteraction(S('country', 'tw'));
    s = interactionReducer(s, { type: 'HOVER', payload: S('stage', 'litho') });
    s = interactionReducer(s, { type: 'SET_FOCUSED_PATH', payload: { sourceId: 'tw', targetId: 'm_auto', edgeIds: [] } });
    s = interactionReducer(s, { type: 'CLEAR' });
    expect(s.selected).toBeNull();
    expect(s.hovered).toBeNull();
    expect(s.focusedPath).toBeNull();
  });

  it('BACK restores the previous selection from the stack', () => {
    let s = initInteraction(S('event', 'e1'));
    s = interactionReducer(s, { type: 'SELECT', payload: S('country', 'tw') });
    s = interactionReducer(s, { type: 'SELECT', payload: S('stage', 'litho') });
    s = interactionReducer(s, { type: 'BACK' });
    expect(s.selected).toEqual(S('country', 'tw'));
    s = interactionReducer(s, { type: 'BACK' });
    expect(s.selected).toEqual(S('event', 'e1'));
  });
});

describe('interactionReducer — lens', () => {
  it('SET_LENS switches to any always-available lens', () => {
    let s = initInteraction(null);
    s = interactionReducer(s, { type: 'SET_LENS', payload: 'operational' });
    expect(s.lens).toBe('operational');
    s = interactionReducer(s, { type: 'SET_LENS', payload: 'share' });
    expect(s.lens).toBe('share');
  });

  it('refuses to switch to Scenario Δ when no scenario is active', () => {
    let s = initInteraction(null);
    s = interactionReducer(s, { type: 'SET_LENS', payload: 'delta' });
    expect(s.lens).toBe('structural'); // unchanged
    expect(lensAvailable('delta', false)).toBe(false);
  });

  it('makes Scenario Δ the default lens when a scenario activates, and reverts on deactivation', () => {
    let s = initInteraction(null);
    s = interactionReducer(s, { type: 'SET_SCENARIO_ACTIVE', payload: true });
    expect(s.scenarioActive).toBe(true);
    expect(s.lens).toBe('delta');
    // now delta is selectable
    expect(lensAvailable('delta', true)).toBe(true);
    s = interactionReducer(s, { type: 'SET_SCENARIO_ACTIVE', payload: false });
    expect(s.scenarioActive).toBe(false);
    expect(s.lens).toBe('structural'); // fell back off the now-unavailable delta lens
  });

  it('does not clobber a non-delta lens when a scenario deactivates', () => {
    let s = initInteraction(null);
    s = interactionReducer(s, { type: 'SET_SCENARIO_ACTIVE', payload: true });
    s = interactionReducer(s, { type: 'SET_LENS', payload: 'operational' });
    s = interactionReducer(s, { type: 'SET_SCENARIO_ACTIVE', payload: false });
    expect(s.lens).toBe('operational');
  });
});

describe('interactionReducer — playback', () => {
  it('manually selecting another entity pauses playback', () => {
    let s = initInteraction(S('event', 'e1'));
    s = interactionReducer(s, { type: 'PLAYBACK', payload: { status: 'playing', step: 1, length: 4 } });
    expect(s.playback.status).toBe('playing');
    s = interactionReducer(s, { type: 'SELECT', payload: S('country', 'tw') });
    expect(s.playback.status).toBe('paused');
  });

  it('clamps the playback step to the trace bounds', () => {
    let s = initInteraction(null);
    s = interactionReducer(s, { type: 'PLAYBACK', payload: { step: 99, length: 4 } });
    expect(s.playback.step).toBe(3); // length-1
    s = interactionReducer(s, { type: 'PLAYBACK', payload: { step: -5, length: 4 } });
    expect(s.playback.step).toBe(0);
  });
});

describe('interactionReducer — draft scenario composition', () => {
  it('DRAFT_TOGGLE_SOURCE adds a source, and toggling the same one removes it', () => {
    let s = initInteraction(null);
    s = interactionReducer(s, { type: 'DRAFT_TOGGLE_SOURCE', payload: S('stage', 'litho') });
    expect(s.draft.sources).toEqual([{ type: 'stage', id: 'litho' }]);
    expect(isDraftSource(s.draft, S('stage', 'litho'))).toBe(true);
    s = interactionReducer(s, { type: 'DRAFT_TOGGLE_SOURCE', payload: S('stage', 'litho') });
    expect(s.draft.sources).toEqual([]);
  });

  it('accumulates multiple distinct sources (stages and countries)', () => {
    let s = initInteraction(null);
    s = interactionReducer(s, { type: 'DRAFT_TOGGLE_SOURCE', payload: S('stage', 'litho') });
    s = interactionReducer(s, { type: 'DRAFT_TOGGLE_SOURCE', payload: S('country', 'tw') });
    expect(s.draft.sources).toHaveLength(2);
  });

  it('DRAFT_SET patches and clamps severity and validates direction', () => {
    let s = initInteraction(null);
    s = interactionReducer(s, { type: 'DRAFT_SET', payload: { severity: 99 } });
    expect(s.draft.severity).toBe(10);
    s = interactionReducer(s, { type: 'DRAFT_SET', payload: { severity: -3 } });
    expect(s.draft.severity).toBe(1);
    s = interactionReducer(s, { type: 'DRAFT_SET', payload: { direction: 'mitigating' } });
    expect(s.draft.direction).toBe('mitigating');
    s = interactionReducer(s, { type: 'DRAFT_SET', payload: { direction: 'nonsense' } });
    expect(s.draft.direction).toBe('mitigating'); // invalid ignored
  });

  it('DRAFT_CLEAR empties the source list but keeps severity/direction', () => {
    let s = initInteraction(null);
    s = interactionReducer(s, { type: 'DRAFT_SET', payload: { severity: 9, direction: 'mitigating' } });
    s = interactionReducer(s, { type: 'DRAFT_TOGGLE_SOURCE', payload: S('stage', 'litho') });
    s = interactionReducer(s, { type: 'DRAFT_CLEAR' });
    expect(s.draft.sources).toEqual([]);
    expect(s.draft.severity).toBe(9);
    expect(s.draft.direction).toBe('mitigating');
  });
});

describe('interactionReducer — reversible network playground', () => {
  const R = (s, type, payload) => interactionReducer(s, { type, payload });

  it('toggling a node removal adds then removes it, recording undo history', () => {
    let s = initInteraction(null);
    s = R(s, 'PG_TOGGLE_NODE', 'tw::adv_fab');
    expect(s.playground.removedNodeIds).toEqual(['tw::adv_fab']);
    expect(s.playground.past).toHaveLength(1);
    s = R(s, 'PG_TOGGLE_NODE', 'tw::adv_fab');
    expect(s.playground.removedNodeIds).toEqual([]);
  });

  it('undo/redo are deterministic inverses', () => {
    let s = initInteraction(null);
    s = R(s, 'PG_TOGGLE_NODE', 'a::s1');
    s = R(s, 'PG_TOGGLE_EDGE', 'a::s1->b::s2');
    const removedBefore = { n: [...s.playground.removedNodeIds], e: [...s.playground.removedEdgeIds] };
    s = R(s, 'PG_UNDO');
    expect(s.playground.removedEdgeIds).toEqual([]); // undid the edge removal
    expect(s.playground.removedNodeIds).toEqual(['a::s1']);
    s = R(s, 'PG_REDO');
    expect(s.playground.removedNodeIds).toEqual(removedBefore.n);
    expect(s.playground.removedEdgeIds).toEqual(removedBefore.e);
  });

  it('reset clears all removals and is itself undoable', () => {
    let s = initInteraction(null);
    s = R(s, 'PG_TOGGLE_NODE', 'a::s1');
    s = R(s, 'PG_RESET');
    expect(s.playground.removedNodeIds).toEqual([]);
    s = R(s, 'PG_UNDO');
    expect(s.playground.removedNodeIds).toEqual(['a::s1']); // reset was reversible
  });

  it('a new removal clears the redo stack', () => {
    let s = initInteraction(null);
    s = R(s, 'PG_TOGGLE_NODE', 'a::s1');
    s = R(s, 'PG_UNDO');
    expect(s.playground.future).toHaveLength(1);
    s = R(s, 'PG_TOGGLE_NODE', 'b::s2');
    expect(s.playground.future).toHaveLength(0);
  });

  it('multi-select toggles membership without touching the undo stack', () => {
    let s = initInteraction(null);
    s = R(s, 'PG_TOGGLE_MULTI', { type: 'centre', id: 'a::s1' });
    s = R(s, 'PG_TOGGLE_MULTI', { type: 'centre', id: 'b::s2' });
    expect(s.playground.multi).toHaveLength(2);
    expect(s.playground.past).toHaveLength(0);
    s = R(s, 'PG_TOGGLE_MULTI', { type: 'centre', id: 'a::s1' });
    expect(s.playground.multi).toEqual([{ type: 'centre', id: 'b::s2' }]);
    s = R(s, 'PG_CLEAR_MULTI');
    expect(s.playground.multi).toEqual([]);
  });
});

describe('interactionReducer — comparison workspace (§31)', () => {
  const R = (s, type, payload) => interactionReducer(s, { type, payload });
  it('toggles up to four pinned items and no more', () => {
    let s = initInteraction(null);
    ['a::1', 'b::2', 'c::3', 'd::4', 'e::5'].forEach((id) => { s = R(s, 'CMP_TOGGLE', { type: 'centre', id }); });
    expect(s.comparison).toHaveLength(4); // 5th ignored
    s = R(s, 'CMP_TOGGLE', { type: 'centre', id: 'a::1' }); // remove
    expect(s.comparison.map((c) => c.id)).toEqual(['b::2', 'c::3', 'd::4']);
    s = R(s, 'CMP_CLEAR');
    expect(s.comparison).toEqual([]);
  });
});

describe('sameSel', () => {
  it('compares type+id, treats null carefully', () => {
    expect(sameSel(S('country', 'tw'), S('country', 'tw'))).toBe(true);
    expect(sameSel(S('country', 'tw'), S('country', 'kr'))).toBe(false);
    expect(sameSel(null, null)).toBe(true);
    expect(sameSel(S('country', 'tw'), null)).toBe(false);
  });
});

/* ====================================================================
   Facility playground (§ Priority 0).

   The state that used to live inside FacilityExplorer as component state,
   which produced two verified defects: switching the Layer-3 tab from
   Explore to Events and back erased the selected facility, and neither the
   focus nor the exploration trail appeared in the shareable URL. Both are
   consequences of WHERE the state lived, so the fix is tested here — at
   the one place both surfaces now read from.
   ==================================================================== */
describe('facility playground state', () => {
  const start = () => initInteraction(null);
  const run = (actions, from = start()) => actions.reduce(interactionReducer, from);

  it('starts empty', () => {
    expect(start().facility).toMatchObject({ focusId: null, rootId: null, hops: DEFAULT_FACILITY_HOPS, direction: 'both' });
  });

  it('focusing sets both the focus and the root the first time', () => {
    const s = run([{ type: 'FAC_FOCUS', payload: { id: 'a' } }]);
    expect(s.facility.focusId).toBe('a');
    expect(s.facility.rootId).toBe('a');
    expect(s.facility.trail).toEqual([]);
  });

  it('recentring keeps the original root and pushes the old focus onto the trail', () => {
    const s = run([
      { type: 'FAC_FOCUS', payload: { id: 'a' } },
      { type: 'FAC_FOCUS', payload: { id: 'b' } },
      { type: 'FAC_FOCUS', payload: { id: 'c' } },
    ]);
    expect(s.facility.focusId).toBe('c');
    expect(s.facility.rootId).toBe('a');
    expect(s.facility.trail).toEqual(['a', 'b']);
  });

  it('back and forward walk the exploration history in both directions', () => {
    let s = run([
      { type: 'FAC_FOCUS', payload: { id: 'a' } },
      { type: 'FAC_FOCUS', payload: { id: 'b' } },
      { type: 'FAC_FOCUS', payload: { id: 'c' } },
    ]);
    s = interactionReducer(s, { type: 'FAC_BACK' });
    expect(s.facility.focusId).toBe('b');
    expect(s.facility.forward).toEqual(['c']);
    s = interactionReducer(s, { type: 'FAC_BACK' });
    expect(s.facility.focusId).toBe('a');
    s = interactionReducer(s, { type: 'FAC_FORWARD' });
    expect(s.facility.focusId).toBe('b');
    s = interactionReducer(s, { type: 'FAC_FORWARD' });
    expect(s.facility.focusId).toBe('c');
    expect(s.facility.forward).toEqual([]);
  });

  it('back at the start of the trail is a no-op, not a crash', () => {
    const s = run([{ type: 'FAC_FOCUS', payload: { id: 'a' } }, { type: 'FAC_BACK' }, { type: 'FAC_BACK' }]);
    expect(s.facility.focusId).toBe('a');
  });

  it('returns to the original facility without losing the trail', () => {
    let s = run([
      { type: 'FAC_FOCUS', payload: { id: 'a' } },
      { type: 'FAC_FOCUS', payload: { id: 'b' } },
    ]);
    s = interactionReducer(s, { type: 'FAC_HOME' });
    expect(s.facility.focusId).toBe('a');
    expect(s.facility.trail).toEqual(['a', 'b']);
  });

  /* Moving the camera must not throw away the network the reader opened. */
  it('keeps expanded and collapsed branches when recentring', () => {
    const s = run([
      { type: 'FAC_FOCUS', payload: { id: 'a' } },
      { type: 'FAC_TOGGLE_EXPAND', payload: 'x' },
      { type: 'FAC_TOGGLE_COLLAPSE', payload: 'y' },
      { type: 'FAC_FOCUS', payload: { id: 'b' } },
    ]);
    expect(s.facility.expanded).toEqual(['x']);
    expect(s.facility.collapsed).toEqual(['y']);
  });

  it('drops the previous shape when a NEW exploration is started', () => {
    const s = run([
      { type: 'FAC_FOCUS', payload: { id: 'a' } },
      { type: 'FAC_TOGGLE_EXPAND', payload: 'x' },
      { type: 'FAC_FOCUS', payload: { id: 'b', asRoot: true } },
    ]);
    expect(s.facility.rootId).toBe('b');
    expect(s.facility.expanded).toEqual([]);
  });

  it('expanding and collapsing are mutually exclusive for one node', () => {
    let s = run([{ type: 'FAC_FOCUS', payload: { id: 'a' } }, { type: 'FAC_TOGGLE_COLLAPSE', payload: 'x' }]);
    expect(s.facility.collapsed).toEqual(['x']);
    s = interactionReducer(s, { type: 'FAC_TOGGLE_EXPAND', payload: 'x' });
    expect(s.facility.collapsed).toEqual([]);
    expect(s.facility.expanded).toEqual(['x']);
  });

  it('toggling twice returns to the starting state', () => {
    const s = run([
      { type: 'FAC_FOCUS', payload: { id: 'a' } },
      { type: 'FAC_TOGGLE_EXPAND', payload: 'x' },
      { type: 'FAC_TOGGLE_EXPAND', payload: 'x' },
    ]);
    expect(s.facility.expanded).toEqual([]);
  });

  /* Topology-only removal, and it has to be reversible. */
  it('hides and restores a facility, and refuses to hide the root', () => {
    let s = run([{ type: 'FAC_FOCUS', payload: { id: 'a' } }, { type: 'FAC_TOGGLE_HIDDEN', payload: 'b' }]);
    expect(s.facility.hidden).toEqual(['b']);
    s = interactionReducer(s, { type: 'FAC_TOGGLE_HIDDEN', payload: 'a' });
    expect(s.facility.hidden).toEqual(['b']); // the root cannot be hidden away
    s = interactionReducer(s, { type: 'FAC_CLEAR_HIDDEN' });
    expect(s.facility.hidden).toEqual([]);
  });

  it('clamps hop depth and rejects an invalid direction', () => {
    const s = run([{ type: 'FAC_SET', payload: { hops: 99, direction: 'sideways' } }]);
    expect(s.facility.hops).toBe(6);
    expect(s.facility.direction).toBe('both');
  });

  it('accepts "all reachable" as a depth', () => {
    expect(run([{ type: 'FAC_SET', payload: { hops: Infinity } }]).facility.hops).toBe(Infinity);
  });

  it('merges filter patches and clears them all on null', () => {
    let s = run([{ type: 'FAC_SET_FILTERS', payload: { country: 'jp' } }]);
    s = interactionReducer(s, { type: 'FAC_SET_FILTERS', payload: { relClass: 'service' } });
    expect(s.facility.filters).toEqual({ country: 'jp', relClass: 'service' });
    s = interactionReducer(s, { type: 'FAC_SET_FILTERS', payload: null });
    expect(s.facility.filters).toBeNull();
  });

  it('resets everything to the starting state', () => {
    const s = run([
      { type: 'FAC_FOCUS', payload: { id: 'a' } },
      { type: 'FAC_TOGGLE_EXPAND', payload: 'x' },
      { type: 'FAC_SET', payload: { hops: 3 } },
      { type: 'FAC_RESET' },
    ]);
    expect(s.facility).toEqual(initFacilityPlayground());
  });

  /* The state-loss defect, stated as a property: nothing about the
     playground depends on which Layer-3 tab is showing, because the tab is
     not in this reducer at all. Selecting other entities must leave it
     alone. */
  it('is untouched by selecting an event, a company or a stage', () => {
    const s = run([
      { type: 'FAC_FOCUS', payload: { id: 'a' } },
      { type: 'FAC_SET', payload: { hops: 2, direction: 'upstream' } },
      { type: 'SELECT', payload: { type: 'event', id: 'e1' } },
      { type: 'SELECT', payload: { type: 'company', id: 'tsmc' } },
      { type: 'SET_VIEW_MODE', payload: 'topology' },
      { type: 'CLEAR' },
    ]);
    expect(s.facility).toMatchObject({ focusId: 'a', hops: 2, direction: 'upstream' });
  });

  it('accepts playground as a view mode', () => {
    expect(run([{ type: 'SET_VIEW_MODE', payload: 'playground' }]).viewMode).toBe('playground');
    expect(VIEW_MODES).toContain('playground');
  });

  it('bounds the trail so it cannot grow without limit', () => {
    let s = start();
    for (let i = 0; i < 80; i += 1) s = interactionReducer(s, { type: 'FAC_FOCUS', payload: { id: `f${i}` } });
    expect(s.facility.trail.length).toBeLessThanOrEqual(40);
  });
});
