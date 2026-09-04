/* ====================================================================
   verify-docs.mjs — CODE ↔ DOCUMENTATION PARITY.

   Documentation in this repository is a first-class deliverable, so it is
   checked like code. This command fails, with a non-zero exit, when:

     1. a generated block (parameter table, model version, worked example…)
        does not match what the registry and the engine produce;
     2. a current-facing document carries a stale model version;
     3. a current-facing document presents a v6 formula or v6 concept as
        active, outside the clearly marked historical archive;
     4. an unsupported term — "probability", "capacity share", "confidence
        interval", "validated" — appears without the required
        qualification;
     5. a required parameter definition is missing from the canonical
        specification;
     6. a model-facing document neither states the model version nor links
        to the canonical specification;
     7. a reported test count, snapshot date, screenshot or evidence report
        is stale.

   Run:  npm run docs:verify
   ==================================================================== */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { findMarkdownDocs } from './lib/find-markdown.mjs';
import { MODEL_VERSION, PARAMETERS, MODEL_FORMS, STRUCTURAL_COMPONENTS } from '../src/engine/registry.js';
import { PROFILE_IDS } from '../src/engine/persistence.js';

import {
  checkArchiveBanners, checkArchivePointsAtCurrent, checkNoArchivedModelAsCurrent,
  checkFrozenBenchmarksHaveSpecs, checkValidationConsistency, checkSupersededValidationArchived,
  checkFrozenNotRegenerated, checkProvenanceChronology, checkRegistryPaths, checkRegistryCoverage,
  ARCHIVE_RULES, REGISTRY, CURRENT_VALIDATION_MD, CURRENT_VALIDATION_JSON,
} from './lib/archive-checks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const appDir = resolve(here, '..');

const failures = [];
const notes = [];
const fail = (doc, message) => failures.push(`${doc}: ${message}`);

const SPEC = 'docs/MODEL_V7_SPEC.md';

/* Documents that are HISTORICAL by construction. They must carry the
   banner, and inside them v6 formulas are correct and expected. */
const ARCHIVE_PREFIX = 'docs/archive/';
const ARCHIVE_BANNER = 'HISTORICAL DOCUMENT';

/* Documents that explain the MODEL (as opposed to the build, the data
   pipeline, or the site). Each must name the current model version or link
   to the canonical specification. */
const MODEL_FACING = [
  'docs/MODEL_V7_SPEC.md',
  'docs/METHODOLOGY.md',
  'docs/calculation.md',
  'docs/ACADEMIC_GUIDE.md',
  'docs/PUBLIC_GUIDE.md',
  'docs/MODEL_ROADMAP.md',
  'docs/reference/ALGORITHM-AND-PRIORS.md',
  'docs/reference/EVENTS.md',
  'docs/reference/SUPPLY-CHAIN-STRUCTURE.md',
  'docs/reference/EVIDENCE-COVERAGE.md',
  'docs/reference/FACILITIES.md',
  'docs/reference/README.md',
  'docs/computation-demo/COMPUTATION_DEMO.md',
  'docs/computation-demo/PLAIN_ENGLISH_GUIDE.md',
  'docs/computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md',
];

/* ---------------- 1. generated blocks ---------------- */
try {
  execFileSync(process.execPath, [resolve(appDir, 'scripts', 'build-doc-generated.mjs'), '--check'], { stdio: 'pipe', cwd: appDir });
  notes.push('generated documentation blocks match the registry and the engine');
} catch (e) {
  const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
  failures.push(`generated blocks are stale:\n${out}`);
}

const docs = await findMarkdownDocs();
const byPath = Object.fromEntries(docs.map((d) => [d.path, d]));

/* USER-VISIBLE SOURCE. A stale model description is exactly as wrong in a
   tooltip or an intro paragraph as it is in a document, and the markdown
   scan never looked at either. These files carry prose that ships to a
   reader, so they are scanned for the same v6-only claims. */
