#!/usr/bin/env node
/* Resolves the methods the engine implements to the literature they come from.

   WHY THIS WAS MISSING, AND WHY IT MATTERS. The register cited every event,
   facility and evidence note, and nothing at all for the mathematics. That is
   the wrong way round for a research prototype: a reader can check where a
   date came from but not where a formula came from, and the formulas are the
   part that turns data into a claim.

   WHAT IS AND IS NOT CITED HERE. Only techniques the code actually runs, each
   tied to the file that runs it. A citation attached to a method the engine
   does not use would be decoration, and worse than none — it implies a
   provenance the code does not have. The declared priors are NOT cited: the
   half-life, the transmission coefficients and the stage weights are analyst
   judgement (Tier D), and dressing them in a reference would launder an
   assumption into a finding.

   THE SAME RULE AS THE OTHER RESOLVERS. Nothing is written on a similarity
   score, and no DOI is ever asserted from memory. This script proposes a work
   by title and author; Crossref confirms it exists and returns the canonical
   record — DOI, container, volume, pages, year — and only Crossref's own
   metadata is stored. Where the returned title does not match what was asked
   for, the entry is rejected rather than accepted with a shrug.

   Usage, from server/:
     node scripts/resolve-method-citations.mjs --propose  # show what matched
     node scripts/resolve-method-citations.mjs           # verify and write
*/
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'src', 'citations-methods.json');
const UA = { 'User-Agent': 'sscim-citation-resolver alansong0318@gmail.com' };
const API = 'https://api.crossref.org/works';

const args = process.argv.slice(2);
const PROPOSE = args.includes('--propose');

/* Each entry: the technique, the file that implements it, why the work is
   cited, and the title to ask Crossref for. `expect` is the acceptance test —
   a normalised substring the returned title must contain. It is what makes
   this verification rather than search. */
