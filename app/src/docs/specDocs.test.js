/* ====================================================================
   specDocs.test.js — CODE ↔ DOCUMENTATION PARITY, in the unit suite.

   `npm run docs:verify` is the standalone command; this file makes the
   same guarantees fail an ordinary `npm test` run, so a coefficient can
   never change in the code without CI noticing that the published table
   did not change with it.

   What is pinned here:
     · the documented model version is current;
     · every generated block matches what the registry and the engine
       produce right now;
     · the documented equations agree with the FROZEN CALCULATION FIXTURE
       (app/src/engine/workedExample.js) — the worked example in the
       specification is checked number by number against the live engine;
     · every registry parameter, model form and temporal profile has a
       definition in the canonical specification;
     · no current-facing document presents a v6 formula as active;
     · the four over-read terms do not appear unqualified;
     · reported test counts, snapshot dates, screenshots and evidence
       reports are not stale.
   ==================================================================== */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { findMarkdownDocs } from '../../scripts/lib/find-markdown.mjs';
import { applyGenerated, GENERATORS } from '../../scripts/lib/doc-generated.mjs';
import { MODEL_VERSION, PARAMETERS, MODEL_FORMS, STRUCTURAL_COMPONENTS, BASE_PARAMS } from '../engine/registry.js';
import { PROFILE_IDS } from '../engine/persistence.js';
import { workedExample } from '../engine/workedExample.js';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..', '..');
const repoRoot = resolve(appDir, '..');
const SPEC_PATH = resolve(repoRoot, 'docs', 'MODEL_V7_SPEC.md');
const spec = readFileSync(SPEC_PATH, 'utf8');

const docs = await findMarkdownDocs();
const currentDocs = docs.filter((d) => !d.path.startsWith('docs/archive/'));

describe('the canonical specification', () => {
  it('exists and states the current model version', () => {
    expect(spec).toContain(MODEL_VERSION);
  });

  it('carries every required section', () => {
    for (const heading of [
      'Model purpose and boundary', 'Complete notation', 'Exact executable formulas',
      'Order of operations', 'Parameter register', 'Fallback and missing-data rules',
      'Worked numerical example', 'Sensitivity and robustness', 'Validation status',
      'v6 → v7 change log', 'Limitations and calibration roadmap',
    ]) {
      expect(spec).toContain(heading);
    }
  });

  it.each(Object.keys(PARAMETERS))('defines the parameter %s', (name) => {
    expect(spec).toContain(name);
    expect(spec).toContain(PARAMETERS[name].definition);
  });

  it.each(Object.keys(MODEL_FORMS))('defines the model form %s', (name) => {
    expect(spec).toContain(name);
    MODEL_FORMS[name].options.forEach((o) => expect(spec).toContain(o));
  });

  it.each(PROFILE_IDS)('defines the temporal profile %s', (id) => {
    expect(spec).toContain(id);
  });

  it.each(STRUCTURAL_COMPONENTS)('defines the structural component %s', (k) => {
    expect(spec).toContain(k);
  });

  it('states the boundary explicitly — what the outputs are not', () => {
    const boundary = spec.slice(spec.indexOf('### 1.3'), spec.indexOf('### 1.4')).toLowerCase();
    expect(boundary).toContain('are **not**');
    for (const claim of ['probabilit', 'monetary losses', 'forecasts', 'observed trade flows', 'causal estimates', 'calibrated risk estimates']) {
      expect(boundary).toContain(claim);
    }
    // And the positive statement of what they ARE.
    expect(spec).toContain('Bounded comparative exposure scores');
  });
});

/* ==================================================================
   GENERATED BLOCKS. If any of these drift, the published parameter
   table no longer describes the code.
   ================================================================== */
describe('generated documentation blocks', () => {
  const generated = currentDocs.filter((d) => d.content.includes('<!-- BEGIN GENERATED:'));

  it('exist, and at least the specification carries them', () => {
    expect(generated.map((d) => d.path)).toContain('docs/MODEL_V7_SPEC.md');
  });

  it.each(generated.map((d) => d.path))('%s matches what the registry and engine produce', (path) => {
    const original = readFileSync(resolve(repoRoot, path), 'utf8');
    const { markdown, missing } = applyGenerated(original);
    expect(missing).toEqual([]);
    if (markdown !== original) {
      throw new Error(`${path} is stale — run \`npm run docs:generate\`. Known blocks: ${Object.keys(GENERATORS).join(', ')}`);
    }
  });
});

/* ==================================================================
   EQUATIONS vs THE FROZEN CALCULATION FIXTURE.

   The worked example in the specification is generated from
   engine/workedExample.js. These assertions check the ARITHMETIC of that
   fixture independently — by re-deriving each intermediate from the
   documented formula — so a change in the engine that the documentation
   silently followed still fails here.
   ================================================================== */
