import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { prepareProspectiveNowcast } from '../../app/src/engine/prospectivePerformance.js';
const root = new URL('../../', import.meta.url);
const dataBytes = readFileSync(new URL('docs/reference/tsmc-revenue-current.json', root));
const protocolBytes = readFileSync(new URL('docs/reference/prospective-protocol.json', root));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const engineBytes = readFileSync(new URL('app/src/engine/prospectivePerformance.js', root));
const record = prepareProspectiveNowcast(JSON.parse(dataBytes), JSON.parse(protocolBytes), new Date().toISOString());
Object.assign(record, { inputSha256: hash(dataBytes), protocolSha256: hash(protocolBytes),
  engineSha256: hash(engineBytes) });
const dir = new URL('docs/prospective/', root);
mkdirSync(dir, { recursive: true });
mkdirSync(new URL('inputs/', dir), { recursive: true });
for (const [field, bytes, extension] of [['input', dataBytes, 'json'], ['protocol', protocolBytes, 'json'], ['engine', engineBytes, 'js']]) {
  const file = `inputs/${hash(bytes)}.${extension}`;
  const target = new URL(file, dir);
  if (existsSync(target)) { if (hash(readFileSync(target)) !== hash(bytes)) throw new Error('Changed archived input'); }
  else writeFileSync(target, bytes, { flag: 'wx' });
  record[`${field}SnapshotPath`] = file;
}
const payload = JSON.stringify(record);
writeFileSync(new URL(`${record.modelId}-${record.targetPeriod}.json`, dir), JSON.stringify({ record, sha256: hash(payload) }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ capturedAt: record.capturedAt, target: record.targetPeriod, prediction: record.prediction, state: record.state }));
