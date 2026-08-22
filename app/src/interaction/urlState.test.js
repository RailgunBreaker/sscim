import { describe, it, expect } from 'vitest';
import { encodeInteractionState, decodeInteractionState, encodeNetworkState, decodeNetworkState } from './urlState.js';

describe('urlState encode/decode', () => {
  it('omits defaults and encodes only meaningful state', () => {
    expect(encodeInteractionState({ lens: 'structural', asOfDaysAgo: 0 })).toBe('');
  });

  it('round-trips view mode and a functional-centre selection', () => {
    const s = { viewMode: 'topology', selected: { type: 'centre', id: 'tw::adv_fab' } };
    const decoded = decodeInteractionState(encodeInteractionState(s));
    expect(decoded.viewMode).toBe('topology');
    expect(decoded.selected).toEqual({ type: 'centre', id: 'tw::adv_fab' });
  });

  it('round-trips a history-review view', () => {
    const s = { lens: 'operational', selected: { type: 'stage', id: 'litho' }, asOfDaysAgo: 240, focusedPath: { sourceId: 'litho', targetId: 'fab' } };
    const decoded = decodeInteractionState(encodeInteractionState(s));
    expect(decoded.lens).toBe('operational');
    expect(decoded.selected).toEqual({ type: 'stage', id: 'litho' });
    expect(decoded.asOfDaysAgo).toBe(240);
    expect(decoded.focusedPath).toEqual({ sourceId: 'litho', targetId: 'fab' });
  });

  it('round-trips a pinned facility', () => {
    const decoded = decodeInteractionState(encodeInteractionState({ selected: { type: 'facility', id: 'tsmc_fab18' } }));
    expect(decoded.selected).toEqual({ type: 'facility', id: 'tsmc_fab18' });
  });

  /* Scenario authoring is gone, and a hazard is a transient screening
     hypothesis. A stale link carrying the old keys must open on the LIVE
     view — never silently restore a what-if that a reader would then quote
     as an observation. */
  it('ignores the retired scenario keys from an old link', () => {
    const decoded = decodeInteractionState('#scn=custom&src=stage:fab&sev=9&dir=mitigating&step=3&lens=operational');
    expect(decoded.scenarioId).toBeUndefined();
    expect(decoded.draft).toBeUndefined();
    expect(decoded.playbackStep).toBeUndefined();
    expect(decoded.lens).toBe('operational'); // the rest of the link still works
  });

  it('tolerates a leading # or ? and ignores junk keys', () => {
    const decoded = decodeInteractionState('#lens=operational&junk=1&sel=country:tw');
    expect(decoded.lens).toBe('operational');
    expect(decoded.selected).toEqual({ type: 'country', id: 'tw' });
  });

  it('rejects an invalid lens and entity type', () => {
    const decoded = decodeInteractionState('lens=bogus&sel=planet:mars');
    expect(decoded.lens).toBeUndefined();
    expect(decoded.selected).toBeUndefined();
  });

  it('keeps a negative or fractional review offset out of the encoding', () => {
    expect(encodeInteractionState({ asOfDaysAgo: -4 })).toBe('');
    expect(encodeInteractionState({ asOfDaysAgo: 12.7 })).toBe('asof=12');
    expect(decodeInteractionState('asof=-9').asOfDaysAgo).toBeUndefined();
  });
});

describe('network state encode/decode (§33)', () => {
  it('omits everything when empty', () => {
    expect(encodeNetworkState({})).toBe('');
    expect(decodeNetworkState('')).toEqual({});
  });

  it('round-trips metric, removals, and a pinned route', () => {
    const s = {
      analysisMetric: 'betweenness',
      removedNodeIds: ['tw::adv_fab', 'kr::hbm'],
      removedEdgeIds: ['jp::resist->nl::litho'],
      route: { origin: 'tw::adv_fab', dest: 'us::m_ai', objective: 'max_bottleneck' },
    };
    const decoded = decodeNetworkState(encodeNetworkState(s));
    expect(decoded.analysisMetric).toBe('betweenness');
    expect(decoded.removedNodeIds).toEqual(['tw::adv_fab', 'kr::hbm']);
    expect(decoded.removedEdgeIds).toEqual(['jp::resist->nl::litho']);
    expect(decoded.route).toEqual({ origin: 'tw::adv_fab', dest: 'us::m_ai', objective: 'max_bottleneck' });
  });

  it('defaults a route objective when omitted', () => {
    const decoded = decodeNetworkState('rt=a::x>b::y');
    expect(decoded.route).toEqual({ origin: 'a::x', dest: 'b::y', objective: 'strongest' });
  });
});
