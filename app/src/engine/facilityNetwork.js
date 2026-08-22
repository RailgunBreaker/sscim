/* ====================================================================
   engine/facilityNetwork.js — connecting the sites to each other.

   The vault already knows two things separately: that company A supplies
   company B (the `customers` table), and that stage X feeds stage Y (the
   flow graph). Neither is geographic. This module composes them into
   site-to-site links, so the map can show not just where plants are but
   how they connect.

   THE RULE, stated once and applied uniformly. A link is drawn from
   supplier site `s` to customer site `c` when all three hold:

     1. s's operator sells to c's operator (a `customers` edge exists),
     2. some stage of s REACHES some stage of c downstream in the flow graph,
        and
     3. both sites carry exposure weight (neither is under construction).

   Rule 2 deliberately uses reachability over all paths rather than a single
   direct edge. A direct-edge test looked tighter and was wrong: JSR sells
   photoresist to TSMC, but the graph routes resist → litho → adv_fab, so a
   direct test silently dropped every materials-to-fab relationship in the
   dataset — 130 of 243 company edges, which is most of the upstream half of
   the chain. The commercial edge is what gates a link; the graph only sizes
   it.

   Its weight is the product of three factors that are each already in the
   model, and nothing else:

     weight = companyShare × siteShare(s in its stage) × siteShare(c in its stage) × reach(sStage → cStage)

   where `reach` is the engine's own signed downstream propagation from a unit
   shock — the same function that moves every event through the chain.

   WHAT THIS IS NOT. It is not a shipment route, a logistics lane, or an
   observed trade flow. No dataset here records which plant ships to which
   plant; the model knows company-level revenue share and stage adjacency,
   and this is the most that can honestly be built from them. Two sites of
   the same company pair get links in proportion to their significance
   ordinals — which is an allocation assumption, not an observation, and
   is exactly as strong as the ordinals themselves.

   The label used everywhere this surfaces is "modeled site-to-site link",
   never "route" and never "shipment".

   Pure and dependency-free so the rule is unit-testable.
   ==================================================================== */

import { siteWeight } from './facilities.js';

/* Rendering and reasoning both degrade past a few hundred lines, and the
   long tail is dominated by pairs whose weight rounds to nothing. Both caps
   are reported by the builder rather than applied silently. */
export const MAX_LINKS_PER_COMPANY_PAIR = 4;
export const DEFAULT_MAX_LINKS = 400;

/* A weight is the product of four fractions — company revenue share, two site
   shares, and a propagated reach that decays along the path — so a perfectly
   ordinary link between two real plants lands around 1e-6. This floor exists
   only to drop numerical dust; set anywhere near the values the formula
   actually produces it silently deletes the entire back end of the chain,
   which is how the first version of this module lost every OSAT. Density is
   controlled by the caps above, which are reported; the floor is not. */
export const MIN_LINK_WEIGHT = 1e-9;

/* Builds the site-to-site link set.

   `dependence(supplierStage, customerStage)` returns how strongly the
   supplier stage reaches the customer stage downstream, or 0 when it does not
   reach it at all. Build it from the engine's own propagation and memoize per
   supplier stage — there are only ~24 stages, so it is 24 propagations:

     const cache = {};
     const dependence = (s, c) =>
       (cache[s] ||= engine.propagateTrace(s, 1, 'downstream').field)[c] ?? 0;  */
