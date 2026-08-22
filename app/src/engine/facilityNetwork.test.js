import { describe, it, expect } from 'vitest';
import { buildFacilityLayer } from './facilities.js';
import {
  buildFacilityNetwork, facilityConnectivity, linksSeveredBy,
  MAX_LINKS_PER_COMPANY_PAIR, MIN_LINK_WEIGHT,
} from './facilityNetwork.js';
import {
  facilityIntro, facilityHeadline, facilityFacts, facilityStageRoles,
  facilityCaveats, facilityProfile, KIND_LABEL,
} from './facilityProfile.js';

const site = (id, over = {}) => ({
  id, name: id, company: 'sup', country: 'jp', lat: 0, lng: 0,
  kind: 'fab', stages: ['wafers'], scale: 3, status: 'operating',
  output: 'Something useful', node: null, waferSize: null, since: 2000, source: 'test', ...over,
});

/* wafers reaches adv_fab in these fixtures; nothing else reaches anything. */
const dependence = (a, b) => (a === 'wafers' && b === 'adv_fab' ? 0.5 : 0);

describe('buildFacilityNetwork', () => {
  const layer = buildFacilityLayer([
    site('sup_big', { company: 'sup', stages: ['wafers'], scale: 4 }),
    site('sup_small', { company: 'sup', stages: ['wafers'], scale: 1 }),
    site('cust_fab', { company: 'cust', stages: ['adv_fab'], scale: 5, country: 'tw' }),
    site('unrelated', { company: 'other', stages: ['osat'], scale: 3 }),
  ]);
  const net = buildFacilityNetwork({ layer, CUSTOMERS: { sup: [['cust', 0.4]] }, dependence });

  it('links supplier sites to customer sites only where both the company edge and stage reachability exist', () => {
    expect(net.links.every((l) => l.fromCompany === 'sup' && l.toCompany === 'cust')).toBe(true);
    expect(net.links.map((l) => l.from).sort()).toEqual(['sup_big', 'sup_small']);
    expect(net.links.every((l) => l.to === 'cust_fab')).toBe(true);
    expect(net.links.some((l) => l.from === 'unrelated' || l.to === 'unrelated')).toBe(false);
    expect(net.links.every((l) => l.flow === 'forward')).toBe(true);
  });

  it('still links a relationship whose physical flow runs the other way, marked as a service', () => {
    /* An OSAT "supplies" a fabless designer, but the die moves from the fab to
       the packager and back — design reaches osat, not the reverse. */
    const layerSvc = buildFacilityLayer([
      site('osat_site', { company: 'osat_co', stages: ['osat'] }),
      site('fabless', { company: 'fabless_co', stages: ['design'], country: 'us' }),
    ]);
    const svc = buildFacilityNetwork({
      layer: layerSvc,
      CUSTOMERS: { osat_co: [['fabless_co', 0.3]] },
      dependence: (a, b) => (a === 'design' && b === 'osat' ? 0.2 : 0),
    });
    expect(svc.links).toHaveLength(1);
    expect(svc.links[0].flow).toBe('service');
    expect(svc.links[0].from).toBe('osat_site');   // direction stays commercial
    expect(svc.stats.service).toBe(1);
  });

  it('weights a link by company share × both site shares × stage dependence', () => {
    const big = net.links.find((l) => l.from === 'sup_big');
    // company share .4 × supplier share 4/5 × customer share 1 × dependence .5
    expect(big.weight).toBeCloseTo(0.4 * (4 / 5) * 1 * 0.5, 9);
    expect(big.fromStage).toBe('wafers');
    expect(big.toStage).toBe('adv_fab');
  });

  it('ranks the larger supplier site above the smaller one for the same relationship', () => {
    expect(net.links[0].from).toBe('sup_big');
  });

  it('restates each weight against the strongest link, so the number is readable', () => {
    expect(net.links[0].rel).toBe(1);
    const small = net.links.find((l) => l.from === 'sup_small');
    expect(small.rel).toBeCloseTo(small.weight / net.links[0].weight, 9);
    expect(small.rel).toBeLessThan(1);
  });

  it('draws nothing when neither stage reaches the other in either direction', () => {
    const noEdge = buildFacilityNetwork({ layer, CUSTOMERS: { sup: [['cust', 0.4]] }, dependence: () => 0 });
    expect(noEdge.links).toEqual([]);
  });

  /* The third relationship class, and it is not an edge case. Unimicron and
     Ibiden make the ABF substrates NVIDIA's packages are built on. Substrates
     and logic_ai are SIBLINGS — both feed advanced packaging, neither reaches
     the other — so a forward-or-backward rule scored one of the most watched
     constraints in the industry at zero, and dropped 12 real company
     relationships with it. */
  it('links siblings that feed a common downstream stage, marked co-input', () => {
    const sibling = buildFacilityLayer([
      site('substrate_plant', { company: 'ibiden_co', stages: ['substrates'] }),
      site('design_campus', { company: 'fabless_co', stages: ['logic_ai'], country: 'us' }),
    ]);
    /* substrates and logic_ai each reach adv_pkg; neither reaches the other. */
    const reach = (a, b) => (b === 'adv_pkg' && (a === 'substrates' || a === 'logic_ai') ? 0.15 : 0);

    const withoutStages = buildFacilityNetwork({
      layer: sibling, CUSTOMERS: { ibiden_co: [['fabless_co', 0.2]] }, dependence: reach,
    });
    expect(withoutStages.links).toEqual([]); // the old behaviour, unchanged when stageIds is omitted

    const withStages = buildFacilityNetwork({
      layer: sibling, CUSTOMERS: { ibiden_co: [['fabless_co', 0.2]] }, dependence: reach,
      stageIds: ['substrates', 'logic_ai', 'adv_pkg', 'systems'],
    });
    expect(withStages.links).toHaveLength(1);
    expect(withStages.links[0].flow).toBe('co-input');
    expect(withStages.links[0].from).toBe('substrate_plant');
  });

  /* Only as strong as the weaker leg: that is what limits how much of one
     supplier's output can flow into the other's product. */
  it('scores a co-input link by the weaker of the two paths to the meeting stage', () => {
    const sibling = buildFacilityLayer([
      site('weak_leg', { company: 'sup', stages: ['substrates'] }),
      site('strong_leg', { company: 'cust', stages: ['logic_ai'], country: 'us' }),
    ]);
    const reach = (a, b) => (b !== 'adv_pkg' ? 0 : a === 'substrates' ? 0.1 : 0.9);
    const n = buildFacilityNetwork({
      layer: sibling, CUSTOMERS: { sup: [['cust', 1]] }, dependence: reach,
      stageIds: ['substrates', 'logic_ai', 'adv_pkg'],
    });
    expect(n.links[0].dependence).toBeCloseTo(0.1, 9); // the min, not the max or the mean
  });

  it('prefers a real forward path over a co-input one when both exist', () => {
    const both = buildFacilityLayer([
      site('s', { company: 'sup', stages: ['wafers'] }),
      site('c', { company: 'cust', stages: ['adv_fab'], country: 'tw' }),
    ]);
    const n = buildFacilityNetwork({
      layer: both, CUSTOMERS: { sup: [['cust', 0.5]] },
      dependence: (a, b) => (a === 'wafers' && b === 'adv_fab' ? 0.5 : b === 'systems' ? 0.9 : 0),
      stageIds: ['wafers', 'adv_fab', 'systems'],
    });
    expect(n.links[0].flow).toBe('forward');
  });

  it('excludes sites with no exposure weight — a fab under construction ships nothing', () => {
    const withFuture = buildFacilityLayer([
      site('sup_future', { company: 'sup', stages: ['wafers'], status: 'construction' }),
      site('cust_fab', { company: 'cust', stages: ['adv_fab'] }),
    ]);
    const n = buildFacilityNetwork({ layer: withFuture, CUSTOMERS: { sup: [['cust', 0.9]] }, dependence });
    expect(n.links).toEqual([]);
  });

  it('caps links per company pair and reports what it dropped rather than hiding it', () => {
    const many = buildFacilityLayer([
      ...Array.from({ length: 6 }, (_, i) => site(`s${i}`, { company: 'sup', stages: ['wafers'], scale: 5 - (i % 5) })),
      site('c0', { company: 'cust', stages: ['adv_fab'] }),
    ]);
    const n = buildFacilityNetwork({ layer: many, CUSTOMERS: { sup: [['cust', 0.5]] }, dependence });
    expect(n.links).toHaveLength(MAX_LINKS_PER_COMPANY_PAIR);
    expect(n.stats.considered).toBe(6);
  });

  it('caps only what is DRAWN — every built link stays in the per-site index', () => {
    const wide = buildFacilityLayer([
      ...Array.from({ length: 4 }, (_, i) => site(`s${i}`, { company: `sup${i}`, stages: ['wafers'] })),
      ...Array.from({ length: 4 }, (_, i) => site(`c${i}`, { company: `cust${i}`, stages: ['adv_fab'] })),
    ]);
    const CUSTOMERS = Object.fromEntries(
      Array.from({ length: 4 }, (_, i) => [`sup${i}`, Array.from({ length: 4 }, (_, j) => [`cust${j}`, 0.5])]),
    );
    const n = buildFacilityNetwork({ layer: wide, CUSTOMERS, dependence, maxLinks: 3 });
    expect(n.displayLinks).toHaveLength(3);
    expect(n.links.length).toBeGreaterThan(3);
    // every site still finds all of its own links despite the display cap
    const total = Object.values(n.linksByFacility).reduce((a, e) => a + e.outbound.length, 0);
    expect(total).toBe(n.links.length);
  });

  it('honours a global cap and records the overflow in stats', () => {
    const wide = buildFacilityLayer([
      ...Array.from({ length: 4 }, (_, i) => site(`s${i}`, { company: `sup${i}`, stages: ['wafers'] })),
      ...Array.from({ length: 4 }, (_, i) => site(`c${i}`, { company: `cust${i}`, stages: ['adv_fab'] })),
    ]);
    const CUSTOMERS = Object.fromEntries(
      Array.from({ length: 4 }, (_, i) => [`sup${i}`, Array.from({ length: 4 }, (_, j) => [`cust${j}`, 0.5])]),
    );
    const n = buildFacilityNetwork({ layer: wide, CUSTOMERS, dependence, maxLinks: 5 });
    expect(n.stats.shown).toBe(5);
    expect(n.stats.dropped).toBe(n.stats.built - 5);
    expect(n.stats.dropped).toBeGreaterThan(0);
  });

  it('drops links below the negligible-weight floor', () => {
    const n = buildFacilityNetwork({ layer, CUSTOMERS: { sup: [['cust', MIN_LINK_WEIGHT / 100]] }, dependence });
    expect(n.links).toEqual([]);
  });

  it('is empty, not broken, with no customers or no layer', () => {
    expect(buildFacilityNetwork({ layer, CUSTOMERS: {}, dependence }).links).toEqual([]);
    expect(buildFacilityNetwork().links).toEqual([]);
  });
});

