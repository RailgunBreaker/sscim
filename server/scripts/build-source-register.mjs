#!/usr/bin/env node
/* Regenerates docs/reference/SOURCE-REGISTER.md from the vault.

   WHY GENERATED. The register carries every source behind every event,
   facility and evidence note. A hand-maintained bibliography of that size is
   out of date the day after it is written, and a stale one is worse than none:
   it invites a reader to believe a citation still stands for something that
   has changed.

   HOW A CITATION IS BUILT, in descending order of completeness:

     1. RESOLVED — a curator's shorthand looked up against the Federal Register
        and tied to the actual document by an exact identifier. Carries the
        real title, agency, register locator, publication date and permanent
        URL. See scripts/resolve-citations.mjs for how, and for why nothing is
        ever matched on a similarity score.
     2. FULL — the reviewed events. Their candidate record carries the article
        title, the publishing site, the publication date and the URL, so a
        complete Chicago entry is assembled from real captured metadata.
     3. LEGAL — a source naming a Federal Register volume and page. Chicago
        cites government material by issuing body and register locator; the
        locator is exact and resolvable, so the entry is complete without a
        title.
     4. SHORT — the hand-curated historical events. Their record names the
        issuing body, the document type and the date, and nothing more. The
        entry says exactly that. It does NOT get a title invented for it.

   The register reports how many fall in each class, because "163 sources" and
   "163 fully-formed citations" are different claims and only one of them is
   true. Closing the gap is a data-entry task — recording the URL at review
   time, or resolving the document — not a formatting one.

   Run from server/:  node scripts/build-source-register.mjs  */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../src/db.js';
import { chicago, agencyAuthor, DATASETS, PUBLISHERS, publishersFor } from '../src/citations.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', '..', 'docs', 'reference', 'SOURCE-REGISTER.md');
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

/* ---- citations resolved against the Federal Register --------------------
   scripts/resolve-citations.mjs turns a curator's shorthand into the actual
   document, but only ever through an exact identifier — a Federal Register
   citation, an executive order number, or a document number a person
   confirmed after reading the abstract. Nothing there was matched on a
   similarity score, so what lands here is publisher-verified and can be
   rendered as a complete entry. */
const readIf = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {});
const RESOLVED = readIf(resolve(HERE, '..', 'src', 'resolved-citations.json'));
/* Same discipline, different register: scripts/resolve-sec-citations.mjs
   resolves company announcements to the SEC filing that carries them, again
   only on a confirmed accession number. */
const RESOLVED_SEC = readIf(resolve(HERE, '..', 'src', 'resolved-citations-sec.json'));

/* The literature behind the mathematics, verified by
   scripts/resolve-method-citations.mjs against Crossref, Open Library or the
   issuing body. A list rather than a map keyed by event: a method is not
   attached to one dated thing, it underlies every number the engine emits. */
