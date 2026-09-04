/* ====================================================================
   build-curation-uncertainty.mjs — THE THIRD UNCERTAINTY CLASS.

   docs/benchmarks/v7-sensitivity.json varies the model's PARAMETERS and
   its MODEL FORMS. Neither touches what a person wrote down about each
   incident: how much of a stage it touches, and which persistence profile
   it follows. Those judgements were varied by nothing at all, which meant
   the published figures implicitly treated them as exact.

   This varies them, and writes its own artefact, so the three classes stay
   distinguishable:

     parameter uncertainty   docs/benchmarks/v7-sensitivity.json
     model-form uncertainty  docs/benchmarks/v7-sensitivity.json (separate section)
     curation uncertainty    docs/benchmarks/v7-curation-uncertainty.json  <- here

   Run:  npm run curation
   ==================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEngine } from '../src/engine/index.js';
import { buildVaultData } from '../src/data/buildVaultData.js';
import { buildFacilityLayer, hazardFootprint, footprintToHazardScenario } from '../src/engine/facilities.js';
import { MODEL_VERSION, BASE_PARAMS } from '../src/engine/registry.js';
import { spearman } from '../src/engine/math.js';
import { EVENT_MODEL } from '../src/engine/event-model.js';
import {
  curationVariant, curationBands, derivedBandCount, alternativeProfileCount,
  EVIDENCE_BANDS, DEFAULT_EVIDENCE_STRENGTH,
} from '../src/engine/curationUncertainty.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(here, '../src/data/vault-snapshot.json');
const OUT_DIR = resolve(here, '../../docs/benchmarks');
const OUT = resolve(OUT_DIR, 'v7-curation-uncertainty.json');

const bundle = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const data = buildVaultData(bundle);
const datasetAsOf = bundle.meta?.snapshotDate;
const round = (v, n = 6) => (Number.isFinite(v) ? Number(v.toFixed(n)) : v);

const HAZARD_POINTS = [
  { id: 'kumamoto', lat: 32.8, lng: 130.7, radiusKm: 100, severity: 7 },
  { id: 'hsinchu', lat: 24.8, lng: 121.0, radiusKm: 60, severity: 7 },
  { id: 'pyeongtaek', lat: 37.0, lng: 127.1, radiusKm: 60, severity: 7 },
];
const layer = buildFacilityLayer(bundle.facilities || [], BASE_PARAMS);

/* Run the whole model with one curation variant applied. */
function run({ level, useAltProfile }) {
  const overrides = curationVariant({ level, useAltProfile });
  const EVENTS = data.EVENTS.map((e) => (overrides[e.id] ? { ...e, model: overrides[e.id] } : e));
  const scoped = { ...data, EVENTS };
  const engine = buildEngine({ ...scoped, datasetAsOf, computeHistory: true });

  const field = engine.operationalField(EVENTS);
  const headline = engine.toDisplayIndex(engine.operationalIndex(field));

  const hazardDeltas = {};
  for (const p of HAZARD_POINTS) {
    const fp = hazardFootprint(p, layer);
    const scenario = footprintToHazardScenario(fp, { severity: p.severity });
    if (!scenario) { hazardDeltas[p.id] = 0; continue; }
    const active = engine.operationalField([...EVENTS, { ...scenario.event, id: 'hazard' }]);
    hazardDeltas[p.id] = engine.toDisplayIndex(engine.operationalIndex(active)) - headline;
  }

  /* Historical peaks: the highest points of the recomputed long series, and
     where they sit. Curation moves these far more than it moves today. */
  const long = engine.LONG_HISTORY;
  const peak = long.reduce((m, p) => (p.index > m.index ? p : m), long[0] ?? { index: 0, daysAgo: 0 });

  return {
    headline,
    stageField: Object.fromEntries(data.STAGES.map((s) => [s.id, field[s.id] ?? 0])),
    companyCriticalityRaw: { ...engine.COMPANY_CRITICALITY_RAW },
    hazardDeltas,
    historyPeak: { index: peak.index, daysAgo: peak.daysAgo },
    history21: engine.HISTORY.slice(),
  };
}

console.log(`SSCIM curation uncertainty — model ${MODEL_VERSION}, dataset ${datasetAsOf}`);

const base = run({ level: 'base', useAltProfile: false });
const low = run({ level: 'low', useAltProfile: false });
const high = run({ level: 'high', useAltProfile: false });
const altProfiles = run({ level: 'base', useAltProfile: true });

const bands = curationBands();
const graded = Object.entries(EVENT_MODEL).filter(([, c]) => c.evidenceStrength);

