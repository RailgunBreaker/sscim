#!/usr/bin/env node
/* Resolves short event sources into full, verified citations.

   THE PROBLEM. Most event sources are curator shorthand — "BIS interim final
   rule (May 15, 2020)". Enough to find the document, not enough to be a
   citation. The obvious fix is to research each one by hand, which is slow
   and, worse, tempting to shortcut into plausible-looking guesses.

   THE FIX. US regulatory material is already published in a free, keyless,
   authoritative API. The Federal Register indexes every rule, notice and
   presidential document, so shorthand that names a body and a date can be
   turned into the real title, document number and permanent URL.

   THE RULE THIS SCRIPT ENFORCES. Nothing is ever written on the strength of a
   similarity score. A citation is stored only when an EXACT identifier ties
   the event to the document:

     1. an explicit Federal Register citation in the source ("87 FR 62186"),
     2. an executive order number ("Executive Order 14017"), or
     3. a document number a human put in CONFIRMED below after reading it.

   Fuzzy search exists here only under --propose, where it prints candidates
   for a person to check. It cannot write. That asymmetry is the whole design:
   a wrong citation is worse than a short one, because a short entry tells a
   reader to go looking while a wrong entry tells them they have arrived.

   Output goes to server/src/resolved-citations.json, keyed by event id, so it
   is reviewable in a diff, fetched once, and cannot drift under the register.

   Usage, from server/:
     node scripts/resolve-citations.mjs            # resolve exact matches, write
     node scripts/resolve-citations.mjs --propose  # search aid: print candidates
     node scripts/resolve-citations.mjs --dry-run  # resolve, write nothing
*/
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../src/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'src', 'resolved-citations.json');
const API = 'https://www.federalregister.gov/api/v1';
const FIELDS = ['title', 'document_number', 'html_url', 'publication_date', 'type', 'agencies', 'citation', 'executive_order_number', 'president', 'abstract'];

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const PROPOSE = args.includes('--propose');
const SHOW = (args.find((a) => a.startsWith('--show=')) || '').split('=')[1];
const WINDOW_DAYS = 24;

/* Event id -> Federal Register document number, confirmed by a human who
   opened the document and checked it is the one the event describes.

   Populate this from --propose output. The comment on each line records what
   was verified, so a later reader can re-check the judgement rather than
   having to trust it. */
const CONFIRMED = {
  // Title names ZTE and both named subsidiaries.
  x1804_zte: '2018-08354',
  // Adds exactly one entity, under China, effective the event date. Fujian
  // Jinhua was the only entity listed in that action.
  x1810_jinhua: '2018-23693',
  // The emerging-technologies ANPRM itself, published on the event date.
  x1811_anprm: '2018-25221',
  // Two rules published the same day: the abstract of the first names the
  // forty-six additional Huawei affiliates, the second extends the temporary
  // general licence. The event describes both, so both are cited.
  x1908_huaweitgl: ['2019-17921', '2019-17920'],
  // Title states the General Prohibition Three (FDPR) amendment.
  x2005_fdpr: '2020-10856',
  // Title states the Huawei non-U.S. affiliate additions and the FDPR change.
  x2008_fdpr2: '2020-18213',
  // The December 2020 Entity List rule at 85 FR 83416, which carried the SMIC
  // addition. Abstract confirms seventy-seven entities including China.
  x2012_smicel: '2020-28031',
  /* Abstract names GAAFET ECAD software and the substrate controls. NOTE: it
     specifies gallium oxide and diamond — NOT silicon carbide, which the event
     title claimed. The event was corrected against this document. */
  x2208_eda: '2022-17125',
  // Thirty-six entities under China and Japan. The neighbouring UVL rule
  // (2022-27149) was checked and rejected: it covers Russia and Pakistan.
  x2212_ymtc: '2022-27151',
  // The advanced-computing half of the October 2023 package. Its sibling
  // (2023-23049) covers semiconductor manufacturing equipment instead.
  h2310_bisupdate: '2023-23055',
  // Thirteen Chinese entities, published two days after the announcement.
  x2310_biren: '2023-23048',
  // The CHIPS Act guardrails proposed rule.
  x2302_chipsguardrails: '2023-05869',
  // USTR's Section 301 four-year review proposed modifications.
  x2405_301: '2024-11634',
  // Abstract names the semiconductor, quantum and additive controls.
  x2409_gaafet: '2024-19633',
  // The December 2024 package is two concurrent rules that cross-reference
  // each other: the FDPR/HBM controls and the 140-entity listing.
  h2412_bis3: ['2024-28270', '2024-28267'],
  // The AI Diffusion framework rule.
  h2501_diffusion: '2025-00636',
  // The foundry/OSAT due-diligence rule plus the sixteen-entity addition
  // (China 14, Singapore 2) published alongside it.
  x2501_foundryrule: ['2025-00711', '2025-00480'],
  // Executive Order 14257, the reciprocal tariff order.
  x2504_tariffs: '2025-06063',
  // The Section 232 semiconductor investigation comment request.
  x2504_232: '2025-06591',
  // Revocation of the Samsung and SK hynix China VEU authorisations.
  x2508_veurevoke: '2025-16735',
  // Expansion of end-user controls to affiliates of listed entities.
  x2509_affiliates: '2025-19001',
  // Revision to the licence review policy for advanced computing commodities.
  h2601_ease: '2026-00789',

  /* CHECKED AND DELIBERATELY LEFT SHORT. Each was searched; no Federal
     Register document corresponds, so no citation is stored:
       x1612_aixtron, x1803_broadcomqcom  presidential CFIUS orders, not FR rules
       x1807_zteoff                       settlement announcement, not published
       x2009_smicrestrict                 Commerce letters to suppliers
       x2210_veu                          VEU authorisations issued privately
       h2405_huawei                       licence revocations, not published
       h2505_rescind                      announced by BIS; no FR rescission found
       h2606_subs                         no matching FR document */
};

