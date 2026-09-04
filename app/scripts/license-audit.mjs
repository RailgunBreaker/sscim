/* ====================================================================
   license-audit.mjs — what every installed dependency is licensed under.

   This exists because a proprietary release has to know that nothing in
   its dependency tree is reciprocally licensed, and "we checked once" is
   not a control. It walks the installed trees of both workspaces, reads
   each package's declared licence, and flags copyleft and unknowns.

   ONE TRAP, AND IT IS EASY TO FALL INTO. Packages ship fixtures. A naive
   walk over every package.json in node_modules picks up
   github-from-package/test/a.json, which declares a package called
   "beep-boop" with no licence — and reports an unknown-licence
   dependency that is not a dependency at all. Fixture, example and test
   directories are therefore excluded, and the exclusion is stated rather
   than silent.

   Run:  npm run audit:licenses
         npm run audit:licenses -- --json
   ==================================================================== */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(import.meta.url), '..');
const repoRoot = resolve(here, '..', '..');

/* Licences that impose reciprocal obligations on a proprietary work. */
const COPYLEFT = ['GPL', 'AGPL', 'LGPL', 'MPL', 'EPL', 'CDDL', 'CC-BY-SA', 'SSPL', 'OSL', 'EUPL'];

/* Directories inside a package that hold FIXTURES rather than installed
   dependencies. A package.json under any of these describes a test double,
   not something that ships. */
const FIXTURE_DIRS = new Set(['test', 'tests', '__tests__', 'example', 'examples', 'fixture', 'fixtures', 'spec', 'benchmark', 'benchmarks']);

const isFixturePath = (rel) => rel.split(sep).some((seg) => FIXTURE_DIRS.has(seg));

function collect(root) {
  const found = new Map();
  if (!existsSync(root)) return found;
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.name !== 'package.json') continue;
      const rel = full.slice(root.length + 1);
      if (isFixturePath(rel)) continue;
      let pkg;
      try { pkg = JSON.parse(readFileSync(full, 'utf8')); } catch { continue; }
      if (!pkg.name || !pkg.version) continue;
      /* A package's own manifest sits directly in its directory. Anything
         deeper without a nested node_modules on the path is a sub-manifest
         (a package's "exports" shim, say), not a separate dependency. */
      const depth = rel.split(sep).length;
      const scoped = pkg.name.startsWith('@');
      if (depth !== (scoped ? 3 : 2) && !rel.includes(`node_modules${sep}`)) continue;
      let lic = pkg.license ?? pkg.licenses;
      if (Array.isArray(lic)) lic = lic.map((l) => (typeof l === 'object' ? l.type : l)).join(' OR ');
      if (lic && typeof lic === 'object') lic = lic.type;
      found.set(`${pkg.name}@${pkg.version}`, (lic || 'UNKNOWN').trim());
    }
  };
  walk(root);
  return found;
}

const all = new Map();
for (const ws of ['app', 'server']) {
  for (const [k, v] of collect(resolve(repoRoot, ws, 'node_modules'))) all.set(k, v);
}

const byLicence = new Map();
const copyleft = [];
const unknown = [];
for (const [pkg, lic] of all) {
  byLicence.set(lic, (byLicence.get(lic) ?? 0) + 1);
  if (COPYLEFT.some((c) => lic.toUpperCase().includes(c))) copyleft.push({ pkg, lic });
  if (lic === 'UNKNOWN') unknown.push({ pkg });
}

const report = {
  generatedAt: new Date().toISOString(),
  distinctPackages: all.size,
  licences: Object.fromEntries([...byLicence].sort((a, b) => b[1] - a[1])),
  copyleft,
  unknown,
  fixturesExcluded: [...FIXTURE_DIRS],
  note: 'A declared license field is not the licence text. For a commercial launch, run a dedicated compliance tool and have the result reviewed.',
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`SSCIM dependency licence audit — ${all.size} distinct installed packages`);
  for (const [lic, n] of [...byLicence].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${lic}`);
  }
  console.log(`\n  copyleft findings: ${copyleft.length}`);
  copyleft.forEach((c) => console.log(`    ${c.pkg} — ${c.lic}`));
  console.log(`  unknown-licence findings: ${unknown.length}`);
  unknown.forEach((u) => console.log(`    ${u.pkg}`));
  console.log(`\n  fixture directories excluded: ${[...FIXTURE_DIRS].join(', ')}`);
}

/* A copyleft or unknown licence in a proprietary tree is a release
   blocker, so it fails rather than merely printing. */
if (copyleft.length || unknown.length) process.exit(1);
