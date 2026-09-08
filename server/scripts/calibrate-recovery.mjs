import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { calibrateRecoveryDurations } from '../../app/src/engine/recoveryCalibration.js';
import { writeAtomicJson } from '../src/atomic-json.js';
const root = new URL('../../', import.meta.url);
const load = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const inputs = ['docs/reference/recovery-durations.json', 'docs/reference/recovery-calibration-protocol.json',
  'app/src/engine/recoveryCalibration.js', 'app/src/engine/evidenceContract.js', 'app/src/engine/registry.js'];
const report = calibrateRecoveryDurations(load(inputs[0]), load(inputs[1]));
if (report.status !== 'exploratory_empirical_fit') throw new Error(JSON.stringify(report));
report.inputHashes = Object.fromEntries(inputs.map(path => [path, createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex')]));
writeAtomicJson(new URL('docs/benchmarks/recovery-calibration.json', root), report);
console.log(JSON.stringify({ status: report.status, fit: report.fit, uncertainty: report.parameterUncertainty,
  chronologicalTest: { fit: report.chronologicalTest.fit, metrics: report.chronologicalTest.metrics,
    issuerComparison: report.chronologicalTest.issuerComparison }, calibratedGlobalParameters: report.calibratedGlobalParameters }, null, 2));
