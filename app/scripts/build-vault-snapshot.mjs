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
import { writeFileSync, writeSync } from 'node:fs';
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

/* SYNCHRONOUS WRITE, THEN AN EXPLICIT EXIT. Both halves matter, and both were
   learned from a CI failure that reported a bare SIGABRT with no output at all
   from a run that had already written this file.

   The exit: leaving normally lets V8 dispose the heap, which destroys the
   better-sqlite3 Statement wrappers left over from building the bundle. Their
   destructors reach node::RemoveEnvironmentCleanupHook after the Environment
   is gone, and it aborts (exit 134). Closing the database does not help — see
   the note in server/src/db.js. process.exit runs the 'exit' listeners, which
   close the vault cleanly, and then terminates without that teardown.

   The write: stdout on a pipe is asynchronous, so console.log here would be
   buffered and lost by the exit. writeSync puts it out before we leave. */
writeSync(1, `Wrote static vault snapshot from database: ${outPath} (${bundle.companies.length} companies, ${bundle.stages.length} stages, ${bundle.events.length} events)
`);
process.exit(0);
