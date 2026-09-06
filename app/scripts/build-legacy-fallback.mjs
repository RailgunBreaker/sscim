/* ====================================================================
   build-legacy-fallback.mjs — HOW MUCH OF THE HISTORY RESTS ON DEFAULTS.

   49 archived operational incidents carry no curated stage exposure and no
   curated persistence profile. They fall back to an equal 1/k allocation
   across their tagged stages and to the acute exponential profile.

   v7.0 documentation said those fallbacks "cannot move a published number
   materially". That is true of the CURRENT snapshot, where the incidents
   are years old, and false of the HISTORICAL series, where they are the
   signal. The distinction was not being drawn, so this quantifies it:

     · how many fallback incidents contribute at each historical date;
     · what the historical peaks do when the fallback assumptions move;
     · which periods are fully curated and which are legacy-assisted.

   Run:  npm run legacy
   ==================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildEngine } from '../src/engine/index.js';
import { buildVaultData } from '../src/data/buildVaultData.js';
import { MODEL_VERSION } from '../src/engine/registry.js';
import { EVENT_MODEL, ACTIVE_HORIZON_DAYS } from '../src/engine/event-model.js';
import { getEventAssumption } from '../src/engine/event-assumptions.js';
import { uniqueStages } from '../src/engine/eventSource.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = resolve(here, '../src/data/vault-snapshot.json');
const OUT_DIR = resolve(here, '../../docs/benchmarks');
const OUT = resolve(OUT_DIR, 'v7-legacy-fallback-public-review.json');

const bundle = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const data = buildVaultData(bundle);
const datasetAsOf = bundle.meta?.snapshotDate;
const round = (v, n = 6) => (Number.isFinite(v) ? Number(v.toFixed(n)) : v);

/* Which records are operational but NOT curated — i.e. running on
   fallbacks for both exposure and persistence. */
const fallbackRecords = data.EVENTS.filter((e) => {
  const a = getEventAssumption(e.id);
  return a.operational && !EVENT_MODEL[e.id] && uniqueStages(e).length > 0;
});
const fallbackIds = new Set(fallbackRecords.map((e) => e.id));

/* Fallback variants. The equal 1/k split is one choice among many; these
   bracket it by concentrating or dispersing the same unit of exposure, and
   by swapping the assumed persistence profile. Each is applied ONLY to the
   uncurated records, so the curated set is held fixed. */
function variantModel(kind) {
  const out = {};
  for (const e of fallbackRecords) {
    const stages = uniqueStages(e);
    const k = stages.length;
    let exposure;
    if (kind === 'concentrated') {
      // All exposure on the first-listed stage: the least dispersed reading.
      exposure = Object.fromEntries(stages.map((sid, i) => [sid, i === 0 ? 1 : 0.0001]));
    } else if (kind === 'halved') {
      exposure = Object.fromEntries(stages.map((sid) => [sid, 0.5 / k]));
    } else if (kind === 'doubled') {
      exposure = Object.fromEntries(stages.map((sid) => [sid, Math.min(1, 2 / k)]));
    } else {
      exposure = Object.fromEntries(stages.map((sid) => [sid, 1 / k]));
    }
    const profile = kind === 'marketProfile' ? { kind: 'market_exponential' } : { kind: 'acute_exponential' };
    if (kind === 'marketProfile') exposure = Object.fromEntries(stages.map((sid) => [sid, 1 / k]));
    out[e.id] = { exposure, exposureBasis: `legacy fallback variant: ${kind}`, profile, profileBasis: `legacy fallback variant: ${kind}` };
  }
  return out;
}

/* The GLOBAL peak of the series is not the right measure of fallback
   dependence: on this snapshot it sits 28 days ago among fully curated
   incidents, so it is unmoved by fallback assumptions BY CONSTRUCTION.
   What depends on the fallbacks is the peak of the LEGACY ERA — the part
   of the series older than the curated horizon, where every contributing
   incident is uncurated. Both are reported, because quoting only the
   global peak is what made the original "immaterial" claim look true. */
const LEGACY_ERA_FROM_DAYS = ACTIVE_HORIZON_DAYS;

function run(kind) {
  const overrides = kind === 'base' ? {} : variantModel(kind);
  const EVENTS = data.EVENTS.map((e) => (overrides[e.id] ? { ...e, model: overrides[e.id] } : e));
  const engine = buildEngine({ ...data, EVENTS, datasetAsOf, computeHistory: true });
  const long = engine.LONG_HISTORY;
  const peakOf = (points) => points.reduce((m, p) => (p.index > m.index ? p : m), points[0] ?? { index: 0, daysAgo: 0 });
  return {
    headline: engine.toDisplayIndex(engine.operationalIndex(engine.operationalField(EVENTS))),
    peak: peakOf(long),
    legacyPeak: peakOf(long.filter((p) => p.daysAgo >= LEGACY_ERA_FROM_DAYS)),
    long,
    engine,
  };
}

console.log(`SSCIM legacy fallback exposure — model ${MODEL_VERSION}, dataset ${datasetAsOf}`);

const base = run('base');
const variants = ['halved', 'doubled', 'concentrated', 'marketProfile'].map((k) => ({ kind: k, ...run(k) }));

