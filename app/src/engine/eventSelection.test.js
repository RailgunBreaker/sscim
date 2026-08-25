/* Which event the dashboard opens on, and how the feed is searched.

   The defect being pinned: App.jsx took `data.EVENTS[0]`. The vault's array
   order is not chronological, so the dashboard opened on a July 3 record
   while the newest reviewed event was August 19. Every test below that
   shuffles an array exists because the old expression passed on a sorted
   one and failed on the real bundle. */
import { describe, it, expect } from 'vitest';
import {
  newestEvent, defaultEventSelection, validDaysAgo,
  filterEvents, sortEventsChronologically, EMPTY_EVENT_FILTERS, eventFiltersActive,
} from './eventSelection.js';
import snapshot from '../data/vault-snapshot.json';

const ev = (id, daysAgo, over = {}) => ({ id, daysAgo, title: id, type: 'Policy Signal', date: 'x', ...over });

describe('validDaysAgo', () => {
  it('accepts a number and a numeric string', () => {
    expect(validDaysAgo({ daysAgo: 0 })).toBe(0);
    expect(validDaysAgo({ daysAgo: '12' })).toBe(12);
  });

  it('rejects the three things that actually turn up in a bundle', () => {
    expect(validDaysAgo({})).toBeNull();                 // missing
    expect(validDaysAgo({ daysAgo: 'soon' })).toBeNull(); // unparseable
    expect(validDaysAgo({ daysAgo: NaN })).toBeNull();    // NaN
    expect(validDaysAgo({ daysAgo: -3 })).toBeNull();     // nonsensical
    expect(validDaysAgo(null)).toBeNull();
  });
});

describe('newestEvent', () => {
  it('does not depend on array order', () => {
    const list = [ev('old', 50), ev('newest', 1), ev('mid', 20)];
    expect(newestEvent(list).id).toBe('newest');
    expect(newestEvent([...list].reverse()).id).toBe('newest');
    expect(newestEvent([ev('newest', 1), ev('old', 50)]).id).toBe('newest');
  });

  it('is not fooled by the newest record sitting last', () => {
    const list = [ev('a', 90), ev('b', 80), ev('c', 70), ev('d', 2)];
    expect(newestEvent(list).id).toBe('d');
  });

  it('breaks a tie with the supplied ranking, deterministically', () => {
    const list = [ev('quiet', 3), ev('loud', 3)];
    const rank = (e) => (e.id === 'loud' ? 4 : 0.1);
    expect(newestEvent(list, { rank }).id).toBe('loud');
    expect(newestEvent([...list].reverse(), { rank }).id).toBe('loud');
  });

  it('falls back to the id — stable, if arbitrary — with no ranking', () => {
    const list = [ev('zeta', 3), ev('alpha', 3)];
    expect(newestEvent(list).id).toBe('alpha');
    expect(newestEvent([...list].reverse()).id).toBe('alpha');
  });

  it('survives a ranking function that throws', () => {
    const list = [ev('a', 3), ev('b', 3)];
    const rank = () => { throw new Error('engine not ready'); };
    expect(() => newestEvent(list, { rank })).not.toThrow();
    expect(newestEvent(list, { rank }).id).toBe('a');
  });

  it('returns null rather than guessing on an empty or invalid list', () => {
    expect(newestEvent([])).toBeNull();
    expect(newestEvent(null)).toBeNull();
    expect(newestEvent(undefined)).toBeNull();
    expect(newestEvent([{ id: 'x' }])).toBeNull();            // no usable date at all
    expect(newestEvent([{ daysAgo: 1 }])).toBeNull();          // no id
  });

  it('ignores undated records but still picks among the dated ones', () => {
    const list = [{ id: 'undated' }, ev('dated', 5)];
    expect(newestEvent(list).id).toBe('dated');
  });
});

describe('defaultEventSelection', () => {
  it('produces a selection descriptor for the newest event', () => {
    expect(defaultEventSelection([ev('old', 40), ev('new', 1)])).toEqual({ type: 'event', id: 'new' });
  });

  it('produces null — not a fabricated selection — when there is nothing to pick', () => {
    expect(defaultEventSelection([])).toBeNull();
    expect(defaultEventSelection(undefined)).toBeNull();
  });

  /* The regression itself, against the shipped snapshot. */
  it('does not pick EVENTS[0] out of the real snapshot', () => {
    const first = snapshot.events[0];
    const picked = defaultEventSelection(snapshot.events);
    const pickedEvent = snapshot.events.find((e) => e.id === picked.id);
    expect(pickedEvent.daysAgo).toBeLessThanOrEqual(first.daysAgo);
    const minAge = Math.min(...snapshot.events.map((e) => e.daysAgo));
    expect(pickedEvent.daysAgo).toBe(minAge);
  });
});

