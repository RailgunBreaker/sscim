/* Load server/.env into process.env before anything reads it.

   WHY A SEPARATE MODULE. ES module imports are evaluated before the importing
   module's own body runs, so a loadEnvFile() call inside index.js would land
   AFTER routes/ and review-queue.js had already read process.env at import
   time. Importing this file first makes the load happen first.

   The API used to read no .env at all: ADMIN_TOKEN sat in the file the
   .env.example told you to write, the process never saw it, and the admin UI
   answered 503 "ADMIN_TOKEN is not set on the server" with the file right
   there on disk. */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(envPath); } catch { /* malformed .env must not block startup */ }
}
