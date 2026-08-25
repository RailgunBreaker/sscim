/* ====================================================================
   middleware/cors.js — a configurable origin allowlist.

   WHAT WAS THERE. `app.use(cors())` — Access-Control-Allow-Origin: * on
   every route. For a process bound to localhost that is unremarkable, and
   it stayed unremarkable right up until the API is reachable through a
   tunnel or a public host, at which point any page on the internet can
   read the vault from a visitor's browser. The admin routes are still
   behind a bearer token, so this is not an authentication hole; it is the
   difference between "anyone who has the token" and "any website the
   token-holder happens to visit".

   WHAT THIS DOES INSTEAD.

     · Local development is unconditionally allowed. Any localhost or
       127.0.0.1 origin on any port passes, so `npm run dev` needs no
       configuration and nothing about the existing workflow changes.
       This is the case that must not regress: a security control that
       breaks the development loop gets deleted within a week.

     · Additional origins come from SSCIM_ALLOWED_ORIGINS, comma-separated.
       That is where a tunnel or a deployed front end goes.

     · Requests with NO Origin header are allowed. Those are not browser
       cross-origin requests at all — curl, the pipeline scripts, a health
       check — and CORS has nothing to say about them. Blocking them would
       break the tooling while protecting nothing, since a non-browser
       client is not bound by CORS in the first place.

     · SSCIM_ALLOW_ALL_ORIGINS=on restores the old behaviour explicitly,
       for anyone who needs it and has decided to. It logs a warning at
       startup so it cannot be on by accident and forgotten.

   The static site is unaffected either way: it falls back to its bundled
   snapshot when the API is unreachable, which is exactly what a blocked
   origin looks like to it.
   ==================================================================== */

import cors from 'cors';

const LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function allowedOrigins() {
  return String(process.env.SSCIM_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function allowAllOrigins() {
  return ['on', 'true', '1', 'yes'].includes(String(process.env.SSCIM_ALLOW_ALL_ORIGINS || '').trim().toLowerCase());
}

/* Pure, so the policy is testable without starting a server. Returns true
   when the origin should be allowed. */
export function isOriginAllowed(origin, { allowAll = allowAllOrigins(), list = allowedOrigins() } = {}) {
  // No Origin header: not a browser cross-origin request. See the header.
  if (!origin) return true;
  if (allowAll) return true;
  if (LOCAL_RE.test(origin)) return true;
  return list.includes(origin);
}

export function corsMiddleware() {
  if (allowAllOrigins()) {
    console.warn('[cors] SSCIM_ALLOW_ALL_ORIGINS is on — every origin may read this API from a browser.');
  }
  const list = allowedOrigins();
  if (list.length) console.log(`[cors] allowing localhost plus: ${list.join(', ')}`);

  return cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      /* Refuse by omitting the header rather than by throwing: an error
         here becomes a 500, which reads as "the API is broken" when the
         truthful answer is "this origin is not allowed". Without the
         header the browser blocks the read itself, which is the correct
         and legible outcome. */
      return callback(null, false);
    },
    credentials: false,
  });
}
