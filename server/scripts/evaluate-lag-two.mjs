import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { attachRevenueVintages } from '../../app/src/engine/revenuePrediction.js';
import { evaluateLagTwoValidation } from '../../app/src/engine/lagTwoValidation.js';
import { writeAtomicJson } from '../src/atomic-json.js';
const root = new URL('../../',import.meta.url);
const read = path=>readFileSync(new URL(path,root));
const paths=['docs/reference/tsmc-monthly-revenue.json','docs/benchmarks/revenue-vintage-audit.json','docs/reference/prospective-protocol.json',
  'app/src/engine/lagTwoValidation.js','app/src/engine/prospectivePerformance.js','app/src/engine/revenuePrediction.js'];
const report = evaluateLagTwoValidation(attachRevenueVintages(JSON.parse(read(paths[0])),JSON.parse(read(paths[1]))),JSON.parse(read(paths[2])));
const currentPath = 'docs/reference/tsmc-revenue-current.json';
const current = JSON.parse(read(currentPath));
const asOf = new Date().toISOString().slice(0,10);
const available = current.records.filter(r => r.availableBy <= asOf);
const end = available.at(-1)?.period;
if (end >= '2026-01') {
  report.laterPeriodDiagnostic = evaluateLagTwoValidation({ ...current, records: available }, JSON.parse(read(paths[2])),
    { testStart: '2026-01', testEnd: end });
  report.laterPeriodDiagnostic.evaluatedAt = new Date().toISOString();
  report.laterPeriodDiagnostic.assessment = 'Additional retrospective months after the original 2024–2025 evaluation. No model or interval retuning. These predictions were reconstructed after outcomes were available, not captured prospectively.';
  paths.push(currentPath);
}
report.inputHashes=Object.fromEntries(paths.map(path=>[path,createHash('sha256').update(read(path)).digest('hex')]));
writeAtomicJson(new URL('docs/benchmarks/lag-two-validation.json',root),report);
console.log(JSON.stringify({status:report.status,test:report.test,comparisons:report.comparisons,beatsEveryBaseline:report.beatsEveryBaseline},null,2));
