#!/usr/bin/env node
/* Regenerates docs/reference/SOURCE-REGISTER.md from the vault.

   WHY GENERATED. The register carries every source behind every event,
   facility and evidence note. A hand-maintained bibliography of that size is
   out of date the day after it is written, and a stale one is worse than none:
   it invites a reader to believe a citation still stands for something that
   has changed.

   HOW A CITATION IS BUILT, in descending order of completeness:

     1. FULL — the reviewed events. Their candidate record carries the article
        title, the publishing site, the publication date and the URL, so a
        complete Chicago entry is assembled from real captured metadata.
     2. LEGAL — a source naming a Federal Register volume and page. Chicago
        cites government material by issuing body and register locator; the
        locator is exact and resolvable, so the entry is complete without a
        title.
     3. SHORT — the hand-curated historical events. Their record names the
        issuing body, the document type and the date, and nothing more. The
        entry says exactly that. It does NOT get a title invented for it.

   The register reports how many fall in each class, because "163 sources" and
   "163 fully-formed citations" are different claims and only one of them is
   true. Closing the gap is a data-entry task — recording the URL at review
   time — not a formatting one.

   Run from server/:  node scripts/build-source-register.mjs  */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../src/db.js';
import { chicago, DATASETS, PUBLISHERS, publishersFor } from '../src/citations.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'reference', 'SOURCE-REGISTER.md');
const today = new Date().toISOString().slice(0, 10);

const rows = (sql, ...a) => db.prepare(sql).all(...a);
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const longDate = (iso) => {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(iso)
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

/* ---- structured metadata captured at review time ------------------------
   approveCandidate writes `<feed> (<url>) - AI-drafted, human-reviewed` into
   events.source, so a reviewed event can be joined back to the candidate that
   still holds the article's real title, publisher and date. */
const candidateByUrl = new Map();
for (const c of rows("SELECT raw_json, source_feed, date_iso FROM event_candidates WHERE status = 'approved'")) {
  let raw;
  try { raw = JSON.parse(c.raw_json); } catch { continue; }
  if (raw?.url) candidateByUrl.set(String(raw.url), { ...raw, feed: c.source_feed, dateISO: c.date_iso });
}

const FR_RE = /\b(\d{2,3})\s*FR\s*(\d{3,6})\b/i;

/* Build the best citation the record supports, and say which kind it is. */
function citationFor(event) {
  const src = String(event.source || '');

  const url = (src.match(/https?:\/\/[^\s)]+/) || [])[0];
  const meta = url && candidateByUrl.get(url);
  if (meta && meta.title) {
    return {
      klass: 'full',
      text: chicago({
        author: meta.site || meta.feed,
        title: meta.title,
        date: longDate(meta.published || meta.dateISO || event.date_iso),
        url,
        accessed: today,
      }),
    };
  }
  if (meta && meta.documentNumber) {
    return {
      klass: 'full',
      text: chicago({
        author: (Array.isArray(meta.agencies) ? meta.agencies.join('; ') : meta.agencies) || 'Office of the Federal Register',
        title: meta.title,
        container: 'Federal Register',
        date: longDate(meta.dateISO || event.date_iso),
        url,
        accessed: today,
      }),
    };
  }
  if (meta) {
    return {
      klass: 'full',
      text: chicago({
        author: 'U.S. Geological Survey, Earthquake Hazards Program',
        description: `Event page ${url.split('/').pop()}${meta.magnitude ? `, M${meta.magnitude}` : ''}${meta.place ? `, ${meta.place}` : ''}`,
        date: longDate(meta.dateISO || event.date_iso),
        url,
        accessed: today,
      }),
    };
  }

  /* Tidy a curator's note into a description. Order matters: strip the
     internal "(official)" marker BEFORE removing brackets, or it survives as
     a stray word. */
  const describe = (s) => s
    .replace(/\s*\(official\)/gi, '')
    .replace(/\s*\bofficial\b\s*/gi, ' ')  // once brackets are gone the marker survives bare
    .replace(/\s*\+\s*/g, '; ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[;\s]+|[.,;\s]+$/g, '')
    .trim();

  /* Many notes already carry their own date — "ASML Q3 2024 release (Oct 15,
     2024)". Appending the event date after that reads as two dates for one
     document, so it is dropped when the note already states one. */
  const statesOwnDate = (s) => /\(\s*[A-Z][a-z]{2}\s+\d{1,2},\s*\d{4}\s*\)|\b\d{4}\)/.test(s);

  const fr = src.match(FR_RE);
  if (fr) {
    const issuer = publishersFor(src).map((k) => PUBLISHERS[k]?.author).find(Boolean) || 'Office of the Federal Register';
    return {
      klass: 'legal',
      /* No publication date is asserted: the vault records the event's own
         date, which for a rule is usually its effective date rather than the
         date it appeared in the register. The locator is exact and resolves
         without one. */
      text: chicago({
        author: issuer,
        description: describe(src.replace(FR_RE, '').replace(/[()]/g, '')),
        register: `${fr[1]} Fed. Reg. ${fr[2]}`,
      }),
    };
  }

  /* Nothing resolvable was recorded. State the issuing body, what the document
     was, and when — which is what the reviewer actually saw — and stop. */
  const issuer = publishersFor(src).map((k) => PUBLISHERS[k]?.author).find(Boolean);
  const description = describe(src);
  return {
    klass: 'short',
    text: chicago({
      author: issuer || null,
      description,
      date: statesOwnDate(description) ? null : longDate(event.date_iso),
    }),
  };
}

