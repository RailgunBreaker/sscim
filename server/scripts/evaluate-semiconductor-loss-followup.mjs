import { readFileSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
import { semiconductorLossFollowup } from '../../app/src/engine/semiconductorLossFollowup.js';
const root=new URL('../../',import.meta.url);
const data=JSON.parse(readFileSync(new URL('docs/reference/semiconductor-loss-followup.json',root)));
const report=semiconductorLossFollowup(data,new Date().toISOString().slice(0,10));
if(report.rejected.length||report.accounts.some(r=>r.status==='invalid_recovery_selection'))throw new Error('Invalid semiconductor loss follow-up');
writeAtomicJson(new URL('docs/benchmarks/semiconductor-loss-followup-evaluation.json',root),{...report,recoverySubtotal:undefined});
console.log(JSON.stringify({accounts:report.accounts.length,downstream:report.downstream.length,selectedNet:report.accounts[0]?.netOfSelectedRecoveries}));
