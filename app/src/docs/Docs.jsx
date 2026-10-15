import { useEffect, useMemo, useRef, useState } from 'react';
import { DOCUMENT_LIBRARY } from './generated-library.js';
import { pageFor } from './docLinks.js';
import { TAG_ORDER, labelFor } from './docTags.js';
import { BASE_CSS, FOOT_CSS } from '../ui/css.js';
import SiteMap from '../components/SiteMap.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

/* ====================================================================
   Docs — the library over every document in the repository.

   Each document is published as its own page by scripts/build-doc-pages.mjs
   (docs/PUBLIC_GUIDE.md -> /docs/PUBLIC_GUIDE.md.html), so this page lists
   and narrows rather than rendering content. That split is deliberate: a
   document gets a real, shareable, crawlable URL instead of living behind an
   in-page route, and there is exactly one renderer to keep correct.

   WHAT CHANGED, AND WHY IT IS BUILT THIS WAY

   The previous version was a search box, a row of tag chips and a grid of
   sixty bordered cards. Three things were wrong with it, and each one is a
   known failure of document-management interfaces:

   1. SEARCH ONLY LOOKED AT PATHS AND TITLES. That finds the document whose
      name you already know, which is not why anyone opens a library. The
      index now carries each document's own level-2 headings and a
      one-sentence summary, and the query matches those too — so "half-life"
      or "licence" finds the documents that discuss it. Where the match came
      from a heading, the heading is shown and linked, so the reader lands on
      the section rather than the top of a 3,000-word document.

   2. THE TAG FILTER HARD-CODED ITS OWN LOGIC. Selecting two tags widened
      the result set (union), which is right for browsing by interest and
      wrong for narrowing ("methodology AND mathematics"). The reader can now
      choose; the control says which it is doing.

   3. EVERY DOCUMENT LOOKED IDENTICAL. Sixty cards of the same size, each
      showing a title and a path. There was nothing to decide with. Each row
      now carries its summary, length, and when it last changed, and the list
      can be sorted and grouped by any of them.

   Every option lives in the URL, so a narrowed, sorted, grouped view is a
   link someone can send. That is the whole reason the options are worth
   having.
   ==================================================================== */