describe('facilityConnectivity and linksSeveredBy', () => {
  const layer = buildFacilityLayer([
    site('a', { company: 'sup', stages: ['wafers'] }),
    site('b', { company: 'cust', stages: ['adv_fab'], country: 'tw' }),
  ]);
  const net = buildFacilityNetwork({ layer, CUSTOMERS: { sup: [['cust', 0.6]] }, dependence });

  it('sums inbound and outbound link weight per site', () => {
    const a = facilityConnectivity(net, 'a');
    const b = facilityConnectivity(net, 'b');
    expect(a.outbound).toBeGreaterThan(0);
    expect(a.inbound).toBe(0);
    expect(b.inbound).toBeCloseTo(a.outbound, 9);
    expect(a.degree).toBe(1);
  });

  it('returns zeros for an unconnected site rather than undefined', () => {
    expect(facilityConnectivity(net, 'nobody')).toEqual({ inbound: 0, outbound: 0, total: 0, degree: 0 });
  });

  it('finds the links a hazard would sever from either endpoint', () => {
    expect(linksSeveredBy(net, new Set(['a']))).toHaveLength(1);
    expect(linksSeveredBy(net, new Set(['b']))).toHaveLength(1);
    expect(linksSeveredBy(net, new Set(['nobody']))).toHaveLength(0);
    expect(linksSeveredBy(net, ['a'])).toHaveLength(1); // accepts a plain array too
  });
});

