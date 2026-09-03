/* ====================================================================
   build-sensitivity.mjs — the v7 GLOBAL SENSITIVITY build step.

   Deterministic: a fixed seed, no unseeded Math.random anywhere in the
   path, so two runs over the same snapshot produce byte-identical output
   and the artefact can be diffed like any other build product.

   Writes docs/benchmarks/v7-sensitivity.json and prints a readable
   summary. Run:  npm run sensitivity
                  npm run sensitivity -- --samples 512 --seed 7
   ==================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEngine } from '../src/engine/index.js';
import { buildVaultData } from '../src/data/buildVaultData.js';
import { buildFacilityLayer, hazardFootprint, footprintToHazardScenario } from '../src/engine/facilities.js';
import { MODEL_VERSION, MODEL_FORMS, BASE_PARAMS, resolveParams, parameterRegister } from '../src/engine/registry.js';
import {
  saltelliDesign, sobolIndices, continuousDimensions, rowToOverrides, modelFormGrid,
  rankStability, signStability, envelope, oneAtATime,
} from '../src/engine/sensitivity.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(here, '../src/data/vault-snapshot.json');
const OUT_DIR = resolve(here, '../../docs/benchmarks');
const OUT = resolve(OUT_DIR, 'v7-sensitivity.json');

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
};
const SAMPLES = argOf('samples', 256);
const SEED = argOf('seed', 20260829);

const bundle = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const data = buildVaultData(bundle);
const datasetAsOf = bundle.meta?.snapshotDate;

/* The three hazard scenarios the benchmark also uses, so the sign-stability
   result refers to the same hypotheses a reader can reproduce. */
const HAZARD_POINTS = [
  { id: 'kumamoto', lat: 32.8, lng: 130.7, radiusKm: 100, severity: 7 },
  { id: 'hsinchu', lat: 24.8, lng: 121.0, radiusKm: 60, severity: 7 },
  { id: 'pyeongtaek', lat: 37.0, lng: 127.1, radiusKm: 60, severity: 7 },
];

/* One model evaluation: build the engine at these parameters and read the
   outputs the report is about. The facility layer is rebuilt whenever the
   ordinal scale mapping changes, because the footprint depends on it. */
const layerCache = new Map();
function layerFor(params) {
  const key = `${params.facilityScaleMapping}|${params.rampingSiteWeight}`;
  if (!layerCache.has(key)) layerCache.set(key, buildFacilityLayer(bundle.facilities || [], params));
  return layerCache.get(key);
}

function evaluate(overrides) {
  const params = resolveParams(overrides);
  const engine = buildEngine({ ...data, datasetAsOf, params: overrides, computeHistory: false });
  const field = engine.operationalField(data.EVENTS);
  const baseSigned = engine.operationalIndex(field);
  const layer = layerFor(params);

  const hazardDeltas = {};
  for (const p of HAZARD_POINTS) {
    const fp = hazardFootprint(p, layer);
    const scenario = footprintToHazardScenario(fp, { severity: p.severity });
    if (!scenario) { hazardDeltas[p.id] = 0; continue; }
    const active = engine.operationalField([...data.EVENTS, { ...scenario.event, id: 'hazard' }]);
    hazardDeltas[p.id] = engine.toDisplayIndex(engine.operationalIndex(active)) - engine.toDisplayIndex(baseSigned);
  }

  return {
    headlineIndex: engine.toDisplayIndex(baseSigned),
    stageField: Object.fromEntries(data.STAGES.map((s) => [s.id, field[s.id] ?? 0])),
    structural: { ...engine.STRUCTURAL_VULNERABILITY },
    networkInfluenceRaw: { ...engine.NETWORK_INFLUENCE_RAW },
    companyCriticalityRaw: { ...engine.COMPANY_CRITICALITY_RAW },
    hazardDeltas,
  };
}

const scalar = (r) => r.headlineIndex;

console.log(`SSCIM v7 global sensitivity — model ${MODEL_VERSION}, dataset ${datasetAsOf}`);