const STYLE = `
${BASE_CSS}
${FOOT_CSS}

.lib{display:grid;grid-template-columns:232px minmax(0,1fr);gap:var(--s7);align-items:start;padding:var(--s6) 0 0}

/* The persistent folder rail. A library of sixty documents in eight
   folders needs a shape the reader can hold in their head; a flat grid
   does not have one. */
.rail{position:sticky;top:76px;max-height:calc(100vh - 110px);overflow:auto}
.rail h2{font-size:var(--t-meta);font-weight:600;color:var(--ink-3);margin:0 0 var(--s2);padding:0 var(--s2)}
/* The second heading follows a GROUP, not the first heading, so the
   adjacent-sibling selector this used never matched and "Topics" sat
   flush against the last folder. */
.rail > div + h2{margin-top:var(--s5);padding-top:var(--s4);border-top:1px solid var(--rule)}
.rail button{
  display:flex;width:100%;gap:var(--s2);align-items:baseline;justify-content:space-between;
  padding:6px var(--s2);border:0;border-radius:var(--r1);background:transparent;
  color:var(--ink-2);font-size:var(--t-small);text-align:left;cursor:pointer;line-height:1.35;
}
.rail button:hover{background:var(--hover);color:var(--ink)}
.rail button[aria-pressed="true"]{background:var(--wash);color:var(--ink);font-weight:600;box-shadow:inset 2px 0 var(--accent)}
.rail button .n{font-variant-numeric:tabular-nums;font-size:var(--t-meta);color:var(--ink-3);font-weight:400;flex-shrink:0}

/* The toolbar. Every option this page has, on one line, in the order a
   reader reaches for them — find, narrow, then arrange. Nothing is hidden
   behind a gear, and nothing shouts. */
.tools{display:grid;gap:var(--s3);padding-bottom:var(--s4);border-bottom:1px solid var(--rule)}
.search-wrap{position:relative;max-width:520px}
.search-wrap .field{padding-left:34px;padding-right:76px;min-height:40px}
.search-wrap .glyph{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--ink-3);pointer-events:none;font-size:var(--t-small)}
.search-wrap kbd{
  position:absolute;right:10px;top:50%;transform:translateY(-50%);
  font-family:var(--mono);font-size:var(--t-meta);color:var(--ink-3);
  border:1px solid var(--rule);border-radius:var(--r1);padding:2px 5px;background:var(--panel);
  pointer-events:none;
}
.search-wrap .clearq{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:transparent;color:var(--ink-3);cursor:pointer;font-size:var(--t-body);padding:4px 6px;border-radius:var(--r1)}
.search-wrap .clearq:hover{color:var(--ink);background:var(--hover)}

.opt{display:flex;align-items:center;gap:var(--s2);flex-wrap:wrap}
.opt > label{font-size:var(--t-meta);color:var(--ink-3)}
.opt select{
  min-height:30px;padding:0 var(--s2);background:var(--sunken);
  border:1px solid var(--control);border-radius:var(--r2);color:var(--ink);font-size:var(--t-meta);cursor:pointer;
}
.opt .div{width:1px;align-self:stretch;background:var(--rule);margin:0 var(--s2)}

.tally{display:flex;align-items:baseline;gap:var(--s3);padding:var(--s4) 0 var(--s3);flex-wrap:wrap}
.tally p{font-size:var(--t-small);color:var(--ink-2)}
.tally b{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}
.tally button{border:0;background:transparent;color:var(--accent);font-size:var(--t-meta);cursor:pointer;padding:2px 0}
.tally button:hover{text-decoration:underline}

.group-head{display:flex;align-items:baseline;gap:var(--s2);margin:var(--s5) 0 var(--s2)}
.group-head h2{font-size:var(--t-small);font-weight:600;color:var(--ink);font-family:var(--mono)}
.group-head span{font-size:var(--t-meta);color:var(--ink-3);font-variant-numeric:tabular-nums}

/* A list, not a grid of cards. Rows share one set of hairline rules, so
   the eye can run down titles and compare lengths and dates — which is
   what a reader does in a library. Sixty equally sized bordered boxes
   makes every document look equally relevant, which is the one thing a
   library must not do. */
.docs{list-style:none;margin:0;padding:0;border-top:1px solid var(--rule)}
.docs > li{border-bottom:1px solid var(--rule-soft)}
.docs > li:last-child{border-bottom:1px solid var(--rule)}
.doc{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--s2) var(--s5);padding:var(--s4) var(--s3);text-decoration:none;color:inherit;align-items:start}
.doc:hover{background:var(--hover);text-decoration:none}
.doc .title{font-size:var(--t-lede);font-weight:600;color:var(--ink);line-height:1.3}
.doc:hover .title{color:var(--accent)}
.doc .sum{font-size:var(--t-small);color:var(--ink-2);margin-top:4px;max-width:78ch;line-height:1.55}
.doc .foot{display:flex;gap:var(--s3);flex-wrap:wrap;align-items:center;margin-top:var(--s2)}
.doc .pathname{font-family:var(--mono);font-size:var(--t-meta);color:var(--ink-3);overflow-wrap:anywhere}
.doc .side{text-align:right;font-size:var(--t-meta);color:var(--ink-3);font-variant-numeric:tabular-nums;white-space:nowrap;line-height:1.6}
.tag{font-size:var(--t-meta);color:var(--ink-3);border:1px solid var(--rule);border-radius:var(--r1);padding:1px 7px;white-space:nowrap}

/* Compact density: for the reader who knows the library and wants the
   whole of it on one screen. */
.docs.compact .doc{grid-template-columns:minmax(0,1fr) auto;padding:7px var(--s3);gap:var(--s4);align-items:baseline}
.docs.compact .title{font-size:var(--t-body)}
.docs.compact .sum,.docs.compact .foot,.docs.compact .hits{display:none}
.docs.compact .pathname{display:inline}

/* Where a query matched inside the document. The reader gets the section,
   not the top of the file. */
.hits{margin:var(--s2) 0 0;padding:0 0 0 var(--s3);list-style:none;border-left:1px solid var(--rule)}
.hits li{margin-top:3px}
.hits a{font-size:var(--t-meta);color:var(--ink-2)}
.hits a:hover{color:var(--accent)}
mark{background:var(--wash);color:var(--ink);border-radius:2px;padding:0 1px}

.empty{padding:var(--s7) 0;text-align:center}
.empty p{font-size:var(--t-small);color:var(--ink-2);max-width:46ch;margin:var(--s2) auto var(--s4)}

@media(max-width:900px){
  .lib{grid-template-columns:minmax(0,1fr);gap:var(--s4);padding-top:var(--s5)}
  .rail{position:static;max-height:none;border:1px solid var(--rule);border-radius:var(--r3);padding:var(--s3)}
  .rail-fold summary{cursor:pointer;font-size:var(--t-small);color:var(--ink-2);padding:var(--s2)}
  .doc{grid-template-columns:minmax(0,1fr)}
  .doc .side{text-align:left}
}
`;

