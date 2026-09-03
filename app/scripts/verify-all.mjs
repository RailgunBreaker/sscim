/* ====================================================================
   verify-all.mjs — the definition-of-done run, recorded.

   Runs the whole verification sequence from a clean checkout, in order,
   and writes docs/benchmarks/verification-run.json with what each command
   actually produced. The documentation's "verification run" block is
   generated from that file, and `npm run docs:verify` fails any document
   that quotes a test count the recorded run does not support — so a stale
   claim in prose cannot survive.

   Nothing here is hand-entered. Counts are parsed from the commands' own
   output, and a non-zero exit is recorded as a failure rather than
   swallowed.

   Run:  npm run verify:all
         npm run verify:all -- --skip-install     (keep node_modules)
         npm run verify:all -- --sensitivity 256  (a faster sweep)
   ==================================================================== */
import { execFileSync, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MODEL_VERSION } from '../src/engine/registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, '..');
const repoRoot = resolve(appDir, '..');
const serverDir = resolve(repoRoot, 'server');
const OUT_DIR = resolve(repoRoot, 'docs', 'benchmarks');
const OUT = resolve(OUT_DIR, 'verification-run.json');

const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const SKIP_INSTALL = process.argv.includes('--skip-install');
/* A partial run is for local iteration, not for the record. Letting one
   overwrite the artefact would drop the install rows from the published
   table and make the documentation depend on how the command happened to
   be invoked. --record forces it anyway, for the rare case where that is
   what you want. */
const RECORD = !SKIP_INSTALL || process.argv.includes('--record');
const SENSITIVITY_SAMPLES = argOf('sensitivity', '1024');

const commands = [];

function run(label, command, cwd, { optional = false } = {}) {
  process.stdout.write(`\n── ${label}\n   $ ${command}\n`);
  const started = Date.now();
  let stdout = '';
  let ok = true;
  try {
    stdout = execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    ok = false;
    stdout = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    if (!optional) process.exitCode = 1;
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const tail = stdout.trim().split('\n').slice(-4).join('\n');
  console.log(tail.replace(/^/gm, '   '));
  console.log(`   -> ${ok ? 'PASS' : 'FAIL'} in ${seconds}s`);
  return { ok, stdout, seconds };
}

const record = (command, result, detail) => {
  commands.push({ command, result: result.ok ? 'pass' : 'FAIL', seconds: Number(result.seconds), detail });
};

console.log(`SSCIM verification run — model ${MODEL_VERSION}`);

/* 1-2. dependency installation */
if (SKIP_INSTALL) {
  console.log('\n── dependency installation skipped (--skip-install)');
} else {
  const serverInstall = run('server dependencies', 'npm ci', serverDir);
  record('server: npm ci', serverInstall, (serverInstall.stdout.match(/added \d+ packages[^\n]*/) || ['(no summary line)'])[0]);
  const appInstall = run('app dependencies', 'npm ci', appDir);
  record('app: npm ci', appInstall, (appInstall.stdout.match(/added \d+ packages[^\n]*/) || ['(no summary line)'])[0]);
}

/* 3. snapshot generation */
const snapshot = run('snapshot generation', 'npm run snapshot', appDir);
record('app: npm run snapshot', snapshot, (snapshot.stdout.match(/\(\d+ companies[^)]*\)/) || ['(no summary line)'])[0]);

const bundle = JSON.parse(readFileSync(resolve(appDir, 'src', 'data', 'vault-snapshot.json'), 'utf8'));
const datasetAsOf = bundle.meta?.snapshotDate ?? 'unknown';

/* 4. data audit */
const audit = run('data audit', 'npm run audit:data', appDir);
record('app: npm run audit:data', audit, (audit.stdout.match(/audit:data \w+ — [^\n]*/) || ['(no summary line)'])[0]);

/* 5. documentation verification */
const docsVerify = run('documentation verification', 'npm run docs:verify', appDir);
record('app: npm run docs:verify', docsVerify, (docsVerify.stdout.match(/docs:verify \w+[^\n]*/) || ['(no summary line)'])[0]);

