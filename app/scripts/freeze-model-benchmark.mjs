/* ====================================================================
   freeze-model-benchmark.mjs — capture the CURRENT model's complete
   output surface, before a breaking model revision replaces it.

   The v6 freeze (freeze-v6-benchmark.mjs) was written for one specific
   transition and refuses to run on anything else. This is its
   generalisation: it stamps whatever model version the engine reports and
   writes docs/benchmarks/<version>-frozen-benchmark.json.

   A frozen file is NEVER regenerated. Once the model moves on, the code
   that produced it is gone, so re-running this against a later engine
   would silently overwrite history with numbers from a different model.
   It therefore refuses to overwrite an existing freeze unless --force is
   passed deliberately.

   Run BEFORE the model change:  node scripts/freeze-model-benchmark.mjs
   ==================================================================== */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEngine } from '../src/engine/index.js';
import { buildVaultData } from '../src/data/buildVaultData.js';
import { buildModel } from '../src/engine/buildModel.js';
import { MODEL_VERSION } from '../src/engine/registry.js';
import { hazardFootprint, footprintToHazardScenario } from '../src/engine/facilities.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(here, '../src/data/vault-snapshot.json');
const OUT_DIR = resolve(here, '../../docs/benchmarks');
const slug = MODEL_VERSION.replace(/^sscim-model-/, '').replace(/[^a-zA-Z0-9.]+/g, '-');
const OUT = resolve(OUT_DIR, `${slug}-frozen-benchmark.json`);
const FORCE = process.argv.includes('--force');

if (existsSync(OUT) && !FORCE) {
  console.error(`REFUSING: ${OUT} already exists.`);
  console.error('A frozen benchmark is a historical record of a model that no longer runs. Overwriting it');
  console.error('would replace those numbers with ones from a different model. Pass --force only if you are');
  console.error('certain the existing file was written by the SAME model version you are running now.');
  process.exit(1);
}

const round = (v, n = 8) => (Number.isFinite(v) ? Number(v.toFixed(n)) : v);
const bundle = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const data = buildVaultData(bundle);
const engine = buildEngine({ ...data, datasetAsOf: bundle.meta?.snapshotDate });
const model = buildModel({ data, engine });

const HAZARD_POINTS = [
  { id: 'kumamoto', lat: 32.8, lng: 130.7, radiusKm: 100, severity: 7 },
  { id: 'hsinchu', lat: 24.8, lng: 121.0, radiusKm: 60, severity: 7 },
  { id: 'pyeongtaek', lat: 37.0, lng: 127.1, radiusKm: 60, severity: 7 },
];

const hazards = HAZARD_POINTS.map((p) => {
  const fp = hazardFootprint(p, data.FACILITY_LAYER);
  const scenario = footprintToHazardScenario(fp, { severity: p.severity });
  const m = scenario ? buildModel({ data, engine, scenario }) : null;
  return {
    id: p.id,
    point: p,
    sitesInside: fp.hits.length,
    scoredStages: fp.stages.length,
    stageExposure: Object.fromEntries(fp.stages.map((s) => [s.stageId, round(s.exposure)])),
    chainIndexDelta: m ? round(m.chainIndexDelta, 6) : null,
  };
});

const SELECTED_EVENTS = ['e1', 'e2', 'e4', 'h2607_kumamoto', 'p260807_man0807', 'h2210_bis', 'h2504_ree', 'x2505_eda'];

let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(here, '../..'), encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }

const benchmark = {
  frozen: true,
  generatedAt: new Date().toISOString(),
  modelVersion: MODEL_VERSION,
  datasetAsOf: engine.MODEL_PRIORS.datasetAsOf,
  commit,
  note: 'Frozen output surface of this model version, captured before a breaking model revision. Never regenerate: the engine that produced it will not exist after the revision.',
  counts: {
    stages: data.STAGES.length, edges: data.FLOW_EDGES.length, events: data.EVENTS.length,
    policies: data.POLICIES.length, companies: data.COMPANIES.length, facilities: data.FACILITIES.length,
  },
  headline: {
    baselineChainIndex: round(model.baselineChainIndex, 6),
    operationalIndexSigned: round(engine.operationalIndex(model.baselineField), 8),
    envelope: { low: round(model.envelope.low, 6), base: round(model.envelope.base, 6), high: round(model.envelope.high, 6) },
  },
  stages: Object.fromEntries(data.STAGES.map((s) => [s.id, {
    structural: round(engine.STRUCTURAL_VULNERABILITY[s.id], 6),
    networkInfluenceRaw: round(engine.NETWORK_INFLUENCE_RAW[s.id], 10),
    networkInfluenceScore: round(engine.NETWORK_INFLUENCE[s.id], 6),
    geo: round(engine.GEO_CONCENTRATION[s.id], 6),
    policy: round(engine.POLICY_EXPOSURE[s.id], 6),
    stageWeight: round(engine.STAGE_WEIGHT[s.id], 10),
    operationalField: round(model.baselineField[s.id], 10),
  }])),
  countries: Object.fromEntries(Object.entries(model.countriesBase).map(([c, v]) => [c, {
    structural: round(v.structural, 6), localPressure: round(v.localPressure, 8), chainContribution: round(v.chainContribution, 8),
  }])),
  companies: Object.fromEntries(data.COMPANIES.map((c) => [c.id, {
    criticalityRaw: round(engine.COMPANY_CRITICALITY_RAW[c.id], 10),
    criticalityScore: round(engine.COMPANY_CRITICALITY[c.id]?.value, 6),
  }])),
  events: Object.fromEntries(SELECTED_EVENTS.map((id) => {
    const e = data.EVENTS.find((x) => x.id === id);
    if (!e) return [id, null];
    const { source, scored } = engine.eventField(e);
    return [id, {
      scored, profile: source.profile?.kind ?? null,
      persistence: round(source.persistence, 8), intensity: round(source.intensity, 8),
      sourceVector: Object.fromEntries(Object.entries(source.z).map(([k, v]) => [k, round(v, 8)])),
    }];
  })),
  hazards,
  history: engine.HISTORY.map((v) => round(v, 6)),
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(benchmark, null, 2)}\n`);
console.log(`Frozen ${MODEL_VERSION} → ${OUT}`);
console.log(`  dataset ${benchmark.datasetAsOf} · index ${benchmark.headline.baselineChainIndex} · commit ${commit?.slice(0, 8) ?? 'unknown'}`);
