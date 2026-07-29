import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolvePath, addHeadingIds, rewriteLinks, pageFor, rootPrefix } from './docLinks.js';
import { DOCUMENT_LIBRARY } from './generated-library.js';

/* Every Markdown file is published as its own page at <path>.md.html, so the
   documents keep their repo-relative links and the browser resolves them.
   These tests exist because the previous behaviour rendered those links
   verbatim and /PUBLIC_GUIDE.md was a 404 on the deployed site. */

const repoDir = path.resolve(__dirname, '..', '..', '..');
const KNOWN = new Set(DOCUMENT_LIBRARY.map((d) => d.path));
const contentOf = (p) => readFileSync(path.join(repoDir, p), 'utf8');

describe('resolvePath', () => {
  it('resolves a sibling link', () => {
    expect(resolvePath('docs/README.md', 'PUBLIC_GUIDE.md')).toBe('docs/PUBLIC_GUIDE.md');
  });
  it('resolves a nested link', () => {
    expect(resolvePath('docs/README.md', 'computation-demo/DATA_PIPELINE.md')).toBe('docs/computation-demo/DATA_PIPELINE.md');
  });
  it('resolves a parent link', () => {
    expect(resolvePath('docs/computation-demo/COMPUTATION_DEMO.md', '../calculation/README.md')).toBe('docs/calculation/README.md');
  });
});

describe('addHeadingIds', () => {
  it('adds slug ids, since marked 18 emits none', () => {
    expect(addHeadingIds('<h2>Operational layer</h2>')).toBe('<h2 id="operational-layer">Operational layer</h2>');
  });
  it('disambiguates repeated headings', () => {
    const out = addHeadingIds('<h2>Purpose</h2><h2>Purpose</h2>');
    expect(out).toContain('id="purpose"');
    expect(out).toContain('id="purpose-1"');
  });
});

describe('rewriteLinks', () => {
  const rewrite = (html, from = 'docs/README.md') => rewriteLinks(html, from, KNOWN);

  it('appends .html and keeps the link relative', () => {
    expect(rewrite('<a href="PUBLIC_GUIDE.md"')).toContain('href="PUBLIC_GUIDE.md.html"');
  });
  it('keeps nested and parent paths intact', () => {
    expect(rewrite('<a href="computation-demo/DATA_PIPELINE.md"')).toContain('href="computation-demo/DATA_PIPELINE.md.html"');
    expect(rewrite('<a href="../calculation/README.md"', 'docs/computation-demo/X.md'))
      .toContain('href="../calculation/README.md.html"');
  });
  it('preserves a heading anchor', () => {
    expect(rewrite('<a href="METHODOLOGY.md#operational-layer"')).toContain('href="METHODOLOGY.md.html#operational-layer"');
  });
  it('sends a repository source file to GitHub rather than a 404', () => {
    const out = rewrite('<a href="../app/src/engine/priors.js"');
    expect(out).toContain('https://github.com/RailgunBreaker/sscim/blob/main/app/src/engine/priors.js');
    expect(out).toContain('target="_blank"');
  });
  it('maps a directory link to its README page', () => {
    expect(rewrite('<a href="calculation/"')).toContain('href="calculation/README.md.html"');
  });
  it('leaves external and in-page links alone', () => {
    expect(rewrite('<a href="https://example.com"')).toBe('<a href="https://example.com"');
    expect(rewrite('<a href="#section"')).toBe('<a href="#section"');
  });
});

describe('page addressing', () => {
  it('publishes each document beside its source path', () => {
    expect(pageFor('docs/PUBLIC_GUIDE.md')).toBe('docs/PUBLIC_GUIDE.md.html');
  });
  it('computes a root prefix for any depth', () => {
    expect(rootPrefix('docs/PUBLIC_GUIDE.md')).toBe('../');
    expect(rootPrefix('docs/calculation/06-event-decay.md')).toBe('../../');
  });
});

/* The regression that started this: nothing rendered may still point at a
   Markdown path, and every document-to-document link must resolve to a
   document that actually exists. */
describe('the whole library', () => {
  const rendered = DOCUMENT_LIBRARY.map((doc) => ({
    ...doc,
    html: rewriteLinks(marked.parse(contentOf(doc.path), { gfm: true }), doc.path, KNOWN),
  }));

  it('leaves no bare .md link in any rendered document', () => {
    const offenders = [];
    for (const doc of rendered) {
      for (const m of doc.html.matchAll(/<a [^>]*href="([^"]*)"/g)) {
        const href = m[1];
        if (/^(https?:|mailto:|#)/i.test(href)) continue;
        if (/\.md(#|$)/i.test(href)) offenders.push(`${doc.path} -> ${href}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('resolves every cross-reference to a document that exists', () => {
    const broken = [];
    for (const doc of rendered) {
      for (const m of doc.html.matchAll(/data-doc="([^"]*)"/g)) {
        if (!KNOWN.has(m[1])) broken.push(`${doc.path} -> ${m[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('lands every relative link on a real generated page path', () => {
    const broken = [];
    const pages = new Set(DOCUMENT_LIBRARY.map((d) => pageFor(d.path)));
    for (const doc of rendered) {
      for (const m of doc.html.matchAll(/<a [^>]*href="([^"]*)"/g)) {
        const href = m[1];
        if (/^(https?:|mailto:|#)/i.test(href)) continue;
        const resolved = resolvePath(pageFor(doc.path), href.split('#')[0]);
        if (!pages.has(resolved)) broken.push(`${doc.path} -> ${href} (=> ${resolved})`);
      }
    }
    expect(broken).toEqual([]);
  });
});
