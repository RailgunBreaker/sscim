import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

export function acquireOperationLock(path) {
  mkdirSync(dirname(path), { recursive: true });
  const lock = { pid: process.pid, host: hostname(), token: randomUUID(), startedAt: new Date().toISOString() };
  try { writeFileSync(path, JSON.stringify(lock), { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const old = JSON.parse(readFileSync(path));
    if (old.host !== hostname() || !Number.isInteger(old.pid) || old.pid <= 0) throw new Error('Unrecognized operations lock; inspect before recovery');
    let alive = true;
    try { process.kill(old.pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; else throw e; }
    if (alive) throw new Error(`Operations already running (PID ${old.pid})`);
    unlinkSync(path);
    writeFileSync(path, JSON.stringify(lock), { flag: 'wx' });
  }
  return () => { if (JSON.parse(readFileSync(path)).token === lock.token) unlinkSync(path); };
}

export async function executeOperationSteps(steps, invoke, now = () => new Date().toISOString()) {
  const results = [];
  for (const step of steps) {
    if (step.skip) { results.push({ id: step.id, status: step.skip }); continue; }
    const unavailable = (step.requires || []).filter(id => !['succeeded','already_captured'].includes(results.find(r => r.id === id)?.status));
    if (unavailable.length) { results.push({ id: step.id, status: 'skipped_dependency', unavailable }); continue; }
    const result = { id: step.id, startedAt: now(), attempts: 0, status: 'failed' };
    for (let i = 0; i < (step.attempts || 1); i++) {
      result.attempts++;
      try { await invoke(step); result.status = 'succeeded'; delete result.error; break; }
      catch (error) { result.error = error.message.slice(0, 600); }
    }
    result.completedAt = now(); results.push(result);
  }
  return results;
}
