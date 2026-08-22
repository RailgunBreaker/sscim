#!/usr/bin/env node
/* Resolves company-disclosure shorthand into SEC filings.

   Companion to resolve-citations.mjs, which does the same job against the
   Federal Register. Same rule, restated because it is the only thing that
   makes either script worth running: NOTHING IS WRITTEN ON A SIMILARITY
   SCORE. A citation is stored only when a human has confirmed the accession
   number in CONFIRMED below. The search half proposes; it cannot write.

   WHY THIS WORKS FOR PRESS RELEASES. A curator note like "Qualcomm / NXP joint
   announcement" points at a press release, which sounds unciteable. But a US
   registrant furnishes material announcements to the SEC as an 8-K, usually
   with the release itself as Exhibit 99.1. The filing is the same document
   with a permanent identifier attached, and EDGAR is free and keyless.

   WHAT IT CANNOT REACH, and does not pretend to. Samsung, SK hynix, Toshiba,
   SoftBank, Taipower, Volkswagen and the Chinese and Japanese ministries are
   not SEC registrants. Their announcements are real and simply not in this
   register. Those events stay short.

   Usage, from server/:
     node scripts/resolve-sec-citations.mjs --propose   # search aid
     node scripts/resolve-sec-citations.mjs             # resolve and write
*/
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../src/db.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'src', 'resolved-citations-sec.json');
const FR_OUT = resolve(HERE, '..', 'src', 'resolved-citations.json');
const UA = { 'User-Agent': 'sscim-citation-resolver alansong0318@gmail.com' };

const args = process.argv.slice(2);
const PROPOSE = args.includes('--propose');
const DRY = args.includes('--dry-run');
const SHOW = (args.find((a) => a.startsWith('--show=')) || '').split('=')[1];
/* Ten days, not five. A company announces first and files within the week —
   NVIDIA's H20 licensing 8-K landed six days after the event, and a five-day
   window reported it as "not found", which reads as evidence of absence. */
const WINDOW_DAYS = 10;

/* Event id -> SEC accession number(s), confirmed by a human who checked the
   filing is the one the event describes. Populate from --propose output. */
const CONFIRMED = {
  // 6-K carrying the Q3 2017 release: "EUV shipments continue to ramp".
  x1710_euv: '0000937966-17-000017',
  // Item 1.02, termination of a material agreement, filed the day the NXP
  // deal lapsed. The curator note already said "Qualcomm 8-K".
  x1807_qcomnxpfail: '0001104659-18-047166',
  // Item 2.02, filed the day of the investor letter.
  x1901_applewarn: '0000320193-19-000002',
  // 6-K text announces the Arizona fab and names the state commitment.
  x2005_tsmcaz: '0001564590-20-025607',
  // Item 1.01, entry into the Arm acquisition agreement.
  x2009_nvarm: '0001193125-20-244601',
  // Item 1.01, entry into the Xilinx merger agreement. AMD filed three 8-Ks
  // that day; the other two are quarterly results and a Reg FD release.
  x2010_amdxilinx: '0001193125-20-277468',
  // Item 7.01, the IDM 2.0 announcement.
  x2103_intel20b: '0001193125-21-091374',
  // Item 1.02, termination of the Arm agreement.
  x2202_nvarmdead: '0001045810-22-000005',
  /* Item 8.01, the A100/H100 China licence disclosure. AMD's parallel filing
     falls outside EDGAR's recent index, so only NVIDIA's is cited and the
     note still records that both filed. */
  x2208_a100: '0001045810-22-000146',
  // 6-K text: "TSMC Announces Updates for TSMC Arizona", December 6, 2022.
  x2212_tsmcaz40: '0001564590-22-039051',
  // Item 7.01, filed the day after the CAC decision.
  x2305_micronban: '0000723125-23-000028',
  // 6-K carrying the 2Q23 results and guidance — the earnings call the event
  // cites. TSMC filed a second 6-K that week for monthly revenue.
  x2307_tsmcazdelay: '0001628280-23-025146',
  // 6-K carrying the Q3 2024 release, filed the day of the early publication.
  x2410_asmlbookings: '0000937966-24-000022',
  // 6-K document is titled "TSMC expanding investment in the U.S."
  x2503_tsmc100: '0001046179-25-000024',

  /* CHECKED AND DELIBERATELY LEFT SHORT. Samsung, SK hynix, Toshiba, SoftBank,
     Kioxia, Taipower, Volkswagen and the Chinese, Japanese and Dutch
     ministries are not SEC registrants, so their announcements are simply not
     in this register. Several TSMC and NXP 6-K clusters were also left alone:
     where a company furnished several 6-Ks in the same week and none of them
     could be tied to the event by its own text, no citation is better than a
     plausible one. */
};

