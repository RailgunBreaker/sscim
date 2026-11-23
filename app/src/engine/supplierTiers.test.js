import { describe, it, expect } from 'vitest';
import {
  buildSupplierIndex, traverseSuppliers, reachableCount, suggestedRoots,
  searchCompanies, bestEvidence, chainGroup, EVIDENCE_CLASSES,
  companyCoverage, systemCompanyCoverage, shortestSupplierPath,
} from './supplierTiers.js';
import PUBLIC_SUPPLIER_TIERS from '../data/publicSupplierTiers.json';
import SNAPSHOT from '../data/vault-snapshot.json';

const index = buildSupplierIndex();

describe('system-wide three-level tracking', () => {
  it('makes every system company discoverable, including evidence gaps', () => {
    const rows = systemCompanyCoverage(index);
    expect(rows.map(r => r.vaultId).sort()).toEqual(SNAPSHOT.companies.map(c => c.id).sort());
    expect(companyCoverage(index, 'system-cambricon').documented).toBe(false);
    expect(searchCompanies(index, 'NVIDIA')).toContain('system-nvidia');
    expect(searchCompanies(index, 'TSMC')).toContain('taiwan-semiconductor-manufacturing-company-limited');
  });

  it('traces NVIDIA through TSMC and ASML to ZEISS with a citation on each hop', () => {
    const target = 'zeiss-semiconductor-manufacturing-technology-carl-zeiss-smt-gmbh';
    const path = shortestSupplierPath(index, 'system-nvidia', target, 'upstream', 3);
    expect(path.nodes).toEqual(['system-nvidia', 'taiwan-semiconductor-manufacturing-company-limited', 'asml-holding-n-v', target]);
    expect(path.links).toHaveLength(3);
    expect(path.links.every(e => e.sources.length > 0)).toBe(true);
    expect(shortestSupplierPath(index, 'system-nvidia', target, 'upstream', 2)).toBeNull();
    expect(companyCoverage(index, 'system-nvidia').levels.every(n => n > 0)).toBe(true);
  });

  it('recomputes distance when a different firm is selected', () => {
    const asml = 'asml-holding-n-v';
    const fromNvidia = traverseSuppliers(index, 'system-nvidia', { hops: 3 });
    const fromTsmc = traverseSuppliers(index, 'taiwan-semiconductor-manufacturing-company-limited', { hops: 3 });
    expect(fromNvidia.nodes.find(n => n.id === asml).hop).toBe(-2);
    expect(fromTsmc.nodes.find(n => n.id === asml).hop).toBe(-1);
  });

  it('reaches the new wafer and polysilicon branch at levels two and three', () => {
    const path = shortestSupplierPath(index, 'system-nvidia', 'wacker-chemie-ag', 'upstream', 3);
    expect(path.links).toHaveLength(3);
    expect(path.nodes[2]).toBe('system-siltronic');
    expect(path.links.every(e => e.sources.every(s => index.sources[s]))).toBe(true);
    expect(shortestSupplierPath(index, 'system-nvidia', 'wacker-chemie-ag', 'upstream', 2)).toBeNull();
  });

  it('walks both directions independently through cycles', () => {
    const companies = Object.fromEntries(['r', 'a', 'b', 'c'].map(id => [id, { name: id }]));
    const edges = [['a', 'r'], ['r', 'b'], ['b', 'a'], ['a', 'c']].map(([supplier, customer]) =>
      ({ supplier, customer, sources: [], products: [], years: [], details: [] }));
    const fixture = buildSupplierIndex({ companies, edges, sources: {}, meta: { focal: ['r'] } });
    const both = traverseSuppliers(fixture, 'r', { direction: 'both', hops: 3 });
    expect(both.nodes.map(n => n.id)).toContain('c');
    expect(new Set(both.nodes.map(n => n.id)).size).toBe(both.nodes.length);
  });
});