const METHODS = [
  {
    method: 'Noisy-OR combination',
    implementedIn: 'app/src/engine/math.js — combineSigned()',
    role: 'The noisy-OR gate as a parameter-reduction device, and its behaviour on small samples.',
    query: 'Onisko Druzdzel Wasyluk Learning Bayesian network parameters from small data sets application of noisy-OR gates',
    expect: 'noisy-or',
    expectContainer: 'International Journal of Approximate Reasoning',
  },
  {
    method: 'Exponential decay of event salience',
    implementedIn: 'app/src/engine/math.js — decay(); priors.js — halfLifeDays',
    role: 'Empirical basis for treating attention to an event as decaying rather than persisting. The 12-day half-life itself is a declared prior, not a fitted value.',
    query: 'Wu Huberman Novelty and collective attention',
    expect: 'novelty and collective attention',
    expectContainer: 'Proceedings of the National Academy of Sciences',
  },
  {
    method: 'Betweenness centrality',
    implementedIn: 'app/src/engine/networkAnalysis.js — betweenness()',
    role: 'The algorithm implemented, and the normalisation used.',
    query: 'Brandes A faster algorithm for betweenness centrality Journal of Mathematical Sociology',
    expect: 'faster algorithm for betweenness centrality',
    expectContainer: 'Journal of Mathematical Sociology',
  },
  {
    method: 'Betweenness centrality',
    implementedIn: 'app/src/engine/networkAnalysis.js — betweenness()',
    role: 'The definition of the measure the algorithm computes.',
    query: 'Freeman A set of measures of centrality based on betweenness Sociometry',
    expect: 'centrality based on betweenness',
    expectContainer: 'Sociometry',
  },
  {
    method: 'Topological ordering of a DAG',
    implementedIn: 'app/src/engine/math.js — topologicalSort()',
    role: 'The ordering algorithm used to evaluate stages in dependency order.',
    query: 'Kahn Topological sorting of large networks Communications of the ACM',
    expect: 'topological sorting of large networks',
    expectContainer: 'Communications of the ACM',
  },
  {
    method: 'Widest-path / bottleneck routing',
    implementedIn: 'app/src/engine/networkPaths.js — bottleneck objective',
    role: 'The maximum-capacity route problem, which the bottleneck ranking solves.',
    query: 'Hu The maximum capacity route problem Operations Research',
    expect: 'maximum capacity route',
    expectContainer: 'Operations Research',
  },
  {
    method: 'Node-removal sensitivity',
    implementedIn: 'app/src/engine/networkAnalysis.js — removal_impact metric',
    role: 'The attack-tolerance framing: how much connectivity a network loses when a node is removed.',
    query: 'Albert Jeong Barabasi Error and attack tolerance of complex networks Nature',
    expect: 'error and attack tolerance',
    expectContainer: 'Nature',
  },
  {
    method: 'One-at-a-time sensitivity bands',
    implementedIn: 'app/src/engine/priors.js — low/high prior bands',
    role: 'Global sensitivity analysis reference, and the standard critique of the one-at-a-time approach this model uses. Cited as a stated limitation, not as endorsement.',
    query: 'Saltelli Annoni How to avoid a perfunctory sensitivity analysis Environmental Modelling Software',
    expect: 'perfunctory sensitivity analysis',
    expectContainer: 'Environmental Modelling',
  },
  {
    method: 'Shock propagation in production networks',
    implementedIn: 'app/src/engine/index.js — operational impact propagation',
    role: 'Why disaggregated network structure, rather than aggregate shares, governs how a local shock spreads.',
    query: 'Acemoglu Carvalho Ozdaglar Tahbaz-Salehi The Network Origins of Aggregate Fluctuations Econometrica',
    expect: 'network origins of aggregate fluctuations',
    expectContainer: 'Econometrica',
    queryContainer: 'Econometrica',
  },
  {
    method: 'Shock propagation in production networks',
    implementedIn: 'app/src/engine/index.js — operational impact propagation',
    role: 'Evidence that input specificity — the absence of substitutes — governs propagation strength. The dependence matrices encode this idea as a prior.',
    query: 'Barrot Sauvagnat Input specificity and the propagation of idiosyncratic shocks in production networks',
    expect: 'input specificity',
    expectContainer: 'Quarterly Journal of Economics',
  },
  {
    method: 'Shock propagation in production networks',
    implementedIn: 'app/src/engine/index.js — operational impact propagation',
    role: 'Firm-level evidence from a natural disaster that upstream and downstream propagation both occur — the empirical case for a site-level layer.',
    query: 'Carvalho Nirei Saito Tahbaz-Salehi Supply Chain Disruptions Evidence from the Great East Japan Earthquake',
    expect: 'great east japan earthquake',
    expectContainer: 'Quarterly Journal of Economics',
  },
  {
    method: 'Shock propagation in production networks',
    implementedIn: 'app/src/engine/facilityNetwork.js',
    role: 'Simulation evidence on how far firm-level supply-chain shocks travel, supporting a bounded propagation horizon.',
    query: 'Inoue Todo Firm-level propagation of shocks through supply-chain networks Nature Sustainability',
    expect: 'propagation of shocks through supply-chain networks',
    expectContainer: 'Nature Sustainability',
  },
  {
    method: 'Disruption severity in supply chains',
    implementedIn: 'app/src/engine/index.js — severity and structural vulnerability',
    role: 'The design factors that determine how severe a supply-chain disruption becomes — density, complexity, node criticality.',
    query: 'Craighead Blackhurst Rungtusanatham Handfield The severity of supply chain disruptions design characteristics and mitigation capabilities',
    expect: 'severity of supply chain disruptions',
    expectContainer: 'Decision Sciences',
  },
  {
    method: 'Input-output structure',
    implementedIn: 'app/src/engine/graph.js — stage dependence matrices',
    role: 'The input-output framework the stage graph approximates. Cited to be explicit that the dependence matrices are equal-allocation priors, not measured technical coefficients.',
    query: 'Miller Blair Input-Output Analysis Foundations and Extensions',
    expect: 'input-output analysis',
  },
];

/* --- works Crossref does not index ---------------------------------------
   Crossref covers material with a DOI, which excludes a 1988 monograph and a
   1945 book — both of which are load-bearing here. Dropping them would put a
   hole in the bibliography exactly where its oldest foundations are, so each
   is verified against a different authority instead: Open Library for books,
   and the issuing body's own site for government documents. What matters is
   that SOMETHING independent confirms the record, not that it is Crossref. */
const BOOKS = [
  {
    method: 'Noisy-OR combination',
    implementedIn: 'app/src/engine/math.js — combineSigned()',
    role: 'Origin of the noisy-OR gate: combining independent causes of an effect without letting the combination exceed its bound.',
    query: 'Probabilistic Reasoning in Intelligent Systems Judea Pearl',
    expect: 'probabilistic reasoning in intelligent systems',
    expectAuthor: 'pearl',
  },
  {
    method: 'Herfindahl–Hirschman concentration index',
    implementedIn: 'app/src/engine/math.js — hhiWithResidual()',
    role: 'Where the concentration index originates. Hirschman introduced it here; Herfindahl arrived at it independently in 1950, and the joint name is later usage.',
    query: 'National Power and the Structure of Foreign Trade Hirschman',
    expect: 'national power and the structure of foreign trade',
    expectAuthor: 'hirschman',
  },
];

