// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildTooltipEl } from './tooltip.js';

describe('buildTooltipEl() — tooltip content is always treated as text, never markup', () => {
  it('renders a malicious-looking string as literal text instead of an executable element', () => {
    const malicious = '<img src=x onerror="window.__pwned = true">';
    const el = buildTooltipEl([{ text: malicious }]);
    // the literal string must survive as visible text...
    expect(el.textContent).toContain(malicious);
    // ...and must NOT have been parsed into a real <img> element anywhere in the tree.
    expect(el.querySelector('img')).toBeNull();
    expect(window.__pwned).toBeUndefined();
  });

  it('escapes markup across multiple lines built from dataset-derived strings', () => {
    const el = buildTooltipEl([
      { text: 'Company " onclick="alert(1)" x="', bold: true },
      { text: '<script>window.__pwned2 = true</script>', color: '#fff' },
    ]);
    expect(el.querySelectorAll('script').length).toBe(0);
    expect(window.__pwned2).toBeUndefined();
    expect(el.children.length).toBe(2);
  });
});
