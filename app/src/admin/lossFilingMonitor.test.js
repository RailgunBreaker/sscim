import { it, expect } from 'vitest';
import { recentLossFilings, lossDisclosureCandidate, mergeLossCandidates } from '../../../server/src/loss-filing-monitor.js';
import { evidenceStatus } from '../../../server/src/structured-evidence.js';
const filing={companyId:'wdc',form:'10-K',publicationDate:'2024-08-20',url:'https://www.sec.gov/example.htm'};
const body='<html><body><p>Contamination caused a loss. We received an insurance recovery of $36 million.</p></body></html>';
it('queues co-occurring evidence without extracting an amount or declaring verification',()=>{
  const c=lossDisclosureCandidate(filing,body,'2026-09-08T00:00:00Z');
  expect(c).toMatchObject({numericLoss:null,counterpartyId:null,claimStatus:'unreviewed',reviewState:'pending'});
  expect(c.topics).toEqual(['material_incident','recovery']);
  expect(c.excerpt.split(/\s+/).length).toBeLessThanOrEqual(24);
  expect(evidenceStatus(c,'docs/operational-monitor/loss-filing-candidates.json')).toBe('unreviewed');
});
it('requires co-occurrence rather than joining unrelated risk and reimbursement paragraphs',()=>{
  expect(lossDisclosureCandidate(filing,'<p>Contamination risk.</p><p>Executive reimbursement.</p>','now')).toBeNull();
  expect(lossDisclosureCandidate(filing,'<script>'+body+'</script>','now')).toBeNull();
});
it('preserves first observation and prior review state but reopens changed documents',()=>{
  const old={...lossDisclosureCandidate(filing,body,'2026-09-07T00:00:00Z'),reviewState:'reviewed',reviewedClaimIds:['claim']};
  const next=lossDisclosureCandidate(filing,body,'2026-09-08T00:00:00Z');
  expect(mergeLossCandidates([old],[next])[0]).toMatchObject({firstSeenAt:old.firstSeenAt,lastSeenAt:next.lastSeenAt,reviewState:'reviewed'});
  const changed=lossDisclosureCandidate(filing,body+' changed','2026-09-08T00:00:00Z');
  expect(mergeLossCandidates([old],[changed])[0]).toMatchObject({reviewState:'source_changed',reviewedClaimIds:[]});
  expect(mergeLossCandidates([old],[])).toEqual([old]);
});
it('retains review across script-only changes while tracking the changed source bytes',()=>{
  const old={...lossDisclosureCandidate(filing,body,'2026-09-07T00:00:00Z'),reviewState:'reviewed',reviewedClaimIds:['claim']};
  const next=lossDisclosureCandidate(filing,body+'<script>requestId=123</script>','2026-09-08T00:00:00Z');
  expect(next.sourceSha256).not.toBe(old.sourceSha256);
  expect(next.evidenceSha256).toBe(old.evidenceSha256);
  expect(mergeLossCandidates([old],[next])[0]).toMatchObject({reviewState:'reviewed',reviewedClaimIds:['claim'],sourceChangedSincePreviousCheck:true});
});
it('selects dated primary reports and prevents arbitrary URLs or archive paths',()=>{
  const r={filings:{recent:{accessionNumber:['0000106040-24-000031','0000106040-27-000031','0000106040-23-000031'],form:['10-K','10-K','10-K'],filingDate:['2024-08-20','2027-01-01','2023-08-20'],primaryDocument:['wdc.htm','future.htm','../../bad.htm']}}};
  const options={companyId:'wdc',cik:'106040',forms:['10-K'],limit:4};
  expect(recentLossFilings(r,options,'2026-09-08').map(r=>r.url)).toEqual(['https://www.sec.gov/Archives/edgar/data/106040/000010604024000031/wdc.htm']);
  expect(()=>recentLossFilings(r,{...options,cik:'../123'},'2026-09-08')).toThrow();
});
