import { describe, it, expect } from 'vitest';
import {
  normalizeEntry, normalizeList, toggleEntry, removeEntry, isWatched,
  resolveWatchlist, routeId, parseRouteId, MAX_WATCHED, WATCH_TYPES,
} from './watchlist.js';

describe('watchlist entry rules', () => {
  it('accepts the four kinds and rejects anything else', () => {
    WATCH_TYPES.forEach((type) => {
      const id = type === 'route' ? routeId('wafers', 'adv_fab') : 'x';
      expect(normalizeEntry({ type, id })).toEqual({ type, id });
    });
    expect(normalizeEntry({ type: 'planet', id: 'mars' })).toBeNull();
    expect(normalizeEntry({ type: 'company' })).toBeNull();
    expect(normalizeEntry(null)).toBeNull();
    expect(normalizeEntry('company:tsmc')).toBeNull();
  });

  it('rejects a route id that is not a pair', () => {
    expect(normalizeEntry({ type: 'route', id: 'wafers' })).toBeNull();
    expect(parseRouteId('a>b')).toEqual({ from: 'a', to: 'b' });
    expect(parseRouteId('nope')).toBeNull();
  });

  it('rejects an absurdly long id rather than storing it', () => {
    expect(normalizeEntry({ type: 'company', id: 'x'.repeat(500) })).toBeNull();
  });

  /* A stored list that can contain junk becomes a render crash on the next
     page load, in a feature whose whole point is surviving reloads. */
  it('drops junk and duplicates when loading a stored list', () => {
    const list = normalizeList([
      { type: 'company', id: 'tsmc' },
      { type: 'company', id: 'tsmc' },
      { type: 'nonsense', id: 'x' },
      null,
      { type: 'stage', id: 'hbm' },
    ]);
    expect(list).toEqual([{ type: 'company', id: 'tsmc' }, { type: 'stage', id: 'hbm' }]);
    expect(normalizeList('not an array')).toEqual([]);
    expect(normalizeList(undefined)).toEqual([]);
  });

  it('caps the stored list', () => {
    const many = Array.from({ length: MAX_WATCHED + 20 }, (_, i) => ({ type: 'company', id: `c${i}` }));
    expect(normalizeList(many)).toHaveLength(MAX_WATCHED);
  });
});

describe('toggle and remove', () => {
  it('adds, then removes on a second toggle', () => {
    const e = { type: 'facility', id: 'kioxia_yokkaichi' };
    const added = toggleEntry([], e);
    expect(isWatched(added, e)).toBe(true);
    expect(isWatched(toggleEntry(added, e), e)).toBe(false);
  });

  it('refuses to add past the cap but never drops what is already there', () => {
    const full = Array.from({ length: MAX_WATCHED }, (_, i) => ({ type: 'company', id: `c${i}` }));
    const after = toggleEntry(full, { type: 'company', id: 'one-too-many' });
    expect(after).toHaveLength(MAX_WATCHED);
    expect(isWatched(after, { type: 'company', id: 'one-too-many' })).toBe(false);
    // ...but removing still works at the cap
    expect(toggleEntry(full, { type: 'company', id: 'c0' })).toHaveLength(MAX_WATCHED - 1);
  });

  it('ignores a malformed entry instead of corrupting the list', () => {
    const list = [{ type: 'stage', id: 'hbm' }];
    expect(toggleEntry(list, { type: 'bogus', id: 'x' })).toEqual(list);
    expect(removeEntry(list, null)).toEqual(list);
  });
});

describe('resolveWatchlist', () => {
  const ctx = {
    COMPANY_BY_ID: { tsmc: { id: 'tsmc', name: 'TSMC', stakes: { adv_fab: 0.6 } } },
    STAGE_BY_ID: { adv_fab: { name: 'Advanced fab' }, hbm: { name: 'HBM' }, osat: { name: 'OSAT' } },
    FACILITY_LAYER: { FACILITY_BY_ID: { f1: { id: 'f1', name: 'Fab One', status: 'operating', stages: ['adv_fab'] } } },
    engine: {
      COMPANY_CRITICALITY: { tsmc: { value: 9.4 } },
      companyVulnerability: () => 6.1,
      STRUCTURAL_VULNERABILITY: { adv_fab: 8.2, hbm: 7.0, osat: 5.0 },
    },
    model: { activeField: { adv_fab: 0.4, hbm: -0.1, osat: 0.02 } },
  };

  it('reports a company with its criticality and its worst live effect', () => {
    const [row] = resolveWatchlist([{ type: 'company', id: 'tsmc' }], ctx);
    expect(row.label).toBe('TSMC');
    expect(row.value).toBe(9.4);
    expect(row.signed).toBe(0.4);
    expect(row.missing).toBe(false);
  });

  it('reports a stage with its structural score and live field', () => {
    const [row] = resolveWatchlist([{ type: 'stage', id: 'hbm' }], ctx);
    expect(row.label).toBe('HBM');
    expect(row.value).toBe(7.0);
    expect(row.signed).toBe(-0.1);
  });

  it('reports a facility with its status and stages', () => {
    const [row] = resolveWatchlist([{ type: 'facility', id: 'f1' }], ctx);
    expect(row.label).toBe('Fab One');
    expect(row.sublabel).toContain('operating');
    expect(row.signed).toBe(0.4);
  });

  /* A lane is only as intact as its most disrupted end. Averaging would let
     a healthy origin hide a stopped destination, which is the one thing
     someone tracking a route needs to be told. */
  it('scores a route by its WORSE endpoint, not the average', () => {
    const [row] = resolveWatchlist([{ type: 'route', id: routeId('osat', 'adv_fab') }], ctx);
    expect(row.label).toBe('OSAT → Advanced fab');
    expect(row.signed).toBe(0.4); // adv_fab 0.4 beats osat 0.02
  });

  /* A supplier disappearing from the dataset is exactly the event someone
     tracking it should see — so it is flagged, never silently dropped. */
  it('flags an entry whose target has left the vault instead of dropping it', () => {
    const rows = resolveWatchlist([
      { type: 'company', id: 'gone' },
      { type: 'facility', id: 'gone' },
      { type: 'stage', id: 'gone' },
      { type: 'route', id: routeId('gone', 'adv_fab') },
    ], ctx);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.missing)).toBe(true);
    expect(rows[0].sublabel).toMatch(/no longer in the vault/);
  });

  it('degrades to labelled rows with no context at all', () => {
    const rows = resolveWatchlist([{ type: 'company', id: 'x' }], {});
    expect(rows).toHaveLength(1);
    expect(rows[0].missing).toBe(true);
  });

  it('returns an empty array for an empty or missing list', () => {
    expect(resolveWatchlist([], ctx)).toEqual([]);
    expect(resolveWatchlist(undefined, ctx)).toEqual([]);
  });
});