const DOCUMENTS = [
  {
    method: 'Herfindahl–Hirschman concentration index',
    implementedIn: 'app/src/engine/index.js — concentration screening thresholds',
    role: 'The concentration thresholds the screening rules are set against. Cited for the thresholds only: this model measures share of a modeled sample, not a legally defined market.',
    author: 'U.S. Department of Justice and Federal Trade Commission',
    title: 'Merger Guidelines',
    standalone: true,
    date: '2023',
    url: 'https://www.ftc.gov/system/files/ftc_gov/pdf/2023_merger_guidelines_final_12.18.2023.pdf',
    /* Identity check only. The document is a compressed PDF, so its body text
       is not searchable over HTTP; what this confirms is that the URL resolves
       at the issuing agency's own domain and the document identifies itself as
       the Merger Guidelines. That is weaker than the Crossref checks and is
       recorded as such rather than presented as equivalent. */
    expectInPage: 'merger guidelines',
    verificationNote: 'Document identity confirmed at the issuing agency; PDF body text not parsed.',
  },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* Two formatting conventions Chicago requires, applied to catalogue records.

   These change presentation, not content. Open Library stores titles in
   sentence case and names in direct order; Chicago bibliographies use headline
   capitalisation and inverted names. Normalising is editing what was verified,
   which is allowed. ADDING a subtitle the catalogue does not carry would not
   be, so nothing here supplies missing words — only recases the ones found. */
const MINOR = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'as', 'from', 'with', 'into', 'over']);
const headlineCase = (s) => String(s || '').split(/(\s+|:\s*)/).map((tok, i, arr) => {
  if (/^\s+$/.test(tok) || /^:/.test(tok)) return tok;
  const words = arr.filter((t) => !/^\s+$/.test(t) && !/^:/.test(t));
  const isEdge = tok === words[0] || tok === words[words.length - 1];
  const lower = tok.toLowerCase();
  if (!isEdge && MINOR.has(lower)) return lower;
  return tok.charAt(0).toUpperCase() + tok.slice(1);
}).join('');

/* "Judea Pearl" -> "Pearl, Judea." Only the last whitespace-separated token is
   treated as the family name, which is the common case and wrong for some
   names; where it would be wrong the catalogue value is left alone. */