describe('the dataset keeps its one promise', () => {
  /* This is the rule the whole lens rests on. If an edge can exist
     without a document naming both parties, the lens is just the modeled
     network with a different colour scheme. */
  it('gives every edge at least one source that exists in the registry', () => {
    for (const e of index.edges) {
      expect(e.sources.length, `${e.key} has no source`).toBeGreaterThan(0);
      for (const id of e.sources) {
        expect(index.sources[id], `${e.key} cites unknown source ${id}`).toBeTruthy();
      }
    }
  });

  it('gives every source a resolvable https URL and a known evidence class', () => {
    for (const [id, s] of Object.entries(index.sources)) {
      expect(s.url, `${id} has no url`).toMatch(/^https:\/\//);
      expect(EVIDENCE_CLASSES[s.evidence], `${id} has unknown evidence class ${s.evidence}`).toBeTruthy();
      expect(['fetched', 'search-indexed']).toContain(s.seen);
    }
  });

  it('gives every edge endpoint a company record', () => {
    for (const e of index.edges) {
      expect(index.companies[e.supplier], `${e.key}: unknown supplier`).toBeTruthy();
      expect(index.companies[e.customer], `${e.key}: unknown customer`).toBeTruthy();
    }
  });

  it('carries no weight, share or strength field anywhere', () => {
    /* The absence is load-bearing. Nobody published a weight, so if one
       ever appears it was invented, and the graph would start implying
       an ordering the documents do not support. */
    const banned = ['weight', 'share', 'strength', 'value', 'pct', 'percent'];
    for (const e of PUBLIC_SUPPLIER_TIERS.edges) {
      for (const k of banned) expect(Object.keys(e)).not.toContain(k);
    }
  });

  it('never records the same ordered pair twice', () => {
    const seen = new Set();
    for (const e of index.edges) {
      expect(seen.has(e.key), `${e.key} appears twice`).toBe(false);
      seen.add(e.key);
    }
  });
});

describe('tier derivation', () => {
  it('puts the focal buyers at tier 0', () => {
    for (const id of index.meta.focal) expect(index.tier[id]).toBe(0);
  });

  it('reaches tier 3, which is what the lens claims to show', () => {
    expect(index.maxTier).toBeGreaterThanOrEqual(3);
  });

  it('assigns the SHORTEST upstream distance, not the first one found', () => {
    /* Every firm's tier must be exactly one more than the lowest tier
       among the firms it is documented as supplying. Anything else means
       the walk recorded a longer path than one that exists. */
    for (const [id, t] of Object.entries(index.tier)) {
      if (t === 0) continue;
      const customerTiers = index.customersOf[id]
        .map((e) => index.tier[e.customer])
        .filter((x) => x !== undefined);
      expect(Math.min(...customerTiers), `${id} is at tier ${t}`).toBe(t - 1);
    }
  });

  it('leaves tier underived for a firm no documented path reaches', () => {
    for (const id of index.unreached) expect(index.tier[id]).toBeUndefined();
  });
});

describe('the export-control hole is real and visible', () => {
  /* The most honest thing in the dataset is what is missing from it.
     A future edit that quietly fills Huawei's upstream with plausible
     unsourced suppliers would pass every other test here. */
  it('leaves Huawei with at most one documented supplier step', () => {
    const huawei = 'huawei-technologies-co-ltd';
    expect(index.companies[huawei]).toBeTruthy();
    const reach = reachableCount(index, huawei, 'upstream');
    expect(reach).toBeLessThanOrEqual(4);
  });

  it('carries Huawei’s only documented chain through a teardown and a government rule', () => {
    const t = traverseSuppliers(index, 'huawei-technologies-co-ltd', { direction: 'upstream', hops: 3 });
    const classes = new Set(t.links.map((l) => l.evidence));
    expect(classes.has('P3-regulatory')).toBe(true);
    expect(classes.has('P2-institutional')).toBe(true);
  });
});

describe('traversal', () => {
  it('returns null for a firm that is not in the dataset', () => {
    expect(traverseSuppliers(index, 'not-a-company', {})).toBeNull();
  });

  it('includes the root and puts upstream hops on negative columns', () => {
    const t = traverseSuppliers(index, 'apple-inc', { direction: 'upstream', hops: 2 });
    expect(t.nodes.find((n) => n.id === 'apple-inc').hop).toBe(0);
    expect(t.nodes.every((n) => n.hop <= 0)).toBe(true);
    expect(t.columns).toContain(-1);
    expect(t.columns).toContain(-2);
  });

  it('puts downstream hops on positive columns', () => {
    const t = traverseSuppliers(index, 'asml-holding-n-v', { direction: 'downstream', hops: 2 });
    expect(t.nodes.every((n) => n.hop >= 0)).toBe(true);
    expect(t.nodes.map((n) => n.id)).toContain('taiwan-semiconductor-manufacturing-company-limited');
  });

  it('grows monotonically with depth and never shrinks', () => {
    const sizes = [1, 2, 3].map((h) => traverseSuppliers(index, 'apple-inc', { direction: 'upstream', hops: h }).nodes.length);
    expect(sizes[1]).toBeGreaterThanOrEqual(sizes[0]);
    expect(sizes[2]).toBeGreaterThanOrEqual(sizes[1]);
  });

  it('marks as frontier only firms that still have undrawn suppliers', () => {
    const t = traverseSuppliers(index, 'apple-inc', { direction: 'upstream', hops: 1 });
    for (const id of t.frontier) {
      expect(index.suppliersOf[id].length, `${id} is on the frontier with nothing behind it`).toBeGreaterThan(0);
    }
  });

  it('draws a link between two already-drawn firms even when the walk did not find them through it', () => {
    /* TSMC and Intel both appear in Apple's list, and Intel names TSMC
       as a supplier. One hop from Apple, that edge must still be drawn,
       or two firms with a documented relationship look unconnected. */
    const t = traverseSuppliers(index, 'apple-inc', { direction: 'upstream', hops: 1 });
    const ids = new Set(t.nodes.map((n) => n.id));
    expect(ids.has('intel-corporation')).toBe(true);
    expect(ids.has('taiwan-semiconductor-manufacturing-company-limited')).toBe(true);
    expect(t.links.some((l) => l.key === 'taiwan-semiconductor-manufacturing-company-limited->intel-corporation')).toBe(true);
  });

  it('honours a chain-position filter', () => {
    const only = new Set(['Equipment & optics']);
    const t = traverseSuppliers(index, 'taiwan-semiconductor-manufacturing-company-limited', { direction: 'upstream', hops: 1, groups: only });
    for (const n of t.nodes) {
      if (n.id === t.rootId) continue;
      expect(chainGroup(index.companies[n.id].layer)).toBe('Equipment & optics');
    }
  });

  it('finds the ASML → TSMC → Apple chain at three documented steps', () => {
    const t = traverseSuppliers(index, 'apple-inc', { direction: 'upstream', hops: 3 });
    const ids = new Set(t.nodes.map((n) => n.id));
    expect(ids.has('taiwan-semiconductor-manufacturing-company-limited')).toBe(true);
    expect(ids.has('asml-holding-n-v')).toBe(true);
    expect(ids.has('zeiss-semiconductor-manufacturing-technology-carl-zeiss-smt-gmbh')).toBe(true);
    expect(index.tier['asml-holding-n-v']).toBe(2);
    expect(index.tier['zeiss-semiconductor-manufacturing-technology-carl-zeiss-smt-gmbh']).toBe(3);
  });
});

describe('evidence classification', () => {
  it('prefers the class closest to the parties themselves', () => {
    expect(bestEvidence(['techinsights-smic-n2', 'apple-sl-fy2023'], index.sources)).toBe('P1-buyer');
    expect(bestEvidence(['fr-huawei-2020-08'], index.sources)).toBe('P3-regulatory');
  });

  it('gives teardown and regulatory edges a dash pattern, so provenance is not colour-only', () => {
    expect(EVIDENCE_CLASSES['P1-buyer'].dash).toBeNull();
    expect(EVIDENCE_CLASSES['P2-institutional'].dash).toBeTruthy();
    expect(EVIDENCE_CLASSES['P3-regulatory'].dash).toBeTruthy();
  });
});

describe('search and suggestions', () => {
  it('offers the focal buyers first', () => {
    expect(suggestedRoots(index, 4).slice(0, index.meta.focal.length)).toEqual(index.meta.focal);
  });

  it('ranks a prefix match above a mid-string one', () => {
    const hits = searchCompanies(index, 'ASM', 6).map((id) => index.companies[id].name);
    expect(hits[0].toLowerCase().startsWith('asm')).toBe(true);
  });

  it('returns nothing for an empty query', () => {
    expect(searchCompanies(index, '   ')).toEqual([]);
  });
});
