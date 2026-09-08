import { readFileSync, existsSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
import { recentLossFilings, lossDisclosureCandidate, mergeLossCandidates } from '../src/loss-filing-monitor.js';
const root=new URL('../../',import.meta.url);
const path=new URL('docs/operational-monitor/loss-filing-candidates.json',root);
const previous=existsSync(path)?JSON.parse(readFileSync(path)):{candidates:[]};
const checkedAt=new Date().toISOString(),asOf=checkedAt.slice(0,10);
const issuers=[{companyId:'wdc',cik:'106040',forms:['10-K','10-Q'],limit:4},
  {companyId:'sandisk',cik:'2023554',forms:['10-K','10-Q'],limit:4},
  {companyId:'tsmc',cik:'1046179',forms:['20-F'],limit:3}];
const checks=[],found=[];
const referenceFiling={companyId:'wdc',form:'10-K',publicationDate:'2024-08-20',discoveryKind:'historical_reference',
  url:'https://www.sec.gov/Archives/edgar/data/106040/000010604024000031/wdc-20240628.htm'};
async function fetchText(url) {
  await new Promise(r=>setTimeout(r,200));
  const response=await fetch(url,{headers:{'User-Agent':'SSCIM public-source research'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('HTTP '+response.status);
  return response.text();
}
for(const issuer of issuers) {
  try {
    const url=`https://data.sec.gov/submissions/CIK${issuer.cik.padStart(10,'0')}.json`;
    const filings=recentLossFilings(JSON.parse(await fetchText(url)),issuer,asOf);
    if(!filings.length)throw new Error('No eligible filings returned');
    for(const filing of filings) {
      try {
        const body=await fetchText(filing.url);
        if(!/<(?:html|body)\b/i.test(body)||body.length<1000)throw new Error('Unexpected filing response');
        const candidate=lossDisclosureCandidate(filing,body,checkedAt);
        if(candidate)found.push(candidate);
        checks.push({companyId:issuer.companyId,url:filing.url,publicationDate:filing.publicationDate,status:'retrieved',candidateId:candidate?.id||null});
      }catch(error){checks.push({companyId:issuer.companyId,url:filing.url,status:'unavailable',error:error.message});}
    }
  }catch(error){checks.push({companyId:issuer.companyId,status:'discovery_unavailable',error:error.message});}
}
// A known relevant historical filing checks that the collector/parser can still
// discover a recovery. It is explicitly a backfill, never prospective evidence.
try {
  const body=await fetchText(referenceFiling.url);
  const candidate=lossDisclosureCandidate(referenceFiling,body,checkedAt);
  if(!candidate)throw new Error('Known recovery reference no longer matches; inspect source/parser');
  found.push({...candidate,discoveryKind:'historical_reference'});
  checks.push({companyId:'wdc',url:referenceFiling.url,status:'retrieved',discoveryKind:'historical_reference',candidateId:candidate.id});
} catch(error){checks.push({companyId:'wdc',url:referenceFiling.url,status:'reference_check_failed',error:error.message});}
const report={schemaVersion:1,checkedAt,startedAt:previous.startedAt||checkedAt,issuers,checks,
  candidates:mergeLossCandidates(previous.candidates,found),
  newCandidates:found.filter(c=>!previous.candidates.some(p=>p.id===c.id)).length,
  unavailable:checks.filter(c=>c.status!=='retrieved').length,
  scope:'Latest four WDC and Sandisk quarterly/annual primary documents, latest three TSMC annual primary documents in SEC recent submissions, and one known historical recovery reference. Not all historical filings or exhibits.',
  limitations:['Keyword co-occurrence creates review candidates, not verified losses or supplier attribution.','A filing without a match is not evidence of zero loss or no reimbursement.','Amounts and counterparty identities require source review before analytical use.']};
writeAtomicJson(path,report);
console.log(JSON.stringify({checked:checks.length,candidates:report.candidates.length,newCandidates:report.newCandidates,unavailable:report.unavailable}));
if(report.unavailable)process.exitCode=1;