describe('the documented equations agree with the frozen calculation fixture', () => {
  const w = workedExample();
  const P = BASE_PARAMS;

  it('the fixture reports its own internal checks as passing', () => {
    expect(w.checks.persistenceIsExactlyHalf).toBe(true);
    expect(w.checks.intensityIsSeverityOverTen).toBe(true);
    expect(w.checks.countryChainReconciles).toBe(true);
    expect(w.checks.stageWeightsSumToOne).toBe(true);
  });

  it('z = d · g(q) · alpha · R, component by component', () => {
    expect(w.incident.sourceVector.A).toBeCloseTo(1 * 0.6 * 0.5 * 0.5, 12);
    expect(w.incident.sourceVector.B).toBeCloseTo(1 * 0.6 * 0.25 * 0.5, 12);
  });

  it('D_ba = f_d · q_ba · [phi + (1-phi) nu_a], per edge', () => {
    for (const [b, cols] of Object.entries(w.D)) {
      for (const [a, value] of Object.entries(cols)) {
        const expected = P.downstreamTransmission * w.allocations.q[b][a]
          * (P.minimumDependencyFactor + (1 - P.minimumDependencyFactor) * w.nonSubstitutabilityUnit[a]);
        expect(value).toBeCloseTo(expected, 12);
      }
    }
  });

  it('U_ab = f_u · r_ab, per edge', () => {
    for (const [a, cols] of Object.entries(w.U)) {
      for (const [b, value] of Object.entries(cols)) {
        expect(value).toBeCloseTo(P.upstreamTransmission * w.allocations.r[a][b], 12);
      }
    }
  });

  it('x^d_b = z_b + sum_a D_ba x^d_a, in topological order', () => {
    const z = w.incident.sourceVector;
    const x = w.channels.xDown;
    // A has no inbound edge in the fixture.
    expect(x.A).toBeCloseTo(z.A ?? 0, 12);
    expect(x.B).toBeCloseTo((z.B ?? 0) + w.D.B.A * x.A, 12);
    expect(x.C).toBeCloseTo((z.C ?? 0) + w.D.C.B * x.B + w.D.C.A * x.A, 12);
    expect(x.D).toBeCloseTo((z.D ?? 0) + w.D.D.C * x.C, 12);
  });

  it('x^u_a = z_a + sum_b U_ab x^u_b, in reverse topological order', () => {
    const z = w.incident.sourceVector;
    const x = w.channels.xUp;
    expect(x.D).toBeCloseTo(z.D ?? 0, 12);
    expect(x.C).toBeCloseTo((z.C ?? 0) + w.U.C.D * x.D, 12);
    expect(x.B).toBeCloseTo((z.B ?? 0) + w.U.B.C * x.C, 12);
    expect(x.A).toBeCloseTo((z.A ?? 0) + w.U.A.B * x.B + w.U.A.C * x.C, 12);
  });

  it('p_s = z_s + (x^d_s - z_s) + (x^u_s - z_s) — the direct source counted once', () => {
    w.stageIds.forEach((s) => {
      const z = w.incident.sourceVector[s] ?? 0;
      expect(w.baselineField[s]).toBeCloseTo(z + (w.channels.xDown[s] - z) + (w.channels.xUp[s] - z), 12);
    });
  });

  it('the reconvergent node is the plain sum of its inflows, not a noisy-OR of them', () => {
    const x = w.channels.xDown;
    const summed = w.D.C.B * x.B + w.D.C.A * x.A;
    const noisyOr = 1 - (1 - w.D.C.B * x.B) * (1 - w.D.C.A * x.A);
    expect(x.C).toBeCloseTo(summed, 12);
    expect(x.C).not.toBeCloseTo(noisyOr, 8);
  });

  it('I = sum_s w_s F_s, and the displayed index is 5 + 5I', () => {
    const I = w.stageIds.reduce((a, s) => a + w.stageWeight[s] * w.baselineField[s], 0);
    expect(w.baselineIndexSigned).toBeCloseTo(I, 12);
    expect(w.baselineIndexDisplay).toBeCloseTo(5 + 5 * I, 12);
  });

  it('the country chain contributions sum to the signed index exactly', () => {
    const total = Object.values(w.countries.baseline).reduce((a, c) => a + c.chainContribution, 0);
    expect(total).toBeCloseTo(w.baselineIndexSigned, 12);
  });

  it('the two incidents combine with the bounded union, per stage', () => {
    w.stageIds.forEach((s) => {
      const a = Math.max(0, w.baselineField[s]);
      const b = Math.max(0, w.scenario.field[s]);
      expect(w.activeField[s]).toBeCloseTo(1 - (1 - a) * (1 - b), 12);
      expect(w.activeField[s]).toBeLessThanOrEqual(a + b + 1e-12); // saturating, never additive
    });
  });

  it('the scenario delta is the difference of the two displayed indices', () => {
    expect(w.scenarioDelta).toBeCloseTo(w.baselineIndexDisplay + w.scenarioDelta - w.baselineIndexDisplay, 12);
    expect(w.activeIndexDisplay - w.baselineIndexDisplay).toBeCloseTo(w.scenarioDelta, 12);
  });

  it('and every one of those numbers appears in the published worked example', () => {
    const n = (v, d = 10) => String(Number(v.toFixed(d)));
    const worked = spec.slice(spec.indexOf('BEGIN GENERATED: worked-example'), spec.indexOf('END GENERATED: worked-example'));
    expect(worked).toContain(n(w.incident.sourceVector.A));
    expect(worked).toContain(n(w.channels.xDown.C));
    expect(worked).toContain(n(w.baselineIndexDisplay, 12));
    expect(worked).toContain(n(w.scenarioDelta, 12));
  });
});

