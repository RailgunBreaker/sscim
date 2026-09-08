import { it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { acquireOperationLock, executeOperationSteps } from '../../../server/src/operations.js';
import { writeAtomicJson } from '../../../server/src/atomic-json.js';
it('retries failures, skips dependent scoring and continues independent collection', async () => {
  const seen = [];
  const rows = await executeOperationSteps([
    { id:'revenue', attempts:2 }, { id:'score', requires:['revenue'] },
    { id:'capture', skip:'already_captured' }, { id:'news' },
  ], async step => { seen.push(step.id); if (step.id === 'revenue') throw new Error('Unavailable source'); });
  expect(seen).toEqual(['revenue','revenue','news']);
  expect(rows.map(r => r.status)).toEqual(['failed','skipped_dependency','already_captured','succeeded']);
});
it('protects a running workflow and atomically replaces readable reports', () => {
  const dir = mkdtempSync(join(tmpdir(),'sscim-operations-'));
  try {
    const lock = join(dir,'lock'); const release = acquireOperationLock(lock);
    expect(() => acquireOperationLock(lock)).toThrow(/already running/);
    release(); acquireOperationLock(lock)();
    const file = join(dir,'report.json'); writeAtomicJson(file,{status:'running'}); writeAtomicJson(file,{status:'succeeded'});
    expect(JSON.parse(readFileSync(file)).status).toBe('succeeded');
  } finally {
    if (dirname(resolve(dir)) !== resolve(tmpdir()) || !basename(dir).startsWith('sscim-operations-')) throw new Error('Unsafe test cleanup target');
    rmSync(dir,{recursive:true});
  }
});
