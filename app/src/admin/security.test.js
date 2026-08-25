/* The two MVP security controls on the vault API.

   Both live in server/src/middleware/ but are tested here because `app`
   owns the only vitest runner, and both were written as pure predicates
   specifically so they could be tested without starting a server.

   Neither of these is the thing protecting the admin API — adminAuth and
   its bearer token are. What they bound is the blast radius: which
   browsers can read the vault cross-origin, and how much damage one
   credential can do per minute on the write paths. */
import { describe, it, expect } from 'vitest';
import { isOriginAllowed } from '../../../server/src/middleware/cors.js';
import { makeLimiter } from '../../../server/src/middleware/rateLimit.js';

describe('CORS origin allowlist', () => {
  const opts = (over = {}) => ({ allowAll: false, list: [], ...over });

  /* The case that must not regress: a security control that breaks the
     development loop gets deleted within a week. */
  it('always allows local development, on any port', () => {
    for (const origin of [
      'http://localhost:5173', 'http://localhost:8787', 'https://localhost:3000',
      'http://127.0.0.1:5173', 'http://[::1]:5173', 'http://localhost',
    ]) {
      expect(isOriginAllowed(origin, opts()), origin).toBe(true);
    }
  });

  it('refuses an origin that is not on the list', () => {
    expect(isOriginAllowed('https://evil.example.com', opts())).toBe(false);
    expect(isOriginAllowed('https://sscim.example.org', opts())).toBe(false);
  });

  it('allows exactly what SSCIM_ALLOWED_ORIGINS names', () => {
    const list = ['https://sscim.example.org', 'https://tunnel.example.dev'];
    expect(isOriginAllowed('https://sscim.example.org', opts({ list }))).toBe(true);
    expect(isOriginAllowed('https://tunnel.example.dev', opts({ list }))).toBe(true);
    expect(isOriginAllowed('https://other.example.org', opts({ list }))).toBe(false);
  });

  it('does not match an allowed origin as a prefix or a subdomain', () => {
    const list = ['https://sscim.example.org'];
    expect(isOriginAllowed('https://sscim.example.org.evil.com', opts({ list }))).toBe(false);
    expect(isOriginAllowed('https://evil-sscim.example.org', opts({ list }))).toBe(false);
    // A near-miss on the localhost pattern must not pass either.
    expect(isOriginAllowed('https://localhost.evil.com', opts())).toBe(false);
    expect(isOriginAllowed('https://notlocalhost', opts())).toBe(false);
  });

  /* No Origin header means it is not a browser cross-origin request at
     all — curl, the pipeline scripts, a health check. CORS has nothing to
     say about those, and blocking them would break the tooling while
     protecting nothing. */
  it('allows a request with no Origin header', () => {
    expect(isOriginAllowed(undefined, opts())).toBe(true);
    expect(isOriginAllowed('', opts())).toBe(true);
    expect(isOriginAllowed(null, opts())).toBe(true);
  });

  it('restores wildcard behaviour only when explicitly asked', () => {
    expect(isOriginAllowed('https://evil.example.com', opts({ allowAll: true }))).toBe(true);
  });
});

describe('admin write rate limiter', () => {
  it('allows up to the ceiling and refuses past it', () => {
    const take = makeLimiter({ windowMs: 1000, max: 3, now: () => 0 });
    expect(take('k').allowed).toBe(true);
    expect(take('k').allowed).toBe(true);
    expect(take('k').allowed).toBe(true);
    expect(take('k').allowed).toBe(false);
  });

  it('counts each credential separately', () => {
    const take = makeLimiter({ windowMs: 1000, max: 1, now: () => 0 });
    expect(take('a').allowed).toBe(true);
    expect(take('b').allowed).toBe(true);
    expect(take('a').allowed).toBe(false);
  });

  it('resets when the window rolls over', () => {
    let t = 0;
    const take = makeLimiter({ windowMs: 1000, max: 1, now: () => t });
    expect(take('k').allowed).toBe(true);
    expect(take('k').allowed).toBe(false);
    t = 1000;
    expect(take('k').allowed).toBe(true);
  });

  it('reports the remaining budget and when it resets', () => {
    const take = makeLimiter({ windowMs: 1000, max: 2, now: () => 0 });
    const first = take('k');
    expect(first.remaining).toBe(1);
    expect(first.resetAt).toBe(1000);
    expect(take('k').remaining).toBe(0);
    expect(take('k').remaining).toBe(0); // never negative
  });

  /* A long-lived process must not accumulate one entry per key forever. */
  it('sweeps expired buckets rather than growing without bound', () => {
    let t = 0;
    const take = makeLimiter({ windowMs: 10, max: 100, now: () => t });
    for (let i = 0; i < 600; i += 1) take(`k${i}`);
    t = 1000;
    for (let i = 0; i < 600; i += 1) expect(take(`k${i}`).allowed).toBe(true);
  });
});
