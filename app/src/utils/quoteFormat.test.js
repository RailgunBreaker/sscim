import { describe, it, expect } from 'vitest';
import {
  relativeTime, priceAge, isStalePrice, formatPrice, formatChange,
  quoteStatus, fetchLag, marketState, STALE_PRICE_MS,
} from './quoteFormat.js';

const NOW = Date.parse('2026-11-23T01:12:00.000Z');
const iso = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('relative time', () => {
  it('rounds coarsely rather than claiming false precision', () => {
    expect(relativeTime(iso(10 * 1000), NOW)).toBe('just now');
    expect(relativeTime(iso(4 * MIN), NOW)).toBe('4 min ago');
    expect(relativeTime(iso(3 * HOUR), NOW)).toBe('3 hours ago');
    expect(relativeTime(iso(2 * DAY), NOW)).toBe('2 days ago');
    expect(relativeTime(iso(400 * DAY), NOW)).toBe('1 year ago');
  });

  it('singularises', () => {
    expect(relativeTime(iso(1 * HOUR), NOW)).toBe('1 hour ago');
    expect(relativeTime(iso(1 * DAY), NOW)).toBe('1 day ago');
  });

  it('never says a timestamp is in the future, which clock skew would cause', () => {
    expect(relativeTime(new Date(NOW + 5 * MIN).toISOString(), NOW)).toBe('just now');
  });

  it('returns null for a missing or unparseable timestamp', () => {
    expect(relativeTime(null, NOW)).toBeNull();
    expect(relativeTime('not a date', NOW)).toBeNull();
  });
});

describe('which timestamp the age comes from', () => {
  /* The whole point of this module. On a Sunday, a Friday close fetched
     a minute ago is a two-day-old PRICE, and the headline age has to say
     two days or the reader will read it as live. */
  it('ages the price by its trade time, not by our fetch time', () => {
    const q = { marketTime: iso(2 * DAY), asOf: iso(1 * MIN) };
    const age = priceAge(q, NOW);
    expect(age.text).toBe('2 days ago');
    expect(age.fromFetchTime).toBe(false);
  });

  it('falls back to the fetch time only when there is no trade time, and says so', () => {
    const q = { asOf: iso(30 * MIN) };
    const age = priceAge(q, NOW);
    expect(age.text).toBe('30 min ago');
    expect(age.fromFetchTime).toBe(true);
  });
});

describe('staleness', () => {
  it('treats a price older than a trading day as not live', () => {
    expect(isStalePrice({ marketTime: iso(2 * DAY) }, NOW)).toBe(true);
    expect(isStalePrice({ marketTime: iso(2 * HOUR) }, NOW)).toBe(false);
    expect(isStalePrice({ marketTime: iso(STALE_PRICE_MS + MIN) }, NOW)).toBe(true);
  });

  it('treats a quote with no timestamp at all as stale rather than current', () => {
    expect(isStalePrice({}, NOW)).toBe(true);
  });
});

describe('price and change formatting', () => {
  it('formats USD and other currencies differently', () => {
    expect(formatPrice({ price: 125.53, currency: 'USD' })).toBe('$125.53');
    expect(formatPrice({ price: 174600, currency: 'KRW' })).toBe('174,600 KRW');
  });

  it('gives both the cash change and the percentage', () => {
    const c = formatChange({ price: 125.53, change: -20.45, changePct: -14.0123 });
    expect(c.dir).toBe('down');
    expect(c.absText).toBe('−20.45');
    expect(c.pctText).toBe('−14.01%');
    expect(c.text).toBe('−20.45 (−14.01%)');
  });

  it('derives the cash change from the previous close when the feed omits it', () => {
    /* A percentage with no cash figure is half a quote. */
    const c = formatChange({ price: 110, prevClose: 100, changePct: 10 });
    expect(c.absText).toBe('+10.00');
    expect(c.dir).toBe('up');
  });

  it('returns null when there is nothing to report', () => {
    expect(formatChange({ price: 10 })).toBeNull();
    expect(formatChange(null)).toBeNull();
  });
});

describe('market status', () => {
  it('uses the vocabulary a quote screen already uses', () => {
    expect(marketState('REGULAR').label).toBe('Market open');
    expect(marketState('CLOSED').label).toBe('At close');
    expect(marketState('PRE').label).toBe('Pre-market');
    expect(marketState('POST').label).toBe('After hours');
  });

  it('surfaces an unrecognised state instead of flattening it to closed', () => {
    const s = marketState('SOMETHING_NEW');
    expect(s.known).toBe(false);
    expect(s.label).toBe('SOMETHING_NEW');
    expect(s.live).toBe(false);
  });

  it('pulses only while the price can actually move', () => {
    expect(quoteStatus({ marketState: 'REGULAR', marketTime: iso(MIN) }, NOW).live).toBe(true);
    expect(quoteStatus({ marketState: 'POST', marketTime: iso(MIN) }, NOW).live).toBe(true);
    expect(quoteStatus({ marketState: 'CLOSED', marketTime: iso(MIN) }, NOW).live).toBe(false);
  });

  it('refuses to call a day-old price live even when the feed still says REGULAR', () => {
    /* A cached REGULAR must not pulse: the state field is a label, the
       timestamp is evidence, and the evidence wins. */
    const s = quoteStatus({ marketState: 'REGULAR', marketTime: iso(3 * DAY) }, NOW);
    expect(s.live).toBe(false);
    expect(s.stale).toBe(true);
  });
});

describe('fetch lag', () => {
  it('stays quiet while our copy is current', () => {
    expect(fetchLag({ asOf: iso(2 * MIN), marketTime: iso(2 * MIN) }, NOW)).toBeNull();
  });

  it('reports how old our copy is once it is meaningfully behind', () => {
    expect(fetchLag({ asOf: iso(3 * HOUR), marketTime: iso(3 * HOUR) }, NOW)).toBe('3 hours ago');
  });

  it('needs both timestamps to say anything', () => {
    expect(fetchLag({ asOf: iso(3 * HOUR) }, NOW)).toBeNull();
  });
});

describe('the real shapes the snapshot ships', () => {
  it('reads a US close on a weekend as a two-day-old price, not a live one', () => {
    const nvda = {
      ticker: 'NVDA', price: 125.53, currency: 'USD', change: -20.45, changePct: -14.0123,
      prevClose: 145.98, marketState: 'CLOSED',
      marketTime: '2026-11-20T21:00:01.000Z', asOf: '2026-11-23T01:12:16.524Z',
    };
    const s = quoteStatus(nvda, NOW);
    expect(s.label).toBe('At close');
    expect(s.live).toBe(false);
    expect(s.stale).toBe(true);
    expect(s.age).toBe('2 days ago');
  });

  it('reads an open Korean session as live even while the US is shut', () => {
    const samsung = {
      ticker: '005930.KS', price: 174600, currency: 'KRW', change: -8500, changePct: -4.6407,
      marketState: 'REGULAR',
      marketTime: '2026-11-23T00:52:12.000Z', asOf: '2026-11-23T01:12:16.524Z',
    };
    const s = quoteStatus(samsung, NOW);
    expect(s.label).toBe('Market open');
    expect(s.live).toBe(true);
    expect(s.stale).toBe(false);
  });
});
