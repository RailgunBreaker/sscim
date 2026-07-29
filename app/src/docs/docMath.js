/* LaTeX rendering for the documentation pages.

   The documents carry mathematics in the two notations GitHub understands, and
   both have to survive the trip through marked:

     ```math … ```     fenced display blocks (the calculation specification
                       uses 342 of them)
     $$ … $$ / $ … $   display and inline, used by the methodology documents

   marked knows nothing about either, so left alone the equations render as
   literal dollar signs and backslashes.

   The order of operations matters. Math is extracted from the *Markdown*
   before parsing and replaced with inert placeholder tokens, then KaTeX output
   is substituted back into the *HTML* afterwards. Rendering into the Markdown
   first would leave marked to mangle KaTeX's tags and entities; scanning the
   HTML afterwards would mean parsing `$` out of prose and code that marked has
   already escaped.

   Extraction deliberately skips fenced code and inline code spans. A shell
   snippet containing `$VAR` is not an equation, and a document that explains
   the notation will legitimately show `$` in code. */
import katex from 'katex';

const PLACEHOLDER = (i) => `%%SSCIMMATH${i}%%`;

const render = (tex, displayMode) => {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'html',
    });
  } catch (error) {
    // A malformed equation must not take the whole page down: show the source.
    return `<code class="math-error" title="${String(error.message).replace(/"/g, "'")}">${tex.trim()}</code>`;
  }
};

/* Pull every equation out of the Markdown, returning the rewritten source and
   the rendered HTML for each placeholder. */
export function extractMath(markdown) {
  const found = [];
  const take = (tex, displayMode) => {
    found.push(render(tex, displayMode));
    return PLACEHOLDER(found.length - 1);
  };

  const lines = markdown.split('\n');
  const out = [];
  let inFence = false;
  let fenceInfo = '';
  let mathBuffer = null;

  for (const line of lines) {
    const fence = /^\s*```(.*)$/.exec(line);

    if (fence && !inFence) {
      inFence = true;
      fenceInfo = fence[1].trim().toLowerCase();
      if (fenceInfo === 'math' || fenceInfo === 'latex') { mathBuffer = []; continue; }
      out.push(line);
      continue;
    }
    if (fence && inFence) {
      inFence = false;
      if (mathBuffer) {
        // A display block becomes its own paragraph, blank-line delimited so
        // marked does not fold it into the surrounding text.
        out.push('', take(mathBuffer.join('\n'), true), '');
        mathBuffer = null;
        continue;
      }
      out.push(line);
      continue;
    }
    if (mathBuffer) { mathBuffer.push(line); continue; }
    if (inFence) { out.push(line); continue; }

    out.push(replaceDelimited(line, take));
  }

  return { markdown: out.join('\n'), math: found };
}

/* $$…$$ then $…$ on a single line, leaving `inline code` untouched. */
function replaceDelimited(line, take) {
  const segments = line.split(/(`[^`]*`)/g);
  return segments
    .map((segment) => {
      if (segment.startsWith('`')) return segment;
      return segment
        .replace(/\$\$([^$]+?)\$\$/g, (_, tex) => take(tex, true))
        .replace(/(?<![\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\$)/g, (_, tex) => take(tex, false));
    })
    .join('');
}

/* Put the rendered equations back once marked has produced the HTML. */
export function restoreMath(html, math) {
  return html.replace(/%%SSCIMMATH(\d+)%%/g, (match, i) => math[Number(i)] ?? match);
}
