import { describe, it, expect } from 'vitest';
import { encodeInteractionState, decodeInteractionState, encodeNetworkState, decodeNetworkState } from './urlState.js';

describe('urlState encode/decode', () => {
  it('omits defaults and encodes only meaningful state', () => {
    expect(encodeInteractionState({ lens: 'structural', scenarioId: 'none', playbackStep: 0 })).toBe('');
  });

  it('round-trips view mode and a functional-centre selection', () => {
    const s = { viewMode: 'topology', selected: { type: 'centre', id: 'tw::adv_fab' } };
    const decoded = decodeInteractionState(encodeInteractionState(s));
    expect(decoded.viewMode).toBe('topology');
    expect(decoded.selected).toEqual({ type: 'centre', id: 'tw::adv_fab' });
  });

  it('round-trips a preset-scenario view', () => {
    const s = { lens: 'delta', selected: { type: 'stage', id: 'litho' }, scenarioId: 'strait', playbackStep: 3, focusedPath: { sourceId: 'litho', targetId: 'fab' } };
    const decoded = decodeInteractionState(encodeInteractionState(s));
    expect(decoded.lens).toBe('delta');
    expect(decoded.selected).toEqual({ type: 'stage', id: 'litho' });
    expect(decoded.scenarioId).toBe('strait');
    expect(decoded.playbackStep).toBe(3);
    expect(decoded.focusedPath).toEqual({ sourceId: 'litho', targetId: 'fab' });
  });

  it('round-trips a custom scenario with its draft sources', () => {
    const draft = { sources: [{ type: 'stage', id: 'fab' }, { type: 'country', id: 'tw' }], severity: 9, direction: 'mitigating' };
    const encoded = encodeInteractionState({ scenarioId: 'custom', draft });
    const decoded = decodeInteractionState(encoded);
    expect(decoded.scenarioId).toBe('custom');
    expect(decoded.draft.sources).toEqual(draft.sources);
    expect(decoded.draft.severity).toBe(9);
    expect(decoded.draft.direction).toBe('mitigating');
  });

  it('tolerates a leading # or ? and ignores junk keys', () => {
    const decoded = decodeInteractionState('#lens=operational&junk=1&sel=country:tw');
    expect(decoded.lens).toBe('operational');
    expect(decoded.selected).toEqual({ type: 'country', id: 'tw' });
  });

  it('rejects invalid lens, entity type, direction, and severity', () => {
    const decoded = decodeInteractionState('lens=bogus&sel=planet:mars&scn=custom&dir=chaos&sev=999');
    expect(decoded.lens).toBeUndefined();
    expect(decoded.selected).toBeUndefined();
    expect(decoded.draft.direction).toBe('adverse'); // fell back
    expect(decoded.draft.severity).toBe(10); // clamped
  });

  it('clamps a negative playback step out of the encoding', () => {
    expect(encodeInteractionState({ playbackStep: -4 })).toBe('');
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