/* ------------------------------------------------------------- state

   Every option is in the URL hash, so any view of the library is a link.
   Defaults are omitted from the hash, which keeps a plain visit clean. */

const DEFAULTS = { q: '', tags: [], match: 'any', sort: 'reading', group: 'folder', density: 'full', folder: '' };

function readHash() {
  const raw = (window.location.hash || '').replace(/^#/, '');
  const p = new URLSearchParams(raw);
  /* `tag=` is the key the document pages' tag links already use, and old
     shared links carry it, so it keeps working. */
  const tags = (p.get('tags') || p.get('tag') || '').split(',').map((t) => t.trim()).filter(Boolean);
  const one = (k, allowed) => (allowed.includes(p.get(k)) ? p.get(k) : DEFAULTS[k]);
  return {
    q: p.get('q') || '',
    tags,
    match: one('match', ['any', 'all']),
    sort: one('sort', ['reading', 'title', 'path', 'recent', 'longest', 'shortest']),
    group: one('group', ['folder', 'tag', 'none']),
    density: one('density', ['full', 'compact']),
    folder: p.get('folder') || '',
  };
}

function writeHash(state) {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.tags.length) p.set('tags', state.tags.join(','));
  for (const k of ['match', 'sort', 'group', 'density', 'folder']) {
    if (state[k] && state[k] !== DEFAULTS[k]) p.set(k, state[k]);
  }
  const qs = p.toString();
  window.history.replaceState(null, '', qs ? `#${qs}` : window.location.pathname + window.location.search);
}

const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '(root)');

/* ------------------------------------------------------------ search

   Deliberately simple and explainable: every query word must appear
   somewhere in the document's title, path, tags, summary or headings.
   Ranked by WHERE it matched, because a word in the title means more than
   the same word in the eleventh heading. No fuzzy matching — a library
   search that returns near-misses for an exact term is worse than one
   that returns nothing, because the reader cannot tell which it did. */

const SORTS = {
  reading: { label: 'Reading order' },
  title: { label: 'Title, A–Z' },
  path: { label: 'File path' },
  recent: { label: 'Recently changed' },
  longest: { label: 'Longest first' },
  shortest: { label: 'Shortest first' },
};

function scoreDoc(doc, words) {
  if (!words.length) return { score: 1, hits: [] };
  const title = doc.title.toLowerCase();
  const path = doc.path.toLowerCase();
  const summary = (doc.summary || '').toLowerCase();
  const tags = (doc.tags || []).join(' ').toLowerCase();
  const headings = (doc.headings || []);
  const lowered = headings.map((h) => h.toLowerCase());

  let score = 0;
  for (const w of words) {
    let best = 0;
    if (title.includes(w)) best = 8;
    else if (tags.includes(w)) best = 5;
    else if (path.includes(w)) best = 4;
    else if (lowered.some((h) => h.includes(w))) best = 3;
    else if (summary.includes(w)) best = 2;
    if (!best) return null;          // every word must appear somewhere
    score += best;
  }
  /* Up to three headings that contain a query word, so the reader can go
     straight to the section. */
  const hits = headings.filter((_, i) => words.some((w) => lowered[i].includes(w))).slice(0, 3);
  return { score, hits };
}