const METHOD_CITATIONS = (() => {
  const p = resolve(HERE, '..', 'src', 'citations-methods.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
})();

/* Registrant names as EDGAR stores them are shouted and suffixed for its own
   indexes — "QUALCOMM INC/DE", "NVIDIA CORP". Rendered literally they read as
   a database dump. Unknown names pass through untouched rather than being
   rewritten by rule. */
const REGISTRANT_NAMES = {
  'QUALCOMM INC/DE': 'Qualcomm Incorporated',
  'NVIDIA CORP': 'NVIDIA Corporation',
  'ADVANCED MICRO DEVICES INC': 'Advanced Micro Devices, Inc.',
  'INTEL CORP': 'Intel Corporation',
  'MICRON TECHNOLOGY INC': 'Micron Technology, Inc.',
  'ASML HOLDING NV': 'ASML Holding N.V.',
  'TAIWAN SEMICONDUCTOR MANUFACTURING CO LTD': 'Taiwan Semiconductor Manufacturing Company Limited',
  'WESTERN DIGITAL CORP': 'Western Digital Corporation',
  'XILINX INC': 'Xilinx, Inc.',
};

/* What the SEC calls each form, so the entry describes a document rather than
   reciting a form number at a reader who may not know it. */
const FORM_TITLES = {
  '8-K': 'Current Report on Form 8-K',
  '6-K': 'Report of Foreign Private Issuer on Form 6-K',
  '10-K': 'Annual Report on Form 10-K',
  '10-Q': 'Quarterly Report on Form 10-Q',
  '20-F': 'Annual Report on Form 20-F',
};

function secEntries(event) {
  const hit = RESOLVED_SEC[event.id];
  if (!hit) return null;
  return [].concat(hit).map((d) => ({
    klass: 'resolved',
    text: chicago({
      author: REGISTRANT_NAMES[d.registrant] || d.registrant,
      title: FORM_TITLES[d.form] || `Filing on Form ${d.form}`,
      container: 'U.S. Securities and Exchange Commission, EDGAR',
      /* The accession number is the filing's permanent identifier, and the
         part a reader searches on. It belongs where a locator belongs. */
      register: `accession no. ${d.accession}`,
      date: longDate(d.filingDate),
      url: d.url,
      accessed: today,
    }),
  }));
}

function resolvedEntries(event) {
  const hit = RESOLVED[event.id];
  if (!hit) return null;
  return [].concat(hit).map((d) => ({
    klass: 'resolved',
    text: chicago({
      author: agencyAuthor(d.agencies) || 'Office of the Federal Register',
      /* Chicago cites an executive order by its number and title together;
         the number is the part a reader actually looks it up by. */
      title: d.executiveOrder ? `Executive Order ${d.executiveOrder}: ${d.title}` : d.title,
      container: 'Federal Register',
      register: d.citation ? d.citation.replace(/\bFR\b/, 'Fed. Reg.') : null,
      date: longDate(d.publicationDate),
      url: d.url,
      accessed: today,
    }),
  }));
}

/* Build the best citation(s) the record supports, and say which kind each is.
   Returns an array: an event can rest on more than one document, and citing
   one of a pair of concurrent rules would misdescribe what happened. */
function citationsFor(event) {
  const resolvedHit = resolvedEntries(event) || secEntries(event);
  if (resolvedHit) return resolvedHit;
  return [citationFor(event)];
}

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
const cited = withSource.flatMap((e) => citationsFor(e).map((c) => ({ ...e, ...c })));

const counts = cited.reduce((a, c) => { a[c.klass] = (a[c.klass] || 0) + 1; return a; }, {});
/* Entries outnumber events wherever one event rests on several documents, so
   the two are counted separately rather than one standing in for the other. */
const citedEvents = new Set(cited.map((c) => c.id)).size;
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
push('reviewed. Four classes, counted rather than blurred together:');
push('');
push('| Class | Entries | What the record carries |');
push('| --- | --- | --- |');
push(`| **Resolved** | ${counts.resolved || 0} | Looked up against the *Federal Register* or SEC EDGAR and tied to the document by an exact identifier: real title, issuer, locator, date and permanent URL |`);
push(`| **Full** | ${counts.full || 0} | Title, publisher, date and URL — captured automatically at review and assembled into a complete entry |`);
push(`| **Legal** | ${counts.legal || 0} | Issuing body and an exact *Federal Register* volume and page. Complete by Chicago's convention for government material |`);
push(`| **Short** | ${counts.short || 0} | Issuing body, document type and date only. Hand-curated historical records for which no published document was found |`);
push(`| Total | ${cited.length} | across ${citedEvents} event(s); ${missing ? `${missing} event(s) carry no source at all` : 'every event carries a source'} |`);
push('');
push('**No entry is padded out.** A short entry stays short rather than acquiring');
push('an invented title, author or page number to look like the others. Inventing');
push('bibliographic detail to complete the shape of a citation would defeat the');
push('purpose of keeping one, and it is exactly the failure a register like this');
push('exists to prevent.');
push('');
push('That constraint is what makes the *resolved* class trustworthy. Every entry');
push('in it was matched to its document by an exact identifier — a register');
push('citation, an executive order number, an SEC accession number — and never by');
push('a similarity score. Two registers were searched exhaustively: the *Federal');
push('Register* for regulatory action, and SEC EDGAR for company announcements,');
push('which a US registrant furnishes as a filing even when it reads as a press');
push('release.');
push('');
push('Where neither register held the document, the entry stayed short, and that');
push('is a finding rather than a gap. Presidential CFIUS orders, export-licence');
push('revocations and settlement announcements were never published as *Federal');
push('Register* documents. Samsung, SK hynix, Toshiba, SoftBank, Kioxia, Taipower');
push('and the Chinese, Japanese and Dutch ministries are not SEC registrants, so');
push('their announcements are real and simply not in either register. Several');
push('filings were left alone for a subtler reason: where a company furnished');
push('half a dozen reports in the same week and none could be tied to the event by');
push('its own text, no citation is better than a plausible one.');
push('');
push('The remainder is a data-entry task, not a formatting one: everything');
push('arriving through the review queue now captures its URL automatically, so the');
push('*full* class grows with every reviewed event.');
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

/* --- 3. methods ----------------------------------------------------------
   The literature behind the mathematics. Kept next to the event sources
   rather than in an appendix: where a number came from and how it was
   combined are the same kind of question. */
push('---');
push('');
push('## 3. Methods and the literature behind them');
push('');
push('Every technique the engine actually runs, tied to the file that runs it.');
push('Verified against Crossref, Open Library or the issuing body — no DOI here');
push('was written from memory.');
push('');
push('**The declared priors are deliberately absent from this section.** The');
push('12-day half-life, the transmission coefficients and the stage weights are');
push('analyst judgement (Tier D). Attaching a reference to one of them would');
push('launder an assumption into a finding, which is the opposite of what this');
push('register is for. What is cited is the *form* of each calculation, never the');
push('*values* fed into it.');
push('');
for (const m of [...new Set(METHOD_CITATIONS.map((c) => c.method))].sort()) {
  const group = METHOD_CITATIONS.filter((c) => c.method === m);
  push(`### ${m}`);
  push('');
  push(`Implemented in \`${group[0].implementedIn}\`.`);
  push('');
  for (const c of group.sort((a, b) => String(a.author).localeCompare(String(b.author)))) {
    push(`- ${chicago({
      author: c.author,
      /* Crossref preserves a journal's own footnote marks in the title —
         Brandes 2001 comes back as "…betweenness centrality*". They are
         typography from the page, not part of the title. */
      title: String(c.title || '').replace(/[*†‡]+\s*$/, '').trim(),
      standalone: c.standalone || c.type === 'book' || c.type === 'report',
      container: c.container,
      volume: c.volume,
      issue: c.issue,
      pages: c.pages,
      date: c.year ? String(c.year) : null,
      publisher: c.publisher,
      doi: c.doi,
      url: c.doi ? null : c.url,
    })}`);
    push(`  *Why cited:* ${c.role}`);
    push(`  *Verified against:* ${c.verifiedAgainst}.${c.verificationNote ? ` ${c.verificationNote}` : ''}`);
  }
  push('');
}

/* --- 4. institutional publishers ----------------------------------------- */
push('---');
push('');
push('## 4. Institutional publishers cited');
push('');
push('The bodies the register rests on, as organisational authors. Individual');
push('documents appear in sections 2 and 3; this is the set of institutions.');
push('');
const byKind = {};
for (const [key, p] of Object.entries(PUBLISHERS)) (byKind[p.kind] ||= []).push({ key, ...p });
for (const kind of Object.keys(byKind).sort()) {
  push(`**${kind.charAt(0).toUpperCase()}${kind.slice(1)}**`);
  push('');
  for (const p of byKind[kind].sort((a, b) => a.author.localeCompare(b.author))) push(`- ${chicago(p)}`);
  push('');
}

/* --- 5. facilities -------------------------------------------------------- */
push('---');
push('');
push('## 5. Facility sources');
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

/* --- 6. evidence notes ---------------------------------------------------- */
push('---');
push('');
push('## 6. Evidence-note sources');
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
/* Assert on EVENTS represented, not on lines emitted. An event resting on two
   concurrent rules renders two entries, so line count and event count are no
   longer the same number and comparing them would either fail spuriously or,
   worse, let a genuinely missing event hide behind a duplicated one. */
const renderedEvents = new Set();
for (const f of famOrder) for (const c of grouped.get(f)) renderedEvents.add(c.id);
const absent = withSource.filter((e) => !renderedEvents.has(e.id));
if (absent.length) {
  console.error(`Refusing to write: ${absent.length} sourced event(s) would be missing from the register:`);
  absent.slice(0, 10).forEach((e) => console.error(`  ${e.date_iso}  ${e.id}`));
  process.exit(1);
}

writeFileSync(OUT, `${L.join('\n')}\n`, 'utf8');
console.log(`Wrote ${OUT}`);
console.log(`  ${citedEvents}/${events.length} events cited in ${cited.length} entries — resolved ${counts.resolved || 0}, full ${counts.full || 0}, legal ${counts.legal || 0}, short ${counts.short || 0}`);
console.log(`  ${facilityByPublisher.size} facility authors, ${noteSources.length} evidence notes, ${Object.keys(DATASETS).length} datasets, ${Object.keys(PUBLISHERS).length} publishers`);
if (missing) {
  console.error(`  FAIL: ${missing} event(s) carry no source at all — every event must cite something.`);
  process.exit(1);
}