/* ---------------- 1. numerical parameters: Saltelli / Sobol ---------------- */
const dims = continuousDimensions();
const design = saltelliDesign({ dims: dims.length, samples: SAMPLES, seed: SEED });
console.log(`  design: ${dims.length} continuous dimensions x ${SAMPLES} samples = ${design.evaluations} model evaluations`);

const t0 = Date.now();
const evalRow = (row) => evaluate(rowToOverrides(row, dims));
const resA = design.A.map(evalRow);
const resB = design.B.map(evalRow);
const resAB = design.AB.map((mat) => mat.map(evalRow));
console.log(`  evaluated in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const sobolFor = (pick) => sobolIndices({
  yA: resA.map(pick), yB: resB.map(pick), yAB: resAB.map((rows) => rows.map(pick)),
});

const headlineSobol = sobolFor(scalar);
const parameterInfluence = dims.map((d, i) => ({
  key: d.key, symbol: d.symbol, units: d.units, low: d.low, base: d.base, high: d.high,
  firstOrder: headlineSobol.first[i],
  totalOrder: headlineSobol.total[i],
})).sort((a, b) => b.totalOrder - a.totalOrder);

const baseResult = evaluate({});
const headlineSamples = [...resA, ...resB].map(scalar);
const headlineEnvelope = envelope(headlineSamples, baseResult.headlineIndex);

/* ---------------- 2. one-at-a-time diagnostics ---------------- */
const oat = oneAtATime({ evaluate: (o) => scalar(evaluate(o)), dims });

/* ---------------- 3. rank stability ---------------- */
const allSamples = [...resA, ...resB];
const stageRank = rankStability(baseResult.stageField, allSamples.map((r) => r.stageField), 5);
const structuralRank = rankStability(baseResult.structural, allSamples.map((r) => r.structural), 5);
const companyRank = rankStability(baseResult.companyCriticalityRaw, allSamples.map((r) => r.companyCriticalityRaw), 5);
const networkRank = rankStability(baseResult.networkInfluenceRaw, allSamples.map((r) => r.networkInfluenceRaw), 5);

/* ---------------- 4. scenario sign stability ---------------- */
const scenarioSign = {};
for (const p of HAZARD_POINTS) {
  const values = allSamples.map((r) => r.hazardDeltas[p.id]);
  scenarioSign[p.id] = {
    ...signStability(values),
    envelope: envelope(values, baseResult.hazardDeltas[p.id]),
  };
}

/* ---------------- 5. model forms, reported SEPARATELY ---------------- */
const grid = modelFormGrid();
console.log(`  model forms: ${grid.length} combinations`);
const formResults = grid.map((combo) => ({ combo, result: evaluate(combo) }));
const formHeadlines = formResults.map((r) => r.result.headlineIndex);
const modelFormEnvelope = envelope(formHeadlines, baseResult.headlineIndex);

/* Per-form marginal effect: the headline spread attributable to switching
   ONE form while every other form is held at every combination of its own
   options. Reported as a range, because a categorical choice has no
   variance decomposition to report. */
const modelFormEffects = Object.keys(MODEL_FORMS).map((key) => {
  const byOption = {};
  for (const option of MODEL_FORMS[key].options) {
    const subset = formResults.filter((r) => r.combo[key] === option).map((r) => r.result.headlineIndex);
    byOption[option] = { min: Math.min(...subset), mean: subset.reduce((a, v) => a + v, 0) / subset.length, max: Math.max(...subset) };
  }
  const means = Object.values(byOption).map((v) => v.mean);
  return { key, base: MODEL_FORMS[key].base, byOption, meanSpread: Math.max(...means) - Math.min(...means) };
}).sort((a, b) => b.meanSpread - a.meanSpread);

const formStageRank = rankStability(baseResult.stageField, formResults.map((r) => r.result.stageField), 5);
const formScenarioSign = {};
for (const p of HAZARD_POINTS) {
  formScenarioSign[p.id] = signStability(formResults.map((r) => r.result.hazardDeltas[p.id]));
}

/* ---------------- output ---------------- */
const report = {
  modelVersion: MODEL_VERSION,
  datasetAsOf,
  snapshotDate: bundle.meta?.snapshotDate ?? null,
  generatedAt: new Date().toISOString(),
  design: {
    method: 'Saltelli sampling with Sobol first-order and total-order estimators, over the registry assumption box',
    generator: 'splitmix32, fixed seed — no unseeded randomness anywhere in this path',
    seed: SEED,
    samples: SAMPLES,
    continuousDimensions: dims.length,
    numericalEvaluations: design.evaluations,
    modelFormCombinations: grid.length,
    interpretation: 'Uniform sampling over an assumption box is a COMPUTATIONAL DESIGN, not a probability distribution over what is true. Every spread reported here is an assumption envelope. None of it is a confidence interval, a credible interval, or a prediction interval.',
  },
  parameterRegister: parameterRegister(),
  base: {
    headlineIndex: baseResult.headlineIndex,
    params: { ...BASE_PARAMS, structuralWeightsRaw: { ...BASE_PARAMS.structuralWeightsRaw }, structuralWeights: { ...BASE_PARAMS.structuralWeights } },
    hazardDeltas: baseResult.hazardDeltas,
  },
  numericalParameters: {
    headlineEnvelope,
    parameterInfluence,
    degenerate: headlineSobol.degenerate,
    varianceOverBox: headlineSobol.variance,
    oneAtATime: oat,
    rankStability: {
      stageOperationalField: stageRank,
      structuralVulnerability: structuralRank,
      companyCriticalityRaw: companyRank,
      networkInfluenceRaw: networkRank,
    },
    scenarioSignStability: scenarioSign,
  },
  modelForms: {
    note: 'Reported SEPARATELY from the numerical parameters: a model form is a different model, not a different value of the same model. Averaging across them would present a choice between structures as if it were noise.',
    options: Object.fromEntries(Object.entries(MODEL_FORMS).map(([k, v]) => [k, { base: v.base, options: [...v.options] }])),
    headlineEnvelope: modelFormEnvelope,
    effects: modelFormEffects,
    rankStability: { stageOperationalField: formStageRank },
    scenarioSignStability: formScenarioSign,
  },
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

const pct = (v) => `${(100 * v).toFixed(1)}%`;
console.log(`\n  base headline index          ${baseResult.headlineIndex.toFixed(4)}`);
console.log(`  numerical assumption envelope [${headlineEnvelope.low.toFixed(4)}, ${headlineEnvelope.high.toFixed(4)}]  width ${headlineEnvelope.width.toFixed(4)}  contains base: ${headlineEnvelope.containsBase}`);
console.log(`  model-form envelope           [${modelFormEnvelope.low.toFixed(4)}, ${modelFormEnvelope.high.toFixed(4)}]  width ${modelFormEnvelope.width.toFixed(4)}  contains base: ${modelFormEnvelope.containsBase}`);
console.log('\n  parameter influence on the headline index (total-order first):');
parameterInfluence.slice(0, 6).forEach((p) => console.log(`    ${p.key.padEnd(34)} S1 ${p.firstOrder.toFixed(3)}   ST ${p.totalOrder.toFixed(3)}`));
console.log('\n  rank stability (Spearman vs base, min / mean):');
console.log(`    stage operational field   ${stageRank.spearmanVsBase.min.toFixed(3)} / ${stageRank.spearmanVsBase.mean.toFixed(3)}`);
console.log(`    structural vulnerability  ${structuralRank.spearmanVsBase.min.toFixed(3)} / ${structuralRank.spearmanVsBase.mean.toFixed(3)}`);
console.log(`    company criticality (raw) ${companyRank.spearmanVsBase.min.toFixed(3)} / ${companyRank.spearmanVsBase.mean.toFixed(3)}`);
console.log('\n  scenario delta sign stability:');
Object.entries(scenarioSign).forEach(([id, s]) => console.log(`    ${id.padEnd(12)} ${s.dominantSign} in ${pct(Math.max(s.positiveShare, s.negativeShare))} of samples — stable: ${s.stable}`));
console.log(`\nWrote ${OUT}`);