const rankReport = (pick) => {
  const b = pick(base);
  const variants = [pick(low), pick(high), pick(altProfiles)];
  const rhos = variants.map((v) => spearman(b, v));
  const topOf = (m, k = 5) => Object.entries(m).sort((a, c) => c[1] - a[1] || (a[0] < c[0] ? -1 : 1)).slice(0, k).map(([id]) => id);
  const baseTop = topOf(b);
  const held = variants.map((v) => topOf(v).filter((id) => baseTop.includes(id)).length / baseTop.length);
  return {
    spearmanVsBase: { min: Math.min(...rhos), values: rhos.map((r) => round(r, 4)) },
    baseTop5: baseTop,
    top5RetentionMin: round(Math.min(...held), 4),
  };
};

const envelope = (vals, b) => ({
  low: round(Math.min(...vals), 6), base: round(b, 6), high: round(Math.max(...vals), 6),
  width: round(Math.max(...vals) - Math.min(...vals), 6),
  kind: 'curation-assumption-envelope',
});

const headlineVals = [low.headline, high.headline, altProfiles.headline];
const peakVals = [low.historyPeak.index, high.historyPeak.index, altProfiles.historyPeak.index];

const scenarioSign = {};
for (const p of HAZARD_POINTS) {
  const vals = [low.hazardDeltas[p.id], high.hazardDeltas[p.id], altProfiles.hazardDeltas[p.id]];
  const all = [base.hazardDeltas[p.id], ...vals];
  scenarioSign[p.id] = {
    base: round(base.hazardDeltas[p.id]),
    envelope: envelope(vals, base.hazardDeltas[p.id]),
    signStable: all.every((v) => v > 0) || all.every((v) => v < 0),
  };
}

const report = {
  modelVersion: MODEL_VERSION,
  datasetAsOf,
  generatedAt: new Date().toISOString(),
  uncertaintyClass: 'event curation',
  separateFrom: [
    'parameter uncertainty — docs/benchmarks/v7-sensitivity.json (numericalParameters)',
    'model-form uncertainty — docs/benchmarks/v7-sensitivity.json (modelForms)',
  ],
  design: {
    method: 'Per-incident exposure vectors moved to the ends of their evidence-strength bands, and declared alternative persistence profiles substituted, one variant at a time.',
    evidenceBands: EVIDENCE_BANDS,
    defaultEvidenceStrength: DEFAULT_EVIDENCE_STRENGTH,
    interpretation: 'These bands are ASSUMPTIONS about how wrong a curated judgement might be, not measurements of how wrong it is. They are deliberately broad. The result is a curation-assumption envelope and is not a confidence interval.',
  },
  coverage: {
    curatedIncidents: Object.keys(EVENT_MODEL).length,
    incidentsWithExposureBand: bands.length,
    individuallyGraded: graded.length,
    usingDefaultBand: derivedBandCount(),
    withAlternativeProfile: alternativeProfileCount(),
    gradedIds: graded.map(([id, c]) => ({ id, evidenceStrength: c.evidenceStrength })),
    limitation: `${Object.keys(EVENT_MODEL).length - graded.length} of ${Object.keys(EVENT_MODEL).length} curated incidents are NOT individually evidence-graded and fall back to the '${DEFAULT_EVIDENCE_STRENGTH}' band. Archived operational incidents outside the curated horizon carry no curated exposure at all and are therefore NOT represented in this analysis — their uncertainty is excluded here, not zero. See docs/benchmarks/v7-legacy-fallback.json.`,
  },
  results: {
    headlineIndex: envelope(headlineVals, base.headline),
    historicalPeak: {
      ...envelope(peakVals, base.historyPeak.index),
      basePeakDaysAgo: base.historyPeak.daysAgo,
      note: 'Curation moves historical peaks considerably more than it moves the current reading, because the incidents driving past peaks are older and their exposure judgements carry the whole signal.',
    },
    stageRankStability: rankReport((r) => r.stageField),
    companyRankStability: rankReport((r) => r.companyCriticalityRaw),
    scenarioDeltas: scenarioSign,
    variants: {
      base: round(base.headline), exposureLow: round(low.headline),
      exposureHigh: round(high.headline), alternativeProfiles: round(altProfiles.headline),
    },
  },
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

console.log(`  headline           base ${round(base.headline)}  [${report.results.headlineIndex.low}, ${report.results.headlineIndex.high}]  width ${report.results.headlineIndex.width}`);
console.log(`  historical peak    base ${round(base.historyPeak.index)}  [${report.results.historicalPeak.low}, ${report.results.historicalPeak.high}]  width ${report.results.historicalPeak.width}`);
console.log(`  stage rank rho     min ${report.results.stageRankStability.spearmanVsBase.min.toFixed(4)}`);
console.log(`  company rank rho   min ${report.results.companyRankStability.spearmanVsBase.min.toFixed(4)}`);
console.log(`  coverage           ${graded.length}/${Object.keys(EVENT_MODEL).length} individually graded, ${alternativeProfileCount()} with an alternative profile`);
Object.entries(scenarioSign).forEach(([id, v]) => console.log(`  scenario ${id.padEnd(11)} ${v.base}  sign stable: ${v.signStable}`));
console.log(`\nWrote ${OUT}`);
