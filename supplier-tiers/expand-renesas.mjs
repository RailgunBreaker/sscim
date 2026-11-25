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

  /* ======================================================================
     SECOND PASS, same company.

     The first pass found the firms Renesas announces partnerships WITH.
     That is a particular kind of document: a partnership release is what
     a chipmaker publishes when it wants a name beside its own. It left
     out the plainest kind of customer there is — the tier-one supplier
     that puts the part in a box and ships it to a carmaker — because
     those relationships are announced as design wins, in releases whose
     headline is a product rather than a partnership.

     Four of the five firms added here are automotive tier ones and one
     is a carmaker group. Two of them, Bosch and Toyota/Denso, are also
     the modeled customers the engine already carried for Renesas, at 8%
     and 20% supplier-revenue share. Until now the modeled chain and the
     documented chain named none of the same firms on this company. They
     do now, which is worth saying precisely because the two datasets are
     built to be independent: this is agreement found, not agreement
     arranged.
     ====================================================================== */

  firm('zf-friedrichshafen-ag', 'ZF Friedrichshafen AG', 'de', 'mechanical',
    'Automotive driveline, chassis and ADAS systems supplier.');

  source('renesas-toyota-rav4-2026', 'Renesas', 'Renesas R-Car V4H ADAS SoC Selected for Toyota RAV4 Model',
    'https://www.renesas.com/en/about/newsroom/renesas-r-car-v4h-adas-soc-selected-toyota-rav4-model', '2026-02-24', 'P1-supplier',
    "A design win, named at the part level: the R-Car V4H was selected for the TSS(LSS) control unit in Toyota's new RAV4, and the page states that the control unit is supplied by Denso Corporation. The strongest downstream document on this company — a named part, in a named unit, in a named vehicle.");
  /* One edge, not two. The tracked identity here is "Toyota / Denso",
     which the vault merges because Denso is Toyota's affiliated supplier;
     the public registry also carries Toyota Motor Corporation separately
     for the NVIDIA DRIVE edges. Recording this against both nodes would
     put one relationship in the dataset twice and make the carmaker
     appear as two firms in the same graph. The merge is stated on the
     edge instead, where a reader meets it. */
  edge('renesas', 'denso', 'R-Car V4H ADAS SoC for the TSS(LSS) control unit', 'renesas-toyota-rav4-2026', 2026,
    'Named part in a named ECU in a named vehicle: the Toyota Safety Sense control unit of the RAV4 that went on sale in December 2025. The tracked node merges Toyota and Denso; the document names Denso as the unit supplier and Toyota as the carmaker, and no separate Toyota edge is recorded for the same relationship.');

  source('renesas-continental-bodyhpc-2020', 'Renesas', 'Renesas Advanced Automotive SoC Adopted by Continental for Its Body High-Performance Computer',
    'https://www.renesas.com/en/about/press-room/renesas-advanced-automotive-soc-adopted-continental-its-body-high-performance-computer', '2020-07-07', 'P1-supplier',
    "Supplier names the tier one and the part: Continental adopted the Renesas R-Car M3 SoC for its first-generation Body High-Performance Computer. A Continental executive is quoted saying that computer is already going into production at a global vehicle manufacturer, who is not named.");
  edge('renesas', 'continental-ag', 'R-Car M3 SoC for the first-generation Body High-Performance Computer', 'renesas-continental-bodyhpc-2020', 2020,
    'A design win with a production claim attached, which is rare in this set — though the vehicle manufacturer taking it is left unnamed. Six years old at the date checked, and never updated by a later document here.');

  source('renesas-rcar-gen5-platform-2025', 'Renesas', 'Renesas Fast-Tracks SDV Innovation with R-Car Gen 5 SoC-Based End-to-End Multi-Domain Solution Platform',
    'https://www.renesas.com/en/about/newsroom/renesas-fast-tracks-sdv-innovation-r-car-gen-5-soc-based-end-end-multi-domain-solution-platform', '2025-12-16', 'P1-supplier',
    "Platform launch carrying quotes from two tier ones ahead of CES 2026: Bosch's Cross-Domain Computing Solutions division on integrating the R-Car X5 generation into its high-performance computing portfolio, and ZF's Electronics & ADAS division on combining the X5H with its own ADAS software. Silicon samples and evaluation boards are stated as shipping to select customers and partners. Nullmax is also named, among the software partners of the RoX Whitebox SDK.");
  edge('renesas', 'robert-bosch-gmbh', 'R-Car X5 generation SoCs for high-performance compute', 'renesas-rcar-gen5-platform-2025', 2025,
    'Stated intent to integrate, from the buyer, built on a collaboration the buyer calls existing. Samples were shipping at the date of the release; production was not claimed.');
  edge('renesas', 'zf-friedrichshafen-ag', 'R-Car X5H SoC under ZF ADAS software', 'renesas-rcar-gen5-platform-2025', 2025,
    'A full-stack ADAS combination announced ahead of a trade show. The weaker of the two tier-one edges from this release: it describes what the two companies will show, not what either has bought.');
  /* A second document on a pair the first pass called the weakest kind
     of downstream evidence. It is still a software partner, but it is
     now one the chipmaker lists in its own platform launch. */
  edge('renesas', 'nullmax', 'R-Car Gen 5 software partner in the RoX Whitebox SDK', 'renesas-rcar-gen5-platform-2025', 2025,
    'Named among the SDK software partners in the platform launch, eleven months after the ADAS partnership release. Two documents, both describing software built on Renesas silicon rather than silicon bought.');

  source('renesas-rh850-u2c-bosch-2026', 'Renesas', 'Renesas Expands Auto MCU Portfolio with 28nm RH850/U2C for Vehicle Control and Automotive Safety Applications',
    'https://www.renesas.com/en/about/newsroom/renesas-expands-auto-mcu-portfolio-28nm-rh850u2c-vehicle-control-and-automotive-safety-applications', '2026-03-04', 'P1-supplier',
    "A product launch whose customer quote is the evidence: Bosch's Chief Expert Semiconductor at Vehicle Motion says the 28nm MCUs offer strong performance and quality and that Bosch looks forward to continuing the collaboration, and that the RH850 family has long supported Bosch systems. The page names no foundry for the 28nm process.");
  edge('renesas', 'robert-bosch-gmbh', 'RH850/U2C 28nm vehicle-control microcontrollers', 'renesas-rh850-u2c-bosch-2026', 2026,
    'The buyer describes an existing, long-standing use of the RH850 family, which is stronger than the forward-looking X5 statement on the same pair. Two documents, fifteen months apart, on two different product lines.');

  /* ---- upstream, from the company's own product announcements ---- */

  source('renesas-rcar-x5h-3nm-2024', 'Renesas', "Renesas Unveils Industry's First Automotive Multi-Domain SoC Built with 3-nm Process Technology",
    'https://www.renesas.com/en/about/newsroom/renesas-unveils-industry-s-first-automotive-multi-domain-soc-built-3-nm-process-technology', '2024-11-13', 'P1-buyer',
    "A product announcement that names two of its own inputs: 32 Arm Cortex-A720AE application cores and six Arm Cortex-R52 lockstep cores, and manufacture on TSMC's N3A automotive process, with a TSMC executive quoted. A buyer naming its IP supplier and its foundry in the same document.");
  edge('arm', 'renesas', 'Cortex-A720AE and Cortex-R52 CPU core intellectual property', 'renesas-rcar-x5h-3nm-2024', 2024,
    'Named CPU cores in a named product. Renesas licenses RISC-V cores from two other vendors in this dataset as well; the architectures are alternatives in its line-up, not a succession.');
  edge('taiwan-semiconductor-manufacturing-company-limited', 'renesas', 'N3A 3nm automotive process for the R-Car X5H', 'renesas-rcar-x5h-3nm-2024', 2024,
    'The third document on this pair and the most specific about process: N3A, named by both companies, for a product announced in November 2024.');

  source('renesas-synopsys-dso-ai-2021', 'Synopsys', 'Synopsys AI-Driven Design System Enables Renesas to Achieve Breakthrough in Productivity',
    'https://news.synopsys.com/2021-04-15-Synopsys-AI-Driven-Design-System-Enables-Renesas-to-Achieve-Breakthrough-in-Productivity', '2021-04-15', 'P1-supplier',
    'Tool vendor names its customer: Synopsys announces the adoption of its DSO.ai design-space optimization system into the Renesas automotive design environment, with a Renesas director quoted. Design software, not silicon.');
  edge('synopsys', 'renesas', 'DSO.ai design-space optimization software for automotive SoCs', 'renesas-synopsys-dso-ai-2021', 2021,
    'An EDA dependency rather than a material one: nothing ships, but no modern SoC is designed without tools of this kind. Five years old at the date checked.');

  /* ---- THREE THINGS DELIBERATELY NOT ADDED ----

     Cadence published a March 2023 release on Renesas using Verisium to
     debug an R-Car SoC, and Mouser publishes releases calling itself an
     authorized Renesas distributor. Neither page could be read: the
     Cadence copies answered 403 and the Mouser copies timed out at every
     domain tried. The rule is a document that was read, not a document
     that is believed to exist, so neither is recorded and the EDA side
     of this company stays thinner than it really is.

     The third is a stronger case for restraint. CG Power, Renesas and
     Stars Microelectronics announced an OSAT joint venture in India on
     2024-03-01, and that page WAS read. It describes a joint venture and
     an equity split — 92.3 / 6.8 / 0.9 — and states nothing about the
     facility assembling or testing anything for Renesas. A shareholding
     is not a supply relationship, so it is not an edge here, and the
     packaging gap on this company stays open and visible. */

  /* ======================================================================
     THIRD PASS, same company: the parts of a chipmaker's trade that
     partnership releases and design wins both miss.

     Two passes had covered firms Renesas partners with and firms that
     design its silicon in. Three kinds of counterparty were still
     missing, and each one is missing for its own reason:

       - The memory-module side. Renesas sells registered clock drivers
         and power-management chips to DRAM makers, a business with
         nothing to do with cars, and those relationships are announced
         inside PRODUCT launches, as a customer quote near the bottom.
       - The rest of its own design inputs: a GPU architecture and a
         verification tool suite, licensed and bought respectively, and
         named in documents published by the vendors.
       - The distribution channel. Every chipmaker sells a large share of
         its volume through distributors, and they appear in none of the
         documents above because a distributor is not a design win.

     The channel edges are the weakest kind of customer in this dataset
     and are marked as such: a distributor buys to resell, so it is a
     counterparty but never an end user, and the document naming the
     three of them is six years old.
     ====================================================================== */

  firm('imagination-technologies-limited', 'Imagination Technologies Limited', 'uk', 'services',
    'Licenses GPU intellectual property; formerly the PowerVR line.');
  firm('nissan-motor-co-ltd', 'Nissan Motor Co., Ltd.', 'jp', 'brand',
    'Vehicle manufacturer.');
  firm('avnet-incorporated', 'Avnet, Inc.', 'us', 'services',
    'Electronic component distributor.');
  firm('future-electronics-incorporated', 'Future Electronics Inc.', 'ca', 'services',
    'Electronic component distributor.');
  firm('wt-microelectronics-co-ltd', 'WT Microelectronics Co., Ltd.', 'tw', 'services',
    'Electronic component distributor.');

  /* ---- upstream: the rest of what goes into the silicon ---- */

  source('renesas-imagination-gpu-2025', 'Imagination Technologies', 'Imagination GPU Powers Renesas R-Car Gen 5 SoC',
    'https://www.imaginationtech.com/news/imagination-gpu-powers-renesas-r-car-gen-5-soc/', '2025-03-10', 'P1-supplier',
    "IP vendor names its licensee: the IMG BXS automotive-grade B-Series GPU is licensed by Renesas and powers the next-generation R-Car Gen 5 SoC. The two companies have licensed graphics IP to each other's products since at least 2011, when the agreement covered the PowerVR Series6 family. No volume or royalty figure is given.");
  edge('imagination-technologies-limited', 'renesas', 'IMG BXS automotive GPU intellectual property', 'renesas-imagination-gpu-2025', 2025,
    'The graphics block of the R-Car Gen 5 line. Renesas licenses CPU IP from Arm, Andes and SiFive and GPU IP here: four IP suppliers, none of which ships anything physical.');

  source('renesas-cadence-verisium-2023', 'Cadence Design Systems', 'Cadence Verisium AI-Driven Verification Platform Accelerates Debug Productivity for Renesas',
    'https://www.eejournal.com/industry_news/cadence-verisium-ai-driven-verification-platform-accelerates-debug-productivity-for-renesas', '2023-03-09', 'P1-supplier',
    "Cadence's own press release, carrying its San Jose dateline and 'today announced' wording, read on EE Journal because both cadence.com and the Business Wire original answer 403 to an automated fetch. The release names the Verisium platform and its AutoTriage, SemanticDiff, WaveMiner, PinDown, Debug and Manager apps as deployed by Renesas on an R-Car SoC, and quotes the president of Renesas Design Vietnam. The productivity multiples in it are the vendor's own.");
  edge('cadence', 'renesas', 'Verisium AI-driven verification platform for R-Car SoC debug', 'renesas-cadence-verisium-2023', 2023,
    'The second EDA dependency on this company, after Synopsys. Cited from a reposted copy of the vendor release because the vendor and wire originals refuse automated readers; the text carries its own dateline.');

  /* ---- downstream: a business with nothing to do with cars ---- */

  source('renesas-gen6-ddr5-rcd-2025', 'Renesas', "Renesas' Industry-First Gen6 DDR5 Registered Clock Driver Sets Performance Benchmark by Delivering 9600 MT/s",
    'https://www.renesas.com/en/about/newsroom/renesas-industry-first-gen6-ddr5-registered-clock-driver-sets-performance-benchmark-delivering-9600', '2025-11-12', 'P1-supplier',
    "A product launch whose customer quote carries the evidence: Samsung's VP of DRAM Product Planning says Samsung has collaborated with Renesas across multiple generations of memory interface components, including the successful qualification of Gen5 DDR5 RCD and PMIC5030, and that it will integrate Gen6 into its DDR5 DIMMs. The Gen6 part itself is sampling, with production expected in the first half of 2027; the page claims 'all major DRAM suppliers' as sampling customers without naming them.");
  edge('renesas', 'samsung-electronics-company-limited', 'DDR5 registered clock drivers and DIMM power-management ICs', 'renesas-gen6-ddr5-rcd-2025', 2025,
    'The buyer states qualification of the previous generation — Gen5 RCD and PMIC5030 — which is the strongest form of words in this dataset short of a shipment. The newest part named is sampling, not in production.');

  source('renesas-industrial-rcd-micron-2021', 'Renesas', "Renesas Introduces Industry's First Industrial Temperature Grade DDR5 and DDR4 Registered Clock Drivers",
    'https://www.renesas.com/en/about/newsroom/renesas-introduces-industry-s-first-industrial-temperature-grade-ddr5-and-ddr4-registered-clock', '2021-11-04', 'P1-supplier',
    "Product launch quoting Micron's VP and GM of Core Compute Business on a collaboration with partners like Renesas opening new markets for memory at the intelligent edge. Read carefully, the quote does not say that Micron uses these parts, and the page makes no qualification or deployment claim about Micron.");
  edge('renesas', 'micron-technology-incorporated', 'Industrial temperature-grade DDR5 and DDR4 registered clock drivers', 'renesas-industrial-rcd-micron-2021', 2021,
    'The weakest memory edge and among the weakest in the set: a named executive describing a collaboration in general terms, with no part, volume or qualification attached to it. Kept because both parties are named in the same document, and marked because that is all it is.');

  source('renesas-nissan-skyline-propilot-2019', 'Renesas', 'Renesas Electronics Innovative Automotive Chips Adopted by Nissan for its New Skyline ProPILOT 2.0',
    'https://www.renesas.com/en/about/press-room/renesas-electronics-innovative-automotive-chips-adopted-nissan-its-new-skyline-propilot-20', '2019-08-07', 'P1-supplier',
    'Supplier names the carmaker and the parts: Nissan adopted the Renesas R-Car SoC and RH850 control MCU for the ProPILOT 2.0 system in the Skyline unveiled in July 2019. The R-Car builds the environment map, the RH850 sends commands to the steering, accelerator and brake ECUs.');
  edge('renesas', 'nissan-motor-co-ltd', 'R-Car SoC and RH850 control MCU for ProPILOT 2.0', 'renesas-nissan-skyline-propilot-2019', 2019,
    'A design win in a shipping vehicle, named at the part level. Seven years old at the date checked, and the second of two on this pair.');

  source('renesas-nissan-leaf-propilot-park-2017', 'Renesas', "Renesas' SoC and MCU Adopted by Nissan for its New LEAF Automated-Parking System",
    'https://www.renesas.com/en-us/about/press-center/news/2017/news20170907.html', '2017-09-07', 'P1-supplier',
    'The earlier of two Nissan releases: the R-Car SoC and RH850 MCU adopted for ProPILOT Park in the LEAF that debuted on 2017-09-06. The R-Car recognises the parking space and issues acceleration, braking, steering and shifting commands.');
  edge('renesas', 'nissan-motor-co-ltd', 'R-Car SoC and RH850 MCU for the ProPILOT Park automated-parking system', 'renesas-nissan-leaf-propilot-park-2017', 2017,
    'Two documents eight years apart on the same carmaker, each naming a different vehicle and system. Neither says anything about volume, and nothing here establishes that either relationship continues.');

  /* ---- downstream: the channel, which is not the same as a customer ---- */

  source('renesas-distribution-consolidation-2020', 'Renesas', 'Renesas Continues its Transformation with Distribution Channel Consolidation Guided by Sharpened Market Strategy and Broader Portfolio to Serve More Customers',
    'https://www.renesas.com/en/about/press-room/renesas-continues-its-transformation-distribution-channel-consolidation-guided-sharpened-market', '2020-06-10', 'P1-supplier',
    "Renesas names its own channel: Avnet, Future Electronics and WT Microelectronics as its top three distributors, with WT newly engaged and the WPI Group relationship terminated. Six years old at the date checked, and a distribution agreement is a route to market rather than a disclosed volume. WPI is deliberately NOT recorded as an edge: this document is the only one naming it, and what it says is that the relationship ended.");
  for (const d of ['avnet-incorporated', 'future-electronics-incorporated', 'wt-microelectronics-co-ltd']) {
    edge('renesas', d, 'Distribution of Renesas components to end customers', 'renesas-distribution-consolidation-2020', 2020,
      'Channel, not demand: a distributor buys to resell, so this edge says where the parts go next and nothing about who finally uses them. Named in a 2020 consolidation announcement that also ended a fourth distributor relationship.');
  }

  /* Still missing after three passes, and left missing on purpose:
     packaging and test (the India joint venture states no supply),
     the wafer and equipment suppliers of Renesas' own fabs, and any
     industrial customer at all — searches for Panasonic, Omron, Yaskawa,
     Mitsubishi Electric and Fanuc found product pages and no document
     naming a pair. Roughly half of Renesas' units are said to go to
     industrial, IoT and infrastructure markets, and this dataset can see
     almost none of it. That is a statement about disclosure, and it is
     the kind of hole the lens exists to show. */

  /* Years arrive in the order the passes happen to add them, and the
     interface prints them as a list under each relationship. A pair
     carrying "2012, 2025, 2024" reads as a mistake even though the set
     is right, so they are ordered here, in the pass that runs last. */
  for (const e of data.edges) e.years.sort((a, b) => a - b);

  data.edges.sort((a, b) => a.customer.localeCompare(b.customer) || a.supplier.localeCompare(b.supplier));
  return data;
}
