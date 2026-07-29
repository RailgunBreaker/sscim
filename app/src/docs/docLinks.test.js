import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import { resolvePath, addHeadingIds, rewriteLinks, parseHash } from './docLinks.js';
import { DOCUMENT_LIBRARY } from './generated-library.js';

/* These documents are authored to read correctly on GitHub, so every internal
   link is repo-relative. Rendered naively that produced real navigations to
   paths the static host does not serve — /PUBLIC_GUIDE.md was a 404. The point
   of these tests is that no rendered link can leave the app for a path that
   does not exist. */

const KNOWN = new Set(DOCUMENT_LIBRARY.map(d => d.path));

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
  it('resolves from a deeply nested document', () => {
    expect(resolvePath('docs/calculation/06-event-decay.md', '07-calculating-the-event-half-life.md'))
      .toBe('docs/calculation/07-calculating-the-event-half-life.md');
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

  it('points a known document at its hash route', () => {
    expect(rewrite('<a href="PUBLIC_GUIDE.md"')).toContain('href="#doc=docs%2FPUBLIC_GUIDE.md"');
  });
  it('preserves a heading anchor across documents', () => {
    expect(rewrite('<a href="METHODOLOGY.md#operational-layer"')).toContain('&operational-layer');
  });
  it('sends a repository source file to GitHub rather than a 404', () => {
    const out = rewrite('<a href="../app/src/engine/priors.js"');
    expect(out).toContain('https://github.com/RailgunBreaker/sscim/blob/main/app/src/engine/priors.js');
    expect(out).toContain('target="_blank"');
  });
  it('maps a directory link to its README', () => {
    expect(rewrite('<a href="calculation/"')).toContain('href="#doc=docs%2Fcalculation%2FREADME.md"');
  });
  it('leaves external and in-page links alone', () => {
    expect(rewrite('<a href="https://example.com"')).toBe('<a href="https://example.com"');
    expect(rewrite('<a href="#section"')).toBe('<a href="#section"');
  });
});

describe('parseHash', () => {
  it('round-trips a document path', () => {
    expect(parseHash('#doc=docs%2FPUBLIC_GUIDE.md')).toEqual({ path: 'docs/PUBLIC_GUIDE.md', anchor: null });
  });
  it('extracts an anchor', () => {
    expect(parseHash('#doc=docs%2FMETHODOLOGY.md&operational-layer'))
      .toEqual({ path: 'docs/METHODOLOGY.md', anchor: 'operational-layer' });
  });
  it('ignores a plain in-page anchor', () => {
    expect(parseHash('#operational-layer')).toBeNull();
  });
});

/* The regression that started this: render every real document and assert no
   rendered link can still resolve to a Markdown path on this host. */
describe('the whole library', () => {
  it('leaves no relative .md link in any rendered document', () => {
    const offenders = [];
    for (const doc of DOCUMENT_LIBRARY) {
      const html = rewriteLinks(marked.parse(doc.content, { gfm: true }), doc.path, KNOWN);
      for (const m of html.matchAll(/<a href="([^"]*)"/g)) {
        const href = m[1];
        if (/^(https?:|mailto:|#)/i.test(href)) continue;
        offenders.push(`${doc.path} -> ${href}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('resolves every in-library cross-reference to a document that exists', () => {
    const broken = [];
    for (const doc of DOCUMENT_LIBRARY) {
      const html = rewriteLinks(marked.parse(doc.content, { gfm: true }), doc.path, KNOWN);
      for (const m of html.matchAll(/data-doc="([^"]*)"/g)) {
        if (!KNOWN.has(m[1])) broken.push(`${doc.path} -> ${m[1]}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
