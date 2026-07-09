import express from 'express';
import cors from 'cors';
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
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`SSCIM vault API listening on http://localhost:${PORT}`);
});
