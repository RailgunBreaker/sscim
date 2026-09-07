import { describe, it, expect } from 'vitest';
import { reconcileBundle, staleLiveMessage } from './reconcileBundle.js';

const snapshot = {
  stages: [{ id: 's1' }],
  countries: [{ id: 'jp' }, { id: 'tw' }, { id: 'at' }, { id: 'it' }],
  companies: [{ id: 'tsmc' }, { id: 'infineon' }],
  facilities: [
    { id: 'f_jp', company: 'tsmc', country: 'jp' },
    { id: 'f_at', company: 'infineon', country: 'at' },
  ],
  events: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
};

/* The exact shape the deployed API returned: valid, 200, and simply has no
   concept of facilities because the process predates them. */
const staleLive = {
  stages: [{ id: 's1' }],
  countries: [{ id: 'jp' }, { id: 'tw' }],
  companies: [{ id: 'tsmc' }, { id: 'infineon' }],
  events: [{ id: 'e1' }, { id: 'e2' }],
};

describe('reconcileBundle — a live vault older than the build', () => {
  it('fills missing observed data with provenance but honors explicit withdrawal', () => {
    const reference = { ...snapshot, observedData: { observations: [{ id: 'reference' }] } };
    expect(reconcileBundle(staleLive, reference).filled).toContain('observedData');
    const empty = { observations: [], relationships: [], capacities: [] };
    const result = reconcileBundle({ ...staleLive, observedData: empty }, reference);
    expect(result.bundle.observedData).toEqual(empty);
    expect(result.filled).not.toContain('observedData');
  });
  it('fills a section the live API omits entirely, and reports it', () => {
    const { bundle, filled, stale } = reconcileBundle(staleLive, snapshot);
    expect(stale).toBe(true);
    expect(filled).toContain('facilities');
    expect(bundle.facilities.length).toBeGreaterThan(0);
  });

  it('unions the host countries the live vault does not know about', () => {
    const { bundle, filled } = reconcileBundle(staleLive, snapshot);
    expect(filled).toContain('countries(+hosts)');
    expect(bundle.countries.map((c) => c.id).sort()).toEqual(['at', 'it', 'jp', 'tw']);
  });

  /* The whole point: a facility restored from the snapshot must not survive
     into a bundle whose company or country list cannot resolve it. */
  it('drops a restored facility that the effective bundle cannot resolve', () => {
    const liveMissingCompany = { ...staleLive, companies: [{ id: 'tsmc' }] };
    const { bundle, dropped } = reconcileBundle(liveMissingCompany, snapshot);
    expect(dropped).toBe(1);
    expect(bundle.facilities.map((f) => f.id)).toEqual(['f_jp']);
  });

  /* The opposite lie, and the reason this is a merge and not a fallback:
     the live vault is the authority on sections it actually serves. Three
     events becoming two means one was withdrawn. */
  it('never re-adds records to a section the live vault does serve', () => {
    const { bundle, filled } = reconcileBundle(staleLive, snapshot);
    expect(bundle.events).toHaveLength(2);
    expect(filled).not.toContain('events');
  });

  it('leaves a fully current live bundle completely untouched', () => {
    const current = { ...staleLive, countries: snapshot.countries, facilities: snapshot.facilities };
    const { bundle, filled, dropped, stale } = reconcileBundle(current, snapshot);
    expect(stale).toBe(false);
    expect(filled).toEqual([]);
    expect(dropped).toBe(0);
    expect(bundle.facilities).toEqual(snapshot.facilities);
  });

  it('treats an empty array the same as a missing key', () => {
    const { filled } = reconcileBundle({ ...staleLive, facilities: [] }, snapshot);
    expect(filled).toContain('facilities');
  });

  it('degrades safely when either side is absent', () => {
    expect(reconcileBundle(null, snapshot).bundle).toBe(snapshot);
    expect(reconcileBundle(staleLive, null).bundle).toBe(staleLive);
    expect(reconcileBundle(null, snapshot).stale).toBe(false);
  });

  it('never mutates the inputs', () => {
    const live = JSON.parse(JSON.stringify(staleLive));
    const snap = JSON.parse(JSON.stringify(snapshot));
    reconcileBundle(live, snap);
    expect(live).toEqual(staleLive);
    expect(snap).toEqual(snapshot);
  });
});

describe('staleLiveMessage', () => {
  it('labels a missing prediction report fallback and preserves an explicit withdrawal', () => {
    const reference = { ...snapshot, revenueValidation: { status: 'historical_benchmark_pass' } };
    const fallback = reconcileBundle(staleLive, reference);
    expect(fallback.filled).toContain('revenueValidation');
    expect(fallback.bundle.revenueValidation).toEqual(reference.revenueValidation);
    expect(reconcileBundle({ ...staleLive, revenueValidation: {} }, reference).bundle.revenueValidation).toEqual({});
  });
  it('says what was filled and how to clear it', () => {
    const msg = staleLiveMessage({ filled: ['facilities'], dropped: 0 });
    expect(msg).toContain('facilities');
    expect(msg).toContain('Restart the vault API');
  });

  it('mentions unresolvable records when any were dropped', () => {
    expect(staleLiveMessage({ filled: ['facilities'], dropped: 3 })).toContain('3 record(s)');
  });

  it('says nothing when there is nothing to say', () => {
    expect(staleLiveMessage({ filled: [], dropped: 0 })).toBeNull();
    expect(staleLiveMessage({})).toBeNull();
  });
});