/* Per-period fallback participation: at each sampled historical date, how
   many CONTRIBUTING incidents are running on fallbacks. */
const engine = base.engine;
const periods = base.long.map((point) => {
  const active = engine.eventsAsOf(point.daysAgo);
  const scored = active.filter((e) => engine.eventField(e).scored);
  const fb = scored.filter((e) => fallbackIds.has(e.id));
  return {
    daysAgo: point.daysAgo,
    index: round(point.index),
    contributingIncidents: scored.length,
    fallbackIncidents: fb.length,
    fallbackShare: scored.length ? round(fb.length / scored.length, 4) : 0,
    curationStatus: fb.length === 0 ? 'no-active-fallback-evidence-coverage-limited' : 'legacy-assisted',
  };
});

const legacyAssisted = periods.filter((p) => p.curationStatus === 'legacy-assisted');
const peakVals = variants.map((v) => v.peak.index);
const legacyPeakVals = variants.map((v) => v.legacyPeak.index);

const report = {
  modelVersion: MODEL_VERSION,
  datasetAsOf,
  generatedAt: new Date().toISOString(),
  whatThisMeasures: 'Current-model retrospective replay dependence on fallback assumptions, conditional on evidence eligibility. This is not point-in-time validation.',
  correctionToEarlierClaim: 'Earlier experiments are preserved in v7-legacy-fallback.json. In this data revision unresolved claims are excluded; zero variation caused by exclusion is a coverage limitation, not evidence that historical disruptions were immaterial.',
  fallbackPopulation: {
    operationalRecordsWithoutCuration: fallbackRecords.length,
    curatedIncidents: Object.keys(EVENT_MODEL).length,
    curatedHorizonDays: ACTIVE_HORIZON_DAYS,
    exposureFallback: 'equal 1/k across the k unique tagged stages',
    profileFallback: 'acute_exponential',
  },
  variantsTested: {
    halved: 'each fallback incident carries half the default exposure',
    doubled: 'each fallback incident carries twice the default exposure, capped at 1',
    concentrated: 'the whole unit of exposure placed on one stage instead of split across k',
    marketProfile: 'the assumed persistence profile swapped from acute to market',
  },
  currentSnapshot: {
    base: round(base.headline),
    variants: Object.fromEntries(variants.map((v) => [v.kind, round(v.headline)])),
    spread: round(Math.max(...variants.map((v) => v.headline)) - Math.min(...variants.map((v) => v.headline))),
    reading: 'Conditional on evidence eligibility and the current network. Missing historical claims are excluded; neutral or invariant results do not establish historical safety or empirical validation.',
  },
  globalPeak: {
    base: round(base.peak.index),
    basePeakDaysAgo: base.peak.daysAgo,
    variants: Object.fromEntries(variants.map((v) => [v.kind, round(v.peak.index)])),
    spread: round(Math.max(...peakVals, base.peak.index) - Math.min(...peakVals, base.peak.index)),
    reading: 'Conditional on evidence eligibility and the current network. Missing historical claims are excluded; neutral or invariant results do not establish historical safety or empirical validation.',
  },
  legacyEraPeak: {
    fromDaysAgo: LEGACY_ERA_FROM_DAYS,
    base: round(base.legacyPeak.index),
    basePeakDaysAgo: base.legacyPeak.daysAgo,
    variants: Object.fromEntries(variants.map((v) => [v.kind, round(v.legacyPeak.index)])),
    low: round(Math.min(...legacyPeakVals, base.legacyPeak.index)),
    high: round(Math.max(...legacyPeakVals, base.legacyPeak.index)),
    spread: round(Math.max(...legacyPeakVals, base.legacyPeak.index) - Math.min(...legacyPeakVals, base.legacyPeak.index)),
    reading: 'Conditional on evidence eligibility and the current network. Missing historical claims are excluded; neutral or invariant results do not establish historical safety or empirical validation.',
  },
  periodCuration: {
    sampled: periods.length,
    fullyCurated: periods.length - legacyAssisted.length,
    legacyAssisted: legacyAssisted.length,
    maxFallbackShare: round(Math.max(...periods.map((p) => p.fallbackShare)), 4),
    note: 'A date is "legacy-assisted" when at least one incident contributing to it runs on fallback assumptions. Charts must distinguish these from fully curated dates.',
  },
  periods,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

console.log(`  uncurated operational records: ${fallbackRecords.length}`);
console.log(`  current snapshot  base ${report.currentSnapshot.base}  spread across fallback variants ${report.currentSnapshot.spread}`);
console.log(`  global peak       base ${report.globalPeak.base} at ${report.globalPeak.basePeakDaysAgo}d  spread ${report.globalPeak.spread} (fully curated — unmoved by construction)`);
console.log(`  legacy-era peak   base ${report.legacyEraPeak.base} at ${report.legacyEraPeak.basePeakDaysAgo}d  [${report.legacyEraPeak.low}, ${report.legacyEraPeak.high}]  spread ${report.legacyEraPeak.spread}`);
console.log(`  sampled dates     ${report.periodCuration.fullyCurated} fully curated · ${report.periodCuration.legacyAssisted} legacy-assisted (max fallback share ${report.periodCuration.maxFallbackShare})`);
console.log(`\nWrote ${OUT}`);
