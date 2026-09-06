import { db } from '../src/db.js';
import { syncEventEvidence } from '../src/event-evidence.js';
console.log(JSON.stringify(syncEventEvidence()));
db.pragma('wal_checkpoint(TRUNCATE)');
