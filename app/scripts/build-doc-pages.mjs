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
   published by the next build with nothing to register.

   THE READER'S LAYOUT, and why it is three columns.

   It used to be two: a sidebar holding the file tree AND the page's own
   headings stacked under it, then the prose at up to 1000px wide in a 15px
   UI face. Two things were wrong. The table of contents was below the fold
   of a sixty-file tree, so on most documents the reader never saw it. And
   1000px of 15px sans-serif is about 120 characters a line, roughly twice
   what the eye tracks from one line to the next.

   Now: the file tree on the left, the prose in the middle at a 68-character
   measure in a text face, and the document's own headings on the right where
   they stay visible and track the reading position. Everything below exists
   to serve that: heading anchors, a copy button on every code block, a
   previous/next pager in reading order, and what the document costs to read
   before the reader commits to it. */
import { mkdir, writeFile, copyFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { findMarkdownDocs, repoDir, appDir } from './lib/find-markdown.mjs';
import { addHeadingIds, rewriteLinks, pageFor, rootPrefix } from '../src/docs/docLinks.js';
import { extractMath, restoreMath } from '../src/docs/docMath.js';
import { labelFor } from '../src/docs/docTags.js';
import { SITE_SECTIONS, SITE_MAP_FOOTNOTE } from '../src/components/siteMapLinks.js';
import { BASE_CSS, FOOT_CSS, THEME_BOOTSTRAP } from '../src/ui/css.js';

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

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Only what the three-column reader adds. Everything else — the palette,
   the typographic scale, the prose styles, the controls, the header, the
   footer — comes from the one stylesheet the React pages also load, so a
   document page and the library cannot disagree about what a heading
   looks like. */
const READER_CSS = `
.reader{
  display:grid;
  grid-template-columns:260px minmax(0,1fr) 220px;
  gap:var(--s7);
  max-width:1380px;margin:0 auto;padding:var(--s5) var(--s5) var(--s8);
  align-items:start;
}

/* --- left: the library tree, expanded to the document you are in ------ */

.tree{position:sticky;top:76px;max-height:calc(100vh - 104px);overflow:auto;min-width:0}
.tree-label{font-size:var(--t-meta);font-weight:600;color:var(--ink-3);margin:0 0 var(--s2);display:flex;justify-content:space-between;align-items:baseline;gap:var(--s2);padding:0 var(--s2)}
.tree ul{list-style:none;margin:0;padding:0}
.tree details{margin:0}
.tree details > ul{margin-left:var(--s3);padding-left:var(--s2);border-left:1px solid var(--rule)}
.tree summary{
  display:flex;align-items:center;gap:6px;cursor:pointer;list-style:none;
  padding:5px var(--s2);border-radius:var(--r1);
  font-size:var(--t-meta);font-weight:600;color:var(--ink-2);font-family:var(--mono);
}
.tree summary::-webkit-details-marker{display:none}
.tree summary:hover{background:var(--hover);color:var(--ink)}
/* A triangle drawn with borders rather than typed as a character. The
   previous marker was U+25B8/U+25BE set in the monospace family the
   folder names use, which does not carry either glyph — so every open
   folder rendered as a hyphen. A border triangle depends on no font. */
.tree summary::before{
  content:"";width:0;height:0;flex-shrink:0;
  border-left:5px solid var(--ink-3);border-top:4px solid transparent;border-bottom:4px solid transparent;
}
.tree details[open] > summary::before{
  border-left:4px solid transparent;border-right:4px solid transparent;
  border-top:5px solid var(--ink-3);border-bottom:0;
}
.tree a{
  display:block;padding:5px var(--s2);border-radius:var(--r1);
  color:var(--ink-2);font-size:var(--t-small);line-height:1.4;overflow-wrap:anywhere;
}
.tree a:hover{background:var(--hover);color:var(--ink);text-decoration:none}
.tree a[aria-current="page"]{background:var(--wash);color:var(--ink);font-weight:600;box-shadow:inset 2px 0 var(--accent)}

/* --- centre: the document -------------------------------------------- */

.doc-main{min-width:0}
.doc-head{padding-bottom:var(--s5);margin-bottom:var(--s5);border-bottom:1px solid var(--rule)}
.doc-head h1{font-size:var(--t-display);line-height:1.12;letter-spacing:-.02em;margin:var(--s2) 0 var(--s3);max-width:34ch}
.doc-facts{display:flex;gap:var(--s3);flex-wrap:wrap;align-items:center;font-size:var(--t-meta);color:var(--ink-3)}
.doc-facts .dot{opacity:.45}
.doc-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:var(--s3)}

/* A code block you can take with you. The button is inside the block and
   appears on hover or focus, so it never competes with the code. */
.codeblock{position:relative}
.codeblock > .copy{
  position:absolute;top:8px;right:8px;opacity:0;
  min-height:28px;padding:0 9px;font-size:var(--t-meta);
  border:1px solid var(--control);border-radius:var(--r1);
  background:var(--panel);color:var(--ink-2);cursor:pointer;
}
.codeblock:hover > .copy,.codeblock > .copy:focus-visible{opacity:1}
.codeblock > .copy:hover{color:var(--ink);background:var(--raised)}

/* Previous and next in reading order, so the library can be read through
   rather than only searched. */
.pager{display:grid;grid-template-columns:1fr 1fr;gap:var(--s3);margin-top:var(--s7)}
.pager a{
  display:block;padding:var(--s3) var(--s4);border:1px solid var(--rule);border-radius:var(--r3);
  text-decoration:none;color:inherit;min-width:0;
}
.pager a:hover{border-color:var(--accent);text-decoration:none}
.pager .dir{display:block;font-size:var(--t-meta);color:var(--ink-3)}
.pager .what{display:block;font-size:var(--t-small);font-weight:600;color:var(--ink);margin-top:3px}
.pager .next{text-align:right}
.pager .spacer{border:0}

.doc-foot{margin-top:var(--s6);padding-top:var(--s4);border-top:1px solid var(--rule);font-size:var(--t-meta);color:var(--ink-3);line-height:1.8}
.doc-foot a{color:var(--accent)}

/* --- right: this page's own headings, tracking the reading position --- */

.onpage{position:sticky;top:76px;max-height:calc(100vh - 104px);overflow:auto;min-width:0}
.onpage p{font-size:var(--t-meta);font-weight:600;color:var(--ink-3);margin:0 0 var(--s2);padding-left:var(--s3)}
.onpage ul{list-style:none;margin:0;padding:0;border-left:1px solid var(--rule)}
.onpage a{
  display:block;padding:4px var(--s3);margin-left:-1px;
  border-left:2px solid transparent;
  color:var(--ink-3);font-size:var(--t-meta);line-height:1.4;overflow-wrap:anywhere;
}
.onpage a:hover{color:var(--ink);text-decoration:none}
.onpage a.here{color:var(--ink);border-left-color:var(--accent);font-weight:600}
.onpage .lv3{padding-left:var(--s5)}
.onpage .lv4{padding-left:var(--s6)}

/* --- responsive -------------------------------------------------------

   These two are hidden by default and revealed by the queries below, so
   the default MUST be declared first: when it sat after them it had the
   same specificity and simply won, and neither the mobile file tree nor
   the collapsed table of contents ever appeared at any width. */

.inline-toc,.mobile-nav{display:none}

@media(max-width:1240px){
  .reader{grid-template-columns:240px minmax(0,1fr);gap:var(--s6)}
  .onpage{display:none}
  /* With no right column, the headings go back inline above the prose —
     collapsed, so they cost nothing to a reader who does not want them. */
  .inline-toc{display:block;margin-bottom:var(--s5)}
}
@media(max-width:900px){
  .reader{display:block;padding:var(--s4) var(--s4) var(--s7)}
  .tree{display:none}
  .mobile-nav{display:block;margin-bottom:var(--s5)}
  .doc-head h1{font-size:var(--t-h1)}
  .pager{grid-template-columns:1fr}
  .pager .next{text-align:left}
}
.inline-toc summary,.mobile-nav summary{
  cursor:pointer;list-style:none;padding:var(--s2) var(--s3);
  border:1px solid var(--rule);border-radius:var(--r2);background:var(--sunken);
  font-size:var(--t-small);color:var(--ink-2);display:inline-flex;gap:var(--s2);align-items:center;
}
.inline-toc summary::-webkit-details-marker,.mobile-nav summary::-webkit-details-marker{display:none}
.inline-toc summary::before,.mobile-nav summary::before{content:"▸";font-size:9px}
.inline-toc[open] summary::before,.mobile-nav[open] summary::before{content:"▾"}
.inline-toc > div,.mobile-nav > div{margin-top:var(--s3)}
`;

/* Progressive, and small enough to inline: the table of contents follows
   the reading position, code blocks gain a copy button, and the theme
   toggle remembers itself. Every one of these degrades to nothing without
   JavaScript — the document is already complete HTML. */
const READER_JS = `
(function(){
  var root = document.documentElement;

  /* Theme. The same key and the same default (dark) as the React pages. */
  var btn = document.getElementById('theme-toggle');
  if (btn) {
    var apply = function (t) {
      root.setAttribute('data-theme', t);
      btn.setAttribute('aria-pressed', String(t === 'light'));
      var to = t === 'light' ? 'dark' : 'paper';
      btn.setAttribute('aria-label', 'Switch to ' + to + ' reading theme');
      btn.setAttribute('title', 'Switch to ' + to + ' reading theme');
      btn.firstChild.nodeValue = t === 'light' ? '\\u25D0' : '\\u25D1';
    };
    apply(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      apply(next);
      try { localStorage.setItem('sscim-theme', next); } catch (e) {}
    });
  }

  /* Copy a code block. The confirmation is in the button itself, because a
     toast in the corner is one more thing to notice. */
  Array.prototype.forEach.call(document.querySelectorAll('.codeblock'), function (block) {
    var code = block.querySelector('code');
    if (!code || !navigator.clipboard) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'copy';
    b.textContent = 'Copy';
    b.setAttribute('aria-label', 'Copy this code block');
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(code.innerText).then(function () {
        b.textContent = 'Copied';
        setTimeout(function () { b.textContent = 'Copy'; }, 1400);
      }, function () { b.textContent = 'Press Ctrl+C'; });
    });
    block.appendChild(b);
  });

  /* Scroll-spy. The heading nearest the top of the viewport is the one the
     reader is in; IntersectionObserver reports crossings, and the choice is
     recomputed from scratch each time so it cannot drift. */
  var links = Array.prototype.slice.call(document.querySelectorAll('.onpage a[data-id]'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('data-id')] = a; });
  var heads = links
    .map(function (a) { return document.getElementById(a.getAttribute('data-id')); })
    .filter(Boolean);
  var mark = function () {
    var best = null;
    for (var i = 0; i < heads.length; i++) {
      var top = heads[i].getBoundingClientRect().top;
      if (top - 90 <= 0) best = heads[i];
    }
    if (!best) best = heads[0];
    links.forEach(function (a) { a.classList.remove('here'); a.removeAttribute('aria-current'); });
    var active = best && byId[best.id];
    if (active) { active.classList.add('here'); active.setAttribute('aria-current', 'location'); }
  };
  var queued = false;
  var onScroll = function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; mark(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  mark();
})();
`;

const shell = ({ title, description, path: docPath, body, root }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escape(title)} — SSCIM</title>
<meta name="description" content="${escape(description)}" />
<link rel="canonical" href="https://sscim.railgunbreaker.icu/${docPath}" />
<link rel="stylesheet" href="${root}vendor/katex/katex.min.css" />
<script>${THEME_BOOTSTRAP}</script>
<style>${BASE_CSS}${FOOT_CSS}${READER_CSS}</style>
</head>
<body>
<header class="site-head"><div class="shell bar">
  <a class="brand" href="${root}index.html" aria-label="SSCIM home"><img src="${root}sscim-logo.png" alt="SSCIM" /></a>
  ${crumbs(docPath, title, root)}
  <nav class="site-nav" aria-label="Site">
    <a href="${root}docs.html">All documents</a>
    <a href="${root}intro.html">Guide</a>
    <a href="${root}updates.html">Updates</a>
    <button type="button" id="theme-toggle" class="btn btn-quiet btn-sm" aria-pressed="false"
      aria-label="Switch to paper reading theme" title="Switch to paper reading theme">&#9681;</button>
    <a class="btn btn-primary btn-sm" href="${root}sscim-app.html">Dashboard</a>
  </nav>
</div></header>
${body}
${siteMap(root)}
<script>${READER_JS}</script>
</body>
</html>
`;

/* Where you are, and a way out of every level of it. The old header put
   "DOCUMENTATION" in 10.5px copper caps, which told a reader who had
   arrived from a search result nothing they could use. */
function crumbs(pagePath, title, root) {
  const parts = pagePath.replace(/\.html$/, '').split('/');
  const leaf = parts.pop();
  const trail = [`<a href="${root}index.html">SSCIM</a>`, `<a href="${root}docs.html">Documentation</a>`];
  /* Intermediate folders below the top level. A folder has no page of its
     own, so each one links to the library pre-filtered to it — which is
     the only thing a reader would want from that crumb anyway. Indexed
     rather than searched, so two folders of the same name cannot resolve
     to each other. */
  for (let i = 1; i < parts.length; i += 1) {
    const dir = parts.slice(0, i + 1).join('/');
    trail.push(`<a href="${root}docs.html#folder=${encodeURIComponent(dir)}">${escape(parts[i])}</a>`);
  }
  const sep = '<span class="sep" aria-hidden="true">/</span>';
  return `<nav class="crumbs" aria-label="Breadcrumb">${trail.join(sep)}${sep}<span class="here" aria-current="page">${escape(leaf || title)}</span></nav>`;
}

/* The same site map the React pages render (src/components/SiteMap.jsx),
   emitted as static HTML from the SAME link list — so a page added to one
   renderer cannot go missing from the other. Document pages need it most:
   without it, a reader who arrives on METHODOLOGY.md.html from a search
   result can reach the document tree and nothing else. */
function siteMap(root) {
  const cols = SITE_SECTIONS.map((section) => `<div>
    <h2>${escape(section.heading)}</h2>
    <ul class="bare">${section.links.map((link) => {
      const href = link.external ? link.href : `${root}${link.href}`;
      const attrs = link.external ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<li><a href="${escape(href)}"${attrs}>${escape(link.label)}</a><small>${escape(link.note)}</small></li>`;
    }).join('')}</ul>
  </div>`).join('');
  return `<footer class="site-foot"><div class="shell">
  <div class="cols">${cols}</div>
  <p class="fine">${escape(SITE_MAP_FOOTNOTE)}</p>
</div></footer>`;
}

const docs = await findMarkdownDocs();
const known = new Set(docs.map((d) => d.path));

function relativePage(fromPath, toPath) {
  const fromDir = path.posix.dirname(fromPath);
  const href = path.posix.relative(fromDir === '.' ? '' : fromDir, pageFor(toPath));
  return href || path.posix.basename(pageFor(toPath));
}

/* The file tree, as real <details> elements. Folders remember nothing
   between pages on purpose: the folder containing the document you are
   reading is open, and the rest are closed, so the rail is the size of
   your neighbourhood rather than the size of the repository. The previous
   version rendered all sixty files flat and always, which is why the
   table of contents beneath it was never on screen. */
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
  /* Folders first, then files, each alphabetically. The tree used to render in
     filesystem-walk order, so a document's position in the sidebar encoded
     nothing a reader could predict. */
  const ordered = (branch) => [...branch].sort(([an, av], [bn, bv]) => {
    const aDir = av instanceof Map;
    const bDir = bv instanceof Map;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return an.localeCompare(bn, undefined, { sensitivity: 'base' });
  });
  const holdsCurrent = (branch) => [...branch.values()].some(
    (v) => (v instanceof Map ? holdsCurrent(v) : v.path === currentPath),
  );
  const render = (branch, depth) => `<ul>${ordered(branch).map(([name, value]) => {
    if (value instanceof Map) {
      const open = depth === 0 || holdsCurrent(value) ? ' open' : '';
      return `<li><details${open}><summary>${escape(name)}/</summary>${render(value, depth + 1)}</details></li>`;
    }
    const here = value.path === currentPath ? ' aria-current="page"' : '';
    return `<li><a href="${escape(relativePage(fromPath, value.path))}"${here} title="${escape(value.path)}">${escape(value.title.replace(/^SSCIM\s*[—-]\s*/, ''))}</a></li>`;
  }).join('')}</ul>`;
  return render(root, 0);
}

function tocItems(html) {
  return [...html.matchAll(/<h([2-4]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)]
    .map(([, level, id, inner]) => ({ level: Number(level), id, text: inner.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&') }));
}

function makeToc(items, { spy = false } = {}) {
  if (!items.length) return '';
  return `<ul>${items.map(({ level, id, text }) => {
    const cls = level > 2 ? ` class="lv${level}"` : '';
    const spyAttr = spy ? ` data-id="${escape(id)}"` : '';
    return `<li><a href="#${escape(id)}"${spyAttr}${cls}>${escape(text)}</a></li>`;
  }).join('')}</ul>`;
}

/* A link beside every heading, revealed on hover. Added here rather than in
   docLinks.addHeadingIds because that function is covered by tests that
   assert the exact shape of what it emits, and an anchor is presentation. */
function addAnchors(html) {
  return html.replace(/<h([2-4]) id="([^"]+)">/g, (m, level, id) => `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>`);
}

/* Every document opens with `# Its Title`, and the page header already
   shows that title at display size. Rendering both put the same words on
   screen twice, forty pixels apart, on all forty-one pages. The leading
   H1 is dropped when it says what the header already said; a document
   whose first heading differs keeps it. */
function dropLeadingTitle(html, title) {
  const m = /^\s*<h1(?: id="[^"]*")?>([\s\S]*?)<\/h1>/.exec(html);
  if (!m) return html;
  const text = m[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
  return text === title.trim() ? html.slice(m[0].length) : html;
}

/* Wrap each <pre> so the copy button has something to position against. */
function wrapCode(html) {
  return html.replace(/<pre>/g, '<div class="codeblock"><pre>').replace(/<\/pre>/g, '</pre></div>');
}

function readerLayout({ head, content, toc, tree, pager, foot }) {
  const treeBlock = `<p class="tree-label">Library <a href="docs.html">index</a></p>${tree}`;
  const tocBlock = toc ? `<nav class="onpage" aria-label="On this page"><p>On this page</p>${toc.spy}</nav>` : '<div></div>';
  const inlineToc = toc ? `<details class="inline-toc"><summary>On this page</summary><div>${toc.plain}</div></details>` : '';
  return `<div class="reader">
  <nav class="tree" aria-label="Documentation files">${treeBlock}</nav>
  <main class="doc-main">
    <details class="mobile-nav"><summary>Browse all documents</summary><div class="tree">${treeBlock}</div></details>
    ${head}
    ${inlineToc}
    <article class="prose">${content}</article>
    ${pager}
    ${foot}
  </main>
  ${tocBlock}
</div>`;
}

let written = 0;
let equationCount = 0;
const fontCount = await copyKatexAssets();

for (const [i, doc] of docs.entries()) {
  const { markdown, math } = extractMath(doc.content);
  const html = restoreMath(
    rewriteLinks(addHeadingIds(marked.parse(markdown, { gfm: true, breaks: false })), doc.path, known),
    math,
  );
  equationCount += math.length;
  const root = rootPrefix(doc.path);
  const items = tocItems(html);
  const body = wrapCode(addAnchors(dropLeadingTitle(html, doc.title)));

  const head = `<header class="doc-head">
  <div class="doc-facts">
    <span class="code">${escape(doc.path)}</span>
    <span class="dot" aria-hidden="true">·</span>
    <span>${doc.readingMinutes} min read</span>
    <span class="dot" aria-hidden="true">·</span>
    <span class="tnum">${doc.words.toLocaleString('en-US')} words</span>
    <span class="dot" aria-hidden="true">·</span>
    <span>updated <time datetime="${escape(doc.modified)}">${escape(doc.modified)}</time></span>
  </div>
  <h1>${escape(doc.title)}</h1>
  <div class="doc-tags">${doc.tags.map((t) => `<a class="tag" href="${root}docs.html#tags=${encodeURIComponent(t)}">${escape(labelFor(t))}</a>`).join('')}</div>
  <p class="note" style="margin-top:var(--s4);max-width:72ch">SSCIM separates evidence, declared assumptions and computed outputs. Consult this document&rsquo;s scope and limitations before relying on a result.</p>
</header>`;

  /* Reading order, which is the order findMarkdownDocs publishes: the
     documents a first-time reader should meet first, then the rest
     alphabetically. The library can be read through, not only searched. */
  const prev = docs[i - 1];
  const next = docs[i + 1];
  const card = (d, dir, cls) => (d
    ? `<a class="${cls}" href="${escape(relativePage(doc.path, d.path))}" rel="${cls === 'next' ? 'next' : 'prev'}">
    <span class="dir">${dir}</span><span class="what">${escape(d.title.replace(/^SSCIM\s*[—-]\s*/, ''))}</span>
  </a>`
    : '<span class="spacer"></span>');
  const pager = `<nav class="pager" aria-label="Previous and next document">
  ${card(prev, 'Previous', 'prev')}
  ${card(next, 'Next', 'next')}
</nav>`;

  const foot = `<p class="doc-foot">Rendered from <code>${escape(doc.path)}</code>.
<a href="https://github.com/RailgunBreaker/sscim/blob/main/${doc.path}">View the source on GitHub</a> ·
<a href="${root}docs.html">Back to the library</a></p>`;

  const page = readerLayout({
    head,
    content: body,
    toc: items.length ? { spy: makeToc(items, { spy: true }), plain: makeToc(items) } : null,
    tree: makeTree(docs, doc.path, doc.path),
    pager,
    foot,
  });

  const target = path.join(outDir, pageFor(doc.path));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, shell({
    title: doc.title,
    description: doc.summary || `${doc.title} — SSCIM project documentation.`,
    path: pageFor(doc.path),
    body: page,
    root,
  }), 'utf8');
  written++;
}

/* A directory index at /docs/, so the folder itself is browsable. Grouped by
   folder and alphabetical within each, matching the sidebar tree and the
   searchable library — three renderings of one list should not disagree about
   its order. */
const groups = new Map();
const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
for (const doc of [...docs].sort(byTitle)) {
  const dir = doc.path.includes('/') ? doc.path.slice(0, doc.path.lastIndexOf('/')) : '(root)';
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(doc);
}
const orderedGroups = [...groups].sort(([a], [b]) => a.localeCompare(b));
const indexHead = `<header class="doc-head">
  <div class="doc-facts"><span>${docs.length} documents</span></div>
  <h1>SSCIM documentation</h1>
  <p class="lede" style="margin-top:var(--s3);max-width:60ch">Every document in the project, by folder.
  The <a href="../docs.html">searchable library</a> can narrow these by topic, length and section heading.</p>
</header>`;
const indexBody = orderedGroups.map(([dir, list]) => `<h2>${escape(dir)}</h2>
<ul>${list.map((d) => `<li><a href="../${pageFor(d.path)}">${escape(d.title.replace(/^SSCIM\s*[—-]\s*/, ''))}</a> — <span class="small">${d.readingMinutes} min, ${d.tags.map((t) => escape(labelFor(t))).join(', ')}</span></li>`).join('')}</ul>`).join('\n');

await mkdir(path.join(outDir, 'docs'), { recursive: true });
await writeFile(path.join(outDir, 'docs', 'index.html'), shell({
  title: 'Documentation',
  description: `Every one of the ${docs.length} documents in the SSCIM project, by folder.`,
  path: 'docs/',
  body: readerLayout({
    head: indexHead,
    content: indexBody,
    toc: null,
    tree: makeTree(docs, '', 'docs/INDEX.md'),
    pager: '',
    foot: `<p class="doc-foot"><a href="../docs.html">Search and filter the library</a></p>`,
  }),
  root: '../',
}), 'utf8');

console.log(`Published ${written} documentation page(s) + /docs/ index · ${equationCount} equation(s) rendered · KaTeX css + ${fontCount} font(s).`);
