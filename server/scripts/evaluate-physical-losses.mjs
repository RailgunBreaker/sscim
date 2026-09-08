import {readFileSync} from 'node:fs';
import {physicalLosses} from '../../app/src/engine/physicalLosses.js';
import {writeAtomicJson} from '../src/atomic-json.js';
const root=new URL('../../',import.meta.url),load=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const data=load('docs/reference/physical-losses.json');
const report=physicalLosses(data,load('docs/reference/recovery-durations.json'),data.reviewedAt);
if(report.rejected.length||report.rejectedRecoveryRecords.length) throw new Error(JSON.stringify(report));
writeAtomicJson(new URL('docs/benchmarks/physical-loss-evaluation.json',root),report);
console.log(JSON.stringify({records:report.records.length,incidents:report.incidentCount,chainWideLoss:report.chainWideLoss}));
