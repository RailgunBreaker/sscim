/* ====================================================================
   build-doc-generated.mjs — regenerate every GENERATED block in the
   documentation from the v7 registry and the engine.

   Run:  npm run docs:generate
   Check (no writes, non-zero exit on drift): npm run docs:verify
   ==================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyGenerated, GENERATORS, repoRoot } from './lib/doc-generated.mjs';
import { findMarkdownDocs } from './lib/find-markdown.mjs';

const CHECK = process.argv.includes('--check');

const docs = await findMarkdownDocs();
const changed = [];
const errors = [];
const touched = [];

for (const doc of docs) {
  if (!doc.content.includes('<!-- BEGIN GENERATED:')) continue;
  const file = resolve(repoRoot, doc.path);
  const original = readFileSync(file, 'utf8');
  const { markdown, found, missing } = applyGenerated(original);
  touched.push({ path: doc.path, blocks: found });
  missing.forEach((name) => errors.push(`${doc.path}: unknown generated block "${name}" (known: ${Object.keys(GENERATORS).join(', ')})`));
  if (markdown !== original) {
    changed.push(doc.path);
    if (!CHECK) writeFileSync(file, markdown);
  }
}

touched.forEach((t) => console.log(`  ${t.path}: ${t.blocks.length} generated block(s) — ${t.blocks.join(', ')}`));

if (errors.length) {
  errors.forEach((e) => console.error(`ERROR ${e}`));
  process.exit(1);
}

if (CHECK) {
  if (changed.length) {
    console.error('\nGENERATED DOCUMENTATION IS STALE. These files do not match the registry/engine:');
    changed.forEach((p) => console.error(`  ${p}`));
    console.error('\nRun `npm run docs:generate` and commit the result.');
    process.exit(1);
  }
  console.log('\nAll generated documentation blocks match the code.');
} else {
  console.log(changed.length ? `\nRegenerated ${changed.length} file(s): ${changed.join(', ')}` : '\nNothing to regenerate — every block already matches.');
}
