/* A verification rule that has never been observed to fail is not known
   to work. Every rule in scripts/lib/archive-checks.mjs is exercised here
   twice: once against a healthy repository description, where it must stay
   silent, and once against a deliberately stale one reproducing the exact
   defect it was written for, where it must fire.

   The stale fixtures are the real defects this archive pass corrected:
   v6 banners still naming v7.0 as current, and a validation page relabelled
   v7.1 on top of v7.0 numbers. */
import { describe, it, expect } from 'vitest';
import {
  checkArchiveBanners, checkArchivePointsAtCurrent, checkNoArchivedModelAsCurrent,
  checkFrozenBenchmarksHaveSpecs, checkValidationConsistency, checkSupersededValidationArchived,
  checkFrozenNotRegenerated, checkProvenanceChronology, checkRegistryPaths, checkRegistryCoverage,
  archiveIsExemptFromV6Rules, ARCHIVE_RULES,
  CURRENT_VALIDATION_MD, CURRENT_VALIDATION_JSON,
} from '../../scripts/lib/archive-checks.mjs';

const CURRENT = 'sscim-model-v7.1-exposure-robustness';
const V70 = 'sscim-model-v7-exposure-robustness';
const V6 = 'sscim-model-v6-client-sensitivity';

const doc = (path, content) => ({ path, content });

