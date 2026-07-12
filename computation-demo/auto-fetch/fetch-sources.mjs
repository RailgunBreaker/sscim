/* ====================================================================
   fetch-sources.mjs — working demonstration of the AUTOMATABLE part of
   the SSCIM data pipeline (see ../DATA_PIPELINE.md).

   Fetches, live, from free keyless public APIs:
     1. Federal Register API  -> policy/event CANDIDATES (BIS rules)
     2. SEC EDGAR XBRL API    -> company financial anchors (revenue)

   Emits staging CSVs into ./out/. Columns that require human judgment
   (severity, stage mapping, direction/channel/operational classification)
   are emitted as REVIEW_* placeholders — the pipeline design forbids
   auto-writing those into the vault (see the H200-easing example in
   ../REAL_DATA_EXAMPLE.md §2.2 for why).

   Usage:  node fetch-sources.mjs
   ==================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(OUT, { recursive: true });

const UA = { 'User-Agent': 'SSCIM data pipeline demo alansong0318@gmail.com' };
const esc = (v) => (/[",\n]/.test(String(v ?? '')) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v ?? ''));
const writeCsv = (name, header, rows) => {
  fs.writeFileSync(path.join(OUT, name), [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n') + '\n');
  console.log('wrote', name, `(${rows.length} rows)`);
};
const today = new Date().toISOString().slice(0, 10);

/* ---------- 1. Federal Register: BIS semiconductor rules ----------
   Free, keyless. Candidates for the POLICIES table (type RULE) and the
   EVENTS table (any recent document). */
const frUrl = 'https://www.federalregister.gov/api/v1/documents.json?' + new URLSearchParams({
  'conditions[agencies][]': 'industry-and-security-bureau',
  'conditions[term]': 'semiconductor OR "advanced computing" OR lithography OR "high-bandwidth memory"',
  'conditions[type][]': 'RULE',
  per_page: '20',
  order: 'newest',
  'fields[]': 'document_number',
}) + '&fields[]=title&fields[]=publication_date&fields[]=effective_on&fields[]=citation&fields[]=html_url&fields[]=abstract';

const fr = await (await fetch(frUrl, { headers: UA })).json();
console.log(`Federal Register: ${fr.count} matching rules, staging newest ${fr.results.length}`);

writeCsv('staging_policy_event_candidates.csv',
  ['fetched_on', 'source', 'document_number', 'citation', 'publication_date', 'effective_on', 'days_ago_vs_today',
   'title', 'url', 'sev_0_10', 'affected_stages', 'direction', 'channel', 'operational', 'review_status'],
  fr.results.map((d) => [
    today, 'federalregister.gov API', d.document_number, d.citation, d.publication_date, d.effective_on,
    Math.round((Date.now() - new Date(d.publication_date)) / 864e5),
    d.title, d.html_url,
    'REVIEW_REQUIRED', 'REVIEW_REQUIRED', 'REVIEW_REQUIRED', 'REVIEW_REQUIRED', 'REVIEW_REQUIRED', 'pending_human_review',
  ]));

/* ---------- 2. SEC EDGAR XBRL: annual revenue anchors ----------
   Free; descriptive User-Agent required; ~10 req/s limit. Feeds the
   stage `value` anchors and company financial context. Concept names
   drift per issuer (ASML: us-gaap despite being Dutch; NVIDIA switched
   tags in 2022), so we probe a candidate list per company. */
const COMPANIES = [
  { id: 'asml', cik: '0000937966' },
  { id: 'tsmc', cik: '0001046179' },
  { id: 'nvidia', cik: '0001045810' },
  { id: 'micron', cik: '0000723125' },
  { id: 'amat', cik: '0000006951' },
];
const CONCEPTS = [
  ['us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax'],
  ['us-gaap', 'Revenues'],
  ['ifrs-full', 'Revenue'],
];

const finRows = [];
for (const c of COMPANIES) {
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${c.cik}.json`, { headers: UA });
  if (!res.ok) { console.warn(c.id, 'fetch failed', res.status); continue; }
  const j = await res.json();
  for (const [ns, concept] of CONCEPTS) {
    const fact = j.facts?.[ns]?.[concept];
    if (!fact) continue;
    let added = 0;
    for (const unit of Object.keys(fact.units)) {
      const annual = fact.units[unit].filter((x) =>
        x.fp === 'FY' && x.start && (new Date(x.end) - new Date(x.start)) > 300 * 864e5 && x.end > '2023-06-01');
      const latestByEnd = {};
      annual.forEach((x) => { latestByEnd[x.end] = x; });
      Object.values(latestByEnd).forEach((x) => { added++; finRows.push([
        today, 'data.sec.gov XBRL API', c.id, j.entityName, c.cik, `${ns}:${concept}`, unit,
        x.start, x.end, x.val, x.form, x.accn,
      ]); });
    }
    // Concept drift guard: a tag can exist but be stale (NVIDIA stopped
    // using RevenueFromContractWithCustomer… after FY2022). Only stop
    // probing once a concept actually yielded recent annual rows.
    if (added) break;
  }
  await new Promise((r) => setTimeout(r, 150)); // stay well under EDGAR rate limit
}
writeCsv('staging_company_financial_anchors.csv',
  ['fetched_on', 'source', 'company_id', 'entity_name', 'cik', 'xbrl_concept', 'unit',
   'period_start', 'period_end', 'value', 'form', 'accession_number'],
  finRows.sort((a, b) => (a[2] + a[8]).localeCompare(b[2] + b[8])));

/* ---------- 3. Freshness / diff report ---------- */
writeCsv('staging_fetch_log.csv',
  ['fetched_on', 'feed', 'endpoint', 'records'],
  [
    [today, 'federal_register_bis_rules', 'federalregister.gov/api/v1/documents.json', fr.results.length],
    [today, 'edgar_company_facts', 'data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json', finRows.length],
  ]);

console.log('\nDone. Staging CSVs are candidates — nothing is written to the vault without human review.');
