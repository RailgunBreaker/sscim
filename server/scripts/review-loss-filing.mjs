import { readFileSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
import { reviewedClaim } from '../../app/src/engine/evidenceContract.js';
import { acquireOperationLock } from '../src/operations.js';
import { fileURLToPath } from 'node:url';
const root=new URL('../../',import.meta.url);
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
if(!args.id||!['linked','irrelevant','needs_data'].includes(args.decision)||!args.reason||!args.sha256)throw new Error('Use --id=... --decision=linked|irrelevant|needs_data --reason=... --sha256=<reviewed candidate hash> [--claims=id,id]');
const release=acquireOperationLock(fileURLToPath(new URL('server/data/operations/workflow.lock',root)));
try {
  const path=new URL('docs/operational-monitor/loss-filing-candidates.json',root);
  const report=JSON.parse(readFileSync(path)), candidate=report.candidates.find(c=>c.id===args.id);
  if(!candidate||candidate.sourceSha256!==args.sha256)throw new Error('Candidate missing or changed since review');
  const claimIds=(args.claims||'').split(',').filter(Boolean);
  if(args.decision==='linked') {
    const data=JSON.parse(readFileSync(new URL('docs/reference/semiconductor-loss-followup.json',root)));
    const claims=[...data.bases,...data.recoveries,...data.downstream];
    if(!claimIds.length||new Set(claimIds).size!==claimIds.length||claimIds.some(id=>!claims.some(c=>c.id===id&&c.source.url===candidate.sourceUrl&&reviewedClaim(c,new Date().toISOString().slice(0,10)))))throw new Error('Links require existing reviewed claims from this exact filing');
  } else if(claimIds.length)throw new Error('Only linked decisions accept claim IDs');
  candidate.reviewState=args.decision==='linked'?'reviewed':args.decision;
  candidate.reviewedClaimIds=claimIds;
  candidate.review={reviewedAt:new Date().toISOString(),reason:args.reason,sourceSha256:args.sha256,evidenceSha256:candidate.evidenceSha256||null};
  // Candidate remains unreviewed as a numerical label; only linked claim records
  // carry their independently scoped disclosure-review status.
  writeAtomicJson(path,report);
  console.log(JSON.stringify({id:candidate.id,reviewState:candidate.reviewState,reviewedClaimIds:claimIds}));
}finally{release();}
