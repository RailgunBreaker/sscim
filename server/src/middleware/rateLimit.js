/* ====================================================================
   middleware/rateLimit.js — a small fixed-window limiter for the
   authenticated administrative routes.

   WHAT THIS IS FOR, and what it is not. The admin API is already behind a
   bearer token, so this is not the thing standing between the vault and
   the internet — adminAuth is. What it bounds is the damage a leaked or
   brute-forced token can do per minute, and the damage a runaway script
   can do by accident: approve/reject/publish are write paths that insert
   events, rewrite app/src/engine/event-assumptions.js and can trigger a
   git publish, and none of them had any ceiling at all.

   DELIBERATELY IN-PROCESS AND DEPENDENCY-FREE. This is a single-process
   SQLite application. A Redis-backed distributed limiter would be more
   correct for a fleet and would be dead weight here, and adding a
   dependency to the server for it would be worse than the problem. The
   counters live in a Map and reset when the process does; the mutation
   routes are also idempotent-ish and reversible, so a restart clearing a
   window is not a meaningful weakness.

   READ ROUTES ARE NOT LIMITED. The admin dashboard polls them, and a
   limiter that makes the UI stutter would be removed rather than tuned.
   Only the mutating verbs get a ceiling.

   Both numbers are configurable, and the limiter can be turned off
   entirely (SSCIM_ADMIN_RATE_LIMIT=off) for anyone who needs to run a
   bulk script.
   ==================================================================== */

const WINDOW_MS = Number(process.env.SSCIM_ADMIN_RATE_WINDOW_MS || 60_000);
const MAX_WRITES = Number(process.env.SSCIM_ADMIN_RATE_MAX || 60);

export function rateLimitEnabled() {
  return !['off', 'false', '0', 'no'].includes(String(process.env.SSCIM_ADMIN_RATE_LIMIT || 'on').trim().toLowerCase());
}

/* Pure window bookkeeping, so the policy is testable without a server.
   Returns { allowed, remaining, resetAt }. */
export function makeLimiter({ windowMs = WINDOW_MS, max = MAX_WRITES, now = () => Date.now() } = {}) {
  const buckets = new Map();

  return function take(key) {
    const t = now();
    const bucket = buckets.get(key);
    if (!bucket || t >= bucket.resetAt) {
      const fresh = { count: 1, resetAt: t + windowMs };
      buckets.set(key, fresh);
      /* Opportunistic sweep: without it a long-lived process accumulates
         one entry per distinct key forever. Cheap because it only runs on
         a window rollover, not on every request. */
      if (buckets.size > 512) {
        buckets.forEach((v, k) => { if (t >= v.resetAt) buckets.delete(k); });
      }
      return { allowed: true, remaining: max - 1, resetAt: fresh.resetAt };
    }
    bucket.count += 1;
    return { allowed: bucket.count <= max, remaining: Math.max(0, max - bucket.count), resetAt: bucket.resetAt };
  };
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function adminRateLimit({ windowMs = WINDOW_MS, max = MAX_WRITES } = {}) {
  const take = makeLimiter({ windowMs, max });

  return function limit(req, res, next) {
    if (!rateLimitEnabled() || !MUTATING.has(req.method)) return next();

    /* Keyed by the presented token rather than by IP: the point is to
       bound one credential's write rate, and behind a tunnel every request
       arrives from the same address anyway. Only a short prefix is used as
       the key so the full token never reaches a log line or an error. */
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const key = token ? `t:${token.slice(0, 8)}` : `ip:${req.ip}`;

    const { allowed, remaining, resetAt } = take(key);
    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
    if (allowed) return next();

    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: `Too many administrative writes: ${max} per ${Math.round(windowMs / 1000)}s. Retry in ${retryAfter}s.`,
      hint: 'Set SSCIM_ADMIN_RATE_MAX, or SSCIM_ADMIN_RATE_LIMIT=off, if a bulk operation needs a higher ceiling.',
    });
  };
}
