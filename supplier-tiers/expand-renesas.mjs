/* ======================================================================
 * Renesas, in BOTH directions.
 *
 * WHY ONE COMPANY GETS A PASS OF ITS OWN.
 *
 * Before this pass, the documented network around Renesas was 74 firms
 * upstream and ONE firm downstream. That is not a finding about Renesas;
 * it is an artefact of how the earlier passes were built. They started
 * from buyer-published supplier lists — Apple's, Intel's, TSMC's award
 * announcements — so every firm they reached arrived as somebody's
 * SUPPLIER. Renesas inherited TSMC's entire supplier list two steps
 * upstream, and nothing at all on the side where its business actually
 * is: Renesas is an automotive and industrial MCU and SoC maker, and the
 * firms that matter to it are the ones it SELLS to.
 *
 * So this pass is deliberately lopsided the other way. Ten of its
 * fourteen edges have Renesas as the supplier, because that is the half
 * the dataset was missing, and because the customer side is where a
 * reader of a Renesas profile was most likely to be misled by silence.
 *
 * The one rule does not change: every edge cites a public document that
 * names both parties, and every document here was fetched and read on
 * 2026-11-25. Where the same announcement exists on both companies'
 * sites, the copy hosted by whichever party is the BUYER is the one
 * cited, so the evidence class says who disclosed what about whom
 * instead of flattening a joint release into a single direction.
 *
 * WHAT THESE DOCUMENTS ARE NOT:
 *
 *   - A development agreement is not a shipment. Honda/Renesas is an
 *     agreement to develop a chiplet SoC for vehicles late in the 2020s.
 *   - A strategic partnership is not a bill of materials. Audi (2015),
 *     NEVS (2015) and Great Wall (2017) name no part and no volume, and
 *     the oldest of them is eleven years old at the date checked.
 *   - A proof of concept is not a product. Inventec and Nidec both
 *     describe PoCs that Renesas supplied parts and reference designs
 *     into.
 *   - A design-in is not a purchase. Nullmax and Tata Elxsi build on
 *     Renesas silicon; neither document states that they buy it.
 *
 * Every one of those qualifications is carried on the edge itself, in
 * its detail string, which is where the interface shows it — beside the
 * claim, not in a footnote under the graph.
 * ====================================================================== */