const UI_TEXT_FILES = [
  'app/src/intro/i18n.js',
  'app/src/landing/Landing.jsx',
  'app/src/intro/Intro.jsx',
  'app/src/components/briefingText.js',
  'app/src/data/releases.js',
  'app/src/data/compMeta.js',
  'app/src/data/glossary.js',
  /* ADDED AFTER A MISS. Detail.jsx printed the v6 universal 12-day
     half-life as "the engine's" formula, beside a v7 number that
     contradicted it, through the whole of the v7.1 documentation pass —
     because this list did not include the file. A scan is only as wide as
     its file list, so the panels that explain a score to a reader are on
     it now. */
  'app/src/components/Detail.jsx',
  'app/src/components/FacilityConnectionDetail.jsx',
  'app/src/components/CentreDetail.jsx',
];
const uiTexts = UI_TEXT_FILES
  .map((rel) => ({ path: rel, full: resolve(repoRoot, rel) }))
  .filter((f) => existsSync(f.full))
  .map((f) => ({ path: f.path, content: readFileSync(f.full, 'utf8') }));

/* ---------------- helpers ---------------- */
const stripCode = (text) => text
  .replace(/```[\s\S]*?```/g, '\n')
  .replace(/`[^`\n]*`/g, ' ');

/* Split into "claims" — one line each, keeping the line number, the
   enclosing heading, and the two preceding non-empty lines, and skipping
   fenced/inline code where a term is a symbol rather than a claim.

   THE CONTEXT WINDOW MATTERS. A qualification frequently sits one line
   above the term it qualifies — a "these are not those" table header, or a
   sentence that wrapped — and a strictly line-at-a-time check reports those
   as unqualified while catching nothing real. */
function claims(content) {
  const out = [];
  let inFence = false;
  let heading = '';
  const recent = [];
  content.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) heading = h[1];
    const bare = stripCode(line);
    out.push({ n: i + 1, text: line, bare, heading, context: `${heading}\n${recent.join('\n')}\n${bare}` });
    if (line.trim()) { recent.push(bare); if (recent.length > 2) recent.shift(); }
  });
  return out;
}

/* A heading under which v6 names are the SUBJECT rather than the active
   description: change logs, rename tables, historical appendices. */
const HISTORICAL_HEADING = /\bv6\b|v7\.0|historical|archive|renamed|change log|superseded|previous version|legacy|migration/i;
const HISTORICAL_LINE_V = /\b(v6|v7\.0|frozen|historical|archived|superseded|previous|former|preserved|comparison|no longer)\b/i;

/* Proper nouns that happen to contain a flagged word. "Validated End-User
   Authorization" is the legal name of a BIS licence programme; the word
   there is not a claim about this model. */
const PROPER_NOUNS = [/Validated End[- ]User/i];

const isArchive = (path) => path.startsWith(ARCHIVE_PREFIX);

/* ---------------- 2. stale model version ---------------- */
const V6_VERSION = /sscim-model-v6[-a-z]*/gi;
for (const doc of docs) {
  if (isArchive(doc.path)) continue;
  for (const c of claims(doc.content)) {
    const hits = c.text.match(V6_VERSION);
    if (!hits) continue;
    // A v6 version string is allowed when the same line marks it as historical.
    if (/\b(v6|historical|archived|frozen|superseded|previous|former|no longer|preserved)\b/i.test(c.text)) continue;
    fail(doc.path, `line ${c.n}: names a v6 model version without marking it historical — "${c.text.trim().slice(0, 120)}"`);
  }
}

/* A SUPERSEDED v7.x version string presented as the current one. The v6
   check below catches the previous major line; this catches the previous
   MINOR, which is the easier one to leave behind after a point release. */
const SUPERSEDED_VERSIONS = ['sscim-model-v7-exposure-robustness'].filter((v) => v !== MODEL_VERSION);
for (const doc of docs) {
  if (isArchive(doc.path)) continue;
  for (const c of claims(doc.content)) {
    for (const v of SUPERSEDED_VERSIONS) {
      if (!c.text.includes(v)) continue;
      if (HISTORICAL_LINE_V.test(c.text) || HISTORICAL_HEADING.test(c.heading)) continue;
      fail(doc.path, `line ${c.n}: names superseded model version "${v}" without marking it historical (current is "${MODEL_VERSION}")`);
    }
  }
}

/* ---------------- 3. v6 formulas presented as active ---------------- */
const V6_CONCEPTS = [
  { re: /\bcontributionTolerance\b/i, why: 'contributionTolerance was removed in v7 — propagation is exact on a finite DAG' },
  { re: /\bspecificityFloor\b/, why: 'renamed to minimumDependencyFactor in v7' },
  { re: /\bhalfLifeDays\b(?!\s*(?:→|->))/, why: 'v7 has acuteHalfLifeDays / marketHalfLifeDays / outageRecoveryDays, not one global halfLifeDays' },
  { re: /\bdirectSignals\b/, why: 'country directSignals was removed in v7 — it double-counted an incident' },
  { re: /\bhhiWithResidual\b/, why: 'replaced by hhiBounds(), which publishes an interval' },
  { re: /\bpropagateFromSource\b/, why: 'replaced by propagateSignedVector() — v7 propagates the whole incident vector jointly' },
  { re: /\bbuildDependenceMatrices\b/, why: 'renamed buildDependencyMatrices() and re-derived with normalized edge allocations' },
  { re: /\bcombinePositive\b|\bcombineSigned\b/, why: 'replaced by aggregation.js — and it is a bounded aggregation operator, not a probabilistic combination' },
  { re: /\bshock\s*:\s*0\.10\b|componentWeights/, why: 'the v6 componentWeights vector (including the never-read shock term) was replaced by the registry structural weights' },
  { re: /\bMIN_STAGE_EXPOSURE\b/, why: 'renamed DISPLAY_EXPOSURE_THRESHOLD in v7 — it no longer gates any modelled quantity' },
];
for (const doc of docs) {
  if (isArchive(doc.path)) continue;
  for (const c of claims(doc.content)) {
    for (const concept of V6_CONCEPTS) {
      if (!concept.re.test(c.text)) continue;
      // Allowed when the line explicitly marks it as removed/renamed history.
      if (/\b(v6|removed|renamed|replaced|historical|archived|no longer|superseded|was\b|formerly|deleted|gone)\b/i.test(c.text)) continue;
      if (HISTORICAL_HEADING.test(c.heading)) continue;
      fail(doc.path, `line ${c.n}: presents a v6 concept as active (${concept.why}) — "${c.text.trim().slice(0, 120)}"`);
    }
  }
}

/* ---------------- 3b. v6-only DESCRIPTIONS of active behaviour ----------------
   Section 3 above catches v6 IDENTIFIERS (function and parameter names).
   This catches v6 BEHAVIOURAL CLAIMS, which survive perfectly well in prose
   that never mentions a symbol — "halves every 12 days", "stops below
   0.01%", "combines through a noisy-OR". Each is allowed only where the
   line marks it as historical, or under a historical heading. */
const V6_DESCRIPTIONS = [
  { re: /\b12[- ]day half[- ]life\b|halv(?:es|ing)\s+(?:roughly\s+)?every\s+12\s+days/i,
    why: 'v7 has per-incident persistence profiles, not one universal 12-day half-life' },
  { re: /\bnoisy[- ]OR\b/i,
    why: 'v7 combines DISTINCT incidents with a bounded saturating operator, and never applies an independence correction within one incident' },
  { re: /\bindependent events\b/i,
    why: 'v7 deduplicates records into incidents; independence is not assumed between them' },
  { re: /0\.01\s*%|\btoo diluted to (?:matter|bother)\b/i,
    why: 'v7 applies no substantive propagation cutoff — contributionTolerance is gone' },
  { re: /log[- ]compressed (?:economic )?weight|log1p[- ]normalized weight|logarithmic(?:ally)? weighted headline/i,
    why: 'v7 weights the headline index by raw normalized turnover, not on a logarithmic scale' },
  { re: /\bonly six events\b|\bsix events\b/i,
    why: 'the snapshot carries 167 records grouped into 160 incidents, not six' },
  { re: /duplicates?\s+(?:necessarily\s+)?inflates?\b|inflates the (?:index|reading) materially/i,
    why: 'v7 groups records into incidents before scoring, so duplicate coverage does not inflate the index' },
  { re: /cannot manufacture exposure|propagation is a contraction/i,
    why: 'the bound is per stage; the propagated signal branches and the network-wide sum can exceed the source' },
  { re: /archived .{0,40}cannot materially affect|immaterial to (?:all|every) published number/i,
    why: 'legacy fallback incidents can materially affect historical peaks; only the current snapshot is barely moved' },
];
const HISTORICAL_LINE = /\b(v6|v7\.0|historical|archived|no longer|superseded|previously|used to|was\b|formerly|replaced|removed|instead of|rather than|not\b|never\b)\b/i;

/* A bibliography entry naming a technique is not a claim that the model
   still behaves that way. The source register cites Pearl's noisy-OR for
   the FUNCTIONAL FORM the bounded operator borrows, which is exactly the
   distinction the register exists to draw. */
const CITATION_CONTEXT = /functional form|why cited|verified against|https?:\/\/|doi\.org|\b(19|20)\d{2}\)|borrow/i;

const scanV6Descriptions = (path, content) => {
  for (const c of claims(content)) {
    for (const d of V6_DESCRIPTIONS) {
      if (!d.re.test(c.bare)) continue;
      // The qualifier may sit on the heading or the line above, exactly as
      // for the unsupported-term check — a wrapped sentence is still one
      // sentence.
      if (HISTORICAL_LINE.test(c.context)) continue;
      if (HISTORICAL_HEADING.test(c.heading)) continue;
      if (CITATION_CONTEXT.test(c.context)) continue;
      fail(path, `line ${c.n}: describes v6 behaviour as active (${d.why}) — "${c.text.trim().slice(0, 120)}"`);
    }
  }
};
for (const doc of docs) { if (!isArchive(doc.path)) scanV6Descriptions(doc.path, doc.content); }
for (const ui of uiTexts) scanV6Descriptions(ui.path, ui.content);

/* ---------------- 4. unsupported terms without qualification ----------------
   These four words are the ones a reader most reliably over-reads. Each may
   appear only in a sentence that is explicitly denying or qualifying it. */
const QUALIFIER = /\b(not|never|non|no|nothing|neither|nor|rather than|instead of|is not|are not|must not|cannot|isn't|aren't|without|avoid|misread|mistaken|would be|does not|do not|NOT)\b/i;
const UNSUPPORTED = [
  { re: /\bprobabilit(?:y|ies|ic)\b/i, term: 'probability' },
  { re: /\bcapacity share\b/i, term: 'capacity share' },
  { re: /\bconfidence interval(?:s)?\b/i, term: 'confidence interval' },
  { re: /\bvalidated\b/i, term: 'validated' },
];
for (const doc of docs) {
  if (isArchive(doc.path)) continue;
  for (const c of claims(doc.content)) {
    for (const u of UNSUPPORTED) {
      if (!u.re.test(c.bare)) continue;
      if (PROPER_NOUNS.some((re) => re.test(c.bare))) continue;
      if (QUALIFIER.test(c.context)) continue;
      fail(doc.path, `line ${c.n}: uses "${u.term}" without the required qualification — "${c.text.trim().slice(0, 140)}"`);
    }
  }
}

/* ---------------- 5. required definitions in the specification ---------------- */
const spec = byPath[SPEC];
if (!spec) {
  failures.push(`${SPEC} is missing — it is the canonical specification`);
} else {
  const required = [
    ...Object.keys(PARAMETERS),
    ...Object.keys(MODEL_FORMS),
    ...STRUCTURAL_COMPONENTS.map((k) => k),
    ...PROFILE_IDS,
  ];
  for (const name of required) {
    if (!spec.content.includes(name)) fail(SPEC, `required definition "${name}" is missing from the canonical specification`);
  }
  for (const heading of ['Model purpose and boundary', 'Complete notation', 'Exact executable formulas',
    'Order of operations', 'Parameter register', 'Fallback and missing-data rules',
    'Worked numerical example', 'Sensitivity and robustness', 'Validation status',
    'v6 → v7 change log', 'Limitations and calibration roadmap']) {
    if (!spec.content.includes(heading)) fail(SPEC, `required section "${heading}" is missing`);
  }
  if (!spec.content.includes(MODEL_VERSION)) fail(SPEC, 'does not state the current model version');
}

/* ---------------- 6. model-facing documents point at the specification ---------------- */
for (const path of MODEL_FACING) {
  const doc = byPath[path];
  if (!doc) { failures.push(`${path}: listed as model-facing but does not exist`); continue; }
  const linksToSpec = doc.content.includes('MODEL_V7_SPEC');
  const statesVersion = doc.content.includes(MODEL_VERSION);
  if (!linksToSpec && !statesVersion) {
    fail(path, 'is model-facing but neither states the current model version nor links to docs/MODEL_V7_SPEC.md');
  }
}

/* ---------------- 7. the model archive ---------------- */
/* Ten rules, each of which is proven to fire against a deliberately
   stale fixture in src/docs/archiveChecks.test.js. They live in
   scripts/lib/archive-checks.mjs so that the test can construct a broken
   repository without creating one on disk. */
{
  const archiveSnapshot = JSON.parse(readFileSync(resolve(appDir, 'src', 'data', 'vault-snapshot.json'), 'utf8'));
  const currentDataset = archiveSnapshot.meta?.snapshotDate;
  const benchDir = resolve(repoRoot, 'docs', 'benchmarks');
  const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

  const benchmarks = readdirSync(benchDir)
    .filter((f) => f.endsWith('frozen-benchmark.json'))
    .map((f) => ({ path: `docs/benchmarks/${f}`, ...(readJson(resolve(benchDir, f)) ?? {}) }));

  /* Every validation-results.json anywhere in docs/, so that a superseded
     one left beside the current set is caught wherever it is put. */
  const validationFiles = [];
  const walkJson = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = resolve(dir, entry.name);
      const r = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walkJson(full, r);
      else if (entry.name === 'validation-results.json') validationFiles.push({ path: r, ...(readJson(full) ?? {}) });
    }
  };
  walkJson(resolve(repoRoot, 'docs'), 'docs');

  const generatorSource = readFileSync(resolve(appDir, 'scripts', 'build-doc-generated.mjs'), 'utf8');
  const validationMd = byPath[CURRENT_VALIDATION_MD]?.content ?? null;
  const validationJson = validationFiles.find((v) => v.path === CURRENT_VALIDATION_JSON) ?? null;
  const registry = byPath[REGISTRY]?.content ?? null;

  const modelsPresent = [...new Set([
    ...benchmarks.map((b) => b.modelVersion),
    ...validationFiles.map((v) => v.modelVersion),
    MODEL_VERSION,
  ].filter(Boolean))];

  const archiveFailures = [
    ...checkArchiveBanners(docs),
    ...checkArchivePointsAtCurrent(docs, MODEL_VERSION),
    ...checkNoArchivedModelAsCurrent(docs, MODEL_VERSION),
    ...checkFrozenBenchmarksHaveSpecs(benchmarks, docs),
    ...checkValidationConsistency({ markdown: validationMd, results: validationJson, modelVersion: MODEL_VERSION, datasetAsOf: currentDataset }),
    ...checkSupersededValidationArchived(validationFiles, MODEL_VERSION),
    ...checkFrozenNotRegenerated({ generatorSource, docs, modelVersion: MODEL_VERSION }),
    ...checkProvenanceChronology(docs),
    ...checkRegistryPaths(registry, (rel) => existsSync(resolve(repoRoot, rel))),
    ...checkRegistryCoverage(registry, modelsPresent, MODEL_VERSION),
  ];
  archiveFailures.forEach((f) => failures.push(f));
  if (!archiveFailures.length) {
    notes.push(`model archive: ${ARCHIVE_RULES.length} rules pass across ${modelsPresent.length} model version(s) and ${benchmarks.length} frozen benchmark(s)`);
  }
}

/* ---------------- 8. staleness: snapshot date, test count, screenshots, evidence ---------------- */
const snapshot = JSON.parse(readFileSync(resolve(appDir, 'src', 'data', 'vault-snapshot.json'), 'utf8'));
const snapshotDate = snapshot.meta?.snapshotDate;

let verification = null;
const verificationPath = resolve(repoRoot, 'docs', 'benchmarks', 'verification-run.json');
if (existsSync(verificationPath)) verification = JSON.parse(readFileSync(verificationPath, 'utf8'));

/* Any ISO date presented as THE snapshot / dataset date must be the real one. */
const SNAPSHOT_CLAIM = /(?:snapshot|dataset|data)\s*(?:date|as[- ]of|as of)\s*(?:is|:|=|of)?\s*\**\s*(\d{4}-\d{2}-\d{2})/gi;
for (const doc of docs) {
  if (isArchive(doc.path)) continue;
  let m;
  const re = new RegExp(SNAPSHOT_CLAIM.source, 'gi');
  while ((m = re.exec(doc.content)) !== null) {
    if (m[1] !== snapshotDate) {
      fail(doc.path, `states the snapshot date as ${m[1]}, but the committed snapshot is ${snapshotDate}`);
    }
  }
}

/* Any claim of a test count must match the recorded verification run. */
const TEST_COUNT = /(\d{2,5})\s+(?:unit\s+)?tests?\b/gi;
for (const doc of docs) {
  if (isArchive(doc.path)) continue;
  let m;
  const re = new RegExp(TEST_COUNT.source, 'gi');
  while ((m = re.exec(doc.content)) !== null) {
    const claimed = Number(m[1]);
    if (!verification) {
      fail(doc.path, `claims ${claimed} tests, but docs/benchmarks/verification-run.json does not exist — run npm run verify:all`);
      continue;
    }
    if (claimed !== verification.tests?.total) {
      fail(doc.path, `claims ${claimed} tests; the recorded verification run reports ${verification.tests?.total}`);
    }
  }
}

/* Every referenced screenshot and benchmark artefact must exist. */
const ASSET = /\]\(((?:\.\.\/)*(?:docs\/)?(?:screenshots|benchmarks)\/[^)\s]+)\)/g;
for (const doc of docs) {
  let m;
  const re = new RegExp(ASSET.source, 'g');
  while ((m = re.exec(doc.content)) !== null) {
    const rel = m[1].replace(/^(\.\.\/)+/, '');
    const candidates = [
      resolve(repoRoot, rel),
      resolve(repoRoot, 'docs', rel),
      resolve(repoRoot, doc.path, '..', m[1]),
    ];
    if (!candidates.some((p) => existsSync(p))) {
      fail(doc.path, `references a missing asset: ${m[1]}`);
    }
  }
}

/* The evidence-coverage report must be regenerated against the current snapshot. */
const evidence = byPath['docs/reference/EVIDENCE-COVERAGE.md'];
if (evidence && !evidence.content.includes(snapshotDate)) {
  fail('docs/reference/EVIDENCE-COVERAGE.md', `does not state the current snapshot date ${snapshotDate} — regenerate it with npm run evidence`);
}

/* ---------------- report ---------------- */
console.log(`SSCIM documentation verification — model ${MODEL_VERSION}, snapshot ${snapshotDate}`);
console.log(`  ${docs.length} markdown document(s) scanned`);
notes.forEach((n) => console.log(`  ok: ${n}`));

if (failures.length) {
  console.error(`\ndocs:verify FAILED — ${failures.length} problem(s):`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}
console.log('\ndocs:verify PASSED — documentation and code agree.');
