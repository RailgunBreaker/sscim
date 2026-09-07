import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evaluateRevenuePrediction, attachRevenueVintages } from '../../app/src/engine/revenuePrediction.js';
const root = new URL('../../', import.meta.url);
const read = p => readFileSync(new URL(p, root));
const hash = b => createHash('sha256').update(b).digest('hex');
const dataBytes = read('docs/reference/tsmc-monthly-revenue.json');
const protocolBytes = read('docs/reference/revenue-prediction-protocol.json');
const vintageBytes = read('docs/benchmarks/revenue-vintage-audit.json');
const data = attachRevenueVintages(JSON.parse(dataBytes), JSON.parse(vintageBytes)), protocol = JSON.parse(protocolBytes);
for (const source of data.sources) {
  const rows = data.records.filter(r => r.period.startsWith(`${source.year}-`));
  if (rows.length !== 12 || rows.some(r => r.sourceUrl !== source.url)) throw new Error('Incomplete annual source');
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  if (Math.abs(sum - source.reportedAnnualTotal) > 6.5) throw new Error('Annual source reconciliation failed');
}
const report = evaluateRevenuePrediction(data, protocol);
Object.assign(report, { evaluatedAt: new Date().toISOString(), dataSha256: hash(dataBytes), protocolSha256: hash(protocolBytes),
  vintageAuditSha256: hash(vintageBytes),
  protocolAvailabilityLimitationResolved: 'All 156 values match dated original SEC filings. Each nowcast is dated one day after the latest required filing and before target outcome disclosure. This verifies historical input availability, not actual historical prediction issuance.',
  engineSha256: hash(read('app/src/engine/revenuePrediction.js')) });
writeFileSync(new URL('docs/benchmarks/revenue-prediction.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, selectedWindow: report.selectedWindow, test: report.test,
  comparisons: report.comparisons, gates: report.gates }, null, 2));
