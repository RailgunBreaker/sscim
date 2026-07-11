import { describe, it, expect } from 'vitest';
import { layoutCentres, edgePath } from './topologyLayout.js';

const centres = [
  { id: 'us::s1', tierId: 0, countryId: 'us', networkInfluence: 5 },
  { id: 'jp::s1', tierId: 0, countryId: 'jp', networkInfluence: 8 },
  { id: 'us::s2', tierId: 1, countryId: 'us', networkInfluence: 3 },
  { id: 'cn::s3', tierId: 2, countryId: 'cn', networkInfluence: 2 },
];

describe('layoutCentres()', () => {
  it('places every centre and keeps positions within bounds', () => {
    const pos = layoutCentres(centres, { width: 1000, height: 500, tierCount: 7 });
    expect(Object.keys(pos)).toHaveLength(4);
    Object.values(pos).forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(500);
    });
  });

  it('gives centres in the same tier the same x and different tiers different x', () => {
    const pos = layoutCentres(centres, { width: 1000, height: 500, tierCount: 7 });
    expect(pos['us::s1'].x).toBeCloseTo(pos['jp::s1'].x, 9);
    expect(pos['us::s1'].x).toBeLessThan(pos['us::s2'].x);
    expect(pos['us::s2'].x).toBeLessThan(pos['cn::s3'].x);
  });

  it('is deterministic across runs', () => {
    const a = layoutCentres(centres);
    const b = layoutCentres(centres);
    expect(a).toEqual(b);
  });

  it('orders within a tier by network influence (strongest first / topmost)', () => {
    const pos = layoutCentres(centres, { width: 1000, height: 500 });
    // jp (NI 8) should sit above us (NI 5) in tier 0 → smaller y
    expect(pos['jp::s1'].y).toBeLessThan(pos['us::s1'].y);
  });

  it('edgePath returns a bezier between two points and empty for missing endpoints', () => {
    expect(edgePath({ x: 0, y: 0 }, { x: 10, y: 10 })).toMatch(/^M0,0 C/);
    expect(edgePath(null, { x: 1, y: 1 })).toBe('');
  });
});
