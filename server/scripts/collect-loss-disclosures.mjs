import { readFileSync, existsSync } from 'node:fs';
import { sourceDigestStatus } from '../src/source-digests.js';
import { writeAtomicJson } from '../src/atomic-json.js';
import { fetchPublicDocument } from '../src/public-source-document.js';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('docs/reference/chain-loss-evidence.json', root)));
const path = new URL('docs/benchmarks/loss-source-collection.json', root);
const previous = existsSync(path) ? JSON.parse(readFileSync(path)) : { sources: [] };
const reconciliations = JSON.parse(readFileSync(new URL('docs/reference/loss-reconciliations.json',root)));
const supplierAllocations = JSON.parse(readFileSync(new URL('docs/reference/supplier-loss-allocations.json',root)));
const followup = JSON.parse(readFileSync(new URL('docs/reference/semiconductor-loss-followup.json',root)));
const physical = JSON.parse(readFileSync(new URL('docs/reference/physical-losses.json',root)));
const verification = JSON.parse(readFileSync(new URL('docs/reference/chain-loss-verification.json',root)));
const rows = [...data.records, ...(data.sectorEstimates || []), ...reconciliations.records, ...supplierAllocations.accounts, ...supplierAllocations.rules, ...followup.bases, ...followup.recoveries, ...followup.downstream, ...physical.records, ...verification.records,
  ...(verification.receiptEvidence || []), ...(verification.operationalEvidence || []), ...(verification.reportingRelationships || []), ...(verification.productEvidence || []), ...(verification.photoresistEvidence || []),
  ...(verification.boundaryEvidence || []), ...(verification.periodObservations || []), ...(verification.unattributedRecoveries || []), ...(verification.governanceEvidence || []),
  ...(verification.producerCostEvidence || []), ...(verification.otherCauseCosts || []), ...(verification.companySalesEvidence || []), ...(verification.salesAttributionEvidence || []),
  ...(verification.customerTransactions || []), ...(verification.customerSupplyStatements || []), ...(verification.counterpartyPurchaseEvidence || []),
  ...(verification.counterpartyConsolidationEvidence || []), ...(verification.customerInventoryEvidence || [])], sources = [];
for (const url of new Set(rows.map(r => r.source.url))) {
  const reviewedDigest = rows.find(r => r.source.url === url && r.source.sha256 && r.source.hashBasis === 'raw_bytes')?.source.sha256;
  const prior = previous.sources.find(r => r.url === url) || (reviewedDigest ? {baselineSha256:reviewedDigest,baselineHashBasis:'raw_bytes'} : undefined);
  const entry = { url, checkedAt: new Date().toISOString(), recordIds: rows.filter(r => r.source.url === url).map(r => r.id) };
  try {
    const { bytes: body, finalUrl, contentType } = await fetchPublicDocument(url);
    const pdf = body.subarray(0,5).toString()==='%PDF-';
    if (/\.pdf$/i.test(new URL(url).pathname) && !pdf) throw new Error('Expected PDF; received a different document (possible soft 404)');
    if ((!pdf && !/text\/html|application\/xhtml/i.test(contentType)) || body.length < 1000) throw new Error('Unexpected source document');
    Object.assign(entry, { status: 'retrieved', ...sourceDigestStatus(body,prior),
      finalUrl, documentType:pdf?'pdf':'html', bytes: body.length, lastSuccessfulAt: entry.checkedAt });
  } catch (error) { Object.assign(entry, { status: 'unavailable', error: error.message, baselineSha256: prior?.baselineSha256 || null, baselineHashBasis:prior?.baselineHashBasis||'legacy_unspecified', lastSuccessfulAt: prior?.lastSuccessfulAt || null }); }
  sources.push(entry);
  await new Promise(resolve => setTimeout(resolve, 250));
}
const report = { asOf: new Date().toISOString(), sources, unavailable: sources.filter(s => s.status !== 'retrieved').length,
  reviewRequired: sources.filter(s => s.reviewRequired).length,
  limitation: 'Retrieval and byte-change monitoring, not automatic claim verification. Dynamic page changes can trigger review. Newly found disclosures enter the news queue until reviewed.' };
writeAtomicJson(path, report);
console.log(JSON.stringify({ checked: sources.length, unavailable: report.unavailable, reviewRequired: report.reviewRequired }));
if (report.unavailable) process.exitCode = 1;
