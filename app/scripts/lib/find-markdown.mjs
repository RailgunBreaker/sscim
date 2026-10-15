import { readdir, readFile, stat } from 'node:fs/promises';
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
  'docs/MODEL_ROADMAP.md',
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

/* Split on either line ending, once, so the three places below that walk
   a document line by line agree about what a line is. */
const LINES = (text) => String(text).split('\n').map((l) => l.replace(/\r$/, ''));

/* The prose of a document, with the scaffolding removed: fenced code,
   HTML comments (which is where tags live), link targets, and the heading
   markers. Used for the word count and for the search index, both of which
   should describe what a reader will actually read. */
function proseOf(content) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    /* Inline code is UNWRAPPED, not deleted. Deleting it left summaries
       reading "Model version: — the exact definition…", with a hole
       where the identifier the sentence was about used to be. */
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    /* Horizontal whitespace only. `\s` here would match the newline and
       weld the title onto the first paragraph, which is how the summary
       came out reading "SSCIM methodology Model version: This document…". */
    .replace(/^[#>|:\-\t ]+/gm, ' ')
    .replace(/[*_~]/g, '');
}

/* Every heading, so the library can search INSIDE a document rather than
   only across its title. Searching sixty titles finds the document you
   already knew the name of; searching their headings finds the one you
   did not. */
function headingsOf(content) {
  const out = [];
  let inFence = false;
  for (const line of LINES(content)) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,4})\s+(.+?)\s*#*$/.exec(line);
    if (m && m[1].length > 1) out.push({ level: m[1].length, text: m[2].trim() });
  }
  return out;
}

/* The document's opening sentences, for the library listing — which is
   the difference between a row a reader can decide about and a filename.

   It works on PARAGRAPHS, not lines. These documents are hard-wrapped at
   about eighty columns, so "the first line" is an arbitrary fragment of a
   sentence: the first attempt at this produced summaries like "This
   notice was drafted by an engineer to make the repository's intended",
   stopping exactly where the author happened to press return. Lines are
   joined back into paragraphs first, and the result is then cut at a
   sentence end where there is one within range, and at a word boundary
   where there is not. */
function summarise(prose, title) {
  const paragraphs = LINES(prose)
    .reduce((acc, line) => {
      if (line.trim()) acc[acc.length - 1].push(line.trim());
      else if (acc[acc.length - 1].length) acc.push([]);
      return acc;
    }, [[]])
    .map((lines) => lines.join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const first = paragraphs.find((p) => (
    p !== title
    && p.length > 40
    && /[a-z]{3}/.test(p)        // prose, not a row of symbols
    && !/^!?\[/.test(p)          // not an image or a bare link
    && !/^\|/.test(p)            // not a table row
  ));
  if (!first) return '';

  const LIMIT = 200;
  if (first.length <= LIMIT) return first;
  const window = first.slice(0, LIMIT + 40);
  const sentence = /^[\s\S]{60,240}?[.!?](?=\s|$)/.exec(window);
  if (sentence) return sentence[0].trim();
  const cut = first.slice(0, LIMIT);
  return `${cut.slice(0, cut.lastIndexOf(' ')).trim()}…`;
}

/* 230 words a minute, rounded up, floored at one. Technical prose with
   mathematics in it is slower than that, so this is a lower bound and the
   reader is told "min read", not promised a duration. */
const readingMinutes = (words) => Math.max(1, Math.round(words / 230));

/* [{ path, title, content, tags, words, readingMinutes, modified,
     headings, summary }], priority-ordered then alphabetical. */
export async function findMarkdownDocs() {
  const rank = (relative) => {
    const at = PRIORITY.indexOf(relative);
    return at < 0 ? PRIORITY.length : at;
  };
  const files = await walk(repoDir);
  const docs = await Promise.all(files.map(async (file) => {
    const [content, info] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
    const relative = path.relative(repoDir, file).replaceAll(path.sep, '/');
    const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(file, '.md');
    const prose = proseOf(content);
    const words = (prose.match(/[A-Za-z0-9À-ɏ一-鿿]+/g) || []).length;
    const summary = summarise(prose, title);
    return {
      path: relative,
      title,
      content,
      tags: tagsFor(relative, content),
      headings: headingsOf(content),
      summary,
      words,
      readingMinutes: readingMinutes(words),
      modified: info.mtime.toISOString().slice(0, 10),
    };
  }));
  return docs.sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
}
