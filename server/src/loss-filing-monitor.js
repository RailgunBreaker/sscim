import { createHash } from 'node:crypto';
import { validDate } from '../../app/src/engine/evidenceContract.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const topics = [
  {id:'material_incident',pattern:/\b(contamination|photoresist|defective material|unqualified material)\b/i},
  {id:'recovery',pattern:/\b(recover(?:y|ies|ed)?|reimburs\w*|compensat\w*|insurance|insurers?)\b/i},
  {id:'downstream_loss',pattern:/\b(lost sales|lost revenue|lost production|supply disruption|production disruption|supply constraints)\b/i},
];
export function recentLossFilings(submission, {companyId,cik,forms,limit=4}, asOf) {
  if(!/^\d{1,10}$/.test(cik)||!validDate(asOf)||!Number.isInteger(limit)||limit<1)throw new Error('Invalid filing monitor configuration');
  const r=submission?.filings?.recent;
  if(!r || !Array.isArray(r.accessionNumber))throw new Error('Missing SEC recent filing list');
  return r.accessionNumber.map((accession,i)=>({accession,form:r.form?.[i],publicationDate:r.filingDate?.[i],document:r.primaryDocument?.[i]}))
    .filter(f=>forms.includes(f.form)&&validDate(f.publicationDate)&&f.publicationDate<=asOf
      && /^\d{10}-\d{2}-\d{6}$/.test(f.accession)&&/^[a-zA-Z0-9_.-]+\.html?$/.test(f.document||''))
    .sort((a,b)=>b.publicationDate.localeCompare(a.publicationDate)||b.accession.localeCompare(a.accession))
    .slice(0,limit).map(f=>({...f,companyId,url:`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${f.accession.replaceAll('-','')}/${f.document}`}));
}
export function lossDisclosureCandidate(filing, html, checkedAt) {
  const text=html.replace(/<(script|style|ix:hidden)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    .replace(/<\/(?:p|div|tr|li|h[1-6])\s*>/gi,'\n')
    .replace(/<[^>]+>/g,' ').replace(/&(?:nbsp|#160|#xA0);/gi,' ').replace(/&amp;/gi,'&');
  const paragraphs=text.split(/\n+/).map(p=>p.replace(/\s+/g,' ').trim()).filter(Boolean);
  const matches=paragraphs.map(p=>({text:p,topics:topics.filter(t=>t.pattern.test(p)).map(t=>t.id)}))
    .filter(p=>p.topics.includes('material_incident')&&(p.topics.includes('recovery')||p.topics.includes('downstream_loss')));
  if(!matches.length)return null;
  // One short excerpt per filing; no full third-party transcript or filing copy.
  return {id:'loss_filing_'+hash(filing.url).slice(0,24),companyId:filing.companyId,publicationDate:filing.publicationDate,
    form:filing.form,sourceUrl:filing.url,sourceSha256:hash(html),hashBasis:'utf8_decoded_text',
    evidenceSha256:hash(paragraphs.join('\n')),evidenceHashBasis:'normalized_visible_text_v1',
    topics:[...new Set(matches.flatMap(m=>m.topics))],matchingParagraphs:matches.length,
    excerpt:matches[0].text.split(/\s+/).slice(0,24).join(' '),
    firstSeenAt:checkedAt,lastSeenAt:checkedAt,claimStatus:'unreviewed',reviewState:'pending',
    numericLoss:null,counterpartyId:null,independentOutcomeLabel:false};
}
export function mergeLossCandidates(previous, candidates) {
  const map=new Map((previous||[]).map(r=>[r.id,r]));
  for(const next of candidates) {
    const old=map.get(next.id);
    const sourceChanged=Boolean(old&&old.sourceSha256!==next.sourceSha256);
    const changed=Boolean(old&&(old.evidenceSha256 ? old.evidenceSha256!==next.evidenceSha256 : sourceChanged));
    map.set(next.id,{...next,firstSeenAt:old?.firstSeenAt||next.firstSeenAt,
      reviewState:changed?'source_changed':old?.reviewState||'pending',
      reviewedClaimIds:changed?[]:old?.reviewedClaimIds||[],
      review:changed?null:old?.review||null,
      sourceChangedSincePreviousCheck:sourceChanged,
      previousSourceSha256:sourceChanged?old.sourceSha256:old?.previousSourceSha256||null});
  }
  return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id));
}
