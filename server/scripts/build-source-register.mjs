#!/usr/bin/env node
/* Regenerates docs/reference/SOURCE-REGISTER.md from the vault.

   WHY GENERATED. The register lists every distinct source behind every event,
   facility and evidence note — around 300 entries today and growing with each
   pipeline run. A hand-maintained list of that size is out of date the day
   after it is written, and a stale bibliography is worse than none: it invites
   a reader to believe a citation exists for something that has since changed.
   So it is derived from the same rows the interface reads.

   WHAT IT DOES NOT DO. It does not invent citations. Each vault record carries
   a `source` string written by whoever curated it, and the register renders
   exactly that, normalised and alphabetised. Where a record names an
   institution, an instrument and a date, the entry reads as a Chicago
   government/legal citation. Where it names a company disclosure, it reads as
   a corporate-report citation. Where the record is thinner than a full Chicago
   entry, the entry is thinner too, and the register says so rather than
   fabricating an author, a title or a page number to fill the shape.

   Run from server/:  node scripts/build-source-register.mjs  */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../src/db.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'reference', 'SOURCE-REGISTER.md');

/* Which issuing body a recorded source belongs to. Ordered: the first pattern
   that matches wins, so the specific ones come before the general. */
const FAMILIES = [
  ['Bureau of Industry and Security (US Department of Commerce)', /^BIS\b|Bureau of Industry/i],
  ['US federal — other agencies and instruments', /Federal Register|Commerce Department|Executive Order|Presidential|USTR|CHIPS|Bill |Congress|DOJ|Regulation |Public Law|White House/i],
  ['China — ministries and regulators', /MOFCOM|NDRC|SAMR|\bCAC\b|Chinese (government|ministry|regulator)|Provincial|China customs/i],
  ['Japan — ministries and agencies', /METI|Japanese (government|ministry)|Japan (government|ministry)/i],
  ['Netherlands and European Union', /Dutch|Netherlands|European Commission|EU export/i],
  ['Other national authorities and courts', /Taiwan|Taipower|Korean government|Malaysian|Canadian|Court|King |Ministry/i],
  ['Research and analyst houses', /TrendForce|IDC\b|Gartner|TechInsights|DRAMeXchange|Counterpoint|SemiAnalysis|Omdia|Yole|CSIS|NAND Research|Silicon Analysts|Astute/i],
  ['News organisations and trade press', /Reuters|Bloomberg|\bBBC\b|DigiTimes|Nikkei|CNBC|Financial Times|WSJ|Wall Street|Focus Taiwan|MarketScreener|NPR/i],
];
const FALLBACK = 'Company disclosures, filings and announcements';

const familyOf = (s) => (FAMILIES.find(([, re]) => re.test(s)) || [FALLBACK])[0];

/* Chicago prefers the issuing body first. A vault source string already leads
   with it in nearly every case, so the entry is the string with its sentence
   shape tidied — never rewritten, because rewriting is where invention starts. */
