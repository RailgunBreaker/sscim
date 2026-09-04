/* ====================================================================
   benchmarkLabels.test.js — an experiment's LABEL must describe the
   experiment that was actually run.

   THE DEFECT THIS PINS SHUT. The v7.0 benchmark published an ablation
   labelled "v7 with a 12-day market half-life (the single v6 half-life)"
   and ran it with `marketHalfLifeDays: 21, acuteHalfLifeDays: 7`. Neither
   number is 12. A reader comparing v6 and v7 persistence was reading the
   result of an experiment nobody performed, and nothing in the build could
   notice, because the label was prose and the parameters were code.

   The benchmark now records the parameters it applied, and this test reads
   both. Any number-with-unit asserted in a label must match the parameter
   it names.
   ==================================================================== */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARAMETERS, MODEL_FORMS, resolveParams } from './registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const BENCHMARK = resolve(here, '..', '..', '..', 'docs', 'benchmarks', 'v6-to-v7-benchmark.json');

const report = existsSync(BENCHMARK) ? JSON.parse(readFileSync(BENCHMARK, 'utf8')) : null;

describe('the v6 → v7 benchmark', () => {
  it('exists and carries its ablations', () => {
    expect(report).toBeTruthy();
    expect(Array.isArray(report.ablations)).toBe(true);
    expect(report.ablations.length).toBeGreaterThan(3);
  });

  it('records the parameters each ablation actually applied', () => {
    report.ablations.forEach((a) => {
      expect(a).toHaveProperty('params');
      expect(typeof a.params).toBe('object');
    });
  });

  /* The core assertion. "12 days" in a label must mean 12 in the params. */
  it('every day-valued claim in a label matches the parameter it names', () => {
    const mismatches = [];
    for (const a of report.ablations) {
      const claimed = [...a.label.matchAll(/(\d+(?:\.\d+)?)[- ]day/gi)].map((m) => Number(m[1]));
      if (!claimed.length) continue;
      const dayParams = Object.entries(a.params)
        .filter(([k]) => /Days$/.test(k))
        .map(([, v]) => v);
      if (!dayParams.length) {
        mismatches.push(`"${a.label}" claims ${claimed.join('/')} days but sets no *Days parameter`);
        continue;
      }
      for (const c of claimed) {
        if (!dayParams.includes(c)) {
          mismatches.push(`"${a.label}" claims ${c} days; params set ${JSON.stringify(a.params)}`);
        }
      }
      // A label claiming a single value for "every" half-life must set them all to it.
      if (/every .*half-life/i.test(a.label) && claimed.length === 1) {
        const exponential = ['acuteHalfLifeDays', 'marketHalfLifeDays'];
        exponential.forEach((k) => {
          if (a.params[k] !== claimed[0]) {
            mismatches.push(`"${a.label}" says EVERY exponential half-life is ${claimed[0]}d, but ${k} = ${a.params[k]}`);
          }
        });
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every ablation names a real registry parameter or model form, with a valid value', () => {
    const known = new Set([...Object.keys(PARAMETERS), ...Object.keys(MODEL_FORMS), 'structuralWeightsRaw']);
    report.ablations.forEach((a) => {
      Object.keys(a.params).forEach((k) => expect(known).toContain(k));
      // The registry itself is the validator: an invalid combination throws.
      expect(() => resolveParams(a.params)).not.toThrow();
    });
  });

  it('every model-form ablation names an option that model form actually offers', () => {
    report.ablations.forEach((a) => {
      Object.entries(a.params).forEach(([k, v]) => {
        if (k in MODEL_FORMS) expect(MODEL_FORMS[k].options).toContain(v);
      });
    });
  });

  /* A comparison that mixes a model change with a data change is not a
     model comparison. The committed file must be matched-date. */
  it('is a MATCHED-DATE comparison against the frozen v6 reference', () => {
    expect(report.to.datasetAsOf).toBe(report.from.datasetAsOf);
  });

  it('discloses back-dating when the snapshot has moved past the reference', () => {
    if (report.to.snapshotDate && report.to.snapshotDate !== report.to.datasetAsOf) {
      expect(report.to.backDatedByDays).toBeGreaterThan(0);
      expect(report.to.backDatingNote).toMatch(/re-aged/i);
    }
  });

  /* The persistence ablation is the one most likely to be over-read as
     "this is what v6 did". It must say that it is not. */
  it('does not present the persistence ablation as a reconstruction of v6', () => {
    const a = report.ablations.find((x) => /half-life/i.test(x.label));
    expect(a).toBeTruthy();
    expect(a.note).toMatch(/NOT a reconstruction|not a reconstruction/);
    expect(a.note).toMatch(/outage_recovery|persistent_policy/);
  });

  /* The v6 weighting was effectively proportional to log1p(turnover); the
     substantive change is the TRANSFORM, not the normalization. */
  it('describes the v6 weighting as effectively log-turnover, not merely unnormalized', () => {
    const weightCause = report.materialChangesByCause.find((c) => /weight/i.test(c.change));
    expect(weightCause).toBeTruthy();
    expect(weightCause.why).toMatch(/effective/i);
    expect(weightCause.why).toMatch(/log1p|log-turnover/i);
    expect(weightCause.why).toMatch(/transform/i);
  });
});
