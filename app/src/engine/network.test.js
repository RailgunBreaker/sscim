import { describe, it, expect } from 'vitest';
import { buildEngine } from './index.js';
import { buildFunctionalCentres, buildCentreConnections, buildBaseGraph } from './network.js';
import { makeFixtureData } from './testFixture.js';

function fixture() {
  const data = makeFixtureData();
  const engine = buildEngine(data);
  return { data, engine };
}

describe('buildFunctionalCentres() — country × stage from existing participation only', () => {
  it('creates one centre per (country, stage) with a positive existing share, and no others', () => {
    const { data, engine } = fixture();
    const { centres, centreById } = buildFunctionalCentres({ data, engine });
    // fixture: s1 us, s2 us, s3 cn, s4 cn, s5 us, siso us — each single-country
    expect(centreById['us::s1']).toBeTruthy();
    expect(centreById['cn::s3']).toBeTruthy();
    // no centre for a country that has no share in the stage
    expect(centreById['cn::s1']).toBeUndefined();
    // countryShare mirrors the snapshot share exactly (nothing invented)
    expect(centreById['us::s1'].countryShare).toBe(data.STAGES.find((s) => s.id === 's1').shares.us);
    // every centre corresponds to a real snapshot share
    centres.forEach((c) => {
      expect(data.STAGES.find((s) => s.id === c.stageId).shares[c.countryId]).toBeGreaterThan(0);
    });
  });

  it('lets a single country hold several functional centres', () => {
    const { data, engine } = fixture();
    const { centresByCountry } = buildFunctionalCentres({ data, engine });
    // us participates in s1, s2, s5, siso → 4 centres
    expect(centresByCountry['us'].length).toBeGreaterThanOrEqual(3);
  });

  it('gives every centre a stable, deterministic id', () => {
    const { data, engine } = fixture();
    const a = buildFunctionalCentres({ data, engine }).centres.map((c) => c.id);
    const b = buildFunctionalCentres({ data, engine }).centres.map((c) => c.id);
    expect(a).toEqual(b);
    expect(a).toContain('us::s1');
  });

  it('attaches only companies whose HQ country matches the centre', () => {
    const { data, engine } = fixture();
    const { centreById } = buildFunctionalCentres({ data, engine });
    // coA/coB are us with s1 stake; coC is cn with s5 stake
    const usS1 = centreById['us::s1'];
    expect(usS1.companies.map((c) => c.id).sort()).toEqual(['coA', 'coB']);
    expect(centreById['us::s5'].companies.find((c) => c.id === 'coC')).toBeUndefined(); // coC is cn
  });
});

describe('buildCentreConnections() — derived stage-mediated weight', () => {
  it('creates a connection only where an existing stage edge and both shares exist', () => {
    const { data, engine } = fixture();
    const { centreById } = buildFunctionalCentres({ data, engine });
    const edges = buildCentreConnections({ data, engine, centreById });
    // s1->s2 is a fixture stage edge; us has share in both → us::s1 -> us::s2
    const e = edges.find((x) => x.id === 'us::s1->us::s2');
    expect(e).toBeTruthy();
    // no edge without an underlying stage edge (s1->s3 is not a direct edge)
    expect(edges.find((x) => x.sourceStage === 's1' && x.targetStage === 's3')).toBeUndefined();
  });

  it('computes rawDisplayWeight = share(i,a) × D[b][a] × share(j,b) exactly', () => {
    const { data, engine } = fixture();
    const { centreById } = buildFunctionalCentres({ data, engine });
    const edges = buildCentreConnections({ data, engine, centreById });
    const e = edges.find((x) => x.id === 'us::s1->us::s2');
    const expected = data.STAGES.find((s) => s.id === 's1').shares.us
      * engine.D['s2']['s1']
      * data.STAGES.find((s) => s.id === 's2').shares.us;
    expect(e.rawDisplayWeight).toBeCloseTo(expected, 12);
  });

  it('adds a normalized weight without overwriting the raw value', () => {
    const { data, engine } = fixture();
    const { centreById } = buildFunctionalCentres({ data, engine });
    const edges = buildCentreConnections({ data, engine, centreById });
    edges.forEach((e) => {
      expect(e.rawDisplayWeight).toBeGreaterThan(0);
      expect(e.normalizedDisplayWeight).toBeGreaterThan(0);
      expect(e.normalizedDisplayWeight).toBeLessThanOrEqual(1);
    });
    // at least one edge sits at the normalization max
    expect(Math.max(...edges.map((e) => e.normalizedDisplayWeight))).toBeCloseTo(1, 12);
  });
});

describe('buildBaseGraph() — immutable multilayer base (§7)', () => {
  it('is deep-frozen and cannot be mutated', () => {
    const { data, engine } = fixture();
    const g = buildBaseGraph({ data, engine });
    expect(Object.isFrozen(g)).toBe(true);
    expect(Object.isFrozen(g.centres)).toBe(true);
    expect(Object.isFrozen(g.centres[0])).toBe(true);
    expect(() => { g.centres.push({}); }).toThrow();
    expect(() => { g.centres[0].countryShare = 999; }).toThrow();
  });

  it('does not mutate the source snapshot shares', () => {
    const { data, engine } = fixture();
    const before = JSON.stringify(data.STAGES.map((s) => s.shares));
    buildBaseGraph({ data, engine });
    const after = JSON.stringify(data.STAGES.map((s) => s.shares));
    expect(after).toBe(before);
  });

  it('builds a directed adjacency consistent with the edge list', () => {
    const { data, engine } = fixture();
    const g = buildBaseGraph({ data, engine });
    const e = g.edgeById['us::s1->us::s2'];
    expect(e).toBeTruthy();
    expect(g.outAdj['us::s1']).toContain(e.id);
    expect(g.inAdj['us::s2']).toContain(e.id);
  });
});
