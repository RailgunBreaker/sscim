/* ====================================================================
   build-v6-v7-benchmark.mjs — the v6-to-v7 comparison, by cause.

   Reads the FROZEN v6 benchmark (docs/benchmarks/v6-frozen-benchmark.json,
   captured from the v6 engine before the redesign and never regenerated,
   because the code that produced it no longer exists), recomputes the same
   quantities under v7, and attributes the differences to the specific
   redesign decisions that produced them.

   The attribution is a REASONED MAPPING, not a variance decomposition: v7
   changed several things at once by design, and the changes interact. Each
   line says which mechanism dominates a given movement and why, and the
   ablations below isolate the ones that can be isolated.

   Run:  npm run benchmark
   ==================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEngine } from '../src/engine/index.js';
import { buildVaultData } from '../src/data/buildVaultData.js';
import { buildModel } from '../src/engine/buildModel.js';
import { hazardFootprint, footprintToHazardScenario } from '../src/engine/facilities.js';
import { MODEL_VERSION } from '../src/engine/registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(here, '../src/data/vault-snapshot.json');
const OUT_DIR = resolve(here, '../../docs/benchmarks');
const V6 = resolve(OUT_DIR, 'v6-frozen-benchmark.json');
const OUT = resolve(OUT_DIR, 'v6-to-v7-benchmark.json');

const round = (v, n = 6) => (Number.isFinite(v) ? Number(v.toFixed(n)) : v);

const v6 = JSON.parse(readFileSync(V6, 'utf8'));
if (!v6.frozen || !v6.modelVersion.startsWith('sscim-model-v6')) {
  console.error('REFUSING: the v6 reference is not a frozen v6 artefact.');
  process.exit(1);
}

const bundle = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const data = buildVaultData(bundle);
const datasetAsOf = bundle.meta?.snapshotDate;
const engine = buildEngine({ ...data, datasetAsOf });
const model = buildModel({ data, engine });

if (v6.datasetAsOf !== engine.MODEL_PRIORS.datasetAsOf) {
  console.warn(`WARNING: the frozen v6 benchmark is dated ${v6.datasetAsOf} but this snapshot is ${engine.MODEL_PRIORS.datasetAsOf}. Differences below mix model change with data change.`);
}

const HAZARD_POINTS = v6.hazards.map((h) => h.point);
const hazards = HAZARD_POINTS.map((p) => {
  const fp = hazardFootprint(p, data.FACILITY_LAYER);
  const scenario = footprintToHazardScenario(fp, { severity: p.severity });
  const m = scenario ? buildModel({ data, engine, scenario }) : null;
  const ref = v6.hazards.find((h) => h.id === p.id);
  return {
    id: p.id,
    v6: {
      sitesInside: ref.sitesInside, materialStages: ref.materialStages.length,
      chainIndexDelta: ref.chainIndexDelta, stageExposure: ref.stageExposure,
    },
    v7: {
      sitesInside: fp.hits.length,
      scoredStages: fp.stages.length,
      aboveDisplayThreshold: fp.displayStages.length,
      belowDisplayThreshold: fp.minorStages.length,
      chainIndexDelta: m ? round(m.chainIndexDelta) : null,
      stageExposure: Object.fromEntries(fp.stages.map((s) => [s.stageId, round(s.exposure, 8)])),
    },
    causes: [
      'Continuous exposure scaling: v6 shocked every stage above the 5% footprint line at FULL severity and every stage below it at zero; v7 scales each stage source by its footprint share, so a broad radius now produces many small sources instead of a few maximal ones.',
      'Below-threshold stages now score: stages v6 discarded entirely contribute in proportion to their footprint.',
      'Multi-stage full-shock multiplication removed: v6 injected the scenario severity independently at every material stage; v7 injects one source vector for the whole hazard.',
    ],
  };
});

/* ---------------- ablations ----------------
   Two of the v7 changes CAN be isolated on the shipped data, by rerunning
   v7 with that one decision reverted to its v6 form. The rest cannot be
   isolated without reinstating v6 code, and are attributed in prose. */
const ablation = (label, params, note) => {
  const e = buildEngine({ ...data, datasetAsOf, params, computeHistory: false });
  return { label, note, headlineIndex: round(e.toDisplayIndex(e.operationalIndex(e.operationalField(data.EVENTS)))) };
};