export function buildFacilityNetwork({
  layer,
  CUSTOMERS = {},
  dependence = () => 0,
  maxLinks = DEFAULT_MAX_LINKS,
  maxLinksPerPair = MAX_LINKS_PER_COMPANY_PAIR,
} = {}) {
  const byCompany = layer?.FACILITIES_BY_COMPANY || {};
  const links = [];
  let considered = 0;

  Object.entries(CUSTOMERS).forEach(([supplierId, customerList]) => {
    const supplierSites = (byCompany[supplierId] || []).filter((f) => siteWeight(f) > 0);
    if (!supplierSites.length) return;

    (customerList || []).forEach(([customerId, companyShare]) => {
      const customerSites = (byCompany[customerId] || []).filter((f) => siteWeight(f) > 0);
      if (!customerSites.length || !(companyShare > 0)) return;

      const pairLinks = [];
      supplierSites.forEach((s) => {
        customerSites.forEach((c) => {
          if (s.id === c.id) return;
          considered++;

          /* Strongest reaching stage pair between the two sites. Taking the
             max rather than summing keeps a multi-stage site from being
             counted several times over for one commercial relationship.

             Both directions are tried, because the commercial arrow and the
             physical one do not always agree. ASE "supplies" NVIDIA, but
             packaging sits DOWNSTREAM of design in the flow graph: the die
             moves from the fab to the OSAT and back out as a package, while
             the invoice goes the other way. A forward-only test threw that
             whole class of relationship away. Links found the other way round
             are marked `flow: 'service'` rather than quietly relabelled. */
          let best = 0;
          let bestPair = null;
          let flow = 'forward';
          (s.stages || []).forEach((sStage) => {
            (c.stages || []).forEach((cStage) => {
              const fwd = dependence(sStage, cStage) || 0;
              if (fwd > best) { best = fwd; bestPair = [sStage, cStage]; flow = 'forward'; }
            });
          });
          if (!best) {
            (s.stages || []).forEach((sStage) => {
              (c.stages || []).forEach((cStage) => {
                const back = dependence(cStage, sStage) || 0;
                if (back > best) { best = back; bestPair = [sStage, cStage]; flow = 'service'; }
              });
            });
          }
          if (!best || !bestPair) return;

          const weight = companyShare
            * layer.shareOfStage(s, bestPair[0])
            * layer.shareOfStage(c, bestPair[1])
            * best;
          if (!(weight > MIN_LINK_WEIGHT)) return;

          pairLinks.push({
            from: s.id, to: c.id,
            fromCompany: supplierId, toCompany: customerId,
            fromStage: bestPair[0], toStage: bestPair[1],
            companyShare, dependence: best, weight, flow,
          });
        });
      });

      pairLinks.sort((a, b) => b.weight - a.weight);
      links.push(...pairLinks.slice(0, maxLinksPerPair));
    });
  });

  links.sort((a, b) => b.weight - a.weight);

  /* The raw weight is a product of four fractions, so it lands around 1e-6
     and reads as zero at any sane number of decimal places. `rel` restates it
     against the strongest modeled link, which is the only comparison the
     number can honestly support anyway — it is a relative ordering, not a
     volume. */
  const maxWeight = links[0]?.weight ?? 0;
  links.forEach((l) => { l.rel = maxWeight ? l.weight / maxWeight : 0; });

  /* The cap applies to what is DRAWN, not to what is known. Every built link
     stays in the per-site index, so a plant's own profile lists all of its
     connections even when the global map is showing only the strongest few
     hundred — a per-site view that silently omitted links would be a worse
     lie than a crowded map. */
  const display = links.slice(0, maxLinks);

  const byFacility = {};
  links.forEach((l) => {
    (byFacility[l.from] ||= { outbound: [], inbound: [] }).outbound.push(l);
    (byFacility[l.to] ||= { outbound: [], inbound: [] }).inbound.push(l);
  });
  Object.values(byFacility).forEach((e) => {
    e.outbound.sort((a, b) => b.weight - a.weight);
    e.inbound.sort((a, b) => b.weight - a.weight);
  });

  return {
    links,
    displayLinks: display,
    linksByFacility: byFacility,
    /* Reported, never silent: a truncated view that looks complete is the
       failure mode this whole codebase is written against. */
    stats: {
      considered,
      built: links.length,
      shown: display.length,
      dropped: links.length - display.length,
      service: links.filter((l) => l.flow === 'service').length,
      maxWeight,
    },
  };
}

/* How connected a site is, for marker sizing and ranking: the total weight
   of links touching it. Not a centrality metric — a sum of modeled weights. */
export function facilityConnectivity(network, facilityId) {
  const e = network?.linksByFacility?.[facilityId];
  if (!e) return { inbound: 0, outbound: 0, total: 0, degree: 0 };
  const sum = (arr) => arr.reduce((a, l) => a + l.weight, 0);
  const inbound = sum(e.inbound);
  const outbound = sum(e.outbound);
  return { inbound, outbound, total: inbound + outbound, degree: e.inbound.length + e.outbound.length };
}

/* The links a hazard footprint would sever: any link with at least one
   endpoint inside the radius. This is the network answer to "what does this
   disaster cut", as distinct from the stage-exposure answer. */
export function linksSeveredBy(network, insideIds) {
  const inside = insideIds instanceof Set ? insideIds : new Set(insideIds || []);
  // Every built link, not just the drawn ones — a hazard readout that counted
  // only what happened to be on screen would understate the cut.
  return (network?.links || []).filter((l) => inside.has(l.from) || inside.has(l.to));
}