const invertName = (s) => {
  const t = String(s || '').trim().split(/\s+/);
  return t.length < 2 ? s : `${t[t.length - 1]}, ${t.slice(0, -1).join(' ')}`;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Crossref throttles anonymous traffic hard, and a 429 is indistinguishable
   from "this work does not exist" at the call site — which would quietly turn
   a rate limit into a bibliography with holes in it. So: identify to the
   polite pool with a mailto, pace the requests, and back off and retry rather
   than recording a failure. */
async function crossref(query, { container, type } = {}, attempt = 0) {
  const p = new URLSearchParams({
    rows: '8',
    'query.bibliographic': query,
    select: 'DOI,title,author,container-title,issued,volume,issue,page,type,publisher,ISBN',
    mailto: 'alansong0318@gmail.com',
  });
  /* Scoping the search to the journal finds records that a free-text query
     buries — the Econometrica version of a paper that also exists as three
     working papers, for instance. Filtering by type does the same for books,
     which otherwise lose to journal articles reviewing them. */
  if (container) p.set('query.container-title', container);
  if (type) p.set('filter', `type:${type}`);
  const res = await fetch(`${API}?${p}`, { headers: UA });
  if (res.status === 429 && attempt < 4) {
    await sleep(2000 * (attempt + 1));
    return crossref(query, { container, type }, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  await sleep(1200);
  return j.message?.items || [];
}

/* Chicago wants "Last, First, and First Last" — Crossref gives structured
   names, so the inversion is mechanical rather than guessed. */
function authors(list) {
  const people = (list || []).filter((a) => a.family);
  if (!people.length) return null;
  const fmt = (a, invert) => (invert
    ? `${a.family}, ${a.given || ''}`.trim().replace(/,$/, '')
    : `${a.given || ''} ${a.family}`.trim());
  if (people.length === 1) return fmt(people[0], true);
  if (people.length <= 3) {
    return `${fmt(people[0], true)}, ${people.slice(1, -1).map((a) => fmt(a, false)).concat(`and ${fmt(people[people.length - 1], false)}`).join(', ')}`;
  }
  return `${fmt(people[0], true)}, et al.`;
}

const results = [];
const rejected = [];

for (const m of METHODS) {
  let items = [];
  try { items = await crossref(m.query, { container: m.queryContainer, type: m.filterType }); } catch (err) {
    rejected.push({ ...m, why: `lookup failed: ${err.message}` });
    continue;
  }
  /* Acceptance is a test, not a ranking — the top Crossref hit is irrelevant
     unless it is actually the work that was asked for. Three ways a title
     match alone gets it wrong, all of which happened on the first run:

       - a REVIEW of the book, whose title contains the book's title;
       - an ERRATUM, whose title contains the original paper's title;
       - a PREPRINT, when a journal version of record exists.

     So the journal is checked as well as the title, and secondary records are
     excluded outright. A preprint DOI for a paper that ran in Econometrica is
     not wrong, exactly, but it cites the wrong artefact. */
  const SECONDARY = /^\s*(erratum|corrigendum|correction|comment on|review of|book review)\b|^\s*erratum:/i;
  const hit = items.find((it) => {
    const title = (it.title || [])[0] || '';
    if (SECONDARY.test(title)) return false;
    if (!norm(title).includes(norm(m.expect))) return false;
    if (m.expectContainer) {
      const container = (it['container-title'] || [])[0] || '';
      if (!norm(container).includes(norm(m.expectContainer))) return false;
    }
    return true;
  });
  if (!hit) {
    rejected.push({
      ...m,
      why: m.expectContainer ? `no record matched title in ${m.expectContainer}` : 'no returned title matched',
      saw: items.slice(0, 3).map((i) => `${(i.title || [])[0]} [${(i['container-title'] || [])[0] || i.publisher || '?'}]`),
    });
    continue;
  }
  results.push({
    method: m.method,
    implementedIn: m.implementedIn,
    role: m.role,
    doi: hit.DOI,
    title: (hit.title || [])[0],
    author: authors(hit.author),
    container: (hit['container-title'] || [])[0] || null,
    publisher: hit.publisher || null,
    volume: hit.volume || null,
    issue: hit.issue || null,
    pages: hit.page || null,
    year: (hit.issued?.['date-parts'] || [[]])[0][0] || null,
    type: hit.type || null,
    isbn: (hit.ISBN || [])[0] || null,
    verifiedAgainst: 'Crossref',
    resolvedAt: new Date().toISOString().slice(0, 10),
  });
}

/* --- books, verified against Open Library -------------------------------- */
for (const b of BOOKS) {
  try {
    const p = new URLSearchParams({ limit: '5', fields: 'title,author_name,first_publish_year,publisher,key', q: b.query });
    const j = await (await fetch(`https://openlibrary.org/search.json?${p}`, { headers: UA })).json();
    const hit = (j.docs || []).find((d) => norm(d.title).includes(norm(b.expect))
      && (d.author_name || []).some((a) => norm(a).includes(norm(b.expectAuthor))));
    if (!hit) { rejected.push({ ...b, why: 'no Open Library record matched' }); continue; }
    results.push({
      method: b.method,
      implementedIn: b.implementedIn,
      role: b.role,
      title: headlineCase(hit.title),
      author: invertName((hit.author_name || [])[0]) || null,
      publisher: (hit.publisher || [])[0] || null,
      year: hit.first_publish_year || null,
      type: 'book',
      standalone: true,
      url: hit.key ? `https://openlibrary.org${hit.key}` : null,
      verifiedAgainst: 'Open Library',
      resolvedAt: new Date().toISOString().slice(0, 10),
    });
    await sleep(600);
  } catch (err) {
    rejected.push({ ...b, why: `Open Library lookup failed: ${err.message}` });
  }
}

/* --- government documents, verified against the issuing body's own page --- */
for (const d of DOCUMENTS) {
  try {
    const res = await fetch(d.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; sscim-citation-resolver)' } });
    const body = res.ok ? await res.text() : '';
    /* The page must actually be about the thing being cited. A 200 alone
       proves a URL resolves, not that it holds the document. */
    if (!res.ok || !norm(body).includes(norm(d.expectInPage))) {
      rejected.push({ ...d, why: res.ok ? `page does not mention "${d.expectInPage}"` : `HTTP ${res.status}` });
      continue;
    }
    results.push({
      method: d.method,
      implementedIn: d.implementedIn,
      role: d.role,
      title: d.title,
      author: d.author,
      year: d.date,
      url: d.url,
      type: 'report',
      standalone: true,
      verifiedAgainst: 'Publisher website',
      verificationNote: d.verificationNote || null,
      resolvedAt: new Date().toISOString().slice(0, 10),
    });
  } catch (err) {
    rejected.push({ ...d, why: `fetch failed: ${err.message}` });
  }
}

console.log(`${results.length} verified, ${rejected.length} rejected.\n`);
for (const r of results) {
  console.log(`  ${r.doi || `(${r.type}, verified against ${r.verifiedAgainst})`}`);
  console.log(`    ${r.author || '(no author)'} — ${r.title}`);
  console.log(`    ${r.container || r.publisher || ''} ${r.year || ''}  [${r.method}]`);
}
if (rejected.length) {
  console.log('\n--- rejected (left uncited rather than guessed) ---');
  for (const r of rejected) {
    console.log(`  ${r.method}: ${r.why}`);
    console.log(`    asked for: ${r.expect}`);
    if (r.saw) r.saw.forEach((s) => console.log(`    saw:       ${s}`));
  }
}

if (PROPOSE) {
  console.log('\n(nothing written)');
} else {
  writeFileSync(OUT, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${OUT}`);
}
