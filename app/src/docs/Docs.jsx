import { useEffect, useMemo, useState } from 'react';
import { DOCUMENT_LIBRARY } from './generated-library.js';
import { pageFor } from './docLinks.js';
import { TAG_ORDER, labelFor } from './docTags.js';

/* The searchable, filterable index over the documentation.

   Each document is published as its own page by scripts/build-doc-pages.mjs
   (docs/PUBLIC_GUIDE.md -> /docs/PUBLIC_GUIDE.md.html), so this page lists and
   narrows rather than rendering content. That split is deliberate: a document
   gets a real, shareable, crawlable URL instead of living behind an in-page
   route, and there is exactly one renderer to keep correct.

   Tags exist because roughly sixty documents is more than anyone wants to scan
   to find the three that match why they came. Selecting tags is additive
   (union, not intersection): picking "Mathematics" and "Data" widens the list
   rather than narrowing it to their overlap, which is what a reader browsing
   by interest actually wants. The selection lives in the URL hash so a
   filtered view can be shared, and so the tag chips on each document page can
   link back here pre-filtered. */

const STYLE = `
:root{--bg:#0C111C;--panel:#141B2B;--panel2:#0F1626;--line:#243149;--copper:#C98A3F;--amber:#DFA83D;--text:#E9E4D8;--dim:#A5AEC0;--faint:#6E788B}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.68;-webkit-font-smoothing:antialiased}
a{color:var(--copper);text-decoration:none}a:hover{text-decoration:underline}
header{position:sticky;top:0;z-index:5;border-bottom:1px solid var(--line);background:rgba(12,17,28,.94);backdrop-filter:blur(10px)}
.bar{max-width:1120px;margin:auto;padding:14px 24px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.brand{display:flex;align-items:center}.brand img{display:block;width:94px;height:auto;filter:grayscale(1) brightness(0) invert(1)}
.eyebrow{font-size:10.5px;font-weight:700;color:var(--copper);letter-spacing:1.2px}
.nav{display:flex;gap:14px;margin-left:auto;font-size:13px}
.button{border:1px solid var(--copper);border-radius:5px;padding:7px 12px;font-size:13px;font-weight:700}
.fill{background:var(--copper);color:var(--bg)}
main{max-width:1120px;margin:auto;padding:40px 24px 90px}
h1{margin:6px 0 8px;font-size:clamp(28px,4vw,40px);letter-spacing:-.8px}
.lede{color:var(--dim);font-size:14.5px;max-width:70ch;margin:0 0 22px}
.search{width:100%;max-width:460px;background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:6px;padding:11px 12px;font:14px Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.search:focus{outline:1px solid var(--copper)}
.filters{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:16px 0 4px}
.chip{border:1px solid var(--line);background:var(--panel2);color:var(--dim);border-radius:20px;padding:6px 13px;font:12px Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:.2px;cursor:pointer}
.chip:hover{border-color:var(--copper);color:var(--text)}
.chip.on{background:var(--copper);border-color:var(--copper);color:var(--bg);font-weight:700}
.chip .n{opacity:.65;margin-left:5px}
.clear{background:none;border:0;color:var(--faint);font:12px Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;cursor:pointer;text-decoration:underline;padding:6px 4px}
.count{color:var(--faint);font-size:11px;font-weight:600;letter-spacing:1.1px;margin:22px 0 10px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(272px,1fr));gap:12px}
.card{border:1px solid var(--line);background:var(--panel);border-radius:9px;padding:15px;display:block;transition:border-color .15s ease,transform .15s ease}
.card:hover{border-color:var(--copper);transform:translateY(-1px);text-decoration:none}
.card strong{display:block;font-size:14.5px;color:var(--text);font-weight:600}
.card small{display:block;margin-top:5px;color:var(--faint);font-size:11px;word-break:break-all}
.card .tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}
.card .tag{border:1px solid var(--line);color:var(--dim);border-radius:20px;padding:2px 8px;font-size:10.5px}
.group{margin:30px 0 10px;font-size:11px;font-weight:700;letter-spacing:1.3px;color:var(--faint);border-bottom:1px solid var(--line);padding-bottom:7px}
.empty{color:var(--faint);font-size:13px}
.note{border:1px solid #5b4827;background:rgba(223,168,61,.06);border-radius:7px;padding:12px 14px;margin:0 0 26px;color:var(--dim);font-size:13px}
.note b{color:var(--amber)}
@media(max-width:700px){main{padding:26px 18px 60px}.nav{margin-left:0;width:100%;order:3}}
`;

