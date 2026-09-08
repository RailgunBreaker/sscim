import { mkdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
export function writeAtomicJson(path, value) {
  const target = path instanceof URL ? fileURLToPath(path) : path;
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    renameSync(temp, target);
  } finally { try { unlinkSync(temp); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
}
