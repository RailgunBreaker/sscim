import { describe, it, expect } from 'vitest';
import { createLayout, neighbourhood, placeLabels, DEFAULT_SETTINGS } from './supplierForce.js';
import { buildSupplierIndex, traverseSuppliers } from './supplierTiers.js';

const ids = ['a', 'b', 'c', 'd', 'e'];
const links = [
  { supplier: 'a', customer: 'b' },
  { supplier: 'b', customer: 'c' },
  { supplier: 'c', customer: 'd' },
  { supplier: 'e', customer: 'a' },
];

const settle = (opts = {}) => {
  const l = createLayout(ids, links, opts);
  l.run(l.total);
  return l;
};

describe('the force layout is deterministic', () => {
  /* The one property a physics layout usually gives up. Without it the
     graph reshuffles on every visit, two readers never see the same
     picture, and a screenshot cannot be reproduced. */
  it('produces identical positions on two separate runs', () => {
    const a = settle().positions();
    const b = settle().positions();
    for (const id of ids) {
      expect(a[id].x).toBe(b[id].x);
      expect(a[id].y).toBe(b[id].y);
    }
  });

  it('does not depend on how the run was chunked', () => {
    const whole = createLayout(ids, links);
    whole.run(whole.total);
    const chunked = createLayout(ids, links);
    while (!chunked.done) chunked.run(7);
    const a = whole.positions();
    const b = chunked.positions();
    for (const id of ids) {
      expect(a[id].x).toBeCloseTo(b[id].x, 9);
      expect(a[id].y).toBeCloseTo(b[id].y, 9);
    }
  });

  it('never calls Math.random', () => {
    const real = Math.random;
    Math.random = () => { throw new Error('the layout must not use Math.random'); };
    try { expect(() => settle()).not.toThrow(); } finally { Math.random = real; }
  });
});

describe('the simulation terminates and stays finite', () => {
  it('reports progress from 0 to 1 and then stops', () => {
    const l = createLayout(ids, links);
    expect(l.progress).toBe(0);
    expect(l.done).toBe(false);
    l.run(l.total);
    expect(l.progress).toBe(1);
    expect(l.done).toBe(true);
    const before = l.positions();
    l.run(50);                       // asking for more must do nothing
    expect(l.positions()).toEqual(before);
  });

  it('keeps every coordinate finite, including for coincident starts', () => {
    const l = settle();
    for (const p of Object.values(l.positions())) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('separates nodes rather than collapsing them onto each other', () => {
    const p = settle().positions();
    let closest = Infinity;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const dx = p[ids[i]].x - p[ids[j]].x;
        const dy = p[ids[i]].y - p[ids[j]].y;
        closest = Math.min(closest, Math.hypot(dx, dy));
      }
    }
    expect(closest).toBeGreaterThan(10);
  });

  it('counts each node’s degree from the links', () => {
    const p = settle().positions();
    expect(p.a.deg).toBe(2);   // a->b and e->a
    expect(p.d.deg).toBe(1);
    expect(p.e.deg).toBe(1);
  });

  it('ignores links whose endpoints are not drawn', () => {
    const l = createLayout(['a', 'b'], [...links, { supplier: 'a', customer: 'ghost' }]);
    l.run(l.total);
    const p = l.positions();
    expect(Object.keys(p)).toEqual(['a', 'b']);
    expect(Number.isFinite(p.a.x)).toBe(true);
  });

  it('returns a bounding box that contains every node', () => {
    const l = settle();
    const p = l.positions();
    const b = l.bounds(20);
    for (const id of ids) {
      expect(p[id].x).toBeGreaterThanOrEqual(b.minX);
      expect(p[id].x).toBeLessThanOrEqual(b.minX + b.w);
      expect(p[id].y).toBeGreaterThanOrEqual(b.minY);
      expect(p[id].y).toBeLessThanOrEqual(b.minY + b.h);
    }
  });
});

describe('tier anchoring', () => {
  it('holds anchored nodes near their band, so upstream stays left', () => {
    const tierX = (id) => ({ a: -400, b: -200, c: 0, d: 200, e: -400 }[id]);
    const p = createLayout(ids, links, { tierX });
    p.run(p.total);
    const pos = p.positions();
    expect(pos.a.x).toBeLessThan(pos.c.x);
    expect(pos.c.x).toBeLessThan(pos.d.x);
  });

  it('spreads freely when no anchor is given', () => {
    const free = settle({ tierX: null }).positions();
    const xs = ids.map((id) => free[id].x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0);
  });

  it('exposes its settings so the caller cannot silently disagree with it', () => {
    expect(DEFAULT_SETTINGS.iterations).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.damping).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.damping).toBeLessThan(1);
  });
});