const highlight = (text, words) => {
  if (!words.length) return text;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const parts = String(text).split(new RegExp(`(${escaped})`, 'ig'));
  return parts.map((part, i) => (
    words.some((w) => part.toLowerCase() === w) ? <mark key={i}>{part}</mark> : part
  ));
};

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

export default function Docs() {
  const [state, setState] = useState(readHash);
  const [library, setLibrary] = useState(DOCUMENT_LIBRARY);
  const searchRef = useRef(null);

  const set = (patch) => setState((prev) => {
    const next = { ...prev, ...patch };
    writeHash(next);
    return next;
  });

  useEffect(() => {
    const onHash = () => setState(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  /* `/` and ⌘K / Ctrl-K focus the search box. Both, because `/` is the
     convention readers of documentation sites have, and ⌘K is the one
     readers of applications have — and this page is both. */
  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select();
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); searchRef.current?.focus();
      } else if (e.key === 'Escape' && e.target === searchRef.current) {
        searchRef.current.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* The runtime manifest matters on GitHub Pages, whose HTML may be cached
     for several minutes after a deployment: even an older shell can still
     discover the newest document list. The bundled module remains a
     complete offline fallback. */
  useEffect(() => {
    let cancelled = false;
    const url = new URL('docs-manifest.json', document.baseURI);
    url.searchParams.set('v', Date.now().toString());
    fetch(url, { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((m) => {
        if (!cancelled && Array.isArray(m?.documents) && m.documents.length) setLibrary(m.documents);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const tagCounts = useMemo(() => {
    const c = new Map();
    for (const doc of library) for (const tag of doc.tags || []) c.set(tag, (c.get(tag) || 0) + 1);
    return c;
  }, [library]);

  const tags = useMemo(() => [...tagCounts.keys()].sort((a, b) => {
    const ai = TAG_ORDER.indexOf(a); const bi = TAG_ORDER.indexOf(b);
    return (ai < 0 ? TAG_ORDER.length : ai) - (bi < 0 ? TAG_ORDER.length : bi) || a.localeCompare(b);
  }), [tagCounts]);

  const folders = useMemo(() => {
    const c = new Map();
    for (const doc of library) { const d = dirOf(doc.path); c.set(d, (c.get(d) || 0) + 1); }
    return [...c].sort(([a], [b]) => a.localeCompare(b));
  }, [library]);

  const words = useMemo(
    () => state.q.toLowerCase().split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 1),
    [state.q],
  );

  const { rows, groups } = useMemo(() => {
    const order = new Map(library.map((d, i) => [d.path, i])); // reading order, as published
    const matched = [];
    for (const doc of library) {
      if (state.folder && dirOf(doc.path) !== state.folder) continue;
      if (state.tags.length) {
        const docTags = doc.tags || [];
        const ok = state.match === 'all'
          ? state.tags.every((t) => docTags.includes(t))
          : state.tags.some((t) => docTags.includes(t));
        if (!ok) continue;
      }
      const scored = scoreDoc(doc, words);
      if (!scored) continue;
      matched.push({ ...doc, ...scored });
    }

    const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    const comparators = {
      /* With a query present, relevance wins over whatever order was
         asked for — a reader who typed a word wants the best answer
         first, and the sort control still governs the ties. */
      reading: (a, b) => (order.get(a.path) ?? 0) - (order.get(b.path) ?? 0),
      title: byTitle,
      path: (a, b) => a.path.localeCompare(b.path),
      recent: (a, b) => String(b.modified || '').localeCompare(String(a.modified || '')) || byTitle(a, b),
      longest: (a, b) => (b.words || 0) - (a.words || 0),
      shortest: (a, b) => (a.words || 0) - (b.words || 0),
    };
    const cmp = comparators[state.sort] || comparators.reading;
    matched.sort((a, b) => (words.length ? b.score - a.score || cmp(a, b) : cmp(a, b)));

    if (state.group === 'none') return { rows: matched, groups: null };

    const map = new Map();
    const push = (key, doc) => { if (!map.has(key)) map.set(key, []); map.get(key).push(doc); };
    if (state.group === 'folder') {
      for (const doc of matched) push(dirOf(doc.path), doc);
    } else {
      /* A document with three tags appears under all three. That is the
         point of grouping by tag — the reader is browsing by interest, not
         taking an inventory. The tally above says how many documents there
         actually are. */
      for (const doc of matched) for (const t of (doc.tags || ['untagged'])) push(t, doc);
    }
    const keys = [...map.keys()].sort(state.group === 'tag'
      ? (a, b) => {
        const ai = TAG_ORDER.indexOf(a); const bi = TAG_ORDER.indexOf(b);
        return (ai < 0 ? TAG_ORDER.length : ai) - (bi < 0 ? TAG_ORDER.length : bi) || a.localeCompare(b);
      }
      : (a, b) => a.localeCompare(b));
    return { rows: matched, groups: keys.map((k) => [k, map.get(k)]) };
  }, [library, state.folder, state.tags, state.match, state.sort, state.group, words]);

  const narrowed = Boolean(state.q || state.tags.length || state.folder);
  const reset = () => set({ q: '', tags: [], folder: '' });
  const toggleTag = (tag) => set({ tags: state.tags.includes(tag) ? state.tags.filter((t) => t !== tag) : [...state.tags, tag] });

  const Row = ({ doc }) => (
    <li>
      <a className="doc" href={pageFor(doc.path)}>
        <div>
          <span className="title">{highlight(doc.title.replace(/^SSCIM\s*[—-]\s*/, ''), words)}</span>
          {doc.summary && <p className="sum">{highlight(doc.summary, words)}</p>}
          {doc.hits?.length > 0 && (
            <ul className="hits">
              {doc.hits.map((h) => (
                <li key={h}>
                  <span>↳ {highlight(h, words)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="foot">
            <span className="pathname">{doc.path}</span>
            {(doc.tags || []).map((t) => <span className="tag" key={t}>{labelFor(t)}</span>)}
          </div>
        </div>
        <div className="side">
          {doc.readingMinutes ? <>{doc.readingMinutes} min read<br /></> : null}
          {doc.modified || ''}
        </div>
      </a>
    </li>
  );

  return <>
    <style>{STYLE}</style>

    <header className="site-head">
      <div className="shell bar">
        <a className="brand" href="index.html" aria-label="SSCIM home"><img src="sscim-logo.png" alt="SSCIM" /></a>
        {/* A crumb trail, not a shouted section label. It says where you
            are and lets you leave; "DOCUMENTATION LIBRARY" in 10.5px caps
            did neither. */}
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="index.html">SSCIM</a>
          <span className="sep" aria-hidden="true">/</span>
          <span className="here" aria-current="page">Documentation</span>
        </nav>
        <nav className="site-nav" aria-label="Site">
          <a href="intro.html">Guide</a>
          <a href="updates.html">Updates</a>
          <ThemeToggle />
          <a className="btn btn-primary btn-sm" href="sscim-app.html">Open dashboard</a>
        </nav>
      </div>
    </header>

    <main className="shell">
      <div style={{ paddingTop: 'var(--s6)' }}>
        <h1 className="display">Documentation</h1>
        <p className="lede measure" style={{ marginTop: 'var(--s3)' }}>
          Every Markdown document in the project, published as its own page with equations
          rendered. Search matches titles, paths, tags and the documents’ own section headings.
        </p>
        <p className="note measure" style={{ marginTop: 'var(--s4)' }}>
          SSCIM separates evidence, declared assumptions and computed outputs. Consult a
          document’s scope and limitations before relying on a result.
        </p>
      </div>

      <div className="lib">
        <aside className="rail" aria-label="Browse by folder and tag">
          <h2 id="rail-folders">Folders</h2>
          <div role="group" aria-labelledby="rail-folders">
            <button type="button" aria-pressed={!state.folder} onClick={() => set({ folder: '' })}>
              <span>All folders</span><span className="n">{library.length}</span>
            </button>
            {folders.map(([dir, n]) => (
              <button key={dir} type="button" aria-pressed={state.folder === dir}
                onClick={() => set({ folder: state.folder === dir ? '' : dir })}>
                <span>{dir}</span><span className="n">{n}</span>
              </button>
            ))}
          </div>

          <h2 id="rail-tags">Topics</h2>
          <div role="group" aria-labelledby="rail-tags">
            {tags.map((tag) => (
              <button key={tag} type="button" aria-pressed={state.tags.includes(tag)} onClick={() => toggleTag(tag)}>
                <span>{labelFor(tag)}</span><span className="n">{tagCounts.get(tag)}</span>
              </button>
            ))}
          </div>
        </aside>

        <div>
          <div className="tools">
            <div className="search-wrap">
              <span className="glyph" aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                className="field"
                type="search"
                value={state.q}
                onChange={(e) => set({ q: e.target.value })}
                placeholder="Search titles, paths and section headings…"
                aria-label="Search the documentation library"
              />
              {state.q
                ? <button type="button" className="clearq" aria-label="Clear the search" onClick={() => set({ q: '' })}>×</button>
                : <kbd aria-hidden="true">/</kbd>}
            </div>

            <div className="opt">
              <label htmlFor="sort-by">Sort</label>
              <select id="sort-by" value={state.sort} onChange={(e) => set({ sort: e.target.value })}>
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>

              <label htmlFor="group-by">Group</label>
              <select id="group-by" value={state.group} onChange={(e) => set({ group: e.target.value })}>
                <option value="folder">By folder</option>
                <option value="tag">By topic</option>
                <option value="none">Flat list</option>
              </select>

              <span className="div" aria-hidden="true" />

              {/* The union/intersection choice the old page made silently
                  on the reader's behalf. */}
              <span className="seg" role="radiogroup" aria-label="How selected topics combine">
                {[['any', 'Any topic'], ['all', 'All topics']].map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={state.match === v}
                    disabled={state.tags.length < 2}
                    title={state.tags.length < 2 ? 'Select two or more topics' : undefined}
                    onClick={() => set({ match: v })}>{l}</button>
                ))}
              </span>

              <span className="div" aria-hidden="true" />

              <span className="seg" role="radiogroup" aria-label="Row density">
                {[['full', 'Detailed'], ['compact', 'Compact']].map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={state.density === v}
                    onClick={() => set({ density: v })}>{l}</button>
                ))}
              </span>
            </div>
          </div>

          <div className="tally">
            <p aria-live="polite">
              <b>{rows.length}</b> of {library.length} documents
              {state.folder ? <> in <b>{state.folder}</b></> : null}
              {state.tags.length ? <> tagged {state.tags.map(labelFor).join(state.match === 'all' ? ' and ' : ' or ')}</> : null}
              {state.q ? <> matching “{state.q}”</> : null}
            </p>
            {narrowed && <button type="button" onClick={reset}>Clear filters</button>}
          </div>

          {rows.length === 0 ? (
            <div className="empty">
              <h2 className="h3">Nothing matches that</h2>
              <p>
                No document matches this combination. Widening the topics or clearing the
                search will bring the library back.
              </p>
              <button type="button" className="btn" onClick={reset}>Clear filters</button>
            </div>
          ) : groups ? (
            groups.map(([key, list]) => (
              <section key={key} aria-labelledby={`g-${slug(key)}`}>
                <div className="group-head">
                  <h2 id={`g-${slug(key)}`}>{state.group === 'tag' ? labelFor(key) : key}</h2>
                  <span>{list.length}</span>
                </div>
                <ul className={`docs ${state.density === 'compact' ? 'compact' : ''}`}>
                  {list.map((doc) => <Row key={doc.path} doc={doc} />)}
                </ul>
              </section>
            ))
          ) : (
            <ul className={`docs ${state.density === 'compact' ? 'compact' : ''}`} style={{ marginTop: 'var(--s2)' }}>
              {rows.map((doc) => <Row key={doc.path} doc={doc} />)}
            </ul>
          )}
        </div>
      </div>
    </main>

    <SiteMap current="docs" />
  </>;
}
