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
const rawData = buildVaultData(bundle);
const snapshotDate = bundle.meta?.snapshotDate;

/* --as-of <YYYY-MM-DD> RE-AGES the record set to a past date, so the
   matched-date comparison against the frozen v6 reference stays
   REPRODUCIBLE after the snapshot advances. Without it this comparison was
   a one-shot artefact: once the dataset moved it could never be
   regenerated, so a mistake inside it (and there was one — a mislabelled
   ablation) could never be corrected either.

   The re-ageing is the engine's own back-dating rule, not a second
   implementation: an incident's age at date t is (daysAgo - t), and
   incidents dated after t are excluded because they had not happened. */
const asOfArg = (() => {
  const i = process.argv.indexOf('--as-of');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const dayDiff = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

let data = rawData;
let datasetAsOf = snapshotDate;
let backDatedBy = 0;
if (asOfArg) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfArg)) { console.error(`--as-of expects YYYY-MM-DD, got "${asOfArg}"`); process.exit(1); }
  backDatedBy = dayDiff(snapshotDate, asOfArg);
  if (backDatedBy < 0) { console.error(`--as-of ${asOfArg} is AFTER the snapshot date ${snapshotDate}; the record set does not exist yet.`); process.exit(1); }
  const shifted = rawData.EVENTS
    .filter((e) => (e.daysAgo ?? 0) - backDatedBy >= 0)
    .map((e) => ({ ...e, daysAgo: (e.daysAgo ?? 0) - backDatedBy }));
  data = { ...rawData, EVENTS: shifted };
  datasetAsOf = asOfArg;
}

const engine = buildEngine({ ...data, datasetAsOf });
const model = buildModel({ data, engine });

/* THE COMPARISON IS ONLY INTERPRETABLE AT A MATCHED DATASET DATE.

   The v6 reference was frozen from the v6 engine at one dataset date, and
   the v6 engine no longer exists, so it can never be re-frozen at another.
   Once the snapshot advances, recomputing this file would silently turn a
   MODEL comparison into a model-and-data comparison: every difference
   would carry an unknown mixture of "v7 computes this differently" and
   "the records are six days older", with no way for a reader to separate
   them.

   A warning was not enough — it printed above a file that then got
   overwritten anyway, and the overwritten file looked exactly as
   authoritative as the good one. So this now REFUSES, leaves the
   matched-date artefact untouched, and exits cleanly: nothing is wrong,
   the comparison simply is not recomputable at this date and the valid one
   is already committed.

   --allow-date-mismatch forces it, into a separate, clearly named file. */
const ALLOW_MISMATCH = process.argv.includes('--allow-date-mismatch');
const DATE_MISMATCH = v6.datasetAsOf !== datasetAsOf;

