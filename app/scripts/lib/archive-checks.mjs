/* ====================================================================
   archive-checks.mjs — the rules that keep the model archive honest.

   These are separated from verify-docs.mjs for one reason: a check that
   has never been seen to FAIL is not known to work. Every rule here runs
   against deliberately broken fixtures in
   src/docs/archiveChecks.test.js, so each one is proven to fire.

   Each rule takes a plain description of the repository — documents,
   benchmark metadata, the current model version — and returns failure
   strings. Nothing here touches the filesystem, so a test can construct
   a stale repository without creating one.
   ==================================================================== */

export const ARCHIVE_PREFIX = 'docs/archive/';
export const ARCHIVE_BANNER = 'HISTORICAL DOCUMENT';
export const REGISTRY = 'docs/MODEL_ARCHIVE.md';
export const CURRENT_VALIDATION_MD = 'docs/computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md';
export const CURRENT_VALIDATION_JSON = 'docs/computation-demo/validation/validation-results.json';

const isArchive = (path) => path.startsWith(ARCHIVE_PREFIX);
const lines = (content) => content.split(/\r?\n/);

/* A model identifier anywhere in the corpus. */
const MODEL_ID = /sscim-model-v[0-9.]+[-a-z]*/gi;

/* A sentence that asserts what the model IS NOW, as opposed to one that
   records what it used to be. These are the phrasings an archive banner
   actually uses to point a reader forward. */
const CURRENT_POINTER = /\b(the current model is|current model:|currently|superseded by|replaced by|canonical specification is)\b/i;

/* Explicit, written acknowledgement that a date pair is out of order.
   A document may carry an impossible-looking date, but only if it says so. */
const DATE_EXCEPTION = /\b(unresolved|metadata error|not chronologically possible|known .{0,20}error|provenance of the dates)\b/i;

