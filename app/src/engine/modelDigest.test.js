/* The guard that a user-interface change did not move a number.

   The digest covers the declared parameters, the structural weights, the
   record counts, the headline index and envelope, every stage's structural
   and network terms, every company criticality, every country structural
   score and the whole computed history. It excludes wall-clock time and git
   state, so two runs of the same model over the same snapshot agree.

   If this test fails after a styling or layout change, the change was not
   cosmetic. If it fails after a deliberate model change, update the value
   here AND the row in docs/MODEL_ARCHIVE.md in the same commit — that
   coupling is the point. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { modelDigest, modelSurface } from '../../scripts/model-digest.mjs';
import { MODEL_VERSION } from './registry.js';

const REGISTRY_DOC = resolve(import.meta.dirname, '../../../docs/MODEL_ARCHIVE.md');

describe('model output digest', () => {
  it('is deterministic across repeated computation', () => {
    expect(modelDigest().digest).toBe(modelDigest().digest);
  });

  it('identifies the current model and dataset', () => {
    const d = modelDigest();
    expect(d.modelVersion).toBe(MODEL_VERSION);
    expect(d.datasetAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches the value recorded in docs/MODEL_ARCHIVE.md', () => {
    const recorded = readFileSync(REGISTRY_DOC, 'utf8').match(/sha256:([0-9a-f]{64})/);
    expect(recorded, 'docs/MODEL_ARCHIVE.md records no output digest').not.toBeNull();
    expect(modelDigest().digest).toBe(recorded[1]);
  });

  it('covers the outputs a reader can quote', () => {
    const s = modelSurface();
    expect(Object.keys(s.stages).length).toBeGreaterThan(20);
    expect(Object.keys(s.companies).length).toBeGreaterThan(100);
    expect(s.history.length).toBeGreaterThan(0);
    expect(s.headline.baselineChainIndex).toBeGreaterThan(0);
    /* The v7.1 reach split must be inside the fingerprint, or a regression
       to the v7.0 definition would not be detected. */
    const first = Object.values(s.stages)[0];
    expect(first).toHaveProperty('directFootprint');
    expect(first).toHaveProperty('spilloverReach');
  });

  it('is key-order independent, so it fingerprints values and not iteration order', () => {
    const s = modelSurface();
    const keys = Object.keys(s.stages);
    expect(keys).toEqual([...keys].sort());
  });
});