describe('archive rule 1 — every archived document carries the banner', () => {
  it('passes when the banner is present', () => {
    expect(checkArchiveBanners([
      doc('docs/archive/v6/README.md', '> HISTORICAL DOCUMENT\n\nold stuff'),
    ])).toEqual([]);
  });

  it('fires on an archived document with no banner', () => {
    const out = checkArchiveBanners([doc('docs/archive/v6/README.md', 'old stuff')]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('does not carry');
  });

  it('does not police documents outside the archive', () => {
    expect(checkArchiveBanners([doc('docs/METHODOLOGY.md', 'no banner here')])).toEqual([]);
  });
});

describe('archive rule 2 — banners point at the ACTUAL current model', () => {
  /* The real defect: three v6 banners kept saying v7.0 through the whole
     v7.1 release, and nothing failed. */
  it('fires on the exact stale banner that shipped', () => {
    const stale = doc('docs/archive/v6/README.md',
      `> HISTORICAL DOCUMENT\n\nThe current model is **v7**, \`${V70}\`. Its canonical\n`);
    const out = checkArchivePointsAtCurrent([stale], CURRENT);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(V70);
    expect(out[0]).toContain(CURRENT);
  });

  it('passes once the banner is corrected', () => {
    const fixed = doc('docs/archive/v6/README.md',
      `> HISTORICAL DOCUMENT\n\nThe current model is **v7.1**, \`${CURRENT}\`.\n`);
    expect(checkArchivePointsAtCurrent([fixed], CURRENT)).toEqual([]);
  });

  it('fires on a "superseded by" pointer naming a stale successor', () => {
    const stale = doc('docs/archive/v7.0/README.md', `> HISTORICAL DOCUMENT\n\nSuperseded by \`${V70}\`.\n`);
    expect(checkArchivePointsAtCurrent([stale], CURRENT)).toHaveLength(1);
  });

  it('allows an archive to name its OWN identifier away from a forward pointer', () => {
    const ok = doc('docs/archive/v6/README.md',
      `> HISTORICAL DOCUMENT\n\n| Model identifier | \`${V6}\` |\n\nThe current model is \`${CURRENT}\`.\n`);
    expect(checkArchivePointsAtCurrent([ok], CURRENT)).toEqual([]);
  });
});

describe('archive rule 3 — no superseded model is described as current', () => {
  it('fires wherever the claim appears, archive included', () => {
    const out = checkNoArchivedModelAsCurrent([
      doc('docs/PUBLIC_GUIDE.md', `The current model is ${V6}.`),
    ], CURRENT);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain(V6);
  });

  it('stays silent when the claim names the current model', () => {
    expect(checkNoArchivedModelAsCurrent([
      doc('docs/PUBLIC_GUIDE.md', `The current model is ${CURRENT}.`),
    ], CURRENT)).toEqual([]);
  });

  it('does not fire on a historical mention that makes no currency claim', () => {
    expect(checkNoArchivedModelAsCurrent([
      doc('docs/MODEL_ARCHIVE.md', `v6 was \`${V6}\`, now superseded.`),
    ], CURRENT)).toEqual([]);
  });
});

describe('archive rule 4 — every frozen benchmark has a defining specification', () => {
  const specDoc = doc('docs/archive/v6/CALCULATION-v6.md',
    `> HISTORICAL DOCUMENT\n\nThis document defines \`${V6}\`, the v6 calculation specification.`);

  it('passes when the specification names the benchmark model', () => {
    expect(checkFrozenBenchmarksHaveSpecs(
      [{ path: 'docs/benchmarks/v6-frozen-benchmark.json', modelVersion: V6 }], [specDoc],
    )).toEqual([]);
  });

  it('fires on a frozen benchmark with no specification behind it — the real v6 gap', () => {
    const out = checkFrozenBenchmarksHaveSpecs(
      [{ path: 'docs/benchmarks/v6-frozen-benchmark.json', modelVersion: V6 }],
      [doc('docs/archive/v6/CALCULATION-v6.md', '> HISTORICAL DOCUMENT\n\nformulas, but the identifier is never stated')],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('no specification');
  });

  it('fires on a frozen benchmark that declares no model version at all', () => {
    const out = checkFrozenBenchmarksHaveSpecs([{ path: 'docs/benchmarks/x.json' }], [specDoc]);
    expect(out[0]).toContain('declares no modelVersion');
  });
});

describe('archive rule 5 — validation prose and data agree', () => {
  const goodMd = `# Synthetic parameter recovery\n\nModel \`${CURRENT}\`, dataset \`2026-09-04\`.`;
  const goodJson = { modelVersion: CURRENT, datasetAsOf: '2026-09-04' };

  it('passes when both agree', () => {
    expect(checkValidationConsistency({
      markdown: goodMd, results: goodJson, modelVersion: CURRENT, datasetAsOf: '2026-09-04',
    })).toEqual([]);
  });

  /* The real defect: the page was relabelled v7.1 while the JSON beside it
     still reported v7.0 and the 2026-08-29 dataset. */
  it('fires on the exact mismatch that shipped', () => {
    const out = checkValidationConsistency({
      markdown: `Model version: \`${CURRENT}\`.`,
      results: { modelVersion: V70, datasetAsOf: '2026-08-29' },
      modelVersion: CURRENT,
      datasetAsOf: '2026-09-04',
    });
    expect(out.join('\n')).toContain(V70);
    expect(out.join('\n')).toContain('2026-08-29');
    expect(out.some((f) => f.includes('never relabel'))).toBe(true);
  });

  it('fires when the page never states the dataset its own results carry', () => {
    const out = checkValidationConsistency({
      markdown: `Model \`${CURRENT}\`.`, results: goodJson, modelVersion: CURRENT, datasetAsOf: '2026-09-04',
    });
    expect(out.some((f) => f.includes('dataset date'))).toBe(true);
  });

  it('fires when the current page still names a superseded model', () => {
    const out = checkValidationConsistency({
      markdown: `Model \`${CURRENT}\`, dataset \`2026-09-04\`. Compare with \`${V70}\`.`,
      results: goodJson, modelVersion: CURRENT, datasetAsOf: '2026-09-04',
    });
    expect(out.some((f) => f.includes(V70))).toBe(true);
  });

  it('reports a missing artefact rather than passing vacuously', () => {
    expect(checkValidationConsistency({ markdown: null, results: goodJson, modelVersion: CURRENT }))
      .toEqual([`${CURRENT_VALIDATION_MD}: missing`]);
    expect(checkValidationConsistency({ markdown: goodMd, results: null, modelVersion: CURRENT }))
      .toEqual([`${CURRENT_VALIDATION_JSON}: missing`]);
  });
});

describe('archive rule 6 — superseded validation artefacts live under an archive', () => {
  it('passes when the superseded set is archived', () => {
    expect(checkSupersededValidationArchived([
      { path: 'docs/computation-demo/validation/validation-results.json', modelVersion: CURRENT },
      { path: 'docs/archive/v7.0/validation/validation-results.json', modelVersion: V70 },
    ], CURRENT)).toEqual([]);
  });

  it('fires when superseded output sits beside the current set', () => {
    const out = checkSupersededValidationArchived([
      { path: 'docs/computation-demo/validation/validation-results.json', modelVersion: V70 },
    ], CURRENT);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('does not live under');
  });
});

describe('archive rule 7 — frozen artefacts are never regenerated', () => {
  const skipping = "if (doc.path.startsWith(ARCHIVE_PREFIX)) { skippedArchives.push(doc.path); continue; }";

  it('passes while the generator skips the archive', () => {
    expect(checkFrozenNotRegenerated({
      generatorSource: skipping,
      docs: [doc('docs/archive/v7.0/MODEL_V7.0_SPEC.md',
        `> HISTORICAL DOCUMENT\n<!-- BEGIN GENERATED: model-version -->\n\`${V70}\`\n<!-- END GENERATED: model-version -->`)],
      modelVersion: CURRENT,
    })).toEqual([]);
  });

  it('fires if the generator stops skipping the archive', () => {
    const out = checkFrozenNotRegenerated({ generatorSource: 'for (const doc of docs) { write(doc); }', docs: [], modelVersion: CURRENT });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('no longer skips');
  });

  it('fires if an archived specification has been regenerated to the current model', () => {
    const out = checkFrozenNotRegenerated({
      generatorSource: skipping,
      docs: [doc('docs/archive/v7.0/MODEL_V7.0_SPEC.md',
        `> HISTORICAL DOCUMENT\n<!-- BEGIN GENERATED: model-version -->\n\`${CURRENT}\`\n<!-- END GENERATED: model-version -->`)],
      modelVersion: CURRENT,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('no longer records the model it belongs to');
  });
});

describe('archive rule 8 — provenance dates are chronological or excepted', () => {
  /* The real case: the v6 demonstration says it was generated 2026-07-12
     from a dataset as-of 2026-07-29. */
  const impossible = '**Generated:** 2026-07-12, against dataset as-of **2026-07-29**.';

  it('fires when a generation date precedes its own dataset with no explanation', () => {
    const out = checkProvenanceChronology([doc('docs/archive/v6/COMPUTATION_DEMO-v6.md', impossible)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('explicit written exception');
  });

  it('passes once the document states the discrepancy is unresolved', () => {
    expect(checkProvenanceChronology([doc('docs/archive/v6/COMPUTATION_DEMO-v6.md',
      `Provenance of the dates in this document\n\nWhich one is wrong is unresolved.\n\n${impossible}`)])).toEqual([]);
  });

  it('passes on ordinary chronological documents', () => {
    expect(checkProvenanceChronology([doc('docs/x.md',
      '**Generated:** 2026-09-04, against dataset as-of **2026-09-04**.')])).toEqual([]);
  });
});

describe('archive rule 9 — every path in the model archive exists', () => {
  const registry = 'See [spec](archive/v7.0/MODEL_V7.0_SPEC.md) and [bench](benchmarks/v6-frozen-benchmark.json).';

  it('passes when both targets resolve', () => {
    expect(checkRegistryPaths(registry, () => true)).toEqual([]);
  });

  it('fires on a dangling link', () => {
    const out = checkRegistryPaths(registry, (p) => !p.includes('MODEL_V7.0_SPEC'));
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('does not exist');
  });

  it('ignores external URLs', () => {
    expect(checkRegistryPaths('[x](https://example.org/a.json)', () => false)).toEqual([]);
  });
});

describe('archive rule 10 — the registry covers every model, with exactly one current', () => {
  const good = `| **Model identifier** | \`${V6}\` | \`${V70}\` | \`${CURRENT}\` |\n| **Status** | superseded | superseded | **current** |`;

  it('passes on a complete registry', () => {
    expect(checkRegistryCoverage(good, [V6, V70, CURRENT], CURRENT)).toEqual([]);
  });

  it('fires when a model present in the repository has no row', () => {
    const out = checkRegistryCoverage(`| \`${CURRENT}\` |\n| **Status** | **current** |`, [V6, CURRENT], CURRENT);
    expect(out.some((f) => f.includes(V6))).toBe(true);
  });

  it('fires when two rows claim to be current', () => {
    const out = checkRegistryCoverage(
      `| \`${V70}\` | \`${CURRENT}\` |\n| **Status** | **current** | **current** |`, [CURRENT], CURRENT);
    expect(out.some((f) => f.includes('marks 2 releases as current'))).toBe(true);
  });

  it('counts the marker in table rows only, not in prose explaining it', () => {
    const withProse = `Only the row marked **current** describes what the code does now.\n\n${good}`;
    expect(checkRegistryCoverage(withProse, [V6, V70, CURRENT], CURRENT)).toEqual([]);
  });
});

describe('v6 formulas stay permitted inside marked v6 payloads', () => {
  it('exempts the archive, and only the archive', () => {
    expect(archiveIsExemptFromV6Rules('docs/archive/v6/CALCULATION-v6.md')).toBe(true);
    expect(archiveIsExemptFromV6Rules('docs/archive/v7.0/MODEL_V7.0_SPEC.md')).toBe(true);
    expect(archiveIsExemptFromV6Rules('docs/METHODOLOGY.md')).toBe(false);
  });
});

describe('the rule set itself', () => {
  it('documents all ten rules', () => {
    expect(ARCHIVE_RULES).toHaveLength(10);
  });
});
