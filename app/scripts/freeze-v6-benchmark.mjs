/* ====================================================================
   freeze-v6-benchmark.mjs — ONE-SHOT, RUN BEFORE THE v7 REDESIGN.

   Captures the complete v6 output surface from the committed snapshot so
   the v6→v7 benchmark has a real, contemporaneous v6 reference to compare
   against after the v6 engine code is gone. The output
   (docs/benchmarks/v6-frozen-benchmark.json) is a FROZEN ARTEFACT: it is
   committed and never regenerated, because after the redesign the code
   that produced it no longer exists. Re-running this script against a v7
   tree will fail loudly rather than silently overwrite v6 history with v7
   numbers.
   ==================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEngine } from '../src/engine/index.js';
import { buildVaultData } from '../src/data/buildVaultData.js';
import { buildModel } from '../src/engine/buildModel.js';
import { MODEL_PRIORS } from '../src/engine/priors.js';
import { hazardFootprint, footprintToHazardScenario } from '../src/engine/facilities.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(here, '../src/data/vault-snapshot.json');
const OUT = resolve(here, '../../docs/benchmarks/v6-frozen-benchmark.json');

if (!MODEL_PRIORS.modelVersion.startsWith('sscim-model-v6')) {
  console.error(`REFUSING: engine reports "${MODEL_PRIORS.modelVersion}", not a v6 engine. This script freezes v6 only.`);
  process.exit(1);
}

const round = (v, n = 8) => (Number.isFinite(v) ? Number(v.toFixed(n)) : v);
const bundle = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const data = buildVaultData(bundle);
const engine = buildEngine({ ...data, datasetAsOf: bundle.meta?.snapshotDate });
const model = buildModel({ data, engine });

/* Hazard scenarios at three fixed coordinates, chosen because each sits on a
   dense modeled cluster: Kumamoto (JP), Hsinchu (TW), Pyeongtaek (KR). */
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
    stageExposure: Object.fromEntries(fp.stages.map((s) => [s.stageId, round(s.exposure)])),
    materialStages: fp.materialStages.map((s) => s.stageId),
    chainIndexDelta: m ? round(m.chainIndexDelta, 6) : null,
    activeChainIndex: m ? round(m.activeChainIndex, 6) : null,
  };
});

const SELECTED_EVENTS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'h2607_kumamoto', 'p260729_web6934',
  'p260729_web57b8', 'h2210_bis', 'h2504_ree', 'h2103_renesas', 'x2510_ports'];

const benchmark = {
  frozen: true,
  generatedAt: new Date().toISOString(),
  modelVersion: MODEL_PRIORS.modelVersion,
  datasetAsOf: engine.MODEL_PRIORS.datasetAsOf,
  snapshotDate: bundle.meta?.snapshotDate ?? null,
  commit: process.env.SSCIM_COMMIT ?? null,
  counts: {
    stages: data.STAGES.length, edges: data.FLOW_EDGES.length, events: data.EVENTS.length,
    policies: data.POLICIES.length, companies: data.COMPANIES.length, facilities: data.FACILITIES.length,
  },
  headline: {
    baselineChainIndex: round(model.baselineChainIndex, 6),
    operationalIndexSigned: round(engine.operationalIndex(model.baselineField), 8),
    envelope: { low: round(model.envelope.low, 6), base: round(model.envelope.base, 6), high: round(model.envelope.high, 6) },
    eventsInWindow: model.eventsInWindow,
  },
  stages: Object.fromEntries(data.STAGES.map((s) => [s.id, {
    structural: round(engine.STRUCTURAL_VULNERABILITY[s.id], 6),
    networkInfluence: round(engine.NETWORK_INFLUENCE[s.id], 6),
    geo: round(engine.GEO_CONCENTRATION[s.id], 6),
    policy: round(engine.POLICY_EXPOSURE[s.id], 6),
    economicWeight: round(engine.ECONOMIC_WEIGHT[s.id], 8),
    operationalField: round(model.baselineField[s.id], 8),
  }])),
  countries: Object.fromEntries(Object.entries(model.countriesBase).map(([c, v]) => [c, {
    structural: round(v.structural, 6), operational: round(v.operational, 8), weight: round(v.weight, 6),
  }])),
  companies: Object.fromEntries(data.COMPANIES.map((c) => [c.id, {
    criticality: round(engine.COMPANY_CRITICALITY[c.id]?.value, 6),
    vulnerability: round(engine.companyVulnerability(c, model.baselineField), 6),
    contribution: round(engine.companyContribution(c, model.baselineField), 8),
  }])),
  events: Object.fromEntries(SELECTED_EVENTS.map((id) => {
    const e = data.EVENTS.find((x) => x.id === id);
    if (!e) return [id, null];
    const { magnitude, assumption } = engine.eventCentralMagnitude(e);
    const { field } = engine.eventField(e);
    return [id, {
      sev: e.sev, daysAgo: e.daysAgo, stages: e.stages, countries: e.countries,
      direction: assumption.direction, channel: assumption.channel, operational: assumption.operational,
      magnitude: round(magnitude, 8),
      field: Object.fromEntries(Object.entries(field).filter(([, v]) => v).map(([k, v]) => [k, round(v, 8)])),
    }];
  })),
  hazards,
  history: engine.HISTORY.map((v) => round(v, 6)),
};

writeFileSync(OUT, `${JSON.stringify(benchmark, null, 2)}\n`);
console.log(`Frozen v6 benchmark → ${OUT}`);
console.log(`  model ${benchmark.modelVersion} · dataset ${benchmark.datasetAsOf} · index ${benchmark.headline.baselineChainIndex}`);