if (DATE_MISMATCH && !ALLOW_MISMATCH) {
  console.log('SSCIM v6 -> v7 benchmark — SKIPPED, and the committed comparison is left untouched.');
  console.log(`  The frozen v6 reference is dated ${v6.datasetAsOf}; this run is at ${datasetAsOf}.`);
  console.log(`  To regenerate the matched-date comparison, re-age the record set:  npm run benchmark -- --as-of ${v6.datasetAsOf}`);
  console.log('  Recomputing now would mix the v6->v7 MODEL change with a DATA change, and the two would be');
  console.log('  inseparable in every number. The v6 engine is gone, so the reference cannot be re-frozen at the');
  console.log(`  new date either. ${OUT.split(/[\\/]/).pop()} therefore remains the matched-date comparison, at ${v6.datasetAsOf}.`);
  console.log('  Pass --allow-date-mismatch to write a clearly-labelled cross-date file alongside it.');
  process.exit(0);
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
/* `params` is recorded in the output, not just applied. The v7.0 benchmark
   labelled one experiment "a 12-day market half-life" while actually running
   21 and 7 days — a label that described an experiment nobody ran. The
   recorded parameters make that checkable, and benchmarkLabels.test.js
   fails the build if a label and its parameters disagree. */
const ablation = (label, params, note) => {
  const e = buildEngine({ ...data, datasetAsOf, params, computeHistory: false });
  return {
    label,
    note,
    params: params ?? {},
    headlineIndex: round(e.toDisplayIndex(e.operationalIndex(e.operationalField(data.EVENTS)))),
  };
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
    'This is the closest setting to v6\'s EFFECTIVE weighting. v6 stored max-normalized log1p weights, which did not themselves sum '
    + 'to one — but the headline index divided by their sum, so the normalization happened downstream and the effective v6 weighting '
    + 'was simply proportional to log1p(turnover). The substantive v7 change is therefore from effective LOG-turnover weighting to '
    + 'RAW-turnover weighting, not from unnormalized weights to normalized ones.'),
  ablation('v7 with every exponential half-life set to 12 days', { marketHalfLifeDays: 12, acuteHalfLifeDays: 12 },
    'Both exponential classes set to v6\'s single 12-day half-life, which is the closest a PARAMETER change can come to v6 persistence. '
    + 'It is NOT a reconstruction of v6, and the remaining differences are model form rather than parameter value: incidents on the '
    + 'outage_recovery profile still decline along a staged linear schedule instead of decaying, incidents on persistent_policy are '
    + 'still in force or not rather than fading, and strategic_context incidents are still unscored. v6 had none of those profiles — '
    + 'it decayed every class exponentially at 12 days. This ablation therefore isolates MOST of the persistence effect, not all of it.'),
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
  to: {
    modelVersion: MODEL_VERSION,
    datasetAsOf,
    snapshotDate,
    backDatedByDays: backDatedBy,
    backDatingNote: backDatedBy
      ? `The committed snapshot is dated ${snapshotDate}. Every incident was re-aged back ${backDatedBy} day(s) using the engine's own back-dating rule, and incidents dated after ${datasetAsOf} were excluded, so this is a MATCHED-DATE model comparison against the frozen v6 reference.`
      : 'Run directly against the committed snapshot with no back-dating.',
  },
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
      evidence: 'ablations["v7 with every exponential half-life set to 12 days"] — and note that ablation is not a v6 reconstruction; see its own note.',
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
      change: 'Stage weighting moves from effective LOG-turnover to RAW turnover',
      direction: 'changes the headline weighting AND every weight-derived measure — network influence moves the most of any published number',
      why: 'The v6 stored weights were a max-normalized log1p transform and did not sum to one, but that is not the substantive difference: the headline index divided by their sum, so the normalization happened downstream and the EFFECTIVE v6 weighting was proportional to log1p(turnover). v7 weights by raw turnover normalized to a partition of one. The real change is therefore the TRANSFORM, not the normalization — and the transform matters a great deal, because log1p compresses the range hard: final systems (500B) and photoresists (3B) differ by about 4.5x in effective v6 weight and about 167x in v7. Network influence sums the propagated field against these weights, so it re-ranks accordingly, and structural vulnerability moves with it. Normalizing directly is still what makes the country chain contributions reconcile to the headline index exactly. This is a change in the WEIGHTING, not in any stage field: the operational field per stage is unaffected by it.',
      evidence: 'stages[].economicWeight, stages[].networkInfluence, summaryOfDifferences.stageNetworkInfluence',
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

const target = DATE_MISMATCH ? OUT.replace(/\.json$/, '-CROSS-DATE.json') : OUT;
if (DATE_MISMATCH) {
  report.crossDateWarning = `NOT A CLEAN MODEL COMPARISON. The v6 reference is dated ${v6.datasetAsOf} and this snapshot is ${engine.MODEL_PRIORS.datasetAsOf}, so every difference below mixes the v6->v7 model change with ${'the data change between those dates'}. The matched-date comparison, which is the interpretable one, is in v6-to-v7-benchmark.json.`;
  report.matchedDateComparison = 'docs/benchmarks/v6-to-v7-benchmark.json';
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);

console.log(`SSCIM v6 -> v7 benchmark`);
console.log(`  from ${report.from.modelVersion} (${report.from.datasetAsOf})`);
console.log(`  to   ${report.to.modelVersion} (${report.to.datasetAsOf})`);
console.log(`  headline index  ${report.headline.v6}  ->  ${report.headline.v7}   (${report.headline.delta >= 0 ? '+' : ''}${report.headline.delta})`);
console.log('  ablations:');
ablations.forEach((a) => console.log(`    ${a.label.padEnd(58)} ${a.headlineIndex}`));
console.log('  hazard scenario deltas (v6 -> v7):');
hazards.forEach((h) => console.log(`    ${h.id.padEnd(12)} ${h.v6.chainIndexDelta} -> ${h.v7.chainIndexDelta}   (${h.v6.materialStages} material stages -> ${h.v7.scoredStages} scored, ${h.v7.belowDisplayThreshold} below the display threshold)`));
console.log(`\nWrote ${target}`);
