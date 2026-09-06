/* Reproduce the audited revision from git objects, never the corrected worktree.
   This writes a NEW audit artifact; historical benchmark files are untouched. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const revision = '79289b110818b97a313da75c4d3ff3a8e09a9ac0';
const archive = mkdtempSync(join(tmpdir(), 'sscim-before-'));
execFileSync('git', ['archive', '--format=tar', '-o', join(archive, 'baseline.tar'), revision], { cwd: root });
execFileSync('tar', ['-xf', join(archive, 'baseline.tar'), '-C', archive]);
// The snapshot is generated/ignored. Rebuild it from the revision's committed
// canonical database using that revision's exporter and installed dependencies.
symlinkSync(resolve(root, 'server/node_modules'), join(archive, 'server/node_modules'), 'junction');
execFileSync(process.execPath, [join(archive, 'app/scripts/build-vault-snapshot.mjs')], { cwd: archive });
const original = (path) => import(pathToFileURL(join(archive, path)).href);
const [{ buildEngine }, { buildVaultData }, { curationVariant, curationBands },
  { getEventAssumption, incidentOf }, { groupIncidents }, { MODEL_VERSION, BASE_PARAMS },
  { buildFacilityLayer, hazardFootprint, footprintToHazardScenario }] = await Promise.all([
  original('app/src/engine/index.js'), original('app/src/data/buildVaultData.js'),
  original('app/src/engine/curationUncertainty.js'), original('app/src/engine/event-assumptions.js'),
  original('app/src/engine/eventSource.js'), original('app/src/engine/registry.js'),
  original('app/src/engine/facilities.js'),
]);
const raw = readFileSync(join(archive, 'app/src/data/vault-snapshot.json'));
const bundle = JSON.parse(raw.toString('utf8'));
const data = buildVaultData(bundle);
const engine = buildEngine({ ...data, datasetAsOf: bundle.meta.snapshotDate, computeHistory: false });
const index = (events) => engine.toDisplayIndex(engine.operationalIndex(engine.operationalField(events)));
const baseline = index(data.EVENTS);
const run = (overrides) => index(data.EVENTS.map((e) => overrides[e.id] ? { ...e, model: overrides[e.id] } : e));
const variants = {
  baseline,
  allLow: run(curationVariant({ level: 'low' })),
  allHigh: run(curationVariant({ level: 'high' })),
  allAlternativeProfiles: run(curationVariant({ useAltProfile: true })),
};
for (const [name, adverse, mitigating] of [
  ['adverseLowMitigatingHigh', 'low', 'high'],
  ['adverseHighMitigatingLow', 'high', 'low'],
]) {
  const overrides = Object.fromEntries(curationBands().map(({ id, curated, band }) => [id, {
    ...curated, exposure: band[getEventAssumption(id).direction === 'mitigating' ? mitigating : adverse],
  }]));
  variants[name] = run(overrides);
}
const incidentInfluence = groupIncidents(data.EVENTS, { incidentOf }).map((group) => {
  const ids = new Set(group.records.map((r) => r.id));
  const without = index(data.EVENTS.filter((e) => !ids.has(e.id)));
  return { incidentId: group.incidentId, primaryId: group.primary.id, records: group.records,
    headlineWithoutIncident: without, baselineMinusWithout: baseline - without };
}).sort((a, b) => Math.abs(b.baselineMinusWithout) - Math.abs(a.baselineMinusWithout));
const layer = buildFacilityLayer(bundle.facilities || [], BASE_PARAMS);
const hazardScenarios = [
  { id: 'kumamoto', lat: 32.8, lng: 130.7, radiusKm: 100, severity: 7 },
  { id: 'hsinchu', lat: 24.8, lng: 121.0, radiusKm: 60, severity: 7 },
  { id: 'pyeongtaek', lat: 37.0, lng: 127.1, radiusKm: 60, severity: 7 },
].map((point) => {
  const scenario = footprintToHazardScenario(hazardFootprint(point, layer), { severity: point.severity });
  const active = scenario ? index([...data.EVENTS, { ...scenario.event, id: 'hazard' }]) : baseline;
  return { ...point, headline: active, delta: active - baseline };
});
const coupled = [variants.allLow, variants.allHigh, variants.allAlternativeProfiles];
const report = {
  kind: 'unchanged-audited-revision-reproduction', revision, modelVersion: MODEL_VERSION,
  datasetAsOf: bundle.meta.snapshotDate,
  snapshotSha256: createHash('sha256').update(raw).digest('hex'),
  reproductionCommand: 'node app/scripts/build-review-before.mjs',
  interpretation: 'Historical model output, not verified real-world risk. Leave-one-incident-out differences remove every update/recovery record with its primary; they are not additive contribution shares.',
  curation: {
    variants,
    originallyTestedRange: { low: Math.min(...coupled), high: Math.max(...coupled) },
    opposingSignRange: { low: variants.adverseLowMitigatingHigh, high: variants.adverseHighMitigatingLow },
    rangeLabel: 'Range over named tested scenarios; neither a proven bound nor a statistical confidence interval.',
  },
  incidentInfluence, hazardScenarios,
};
const out = resolve(root, 'docs/benchmarks/public-review-before-79289b1.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ output: out, baseline, variants, topIncidents: incidentInfluence.slice(0, 8), hazardScenarios }, null, 2));