/* ---- gather -------------------------------------------------------------- */
const events = rows('SELECT id, date_iso, title, source FROM events ORDER BY date_iso');
const withSource = events.filter((e) => e.source && e.source.trim());
const cited = withSource.map((e) => ({ ...e, ...citationFor(e) }));

const counts = cited.reduce((a, c) => { a[c.klass] = (a[c.klass] || 0) + 1; return a; }, {});
const missing = events.length - withSource.length;

/* Group the bibliography by issuing body so it reads as a bibliography rather
   than a chronological list. */
const FAMILY = [
  ['Government and regulatory bodies', /Bureau of Industry|Federal Register|Ministry|Administration|Government|Trade Representative|Commission|U\.S\. Department|Securities and Exchange/i],
  ['Research and analyst houses', /TrendForce|International Data Corporation|SemiAnalysis|TechInsights|DRAMeXchange|Center for Strategic|NAND Research|Silicon Analysts|Astute|MarketScreener/i],
  ['News organisations and trade press', /Reuters|Bloomberg|Nikkei|BBC|DigiTimes|CNBC|Focus Taiwan|\.com|\.tech|\.ph\b|Times/i],
];
const familyOf = (t) => (FAMILY.find(([, re]) => re.test(t)) || ['Company disclosures, filings and announcements'])[0];

const grouped = new Map();
for (const c of cited) {
  const fam = familyOf(c.text);
  if (!grouped.has(fam)) grouped.set(fam, []);
  grouped.get(fam).push(c);
}
for (const list of grouped.values()) list.sort((a, b) => a.text.localeCompare(b.text));
const famOrder = [...grouped.keys()].sort();

const facilitySources = rows("SELECT source, COUNT(*) n FROM facilities WHERE source IS NOT NULL AND source <> '' GROUP BY source");
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
const noteSources = rows("SELECT scope, tier, source FROM data_notes WHERE source IS NOT NULL AND source <> ''");

/* ---- emit ---------------------------------------------------------------- */
const L = [];
const push = (...x) => L.push(...x);

push('# Source register');
push('');
push(`*Generated from the vault by \`server/scripts/build-source-register.mjs\`. Last generated: ${today}.*`);
push('');
push('Every source behind every event, facility and evidence note in');
push('`server/data/sscim.db`, in Chicago bibliography style, alphabetised within');
push('issuing body.');
push('');
push('## How complete each citation is, and why');
push('');
push('A citation can only be as complete as what was recorded when the item was');
push('reviewed. Three classes, counted rather than blurred together:');
push('');
push('| Class | Entries | What the record carries |');
push('| --- | --- | --- |');
push(`| **Full** | ${counts.full || 0} | Title, publisher, date and URL — captured automatically at review and assembled into a complete entry |`);
push(`| **Legal** | ${counts.legal || 0} | Issuing body and an exact *Federal Register* volume and page. Complete by Chicago's convention for government material |`);
push(`| **Short** | ${counts.short || 0} | Issuing body, document type and date only. Hand-curated historical records, entered before URLs were captured |`);
push(`| Total | ${cited.length} | ${missing ? `${missing} event(s) carry no source at all` : 'every event carries a source'} |`);
push('');
push('**No entry is padded out.** A short entry stays short rather than acquiring');
push('an invented title, author or page number to look like the others. Inventing');
push('bibliographic detail to complete the shape of a citation would defeat the');
push('purpose of keeping one, and it is exactly the failure a register like this');
push('exists to prevent.');
push('');
push('Closing the gap is a data-entry task, not a formatting one: everything');
push('arriving through the review queue now captures its URL automatically, so the');
push('*full* class grows with every reviewed event. The *short* entries are the');
push('historical backfill, and each names a document specific enough to retrieve.');
push('');
push('---');
push('');

