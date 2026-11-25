import { describe, it, expect } from 'vitest';
import {
  buildSupplierIndex, traverseSuppliers, reachableCount, suggestedRoots,
  searchCompanies, bestEvidence, chainGroup, EVIDENCE_CLASSES,
  companyCoverage, systemCompanyCoverage, shortestSupplierPath,
} from './supplierTiers.js';
import PUBLIC_SUPPLIER_TIERS from '../data/publicSupplierTiers.json';
import SNAPSHOT from '../data/vault-snapshot.json';
import COVERAGE from '../../../supplier-tiers/data/coverage.json';
import { supplierCoverage, coverageSummary } from '../../../supplier-tiers/coverage.mjs';

const index = buildSupplierIndex();

describe('system-wide three-level tracking', () => {
  it('retains the named counterparties that close the November 25 directional gaps', () => {
    const rows = systemCompanyCoverage(index);
    for (const id of ['ansys', 'asmi', 'sumco', 'synopsys']) {
      expect(rows.find(r => r.vaultId === id).suppliers, id).toBeGreaterThan(0);
    }
    for (const id of ['alibaba', 'amazon', 'google', 'marvell', 'mediatek', 'microsoft', 'tower']) {
      expect(rows.find(r => r.vaultId === id).customers, id).toBeGreaterThan(0);
    }
    const cloud = index.edges.find(e => e.supplier === 'system-amazon' && e.customer === 'system-marvell');
    expect(cloud.products.join(' ')).toContain('Cloud');
    expect(cloud.details.join(' ')).toContain('not reverse shipment');
    expect(index.companies['anthropic-pbc'].vaultId).toBeUndefined();
  });

  it('makes every system company discoverable, including evidence gaps', () => {
    const rows = systemCompanyCoverage(index);
    expect(rows.map(r => r.vaultId).sort()).toEqual(SNAPSHOT.companies.map(c => c.id).sort());
    expect(companyCoverage(index, 'system-cambricon').documented).toBe(true);
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

describe('all 109 company coverage ledger', () => {
  it('connects every tracked company without expanding the tracked set', () => {
    const rows = systemCompanyCoverage(index);
    expect(rows).toHaveLength(109);
    expect(rows.every(r => r.documented)).toBe(true);
    expect(rows.map(r => r.vaultId).sort()).toEqual(SNAPSHOT.companies.map(c => c.id).sort());
    expect(index.companies['torlens-precision-jiangsu'].vaultId).toBeUndefined();
    expect(index.companies['arteris-ip'].vaultId).toBeUndefined();
  });

  it('keeps authoring metadata, ledger and browser coverage identical', () => {
    const rows = systemCompanyCoverage(index);
    expect(rows).toEqual(COVERAGE.companies);
    expect(coverageSummary(rows)).toEqual(PUBLIC_SUPPLIER_TIERS.meta.documentedLevels);
    expect(COVERAGE.summary).toEqual(coverageSummary(rows));
  });

  it('matches each directional level to the actual traversal and proves every example path', () => {
    for (const row of systemCompanyCoverage(index)) for (const direction of ['upstream', 'downstream']) {
      const counts = direction === 'upstream' ? row.levels : row.downstreamLevels;
      const paths = direction === 'upstream' ? row.upstreamPaths : row.downstreamPaths;
      const traversal = traverseSuppliers(index, row.id, { direction, hops: 3 });
      counts.forEach((count, i) => {
        expect(count).toBe(traversal.nodes.filter(n => Math.abs(n.hop) === i + 1).length);
        const path = paths[i];
        if (!count) { expect(path).toBeNull(); return; }
        expect(path).toHaveLength(i + 2);
        expect(path[0]).toBe(row.id);
        expect(new Set(path).size).toBe(path.length);
        for (let j = 1; j < path.length; j++) {
          const supplier = direction === 'upstream' ? path[j] : path[j - 1];
          const customer = direction === 'upstream' ? path[j - 1] : path[j];
          const edge = index.edges.find(e => e.supplier === supplier && e.customer === customer);
          expect(edge.sources.every(s => index.sources[s])).toBe(true);
        }
      });
    }
  });

  it('does not count cycles, reverse direction, or merge separate legal entities', () => {
    const companies = Object.fromEntries(['r', 'a', 'b', 'c', 'isolated'].map(id => [id, { name: id, vaultId: id === 'isolated' ? 'r' : id }]));
    const edges = [['a', 'r'], ['r', 'b'], ['b', 'a'], ['a', 'c']].map(([supplier, customer]) => ({ supplier, customer }));
    const row = supplierCoverage(companies, edges).find(r => r.vaultId === 'r');
    expect(row.id).toBe('r');
    expect(row.levels).toEqual([1, 1, 0]);
    expect(row.downstreamLevels).toEqual([1, 1, 1]);
    expect(row.downstreamPaths[2]).toEqual(['r', 'b', 'a', 'c']);
  });

  it('retains missing depths instead of treating registration as full coverage', () => {
    const biren = systemCompanyCoverage(index).find(r => r.vaultId === 'biren');
    expect(biren.documented).toBe(true);
    expect(biren.missingUpstreamLevels).toEqual([2, 3]);
    expect(biren.missingDownstreamLevels).toEqual([1, 2, 3]);
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

describe('Renesas, in both directions', () => {
  /* The company the November 25 directional pass was built around, and
     the clearest case of an artefact the earlier passes left behind.
     Those passes grew out of buyer-published supplier lists, so every
     firm they reached arrived as somebody's SUPPLIER: Renesas ended up
     with 74 firms upstream, 70 of them inherited from TSMC's list two
     steps away, and exactly one downstream. Renesas sells automotive
     and industrial MCUs and SoCs. The customer side is its business. */
  const R = 'renesas-electronics-corporation';
  const suppliers = () => index.suppliersOf[R];
  const customers = () => index.customersOf[R];

  it('names more customers than suppliers, because that is the half that was missing', () => {
    expect(suppliers().length).toBeGreaterThanOrEqual(6);
    expect(customers().length).toBeGreaterThanOrEqual(10);
    expect(customers().length).toBeGreaterThan(suppliers().length);
  });

  it('documents the supply side at the level of wafers, foundry capacity and CPU IP', () => {
    const by = Object.fromEntries(suppliers().map((e) => [e.supplier, e]));
    expect(by['wolfspeed-inc'].products.join(' ')).toMatch(/silicon carbide/i);
    expect(by['globalfoundries-inc'].products.join(' ')).toMatch(/FD-SOI/);
    for (const ip of ['andes-technology-corporation', 'sifive-inc']) {
      expect(by[ip].products.join(' ')).toMatch(/RISC-V/);
    }
    /* One pair, two documents, thirteen years apart — not two edges.
       The 2012 announcement was 90nm and 40nm microcontrollers; the
       2025 one is a 3nm automotive SoC. */
    const tsmc = by['taiwan-semiconductor-manufacturing-company-limited'];
    expect(tsmc.years).toEqual([2012, 2025]);
    expect(tsmc.sources.length).toBe(2);
  });

  it('reaches carmakers, an ODM, a motor maker and two software houses downstream', () => {
    const reached = customers().map((e) => e.customer);
    for (const id of ['honda-motor-co-ltd', 'vinfast-auto-ltd', 'audi-ag',
      'great-wall-motor-company-limited', 'national-electric-vehicle-sweden-ab',
      'inventec-corporation', 'nidec-corporation', 'nullmax', 'tata-elxsi-limited', 'apple-inc']) {
      expect(reached, id).toContain(id);
    }
    /* Drawn as one step each way, which is what the profile opens on:
       six firms left, ten right, and the company in the middle. */
    const t = traverseSuppliers(index, R, { direction: 'both', hops: 1 });
    expect(t.nodes.filter((n) => n.hop === -1).length).toBe(suppliers().length);
    expect(t.nodes.filter((n) => n.hop === 1).length).toBe(customers().length);
  });

  it('qualifies every soft edge on the edge itself, where the interface shows it', () => {
    /* A development agreement, a proof of concept, a design-in and an
       eleven-year-old partnership are all weaker than a shipment, and
       the reader has to be able to see which one they are looking at
       without opening the source. */
    const by = Object.fromEntries(customers().map((e) => [e.customer, e.details.join(' ')]));
    expect(by['honda-motor-co-ltd']).toMatch(/no shipment is claimed/i);
    expect(by['nullmax']).toMatch(/weakest form of downstream evidence/i);
    expect(by['tata-elxsi-limited']).toMatch(/not as an end customer/i);
    expect(by['audi-ag']).toMatch(/not of supply today/i);
    expect(by['inventec-corporation']).toMatch(/not a production gateway/i);
    expect(by['nidec-corporation']).toMatch(/is not production/i);
    // And the one that does name shipped product says so plainly.
    expect(by['vinfast-auto-ltd']).toMatch(/already implemented in two named vehicle models/i);
  });

  it('files each joint release under the party that published it', () => {
    /* The Honda announcement exists on both companies' sites. The
       Honda-hosted copy evidences Renesas→Honda; the Renesas-hosted
       copy evidences TSMC→Renesas, because there Renesas is the buyer
       naming its foundry. Same news, two directions, two sources. */
    const honda = customers().find((e) => e.customer === 'honda-motor-co-ltd');
    expect(honda.sources).toEqual(['renesas-honda-soc-2025-honda']);
    expect(index.sources['renesas-honda-soc-2025-honda'].publisher).toBe('Honda');
    expect(index.sources['renesas-honda-soc-2025-renesas'].publisher).toBe('Renesas');
    for (const id of ['renesas-honda-soc-2025-honda', 'renesas-honda-soc-2025-renesas']) {
      expect(index.sources[id].evidence).toBe('P1-buyer');
      expect(index.sources[id].seen).toBe('fetched');
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

describe('the securities-filing coverage pass', () => {
  /* The filings pass exists to give the system's firms a chain beyond
     the handful of buyers whose supplier lists seeded the dataset.
     These tests guard the two ways that pass could have gone wrong:
     by inventing relationships out of names that merely co-occur, and
     by quietly losing the coverage it bought. */

  const vaultIds = new Set(SNAPSHOT.companies.map((c) => c.id));
  const nodeFor = (vaultId) =>
    Object.keys(PUBLIC_SUPPLIER_TIERS.companies)
      .find((id) => PUBLIC_SUPPLIER_TIERS.companies[id].vaultId === vaultId);

  const levels = (root) => {
    const up = {};
    const down = {};
    for (const e of PUBLIC_SUPPLIER_TIERS.edges) {
      (up[e.customer] ||= []).push(e.supplier);
      (down[e.supplier] ||= []).push(e.customer);
    }
    const walk = (adj) => {
      const seen = new Set([root]);
      let frontier = [root];
      const counts = [];
      for (let i = 0; i < 3; i += 1) {
        const next = [];
        for (const n of frontier) for (const m of adj[n] || []) if (!seen.has(m)) { seen.add(m); next.push(m); }
        counts.push(next.length);
        frontier = next;
      }
      return counts;
    };
    const u = walk(up);
    const d = walk(down);
    return [u[0] + d[0], u[1] + d[1], u[2] + d[2]];
  };

  const coverage = (depth) =>
    [...vaultIds].filter((v) => {
      const n = nodeFor(v);
      return n && levels(n)[depth] > 0;
    }).length;

  /* Floors, not exact counts: the dataset should be able to grow
     without editing a number here, but it must never silently shrink. */
  it('gives most system companies a documented first step', () => {
    expect(coverage(0)).toBeGreaterThanOrEqual(87);
  });

  it('carries a second level for the majority of them', () => {
    expect(coverage(1)).toBeGreaterThanOrEqual(68);
  });

  it('carries a third level for the majority of them', () => {
    expect(coverage(2)).toBeGreaterThanOrEqual(60);
  });

  /* The single largest way this pass could have gone wrong. Micron's
     10-K names Samsung, SK hynix, Kioxia, Sandisk, CXMT and YMTC in one
     sentence — as its COMPETITORS. Reading a filing for names rather
     than for relationships would have produced six false edges from
     that sentence alone. */
  it('never turned a competitor list into supply', () => {
    const micron = nodeFor('micron');
    const rivals = ['skhynix', 'kioxia', 'cxmt', 'ymtc'].map(nodeFor).filter(Boolean);
    for (const r of rivals) {
      const edge = PUBLIC_SUPPLIER_TIERS.edges.find(
        (e) => (e.supplier === micron && e.customer === r) || (e.supplier === r && e.customer === micron),
      );
      expect(edge, `${r} must not be wired to Micron from a competitor list`).toBeFalsy();
    }
  });

  /* Relationships that are documented but are NOT purchases are allowed
     in, because they are real dependencies. They must carry their
     qualification where a reader will see it, or they overstate. */
  it('qualifies every relationship that is not a disclosed purchase', () => {
    const notPurchases = ['tsmc-eda-alliance', 'trumpf-euv-lithography', 'ibm-rapidus-2024', 'synopsys-tsmc-2025'];
    for (const e of PUBLIC_SUPPLIER_TIERS.edges) {
      if (!e.sources.some((s) => notPurchases.includes(s))) continue;
      expect(e.details.join(' '), `${e.supplier} -> ${e.customer}`)
        .toMatch(/not a disclosed purchase|joint development|certification|does not say TSMC buys/i);
    }
  });

  /* Two pairs of firms share a group name and nothing else. Merging
     either pair would manufacture a chain for a company that was never
     named in the document. */
  it('keeps same-named but distinct firms on separate nodes', () => {
    /* The left of each pair is identified by its vault id rather than
       by name, because the system's own label for the DRAM maker is
       just "Nanya". */
    const pairs = [
      ['nanya', /Nan Ya|Printed Circuit/i],
      ['hp', /Hewlett Packard Enterprise/i],
    ];
    for (const [vaultId, other] of pairs) {
      const left = nodeFor(vaultId);
      expect(left, `${vaultId} missing from the registry`).toBeTruthy();
      const right = Object.entries(PUBLIC_SUPPLIER_TIERS.companies).filter(([, c]) => other.test(c.name));
      expect(right.length, `no counterpart matching ${other}`).toBeGreaterThan(0);
      for (const [idB] of right) expect(idB, `${vaultId} must stay distinct`).not.toBe(left);
    }

    /* And the distinct firms must not have been merged into each other
       either: Nan Ya PCB keeps its own node with its own edges. */
    const pcb = Object.entries(PUBLIC_SUPPLIER_TIERS.companies).find(([, c]) => /Nan Ya PCB/i.test(c.name));
    expect(pcb, 'Nan Ya PCB should be in the registry').toBeTruthy();
    expect(PUBLIC_SUPPLIER_TIERS.edges.some((e) => e.supplier === pcb[0])).toBe(true);
  });

  it('gives every filing-derived source a quote naming the parties', () => {
    for (const [id, s] of Object.entries(PUBLIC_SUPPLIER_TIERS.sources)) {
      if (s.seen !== 'fetched') continue;
      if (!s.quote) continue;
      expect(s.quote.length, `${id} quote is too short to carry a relationship`).toBeGreaterThan(30);
    }
  });
});
