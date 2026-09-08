import { readFileSync, existsSync, mkdirSync, openSync, closeSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { acquireOperationLock, executeOperationSteps } from '../src/operations.js';
import { writeAtomicJson } from '../src/atomic-json.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const runtime = resolve(root, 'server/data/operations');
mkdirSync(resolve(runtime, 'runs'), { recursive: true });
const release = acquireOperationLock(resolve(runtime, 'workflow.lock'));
const startedAt = new Date().toISOString(), runId = `${startedAt.replaceAll(':','-')}-${randomUUID()}`;
const logPath = resolve(runtime, 'runs', `${runId}.log`);
const latest = resolve(runtime, 'latest.json');
const protocol = JSON.parse(readFileSync(resolve(root, 'docs/reference/prospective-protocol.json')));
if (!/^[a-z0-9-]+$/.test(protocol.version)) { release(); throw new Error('Unsafe protocol ID'); }
const captureExists = existsSync(resolve(root, `docs/prospective/${protocol.version}-${startedAt.slice(0,7)}.json`));
const steps = [
  { id: 'revenue_collection', script: 'server/scripts/refresh-revenue-current.mjs', attempts: 2 },
  { id: 'prospective_capture', script: 'server/scripts/capture-prospective-nowcast.mjs', requires: ['revenue_collection'], skip: captureExists ? 'already_captured' : null },
  { id: 'prospective_scoring', script: 'server/scripts/score-prospective-nowcasts.mjs', requires: ['revenue_collection'] },
  { id: 'loss_source_collection', script: 'server/scripts/collect-loss-disclosures.mjs', attempts: 2 },
  { id: 'loss_filing_discovery', script: 'server/scripts/monitor-loss-filings.mjs', attempts: 2 },
  { id: 'loss_accounting', script: 'server/scripts/evaluate-chain-loss.mjs' },
  { id: 'loss_reconciliation', script: 'server/scripts/evaluate-loss-reconciliations.mjs' },
  { id: 'supplier_loss_allocation', script: 'server/scripts/evaluate-supplier-loss-allocations.mjs' },
  { id: 'semiconductor_loss_followup', script: 'server/scripts/evaluate-semiconductor-loss-followup.mjs' },
  { id: 'recovery_calibration', script: 'server/scripts/calibrate-recovery.mjs' },
  { id: 'physical_loss_accounting', script: 'server/scripts/evaluate-physical-losses.mjs' },
  { id: 'lag_two_validation', script: 'server/scripts/evaluate-lag-two.mjs' },
  { id: 'news_collection', script: 'server/scripts/pipeline.mjs', args: ['--local-only','--no-ai','--no-triage','--no-quotes'], timeoutMs: 15 * 60000 },
  { id: 'news_scoring', script: 'server/scripts/monitor-prospective-news.mjs', requires: ['news_collection'] },
  { id: 'structured_export', script: 'server/scripts/export-structured-evidence.mjs', args: ['--retain=2'] },
  { id: 'snapshot', script: 'app/scripts/build-vault-snapshot.mjs', requires: ['structured_export'] },
];
function invoke(step) {
  appendFileSync(logPath, `\n[${new Date().toISOString()}] ${step.id}\n`);
  const fd = openSync(logPath, 'a');
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [resolve(root, step.script), ...(step.args || [])],
      { cwd: root, windowsHide: true, stdio: ['ignore', fd, fd], timeout: step.timeoutMs || 5 * 60000 });
    child.once('error', reject);
    child.once('close', (code, signal) => { closeSync(fd); code === 0 ? done() : reject(new Error(`${step.id}: exit ${code}, signal ${signal || 'none'}; see local run log`)); });
  });
}
let report = { runId, startedAt, status: 'running', localOnly: true, steps: [] };
try {
  writeAtomicJson(latest, report);
  report.steps = await executeOperationSteps(steps, invoke);
  report.status = report.steps.some(s => ['failed','skipped_dependency'].includes(s.status)) ? 'degraded' : 'succeeded';
  report.completedAt = new Date().toISOString();
  writeAtomicJson(resolve(runtime, 'runs', `${runId}.json`), report);
  writeAtomicJson(latest, report);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'succeeded') process.exitCode = 1;
} finally { release(); }