/* ------------------------------------------------------------------ 1 */
/* Every archived markdown file carries the historical banner. */
export function checkArchiveBanners(docs) {
  const out = [];
  for (const doc of docs) {
    if (!isArchive(doc.path)) continue;
    if (!doc.content.includes(ARCHIVE_BANNER)) {
      out.push(`${doc.path}: is in ${ARCHIVE_PREFIX} but does not carry the "${ARCHIVE_BANNER}" banner`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ 2 */
/* An archive banner that points a reader at the current model must name
   the ACTUAL current model. This is the check the three v6 banners
   failed for an entire release while still saying v7.0. */
export function checkArchivePointsAtCurrent(docs, modelVersion) {
  const out = [];
  for (const doc of docs) {
    if (!isArchive(doc.path)) continue;
    lines(doc.content).forEach((line, i) => {
      if (!CURRENT_POINTER.test(line)) return;
      const ids = line.match(MODEL_ID);
      if (!ids) return;
      /* "superseded by X" and "the current model is X" both name a
         FORWARD pointer, so every id on such a line must be current. */
      for (const id of ids) {
        if (id.toLowerCase() === modelVersion.toLowerCase()) continue;
        out.push(`${doc.path}: line ${i + 1}: archive banner points forward to "${id}", but the current model is "${modelVersion}" — "${line.trim().slice(0, 110)}"`);
      }
    });
  }
  return out;
}

/* ------------------------------------------------------------------ 3 */
/* No document may describe a superseded model as the current one. Inside
   an archive the model's own identifier is expected and correct; what is
   forbidden is presenting it as what the code does NOW. */
export function checkNoArchivedModelAsCurrent(docs, modelVersion) {
  const out = [];
  const CLAIMS_CURRENT = /\b(the current model is|is the current model|currently runs|the model in use is)\b/i;
  for (const doc of docs) {
    lines(doc.content).forEach((line, i) => {
      if (!CLAIMS_CURRENT.test(line)) return;
      const ids = line.match(MODEL_ID) || [];
      for (const id of ids) {
        if (id.toLowerCase() === modelVersion.toLowerCase()) continue;
        out.push(`${doc.path}: line ${i + 1}: describes superseded model "${id}" as current`);
      }
    });
  }
  return out;
}

/* ------------------------------------------------------------------ 4 */
/* Every frozen benchmark needs a readable definition of the numbers in
   it. A frozen result with no specification behind it is not a record of
   anything — which is the whole reason the archive exists. */
export function checkFrozenBenchmarksHaveSpecs(benchmarks, docs) {
  const out = [];
  for (const b of benchmarks) {
    if (!b.modelVersion) { out.push(`${b.path}: frozen benchmark declares no modelVersion`); continue; }
    const defining = docs.find((d) => d.content.includes(b.modelVersion)
      && (isArchive(d.path) || d.path === 'docs/MODEL_V7_SPEC.md')
      && /specification|calculation/i.test(d.path + d.content.slice(0, 400)));
    if (!defining) {
      out.push(`${b.path}: frozen benchmark for "${b.modelVersion}" has no specification, archived or canonical, that defines it`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ 5 */
/* The current validation page and the machine-readable results beside it
   must agree. They did not: the page said v7.1 while the JSON said
   v7.0 and a dataset six days older. Prose and data disagreeing about
   which model produced a number is exactly the defect worth failing on. */
export function checkValidationConsistency({ markdown, results, modelVersion, datasetAsOf }) {
  const out = [];
  if (!markdown) return [`${CURRENT_VALIDATION_MD}: missing`];
  if (!results) return [`${CURRENT_VALIDATION_JSON}: missing`];

  if (results.modelVersion !== modelVersion) {
    out.push(`${CURRENT_VALIDATION_JSON}: modelVersion "${results.modelVersion}" is not the current "${modelVersion}" — recompute it (npm run recovery) or archive it; never relabel it`);
  }
  if (datasetAsOf && results.datasetAsOf !== datasetAsOf) {
    out.push(`${CURRENT_VALIDATION_JSON}: datasetAsOf "${results.datasetAsOf}" is not the current snapshot "${datasetAsOf}"`);
  }
  const ids = markdown.match(MODEL_ID) || [];
  for (const id of new Set(ids.map((s) => s.toLowerCase()))) {
    if (id !== modelVersion.toLowerCase()) {
      out.push(`${CURRENT_VALIDATION_MD}: names model "${id}"; the current validation page must describe "${modelVersion}" only — superseded runs belong under ${ARCHIVE_PREFIX}`);
    }
  }
  if (!markdown.includes(results.modelVersion)) {
    out.push(`${CURRENT_VALIDATION_MD}: does not state the model version its own results file reports ("${results.modelVersion}")`);
  }
  if (results.datasetAsOf && !markdown.includes(results.datasetAsOf)) {
    out.push(`${CURRENT_VALIDATION_MD}: does not state the dataset date its own results file reports ("${results.datasetAsOf}")`);
  }
  return out;
}

/* ------------------------------------------------------------------ 6 */
/* Superseded validation output lives under its own archive, never beside
   the current set where a reader would take it for current. */
export function checkSupersededValidationArchived(artifacts, modelVersion) {
  const out = [];
  for (const a of artifacts) {
    if (!a.modelVersion || a.modelVersion === modelVersion) continue;
    if (!isArchive(a.path)) {
      out.push(`${a.path}: holds superseded model "${a.modelVersion}" but does not live under ${ARCHIVE_PREFIX}`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ 7 */
/* Frozen artefacts must not be regenerable. The documentation generator
   refuses to enter docs/archive/; this asserts that it still does, and
   that the archived generated blocks still hold their historical values
   rather than the current ones. */
export function checkFrozenNotRegenerated({ generatorSource, docs, modelVersion }) {
  const out = [];
  if (!/ARCHIVE_PREFIX|docs\/archive\//.test(generatorSource || '')) {
    out.push('scripts/build-doc-generated.mjs: no longer skips docs/archive/ — running it would overwrite frozen specifications with current values');
  }
  for (const doc of docs) {
    if (!isArchive(doc.path)) continue;
    if (!doc.content.includes('<!-- BEGIN GENERATED:')) continue;
    const block = doc.content.match(/<!-- BEGIN GENERATED: model-version -->\s*`([^`]+)`/);
    if (block && block[1] === modelVersion) {
      out.push(`${doc.path}: its frozen model-version block reads "${modelVersion}" — the archive has been regenerated against the current engine and no longer records the model it belongs to`);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ 8 */
/* A generation date cannot precede the dataset it consumed. Where one
   does, the document must say so in writing rather than leave a reader
   to notice. */
export function checkProvenanceChronology(docs) {
  const out = [];
  const GENERATED = /\*\*Generated:\*\*\s*(\d{4}-\d{2}-\d{2})/;
  const DATASET = /dataset as[- ]of\s*\**\s*(\d{4}-\d{2}-\d{2})/i;
  for (const doc of docs) {
    const g = doc.content.match(GENERATED);
    const d = doc.content.match(DATASET);
    if (!g || !d) continue;
    if (g[1] >= d[1]) continue;
    if (DATE_EXCEPTION.test(doc.content)) continue;
    out.push(`${doc.path}: generated ${g[1]} but claims dataset as-of ${d[1]} — a generation date before its own dataset needs an explicit written exception`);
  }
  return out;
}

/* ------------------------------------------------------------------ 9 */
/* Every path the registry names must exist. A release table that points
   at a moved file is worse than no table. */
export function checkRegistryPaths(registryContent, exists) {
  const out = [];
  if (!registryContent) return [`${REGISTRY}: missing`];
  const LINK = /\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g;
  const seen = new Set();
  let m;
  while ((m = LINK.exec(registryContent))) {
    const target = m[1];
    if (/^(https?:|mailto:)/.test(target)) continue;
    if (seen.has(target)) continue;
    seen.add(target);
    const full = `docs/${target}`.replace(/\/\.\//g, '/');
    if (!exists(full)) out.push(`${REGISTRY}: links to "${target}", which does not exist`);
  }
  return out;
}

/* ----------------------------------------------------------------- 10 */
/* The registry must carry a row for every model whose artefacts are in
   the repository, and must mark exactly one as current. */
export function checkRegistryCoverage(registryContent, modelVersions, modelVersion) {
  const out = [];
  if (!registryContent) return [`${REGISTRY}: missing`];
  for (const v of modelVersions) {
    if (!registryContent.includes(v)) out.push(`${REGISTRY}: no row for model "${v}", whose artefacts are in the repository`);
  }
  if (!registryContent.includes(modelVersion)) out.push(`${REGISTRY}: does not name the current model "${modelVersion}"`);
  /* Table rows only. A sentence explaining what the marker means is
     not itself a marked release. */
  const currents = lines(registryContent)
    .filter((l) => l.trimStart().startsWith('|'))
    .reduce((n, l) => n + (l.match(/\*\*current\*\*/gi) || []).length, 0);
  if (currents !== 1) out.push(`${REGISTRY}: marks ${currents} releases as current; exactly one row must be current`);
  return out;
}

/* ------------------------------------------------------------------ */
/* v6-only formulas stay permitted inside clearly marked v6 payloads.
   This is the inverse of a failure: it asserts the archive is EXEMPT, so
   that tightening the rules above never starts flagging the historical
   record it exists to preserve. */
export function archiveIsExemptFromV6Rules(path) {
  return isArchive(path);
}

export const ARCHIVE_RULES = [
  'archive markdown carries a historical banner',
  'archive banners point at the actual current model',
  'no document describes a superseded model as current',
  'every frozen benchmark has a defining specification',
  'current validation prose and data agree',
  'superseded validation artefacts live under an archive',
  'frozen artefacts are not regenerated',
  'archive provenance dates are chronological or excepted',
  'every path in the model archive exists',
  'the model archive covers every model present, with exactly one current',
];
