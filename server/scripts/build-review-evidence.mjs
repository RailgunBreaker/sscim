import { writeFileSync } from 'node:fs';
import { db } from '../src/db.js';
import { getEvents } from '../src/bundle.js';
import { FACILITY_EVIDENCE } from '../src/facility-evidence.js';

db.exec('CREATE TABLE IF NOT EXISTS facility_evidence (facility_id TEXT PRIMARY KEY, evidence_json TEXT NOT NULL, original_record_json TEXT NOT NULL)');
for (const [id, evidence] of Object.entries(FACILITY_EVIDENCE)) {
  const row = db.prepare('SELECT * FROM facilities WHERE id=?').get(id);
  db.prepare('INSERT OR IGNORE INTO facility_evidence VALUES (?, ?, ?)').run(id, JSON.stringify(evidence), JSON.stringify(row));
  const output = id === 'tsmc_fab18' ? 'Leading-edge logic wafers; 5nm and 3nm production supported by the cited TSMC announcement' : 'EUV and DUV lithography system assembly';
  db.prepare('UPDATE facilities SET source=?, output=? WHERE id=?').run(`${evidence.publisher}: ${evidence.url}; ${evidence.supportingSection}; scale is an analyst judgement.`, output, id);
}
const events = getEvents();
writeFileSync(new URL('../../docs/reference/event-evidence.json', import.meta.url), JSON.stringify({ revision: 'public-review-2026-09-06', events: events.map(e => ({ id: e.id, incidentId: e.incidentId, evidence: e.evidence })),
  originalRecords: db.prepare('SELECT event_id, original_record_json FROM event_evidence ORDER BY event_id').all().map(r => ({ eventId: r.event_id, original: JSON.parse(r.original_record_json) })) }, null, 2) + '\n');
writeFileSync(new URL('../../docs/reference/facility-evidence.json', import.meta.url), JSON.stringify(FACILITY_EVIDENCE, null, 2) + '\n');
db.pragma('wal_checkpoint(TRUNCATE)');
console.log(`Exported ${events.length} evidence decisions and two scoped demonstration-site reviews; all site-to-site shipments remain unverified.`);
