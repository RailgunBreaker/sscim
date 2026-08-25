import './load-env.js';
import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './db.js';
import { seedIfEmpty, seedCounts } from './seed-logic.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

// Bootstrap a brand-new database automatically (e.g. first boot on a fresh
// host) — a no-op if the vault is already populated, so this never clobbers
// live admin-API edits on a restart/redeploy.
if (seedIfEmpty()) {
  console.log('Vault was empty — auto-seeded on startup:', seedCounts());
}

const app = express();
/* An origin allowlist rather than `cors()`'s wildcard. Localhost is always
   allowed so development needs no configuration; anything else comes from
   SSCIM_ALLOWED_ORIGINS. See middleware/cors.js for why non-browser
   clients (no Origin header) still pass. */
app.use(corsMiddleware());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

/* The status console, served by the API itself.

   Why here and not in the static site: the dashboard build is a GitHub Pages
   artifact that talks to whatever VITE_API_BASE_URL was baked into it, so it
   is exactly the wrong thing to reach for when the question is "is this API
   healthy and what is it connected to". This page is served BY the process it
   describes, at the port it is listening on, so opening it proves the answer
   to the first half of the question before it renders anything.

   The HTML holds no data — every figure comes from GET /api/admin/status,
   which is behind the admin token. Read once at startup: it is a build
   artifact of the server, and re-reading it per request would only add a
   syscall to every page load. */
const STATUS_PAGE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'status-page.html'), 'utf8');
const serveStatus = (req, res) => res.type('html').send(STATUS_PAGE);
app.get('/', serveStatus);
app.get('/status', serveStatus);
app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`SSCIM vault API listening on http://localhost:${PORT}`);
});