describe('facilityProfile — standardized for every site', () => {
  const ctx = {
    COMPANY_BY_ID: { sup: { name: 'Supplier Inc' } },
    COUNTRY_NAMES: { jp: 'Japan' },
    STAGE_BY_ID: { wafers: { name: 'Silicon wafers' }, adv_fab: { name: 'Advanced fab (≤7nm)' } },
    layer: buildFacilityLayer([site('a', { stages: ['wafers'], scale: 3 })]),
  };

  it('produces the same sections for every kind of site', () => {
    ['fab', 'assembly', 'materials', 'equipment', 'rnd', 'datacenter'].forEach((kind) => {
      const p = facilityProfile(site('x', { kind }), ctx);
      expect(p.headline).toContain(KIND_LABEL[kind]);
      expect(p.intro.length).toBeGreaterThan(40);
      expect(p.facts.map(([k]) => k)).toEqual([
        'Operator', 'Type', 'Country', 'Coordinates', 'Process / node',
        'Wafer size', 'Status', 'On record since', 'Significance (1–5)',
      ]);
      expect(p.caveats.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('always emits the same fact keys, using an em dash for unknown values', () => {
    const facts = Object.fromEntries(facilityFacts(site('x', { node: null, waferSize: null, since: null }), ctx));
    expect(facts['Process / node']).toBe('—');
    expect(facts['Wafer size']).toBe('—');
    expect(facts['On record since']).toBe('—');
  });

  it('says plainly that a design site and a datacentre make nothing', () => {
    expect(facilityIntro(site('d', { kind: 'rnd' }), ctx)).toMatch(/produces no physical output/);
    expect(facilityCaveats(site('d', { kind: 'rnd' })).join(' ')).toMatch(/No wafers are made here/);
    expect(facilityIntro(site('dc', { kind: 'datacenter' }), ctx)).toMatch(/demand site, not a production site/);
  });

  it('flags a site that carries no exposure weight in its own intro', () => {
    expect(facilityIntro(site('f', { status: 'construction' }), ctx)).toMatch(/no output to lose yet/);
    expect(facilityIntro(site('r', { status: 'ramping' }), ctx)).toMatch(/half weight/);
  });

  it('dates an unopened site by its target year, not as history', () => {
    expect(facilityIntro(site('f', { status: 'construction', since: 2028 }), ctx)).toMatch(/targeted for 2028/);
    expect(facilityIntro(site('f', { status: 'operating', since: 1984 }), ctx)).toMatch(/on record here since 1984/);
  });

  it('gives the definite article to the countries that need one', () => {
    const usCtx = { ...ctx, COUNTRY_NAMES: { us: 'United States', jp: 'Japan' } };
    expect(facilityIntro(site('a', { country: 'us' }), usCtx)).toMatch(/in the United States/);
    expect(facilityIntro(site('b', { country: 'jp' }), usCtx)).toMatch(/in Japan/);
  });

  it('names each kind as a noun that reads in a sentence', () => {
    expect(facilityIntro(site('a', { kind: 'assembly' }), ctx)).toMatch(/is an assembly and test plant/);
    expect(facilityIntro(site('b', { kind: 'rnd' }), ctx)).toMatch(/is a design and R&D site/);
  });

  it('never claims a capacity share — only a share of modeled sites', () => {
    const p = facilityProfile(site('a', { stages: ['wafers'] }), ctx);
    expect(p.intro).toMatch(/modeled sites/);
    expect(p.caveats.join(' ')).toMatch(/never of world capacity/);
    expect(p.intro).not.toMatch(/wafer starts|capacity share/i);
  });

  it('headlines with kind, operator and country', () => {
    expect(facilityHeadline(site('a'), ctx)).toBe('Wafer fab · Supplier Inc · Japan');
  });

  it('ranks stage roles by share', () => {
    const roles = facilityStageRoles(site('a', { stages: ['wafers'] }), ctx);
    expect(roles[0].stageName).toBe('Silicon wafers');
    expect(roles[0].share).toBeGreaterThan(0);
  });

  it('degrades to a readable profile with no context at all', () => {
    const p = facilityProfile(site('a'));
    expect(p.intro).toContain('a');
    expect(p.facts).toHaveLength(9);
  });
});
