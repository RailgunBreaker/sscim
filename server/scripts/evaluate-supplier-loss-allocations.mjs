import { readFileSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
import { supplierLossAllocation } from '../../app/src/engine/supplierLossAllocation.js';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('docs/reference/supplier-loss-allocations.json', root)));
const report = supplierLossAllocation(data, new Date().toISOString().slice(0,10));
if (report.rejected.length || report.coverage.invalidBases) throw new Error('Supplier allocation validation failed: ' + JSON.stringify(report.rejected));
writeAtomicJson(new URL('docs/benchmarks/supplier-loss-allocation-evaluation.json', root), report);
console.log(JSON.stringify(report.coverage));
