import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tagsFor } from '../../src/docs/docTags.js';

/* Single discovery path for every Markdown file in the repository, shared by
   the documentation library and the static page generator. Adding a .md file
   anywhere outside the ignored folders is all it takes for it to be indexed
   and published — there is no list to keep in sync. */

export const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const repoDir = path.resolve(appDir, '..');

const IGNORED = new Set(['.git', 'node_modules', 'dist-app', '.vite', 'coverage']);

/* Reading order for the documents a first-time reader should meet first;
   everything else follows alphabetically. */
export const PRIORITY = [
  'docs/README.md',
  'docs/PUBLIC_GUIDE.md',
  'docs/METHODOLOGY.md',
  'docs/calculation.md',
  'docs/SYSTEM_ARCHITECTURE.md',
  'docs/DATA_SOURCES_AND_OUTPUTS.md',
  'docs/DEVELOPER_GUIDE.md',
  'docs/ACADEMIC_GUIDE.md',
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...await walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) results.push(full);
  }
  return results;
}

/* [{ path, title, content }], priority-ordered then alphabetical. */
export async function findMarkdownDocs() {
  const rank = (relative) => {
    const at = PRIORITY.indexOf(relative);
    return at < 0 ? PRIORITY.length : at;
  };
  const files = await walk(repoDir);
  const docs = await Promise.all(files.map(async (file) => {
    const content = await readFile(file, 'utf8');
    const relative = path.relative(repoDir, file).replaceAll(path.sep, '/');
    const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(file, '.md');
    return { path: relative, title, content, tags: tagsFor(relative, content) };
  }));
  return docs.sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
}
