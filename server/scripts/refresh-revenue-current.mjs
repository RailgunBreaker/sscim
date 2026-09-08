import { readFileSync, existsSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
import { createHash } from 'node:crypto';
import { attachRevenueVintages, validateRevenueRows } from '../../app/src/engine/revenuePrediction.js';
import { parseRevenueDisclosure } from '../src/revenue-disclosure.js';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, root)));
const base = attachRevenueVintages(read('docs/reference/tsmc-monthly-revenue.json'), read('docs/benchmarks/revenue-vintage-audit.json'));
const currentPath = new URL('docs/reference/tsmc-revenue-current.json', root);
const previous = existsSync(currentPath) ? JSON.parse(readFileSync(currentPath)) : base;
validateRevenueRows(previous.records);
if (previous.companyId !== base.companyId || previous.metric !== base.metric || previous.units !== base.units || !previous.historicalVintagesVerified) throw new Error('Incompatible existing revenue dataset');
for (const row of base.records) {
  const existing = previous.records.find(r => r.period === row.period);
  if (!existing || existing.amount !== row.amount || existing.availableBy !== row.availableBy) throw new Error('Frozen historical series changed');
}
const headers = { 'User-Agent': 'SSCIM public-source research' };
async function get(url) {
  await new Promise(r => setTimeout(r, 200));
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.text();
}
const cutoff = new Date().toISOString(), today = cutoff.slice(0, 10);
const recent = JSON.parse(await get('https://data.sec.gov/submissions/CIK0001046179.json')).filings.recent;
// Retain original disclosures even after they leave SEC's recent-filings window.
const additions = new Map(previous.records.filter(r => r.period > base.records.at(-1).period).map(r => [r.period,r])), failures = [];
for (let i = recent.form.length - 1; i >= 0; i--) {
  const date = recent.filingDate[i];
  if (recent.form[i] !== '6-K' || date < '2026-02-01' || date >= today || !/revenue/i.test(recent.primaryDocument[i])) continue;
  const [year, month] = date.split('-').map(Number);
  const period = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  const url = `https://www.sec.gov/Archives/edgar/data/1046179/${recent.accessionNumber[i].replaceAll('-', '')}/${recent.primaryDocument[i]}`;
  try {
    const html = await get(url), parsed = parseRevenueDisclosure(html, period);
    if (additions.has(period)) {
      if (additions.get(period).amount !== parsed.amount) throw new Error('Conflicting revised original disclosure');
      continue;
    }
    additions.set(period, { period, amount: parsed.amount, sourceUrl: url, originalDisclosureUrl: url,
      availableBy: date, retrievedAt: cutoff, sourceSha256: createHash('sha256').update(html).digest('hex'), supportingExcerpt: parsed.supportingExcerpt });
  } catch (error) { failures.push({ url, period, error: error.message }); }
}
if (failures.length) throw new Error(JSON.stringify(failures));
const current = { ...base, retrievedAt: cutoff, records: [...base.records, ...additions.values()].sort((a, b) => a.period.localeCompare(b.period)) };
validateRevenueRows(current.records);
writeAtomicJson(currentPath, current);
console.log(JSON.stringify({ records: current.records.length, latest: current.records.at(-1).period, retrievedAt: cutoff }));