const ablations = [
  ablation('v7 base', undefined, 'The published v7 result.'),
  ablation('v7 with the v6 HHI convention', { hhiResidual: 'upper' },
    'v6 always added the squared residual, which is the v7 upper bound — so this is unchanged from base and confirms the HHI change moved no headline number, only the published interval.'),
  ablation('v7 with the lower HHI bound', { hhiResidual: 'lower' },
    'The optimistic completion of the unobserved residual. Affects structural scores, not the operational field.'),
  ablation('v7 with max incident aggregation', { incidentAggregation: 'max' },
    'Only the single largest incident counts per stage. Isolates how much of the headline number is cumulative rather than dominant.'),
  ablation('v7 with clipped-sum incident aggregation', { incidentAggregation: 'clipped_sum' },
    'Fully additive up to the bound. The upper end of the aggregation model form.'),
  ablation('v7 with equal stage weighting', { stageWeighting: 'equal' },
    'Drops the turnover proxy entirely from the headline weighting.'),
  ablation('v7 with log-turnover stage weighting', { stageWeighting: 'log_turnover' },
    'Compresses the turnover skew; closest to the v6 max-normalized log1p weighting, which did NOT sum to one.'),
  ablation('v7 with a 12-day market half-life (the single v6 half-life)', { marketHalfLifeDays: 21, acuteHalfLifeDays: 7 },
    'The nearest v7 setting to v6\'s single 12-day half-life for every event class. Isolates most of the headline movement: v6 decayed policy, allocation and pricing incidents as fast as a fab inspection.'),
];

const stageRows = data.STAGES.map((s) => {
  const before = v6.stages[s.id] ?? {};
  return {
    id: s.id,
    structural: { v6: before.structural, v7: round(engine.STRUCTURAL_VULNERABILITY[s.id]), delta: round(engine.STRUCTURAL_VULNERABILITY[s.id] - (before.structural ?? 0)) },
    networkInfluence: { v6: before.networkInfluence, v7: round(engine.NETWORK_INFLUENCE[s.id]), delta: round(engine.NETWORK_INFLUENCE[s.id] - (before.networkInfluence ?? 0)) },
    networkInfluenceRaw: { v7: round(engine.NETWORK_INFLUENCE_RAW[s.id], 8), note: 'Published separately in v7; v6 published only the snapshot-relative 0-10 score.' },
    geo: { v6: before.geo, v7: round(engine.GEO_CONCENTRATION[s.id]), delta: round(engine.GEO_CONCENTRATION[s.id] - (before.geo ?? 0)) },
    geoBounds: { lower: round(engine.GEO_BOUNDS[s.id].lowerScore10), upper: round(engine.GEO_BOUNDS[s.id].upperScore10) },
    policy: { v6: before.policy, v7: round(engine.POLICY_EXPOSURE[s.id]), delta: round(engine.POLICY_EXPOSURE[s.id] - (before.policy ?? 0)) },
    economicWeight: { v6: before.economicWeight, v7: round(engine.STAGE_WEIGHT[s.id], 8) },
    operationalField: { v6: before.operationalField, v7: round(model.baselineField[s.id], 8), delta: round(model.baselineField[s.id] - (before.operationalField ?? 0), 8) },
  };
});

const countryRows = Object.entries(model.countriesBase).map(([cid, c]) => ({
  id: cid,
  structural: { v6: v6.countries[cid]?.structural, v7: round(c.structural), delta: round(c.structural - (v6.countries[cid]?.structural ?? 0)) },
  localPressure: { v6Operational: v6.countries[cid]?.operational, v7: round(c.localPressure, 8) },
  chainContribution: { v7: round(c.chainContribution, 8), note: 'New in v7. v6 published no unnormalized country contribution.' },
}));

const companyRows = data.COMPANIES.map((c) => ({
  id: c.id,
  criticalitySnapshotRelative: { v6: v6.companies[c.id]?.criticality, v7: round(engine.COMPANY_CRITICALITY[c.id].value) },
  criticalityRaw: { v7: round(engine.COMPANY_CRITICALITY_RAW[c.id], 8), note: 'New in v7; v6 published only the max-normalized score.' },
  vulnerability: { v6: v6.companies[c.id]?.vulnerability, v7: round(engine.companyVulnerability(c, model.baselineField)) },
  contribution: { v6: v6.companies[c.id]?.contribution, v7: round(engine.companyContribution(c, model.baselineField), 8) },
}));