/* Registrant names as our curator notes write them, mapped to the name EDGAR
   files under. Explicit rather than fuzzy: "Micron" must not match "Micron
   Solutions", a different company entirely. */
const ALIASES = {
  apple: 'Apple Inc.',
  qualcomm: 'QUALCOMM INC/DE',
  nxp: 'NXP Semiconductors N.V.',
  nvidia: 'NVIDIA CORP',
  amd: 'ADVANCED MICRO DEVICES INC',
  xilinx: 'XILINX INC',
  intel: 'INTEL CORP',
  micron: 'MICRON TECHNOLOGY INC',
  broadcom: 'Broadcom Inc.',
  marvell: 'Marvell Technology, Inc.',
  'western digital': 'Western Digital Corp',
  globalfoundries: 'GLOBALFOUNDRIES Inc.',
  tsmc: 'TAIWAN SEMICONDUCTOR MANUFACTURING CO LTD',
  asml: 'ASML HOLDING NV',
  'texas instruments': 'TEXAS INSTRUMENTS INC',
  analog: 'ANALOG DEVICES INC',
  onsemi: 'ON SEMICONDUCTOR CORP',
  amkor: 'AMKOR TECHNOLOGY, INC.',
  entegris: 'ENTEGRIS INC',
  'applied materials': 'APPLIED MATERIALS INC /DE',
  'lam research': 'LAM RESEARCH CORP',
  kla: 'KLA CORP',
  supermicro: 'Super Micro Computer, Inc.',
};

/* Forms that carry an announcement. 8-K for domestic registrants, 6-K for
   foreign private issuers such as TSMC and ASML. */
const FORMS = /^(8-K|6-K|20-F|10-K|10-Q)/;

const shift = (iso, d) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

let cikByName = null;
async function loadCiks() {
  if (cikByName) return cikByName;
  const j = await getJson('https://www.sec.gov/files/company_tickers.json');
  cikByName = new Map();
  for (const r of Object.values(j)) cikByName.set(String(r.title).toLowerCase(), String(r.cik_str).padStart(10, '0'));
  return cikByName;
}

/* Which registrants a curator note names. Word-boundary matched against the
   alias table only — never a substring sweep, which would let "ATS" inside
   "statements" register as a company. */
function registrantsIn(text) {
  const s = String(text).toLowerCase();
  return Object.entries(ALIASES)
    .filter(([alias]) => new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(s))
    .map(([, edgarName]) => edgarName);
}

const submissionsCache = new Map();
async function filingsFor(edgarName) {
  if (submissionsCache.has(edgarName)) return submissionsCache.get(edgarName);
  const ciks = await loadCiks();
  const cik = ciks.get(edgarName.toLowerCase());
  if (!cik) { submissionsCache.set(edgarName, []); return []; }
  let d;
  try { d = await getJson(`https://data.sec.gov/submissions/CIK${cik}.json`); } catch { return []; }
  const r = d.filings?.recent || {};
  const out = (r.accessionNumber || []).map((acc, i) => ({
    accession: acc,
    form: r.form[i],
    filingDate: r.filingDate[i],
    primaryDocument: r.primaryDocument[i],
    description: r.primaryDocDescription?.[i] || null,
    items: r.items?.[i] || null,
    reportDate: r.reportDate?.[i] || null,
    cik,
    registrant: d.name || edgarName,
  }));
  submissionsCache.set(edgarName, out);
  return out;
}

const filingUrl = (f) => `https://www.sec.gov/Archives/edgar/data/${Number(f.cik)}/${f.accession.replace(/-/g, '')}/${f.primaryDocument}`;

const record = (f, from) => ({
  registry: 'sec',
  registrant: f.registrant,
  form: f.form,
  accession: f.accession,
  filingDate: f.filingDate,
  reportDate: f.reportDate,
  items: f.items,
  description: f.description,
  url: filingUrl(f),
  resolvedFrom: from,
  resolvedAt: new Date().toISOString().slice(0, 10),
});

