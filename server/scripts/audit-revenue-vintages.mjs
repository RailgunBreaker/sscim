// Compare each annual-table value to a dated original SEC disclosure. No model
// selection, scoring, source-value replacement or historical date invention.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('docs/reference/tsmc-monthly-revenue.json', root)));
const headers = { 'User-Agent': 'SSCIM public-source research' };
async function get(url) {
  await new Promise(resolve => setTimeout(resolve, 180));
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.text();
}
const submissions = JSON.parse(await get('https://data.sec.gov/submissions/CIK0001046179.json'));
const groups = [submissions.filings.recent];
for (const file of submissions.filings.files) if (file.filingTo >= '2013-01-01') groups.push(JSON.parse(await get(`https://data.sec.gov/submissions/${file.name}`)));
const filings = groups.flatMap(g => g.form.flatMap((form, i) => form === '6-K' ? [{ date: g.filingDate[i], doc: g.primaryDocument[i], accession: g.accessionNumber[i] }] : []));
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const results = [];
const previous = process.argv.includes('--resume')
  ? JSON.parse(readFileSync(new URL('docs/benchmarks/revenue-vintage-audit.json', root))).records : [];
for (const row of data.records) {
  const retained = previous.find(r => r.period === row.period && r.matchesAnnualTable && r.amountInAnnualTable === row.amount);
  if (retained) { results.push(retained); continue; }
  const [year, month] = row.period.split('-').map(Number);
  const following = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  const candidates = filings.filter(f => f.date.startsWith(following) && Number(f.date.slice(-2)) <= 16)
    .sort((a, b) => Number(/revenue/i.test(b.doc)) - Number(/revenue/i.test(a.doc)) || a.date.localeCompare(b.date));
  let match = null;
  const failures = [];
  for (const f of candidates) {
    const url = `https://www.sec.gov/Archives/edgar/data/1046179/${f.accession.replaceAll('-', '')}/${f.doc}`;
    try {
      const html = await get(url);
      const plain = html.replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ');
      const yearPattern = String(year).split('').join('\\s*');
      const titleMatch = new RegExp(`TSMC ${months[month - 1]} ${yearPattern} (Revenue|Sales) Report`, 'i').exec(plain);
      const title = titleMatch?.[0];
      const start = titleMatch?.index ?? -1;
      if (start < 0) continue;
      const section = plain.slice(start, start + 3500);
      const net = /Net\s+(?:Revenues?|Sales)\s+([\d,]+)(?:\s|$)/i.exec(section);
      if (!net || !/million/i.test(section.slice(0, net.index))) continue;
      const amount = Number(net[1].replaceAll(',', ''));
      match = { period: row.period, amountInOriginalDisclosure: amount, amountInAnnualTable: row.amount,
        matchesAnnualTable: amount === row.amount, availableBy: f.date, availabilityBasis: 'SEC filing date; conservative date, not asserted earliest press-release time',
        sourceUrl: url, sha256: createHash('sha256').update(html).digest('hex'),
        supportingExcerpt: `${title}; Net Revenue ${net[1]}; NT$ million`, verification: 'automated title/unit/table extraction; not independent human adjudication' };
      break;
    } catch (e) { failures.push(String(e.message)); }
  }
  results.push(match || { period: row.period, status: 'not_verified', failures });
  if (results.length % 12 === 0) console.log(JSON.stringify({ checked: results.length, verified: results.filter(r => r.matchesAnnualTable).length }));
}
const report = { auditedAt: new Date().toISOString(), source: 'SEC original 6-K revenue disclosures',
  records: results, matched: results.filter(r => r.matchesAnnualTable).length, total: data.records.length };
writeFileSync(new URL('docs/benchmarks/revenue-vintage-audit.json', root), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ matched: report.matched, total: report.total }));
if (report.matched !== report.total) process.exitCode = 1;