const dirOf = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '(root)');
const readHash = () => {
  const m = /[#&]tag=([^&]+)/.exec(window.location.hash || '');
  return m ? decodeURIComponent(m[1]).split(',').filter(Boolean) : [];
};

export default function Docs() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(readHash);
  const [library, setLibrary] = useState(DOCUMENT_LIBRARY);

  useEffect(() => {
    const onHash = () => setActive(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url = new URL('docs-manifest.json', document.baseURI);
    url.searchParams.set('v', Date.now().toString());

    fetch(url, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Documentation manifest returned ${response.status}`);
        return response.json();
      })
      .then((manifest) => {
        if (!cancelled && Array.isArray(manifest?.documents) && manifest.documents.length > 0) {
          setLibrary(manifest.documents);
        }
      })
      .catch(() => {
        /* The generated module remains a complete offline/static fallback. */
      });

    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    const c = new Map();
    for (const doc of library) for (const tag of doc.tags || []) c.set(tag, (c.get(tag) || 0) + 1);
    return c;
  }, [library]);

  const tags = useMemo(
    () => [...counts.keys()].sort((a, b) => {
      const ai = TAG_ORDER.indexOf(a); const bi = TAG_ORDER.indexOf(b);
      return (ai < 0 ? TAG_ORDER.length : ai) - (bi < 0 ? TAG_ORDER.length : bi) || a.localeCompare(b);
    }),
    [counts],
  );

  const toggle = (tag) => {
    const next = active.includes(tag) ? active.filter((t) => t !== tag) : [...active, tag];
    setActive(next);
    window.history.replaceState(null, '', next.length ? `#tag=${encodeURIComponent(next.join(','))}` : ' ');
  };
  const clear = () => { setActive([]); window.history.replaceState(null, '', ' '); };

  const { matched, groups } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = library.filter((doc) => {
      const hitsQuery = `${doc.path} ${doc.title}`.toLowerCase().includes(q);
      const hitsTag = active.length === 0 || (doc.tags || []).some((t) => active.includes(t));
      return hitsQuery && hitsTag;
    });
    const map = new Map();
    for (const doc of list) {
      const dir = dirOf(doc.path);
      if (!map.has(dir)) map.set(dir, []);
      map.get(dir).push(doc);
    }
    return { matched: list, groups: map };
  }, [query, active, library]);

  return <>
    <style>{STYLE}</style>
    <header><div className="bar">
      <a className="brand" href="index.html" aria-label="SSCIM home"><img src="sscim-logo.png" alt="SSCIM" /></a>
      <span className="eyebrow">DOCUMENTATION LIBRARY</span>
      <nav className="nav">
        <a href="index.html">Home</a>
        <a href="intro.html">Guide</a>
        <a className="button fill" href="sscim-app.html">Open dashboard</a>
      </nav>
    </div></header>
    <main>
      <h1>Documentation</h1>
      <p className="lede">Every Markdown document in the project, published as its own page with equations rendered. Filter by what you came for, or search by name.</p>
      <div className="note"><b>Reading note:</b> SSCIM separates evidence, declared assumptions, and computed outputs. Consult each document’s scope and limitations before relying on a result.</div>

      <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter documents…" aria-label="Filter documents by name" />

      <div className="filters" role="group" aria-label="Filter documents by tag">
        {tags.map((tag) => <button
          key={tag}
          type="button"
          className={`chip ${active.includes(tag) ? 'on' : ''}`}
          aria-pressed={active.includes(tag)}
          onClick={() => toggle(tag)}
        >{labelFor(tag)}<span className="n">{counts.get(tag)}</span></button>)}
        {active.length > 0 && <button type="button" className="clear" onClick={clear}>clear</button>}
      </div>

      <p className="count">{matched.length} OF {library.length} DOCUMENTS{active.length ? ` · ${active.map(labelFor).join(' + ')}` : ''}</p>
      {matched.length === 0 && <p className="empty">No document matches that combination.</p>}
      {[...groups].map(([dir, list]) => <section key={dir}>
        <p className="group">{dir.toUpperCase()}</p>
        <div className="cards">
          {list.map((doc) => <a className="card" key={doc.path} href={pageFor(doc.path)}>
            <strong>{doc.title.replace(/^SSCIM\s*[—-]\s*/, '')}</strong>
            <small>{doc.path}</small>
            <span className="tags">{(doc.tags || []).map((t) => <span className="tag" key={t}>{labelFor(t)}</span>)}</span>
          </a>)}
        </div>
      </section>)}
    </main>
  </>;
}