/* Print what is actually inside a filing. A foreign private issuer like TSMC
   furnishes a 6-K for monthly revenue, for board resolutions and for the
   announcement we are after, and the submissions index cannot tell them
   apart — every one is just "6-K". The exhibit list can. */
async function show(list) {
  for (const acc of list.split(',').map((s) => s.trim()).filter(Boolean)) {
    const found = [...submissionsCache.values()].flat().find((f) => f.accession === acc);
    let cik = found?.cik;
    if (!cik) {
      for (const name of Object.values(ALIASES)) {
        const f = (await filingsFor(name)).find((x) => x.accession === acc);
        if (f) { cik = f.cik; break; }
      }
    }
    if (!cik) { console.log(`\n${acc}: not found in any tracked registrant`); continue; }
    const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc.replace(/-/g, '')}`;
    try {
      const idx = await getJson(`${base}/index.json`);
      console.log(`\n${acc}  ${base}`);
      for (const item of idx.directory?.item || []) {
        if (/\.(htm|txt|pdf)$/i.test(item.name)) console.log(`   ${String(item.size).padStart(9)}  ${item.name}`);
      }
    } catch (err) {
      console.log(`\n${acc}: ${err.message}`);
    }
  }
}

/* --- Run ----------------------------------------------------------------- */
if (SHOW) { await show(SHOW); process.exit(0); }

const frResolved = existsSync(FR_OUT) ? JSON.parse(readFileSync(FR_OUT, 'utf8')) : {};
const resolved = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};

const events = db.prepare(`SELECT id, date_iso, title, source FROM events
  WHERE source IS NOT NULL AND source <> '' AND source NOT LIKE '%http%'
  ORDER BY date_iso`).all()
  .filter((e) => !frResolved[e.id])
  .filter((e) => registrantsIn(`${e.source} ${e.title}`).length);

console.log(`${events.length} event(s) name an SEC registrant.\n`);

let added = 0;
const unresolved = [];

for (const e of events) {
  if (resolved[e.id]) continue;

  const wanted = [].concat(CONFIRMED[e.id] || []);
  if (wanted.length) {
    const names = registrantsIn(`${e.source} ${e.title}`);
    const all = (await Promise.all(names.map(filingsFor))).flat();
    const hits = wanted.map((acc) => all.find((f) => f.accession === acc)).filter(Boolean).map((f) => record(f, e.source));
    if (hits.length) {
      resolved[e.id] = hits.length === 1 ? hits[0] : hits;
      added++;
      hits.forEach((h) => console.log(`  ${e.date_iso}  EXACT  ${h.registrant} ${h.form} ${h.accession}`));
      continue;
    }
    console.log(`  ${e.date_iso}  confirmed accession not found in EDGAR: ${wanted.join(', ')}`);
  }
  unresolved.push(e);
}

console.log(`\n${added} resolved by confirmed accession, ${unresolved.length} unresolved.`);

if (PROPOSE) {
  console.log('\n--- candidates for review (nothing below is stored) ---');
  for (const e of unresolved) {
    const names = registrantsIn(`${e.source} ${e.title}`);
    console.log(`\n${e.date_iso}  ${e.id}\n  event:  ${e.title}\n  source: ${e.source}\n  names:  ${names.join(', ')}`);
    for (const n of names) {
      const all = await filingsFor(n);
      const near = all.filter((f) => FORMS.test(f.form)
        && f.filingDate >= shift(e.date_iso, -WINDOW_DAYS) && f.filingDate <= shift(e.date_iso, WINDOW_DAYS));
      if (!near.length) { console.log(`    ${n}: no filing in window (EDGAR 'recent' may not reach this far back)`); continue; }
      near.forEach((f) => console.log(`    ${f.accession}  ${f.form.padEnd(5)} ${f.filingDate}  ${f.registrant}  items=${f.items || '-'}  ${f.description || ''}`));
    }
  }
  console.log('\nAdd verified accession numbers to CONFIRMED in this script, then re-run.');
}

if (DRY || PROPOSE) {
  console.log('\n(nothing written)');
} else {
  writeFileSync(OUT, `${JSON.stringify(resolved, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUT}`);
}
