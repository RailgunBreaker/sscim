// Availability/change audit only. A successful HTTP request never verifies a
// claim. Reviewers must inspect changed documents before changing the ledger.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('docs/reference/observed-data.json', root), 'utf8'));
const urls = [...new Set([...data.observations, ...data.relationships, ...data.capacities,
  ...(data.financialOutcomes || []), ...(data.manufacturingRoutes || [])]
  .flatMap(r => [r.source.url, ...(r.source.supportingUrls || [])]))];
const prior = new Map((data.sourceArtifacts || []).map(r => [r.url, r.sha256]));
const results = [];
for (let i = 0; i < urls.length; i += 3) {
  results.push(...await Promise.all(urls.slice(i, i + 3).map(async url => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'SSCIM research source verification' } });
      if (!response.ok) return { url, status: 'unavailable', httpStatus: response.status };
      const bytes = new Uint8Array(await response.arrayBuffer());
      const hash = createHash('sha256').update(bytes).digest('hex');
      return { url, status: 'retrieved', finalUrl: response.url, httpStatus: response.status,
        contentType: response.headers.get('content-type'), bytes: bytes.length, sha256: hash,
        matchesReviewedArtifact: prior.has(url) ? hash === prior.get(url) : null,
        claimVerification: 'not_performed_by_this_script' };
    } catch (error) { return { url, status: 'unavailable', error: error.message }; }
  })));
}
const report = { checkedAt: new Date().toISOString(), results };
writeFileSync(new URL('docs/benchmarks/observed-source-availability.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(`${results.filter(r => r.status === 'retrieved').length}/${urls.length} sources retrieved; claim verification is a separate review.`);
if (results.some(r => r.status !== 'retrieved' || r.matchesReviewedArtifact === false)) process.exitCode = 1;