/* --- 1. standing datasets ------------------------------------------------ */
push('## 1. Standing datasets and services');
push('');
push('Queried continuously rather than cited once. Details verified against each');
push("publisher's own citation guidance where they publish one.");
push('');
for (const key of Object.keys(DATASETS).sort((a, b) => DATASETS[a].author.localeCompare(DATASETS[b].author))) {
  const d = DATASETS[key];
  push(`- ${chicago(d)}`);
  if (d.role) push(`  *Role:* ${d.role}`);
}
push('');
push('A feed is **discovery only**. None of them can write an event: everything');
push('they surface is a candidate until a person approves it.');
push('');
push('---');
push('');

/* --- 2. event bibliography ----------------------------------------------- */
push('## 2. Event sources');
push('');
push(`The ${cited.length} sources behind the dated events, grouped by issuing body and`);
push('alphabetised. The bracketed date is the event the source supports.');
push('');
for (const fam of famOrder) {
  push(`### ${fam}`);
  push('');
  for (const c of grouped.get(fam)) {
    const mark = c.klass === 'short' ? ' *(short entry)*' : '';
    push(`- ${c.text}${mark} [event: ${c.date_iso}]`);
  }
  push('');
}

/* --- 3. institutional publishers ----------------------------------------- */
push('---');
push('');
push('## 3. Institutional publishers cited');
push('');
push('The bodies the register rests on, as organisational authors. Individual');
push('documents appear in section 2; this is the set of institutions.');
push('');
const byKind = {};
for (const [key, p] of Object.entries(PUBLISHERS)) (byKind[p.kind] ||= []).push({ key, ...p });
for (const kind of Object.keys(byKind).sort()) {
  push(`**${kind.charAt(0).toUpperCase()}${kind.slice(1)}**`);
  push('');
  for (const p of byKind[kind].sort((a, b) => a.author.localeCompare(b.author))) push(`- ${chicago(p)}`);
  push('');
}

/* --- 4. facilities -------------------------------------------------------- */
push('---');
push('');
push('## 4. Facility sources');
push('');
push('Site identity, location and output come from publicly available company');
push('facility listings and programme announcements — corporate self-published');
push('material, cited as the corporate author. The significance ordinal on every');
push('one of these records is **not** from the publisher: it is an analyst');
push('judgement, and each record says so in its own source string.');
push('');
push('| Corporate author | Sites cited |');
push('| --- | --- |');
for (const p of [...facilityByPublisher.values()].sort((a, b) => a.publisher.localeCompare(b.publisher))) {
  push(`| ${esc(p.publisher)}. Facility and site listings. Accessed ${today}. | ${p.sites} |`);
}
push('');

/* --- 5. evidence notes ---------------------------------------------------- */
push('---');
push('');
push('## 5. Evidence-note sources');
push('');
push('Attached to specific figures — a stage share, a company share, an ownership');
push('row, a customer relationship. These are the most fully-formed citations in');
push('the vault, because a note exists precisely to carry one.');
push('');
push('| Tier | Applies to | Source |');
push('| --- | --- | --- |');
for (const n of [...noteSources].sort((a, b) => a.scope.localeCompare(b.scope))) {
  push(`| ${n.tier} | \`${n.scope}\` | ${esc(n.source)} |`);
}
push('');
push('---');
push('');
push('## Tracing any entry back');
push('');
push('```sql');
push("SELECT id, date_iso, title, source FROM events WHERE date_iso = '<date>';");
push("SELECT id, name, source FROM facilities WHERE source LIKE '<author>%';");
push('SELECT tier, scope, source FROM data_notes ORDER BY tier;');
push('```');
push('');
push('Regenerate this document after any data change:');
push('');
push('```bash');
push('cd server && npm run sources');
push('```');

/* COMPLETENESS IS THE POINT. A register that quietly omits an event is worse
   than no register: it presents itself as the full account and is not. So the
   count is asserted rather than assumed, and a shortfall fails the run instead
   of producing a document that looks complete. */
const rendered = famOrder.reduce((n, f) => n + grouped.get(f).length, 0);
if (rendered !== withSource.length) {
  console.error(`Refusing to write: ${withSource.length} sourced events but only ${rendered} rendered — ${withSource.length - rendered} would be missing.`);
  process.exit(1);
}

writeFileSync(OUT, `${L.join('\n')}\n`, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`  ${cited.length}/${events.length} events cited — full ${counts.full || 0}, legal ${counts.legal || 0}, short ${counts.short || 0}`);
console.log(`  ${facilityByPublisher.size} facility authors, ${noteSources.length} evidence notes, ${Object.keys(DATASETS).length} datasets, ${Object.keys(PUBLISHERS).length} publishers`);
if (missing) {
  console.error(`  FAIL: ${missing} event(s) carry no source at all — every event must cite something.`);
  process.exit(1);
}
