/* Publishes every Markdown file in the repository as its own standalone HTML
   page, mirroring the repository tree:

     docs/PUBLIC_GUIDE.md            ->  dist-app/docs/PUBLIC_GUIDE.md.html
     docs/computation-demo/X.md         ->  dist-app/docs/computation-demo/X.md.html

   Why a page per document rather than one reader that swaps content: a real
   URL is shareable, linkable from outside, survives being pasted into a chat,
   and can be crawled. And because the output tree has the same shape as the
   source tree, the documents' existing repo-relative links keep working —
   `.html` is appended and the browser resolves the rest.

   Runs after `vite build` (as npm `postbuild`), because Vite empties the
   output directory. Discovery is a filesystem walk, so a new .md file is
   published by the next build with nothing to register. */
import { mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { findMarkdownDocs, repoDir, appDir } from './lib/find-markdown.mjs';
import { addHeadingIds, rewriteLinks, pageFor, rootPrefix } from '../src/docs/docLinks.js';
import { extractMath, restoreMath } from '../src/docs/docMath.js';
import { labelFor } from '../src/docs/docTags.js';

const outDir = path.join(repoDir, 'dist-app');

/* KaTeX ships its own stylesheet and fonts. Copy them once into vendor/ and
   link from each page, rather than inlining ~23KB of CSS into all of them.
   Only .woff2 is copied — every browser that can run this site supports it,
   and the .ttf/.woff duplicates are 900KB of the 1.2MB font directory. */
async function copyKatexAssets() {
  const from = path.join(appDir, 'node_modules', 'katex', 'dist');
  const to = path.join(outDir, 'vendor', 'katex');
  await mkdir(path.join(to, 'fonts'), { recursive: true });
  await copyFile(path.join(from, 'katex.min.css'), path.join(to, 'katex.min.css'));
  const fonts = (await readdir(path.join(from, 'fonts'))).filter((f) => f.endsWith('.woff2'));
  for (const font of fonts) {
    await copyFile(path.join(from, 'fonts', font), path.join(to, 'fonts', font));
  }
  return fonts.length;
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
:root{--bg:#0C111C;--panel:#141B2B;--panel2:#0F1626;--line:#243149;--copper:#C98A3F;--amber:#DFA83D;--text:#E9E4D8;--dim:#A5AEC0;--faint:#6E788B}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Space Grotesk',system-ui,sans-serif;line-height:1.68}
a{color:var(--copper);text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;z-index:5;border-bottom:1px solid var(--line);background:rgba(12,17,28,.94);backdrop-filter:blur(10px)}
.bar{max-width:1280px;margin:auto;padding:12px 24px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.brand{display:flex;align-items:center;color:var(--text)}.brand img{display:block;width:92px;height:auto}
.eyebrow,.path{font:10px ui-monospace,'IBM Plex Mono',monospace;color:var(--copper);letter-spacing:1.4px}
.nav{display:flex;gap:14px;margin-left:auto;font-size:13px}
.page{max-width:1280px;margin:auto;padding:28px 24px 90px;display:grid;grid-template-columns:250px minmax(0,1fr);gap:34px}
.doc-tree{position:sticky;top:78px;align-self:start;max-height:calc(100vh - 96px);overflow:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel2);padding:13px 10px}
.tree-title{display:flex;align-items:center;justify-content:space-between;margin:0 4px 8px;color:var(--faint);font:10px ui-monospace,'IBM Plex Mono',monospace;letter-spacing:1.3px}.tree-title a{color:var(--copper)}
.tree-list{list-style:none;margin:0;padding:0}.tree-list .tree-list{margin-left:12px;padding-left:8px;border-left:1px solid var(--line)}
.tree-folder{display:block;margin:10px 0 3px;color:var(--dim);font:10px ui-monospace,'IBM Plex Mono',monospace;letter-spacing:.7px}.tree-file{display:block;padding:5px 7px;border-radius:4px;color:var(--dim);font-size:12px;line-height:1.35;overflow-wrap:anywhere}.tree-file:hover{background:var(--panel);color:var(--text);text-decoration:none}.tree-file.current{background:rgba(201,138,63,.16);color:var(--text);box-shadow:inset 2px 0 var(--copper)}
.reader{min-width:0}.mobile-tree{display:none}.reader-main{max-width:1000px}
.content-header{border-bottom:1px solid var(--line);padding-bottom:22px;margin-bottom:30px}
.content-header h1{margin:8px 0 5px;font-size:clamp(26px,4vw,40px);letter-spacing:-.8px;line-height:1.15}
.note{border:1px solid #5b4827;background:rgba(223,168,61,.06);border-radius:7px;padding:12px 14px;margin:0 0 28px;color:var(--dim);font-size:13px}
.note b{color:var(--amber)}
.markdown{color:var(--dim);font-size:15px}
.markdown h1,.markdown h2,.markdown h3,.markdown h4{color:var(--text);line-height:1.25;margin:40px 0 14px;scroll-margin-top:80px}
.markdown h1{font-size:30px}.markdown h2{font-size:23px;border-bottom:1px solid var(--line);padding-bottom:9px}.markdown h3{font-size:18px}
.markdown p{margin:0 0 15px}.markdown strong{color:var(--text)}
.markdown ul,.markdown ol{padding-left:24px;margin:0 0 16px}.markdown li{padding:3px 0}
.markdown code{font:12px ui-monospace,'IBM Plex Mono',monospace;background:var(--panel2);border:1px solid var(--line);padding:1px 4px;border-radius:3px;color:#D9C5A5}
.markdown pre{background:#090E17;border:1px solid var(--line);border-radius:7px;padding:16px;overflow:auto;margin:18px 0}
.markdown pre code{border:0;background:transparent;padding:0;color:#D4DCE9}
.markdown blockquote{margin:18px 0;border-left:3px solid var(--amber);background:rgba(223,168,61,.06);padding:10px 14px}
.markdown table{border-collapse:collapse;width:100%;font-size:13px;margin:18px 0;display:block;overflow-x:auto}
.markdown th{color:var(--text);background:var(--panel)}
.markdown th,.markdown td{border:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top}
.markdown hr{border:0;border-top:1px solid var(--line);margin:30px 0}
.markdown img{max-width:100%}
.foot{margin-top:50px;padding-top:20px;border-top:1px solid var(--line);color:var(--faint);font-size:12.5px}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.tag{border:1px solid var(--line);background:var(--panel2);color:var(--dim);border-radius:20px;padding:3px 10px;font:10px ui-monospace,monospace;letter-spacing:.6px}
.tag:hover{border-color:var(--copper);color:var(--copper);text-decoration:none}
.katex{font-size:1.04em}
.katex-display{overflow-x:auto;overflow-y:hidden;padding:4px 0;margin:18px 0}
.math-error{color:var(--amber);border-color:var(--amber)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin:22px 0}
.card{border:1px solid var(--line);background:var(--panel);border-radius:9px;padding:14px}
.card strong{display:block;font-size:14px;color:var(--text)}
.card small{display:block;margin-top:4px;color:var(--faint);font:10px ui-monospace,monospace;word-break:break-all}
.group{margin:34px 0 8px;font:10px ui-monospace,monospace;letter-spacing:1.6px;color:var(--faint)}
@media(max-width:850px){.page{display:block;padding:20px 18px 60px}.doc-tree{display:none}.mobile-tree{display:block;margin:0 0 20px}.mobile-tree summary{cursor:pointer;border:1px solid var(--line);border-radius:6px;background:var(--panel2);padding:10px 12px;color:var(--dim);font:11px ui-monospace,monospace;letter-spacing:.5px}.mobile-tree .tree-list{margin-top:8px;border:1px solid var(--line);border-radius:6px;padding:8px;background:var(--panel2)}}
`;

const shell = ({ title, path: docPath, body, root }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escape(title)} — SSCIM</title>
<meta name="description" content="${escape(title)} — SSCIM project documentation." />
<link rel="canonical" href="https://sscim.railgunbreaker.icu/${docPath}" />
<link rel="stylesheet" href="${root}vendor/katex/katex.min.css" />
<style>${STYLE}</style>
</head>
<body>
<header><div class="bar">
  <a class="brand" href="${root}index.html" aria-label="SSCIM home"><img src="${root}sscim-logo.png" alt="SSCIM" /></a>
  <span class="eyebrow">DOCUMENTATION</span>
  <nav class="nav">
    <a href="${root}docs.html">All documents</a>
    <a href="${root}intro.html">Guide</a>
    <a href="${root}sscim-app.html">Dashboard</a>
  </nav>
</div></header>
${body}
</body>
</html>
`;

const docs = await findMarkdownDocs();
const known = new Set(docs.map((d) => d.path));

function relativePage(fromPath, toPath) {
  const fromDir = path.posix.dirname(fromPath);
  const href = path.posix.relative(fromDir === '.' ? '' : fromDir, pageFor(toPath));
  return href || path.posix.basename(pageFor(toPath));
}

function makeTree(items, currentPath, fromPath) {
  const root = new Map();
  for (const doc of items) {
    const parts = doc.path.split('/');
    let branch = root;
    for (const part of parts.slice(0, -1)) {
      if (!branch.has(part)) branch.set(part, new Map());
      branch = branch.get(part);
    }
    branch.set(parts.at(-1), doc);
  }
  const render = (branch) => `<ul class="tree-list">${[...branch].map(([name, value]) => {
    if (value instanceof Map) return `<li><span class="tree-folder">${escape(name)}/</span>${render(value)}</li>`;
    const selected = value.path === currentPath ? ' current' : '';
    return `<li><a class="tree-file${selected}" href="${escape(relativePage(fromPath, value.path))}" title="${escape(value.path)}">${escape(name)}</a></li>`;
  }).join('')}</ul>`;
  return render(root);
}

function readerLayout({ content, tree, title = 'FILES', indexHref = 'docs.html' }) {
  return `<div class="page"><aside class="doc-tree"><p class="tree-title">${title}<a href="${indexHref}">INDEX</a></p>${tree}</aside><details class="mobile-tree"><summary>Browse documentation files</summary>${tree}</details><main class="reader"><div class="reader-main">${content}</div></main></div>`;
}

let written = 0;
let equationCount = 0;
const fontCount = await copyKatexAssets();
for (const doc of docs) {
  const { markdown, math } = extractMath(doc.content);
  const html = restoreMath(
    rewriteLinks(addHeadingIds(marked.parse(markdown, { gfm: true, breaks: false })), doc.path, known),
    math,
  );
  equationCount += math.length;
  const root = rootPrefix(doc.path);
  const content = `<div class="content-header">
  <span class="path">${escape(doc.path)}</span>
  <h1>${escape(doc.title)}</h1>
  <div class="tags">${doc.tags.map((t) => `<a class="tag" href="${root}docs.html#tag=${encodeURIComponent(t)}">${escape(labelFor(t))}</a>`).join('')}</div>
</div>
<div class="note"><b>Reading note:</b> SSCIM separates evidence, declared assumptions, and computed outputs. Consult each document's scope and limitations before relying on a result.</div>
<div class="markdown">${html}</div>
<p class="foot">Rendered from <code>${escape(doc.path)}</code> ·
<a href="https://github.com/RailgunBreaker/sscim/blob/main/${doc.path}">View source on GitHub</a> ·
<a href="${root}docs.html">All documents</a></p>`;

  const body = readerLayout({ content, tree: makeTree(docs, doc.path, doc.path), indexHref: `${root}docs.html` });
  const target = path.join(outDir, pageFor(doc.path));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, shell({ title: doc.title, path: pageFor(doc.path), body, root }), 'utf8');
  written++;
}

/* A directory index at /docs/, so the folder itself is browsable. */
const groups = new Map();
for (const doc of docs) {
  const dir = doc.path.includes('/') ? doc.path.slice(0, doc.path.lastIndexOf('/')) : '(root)';
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(doc);
}
const indexContent = `<div class="content-header">
  <span class="path">${docs.length} documents</span>
  <h1>SSCIM documentation</h1>
</div>
${[...groups].map(([dir, list]) => `<p class="group">${escape(dir.toUpperCase())}</p>
<div class="cards">${list.map((d) => `<a class="card" href="../${pageFor(d.path)}"><strong>${escape(d.title)}</strong><small>${escape(d.path)}</small><span class="tags">${d.tags.map((t) => `<span class="tag">${escape(labelFor(t))}</span>`).join('')}</span></a>`).join('')}</div>`).join('\n')}`;
const indexBody = readerLayout({ content: indexContent, tree: makeTree(docs, '', 'docs/INDEX.md'), indexHref: '../docs.html' });
await mkdir(path.join(outDir, 'docs'), { recursive: true });
await writeFile(path.join(outDir, 'docs', 'index.html'), shell({ title: 'Documentation', path: 'docs/', body: indexBody, root: '../' }), 'utf8');

console.log(`Published ${written} documentation page(s) + /docs/ index · ${equationCount} equation(s) rendered · KaTeX css + ${fontCount} font(s).`);
