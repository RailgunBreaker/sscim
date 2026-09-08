import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { scoreProspectiveNowcasts } from '../../app/src/engine/prospectivePerformance.js';
import { writeAtomicJson } from '../src/atomic-json.js';
import { prospectiveScoreSummary } from '../../app/src/engine/prospectiveScoreSummary.js';
import { prospectiveReleaseStatus } from '../../app/src/engine/prospectiveReleaseStatus.js';
const root = new URL('../../', import.meta.url);
const records = readdirSync(new URL('docs/prospective/', root)).filter(f => f.endsWith('.json')).map(file => {
  const envelope = JSON.parse(readFileSync(new URL(`docs/prospective/${file}`, root)));
  if (createHash('sha256').update(JSON.stringify(envelope.record)).digest('hex') !== envelope.sha256) throw new Error(`Changed forecast: ${file}`);
  for (const field of ['input', 'protocol', 'engine']) {
    const path = envelope.record[`${field}SnapshotPath`];
    if (!/^inputs\/[a-f0-9]{64}\.(json|js)$/.test(path)) throw new Error('Invalid archive path');
    const bytes = readFileSync(new URL(`docs/prospective/${path}`, root));
    if (createHash('sha256').update(bytes).digest('hex') !== envelope.record[`${field}Sha256`]) throw new Error('Changed forecast input/protocol/engine');
  }
  return envelope.record;
});
const data = JSON.parse(readFileSync(new URL('docs/reference/tsmc-revenue-current.json', root)));
const report = scoreProspectiveNowcasts(records, data, new Date().toISOString());
report.metrics = prospectiveScoreSummary(report, records, JSON.parse(readFileSync(new URL('docs/reference/prospective-protocol.json', root))));
report.releaseStatus = prospectiveReleaseStatus(records, report, JSON.parse(readFileSync(new URL('docs/reference/prospective-release-schedule.json', root))), report.asOf);
writeAtomicJson(new URL('docs/benchmarks/prospective-performance.json', root), report);
console.log(JSON.stringify(report, null, 2));
