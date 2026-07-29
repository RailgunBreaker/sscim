import { describe, it, expect } from 'vitest';
import { marked } from 'marked';
import { extractMath, restoreMath } from './docMath.js';
import { findMarkdownDocs } from '../../scripts/lib/find-markdown.mjs';

/* The documents carry mathematics in both notations GitHub accepts —
   ```math fences and $…$ / $$…$$ — and marked understands neither. What these
   tests protect is the boundary: everything that IS an equation gets
   rendered, and nothing that merely contains a dollar sign gets mistaken for
   one. A shell snippet with $PATH and a price of $5 are the two ways this
   goes wrong in practice. */

const D = '$';
const render = (md) => {
  const { markdown, math } = extractMath(md);
  return { html: restoreMath(marked.parse(markdown, { gfm: true }), math), count: math.length };
};

describe('extractMath', () => {
  it('renders a ```math fence as display maths', () => {
    const { html, count } = render('```math\nS_{i,e,t} = S_{i,e,0}e^{-kt}\n```');
    expect(count).toBe(1);
    expect(html).toContain('katex-display');
  });

  it('renders $$…$$ as display maths', () => {
    const { html, count } = render(`${D}${D}E = mc^2${D}${D}`);
    expect(count).toBe(1);
    expect(html).toContain('katex-display');
  });

  it('renders $…$ as inline maths', () => {
    const { html, count } = render(`Inline ${D}x = 5${D} here.`);
    expect(count).toBe(1);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('katex-display');
  });

  it('leaves inline code alone', () => {
    const { html, count } = render(`Run \`echo ${D}HOME\` first.`);
    expect(count).toBe(0);
    expect(html).toContain(`echo ${D}HOME`);
  });

  it('leaves fenced code alone', () => {
    const { html, count } = render(`\`\`\`bash\necho ${D}PATH\n\`\`\``);
    expect(count).toBe(0);
    expect(html).toContain(`echo ${D}PATH`);
  });

  it('does not treat currency in prose as maths', () => {
    const { count } = render(`A price of ${D}5 and another of ${D}9.`);
    expect(count).toBe(0);
  });

  it('shows the source instead of throwing on a malformed equation', () => {
    const { html } = render(`${D}${D}\\frac{1${D}${D}`);
    expect(html).toMatch(/math-error|katex/);
  });
});

/* Across the real documents: every equation must render, and none may leave
   raw LaTeX delimiters behind in the output. */
describe('the real documents', () => {
  it('renders every equation in the corpus without leaving delimiters behind', async () => {
    const docs = await findMarkdownDocs();
    let equations = 0;
    const leftovers = [];
    for (const doc of docs) {
      const { markdown, math } = extractMath(doc.content);
      equations += math.length;
      const html = restoreMath(marked.parse(markdown, { gfm: true }), math);
      if (/%%SSCIMMATH\d+%%/.test(html)) leftovers.push(`${doc.path}: unreplaced placeholder`);
      // Code blocks are excluded before checking: the developer guide documents
      // the ```math syntax by showing it, so the literal string legitimately
      // appears there. Only an unrendered fence in prose is a defect.
      const prose = html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '');
      if (prose.includes('```math')) leftovers.push(`${doc.path}: unrendered math fence`);
    }
    expect(leftovers).toEqual([]);
    expect(equations).toBeGreaterThan(300); // the calculation spec alone has 342 fences
  });
});
