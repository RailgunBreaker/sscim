import { describe, it, expect } from 'vitest';
import { interactionReducer, initInteraction, lensAvailable, sameSel, isDraftSource } from './reducer.js';

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