/* Agencies that actually publish in the Federal Register. A MOFCOM notice or
   a company press release is not resolvable here and is not attempted. */
const AGENCY = [
  [/^BIS\b|Bureau of Industry/i, 'industry-and-security-bureau'],
  [/Commerce Department|Department of Commerce|^Commerce\b/i, 'commerce-department'],
  [/USTR|Trade Representative|Section 301/i, 'trade-representative-office-of-united-states'],
  [/CFIUS|Treasury/i, 'investment-security-office'],
];

const shift = (iso, d) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

async function api(path, params) {
  const p = new URLSearchParams(params || {});
  FIELDS.forEach((f) => p.append('fields[]', f));
  const res = await fetch(`${API}${path}?${p}`, { headers: { 'User-Agent': 'sscim-citation-resolver/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* Every document an agency published around a date.

   Paginated deliberately. A single page silently truncates — Commerce alone
   publishes well over a hundred documents in a seven-week window, and the
   first attempt at this quietly dropped the CHIPS Act guardrails rule for
   exactly that reason. A search aid that hides the answer is worse than none,
   because it reads as evidence the document does not exist. */
async function fetchWindow({ dateIso, agency, days = WINDOW_DAYS }) {
  const base = {
    'conditions[publication_date][gte]': shift(dateIso, -days),
    'conditions[publication_date][lte]': shift(dateIso, days),
    per_page: '1000',
    order: 'oldest',
  };
  if (agency) base['conditions[agencies][]'] = agency;

  const out = [];
  for (let page = 1; page <= 5; page++) {
    const json = await api('/documents.json', { ...base, page: String(page) });
    out.push(...(json.results || []));
    if (!json.total_pages || page >= json.total_pages) break;
  }
  return out;
}

const record = (r, how, from) => ({
  title: r.title,
  documentNumber: r.document_number,
  url: r.html_url,
  publicationDate: r.publication_date,
  citation: r.citation || null,
  type: r.type || null,
  executiveOrder: r.executive_order_number || null,
  agencies: (r.agencies || []).map((a) => a.name || a.raw_name).filter(Boolean),
  matchedBy: how,
  resolvedFrom: from,
  resolvedAt: new Date().toISOString().slice(0, 10),
});

/* --- Exact path 1: an explicit Federal Register citation in the source ----
   Not a term search. Searching for "84 FR 22961" returns documents that CITE
   that page, not the document printed on it — the first version of this
   silently matched the wrong papers. Instead every document published near
   the event is listed and the citation string is matched exactly, which is
   what "84 FR 22961" actually identifies. */
async function byRegisterCitation(source, dateIso, agency) {
  const m = String(source).match(/\b(\d{2,3})\s*FR\s*(\d{3,6})\b/i);
  if (!m) return null;
  const want = `${m[1]} FR ${m[2]}`;
  for (const scope of [agency, null]) {
    const docs = await fetchWindow({ dateIso, agency: scope, days: 45 });
    const hit = docs.find((r) => r.citation === want);
    if (hit) return record(hit, `Federal Register citation ${want}`, source);
    if (!scope) break;
  }
  return null;
}

/* --- Exact path 2: an executive order number in the source --------------- */
async function byExecutiveOrder(source, dateIso) {
  const m = String(source).match(/Executive Order\s*(\d{5})/i);
  if (!m) return null;
  const want = Number(m[1]);
  const json = await api('/documents.json', {
    'conditions[presidential_document_type][]': 'executive_order',
    'conditions[publication_date][gte]': shift(dateIso, -WINDOW_DAYS),
    'conditions[publication_date][lte]': shift(dateIso, WINDOW_DAYS),
    per_page: '60',
  });
  const hit = (json.results || []).find((r) => Number(r.executive_order_number) === want);
  return hit ? record(hit, `Executive Order ${want}`, source) : null;
}

/* --- Exact path 3: a document number a human confirmed ------------------- */
async function byDocumentNumber(docNumber, source) {
  const json = await api(`/documents/${encodeURIComponent(docNumber)}.json`, {});
  return json && json.document_number ? record(json, `confirmed document ${docNumber}`, source) : null;
}

/* --- Search aid (never writes) -------------------------------------------
   Ranks documents published near the event by how much of the curator note's
   vocabulary appears in the title, then by date proximity. Its only job is to
   put the right document in front of a person quickly. */
const STOP = new Set(['the', 'of', 'and', 'for', 'to', 'in', 'on', 'a', 'an', 'us', 'u', 's', 'its', 'with', 'from', 'plus', 'more', 'official', 'company', 'reporting', 'analysis', 'analyst', 'summaries', 'disclosures', 'filings', 'record', 'letters', 'public', 'confirmation', 'announcement']);
const tok = (s) => [...new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];

async function propose(e) {
  const agency = (AGENCY.find(([re]) => re.test(e.source)) || [])[1] || null;
  let results = [];
  try { results = await fetchWindow({ dateIso: e.date_iso, agency }); } catch { return []; }

  const want = tok(`${e.source} ${e.title}`);
  const day = Date.parse(`${e.date_iso}T00:00:00Z`);
  return results
    .map((r) => {
      /* Title AND abstract. An Entity List rule is titled "Addition of
         Entities to the Entity List" and names the companies only in the
         abstract, so title-only matching cannot tell one from the next. */
      const t = new Set([...tok(r.title), ...tok(r.abstract || '')]);
      const overlap = want.filter((w) => t.has(w)).length / Math.max(want.length, 1);
      const near = 1 - Math.min(Math.abs(Date.parse(`${r.publication_date}T00:00:00Z`) - day) / (WINDOW_DAYS * 86400000), 1);
      return { r, s: overlap * 0.7 + near * 0.3 };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, 4);
}

/* Print a document in full so a person can check it before confirming. This
   is the step that makes CONFIRMED trustworthy rather than decorative. */
async function show(list) {
  for (const dn of list.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      const d = await api(`/documents/${encodeURIComponent(dn)}.json`, {});
      console.log(`\n${dn}  ${d.citation || ''}  ${d.publication_date}  [${d.type || ''}]`);
      console.log(`  ${d.title}`);
      console.log(`  ${d.html_url}`);
      console.log(`  ${(d.abstract || '(no abstract)').replace(/\s+/g, ' ')}`);
    } catch (err) {
      console.log(`\n${dn}: ${err.message}`);
    }
  }
}

/* --- Run ----------------------------------------------------------------- */
if (SHOW) { await show(SHOW); process.exit(0); }

const resolved = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};

const events = db.prepare(`SELECT id, date_iso, title, source FROM events
  WHERE source IS NOT NULL AND source <> '' AND source NOT LIKE '%http%'
  ORDER BY date_iso`).all()
  .filter((e) => AGENCY.some(([re]) => re.test(e.source)) || /Executive Order|Presidential/i.test(e.source));

console.log(`${events.length} US-regulatory event(s) in scope.\n`);

let added = 0;
let short = 0;
const unresolved = [];

for (const e of events) {
  if (resolved[e.id]) continue;
  const agency = (AGENCY.find(([re]) => re.test(e.source)) || [])[1] || null;
  let hits = [];
  try {
    /* An event can rest on more than one document — the August 2019 action
       both listed 46 Huawei affiliates and extended the temporary general
       licence, in two separate rules published the same day. Citing one and
       dropping the other would misdescribe the event. */
    for (const dn of [].concat(CONFIRMED[e.id] || [])) {
      const r = await byDocumentNumber(dn, e.source);
      if (r) hits.push(r);
    }
    if (!hits.length) {
      const r = await byRegisterCitation(e.source, e.date_iso, agency);
      if (r) hits.push(r);
    }
    if (!hits.length) {
      const r = await byExecutiveOrder(e.source, e.date_iso);
      if (r) hits.push(r);
    }
  } catch (err) {
    console.log(`  ${e.date_iso}  lookup failed: ${err.message}`);
  }

  if (hits.length) {
    resolved[e.id] = hits.length === 1 ? hits[0] : hits;
    added++;
    hits.forEach((h) => console.log(`  ${e.date_iso}  EXACT  ${h.citation || h.documentNumber}  ${h.title.slice(0, 60)}`));
  } else {
    short++;
    unresolved.push(e);
  }
}

console.log(`\n${added} resolved by exact identifier, ${short} still short, ${Object.keys(resolved).length} on file.`);

if (PROPOSE && unresolved.length) {
  console.log('\n--- candidates for review (nothing below is stored) ---');
  for (const e of unresolved) {
    console.log(`\n${e.date_iso}  ${e.id}\n  event:  ${e.title}\n  source: ${e.source}`);
    const cands = await propose(e);
    if (!cands.length) { console.log('  (no Federal Register documents found in window)'); continue; }
    cands.forEach(({ r, s }) => {
      console.log(`   [${s.toFixed(2)}] ${r.document_number}  ${r.publication_date}  ${r.citation || ''}`);
      console.log(`          ${r.title}`);
    });
  }
  console.log('\nAdd verified document numbers to CONFIRMED in this script, then re-run.');
}

if (DRY || PROPOSE) {
  console.log('\n(nothing written)');
} else {
  writeFileSync(OUT, `${JSON.stringify(resolved, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUT}`);
}
