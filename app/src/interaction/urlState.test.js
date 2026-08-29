import { describe, it, expect } from 'vitest';
import { encodeInteractionState, decodeInteractionState, encodeNetworkState, decodeNetworkState, encodeFacilityState, decodeFacilityState } from './urlState.js';
import { DEFAULT_FACILITY_HOPS } from './reducer.js';

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

/* ====================================================================
   Facility-playground state (§ Priority 0).

   Two defects being pinned: the selected facility and exploration trail
   were local component state, so switching Layer-3 tabs erased them and
   neither appeared in a shareable link. Everything meaningful now
   round-trips through the hash.

   BACKWARD COMPATIBILITY IS PART OF THE CONTRACT. Every key is prefixed
   `fac`, and an existing SSCIM URL that carries none of them must decode
   to an empty object and open exactly as it did before.
   ==================================================================== */
describe('facility playground URL state', () => {
  const roundTrip = (fac) => decodeFacilityState(`#${encodeFacilityState(fac)}`);

  it('encodes nothing at all when no facility is focused', () => {
    expect(encodeFacilityState({})).toBe('');
    expect(encodeFacilityState({ focusId: null, hops: 3, direction: 'upstream' })).toBe('');
    expect(encodeFacilityState(null)).toBe('');
  });

  it('round-trips a focused facility', () => {
    expect(roundTrip({ focusId: 'tsmc_fab18' })).toMatchObject({ focusId: 'tsmc_fab18', rootId: 'tsmc_fab18' });
  });

  it('round-trips a focus that has moved away from its root', () => {
    const out = roundTrip({ focusId: 'asml_veldhoven', rootId: 'tsmc_fab18' });
    expect(out.focusId).toBe('asml_veldhoven');
    expect(out.rootId).toBe('tsmc_fab18');
  });

  it('round-trips hop depth, including "all reachable"', () => {
    expect(roundTrip({ focusId: 'a', hops: 1 }).hops).toBe(1);
    expect(roundTrip({ focusId: 'a', hops: 2 }).hops).toBe(2);
    expect(roundTrip({ focusId: 'a', hops: Infinity }).hops).toBe(Infinity);
  });

  /* The omitted depth has to be the one the reducer actually starts on.
     These are pinned to DEFAULT_FACILITY_HOPS rather than to a literal so
     that moving the default cannot leave the encoder omitting one value
     while the decoder falls back to another — which would silently open a
     shared link on a different graph than the one it was copied from. */
  it('omits the depth the playground already opens on, and writes every other', () => {
    expect(encodeFacilityState({ focusId: 'a', hops: DEFAULT_FACILITY_HOPS })).not.toMatch(/facd/);
    expect(roundTrip({ focusId: 'a', hops: DEFAULT_FACILITY_HOPS }).hops).toBeUndefined();
    [1, 2, 3, 4, 5, 6].filter((h) => h !== DEFAULT_FACILITY_HOPS).forEach((h) => {
      expect(encodeFacilityState({ focusId: 'a', hops: h })).toMatch(/facd/);
      expect(roundTrip({ focusId: 'a', hops: h }).hops).toBe(h);
    });
  });

  it('round-trips direction, omitting the default', () => {
    expect(roundTrip({ focusId: 'a', direction: 'upstream' }).direction).toBe('upstream');
    expect(roundTrip({ focusId: 'a', direction: 'downstream' }).direction).toBe('downstream');
    expect(encodeFacilityState({ focusId: 'a', direction: 'both' })).not.toMatch(/facdir/);
  });

  it('rejects a direction that is not one of the three', () => {
    expect(decodeFacilityState('#fac=a&facdir=sideways').direction).toBeUndefined();
  });

  it('round-trips expanded, collapsed and hidden branches', () => {
    const out = roundTrip({ focusId: 'a', expanded: ['b', 'c'], collapsed: ['d'], hidden: ['e'] });
    expect(out.expanded).toEqual(['b', 'c']);
    expect(out.collapsed).toEqual(['d']);
    expect(out.hidden).toEqual(['e']);
  });

  it('round-trips the exploration trail, bounded so the URL stays pasteable', () => {
    const long = Array.from({ length: 30 }, (_, i) => `f${i}`);
    const out = roundTrip({ focusId: 'a', trail: long });
    expect(out.trail).toHaveLength(8);
    expect(out.trail.at(-1)).toBe('f29'); // the tail is what gets walked back
  });

  it('round-trips only the non-default filters', () => {
    const out = roundTrip({ focusId: 'a', filters: { relClass: 'service', country: 'jp', minRel: 0.25, company: '', status: 'all' } });
    expect(out.filters).toEqual({ relClass: 'service', country: 'jp', minRel: 0.25 });
  });

  it('round-trips a selected connection and a highlighted route', () => {
    const out = roundTrip({ focusId: 'a', selectedLink: 'a>b|s1>s2|forward', route: { from: 'a', to: 'b' } });
    expect(out.selectedLink).toBe('a>b|s1>s2|forward');
    expect(out.route).toEqual({ from: 'a', to: 'b' });
  });

  it('survives a full round trip of everything at once', () => {
    const fac = {
      focusId: 'x', rootId: 'y', hops: 2, direction: 'upstream',
      expanded: ['e1'], collapsed: ['c1'], hidden: ['h1'], trail: ['t1', 't2'],
      filters: { relClass: 'co-input', minRel: 0.1 },
      selectedLink: 'x>y|s>t|forward', route: { from: 'x', to: 'y' },
    };
    expect(roundTrip(fac)).toEqual(fac);
  });

  /* The compatibility guarantee. */
  it('decodes an existing SSCIM URL with no facility keys to nothing', () => {
    expect(decodeFacilityState('#view=topology&lens=operational&sel=company:tsmc&asof=30')).toEqual({});
    expect(decodeFacilityState('')).toEqual({});
    expect(decodeFacilityState(undefined)).toEqual({});
  });

  it('leaves the existing codecs untouched when facility keys are present', () => {
    const hash = '#view=topology&sel=company%3Atsmc&fac=tsmc_fab18&facd=2';
    expect(decodeInteractionState(hash)).toMatchObject({ viewMode: 'topology', selected: { type: 'company', id: 'tsmc' } });
    expect(decodeFacilityState(hash)).toMatchObject({ focusId: 'tsmc_fab18', hops: 2 });
  });

  it('clamps a nonsense hop depth rather than trusting it', () => {
    expect(decodeFacilityState('#fac=a&facd=999').hops).toBe(6);
    expect(decodeFacilityState('#fac=a&facd=-4').hops).toBe(1);
    expect(decodeFacilityState('#fac=a&facd=banana').hops).toBeUndefined();
  });
});
