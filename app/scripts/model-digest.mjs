/* ====================================================================
   model-digest.mjs — a reproducible fingerprint of the model's published
   output surface.

   WHY THIS EXISTS. A release row in docs/MODEL_ARCHIVE.md wants to say
   "this is exactly which model these numbers came from". A commit hash
   cannot do that job for the CURRENT release: the artefact naming the
   hash is committed BY that commit, so the value would have to be known
   before it exists. Recording the parent commit instead is honest but
   weak — it names the code that preceded the artefact, not the model.

   A digest over the output surface has neither problem. It is derived
   from what the engine actually computes, it can be recomputed at any
   commit, and it is identical for two commits that differ only in
   documentation or user interface.

   That last property is the second use: it is the guard that a user
   interface refactor did not move a number. Change a colour token and
   the digest holds; change a propagation parameter and it does not.

   Deliberately excluded: wall-clock time, git state, file paths, and
   anything else that varies between two runs of the same model over the
   same snapshot.

   Run:  npm run digest          print the digest and its components
         npm run digest -- --json    machine-readable
   ==================================================================== */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEngine } from '../src/engine/index.js';
import { buildVaultData } from '../src/data/buildVaultData.js';
import { buildModel } from '../src/engine/buildModel.js';
import { MODEL_VERSION, PARAMETERS, BASE_STRUCTURAL_WEIGHTS } from '../src/engine/registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(here, '../src/data/vault-snapshot.json');

/* Fixed precision, so that a digest does not depend on how many digits a
   platform's float-to-string happens to emit. */
const r = (v, n = 8) => (Number.isFinite(v) ? Number(v.toFixed(n)) : null);

/* Stable key order at every level. JSON.stringify preserves insertion
   order, which is not something a fingerprint may depend on. */
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
};

export function modelSurface() {
  const bundle = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  const data = buildVaultData(bundle);
  const datasetAsOf = bundle.meta?.snapshotDate ?? null;
  const engine = buildEngine({ ...data, datasetAsOf });
  const model = buildModel({ data, engine });

  return canonical({
    modelVersion: MODEL_VERSION,
    datasetAsOf,
    /* INPUTS: the declared parameter values and structural weights. */
    parameters: Object.fromEntries(Object.entries(PARAMETERS).map(([k, p]) => [k, r(p.base, 10)])),
    structuralWeights: Object.fromEntries(Object.entries(BASE_STRUCTURAL_WEIGHTS).map(([k, v]) => [k, r(v, 10)])),
    counts: {
      stages: data.STAGES.length,
      edges: data.FLOW_EDGES.length,
      events: data.EVENTS.length,
      policies: data.POLICIES.length,
      companies: data.COMPANIES.length,
      facilities: data.FACILITIES.length,
    },
    /* OUTPUTS: every published surface a reader can quote. */
    headline: {
      baselineChainIndex: r(model.baselineChainIndex, 6),
      operationalIndexSigned: r(engine.operationalIndex(model.baselineField), 8),
      envelopeLow: r(model.envelope.low, 6),
      envelopeHigh: r(model.envelope.high, 6),
    },
    stages: Object.fromEntries(data.STAGES.map((s) => [s.id, {
      structural: r(engine.STRUCTURAL_VULNERABILITY[s.id], 6),
      directFootprint: r(engine.DIRECT_FOOTPRINT?.[s.id], 10),
      spilloverReach: r(engine.SPILLOVER_REACH_RAW?.[s.id], 10),
      networkInfluence: r(engine.NETWORK_INFLUENCE[s.id], 6),
      operationalField: r(model.baselineField[s.id], 10),
    }])),
    companies: Object.fromEntries(data.COMPANIES.map((c) => [c.id, r(engine.COMPANY_CRITICALITY[c.id]?.value, 6)])),
    countries: Object.fromEntries(Object.entries(model.countriesBase).map(([c, v]) => [c, r(v.structural, 6)])),
    history: engine.HISTORY.map((v) => r(v, 6)),
  });
}

export function modelDigest() {
  const surface = modelSurface();
  const json = JSON.stringify(surface);
  return {
    digest: createHash('sha256').update(json).digest('hex'),
    modelVersion: surface.modelVersion,
    datasetAsOf: surface.datasetAsOf,
    bytes: json.length,
  };
}

/* Only report when run directly; importing this from a test must not print. */
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const d = modelDigest();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(d, null, 2));
  } else {
    console.log(`model            ${d.modelVersion}`);
    console.log(`dataset          ${d.datasetAsOf}`);
    console.log(`surface bytes    ${d.bytes}`);
    console.log(`output digest    sha256:${d.digest}`);
  }
}
