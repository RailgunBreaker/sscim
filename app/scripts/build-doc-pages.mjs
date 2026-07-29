/* Publishes every Markdown file in the repository as its own standalone HTML
   page, mirroring the repository tree:

     docs/PUBLIC_GUIDE.md            ->  dist-app/docs/PUBLIC_GUIDE.md.html
     docs/calculation/06-....md      ->  dist-app/docs/calculation/06-....md.html

   Why a page per document rather than one reader that swaps content: a real
   URL is shareable, linkable from outside, survives being pasted into a chat,
   and can be crawled. And because the output tree has the same shape as the
   source tree, the documents' existing repo-relative links keep working —
   `.html` is appended and the browser resolves the rest.

   Runs after `vite build` (as npm `postbuild`), because Vite empties the
   output directory. Discovery is a filesystem walk, so a new .md file is
   published by the next build with nothing to register. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { findMarkdownDocs, repoDir } from './lib/find-markdown.mjs';
import { addHeadingIds, rewriteLinks, pageFor, rootPrefix } from '../src/docs/docLinks.js';

const outDir = path.join(repoDir, 'dist-app');

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
:root{--bg:#0C111C;--panel:#141B2B;--panel2:#0F1626;--line:#243149;--copper:#C98A3F;--amber:#DFA83D;--text:#E9E4D8;--dim:#A5AEC0;--faint:#6E788B}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:'Space Grotesk',system-ui,sans-serif;line-height:1.68}
a{color:var(--copper);text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;z-index:5;border-bottom:1px solid var(--line);background:rgba(12,17,28,.94);backdrop-filter:blur(10px)}
.bar{max-width:1000px;margin:auto;padding:14px 24px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.brand{font-size:18px;font-weight:700;letter-spacing:1px;color:var(--text)}
.eyebrow,.path{font:10px ui-monospace,'IBM Plex Mono',monospace;color:var(--copper);letter-spacing:1.4px}
.nav{display:flex;gap:14px;margin-left:auto;font-size:13px}
main{max-width:1000px;margin:auto;padding:44px 24px 90px}
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
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin:22px 0}
.card{border:1px solid var(--line);background:var(--panel);border-radius:9px;padding:14px}
.card strong{display:block;font-size:14px;color:var(--text)}
.card small{display:block;margin-top:4px;color:var(--faint);font:10px ui-monospace,monospace;word-break:break-all}
.group{margin:34px 0 8px;font:10px ui-monospace,monospace;letter-spacing:1.6px;color:var(--faint)}
@media(max-width:700px){main{padding:28px 18px 60px}}
`;

const shell = ({ title, path: docPath, body, root }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escape(title)} — SSCIM</title>
<meta name="description" content="${escape(title)} — SSCIM project documentation." />
<link rel="canonical" href="https://sscim.railgunbreaker.icu/${docPath}" />
<style>${STYLE}</style>
</head>
<body>
<header><div class="bar">
  <a class="brand" href="${root}index.html">SSCIM</a>
  <span class="eyebrow">DOCUMENTATION</span>
  <nav class="nav">
    <a href="${root}docs.html">All documents</a>
    <a href="${root}intro.html">Guide</a>
    <a href="${root}sscim-app.html">Dashboard</a>
  </nav>
</div></header>
<main>
${body}
</main>
</body>
</html>
`;

const docs = await findMarkdownDocs();
const known = new Set(docs.map((d) => d.path));

let written = 0;
for (const doc of docs) {
  const html = rewriteLinks(addHeadingIds(marked.parse(doc.content, { gfm: true, breaks: false })), doc.path, known);
  const root = rootPrefix(doc.path);
  const body = `<div class="content-header">
  <span class="path">${escape(doc.path)}</span>
  <h1>${escape(doc.title)}</h1>
</div>
<div class="note"><b>Reading note:</b> SSCIM separates evidence, declared assumptions, and computed outputs. Consult each document's scope and limitations before relying on a result.</div>
<div class="markdown">${html}</div>
<p class="foot">Rendered from <code>${escape(doc.path)}</code> ·
<a href="https://github.com/RailgunBreaker/sscim/blob/main/${doc.path}">View source on GitHub</a> ·
<a href="${root}docs.html">All documents</a></p>`;

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
const indexBody = `<div class="content-header">
  <span class="path">${docs.length} documents</span>
  <h1>SSCIM documentation</h1>
</div>
${[...groups].map(([dir, list]) => `<p class="group">${escape(dir.toUpperCase())}</p>
<div class="cards">${list.map((d) => `<a class="card" href="../${pageFor(d.path)}"><strong>${escape(d.title)}</strong><small>${escape(d.path)}</small></a>`).join('')}</div>`).join('\n')}`;
await mkdir(path.join(outDir, 'docs'), { recursive: true });
await writeFile(path.join(outDir, 'docs', 'index.html'), shell({ title: 'Documentation', path: 'docs/', body: indexBody, root: '../' }), 'utf8');

console.log(`Published ${written} documentation page(s) + /docs/ index.`);
