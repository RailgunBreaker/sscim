/* ====================================================================
   mathRenders.test.js — the maths must render, AND render as intended.

   THE GAP THIS CLOSES. docMath.test.js checked that equations are
   extracted and that no delimiters are left behind. It could not catch a
   wrong equation, for two reasons:

     1. docMath renders with `throwOnError: false`, which is right for the
        page — one bad equation must not blank the document — but it means
        malformed LaTeX "renders" as red error text and every existing
        test still passes.

     2. Some wrong maths is perfectly VALID LaTeX. `$phi$` parses without
        complaint and sets three italic letters, p·h·i, where the author
        meant the single symbol phi. Nothing that only checks for parse
        errors will ever see it. That defect shipped: the specification
        rendered `$\phi$` in its hand-written notation table and `$phi$`
        in its generated parameter table, in the same document, because
        the generator was building LaTeX out of an ASCII string with a
        regex.

   So there are two tests here, and they catch different things.
   ==================================================================== */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { PARAMETERS, STRUCTURAL_WEIGHT_SPECS } from '../engine/registry.js';
import { findMarkdownDocs } from '../../scripts/lib/find-markdown.mjs';

/* The registry symbols that the documentation generator renders inside
   $...$. Model-form symbols are deliberately excluded: they are
   descriptive labels ("HHI bound") and are never typeset as maths. */
const RENDERED_SYMBOLS = { ...PARAMETERS, ...STRUCTURAL_WEIGHT_SPECS };

describe('every registry symbol is valid, intended LaTeX', () => {
  it.each(Object.keys(RENDERED_SYMBOLS))('%s parses under KaTeX in strict mode', (key) => {
    const { symbol } = RENDERED_SYMBOLS[key];
    expect(() => katex.renderToString(symbol, { throwOnError: true, strict: 'error' })).not.toThrow();
  });

  /* A Greek letter written as bare ASCII is valid LaTeX and completely
     wrong output. The rule: once LaTeX commands and the contents of
     \mathrm{}/\text{} are removed, no two letters may remain adjacent —
     which is exactly the difference between `\phi` and `phi`, and between
     `w_{\mathrm{ramp}}` and `w_ramp`. */
  it.each(Object.keys(RENDERED_SYMBOLS))('%s writes multi-letter names as commands or upright text, not bare italics', (key) => {
    const { symbol } = RENDERED_SYMBOLS[key];
    const stripped = symbol
      .replace(/\\(?:mathrm|text|mathbf|mathit|operatorname)\s*\{[^}]*\}/g, '') // upright runs are fine
      .replace(/\\[a-zA-Z]+/g, '');                                             // commands are fine
    expect(stripped).not.toMatch(/[a-zA-Z]{2,}/);
  });

  it('renders phi as a symbol rather than as the letters p, h, i', () => {
    const html = katex.renderToString(PARAMETERS.minimumDependencyFactor.symbol, { throwOnError: true });
    expect(html).toContain('ϕ');   // the actual glyph, not three italic letters
    expect(PARAMETERS.minimumDependencyFactor.symbol).toBe('\\phi');
  });

  /* The generated parameter table and the hand-written notation table sit
     in the same document and used to disagree. Both must use the same
     LaTeX for the same quantity. */
  it('agrees with the notation table in the specification', async () => {
    const docs = await findMarkdownDocs();
    const spec = docs.find((d) => d.path === 'docs/MODEL_V7_SPEC.md');
    expect(spec).toBeTruthy();
    for (const key of Object.keys(RENDERED_SYMBOLS)) {
      const { symbol } = RENDERED_SYMBOLS[key];
      expect(spec.content).toContain(`$${symbol}$`);
    }
  });
});

/* ==================================================================
   THE CORPUS. Every equation in every document must parse. Rendered with
   throwOnError: TRUE here — the opposite of the page, on purpose: the
   page must degrade gracefully, the test must not.
   ================================================================== */
describe('every equation in the documentation corpus parses', () => {
  /* Extraction mirrors docMath.js: ```math fences, $$…$$ and $…$, with
     fenced and inline code skipped, because a shell snippet containing
     $PATH is not an equation. */
  function equationsIn(markdown) {
    const found = [];
    const lines = markdown.split(/\r?\n/);
    const prose = [];
    let inFence = false;
    let fenceLang = '';
    let mathBuf = null;
    for (const line of lines) {
      const fence = line.match(/^\s*```(\w*)/);
      if (fence) {
        if (!inFence) { inFence = true; fenceLang = fence[1]; if (fenceLang === 'math') mathBuf = []; }
        else { if (fenceLang === 'math' && mathBuf) found.push(mathBuf.join('\n')); inFence = false; fenceLang = ''; mathBuf = null; }
        continue;
      }
      if (inFence) { if (mathBuf) mathBuf.push(line); continue; }
      prose.push(line);
    }
    const text = prose.join('\n').replace(/`[^`\n]*`/g, ' ');
    for (const m of text.matchAll(/\$\$([\s\S]+?)\$\$/g)) found.push(m[1]);
    for (const m of text.replace(/\$\$[\s\S]+?\$\$/g, ' ').matchAll(/\$([^$\n]+?)\$/g)) found.push(m[1]);
    return found;
  }

  it('renders every equation without a parse error, and there are many of them', async () => {
    const docs = await findMarkdownDocs();
    const failures = [];
    let total = 0;
    for (const doc of docs) {
      for (const tex of equationsIn(doc.content)) {
        total += 1;
        try {
          katex.renderToString(tex.trim(), { throwOnError: true, strict: false });
        } catch (e) {
          failures.push(`${doc.path}: ${String(e.message).slice(0, 140)}  <-  ${tex.trim().slice(0, 80)}`);
        }
      }
    }
    expect(failures).toEqual([]);
    expect(total).toBeGreaterThan(300);
  });
});
