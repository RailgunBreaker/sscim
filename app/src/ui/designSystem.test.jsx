// @vitest-environment jsdom
/* Regression tests for the visual system and the interface contracts the
   redesign must not break.

   These assert PROPERTIES, not pixels: contrast ratios, the typography
   floor, control semantics, accessible names, and the specific behaviours
   the brief requires to survive — the three-hop default, flow-direction
   animation classes, reduced-motion handling, and translated labels in all
   four languages.

   A screenshot suite shows what the product looks like; this shows what it
   is obliged to do. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { C } from '../theme.js';
import { color, font, control, space, typeStyle } from './tokens.js';
import { Button, IconButton, SegmentedControl, Tabs, Panel, SectionHeader, StatusBadge, Metric, Disclosure, EmptyState } from './primitives.jsx';
import { I18N } from '../i18n/index.js';
import { DEFAULT_FACILITY_HOPS } from '../interaction/reducer.js';

/* ------------------------------------------------------------ contrast */

const srgb = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};
const contrast = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const SURFACES = { page: C.bg, panel: C.panel, sunken: C.panel2 };
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

describe('colour contrast (WCAG AA)', () => {
  it('computes a known ratio correctly, so the check itself is trustworthy', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#000000', '#000000')).toBeCloseTo(1, 5);
  });

  for (const [name, bg] of Object.entries(SURFACES)) {
    it(`primary text passes AA on the ${name} surface`, () => {
      expect(contrast(C.text, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
    it(`secondary text passes AA on the ${name} surface`, () => {
      expect(contrast(C.dim, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
    /* The specific defect this pass fixed: `faint` was #5A6478, which
       scored 2.89:1 on a panel while carrying 9-10px essential metadata. */
    it(`muted text passes AA on the ${name} surface — it did not before`, () => {
      expect(contrast(C.faint, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
    it(`the copper accent passes AA on the ${name} surface`, () => {
      expect(contrast(C.copper, bg)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }

  it('rejects the old muted value, so it cannot be restored unnoticed', () => {
    expect(contrast('#5A6478', C.panel)).toBeLessThan(AA_NORMAL);
    expect(C.faint).not.toBe('#5A6478');
  });

  it('state colours are distinguishable from the surface at large-text contrast', () => {
    for (const [state, hex] of Object.entries({ adverse: C.red, warning: C.amber, mitigating: C.green })) {
      expect(contrast(hex, C.panel), state).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });

  it('text on the copper fill passes AA, since primary buttons use it', () => {
    expect(contrast(color.text.onAccent, C.copper)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

/* ---------------------------------------------------------- typography */

describe('typography floor', () => {
  const SRC = resolve(import.meta.dirname, '..');
  const GRAPH_FILES = new Set(['FlowGraph.jsx', 'NetworkGraph.jsx', 'FacilityGraph.jsx', 'Spark.jsx',
    'SpreadTree.jsx', 'UpstreamTree.jsx', 'CustomerSpreadTree.jsx', 'IndexHistory.jsx']);

  const walk = (dir) => readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(jsx?|)$/.test(e) && /\.(js|jsx)$/.test(e) && !e.includes('.test.') ? [full] : [];
  });

  const offenders = [];
  for (const file of walk(SRC)) {
    const name = file.split(/[\\/]/).pop();
    const floor = GRAPH_FILES.has(name) ? 11 : 12;
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/fontSize:\s*([0-9]+(?:\.[0-9]+)?)/g)) {
      if (Number(m[1]) < floor) offenders.push(`${name}: fontSize ${m[1]} (floor ${floor})`);
    }
  }

  it('no essential text is set below 12px, and no graph annotation below 11px', () => {
    expect(offenders).toEqual([]);
  });

  it('states the floor in the tokens, so the rule has one home', () => {
    expect(font.size.meta).toBe(12);
    expect(font.size.annotation).toBe(11);
    expect(font.size.body).toBeGreaterThanOrEqual(14);
  });

  it('reserves letter-spacing for the single eyebrow style', () => {
    expect(font.tracking.normal).toBe(0);
    expect(typeStyle.heading.letterSpacing).toBe(0);
    expect(typeStyle.title.letterSpacing).toBe(0);
  });

  it('sizes touch targets to the 44px floor', () => {
    expect(control.touch).toBe(44);
  });

  it('uses a 4px spacing scale with no off-scale values', () => {
    for (const v of Object.values(space)) expect(v % 4).toBe(0);
  });
});

/* ------------------------------------------------- primitive behaviour */

let container; let root;
const mount = async (el) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(el); });
};
afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  container?.remove();
  root = null; container = null;
});

describe('Button', () => {
  it('renders a real button carrying the shared class', async () => {
    await mount(<Button>Save</Button>);
    const b = container.querySelector('button');
    expect(b.textContent).toBe('Save');
    expect(b.className).toContain('ui-button');
  });

  it('can render as a link without losing its appearance', async () => {
    await mount(<Button as="a" href="#x">Docs</Button>);
    expect(container.querySelector('a')).toBeTruthy();
    expect(container.querySelector('button')).toBeNull();
  });
});

describe('IconButton', () => {
  it('requires an accessible name — an icon alone is not a label', async () => {
    await expect(mount(<IconButton>i</IconButton>)).rejects.toThrow(/accessible name/i);
  });

  it('exposes the name to assistive technology and as a tooltip', async () => {
    await mount(<IconButton label="About this model">i</IconButton>);
    const b = container.querySelector('button');
    expect(b.getAttribute('aria-label')).toBe('About this model');
    expect(b.getAttribute('title')).toBe('About this model');
  });
});

describe('SegmentedControl', () => {
  const OPTIONS = [
    { value: 'a', label: 'Structural' },
    { value: 'b', label: 'Operational' },
    { value: 'c', label: 'Hazard', disabled: true },
  ];

  it('is a radiogroup with exactly one checked option', async () => {
    await mount(<SegmentedControl label="Shading" options={OPTIONS} value="a" onChange={() => {}} />);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group.getAttribute('aria-label')).toBe('Shading');
    const checked = container.querySelectorAll('[role="radio"][aria-checked="true"]');
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toBe('Structural');
  });

  it('marks an unavailable option disabled rather than hiding it', async () => {
    await mount(<SegmentedControl label="Shading" options={OPTIONS} value="a" onChange={() => {}} />);
    const radios = [...container.querySelectorAll('[role="radio"]')];
    expect(radios).toHaveLength(3);
    expect(radios[2].disabled).toBe(true);
  });

  it('does not report a choice the reader cannot make', async () => {
    let picked = null;
    await mount(<SegmentedControl label="Shading" options={OPTIONS} value="a" onChange={(v) => { picked = v; }} />);
    const radios = [...container.querySelectorAll('[role="radio"]')];
    await act(async () => { radios[2].click(); });
    expect(picked).toBeNull();
    await act(async () => { radios[1].click(); });
    expect(picked).toBe('b');
  });

  it('scrolls itself rather than widening the page', async () => {
    await mount(<SegmentedControl label="Shading" options={OPTIONS} value="a" onChange={() => {}} />);
    const group = container.querySelector('[role="radiogroup"]');
    expect(group.style.overflowX).toBe('auto');
    expect(group.style.maxWidth).toBe('100%');
  });
});

describe('Tabs', () => {
  const TABS = [
    { value: 'events', label: 'Events' },
    { value: 'history', label: 'History' },
    { value: 'companies', label: 'Companies' },
  ];

  it('uses tablist semantics with a roving tabindex', async () => {
    await mount(<Tabs label="Sections" tabs={TABS} value="history" onChange={() => {}} />);
    expect(container.querySelector('[role="tablist"]').getAttribute('aria-label')).toBe('Sections');
    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs).toHaveLength(3);
    expect(tabs.filter((t) => t.getAttribute('aria-selected') === 'true')).toHaveLength(1);
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('moves with the arrow keys and wraps, per the tablist contract', async () => {
    let value = 'events';
    const render = async () => mount(<Tabs label="Sections" tabs={TABS} value={value} onChange={(v) => { value = v; }} />);
    await render();
    const list = container.querySelector('[role="tablist"]');
    const key = (k) => act(async () => {
      list.dispatchEvent(Object.assign(new window.KeyboardEvent('keydown', { key: k, bubbles: true }), {}));
    });
    await key('ArrowRight');
    expect(value).toBe('history');
    value = 'events';
    await key('ArrowLeft');
    expect(value).toBe('companies');   // wraps to the end
    value = 'events';
    await key('End');
    expect(value).toBe('companies');
    value = 'companies';
    await key('Home');
    expect(value).toBe('events');
  });

  it('points aria-controls at the panel the caller names', async () => {
    await mount(<Tabs label="Panel" idPrefix="panetab" panelIdFor={(v) => `pane-${v}`} tabs={TABS} value="events" onChange={() => {}} />);
    const first = container.querySelector('[role="tab"]');
    expect(first.getAttribute('aria-controls')).toBe('pane-events');
  });
});

describe('StatusBadge', () => {
  it('carries a word as well as a colour, so meaning is never colour alone', async () => {
    await mount(<StatusBadge tone="adverse">Hazard applied</StatusBadge>);
    expect(container.textContent).toContain('Hazard applied');
    /* The dot is decoration and must be hidden from assistive technology. */
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('Disclosure', () => {
  it('starts closed, reports its state, and controls the region it names', async () => {
    await mount(<Disclosure summary="How this is calculated"><p>Detail</p></Disclosure>);
    const btn = container.querySelector('button');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const region = document.getElementById(btn.getAttribute('aria-controls'));
    expect(region.hidden).toBe(true);
    await act(async () => { btn.click(); });
    expect(container.querySelector('button').getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[hidden]')).toBeNull();
  });
});

describe('EmptyState, Metric, Panel, SectionHeader', () => {
  it('an empty state says what to do next, not merely that there is nothing', async () => {
    await mount(<EmptyState title="No plant selected" description="Search for a facility to trace its network." action={<Button>Browse facilities</Button>} />);
    expect(container.textContent).toContain('Search for a facility');
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('a metric renders label, value and caption in that hierarchy', async () => {
    await mount(<Metric label="Chain index" value="6.03" caption="−0.11 over 7 days" />);
    const text = container.textContent;
    expect(text.indexOf('Chain index')).toBeLessThan(text.indexOf('6.03'));
    expect(text.indexOf('6.03')).toBeLessThan(text.indexOf('−0.11'));
  });

  it('a panel draws exactly one boundary', async () => {
    await mount(<Panel><div>inner</div></Panel>);
    const section = container.querySelector('section');
    expect(section.style.border).toContain('1px solid');
    expect(section.querySelector('section')).toBeNull();
  });

  it('a section header renders a real heading element', async () => {
    await mount(<SectionHeader title="Countries by exposure" description="Ranked on the metric currently shaded." />);
    expect(container.querySelector('h2')?.textContent).toBe('Countries by exposure');
  });
});

/* ------------------------------------------------ preserved behaviours */

describe('behaviours the redesign must preserve', () => {
  it('keeps the three-hop facility default', () => {
    expect(DEFAULT_FACILITY_HOPS).toBe(3);
  });

  it('keeps flow-direction animation classes on the facility graph', () => {
    const src = readFileSync(resolve(import.meta.dirname, '../components/FacilityGraph.jsx'), 'utf8');
    /* Direction is carried by the animation, so the classes that encode it
       are behaviour, not decoration. */
    expect(src).toMatch(/flow/i);
    expect(src).toMatch(/prefers-reduced-motion/);
  });

  it('honours prefers-reduced-motion wherever something animates', () => {
    const roots = [resolve(import.meta.dirname, '..')];
    const animated = [];
    const missing = [];
    const walk = (dir) => readdirSync(dir).forEach((e) => {
      const full = join(dir, e);
      if (statSync(full).isDirectory()) return walk(full);
      if (!/\.(js|jsx)$/.test(e) || e.includes('.test.')) return;
      const src = readFileSync(full, 'utf8');
      if (!/@keyframes|animation:/.test(src)) return;
      animated.push(e);
      if (!/prefers-reduced-motion/.test(src)) missing.push(e);
    });
    roots.forEach(walk);
    expect(animated.length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});

/* ------------------------------------------------------ translations */

describe('translated control labels', () => {
  const LANGS = ['zh', 'tw', 'ja'];
  const RENAMED = ['Help', 'Generate briefing'];

  it('carries the renamed primary actions in every supported language', () => {
    for (const lang of LANGS) {
      for (const key of RENAMED) {
        expect(I18N[lang][key], `${lang}.${key}`).toBeTruthy();
        expect(I18N[lang][key], `${lang}.${key}`).not.toBe(key);
      }
    }
  });

  it('has dropped the decorated keys the actions were renamed from', () => {
    for (const lang of LANGS) {
      expect(I18N[lang]['? Guide']).toBeUndefined();
      expect(I18N[lang]['⚡ GP Briefing']).toBeUndefined();
    }
  });

  it('keeps the intelligence-panel section keys, which the tab labels look up', () => {
    for (const lang of LANGS) {
      for (const key of ['EVENTS', 'HISTORY', 'COMPANIES', 'CAPITAL']) {
        expect(I18N[lang][key], `${lang}.${key}`).toBeTruthy();
      }
    }
  });

  it('carries no decorative glyph in a translated primary action', () => {
    for (const lang of LANGS) {
      for (const key of RENAMED) {
        expect(I18N[lang][key]).not.toMatch(/[⚡★⇄⌖◍✦?]/);
      }
    }
  });
});
