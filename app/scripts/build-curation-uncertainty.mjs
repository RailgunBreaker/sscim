/* Current curation experiment. Historical v7-curation-uncertainty.json remains
   immutable; this corrected design writes a separate public-review artifact. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { buildEngine } from '../src/engine/index.js';
import { buildVaultData } from '../src/data/buildVaultData.js';
import { buildFacilityLayer, hazardFootprint, footprintToHazardScenario } from '../src/engine/facilities.js';
import { MODEL_VERSION, BASE_PARAMS } from '../src/engine/registry.js';
import { spearman } from '../src/engine/math.js';
import { EVENT_MODEL } from '../src/engine/event-model.js';
import { incidentOf } from '../src/engine/event-assumptions.js';
import { groupIncidents } from '../src/engine/eventSource.js';
import {
  buildCurationDesign, applyCurationScenario, testedScenarioRange, COMPANY_CURATION_LABEL,
  EVIDENCE_BANDS, DEFAULT_EVIDENCE_STRENGTH,
} from '../src/engine/curationUncertainty.js';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, '../src/data/vault-snapshot.json'));
const bundle = JSON.parse(raw.toString('utf8'));
const data = buildVaultData(bundle);
const datasetAsOf = bundle.meta?.snapshotDate;
const out = resolve(here, '../../docs/benchmarks/v7-curation-uncertainty-public-review.json');
const round = (value) => Number(value.toFixed(6));
const design = buildCurationDesign({ events: data.EVENTS });
const layer = buildFacilityLayer(bundle.facilities || [], BASE_PARAMS);
const points = [
  { id: 'kumamoto', lat: 32.8, lng: 130.7, radiusKm: 100, severity: 7 },
  { id: 'hsinchu', lat: 24.8, lng: 121.0, radiusKm: 60, severity: 7 },
  { id: 'pyeongtaek', lat: 37.0, lng: 127.1, radiusKm: 60, severity: 7 },
];
const hazards = points.map((point) => ({ id: point.id,
  scenario: footprintToHazardScenario(hazardFootprint(point, layer), { severity: point.severity }) }));
const topOf = (map, k = 5) => Object.entries(map).sort(([a, av], [b, bv]) => bv - av || a.localeCompare(b)).slice(0, k).map(([id]) => id);

console.log(`SSCIM curation scenarios: ${design.scenarios.length}, fixed seed ${design.seed}, dataset ${datasetAsOf}`);
const results = [];
let baseEngine;
let baseField;
let baseCompany;
for (const [iteration, scenario] of design.scenarios.entries()) {
  const EVENTS = applyCurationScenario(data.EVENTS, scenario);
  const engine = buildEngine({ ...data, EVENTS, datasetAsOf, computeHistory: true });
  const field = engine.operationalField(EVENTS);
  const headline = engine.toDisplayIndex(engine.operationalIndex(field));
  if (!baseEngine) { baseEngine = engine; baseField = field; baseCompany = engine.COMPANY_CRITICALITY_RAW; }
  const peak = engine.LONG_HISTORY.reduce((best, point) => point.index > best.index ? point : best,
    engine.LONG_HISTORY[0] ?? { index: 5, daysAgo: 0 });
  const hazardDeltas = Object.fromEntries(hazards.map(({ id, scenario: hazard }) => {
    const active = hazard ? engine.operationalField([...EVENTS, { ...hazard.event, id: `curation-hazard-${id}` }]) : field;
    return [id, engine.toDisplayIndex(engine.operationalIndex(active)) - headline];
  }));
  const { overrides, ...description } = scenario;
  results.push({ ...description, headline, historicalPeak: { index: peak.index, daysAgo: peak.daysAgo },
    stageSpearmanVsBaseline: spearman(baseField, field), top5Stages: topOf(field), hazardDeltas,
    companyCriticalityUnchanged: Object.keys(baseCompany).every((id) => baseCompany[id] === engine.COMPANY_CRITICALITY_RAW[id]) });
  if ((iteration + 1) % 50 === 0) console.log(`  evaluated ${iteration + 1}/${design.scenarios.length}`);
}
const baseline = results[0];
const baselineTop = baseline.top5Stages;
const influence = groupIncidents(data.EVENTS, { incidentOf }).map((group) => {
  const ids = new Set(group.records.map((record) => record.id));
  const without = baseEngine.toDisplayIndex(baseEngine.operationalIndex(baseEngine.operationalField(data.EVENTS.filter((event) => !ids.has(event.id)))));
  return { incidentId: group.incidentId, primaryId: group.primary.id, records: group.records,
    headlineWithoutIncident: without, baselineMinusWithout: baseline.headline - without };
}).sort((a, b) => Math.abs(b.baselineMinusWithout) - Math.abs(a.baselineMinusWithout));
const sourceStatus = design.incidents.map((incident) => {
  const event = data.EVENTS.find((candidate) => candidate.id === incident.id);
  const { source } = baseEngine.eventField(event);
  return { id: incident.id, incidentId: incident.incidentId, scoredAtSnapshot: source.scored,
    unscoredReason: source.unscoredReason, band: incident.band, hasAlternativeProfile: incident.hasAlternativeProfile };
});
const report = {
  modelVersion: MODEL_VERSION, datasetAsOf,
  snapshotSha256: createHash('sha256').update(raw).digest('hex'),
  uncertaintyClass: 'event curation', reproductionCommand: 'npm run curation',
  separateFrom: {
    numericalParameters: 'Registry-coefficient sampling: v7-sensitivity-public-review.json (numericalParameters); Sobol estimator diagnostics, bootstrap and convergence are separate.',
    modelForm: 'Discrete choices: v7-sensitivity-public-review.json (modelForms).',
    dataCoverage: 'Evidence eligibility, omitted incidents, unknown denominators, sample coverage and legacy assumptions are held fixed here, not quantified as zero.',
  },
  interpretation: 'These classes are not added: dependencies are neither established nor assumed away. Sensitivity indices apply only to their chosen input ranges and sampling design, not total real-world uncertainty.',
  design: {
    seed: design.seed, sampledCoordinates: design.samples, scenarioCount: results.length,
    method: 'Explicit baseline, each primary incident low/high, both opposing-sign corners, each alternative profile, all declared profile subsets crossed with baseline/coupled/opposing exposure settings, per-incident exposure/profile combinations, named shared-assumption groups and fixed-seed shared-factor samples.',
    evidenceBands: EVIDENCE_BANDS, defaultEvidenceStrength: DEFAULT_EVIDENCE_STRENGTH,
    bandInterpretation: 'Relative scope-assumption stress widths, not measured errors or claim verification. Neither these bands nor confidence labels change the factual-baseline exposure.',
    dependencies: design.dependencies, sharedGroups: design.sharedGroups,
    profileSubsetsExhaustive: design.profileSubsetsExhaustive, limitation: design.limitation,
  },
  coverage: {
    curatedRecordsInModel: Object.keys(EVENT_MODEL).length,
    primaryIncidentsInDesign: design.incidents.length,
    individuallyGraded: design.incidents.filter((incident) => EVENT_MODEL[incident.id]?.evidenceStrength).length,
    usingDefaultEvidenceStrength: design.incidents.filter((incident) => !EVENT_MODEL[incident.id]?.evidenceStrength).length,
    usingDerivedExposureBand: design.incidents.filter((incident) => !incident.band.declared).length,
    activeInFactualBaseline: sourceStatus.filter((incident) => incident.scoredAtSnapshot).length,
    excludedOrInactive: sourceStatus.filter((incident) => !incident.scoredAtSnapshot).length,
    incidents: sourceStatus,
    limitation: 'A curation variant never bypasses evidence gating. Zero change for a quarantined or inactive incident is conditional on exclusion/inactivity, not proof that the real incident is immaterial. Uncurated records and missing incidents are outside these exposure bands.',
  },
  results: {
    headlineIndex: testedScenarioRange(results),
    historicalPeak: { ...testedScenarioRange(results, { valueOf: (result) => result.historicalPeak.index }),
      basePeakDaysAgo: baseline.historicalPeak.daysAgo,
      label: 'Current-model retrospective replay peak over tested scenarios; not archived contemporaneous outputs or point-in-time validation. Current curation and current network are used; dated recovery evidence respects its information-available date.' },
    stageRankStability: { minSpearmanVsBaseline: Math.min(...results.map((result) => result.stageSpearmanVsBaseline)),
      baseTop5: baselineTop,
      top5RetentionMin: Math.min(...results.map((result) => result.top5Stages.filter((id) => baselineTop.includes(id)).length / baselineTop.length)),
      interpretation: 'Conditional stability over the tested event-curation scenarios; not empirical validation or robustness to missing data/model inputs.' },
    companyCriticality: { status: 'structurally-unaffected', label: COMPANY_CURATION_LABEL,
      inputsVaried: [], structuralEqualityCheckPassed: results.every((result) => result.companyCriticalityUnchanged),
      relevantUncertainty: 'Requires company-stake/denominator, network, stage-weight and structural-parameter variations. This report makes no robustness claim about that ranking.' },
    scenarioDeltas: Object.fromEntries(points.map((point) => [point.id, {
      ...point, ...testedScenarioRange(results, { valueOf: (result) => result.hazardDeltas[point.id] }),
      signStableAcrossTestedScenarios: results.every((result) => result.hazardDeltas[point.id] > 0) || results.every((result) => result.hazardDeltas[point.id] < 0),
      interpretation: 'Hypothetical radius over the curated facility sample, with analyst ordinal scale; not measured lost capacity or an empirical forecast.',
    }])),
    variants: results,
    incidentInfluence: { interpretation: 'Leave-one-incident-out removes every primary/update/recovery record together. Baseline-minus-without differences are not additive contribution shares.', results: influence },
  },
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Headline ${round(baseline.headline)}; tested range [${round(report.results.headlineIndex.low)}, ${round(report.results.headlineIndex.high)}].`);
console.log(`Wrote ${out}`);
