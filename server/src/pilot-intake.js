import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Operational targets chosen for this pilot, not empirically fitted thresholds.
export const PILOT_PROTOCOL = {
  version: 1, name: 'Public disclosure investigation pilot', checkpointDays: 30, triageTargetHours: 48,
  objective: 'Find and investigate disclosed material incidents, reimbursements and downstream losses without combining overlapping accounting scopes.',
  companies: [
    { id: 'wdc', name: 'Western Digital', productScope: 'Historical flash contamination and related recoveries' },
    { id: 'sandisk', name: 'Sandisk', productScope: 'Flash business disclosures and contamination recoveries' },
    { id: 'tsmc', name: 'TSMC', productScope: 'Foundry material incidents and disclosed consequences' },
  ],
  collectionScope: 'SEC 10-K/10-Q for Western Digital and Sandisk; 20-F for TSMC. Keyword-matched filings only. Historical reference documents are separate.',
  criteria: [
    'Triage every source revision within 48 hours of entry into this workspace; show deferred and overdue items separately. Collection-to-entry delay must be assessed separately.',
    'Retain the source revision, decision reason and actual review timestamp for every decision.',
    'At the 30-day checkpoint, independently assess a sample of both matched and unmatched filings before estimating detection accuracy.',
    'Use actual delivery records and an agreed comparison baseline before evaluating operational benefit. Neither is supplied by this disclosure pilot.',
  ],
  limitation: 'Review completion is a workflow measure. Keyword coverage is not incident recall; historical disclosures and operator decisions do not validate predictions or establish complete chain-wide losses.',
};
const root = new URL('../../', import.meta.url);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const starters = [
  { documentId: 'wdc_2024', companyId: 'wdc', question: 'Who paid the remaining disclosed recovery, and are final recoveries or disjoint downstream losses disclosed?' },
  { documentId: 'sandisk_2025q3', companyId: 'sandisk', question: 'Does this flash-business disclosure add a new recovery or repeat the historical WDC recovery?' },
  { documentId: 'tsmc_2019q1_call', companyId: 'tsmc', question: 'Which photoresist consequences were realized, and is any supplier reimbursement or customer loss disclosed?' },
];
export function buildPilotIntake(monitor, evidence) {
  const historicalCases = starters.map(s => {
    const d = evidence.documents.find(d => d.id === s.documentId);
    if (!d?.sha256 || !d.reviewedAt || !d.archivePath) throw new Error(`Historical source unavailable: ${s.documentId}`);
    return { ...s, id: `historical_${d.id}`, sourceUrl: d.url, publicationDate: d.publicationDate,
      sourceSha256: d.sha256, hashBasis: d.hashBasis, finding: d.finding,
      firstSeenAt: d.retrievedAt, discoveryKind: 'historical_reference', retrievalStatus: d.retrievalStatus };
  });
  const rows = new Map(historicalCases.map(c => [c.sourceUrl, c]));
  for (const c of monitor.candidates || []) {
    if (!PILOT_PROTOCOL.companies.some(p => p.id === c.companyId)) continue;
    rows.set(c.sourceUrl, { ...rows.get(c.sourceUrl), ...c });
  }
  const candidates = [...rows.values()].map(c => {
    const hash = c.evidenceSha256 || c.sourceSha256;
    const basis = c.evidenceSha256 ? c.evidenceHashBasis : c.hashBasis;
    if (!/^[a-f0-9]{64}$/i.test(hash || '') || !basis) throw new Error('Candidate lacks a usable source fingerprint.');
    return { id: c.id, companyId: c.companyId, sourceUrl: c.sourceUrl, publicationDate: c.publicationDate,
      sourceSha256: c.sourceSha256, hashBasis: c.hashBasis, evidenceSha256: c.evidenceSha256 || null,
      evidenceHashBasis: c.evidenceHashBasis || null,
      revision: digest([c.id, c.companyId, c.sourceUrl, c.publicationDate, basis, hash]),
      firstSeenAt: c.firstSeenAt, discoveryKind: c.discoveryKind || 'collected_filing',
      excerpt: c.excerpt || '', finding: c.finding || '', retrievalStatus: c.retrievalStatus || 'see_collection_checks',
      upstreamReviewState: c.reviewState || null };
  });
  return { checkedAt: monitor.checkedAt || null, checks: monitor.checks || [], candidates, historicalCases,
    detectorVersion: monitor.detectorVersion || null, detectorSha256: monitor.detectorSha256 || null };
}
export function loadPilotIntake() {
  return buildPilotIntake(
    JSON.parse(readFileSync(new URL('docs/operational-monitor/loss-filing-candidates.json', root))),
    JSON.parse(readFileSync(new URL('docs/reference/chain-loss-verification.json', root))));
}
