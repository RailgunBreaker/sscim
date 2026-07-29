/* Link rewriting for the generated documentation pages.

   Every Markdown file becomes its own page, at the same path with `.html`
   appended: docs/PUBLIC_GUIDE.md -> /docs/PUBLIC_GUIDE.md.html. Mirroring the
   repository tree is what makes this simple — the documents are authored to
   read on GitHub, so their links are already repo-relative, and once the
   output tree has the same shape a link only needs `.html` appended for the
   browser's own relative resolution to land it in the right place. `../` and
   nested paths keep working with no path arithmetic.

   What is NOT a document still has to go somewhere real: links to source
   files, CSVs and directories point at GitHub rather than at a path this
   static host does not serve.

   Heading ids are added here too — marked 18 stopped emitting them, so
   in-page `#section` anchors would otherwise be dead. */

const REPO_BLOB = 'https://github.com/RailgunBreaker/sscim/blob/main';

/* Resolve `href` relative to the directory holding `fromPath`, collapsing
   . and .. the way a browser would. Used to check a link against the set of
   known documents; the emitted href stays relative. */
export function resolvePath(fromPath, href) {
  const base = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
  const segments = href.startsWith('/') ? href.slice(1).split('/') : `${base}/${href}`.split('/');
  const out = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/* Stable ids so in-document anchors resolve. Repeats get a numeric suffix,
   matching GitHub's behaviour. */
export function addHeadingIds(html) {
  const seen = new Map();
  return html.replace(/<h([1-6])>(.*?)<\/h\1>/gs, (match, level, inner) => {
    const base = slugify(inner);
    if (!base) return match;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count ? `${base}-${count}` : base;
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
}

/* `known` is the Set of repo-relative .md paths that have a generated page. */
export function rewriteLinks(html, fromPath, known) {
  return html.replace(/<a href="([^"]*)"/g, (match, href) => {
    if (/^(https?:|mailto:|#)/i.test(href)) return match; // external or in-page
    const [target, hash] = href.split('#');
    if (!target) return match;
    const resolved = resolvePath(fromPath, target);

    if (known.has(resolved)) {
      return `<a href="${target}.html${hash ? `#${hash}` : ''}" data-doc="${resolved}"`;
    }
    // A directory link such as `computation-demo/` usually means its README.
    const asIndex = `${resolved.replace(/\/$/, '')}/README.md`;
    if (known.has(asIndex)) {
      const rel = `${target.replace(/\/$/, '')}/README.md.html`;
      return `<a href="${rel}" data-doc="${asIndex}"`;
    }
    // A real repository path — source file, CSV, folder. Send it to GitHub
    // rather than to a 404 on this host.
    return `<a href="${REPO_BLOB}/${resolved}" target="_blank" rel="noreferrer"`;
  });
}

/* Where a Markdown path is published. */
export const pageFor = (path) => `${path}.html`;

/* Relative prefix from a generated page back to the site root, so page chrome
   can link to /index.html and /docs.html from any depth. */
export const rootPrefix = (path) => '../'.repeat(path.split('/').length - 1) || './';