export function expandRenesas(data) {
  const idOf = (ref) => {
    if (data.companies[ref]) return ref;
    const id = Object.keys(data.companies).find((k) => data.companies[k].vaultId === ref);
    if (!id) throw new Error(`Unknown Renesas-pass company: ${ref}`);
    return id;
  };
  const firm = (id, name, country, layer, role) => {
    if (data.companies[id]) throw new Error(`Duplicate Renesas-pass company: ${id}`);
    data.companies[id] = { name, country, layer, role };
  };
  const source = (id, publisher, title, url, published, evidence, note) => {
    if (data.sources[id]) throw new Error(`Duplicate Renesas-pass source: ${id}`);
    data.sources[id] = { publisher, title, url, published, evidence, note,
      kind: 'Company disclosure', seen: 'fetched', retrieved: '2026-11-25' };
  };
  /* Merges into an existing pair rather than adding a second edge: one
     relationship with two documents is one edge with two sources, and
     the dataset test that forbids a repeated ordered pair is the reason
     this is the only way to add to a pair. */
  const edge = (supplier, customer, product, sourceId, year, detail) => {
    const s = idOf(supplier), c = idOf(customer);
    if (s === c || !data.sources[sourceId]) throw new Error('Invalid Renesas-pass edge');
    let e = data.edges.find((x) => x.supplier === s && x.customer === c);
    if (!e) data.edges.push(e = { supplier: s, customer: c, products: [], sources: [], years: [], details: [] });
    for (const [field, value] of [['products', product], ['sources', sourceId], ['years', year], ['details', detail]]) {
      if (value && !e[field].includes(value)) e[field].push(value);
    }
  };

  /* ---- the firms, none of which the earlier passes had cause to carry ---- */
  firm('wolfspeed-inc', 'Wolfspeed, Inc.', 'us', 'wafers',
    'Silicon carbide substrate, epitaxial wafer and power device maker.');
  firm('globalfoundries-inc', 'GlobalFoundries Inc.', 'us', 'foundry_idm',
    'Specialty foundry: FD-SOI, BCD and feature-rich CMOS rather than leading-edge logic.');
  firm('andes-technology-corporation', 'Andes Technology Corporation', 'tw', 'services',
    'Licenses RISC-V CPU cores as design intellectual property.');
  firm('sifive-inc', 'SiFive, Inc.', 'us', 'services',
    'Licenses RISC-V CPU core intellectual property.');
  firm('honda-motor-co-ltd', 'Honda Motor Co., Ltd.', 'jp', 'brand',
    'Vehicle manufacturer; co-develops its own vehicle SoC and develops its own AI accelerator.');
  firm('vinfast-auto-ltd', 'VinFast Auto Ltd.', 'vn', 'brand',
    'Vietnamese electric vehicle manufacturer.');
  firm('audi-ag', 'AUDI AG', 'de', 'brand',
    'Vehicle manufacturer; runs the Progressive SemiConductor Program, which contracts chipmakers directly.');
  firm('great-wall-motor-company-limited', 'Great Wall Motor Company Limited', 'cn', 'brand',
    'Chinese SUV, pickup and new-energy vehicle manufacturer.');
  firm('national-electric-vehicle-sweden-ab', 'National Electric Vehicle Sweden AB (Nevs)', 'se', 'brand',
    'Electric vehicle developer built on the former Saab Automobile operations.');
  firm('nullmax', 'Nullmax', 'cn', 'services',
    'Autonomous-driving software company; builds ADAS stacks on third-party automotive SoCs.');
  firm('tata-elxsi-limited', 'Tata Elxsi Limited', 'in', 'services',
    'Automotive and electronics design-services house.');

  /* ====================  UPSTREAM: who supplies Renesas  ================= */

  source('renesas-wolfspeed-sic-2023', 'Wolfspeed', 'Renesas and Wolfspeed Sign 10 Year Silicon Carbide Wafer Supply Agreement',
    'https://www.wolfspeed.com/company/news-events/news/renesas-wolfspeed-10-year-wafer-supply-agreement/', '2023-07-05', 'P1-supplier',
    "Supplier-hosted joint release. States that the agreement calls for Wolfspeed to provide Renesas with 150mm silicon carbide bare and epitaxial wafers, and anticipates 200mm wafers later. A ten-year commitment secured by a deposit; no delivered volume is disclosed.");
  edge('wolfspeed-inc', 'renesas', 'Silicon carbide bare and epitaxial wafers', 'renesas-wolfspeed-sic-2023', 2023,
    'Ten-year supply agreement for 150mm SiC wafers, with 200mm anticipated once new capacity runs. A contracted commitment and a deposit, not a record of shipments.');

  source('renesas-gf-foundry-2026', 'Renesas', 'GlobalFoundries and Renesas Expand Partnership to Accelerate U.S. Semiconductor Manufacturing',
    'https://www.renesas.com/en/about/newsroom/globalfoundries-and-renesas-expand-partnership-accelerate-us-semiconductor-manufacturing', '2026-02-17', 'P1-buyer',
    "Buyer-hosted joint release. Renesas describes broadened access to GF's FDX (FD-SOI), BCD and feature-rich CMOS technologies for its SoCs, power devices and MCUs, beginning in the United States. Tape-outs are stated as on track to begin in mid-2026, so this is contracted access rather than production in hand. The printed date is February 17, 2026; the page metadata carries February 16.");
  edge('globalfoundries-inc', 'renesas', 'FD-SOI, BCD and feature-rich CMOS foundry capacity', 'renesas-gf-foundry-2026', 2026,
    'Expanded foundry access announced February 2026, with first tape-outs stated for mid-2026 and a possible porting of GF processes into Renesas fabs still under consideration. The newest document on this company, and the least settled.');

  source('renesas-andes-riscv-2020', 'Renesas', 'Renesas Selects Andes RISC-V 32-Bit CPU Cores for its First RISC-V Implementation of ASSPs',
    'https://www.renesas.com/en/about/press-room/renesas-selects-andes-risc-v-32-bit-cpu-cores-its-first-risc-v-implementation-assps', '2020-10-01', 'P1-buyer',
    "Buyer names its IP supplier: Renesas selected AndesCore 32-bit RISC-V CPU cores to embed into new application-specific standard products, sampling from the second half of 2021. Renesas has since published an in-house RISC-V core as well, so this is one line of its RISC-V products and not all of them.");
  edge('andes-technology-corporation', 'renesas', '32-bit RISC-V CPU core intellectual property', 'renesas-andes-riscv-2020', 2020,
    'Licensed CPU IP designed into ASSPs. A design-in of intellectual property, with no wafer, part or royalty figure disclosed.');

  source('renesas-sifive-riscv-2021', 'Renesas', 'Renesas and SiFive Partner to Jointly-Develop Next-Generation High-End RISC-V Solutions for Automotive Applications',
    'https://www.renesas.com/eu/en/about/press-room/renesas-and-sifive-partner-jointly-develop-next-generation-high-end-risc-v-solutions-automotive', '2021-04-21', 'P1-buyer',
    "Buyer names its IP supplier: the partnership includes SiFive licensing the use of their RISC-V core IP portfolio to Renesas. Joint development announced, with no product shipping on the announcement date. The printed date is April 21, 2021; the page metadata carries April 22.");
  edge('sifive-inc', 'renesas', 'High-end RISC-V core intellectual property for automotive', 'renesas-sifive-riscv-2021', 2021,
    'An IP licence plus joint development for future automotive designs. Nothing here names a shipped part.');

  /* The TSMC pair already exists, from a 2012 outsourcing announcement.
     This adds a 2025 document TO THAT PAIR rather than a second edge,
     because two edges would double-count one relationship. */
  source('renesas-honda-soc-2025-renesas', 'Renesas', 'Honda and Renesas Sign Agreement to Develop High-Performance SoC for Software-Defined Vehicles (Renesas copy)',
    'https://www.renesas.com/en/about/newsroom/honda-and-renesas-sign-agreement-develop-high-performance-soc-software-defined-vehicles', '2025-01-08', 'P1-buyer',
    "Cited here for its foundry claim rather than its customer claim: the release states that the SoC uses TSMC's leading-edge 3-nm automotive process technology, which is Renesas, as the buyer of foundry capacity, naming its foundry. The 2012 announcement on the same pair concerned 90nm and 40nm microcontrollers, so this is a different and far newer product.");
  edge('taiwan-semiconductor-manufacturing-company-limited', 'renesas', '3nm automotive process for the fifth-generation R-Car SoC', 'renesas-honda-soc-2025-renesas', 2025,
    'Named process technology for an SoC still in development as of January 2025. It refreshes a pair whose only other document was thirteen years older; it does not establish a current production volume.');

  /* ===================  DOWNSTREAM: who Renesas supplies  ================= */

  source('renesas-honda-soc-2025-honda', 'Honda', 'Honda and Renesas Sign Agreement to Develop High-Performance SoC for Software-Defined Vehicles (Honda copy)',
    'https://global.honda/en/newsroom/news/2025/c250108beng.html', '2025-01-08', 'P1-buyer',
    "Buyer-hosted copy of the joint release. Honda names Renesas and describes an SoC combining the Renesas fifth-generation R-Car X5 series with an AI accelerator Honda develops independently, targeted at Honda 0 Series models late in the 2020s. An agreement to develop, not a part in production.");
  edge('renesas', 'honda-motor-co-ltd', 'Fifth-generation R-Car X5 SoC for software-defined vehicles', 'renesas-honda-soc-2025-honda', 2025,
    "Development agreement for a multi-die chiplet SoC pairing R-Car X5 with Honda's own AI accelerator. The stated target is Honda 0 Series vehicles late in the 2020s, so no shipment is claimed.");

  source('renesas-vinfast-2022', 'Renesas', 'VinFast and Renesas Sign Strategic Partnership to Advance Automobile Technology',
    'https://www.renesas.com/en/about/newsroom/vinfast-and-renesas-sign-strategic-partnership-advance-automobile-technology', '2022-09-26', 'P1-supplier',
    "Supplier names its customer and, unusually for a partnership release, names shipped product: Renesas states that its SoCs, R-Car and analog products have already been implemented in the VinFast VF8 and VF9, and that the expanded agreement will provide a broader range including microcontrollers and power semiconductors.");
  edge('renesas', 'vinfast-auto-ltd', 'R-Car SoCs, microcontrollers, analog and power semiconductors', 'renesas-vinfast-2022', 2022,
    'The strongest downstream evidence on this company: devices stated as already implemented in two named vehicle models, plus an agreement to widen the range. Still no volume and no share.');

  source('renesas-inventec-gateway-2023', 'Renesas', 'Inventec and Renesas to Jointly Develop Proof-of-Concept for Automotive Gateways',
    'https://www.renesas.com/en/about/newsroom/inventec-and-renesas-jointly-develop-proof-concept-automotive-gateways', '2023-09-11', 'P1-supplier',
    "Supplier names its customer: Renesas will provide Inventec its latest offering of R-Car SoCs, analog and power products, along with engineering support, for a proof of concept for next-generation in-vehicle connected gateway systems.");
  edge('renesas', 'inventec-corporation', 'R-Car SoCs, analog and power products with engineering support', 'renesas-inventec-gateway-2023', 2023,
    'Parts and engineering supplied into a joint proof of concept with an ODM. A PoC programme, not a production gateway and not a disclosed order.');

  source('renesas-nidec-eaxle-2023', 'Renesas', 'Nidec and Renesas Collaborate on Semiconductor Solutions for Next-Generation E-Axle for EVs',
    'https://www.renesas.com/en/about/newsroom/nidec-and-renesas-collaborate-semiconductor-solutions-next-generation-e-axle-evs', '2023-06-05', 'P1-supplier',
    "Supplier names its customer: the two agreed to combine Nidec's motor technology and Renesas' semiconductor technology to jointly develop a proof of concept for an X-in-1 E-Axle system, with Renesas planning turnkey solutions built out of that PoC.");
  edge('renesas', 'nidec-corporation', 'Semiconductors and reference designs for X-in-1 E-Axle systems', 'renesas-nidec-eaxle-2023', 2023,
    'Joint development of an E-Axle proof of concept: an agreement to develop together, with no part number, order or volume disclosed.');

  source('renesas-nidec-8in1-2024', 'Renesas', 'Renesas Jointly Developed World-Class 8-in-1 Proof of Concept with Nidec, Delivering Advanced Integration for EV E-Axles',
    'https://www.renesas.com/en/about/newsroom/renesas-jointly-developed-world-class-8-1-proof-concept-nidec-delivering-advanced-integration-ev-e', '2024-11-11', 'P1-supplier',
    "The second phase of the same relationship, seventeen months on: Renesas states that it provided key components, including semiconductors and a reference design for the new 8-in-1 E-Axle system, which Nidec plans to productize. Still a proof of concept, shown at electronica 2024.");
  edge('renesas', 'nidec-corporation', 'Components and reference design for the 8-in-1 E-Axle proof of concept', 'renesas-nidec-8in1-2024', 2024,
    'The second documented phase of the Nidec relationship, which is why this pair carries two dates. Nidec states an intention to productize, and an intention to productize is not production.');

  source('renesas-nullmax-adas-2025', 'Nullmax', 'Nullmax and Renesas Forge Strategic Partnership to Deliver Competitive ADAS Solutions for the Global Market',
    'https://www.prnewswire.com/news-releases/nullmax-and-renesas-forge-strategic-partnership-to-deliver-competitive-adas-solutions-for-the-global-market-302385460.html', '2025-02-25', 'P1-buyer',
    "Software partner names the silicon it builds on: the release describes ADAS solutions combining Nullmax's software with the performance of Renesas' R-Car V4 and R-Car X5 series chips. A design-in rather than a disclosed purchase — Nullmax writes software and the page does not state that it buys chips.");
  edge('renesas', 'nullmax', 'R-Car V4 and R-Car X5 series SoCs for ADAS software', 'renesas-nullmax-adas-2025', 2025,
    'Named silicon under a third party ADAS stack. The weakest form of downstream evidence here: adoption by a software partner, with no channel, order or volume.');

  source('renesas-audi-pscp-2015', 'Renesas', 'Renesas Electronics and Audi Agree on Strategic Partnership for Audi Progressive SemiConductor Program',
    'https://www.renesas.com/en/about/press-room/renesas-electronics-and-audi-agree-strategic-partnership-audis-progressive-semiconductor-program', '2015-07-13', 'P1-supplier',
    "Renesas and Audi established a strategic relationship as part of the Audi Progressive SemiConductor Program, a programme whose stated purpose is for the carmaker to be in direct contact with semiconductor manufacturers. Eleven years old at the date checked, and it names no part.");
  edge('renesas', 'audi-ag', 'Automotive semiconductors under the Audi Progressive SemiConductor Program', 'renesas-audi-pscp-2015', 2015,
    'A direct carmaker-to-chipmaker programme covering control, automated drive, connected car and EV applications. Historical and part-free: evidence of a relationship in 2015, not of supply today.');

  source('renesas-great-wall-nev-2017', 'Renesas', 'Renesas Electronics and Great Wall Motors Announce Strategic Collaboration on Development of New Energy Vehicles and Self-Driving Cars',
    'https://www.renesas.com/en-hq/about/press-center/news/2017/news20170525.html', '2017-05-25', 'P1-supplier',
    "Supplier names the carmaker: a collaboration to develop automotive semiconductor technologies and solutions that will spur the growth of advanced new energy vehicles. No part, volume or vehicle programme is named.");
  edge('renesas', 'great-wall-motor-company-limited', 'Automotive semiconductor technologies for new-energy and self-driving vehicles', 'renesas-great-wall-nev-2017', 2017,
    'A 2017 development collaboration with a Chinese carmaker, nine years old at the date checked and never followed in this set by a part-level disclosure.');

  source('renesas-nevs-china-nev-2015', 'Renesas', 'Renesas Electronics and Nevs Sign Strategic Partnership Agreement to Promote Technological Development for China New Energy Vehicle Industry',
    'https://www.renesas.com/us/en/about/press-room/renesas-electronics-and-nevs-sign-strategic-partnership-agreement-promote-technological-development', '2015-11-06', 'P1-supplier',
    "Supplier names its partner: the companies will join forces on the development of various system solutions targeting China's new energy vehicle market. Nevs has restructured since, and nothing in this set claims the relationship continued.");
  edge('renesas', 'national-electric-vehicle-sweden-ab', 'System solutions for new-energy vehicles', 'renesas-nevs-china-nev-2015', 2015,
    'The oldest edge on this company and the thinnest: a 2015 partnership aimed at the China NEV market, with no part named and no later document.');

  source('renesas-tata-elxsi-ev-2022', 'Renesas', 'Tata Elxsi and Renesas Establish Next-Generation EV Innovation Center',
    'https://www.renesas.com/us/en/about/press-room/tata-elxsi-and-renesas-establish-next-generation-ev-innovation-center', '2022-03-03', 'P1-supplier',
    "Supplier names a design house: the two collaborate to create reference designs and solution accelerators for critical EV subsystems like battery management systems and motor control units. A design-services relationship around Renesas devices; the page does not state that Tata Elxsi buys silicon.");
  edge('renesas', 'tata-elxsi-limited', 'Reference designs for EV battery-management and motor-control subsystems', 'renesas-tata-elxsi-ev-2022', 2022,
    'A joint innovation centre, which puts Renesas parts into other companies’ designs rather than into products of its own. Counted as a documented counterparty, not as an end customer.');

  data.edges.sort((a, b) => a.customer.localeCompare(b.customer) || a.supplier.localeCompare(b.supplier));
  return data;
}