/* ==================================================================
   PROHIBITED CLAIMS AND STALENESS. The standalone command does the same
   checks with richer reporting; this is the CI gate.
   ================================================================== */
describe('no current-facing document presents a v6 formula as active', () => {
  it('runs the documentation verifier to completion', () => {
    try {
      execFileSync(process.execPath, [resolve(appDir, 'scripts', 'verify-docs.mjs')], { stdio: 'pipe', cwd: appDir });
    } catch (e) {
      throw new Error(`docs:verify failed:\n${`${e.stdout ?? ''}${e.stderr ?? ''}`.trim()}`);
    }
  });
});

describe('staleness', () => {
  const snapshot = JSON.parse(readFileSync(resolve(appDir, 'src', 'data', 'vault-snapshot.json'), 'utf8'));
  const snapshotDate = snapshot.meta?.snapshotDate;

  it('every current document that names a snapshot date names the current one', () => {
    const wrong = [];
    for (const doc of currentDocs) {
      const re = /(?:snapshot|dataset|data)\s*(?:date|as[- ]of|as of)\s*(?:is|:|=|of)?\s*\**\s*(\d{4}-\d{2}-\d{2})/gi;
      let m;
      while ((m = re.exec(doc.content)) !== null) if (m[1] !== snapshotDate) wrong.push(`${doc.path}: ${m[1]}`);
    }
    expect(wrong).toEqual([]);
  });

  it('the evidence-coverage report describes the committed snapshot', () => {
    const evidence = currentDocs.find((d) => d.path === 'docs/reference/EVIDENCE-COVERAGE.md');
    expect(evidence).toBeTruthy();
    expect(evidence.content).toContain(snapshotDate);
  });

  it('every referenced screenshot and benchmark artefact exists', () => {
    const missing = [];
    for (const doc of docs) {
      const re = /\]\(((?:\.\.\/)*(?:docs\/)?(?:screenshots|benchmarks)\/[^)\s]+)\)/g;
      let m;
      while ((m = re.exec(doc.content)) !== null) {
        const rel = m[1].replace(/^(\.\.\/)+/, '');
        const candidates = [resolve(repoRoot, rel), resolve(repoRoot, 'docs', rel), resolve(repoRoot, doc.path, '..', m[1])];
        if (!candidates.some((c) => existsSync(c))) missing.push(`${doc.path} → ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('any documented test count matches the recorded verification run', () => {
    const runPath = resolve(repoRoot, 'docs', 'benchmarks', 'verification-run.json');
    const run = existsSync(runPath) ? JSON.parse(readFileSync(runPath, 'utf8')) : null;
    const wrong = [];
    for (const doc of currentDocs) {
      const re = /(\d{2,5})\s+(?:unit\s+)?tests?\b/gi;
      let m;
      while ((m = re.exec(doc.content)) !== null) {
        if (!run) { wrong.push(`${doc.path}: claims ${m[1]} tests but no verification run is recorded`); continue; }
        if (Number(m[1]) !== run.tests?.total) wrong.push(`${doc.path}: claims ${m[1]}, recorded run reports ${run.tests?.total}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('the archive is marked as historical', () => {
  const archived = docs.filter((d) => d.path.startsWith('docs/archive/'));

  it('contains the v6 material', () => {
    expect(archived.length).toBeGreaterThan(0);
  });

  it.each(archived.map((d) => d.path))('%s carries the historical banner', (path) => {
    expect(docs.find((d) => d.path === path).content).toContain('HISTORICAL DOCUMENT');
  });
});
