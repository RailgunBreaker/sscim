/* Generates app/src/data/vault-snapshot.json — a static export of the vault,
   read straight from the SQLite database at server/data/sscim.db (the same
   database the live backend serves and the admin API writes to). The database
   file is committed to the repo, so it — not any JS seed file — is the single
   source of truth: edit the vault (admin API or SQL), re-run this script (or
   just build), commit the updated .db, and the GitHub Pages deploy rebuilds
   the bundled snapshot from it.

   Runs automatically before `npm run dev` and `npm run build` (see package.json
   "predev"/"prebuild"); re-run manually via `npm run snapshot`. If the database
   is missing or empty (e.g. a fresh clone before the .db was ever committed),
   it is bootstrapped once from server/src/seed-data.js. Also checkpoints the
   WAL so the .db file on disk is complete and safe to commit. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { db } from '../../server/src/db.js';
import { seedIfEmpty } from '../../server/src/seed-logic.js';
import { buildBundle } from '../../server/src/bundle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (seedIfEmpty()) {
  console.log('Vault database was empty — bootstrapped it from server/src/seed-data.js.');
}

const bundle = buildBundle();

// Fold any WAL content into the main .db file so the committed file is the
// whole database (the -wal/-shm sidecars stay gitignored).
db.pragma('wal_checkpoint(TRUNCATE)');

const outPath = resolve(__dirname, '../src/data/vault-snapshot.json');
writeFileSync(outPath, JSON.stringify(bundle), 'utf8');
console.log(`Wrote static vault snapshot from database: ${outPath} (${bundle.companies.length} companies, ${bundle.stages.length} stages, ${bundle.events.length} events)`);