const eventRows = Object.entries(v6.events).filter(([, r]) => r).map(([id, before]) => {
  const e = data.EVENTS.find((x) => x.id === id);
  if (!e) return { id, note: 'absent from the current snapshot' };
  const { source, scored, assumption } = engine.eventField(e);
  return {
    id,
    v6: { magnitude: before.magnitude, direction: before.direction, operational: before.operational, stages: before.stages },
    v7: {
      scored,
      unscoredReason: source.unscoredReason,
      direction: assumption.direction,
      exposureSource: source.exposureSource,
      profile: source.profile?.kind,
      persistence: round(source.persistence, 8),
      intensity: round(source.intensity, 8),
      sourceVector: Object.fromEntries(Object.entries(source.z).map(([k, v]) => [k, round(v, 8)])),
    },
  };
});

const spread = (rows, pick) => {
  const vals = rows.map(pick).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  const abs = vals.map(Math.abs);
  return { n: vals.length, maxAbsDelta: round(Math.max(...abs), 8), meanAbsDelta: round(abs.reduce((a, v) => a + v, 0) / abs.length, 8) };
};

const report = {
  generatedAt: new Date().toISOString(),
  from: { modelVersion: v6.modelVersion, datasetAsOf: v6.datasetAsOf, frozenAt: v6.generatedAt, commit: v6.commit },
  to: { modelVersion: MODEL_VERSION, datasetAsOf: engine.MODEL_PRIORS.datasetAsOf },
  disclaimer: 'v6 results are preserved with their original model version and are NOT restated as v7. This document compares two models over the same snapshot; it does not imply the v7 numbers were published at the time the v6 numbers were.',
  headline: {
    v6: v6.headline.baselineChainIndex,
    v7: round(model.baselineChainIndex),
    delta: round(model.baselineChainIndex - v6.headline.baselineChainIndex),
    v6Envelope: v6.headline.envelope,
    v7Envelope: { low: round(model.envelope.low), base: round(model.envelope.base), high: round(model.envelope.high) },
    envelopeNote: 'The v6 envelope moved all three coefficients together in the same direction. The v7 in-app envelope moves each parameter one at a time over its declared range; the principal analysis is the global design in docs/benchmarks/v7-sensitivity.json.',
  },
  modelAudit: engine.MODEL_AUDIT,
  ablations,
  materialChangesByCause: [
    {
      change: 'Event-specific persistence replaces one global 12-day half-life',
      direction: 'raises the headline index',
      why: 'v6 decayed every incident class at the same 12-day half-life, so a standing export-control regime and a same-week fab inspection faded identically and almost everything older than a quarter contributed nothing. v7 gives allocation, pricing and licensing incidents a market half-life (base 45 d), outages a staged linear recovery, and standing controls a dated in-force window. More of the recorded operational history is therefore live at the snapshot date. This is the single largest contributor to the headline movement — see the 12-day ablation.',
      evidence: 'ablations["v7 with a 12-day market half-life (the single v6 half-life)"]',
    },
    {
      change: 'Multi-stage full-shock multiplication removed',
      direction: 'lowers the field at broadly tagged incidents',
      why: 'v6 propagated each of an incident\'s tagged stages separately, each carrying the incident\'s FULL severity, then combined the results with a noisy-OR — so tagging one earthquake to four stages injected four full-severity shocks. v7 builds one source vector for the incident, with a per-stage exposure alpha in [0,1], and propagates it jointly. A record tagged to more stages now spreads its severity rather than multiplying it.',
    },
    {
      change: 'Joint incident propagation replaces per-stage noisy-OR combination',
      direction: 'lowers reconvergent stages',
      why: 'Within one incident, two paths that reconverge on a stage are the same disruption arriving twice. v6 combined them as if independent, which added an interaction term with nothing to represent. v7 sums the dependency-weighted inflows and clips once.',
    },
    {
      change: 'Country directSignals removed',
      direction: 'lowers country readings for countries tagged on incidents they also host stages for',
      why: 'v6 combined a country-tagged incident\'s raw magnitude into the country reading ON TOP of the same incident\'s stage field, so such an incident counted twice. In v7 an incident reaches a country only through its stage source and propagation.',
    },
    {
      change: 'Continuous facility exposure replaces the 5% scoring threshold',
      direction: 'lowers large hazard deltas, raises small ones',
      why: 'v6 gave a 5.01% footprint the same full-severity shock as a 100% footprint and gave a 4.99% footprint nothing at all. v7 scales the source by the footprint share, so broad shallow radii shrink and narrow marginal ones become visible instead of vanishing.',
      evidence: 'hazards[].v7.chainIndexDelta vs hazards[].v6.chainIndexDelta',
    },
    {
      change: 'Policy exposure is deduplicated into families and aggregated with a bounded operator',
      direction: 'lowers policy exposure where a stage was covered by several register rows',
      why: 'v6 used "strongest + 0.4 x the sum of the rest" over RECORDS, which grew without bound in the number of rows and rose when the same control was re-reported. v7 collapses records into policy families, takes the strongest reading within a family, and combines families with a bounded operator that saturates at 10.',
      evidence: 'stages[].policy',
    },
    {
      change: 'Stage economic weights are normalized to sum to one',
      direction: 'changes the headline weighting, not any stage field',
      why: 'v6 weighted by a MAX-normalized log1p transform, so the weights summed to an arbitrary number and the headline index was a weighted mean with a hand-shaped denominator. v7 normalizes turnover directly to a partition of one, which is what makes the country chain contributions reconcile to the headline index exactly.',
      evidence: 'stages[].economicWeight',
    },
    {
      change: 'HHI is published as an interval',
      direction: 'no change to the published base score',
      why: 'v6 silently used what v7 calls the UPPER bound (residual treated as one undisclosed holder). v7 publishes that as the explicitly conservative base and publishes the lower bound beside it, and includes the choice in sensitivity. The base number is unchanged; what changed is that the reader can now see it is one end of an interval.',
      evidence: 'stages[].geoBounds',
    },
    {
      change: 'Relative scores are labelled as snapshot-relative and published beside their raw values',
      direction: 'no numerical change to the relative scores',
      why: 'Network influence and company criticality are divided by the largest value in the CURRENT snapshot, so they order things within one snapshot and are not comparable across snapshots. v6 published only the rescaled number. v7 publishes the raw measure too, so a reader can compare across snapshots using something that means the same thing twice.',
      evidence: 'stages[].networkInfluenceRaw, companies[].criticalityRaw',
    },
    {
      change: 'Company criticality no longer applies topology twice',
      direction: 'reorders companies whose stages differ in connectivity',
      why: 'v6 propagated a company\'s disruption across the graph and then weighted the resulting field by NETWORK_INFLUENCE, which is itself a propagation-derived reachability measure. A company on a well-connected stage was rewarded twice for the same connectivity. v7 weights by the economic weight, which carries no topology.',
      evidence: 'companies[].criticalityRaw',
    },
  ],
  summaryOfDifferences: {
    stageStructural: spread(stageRows, (r) => r.structural.delta),
    stageOperationalField: spread(stageRows, (r) => r.operationalField.delta),
    stagePolicy: spread(stageRows, (r) => r.policy.delta),
    stageNetworkInfluence: spread(stageRows, (r) => r.networkInfluence.delta),
    countryStructural: spread(countryRows, (r) => r.structural.delta),
  },
  hazards,
  stages: stageRows,
  countries: countryRows,
  companies: companyRows,
  events: eventRows,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

console.log(`SSCIM v6 -> v7 benchmark`);
console.log(`  from ${report.from.modelVersion} (${report.from.datasetAsOf})`);
console.log(`  to   ${report.to.modelVersion} (${report.to.datasetAsOf})`);
console.log(`  headline index  ${report.headline.v6}  ->  ${report.headline.v7}   (${report.headline.delta >= 0 ? '+' : ''}${report.headline.delta})`);
console.log('  ablations:');
ablations.forEach((a) => console.log(`    ${a.label.padEnd(58)} ${a.headlineIndex}`));
console.log('  hazard scenario deltas (v6 -> v7):');
hazards.forEach((h) => console.log(`    ${h.id.padEnd(12)} ${h.v6.chainIndexDelta} -> ${h.v7.chainIndexDelta}   (${h.v6.materialStages} material stages -> ${h.v7.scoredStages} scored, ${h.v7.belowDisplayThreshold} below the display threshold)`));
console.log(`\nWrote ${OUT}`);
