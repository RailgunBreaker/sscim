/* Link rewriting for the documentation reader.

   The documents are written to be read two ways: as files on GitHub, and
   rendered inside docs.html. That means their links are repo-relative
   (`PUBLIC_GUIDE.md`, `computation-demo/DATA_PIPELINE.md`,
   `../app/src/engine/priors.js`) and mean different things in each context.

   Rendered as-is, a relative .md link becomes a real navigation to
   /PUBLIC_GUIDE.md on the deployed site. Only dist-app/ is deployed and it
   contains no Markdown, so every one of those links was a 404. This module
   resolves each href against the document that contains it and rewrites it:

     in-library document  -> #doc=<path>, so it selects that document, is
                             shareable, and works with the back button
     other repo file      -> an absolute GitHub blob URL, opened in a new tab
     external / anchor    -> untouched

   Heading ids are added here too: marked 18 stopped emitting them, so every
   in-page `#section` link was also dead. */

const REPO_BLOB = 'https://github.com/RailgunBreaker/sscim/blob/main';

/* Resolve `href` relative to the directory holding `fromPath`, collapsing
   . and .. the way a browser would. Returns a repo-relative path. */
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

/* Give every heading a stable id so in-document anchors resolve. Duplicate
   headings get a numeric suffix, matching GitHub's behaviour. */
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

/* Rewrite every href in the rendered HTML. `known` is the Set of document
   paths the library actually contains. */
export function rewriteLinks(html, fromPath, known) {
  return html.replace(/<a href="([^"]*)"/g, (match, href) => {
    if (/^(https?:|mailto:|#)/i.test(href)) return match; // external or in-page
    const [target, hash] = href.split('#');
    if (!target) return match;
    const resolved = resolvePath(fromPath, target);

    if (known.has(resolved)) {
      return `<a href="#doc=${encodeURIComponent(resolved)}${hash ? `&${hash}` : ''}" data-doc="${resolved}"`;
    }
    // A directory link such as `computation-demo/` usually means its README.
    const asIndex = `${resolved.replace(/\/$/, '')}/README.md`;
    if (known.has(asIndex)) {
      return `<a href="#doc=${encodeURIComponent(asIndex)}" data-doc="${asIndex}"`;
    }
    // Anything else is a real repository path (source files, CSVs, folders):
    // send it to GitHub rather than to a 404 on this host.
    return `<a href="${REPO_BLOB}/${resolved}" target="_blank" rel="noreferrer"`;
  });
}

/* `#doc=<path>&<optional-heading-anchor>` */
export function parseHash(hash) {
  const match = /^#doc=([^&]+)(?:&(.*))?$/.exec(hash || '');
  if (!match) return null;
  return { path: decodeURIComponent(match[1]), anchor: match[2] || null };
}