/* 6. unit tests */
const tests = run('unit tests', 'npm test', appDir);
const strip = (s) => s.replace(/\[[0-9;]*m/g, '');
const testText = strip(tests.stdout);
const filesLine = (testText.match(/Test Files\s+.*$/m) || [''])[0].trim();
const testsLine = (testText.match(/^\s*Tests\s+.*$/m) || [''])[0].trim();
const num = (re) => { const m = testText.match(re); return m ? Number(m[1]) : 0; };
const testStats = {
  files: num(/Test Files\s+(\d+) passed/),
  filesFailed: num(/Test Files\s+(\d+) failed/),
  passed: num(/Tests\s+(\d+) passed/),
  failed: num(/Tests\s+(\d+) failed/),
  skipped: num(/Tests\s+.*?(\d+) skipped/),
  todo: num(/Tests\s+.*?(\d+) todo/),
};
testStats.total = testStats.passed + testStats.failed + testStats.skipped + testStats.todo;
record('app: npm test', tests, `${filesLine} · ${testsLine}`);

/* 7. production build */
const build = run('production build', 'npm run build', appDir);
record('app: npm run build', build, (build.stdout.match(/Published \d+ documentation page[^\n]*/) || ['built'])[0]);

/* 8. browser smoke */
const smoke = run('browser smoke', 'npm run smoke', appDir);
const smokeLine = (strip(smoke.stdout).match(/(\d+)\/(\d+) checks passed/) || []);
const smokeStats = { passed: Number(smokeLine[1] ?? 0), total: Number(smokeLine[2] ?? 0) };
const smokeSections = [...strip(smoke.stdout).matchAll(/──\s+(.+?)\s+─+/g)].map((m) => m[1].trim());
record('app: npm run smoke', smoke, smokeLine[0] ?? '(no summary line)');

/* 9. global sensitivity */
const sensitivity = run('global sensitivity', `npm run sensitivity -- --samples ${SENSITIVITY_SAMPLES}`, appDir);
record(`app: npm run sensitivity -- --samples ${SENSITIVITY_SAMPLES}`, sensitivity,
  (strip(sensitivity.stdout).match(/design: [^\n]*/) || ['(no summary line)'])[0]);

/* 10. v6 -> v7 benchmark */
const benchmark = run('v6 to v7 benchmark', 'npm run benchmark', appDir);
/* Two legitimate outcomes here, and the record must say which: a
   recomputed comparison, or a clean skip because the snapshot has moved
   past the frozen v6 reference's date, at which point the comparison
   would no longer be a pure model comparison. */
record('app: npm run benchmark', benchmark,
  (strip(benchmark.stdout).match(/headline index\s+[^\n]*/)
    || strip(benchmark.stdout).match(/SKIPPED[^\n]*/)
    || ['(no summary line)'])[0].trim());

/* 11. computation-demo export */
const demo = run('computation demonstration export', 'npm run demo', appDir);
record('app: npm run demo', demo, (strip(demo.stdout).match(/headline index [^\n]*/) || ['(no summary line)'])[0].trim());

/* ---- read back what the artefacts say, so the record is not self-reported ---- */
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const sensitivityReport = readJson(resolve(OUT_DIR, 'v7-sensitivity.json'));
const benchmarkReport = readJson(resolve(OUT_DIR, 'v6-to-v7-benchmark.json'));

let commit = null;
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(); } catch { /* not a git checkout */ }

const report = {
  recordedAt: new Date().toISOString(),
  commit,
  modelVersion: MODEL_VERSION,
  datasetAsOf,
  commands,
  tests: testStats,
  browserSmoke: { ...smokeStats, sections: smokeSections },
  sensitivity: sensitivityReport ? {
    seed: sensitivityReport.design.seed,
    samples: sensitivityReport.design.samples,
    continuousDimensions: sensitivityReport.design.continuousDimensions,
    numericalEvaluations: sensitivityReport.design.numericalEvaluations,
    modelFormCombinations: sensitivityReport.design.modelFormCombinations,
    baseHeadlineIndex: sensitivityReport.base.headlineIndex,
    numericalEnvelope: sensitivityReport.numericalParameters.headlineEnvelope,
    modelFormEnvelope: sensitivityReport.modelForms.headlineEnvelope,
  } : null,
  benchmark: benchmarkReport ? {
    from: benchmarkReport.from, to: benchmarkReport.to, headline: benchmarkReport.headline,
  } : null,
  allPassed: commands.every((c) => c.result === 'pass'),
};

if (RECORD) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`model ${MODEL_VERSION} · dataset ${datasetAsOf} · commit ${commit ?? 'unknown'}`);
commands.forEach((c) => console.log(`  ${c.result === 'pass' ? 'PASS' : 'FAIL'}  ${c.command.padEnd(46)} ${c.detail}`));
console.log(`\n  tests: ${testStats.total} total — ${testStats.passed} passed, ${testStats.failed} failed, ${testStats.skipped} skipped, ${testStats.todo} todo, across ${testStats.files} files`);
console.log(`  browser smoke: ${smokeStats.passed}/${smokeStats.total} checks across ${smokeSections.length} scenario sections`);
if (RECORD) {
  console.log(`\nWrote ${OUT}`);
  console.log('Now run `npm run docs:generate` so the documentation quotes this run, then `npm run docs:verify`.');
} else {
  console.log(`\nNOT recorded: this was a partial run (--skip-install), so ${OUT} is left alone.`);
  console.log('Re-run without --skip-install to record the definition-of-done run, or pass --record to force it.');
}

if (!report.allPassed) {
  console.error('\nVERIFICATION RUN FAILED — see the FAIL rows above.');
  process.exitCode = 1;
}