describe('label placement', () => {
  const opts = { radiusOf: () => 6, labelOf: (id) => id };

  it('always labels the first node in priority order', () => {
    const pos = { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } };
    expect(placeLabels(['a', 'b'], pos, opts).has('a')).toBe(true);
  });

  it('drops a label that would land on one already written', () => {
    /* Two nodes a pixel apart: the second name would sit on top of the
       first, and two unreadable names are worse than one readable one. */
    const pos = { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } };
    const keep = placeLabels(['a', 'b'], pos, opts);
    expect(keep.has('b')).toBe(false);
    expect(keep.size).toBe(1);
  });

  it('keeps both when they are far enough apart', () => {
    const pos = { a: { x: 0, y: 0 }, b: { x: 400, y: 400 } };
    expect(placeLabels(['a', 'b'], pos, opts).size).toBe(2);
  });

  it('is deterministic for the same positions and order', () => {
    const pos = { a: { x: 0, y: 0 }, b: { x: 12, y: 4 }, c: { x: 300, y: 10 }, d: { x: 305, y: 12 } };
    const one = [...placeLabels(['a', 'b', 'c', 'd'], pos, opts)];
    const two = [...placeLabels(['a', 'b', 'c', 'd'], pos, opts)];
    expect(one).toEqual(two);
  });

  it('respects priority: reordering changes which of a clashing pair is written', () => {
    const pos = { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } };
    expect([...placeLabels(['b', 'a'], pos, opts)]).toEqual(['b']);
    expect([...placeLabels(['a', 'b'], pos, opts)]).toEqual(['a']);
  });

  it('accounts for name length, so a long name blocks more', () => {
    const pos = { short: { x: 0, y: 0 }, other: { x: 60, y: 0 } };
    const narrow = placeLabels(['short', 'other'], pos, { ...opts, labelOf: () => 'ab' });
    const wide = placeLabels(['short', 'other'], pos, { ...opts, labelOf: () => 'a'.repeat(40) });
    expect(narrow.size).toBe(2);
    expect(wide.size).toBe(1);
  });

  it('skips nodes it has no position for rather than throwing', () => {
    expect(() => placeLabels(['ghost'], {}, opts)).not.toThrow();
    expect(placeLabels(['ghost'], {}, opts).size).toBe(0);
  });

  it('writes a readable fraction of the real Apple graph', () => {
    const index = buildSupplierIndex();
    const t = traverseSuppliers(index, 'apple-inc', { direction: 'upstream', hops: 2 });
    const l = createLayout(t.nodes.map((n) => n.id), t.links);
    l.run(l.total);
    const p = l.positions();
    const order = t.nodes.map((n) => n.id).sort((a, b) => (p[b].deg - p[a].deg));
    const keep = placeLabels(order.slice(0, 70), p, {
      radiusOf: () => 8,
      labelOf: (id) => index.companies[id].name.slice(0, 34),
    });
    /* Not a target, a floor: if collision rejection ever became so
       aggressive that the graph named almost nothing, this catches it. */
    expect(keep.size).toBeGreaterThan(12);
    expect(keep.size).toBeLessThanOrEqual(70);
  });
});

describe('neighbourhood highlighting', () => {
  it('puts the clicked firm at degree 0 and its direct links at 1', () => {
    const lv = neighbourhood(links, 'b', 2);
    expect(lv.get('b')).toBe(0);
    expect(lv.get('a')).toBe(1);
    expect(lv.get('c')).toBe(1);
  });

  it('reaches two degrees and stops there', () => {
    const lv = neighbourhood(links, 'b', 2);
    expect(lv.get('d')).toBe(2);
    expect(lv.get('e')).toBe(2);
    const lv1 = neighbourhood(links, 'b', 1);
    expect(lv1.has('d')).toBe(false);
  });

  it('ignores direction, because a highlight is about what is attached', () => {
    const lv = neighbourhood(links, 'a', 1);
    expect(lv.get('b')).toBe(1);   // a supplies b
    expect(lv.get('e')).toBe(1);   // e supplies a
  });

  it('works on the real graph without reaching unconnected firms', () => {
    const index = buildSupplierIndex();
    const t = traverseSuppliers(index, 'apple-inc', { direction: 'upstream', hops: 2 });
    const lv = neighbourhood(t.links, 'asml-holding-n-v', 2);
    expect(lv.get('asml-holding-n-v')).toBe(0);
    expect(lv.get('taiwan-semiconductor-manufacturing-company-limited')).toBe(1);
    for (const id of lv.keys()) expect(t.nodes.some((n) => n.id === id)).toBe(true);
  });
});