describe('sortEventsChronologically', () => {
  it('puts the newest first regardless of input order', () => {
    const list = [ev('c', 30), ev('a', 1), ev('b', 10)];
    expect(sortEventsChronologically(list).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('pushes undated records to the end rather than dropping them', () => {
    const list = [{ id: 'undated' }, ev('a', 5)];
    expect(sortEventsChronologically(list).map((e) => e.id)).toEqual(['a', 'undated']);
  });

  it('does not mutate its input', () => {
    const list = [ev('c', 30), ev('a', 1)];
    sortEventsChronologically(list);
    expect(list.map((e) => e.id)).toEqual(['c', 'a']);
  });
});

describe('feed filtering', () => {
  const assumptionOf = (e) => ({
    operational: e.id.startsWith('scored'),
    direction: e.id.includes('mit') ? 'mitigating' : 'adverse',
  });
  const list = [
    ev('scored_a', 3, { type: 'Natural Disaster', summary: 'quake in Kumamoto' }),
    ev('scored_mit_b', 10, { type: 'Policy Signal', summary: 'licence restored' }),
    ev('excluded_c', 40, { type: 'Natural Disaster', summary: 'typhoon warning' }),
    ev('excluded_mit_d', 400, { type: 'Market Shock', summary: 'price move' }),
  ];

  it('returns everything by default', () => {
    expect(filterEvents(list, EMPTY_EVENT_FILTERS, { assumptionOf })).toHaveLength(4);
    expect(eventFiltersActive(EMPTY_EVENT_FILTERS)).toBe(false);
  });

  it('filters by event type', () => {
    const out = filterEvents(list, { type: 'Natural Disaster' }, { assumptionOf });
    expect(out.map((e) => e.id)).toEqual(['scored_a', 'excluded_c']);
  });

  it('filters scored versus excluded', () => {
    expect(filterEvents(list, { scored: 'scored' }, { assumptionOf }).map((e) => e.id))
      .toEqual(['scored_a', 'scored_mit_b']);
    expect(filterEvents(list, { scored: 'excluded' }, { assumptionOf }).map((e) => e.id))
      .toEqual(['excluded_c', 'excluded_mit_d']);
  });

  it('filters adverse versus mitigating', () => {
    expect(filterEvents(list, { direction: 'mitigating' }, { assumptionOf }).map((e) => e.id))
      .toEqual(['scored_mit_b', 'excluded_mit_d']);
    expect(filterEvents(list, { direction: 'adverse' }, { assumptionOf }).map((e) => e.id))
      .toEqual(['scored_a', 'excluded_c']);
  });

  it('filters by date range', () => {
    expect(filterEvents(list, { within: '7' }, { assumptionOf }).map((e) => e.id)).toEqual(['scored_a']);
    expect(filterEvents(list, { within: '30' }, { assumptionOf }).map((e) => e.id)).toEqual(['scored_a', 'scored_mit_b']);
    expect(filterEvents(list, { within: '365' }, { assumptionOf })).toHaveLength(3);
  });

  it('searches title, summary, type, stage and country', () => {
    expect(filterEvents(list, { query: 'kumamoto' }, { assumptionOf }).map((e) => e.id)).toEqual(['scored_a']);
    expect(filterEvents(list, { query: 'market shock' }, { assumptionOf }).map((e) => e.id)).toEqual(['excluded_mit_d']);
    const withStage = [ev('s', 1, { stages: ['litho'], countries: ['nl'] })];
    expect(filterEvents(withStage, { query: 'litho' }, {})).toHaveLength(1);
    expect(filterEvents(withStage, { query: 'nl' }, {})).toHaveLength(1);
  });

  it('combines filters rather than replacing them', () => {
    const out = filterEvents(list, { scored: 'scored', direction: 'adverse' }, { assumptionOf });
    expect(out.map((e) => e.id)).toEqual(['scored_a']);
  });

  it('reports whether any filter is active', () => {
    expect(eventFiltersActive({ ...EMPTY_EVENT_FILTERS, query: '  ' })).toBe(false);
    expect(eventFiltersActive({ ...EMPTY_EVENT_FILTERS, query: 'x' })).toBe(true);
    expect(eventFiltersActive({ ...EMPTY_EVENT_FILTERS, within: '7' })).toBe(true);
  });

  it('never returns more than it was given', () => {
    expect(filterEvents(list, { query: 'nothing matches this' }, { assumptionOf })).toEqual([]);
    expect(filterEvents(null, EMPTY_EVENT_FILTERS, {})).toEqual([]);
  });
});