function entry(source) {
  let s = String(source).trim().replace(/\s+/g, ' ');
  s = s.replace(/\s*\+\s*/g, '; ');              // "A + B" reads as two sources
  s = s.replace(/\s*\(official\)/gi, '');         // an internal marker, not part of a citation
  if (!/[.!?]$/.test(s)) s += '.';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const rows = (sql) => db.prepare(sql).all();

const eventSources = rows("SELECT source, COUNT(*) n, MIN(date_iso) first, MAX(date_iso) last FROM events WHERE source IS NOT NULL AND source <> '' GROUP BY source");
const facilitySources = rows("SELECT source, COUNT(*) n FROM facilities WHERE source IS NOT NULL AND source <> '' GROUP BY source");
const noteSources = rows("SELECT scope, tier, source FROM data_notes WHERE source IS NOT NULL AND source <> ''");

/* Facility sources are highly repetitive by design ("<Company> facility
   listings; scale is an analyst judgement." x 275). Listing all 275 would bury
   the register, so they are collapsed to the distinct publisher with a count —
   which is what a bibliography would do with 8 items from one corporate
   source anyway.

   Publisher extraction has to cope with every phrasing the records use —
   "facility listings", "site disclosures", "corporate disclosures",
   "programme disclosures", "joint-venture disclosures" — so it cuts at the
   first descriptor word rather than matching one fixed form. Getting this
   wrong is visible immediately: the table shows "Alibaba Cloud disclosures;
   scale is an analyst judgement." where it should show "Alibaba Cloud". */
const DESCRIPTOR = /\s+(facility|facilities|site|sites|corporate|company|programme|program|public|joint-venture|campus|regional|datacent\w*|disclosur\w*|listing\w*)\b/i;
const facilityByPublisher = new Map();
for (const r of facilitySources) {
  const raw = String(r.source);
  const cut = raw.search(DESCRIPTOR);
  const publisher = (cut > 0 ? raw.slice(0, cut) : raw.split(';')[0]).trim().replace(/[.,;]+$/, '');
  const cur = facilityByPublisher.get(publisher) || { publisher, sites: 0 };
  cur.sites += r.n;
  facilityByPublisher.set(publisher, cur);
}

const grouped = new Map();
for (const r of eventSources) {
  const fam = familyOf(r.source);
  if (!grouped.has(fam)) grouped.set(fam, []);
  grouped.get(fam).push({ text: entry(r.source), n: r.n, first: r.first, last: r.last });
}
for (const list of grouped.values()) list.sort((a, b) => a.text.localeCompare(b.text));

const today = new Date().toISOString().slice(0, 10);
const L = [];
const push = (...x) => L.push(...x);

push('# Source register');
push('');
push(`*Generated from the vault by \`server/scripts/build-source-register.mjs\`. Last generated: ${today}.*`);
push('');
push('Every distinct source behind every event, facility and evidence note in');
push('`server/data/sscim.db`, alphabetised within issuing body.');
push('');
push('**On the citation form.** Each entry renders what the vault record actually');
push('carries. Where a record names an institution, an instrument and a date, the');
push('entry reads as a Chicago government or legal citation. Where it names a');
push('corporate disclosure, it reads as a corporate-report citation. Where the');
push('underlying record is thinner than a full Chicago entry — no title, no page —');
push('the entry is thinner too. Nothing here is reconstructed beyond what was');
push('recorded at the time the item was reviewed; inventing an author or a title to');
push('complete the shape of a citation would defeat the purpose of having one.');
push('');
push('To trace any entry back to the rows that cite it:');
push('');
push('```sql');
push("SELECT id, date_iso, title FROM events WHERE source = '<the source string>';");
push("SELECT id, name  FROM facilities WHERE source LIKE '<publisher>%';");
push('```');
push('');

/* --- summary ------------------------------------------------------------- */
push('## At a glance');
push('');
push('| Body | Distinct sources | Events citing them |');
push('| --- | --- | --- |');
const famOrder = [...grouped.keys()].sort();
for (const fam of famOrder) {
  const list = grouped.get(fam);
  push(`| ${fam} | ${list.length} | ${list.reduce((a, x) => a + x.n, 0)} |`);
}
push(`| **Total (events)** | **${eventSources.length}** | **${eventSources.reduce((a, r) => a + r.n, 0)}** |`);
push('');
push(`Facility records cite **${facilityByPublisher.size}** distinct publishers across **${facilitySources.reduce((a, r) => a + r.n, 0)}** sites. Evidence notes cite **${noteSources.length}** further sources.`);
push('');
push('---');
push('');

/* --- events -------------------------------------------------------------- */
push('## 1. Event sources');
push('');
push('Cited by the dated events in the vault. The bracketed figure is how many');
push('events rest on that source and the span they cover.');
push('');
for (const fam of famOrder) {
  push(`### ${fam}`);
  push('');
  for (const e of grouped.get(fam)) {
    const span = e.first === e.last ? e.first : `${e.first}–${e.last}`;
    push(`- ${e.text} [${e.n} event${e.n === 1 ? '' : 's'}; ${span}]`);
  }
  push('');
}

/* --- facilities ---------------------------------------------------------- */
push('---');
push('');
push('## 2. Facility sources');
push('');
push('Site identity, location and output come from publicly available company');
push('facility listings and programme announcements. The significance ordinal on');
push('every one of these records is **not** from the publisher — it is an analyst');
push('judgement, and each record says so in its own source string.');
push('');
push('| Publisher | Sites cited |');
push('| --- | --- |');
for (const p of [...facilityByPublisher.values()].sort((a, b) => a.publisher.localeCompare(b.publisher))) {
  push(`| ${p.publisher} | ${p.sites} |`);
}
push('');

/* --- evidence notes ------------------------------------------------------ */
push('---');
push('');
push('## 3. Evidence-note sources');
push('');
push('Attached to specific figures — a stage share, a company share, an ownership');
push('row, a customer relationship. These are the most fully-formed citations in');
push('the vault, because a note exists precisely to carry one.');
push('');
push('| Tier | Applies to | Source |');
push('| --- | --- | --- |');
for (const n of [...noteSources].sort((a, b) => a.scope.localeCompare(b.scope))) {
  push(`| ${n.tier} | \`${n.scope}\` | ${String(n.source).replace(/\|/g, '\\|')} |`);
}
push('');

/* --- feeds --------------------------------------------------------------- */
push('---');
push('');
push('## 4. Standing data feeds');
push('');
push('Queried continuously rather than cited once. Endpoints are in');
push('`server/src/ingest/` and `server/src/quotes.js`.');
push('');
push('| Feed | Endpoint | Role |');
push('| --- | --- | --- |');
push('| United States Geological Survey, Earthquake Catalog | `earthquake.usgs.gov/fdsnws/event/1/query` | Candidate discovery |');
push('| Office of the Federal Register, Documents API | `federalregister.gov/api/v1/documents.json` | Candidate discovery |');
push('| Webz.io, News API Lite | `api.webz.io/newsApiLite` | Candidate discovery |');
push('| Yahoo Finance, Quote API | `query1.finance.yahoo.com/v7/finance/quote` | Display metadata only |');
push('| OpenStreetMap contributors; CARTO basemap tiles | `basemaps.cartocdn.com`, `tile.openstreetmap.org` | Map rendering |');
push('');
push('A feed is **discovery only**. None of them can write an event: everything');
push('they surface is a candidate until a human approves it.');
push('');

writeFileSync(OUT, `${L.join('\n')}\n`, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`  ${eventSources.length} distinct event sources across ${famOrder.length} bodies`);
console.log(`  ${facilityByPublisher.size} facility publishers, ${noteSources.length} evidence notes`);
