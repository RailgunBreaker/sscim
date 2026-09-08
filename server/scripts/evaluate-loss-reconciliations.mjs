import { readFileSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
import { lossReconciliation } from '../../app/src/engine/lossReconciliation.js';
const root=new URL('../../',import.meta.url);
const data=JSON.parse(readFileSync(new URL('docs/reference/loss-reconciliations.json',root)));
const report=lossReconciliation(data,new Date().toISOString().slice(0,10));
if(report.rejected.length || report.bridges.some(b=>!['reconciled','consistent_with_source_rounding'].includes(b.status))) throw new Error('Reconciliation validation failed: '+JSON.stringify(report));
const examples={ sonySegments:report.subtotal(['sony_fy16_semiconductors','sony_fy16_imaging','sony_fy16_corporate']),
  westernDigitalNetRecognizedCost:report.subtotal(['wdc_power_cost_fy2020','wdc_power_recovery_fy2021','wdc_power_recovery_fy2022']) };
writeAtomicJson(new URL('docs/benchmarks/loss-reconciliation-evaluation.json',root),{...report,subtotal:undefined,examples});
console.log(JSON.stringify({records:report.records.length,bridges:report.bridges.map(b=>({id:b.id,status:b.status,residual:b.residual})),examples},null,2));
