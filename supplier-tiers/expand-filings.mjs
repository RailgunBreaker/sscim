/* ====================================================================
   Coverage pass: relationships named in annual securities filings.

   WHY THIS FILE EXISTS. The first authoring pass was built from buyer
   lists and award lists — Apple's supplier list, TSMC's and Intel's
   award announcements. Those are excellent documents, but they all
   point the same way: a large buyer naming the firms it buys from. The
   result was a graph with deep coverage around three or four buyers and
   nothing at all behind the other hundred-odd firms the system tracks.

   Annual securities filings are the other half of the record, and they
   are stronger evidence than anything short of a buyer list, because a
   filing is signed and carries liability. Three disclosure habits do
   almost all of the work here:

     1. A fabless company must explain who makes its silicon. Qualcomm,
        Broadcom and Analog Devices name their foundries and their
        assembly-and-test houses outright.
     2. A supplier whose revenue is concentrated must say in whom. That
        is how Applied Materials, Lam, ASML, SK hynix and TSMC acquire
        documented suppliers here: not from their own filings, which
        name nobody, but from the filings of the firms that sell to
        them.
     3. A company that buys through a joint venture must describe it.
        NXP's capacity entitlements in SSMC, ESMC and VSMC are stated
        with percentages.

   WHAT IS DELIBERATELY NOT HERE. Filings are full of company names that
   are not supply relationships, and every one of them was excluded:

     - COMPETITOR LISTS. Micron's 10-K names Samsung, SK hynix, Kioxia,
       Sandisk, CXMT and YMTC in one sentence. They are its competitors.
       Reading that sentence as supply would have been the single
       largest and most wrong addition this pass could have made.
     - M&A. Marvell's sale of its automotive ethernet business to
       Infineon is a transaction, not a flow of goods.
     - BIOGRAPHIES. "Prior to joining, Ms. — served at Lam Research"
       names two parties and establishes nothing.

   HONEST ABSENCES WORTH KEEPING. Several filings were read and yielded
   nothing, which is a finding rather than a failure: Photronics
   anonymises its customers as "Customer A, B and C"; Teradyne, MKS,
   Advanced Energy and Kulicke & Soffa do the same; Applied Materials,
   Lam, TSMC and Intel name no counterparties in their own filings;
   Marvell says only "independent foundries" and subcontractors
   "primarily located in Taiwan, Canada, Korea, Singapore and China".
   Those firms are not better connected here than the evidence allows.

   Every source below was fetched from SEC EDGAR and read for this
   dataset; the quote on each is verbatim from the filing.
   ==================================================================== */

export function expandFilings(data) {
  /* Resolve a vault id, an explicit node id, or a name already in the
     registry to the node id an edge should use. Throwing on an unknown
     id is deliberate: a typo must break the build rather than quietly
     create a second, disconnected node for a firm already present. */
  const idOf = (ref) => {
    if (resolved.has(ref)) return resolved.get(ref);
    if (data.companies[ref]) return ref;
    const hit = Object.keys(data.companies).find((id) => data.companies[id].vaultId === ref);
    if (!hit) throw new Error(`expand-filings: unknown company ref "${ref}"`);
    return hit;
  };

  /* Registering a firm has to resolve to the company, not to a string.
     The registry was seeded from buyer lists that spell names their own
     way — "FormFactor, Incorporated", "Coherent Corporation", "Nan Ya
     PCB Corporation" — while filings spell the same firms "FormFactor,
     Inc.", "Coherent Corp." and "Nan Ya Printed Circuit Board
     Corporation". Keying on an id built from the filing's spelling
     silently created a second node for a firm already present, which
     splits its edges across two half-connected copies and is worse than
     having no node at all. So `firm` matches on a normalised name and
     returns the existing id when it finds one. */
  const LEGAL = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|gmbh|ag|nv|sa|plc|kg|se|pte|llc|holdings?|group)\b/g;
  const norm = (s) => s.toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(LEGAL, ' ')
    .replace(/\s+/g, '');

  /* Spelling differences normalisation cannot bridge, because the two
     forms share no words: an abbreviation, and a parent-brand prefix. */
  const SAME_FIRM = {
    nanyaprintedcircuitboard: 'nanyapcb',
    carlzeisssmt: 'zeisssemiconductormanufacturingtechnology',
  };
  const key = (name) => {
    const n = norm(name);
    return SAME_FIRM[n] || n;
  };

  const byName = new Map();
  for (const [id, c] of Object.entries(data.companies)) {
    const k = key(c.name);
    if (!byName.has(k)) byName.set(k, id);
  }

  /* When `firm` resolves to a node the registry already had, the id
     this file used stays valid as a label for that firm, so edges below
     can keep referring to it. `resolved` is how `idOf` follows it. */
  const resolved = new Map();
  const firm = (id, name, country, layer, role) => {
    const existing = byName.get(key(name)) || (data.companies[id] ? id : null);
    if (existing) {
      if (existing !== id) resolved.set(id, existing);
      return existing;
    }
    data.companies[id] = { name, country, layer, role };
    byName.set(key(name), id);
    return id;
  };

  const source = (id, o) => {
    data.sources[id] = {
      kind: o.kind || 'Annual securities filing',
      seen: 'fetched',
      retrieved: '2026-11-23',
      ...o,
    };
  };

  const edge = (supplier, customer, product, sourceId, year, detail = '') => {
    const s = idOf(supplier);
    const c = idOf(customer);
    if (s === c) throw new Error(`expand-filings: self-edge on ${s}`);
    let e = data.edges.find((x) => x.supplier === s && x.customer === c);
    if (!e) {
      e = { supplier: s, customer: c, products: [], sources: [], years: [], details: [] };
      data.edges.push(e);
    }
    for (const [field, value] of [['products', product], ['sources', sourceId], ['years', year], ['details', detail]]) {
      if (value && !e[field].includes(value)) e[field].push(value);
    }
    return e;
  };

  /* ------------------------------------------------------------------ *
   * Firms named in the filings below that the registry did not yet
   * hold. Each one is here because a filing names it in a supply
   * relationship with a company the system tracks — none is added
   * speculatively.
   * ------------------------------------------------------------------ */
  firm('ultra-clean-holdings-inc', 'Ultra Clean Holdings, Inc.', 'us', 'equipment',
    'Builds the gas-delivery and fluid subsystems that go inside wafer-fab equipment.');
  firm('ichor-holdings-ltd', 'Ichor Holdings, Ltd.', 'us', 'equipment',
    'Fluid-delivery and gas-delivery subsystems for wafer-fab equipment makers.');
  firm('formfactor-inc', 'FormFactor, Inc.', 'us', 'equipment',
    'Probe cards and test systems used to test wafers before they are cut.');
  firm('teradyne-inc', 'Teradyne, Inc.', 'us', 'equipment', 'Automated test equipment for finished chips.');
  firm('advantest-corporation', 'Advantest Corporation', 'jp', 'equipment', 'Automated test equipment for finished chips.');
  firm('all-ring-tech-co-ltd', 'All Ring Tech Co., Ltd.', 'tw', 'equipment', 'Packaging and assembly equipment.');
  firm('marketech-international-corp', 'Marketech International Corp.', 'tw', 'equipment',
    'Supplies and integrates semiconductor production equipment.');
  firm('grand-process-technology-corp', 'Grand Process Technology Corporation', 'tw', 'equipment',
    'Wet-process and cleaning equipment for packaging lines.');
  firm('soitec-sa', 'Soitec S.A.', 'fr', 'wafers', 'Engineered substrates, including silicon-on-insulator wafers.');
  firm('coherent-corp', 'Coherent Corp.', 'us', 'optics_laser', 'Lasers, optical networking components and compound-semiconductor materials.');
  firm('skyworks-solutions-inc', 'Skyworks Solutions, Inc.', 'us', 'ic_other', 'Radio-frequency front-end chips for mobile devices.');
  firm('alpha-and-omega-semiconductor-ltd', 'Alpha & Omega Semiconductor Limited', 'us', 'ic_other',
    'Power semiconductors and power-management ICs.');
  firm('silicon-motion-technology-corp', 'Silicon Motion Technology Corporation', 'tw', 'ic_other',
    'NAND flash controller chips sold to memory makers and module houses.');
  firm('chipmos-technologies-inc', 'ChipMOS TECHNOLOGIES INC.', 'tw', 'osat_test',
    'Assembly and test, concentrated in display-driver and memory packaging.');
  firm('stats-chippac-pte-ltd', 'STATS ChipPAC Pte. Ltd.', 'sg', 'osat_test',
    'Assembly and test provider; acquired by JCET Group, which is tracked separately.');
  firm('kinsus-interconnect-technology-corp', 'Kinsus Interconnect Technology Corporation', 'tw', 'substrates_pcb',
    'IC packaging substrates.');
  firm('nan-ya-printed-circuit-board-corp', 'Nan Ya Printed Circuit Board Corporation', 'tw', 'substrates_pcb',
    'IC packaging substrates and printed circuit boards. A Formosa Plastics affiliate, and a different company from Nanya Technology, the memory maker.');
  firm('himax-technologies-inc', 'Himax Technologies, Inc.', 'tw', 'display_camera',
    'Display driver ICs and optical sensing, sold into panel and camera modules.');
  firm('macronix-international-co-ltd', 'Macronix International Co., Ltd.', 'tw', 'memory', 'NOR and NAND flash memory, with its own fabs.');
  firm('powerchip-semiconductor-manufacturing-corp', 'Powerchip Semiconductor Manufacturing Corporation (PSMC)', 'tw', 'foundry_idm',
    'Mature-node foundry.');
  firm('sk-hynix-system-ic', 'SK hynix system ic', 'kr', 'foundry_idm',
    'Mature-node foundry subsidiary of SK hynix, named as "SKHYSI" in customer filings.');
  firm('realtek-semiconductor-corp', 'Realtek Semiconductor Corp.', 'tw', 'ic_other', 'Networking, audio and interface ICs.');
  firm('novatek-microelectronics-corp', 'Novatek Microelectronics Corp.', 'tw', 'ic_other', 'Display driver and timing-controller ICs.');
  firm('phison-electronics-corp', 'Phison Electronics Corp.', 'tw', 'ic_other', 'NAND flash controllers and storage modules.');
  firm('raydium-semiconductor-corp', 'Raydium Semiconductor Corporation', 'tw', 'ic_other', 'Display driver and touch controller ICs.');
  firm('gigadevice-semiconductor', 'GigaDevice Semiconductor (HK) Limited', 'cn', 'memory', 'NOR flash and microcontrollers.');
  firm('elite-semiconductor-microelectronics-technology', 'Elite Semiconductor Microelectronics Technology Inc.', 'tw', 'memory',
    'Specialty DRAM and memory products.');
  firm('chipone-technology-beijing', 'Chipone Technology (Beijing) Co., Ltd.', 'cn', 'display_camera', 'Display driver ICs.');
  firm('ili-technology-corp', 'ILI Technology Corporation', 'tw', 'display_camera', 'Display driver ICs.');
  firm('integrated-circuit-solution-inc', 'Integrated Circuit Solution Inc.', 'tw', 'memory', 'Specialty memory and mixed-signal ICs.');
  firm('asahi-kasei-microdevices-corp', 'Asahi Kasei Microdevices Corporation', 'jp', 'ic_other', 'Analog, sensor and audio ICs.');
  firm('chipbond-technology-corp', 'Chipbond Technology Corporation', 'tw', 'osat_test', 'Gold bumping and display-driver packaging.');
  firm('ardentec-corp', 'Ardentec Corporation', 'tw', 'osat_test', 'Wafer and final test services.');
  firm('compal-electronics-inc', 'Compal Electronics, Inc.', 'tw', 'assembly', 'Notebook and device ODM.');
  firm('delta-electronics-inc', 'Delta Electronics, Inc.', 'tw', 'mechanical', 'Power supplies, cooling and electronic components.');
  firm('continental-ag', 'Continental AG', 'de', 'mechanical', 'Automotive systems supplier.');
  firm('aumovio-se', 'Aumovio SE', 'de', 'mechanical', 'Automotive electronics business separated from Continental.');
  firm('vitesco-technologies', 'Vitesco Technologies', 'de', 'mechanical', 'Automotive powertrain electronics.');
  firm('aptiv-plc', 'Aptiv PLC', 'ie', 'mechanical', 'Vehicle electrical architecture and components.');
  firm('visteon-corp', 'Visteon Corporation', 'us', 'mechanical', 'Vehicle cockpit electronics.');
  firm('harman-international', 'Harman Auto', 'us', 'mechanical', 'Automotive audio and connected-car electronics; a Samsung subsidiary.');
  firm('hyundai-motor-company', 'Hyundai', 'kr', 'brand', 'Vehicle manufacturer.');
  firm('lg-electronics-automotive', 'LGE Automotive', 'kr', 'mechanical', 'Automotive component business of LG Electronics.');
  firm('mobileye-global-inc', 'Mobileye', 'il', 'ic_other', 'Driver-assistance chips and systems.');
  firm('space-exploration-technologies-corp', 'SpaceX', 'us', 'brand', 'Launch vehicles and satellite constellation.');
  firm('carl-zeiss-smt-gmbh', 'Carl Zeiss SMT GmbH', 'de', 'optics_laser',
    'Builds the optics for lithography systems. ASML discloses it as the sole supplier of its lenses, mirrors, illuminators and collectors, under an exclusive arrangement.');

  /* ------------------------------------------------------------------ *
   * FABLESS AND IDM FILINGS — a company naming the firms that make its
   * silicon. The strongest evidence in this pass: the buyer is naming
   * its own suppliers in a signed filing.
   * ------------------------------------------------------------------ */

  source('qcom-10k-fy2026', {
    publisher: 'Qualcomm Incorporated',
    title: 'Form 10-K, fiscal year ended September 27, 2026 — Item 1, QCT Segment',
    url: 'https://www.sec.gov/Archives/edgar/data/804328/000080432826000128/qcom-20260927.htm',
    published: '2026-11-04',
    evidence: 'P1-self',
    quote: 'The primary foundry suppliers for our various digital, analog/mixed-signal, RF and PM integrated circuits include Taiwan Semiconductor Manufacturing Company (TSMC), Samsung Electronics and GlobalFoundries. We primarily purchase memory components for certain of our products (including automotive) from Micron Technology and Samsung Electronics. Our primary semiconductor assembly and test suppliers are Amkor Technology, Advanced Semiconductor Engineering, Siliconware Precision Industries and STATS ChipPAC.',
    note: 'Names foundry, memory and assembly-and-test suppliers in one paragraph. The same filing names Apple and Samsung as the customers above 10% of revenue, so Samsung appears on both sides of Qualcomm as two separate relationships.',
  });
  for (const [s, product] of [['tsmc', 'Wafer foundry'], ['samsung', 'Wafer foundry'], ['gf', 'Wafer foundry']]) {
    edge(s, 'qualcomm', product, 'qcom-10k-fy2026', 2026);
  }
  edge('micron', 'qualcomm', 'Memory components', 'qcom-10k-fy2026', 2026);
  edge('samsung', 'qualcomm', 'Memory components', 'qcom-10k-fy2026', 2026);
  for (const s of ['amkor', 'ase', 'spil', 'stats-chippac-pte-ltd']) {
    edge(s, 'qualcomm', 'Semiconductor assembly and test', 'qcom-10k-fy2026', 2026);
  }
  edge('qualcomm', 'apple', 'Named as a customer above 10% of consolidated revenues', 'qcom-10k-fy2026', 2026,
    'Revenue concentration disclosure. It records that the customer is material to Qualcomm, not what Qualcomm supplies.');
  edge('qualcomm', 'samsung', 'Named as a customer above 10% of consolidated revenues', 'qcom-10k-fy2026', 2026,
    'Samsung is disclosed as both a foundry/memory supplier and a customer above 10% of revenue. The two are separate relationships.');

  source('qcom-10k-fy2025', {
    publisher: 'Qualcomm Incorporated',
    title: 'Form 10-K, fiscal year ended September 28, 2025 — Revenue Concentrations and Significant Customers',
    url: 'https://www.sec.gov/Archives/edgar/data/804328/000080432825000085/qcom-20250928.htm',
    published: '2025-11-05',
    evidence: 'P1-self',
    quote: 'In fiscal 2025, revenues from Apple, Samsung and Xiaomi each comprised 10% or more of our consolidated revenues.',
    note: 'Cited for the Xiaomi relationship, which is named in fiscal 2025 and not in the fiscal 2026 filing. An edge records that a relationship was publicly named in a given year; it does not claim the relationship continues.',
  });
  edge('qualcomm', 'xiaomi', 'Named as a customer above 10% of consolidated revenues', 'qcom-10k-fy2025', 2025,
    'Named in the fiscal 2025 filing. Xiaomi is not among the 10%-or-more customers named in the fiscal 2026 filing.');

  source('avgo-10k-fy2024', {
    publisher: 'Broadcom Inc.',
    title: 'Form 10-K, fiscal year ended November 3, 2024 — Item 1, Manufacturing',
    url: 'https://www.sec.gov/Archives/edgar/data/1730168/000173016824000139/avgo-20241103.htm',
    published: '2024-12-20',
    evidence: 'P1-self',
    quote: 'We use third-party contract manufacturers for a significant majority of our assembly and test operations, including TSMC, Advanced Semiconductor Engineering, Inc., Foxconn Technology Group, Amkor Technology, Inc. and Siliconware Precision Industries Co., Ltd.',
    note: 'The same Item 1 states that front-end wafer manufacturing is outsourced to external foundries "including Taiwan Semiconductor Manufacturing Company Limited (TSMC)", and a risk factor adds that TSMC manufactured approximately 95% of the wafers made by Broadcom’s contract manufacturers in fiscal 2024.',
  });
  edge('tsmc', 'broadcom', 'Wafer foundry', 'avgo-10k-fy2024', 2024,
    'A risk factor in the same filing puts TSMC at about 95% of the wafers manufactured by Broadcom’s contract manufacturers in fiscal 2024.');
  edge('tsmc', 'broadcom', 'Assembly and test', 'avgo-10k-fy2024', 2024);
  for (const s of ['ase', 'foxconn', 'amkor', 'spil']) {
    edge(s, 'broadcom', 'Assembly and test', 'avgo-10k-fy2024', 2024);
  }

  source('adi-10k-fy2025', {
    publisher: 'Analog Devices, Inc.',
    title: 'Form 10-K, fiscal year ended November 1, 2025 — Manufacturing',
    url: 'https://www.sec.gov/Archives/edgar/data/6281/000000628125000153/adi-20251101.htm',
    published: '2025-11-25',
    evidence: 'P1-self',
    quote: 'We currently source more than half of our wafer requirements annually from third-party wafer foundries, including Taiwan Semiconductor Manufacturing Company (TSMC) and others.',
    note: 'TSMC is the only foundry named; the rest are "and others", so no further edge can be drawn from this sentence.',
  });
  edge('tsmc', 'adi', 'Wafer foundry', 'adi-10k-fy2025', 2025);

  source('mchp-10k-fy2026', {
    publisher: 'Microchip Technology Incorporated',
    title: 'Form 10-K, fiscal year ended March 31, 2026 — supply-chain risk factor',
    url: 'https://www.sec.gov/Archives/edgar/data/827054/000082705426000016/mchp-20260331.htm',
    published: '2026-05-21',
    evidence: 'P1-self',
    quote: 'Some of our products are manufactured at SMIC, and some of our suppliers buy products manufactured at YMTC.',
    note: 'The first clause names a pair and supports an edge. The second does not: it discloses an indirect dependence on YMTC without naming which supplier, so no YMTC edge is drawn. It is one of the clearest published statements that the graph’s second tier is partly unobservable.',
  });
  edge('smic', 'microchip', 'Wafer manufacturing', 'mchp-10k-fy2026', 2026);

  source('nxpi-10k-2025', {
    publisher: 'NXP Semiconductors N.V.',
    title: 'Form 10-K, fiscal year ended December 31, 2025 — Manufacturing and Customers',
    url: 'https://www.sec.gov/Archives/edgar/data/1413447/000141344726000008/nxpi-20251231.htm',
    published: '2026-02-19',
    evidence: 'P1-self',
    quote: 'Our SSMC wafer fab facility, which produces 8 inch wafers, is jointly owned by TSMC and ourselves. ESMC is 70% owned by TSMC, with Bosch, Infineon, and NXP each owning 10%. NXP is entitled to 10% of the fab facility capacity. VSMC is 60% owned by Vanguard International Semiconductor Corporation and 40% owned by NXP. NXP is entitled to 40% of the fab facility capacity.',
    note: 'Joint-venture capacity entitlements, stated with percentages. Bosch and Infineon are named as ESMC co-owners, but the filing states a capacity entitlement only for NXP, so no capacity edge is drawn for them.',
  });
  edge('tsmc', 'nxp', 'Joint-venture wafer capacity (SSMC, ESMC)', 'nxpi-10k-2025', 2025,
    'A capacity entitlement through jointly owned fabs, not a merchant foundry contract. ESMC in Dresden was targeting initial production in 2028 at the time of filing.');
  edge('vis', 'nxp', 'Joint-venture wafer capacity (VSMC)', 'nxpi-10k-2025', 2025,
    'NXP is entitled to 40% of VSMC capacity. VSMC in Singapore was targeting initial production in 2027 at the time of filing.');

  source('nxpi-10k-2025-customers', {
    publisher: 'NXP Semiconductors N.V.',
    title: 'Form 10-K, fiscal year ended December 31, 2025 — Customers',
    url: 'https://www.sec.gov/Archives/edgar/data/1413447/000141344726000008/nxpi-20251231.htm',
    published: '2026-02-19',
    evidence: 'P1-supplier',
    quote: 'Our 10 largest end customers, some of whom are supplied by distributors, in alphabetical order, are Apple, Aptiv, Aumovio, Bosch, Denso, Harman Auto, Hyundai, LGE Automotive, Samsung and Visteon.',
    note: 'End customers, some reached through distributors, so an edge here is a named commercial relationship rather than proof of a direct purchase order.',
  });
  for (const c of ['apple', 'aptiv-plc', 'aumovio-se', 'bosch', 'denso', 'harman-international',
    'hyundai-motor-company', 'lg-electronics-automotive', 'samsung', 'visteon-corp']) {
    edge('nxp', c, 'Named among the ten largest end customers', 'nxpi-10k-2025-customers', 2025,
      'Some of the ten are supplied through distributors rather than directly.');
  }

  source('stm-20f-2025', {
    publisher: 'STMicroelectronics N.V.',
    title: 'Form 20-F, fiscal year ended December 31, 2025 — Customers',
    url: 'https://www.sec.gov/Archives/edgar/data/932787/000093278726000009/stm-20251231.htm',
    published: '2026-02-26',
    evidence: 'P1-supplier',
    quote: 'Our major customers include (in alphabetical order) Apple, Bosch, Continental, Denso, HP, Mobileye, Samsung, SpaceX, Tesla and Vitesco.',
    note: 'The same filing states that Apple, the largest customer, accounted for 17.7% of total revenues in 2025.',
  });
  for (const c of ['apple', 'bosch', 'continental-ag', 'denso', 'hp', 'mobileye-global-inc',
    'samsung', 'space-exploration-technologies-corp', 'tesla', 'vitesco-technologies']) {
    edge('st', c, 'Named among major customers', 'stm-20f-2025', 2025);
  }
  data.edges.find((e) => e.supplier === idOf('st') && e.customer === idOf('apple'))
    .details.push('Named as the largest customer, at 17.7% of total revenues in 2025.');

  source('himx-20f-2025', {
    publisher: 'Himax Technologies, Inc.',
    title: 'Form 20-F, fiscal year ended December 31, 2025 — manufacturing and supply',
    url: 'https://www.sec.gov/Archives/edgar/data/1342338/000110465926035507/himx-20251231x20f.htm',
    published: '2026-03-27',
    evidence: 'P1-self',
    quote: 'We have obtained our foundry services from TSMC, UMC, Vanguard, Macronix, Globalfoundries Singapore, PSMC, Nexchip and SKHYSI in the past few years.',
    note: 'Display-driver silicon needs high-voltage CMOS, which few foundries offer, so the list is unusually explicit. "In the past few years" is the filing’s own hedge: it does not establish which of them is supplying today.',
  });
  for (const s of ['tsmc', 'umc', 'vis', 'macronix-international-co-ltd', 'gf',
    'powerchip-semiconductor-manufacturing-corp', 'nexchip', 'sk-hynix-system-ic']) {
    edge(s, 'himax-technologies-inc', 'High-voltage CMOS wafer foundry for display drivers', 'himx-20f-2025', 2025,
      'Named among foundries used "in the past few years"; current supply is not established by the filing.');
  }
  edge('chipbond-technology-corp', 'himax-technologies-inc', 'TAB and COG assembly and test', 'himx-20f-2025', 2025);
  edge('ardentec-corp', 'himax-technologies-inc', 'Wafer and final test', 'himx-20f-2025', 2025);

  source('aosl-10k-fy2026', {
    publisher: 'Alpha & Omega Semiconductor Limited',
    title: 'Form 10-K, fiscal year ended June 30, 2026 — Customers',
    url: 'https://www.sec.gov/Archives/edgar/data/1387467/000162828026059261/aosl-20260630.htm',
    published: '2026-08-27',
    evidence: 'P1-supplier',
    quote: 'Our ODM customers include Compal Electronics, Inc., Foxconn, Quanta Computer Incorporated, Wistron Corporation and Delta Electronics.',
  });
  for (const c of ['compal-electronics-inc', 'foxconn', 'quanta', 'wistron', 'delta-electronics-inc']) {
    edge('alpha-and-omega-semiconductor-ltd', c, 'Power semiconductors and power-management ICs', 'aosl-10k-fy2026', 2026);
  }

  source('swks-10k-fy2026', {
    publisher: 'Skyworks Solutions, Inc.',
    title: 'Form 10-K, fiscal year ended October 2, 2026 — customer concentration',
    url: 'https://www.sec.gov/Archives/edgar/data/4127/000000412726000055/swks-20261002.htm',
    published: '2026-11-10',
    evidence: 'P1-supplier',
    quote: 'During fiscal 2026, fiscal 2025, and fiscal 2024, Apple, through sales to multiple distributors and contract manufacturers for multiple applications including smartphones, tablets, desktop and notebook computers, watches, and other devices, in the aggregate accounted for 61 %, 67 %, and 69 % of the Company’s net revenue, respectively.',
  });
  edge('skyworks-solutions-inc', 'apple', 'Radio-frequency front-end components', 'swks-10k-fy2026', 2026,
    'Reaches Apple through distributors and contract manufacturers rather than as a single direct account.');

  /* ------------------------------------------------------------------ *
   * SUPPLIER FILINGS — a supplier disclosing concentrated revenue, and
   * so naming its customer. This is how the equipment makers acquire
   * documented suppliers: their own filings name nobody, but the firms
   * that sell into them must disclose who they depend on.
   * ------------------------------------------------------------------ */

  source('uctt-10k-2025', {
    publisher: 'Ultra Clean Holdings, Inc.',
    title: 'Form 10-K, fiscal year ended December 26, 2025 — customer concentration',
    url: 'https://www.sec.gov/Archives/edgar/data/1275014/000162828026010744/uctt-20251226.htm',
    published: '2026-02-23',
    evidence: 'P1-supplier',
    quote: 'Our two largest revenue customers in fiscal years 2025, 2024 and 2023 were Applied Materials, Inc. and Lam Research Corporation, each of which accounted for more than 10% of our total revenues in those three years.',
    note: 'The concentration table gives Lam 37.0% and Applied 21.7% of revenue in fiscal 2025. A separate note names Applied Materials, Lam Research and ASML Holding NV as the three customers each above 10% of gross accounts receivable.',
  });
  edge('ultra-clean-holdings-inc', 'amat', 'Gas-delivery and fluid subsystems for wafer-fab equipment', 'uctt-10k-2025', 2025,
    'Applied Materials was 21.7% of Ultra Clean revenue in fiscal 2025.');
  edge('ultra-clean-holdings-inc', 'lam', 'Gas-delivery and fluid subsystems for wafer-fab equipment', 'uctt-10k-2025', 2025,
    'Lam Research was 37.0% of Ultra Clean revenue in fiscal 2025.');
  edge('ultra-clean-holdings-inc', 'asml', 'Subsystems and components', 'uctt-10k-2025', 2025,
    'Named among the customers above 10% of gross accounts receivable, which is a balance-sheet concentration rather than a revenue share.');

  source('ichr-10k-2025', {
    publisher: 'Ichor Holdings, Ltd.',
    title: 'Form 10-K, fiscal year ended December 26, 2025 — Customers',
    url: 'https://www.sec.gov/Archives/edgar/data/1652535/000165253526000012/ichr-20251226.htm',
    published: '2026-02-20',
    evidence: 'P1-supplier',
    quote: 'We have long standing relationships with top tier OEM customers, including Lam Research, Applied Materials, and ASML which were our largest customers by sales in 2025.',
    note: 'A second disclosure in the same filing puts Lam Research and Applied Materials together at 76% of total sales in 2025.',
  });
  for (const c of ['lam', 'amat', 'asml']) {
    edge('ichor-holdings-ltd', c, 'Fluid-delivery and gas-delivery subsystems', 'ichr-10k-2025', 2025);
  }

  source('form-10k-2025', {
    publisher: 'FormFactor, Inc.',
    title: 'Form 10-K, fiscal year ended December 27, 2025 — customer concentration',
    url: 'https://www.sec.gov/Archives/edgar/data/1039399/000103939926000009/form-20251227.htm',
    published: '2026-02-20',
    evidence: 'P1-supplier',
    quote: 'The following customers represented 10% or more of our revenues: SK hynix Inc. 22.9%, Intel Corporation 14.6% [fiscal 2024], 17.1% [fiscal 2023].',
    note: 'Quarterly tables in the same filing additionally put Taiwan Semiconductor Manufacturing Company Ltd. at 10.4% and Samsung Electronics Co., Ltd. at 12.4% of revenue in single quarters.',
  });
  edge('formfactor-inc', 'skhynix', 'Probe cards and test systems', 'form-10k-2025', 2025,
    'SK hynix was 22.9% of FormFactor revenue in fiscal 2025.');
  edge('formfactor-inc', 'intel', 'Probe cards and test systems', 'form-10k-2025', 2024,
    'Above 10% of revenue in fiscal 2024 and 2023; below the disclosure threshold in fiscal 2025.');
  edge('formfactor-inc', 'tsmc', 'Probe cards and test systems', 'form-10k-2025', 2025,
    'Crossed 10% of revenue in a single quarter rather than for the full year.');
  edge('formfactor-inc', 'samsung', 'Probe cards and test systems', 'form-10k-2025', 2024,
    'Crossed 10% of revenue in a single quarter rather than for the full year.');

  source('klac-10k-fy2026', {
    publisher: 'KLA Corporation',
    title: 'Form 10-K, fiscal year ended June 30, 2026 — customer concentration',
    url: 'https://www.sec.gov/Archives/edgar/data/319201/000031920126000027/klac-20260630.htm',
    published: '2026-08-06',
    evidence: 'P1-supplier',
    quote: 'For the fiscal years ended June 30, 2026, 2025 and 2024, the following customers each accounted for more than 10% of total revenues, primarily in the Semiconductor Process Control segment: Taiwan Semiconductor Manufacturing Company Limited.',
    note: 'TSMC is the only customer disclosed above the threshold in all three years.',
  });
  edge('kla', 'tsmc', 'Process control and inspection systems', 'klac-10k-fy2026', 2026);

  source('entg-10k-2025', {
    publisher: 'Entegris, Inc.',
    title: 'Form 10-K, fiscal year ended December 31, 2025 — top customers',
    url: 'https://www.sec.gov/Archives/edgar/data/1101302/000110130226000012/entg-20251231.htm',
    published: '2026-02-11',
    evidence: 'P1-supplier',
    quote: 'Percentage of net sales to top customers: Taiwan Semiconductor Manufacturing Company (TSMC) 16% [2025], 16% [2024], 11% [2023].',
    note: 'TSMC is the only customer Entegris names; the remaining top ten are disclosed as a group.',
  });
  edge('entegris', 'tsmc', 'Filtration, materials handling and advanced materials', 'entg-10k-2025', 2025,
    'TSMC was 16% of Entegris net sales in 2025. This supersedes nothing: the older Entegris award records remain separate, dated evidence.');

  source('onto-10k-2025', {
    publisher: 'Onto Innovation Inc.',
    title: 'Form 10-K, fiscal year ended January 3, 2026 — geographic concentration risk factor',
    url: 'https://www.sec.gov/Archives/edgar/data/704532/000119312526066937/onto-20260103.htm',
    published: '2026-02-24',
    evidence: 'P1-supplier',
    quote: 'we derive substantial revenue from sales to semiconductor device foundries in Taiwan such as Taiwan Semiconductor Manufacturing Company Ltd., from memory chip manufacturers in South Korea such as Samsung Electronics Co., Ltd., and from semiconductor device manufacturers in Japan such as Toshiba Corporation.',
    note: 'Named as examples inside a geographic risk factor, with no revenue share attached to either name.',
  });
  edge('onto', 'tsmc', 'Metrology and inspection systems', 'onto-10k-2025', 2025);
  edge('onto', 'samsung', 'Metrology and inspection systems', 'onto-10k-2025', 2025);

  source('simo-20f-2025', {
    publisher: 'Silicon Motion Technology Corporation',
    title: 'Form 20-F, fiscal year ended December 31, 2025 — customer concentration',
    url: 'https://www.sec.gov/Archives/edgar/data/1329394/000119312526197184/d17718d20f.htm',
    published: '2026-04-30',
    evidence: 'P1-supplier',
    quote: 'Our customers constituting more than 10% of our net revenue were (i) Micron, SK Hynix and AFASTOR in 2023, (ii) Micron, Kioxia, PHISEMI and AFASTOR in 2024 and (iii) PHISEMI, Kioxia, AFASTOR, and Micron in 2025.',
  });
  edge('silicon-motion-technology-corp', 'micron', 'NAND flash controller chips', 'simo-20f-2025', 2025);
  edge('silicon-motion-technology-corp', 'kioxia', 'NAND flash controller chips', 'simo-20f-2025', 2025);
  edge('silicon-motion-technology-corp', 'skhynix', 'NAND flash controller chips', 'simo-20f-2025', 2023,
    'Above 10% of revenue in 2023; not among the customers named for 2024 or 2025.');

  source('imos-20f-2025', {
    publisher: 'ChipMOS TECHNOLOGIES INC.',
    title: 'Form 20-F, fiscal year ended December 31, 2025 — Customers',
    url: 'https://www.sec.gov/Archives/edgar/data/1123134/000119312526153743/imos-20251231.htm',
    published: '2026-04-14',
    evidence: 'P1-supplier',
    quote: 'Our top 15 customers in terms of revenue in 2025 were (in alphabetical order): Asahi Kasei Microdevices Corporation, Chipone Technology (Beijing) Co., Ltd., Elite Semiconductor Microelectronics Technology Inc., GigaDevice Semiconductor (HK) Limited, Himax Technologies, Inc., ILI Technology Corporation, Integrated Circuit Solution Inc., Macronix International Co., Ltd., MediaTek Inc., Micron Technology, Inc., Nanya Technology Corporation, Novatek Microelectronics Corp., Phison Electronics Corp., Raydium Semiconductor Corporation, Winbond Electronics Corporation.',
    note: 'An alphabetical list, so it carries no ordering. The filing gives the top three customers as roughly 25%, 13% and 9% of revenue without saying which they are.',
  });
  for (const c of ['asahi-kasei-microdevices-corp', 'chipone-technology-beijing',
    'elite-semiconductor-microelectronics-technology', 'gigadevice-semiconductor', 'himax-technologies-inc',
    'ili-technology-corp', 'integrated-circuit-solution-inc', 'macronix-international-co-ltd', 'mediatek',
    'micron', 'nanya', 'novatek-microelectronics-corp', 'phison-electronics-corp', 'raydium-semiconductor-corp',
    'winbond']) {
    edge('chipmos-technologies-inc', c, 'Assembly and test', 'imos-20f-2025', 2025,
      'Named among the top 15 customers by revenue, listed alphabetically.');
  }

  source('cohr-10k-fy2026', {
    publisher: 'Coherent Corp.',
    title: 'Form 10-K, fiscal year ended June 30, 2026 — fiscal year highlights',
    url: 'https://www.sec.gov/Archives/edgar/data/820318/000082031826000020/iivi-20260630.htm',
    published: '2026-08-14',
    evidence: 'P1-supplier',
    quote: 'entered into a strategic multi-year supply agreement with NVIDIA for advanced lasers and optical networking products supporting next-generation AI infrastructure',
  });
  edge('coherent-corp', 'nvidia', 'Lasers and optical networking products', 'cohr-10k-fy2026', 2026);

  /* ------------------------------------------------------------------ *
   * BUYERS NAMING THEIR OWN UPSTREAM — foundries, OSATs and system
   * firms disclosing what they buy.
   * ------------------------------------------------------------------ */

  source('umc-20f-2025', {
    publisher: 'United Microelectronics Corporation',
    title: 'Form 20-F, fiscal year ended December 31, 2025 — raw materials and customers',
    url: 'https://www.sec.gov/Archives/edgar/data/1033767/000119312526193757/d91630d20f.htm',
    published: '2026-04-30',
    evidence: 'P1-self',
    quote: 'For example, we purchased a majority of our silicon wafers from Shin-Etsu Handotai Corporation, or Shin-Etsu, GlobalWafers, Sumco Group (including Sumco Corporation and Formosa Sumco Technology Corporation) and Soitec.',
    note: 'The same filing names Texas Instruments and Intel among primary customers, with MediaTek, Realtek and Novatek among fabless customers, and discloses a long-term agreement with Intel and a silicon-photonics process licence taken from imec.',
  });
  edge('shin-etsu-handotai-co-ltd', 'umc', 'Silicon wafers', 'umc-20f-2025', 2025);
  edge('globalwafers', 'umc', 'Silicon wafers', 'umc-20f-2025', 2025);
  edge('sumco', 'umc', 'Silicon wafers', 'umc-20f-2025', 2025);
  edge('soitec-sa', 'umc', 'Engineered substrates', 'umc-20f-2025', 2025);
  for (const [c, kind] of [['ti', 'integrated device manufacturer'], ['intel', 'integrated device manufacturer'],
    ['mediatek', 'fabless design company'], ['realtek-semiconductor-corp', 'fabless design company'],
    ['novatek-microelectronics-corp', 'fabless design company']]) {
    edge('umc', c, 'Wafer foundry services', 'umc-20f-2025', 2025, `Named among primary customers as a ${kind}.`);
  }
  data.edges.find((e) => e.supplier === idOf('umc') && e.customer === idOf('intel'))
    .details.push('The filing separately describes a collaboration providing for a long-term agreement between UMC and Intel.');
  edge('imec', 'umc', 'iSiPP300 silicon photonics process technology licence', 'umc-20f-2025', 2025,
    'A technology licence rather than a shipment of goods: imec supplies the process, not the silicon.');

  source('asx-20f-2025', {
    publisher: 'ASE Technology Holding Co., Ltd.',
    title: 'Form 20-F, fiscal year ended December 31, 2025 — equipment and raw materials',
    url: 'https://www.sec.gov/Archives/edgar/data/1122411/000119312526135585/d50802d20f.htm',
    published: '2026-04-01',
    evidence: 'P1-self',
    quote: 'We purchase our packaging equipment from major international manufacturers, including All Ring Tech Co., Ltd., Marketech lnternational Corp., Grand Process Technology Corporation, Tokyo Electron Limited, and Lam Research Corporation. We purchase testers from major international manufacturers, primarily Teradyne, Inc., Tokyo Electron Limited, and Advantest Corporation.',
    note: 'The same filing names Kinsus, Nan Ya Printed Circuit Board and Unimicron as the limited set of IC substrate suppliers. Nan Ya Printed Circuit Board is a different company from Nanya Technology, the memory maker tracked separately here.',
  });
  for (const s of ['all-ring-tech-co-ltd', 'marketech-international-corp', 'grand-process-technology-corp', 'tel', 'lam']) {
    edge(s, 'ase', 'Packaging and assembly equipment', 'asx-20f-2025', 2025);
  }
  for (const s of ['teradyne-inc', 'tel', 'advantest-corporation']) {
    edge(s, 'ase', 'Test equipment', 'asx-20f-2025', 2025);
  }
  for (const s of ['kinsus-interconnect-technology-corp', 'nan-ya-printed-circuit-board-corp', 'unimicron']) {
    edge(s, 'ase', 'IC packaging substrates', 'asx-20f-2025', 2025,
      'Named among a limited set of substrate suppliers in a disclosure about shortage risk.');
  }

  source('hpq-10k-fy2025', {
    publisher: 'HP Inc.',
    title: 'Form 10-K, fiscal year ended October 31, 2025 — supplier risk factor',
    url: 'https://www.sec.gov/Archives/edgar/data/47217/000004721725000071/hpq-20251031.htm',
    published: '2025-12-10',
    evidence: 'P1-self',
    quote: 'For example, we rely on Canon for certain laser printer engines and laser toner cartridges and certain key suppliers for application specific integrated circuits ("ASICs").',
    note: 'Canon is the only supplier HP names. The ASIC suppliers in the same sentence are left unnamed, so no edge follows for them.',
  });
  edge('canon', 'hp', 'Laser printer engines and laser toner cartridges', 'hpq-10k-fy2025', 2025);

  source('asml-20f-2025', {
    publisher: 'ASML Holding N.V.',
    title: 'Form 20-F, fiscal year ended December 31, 2025 — supply-chain risk',
    url: 'https://www.sec.gov/Archives/edgar/data/937966/000162828026011378/asml-20251231.htm',
    published: '2026-02-25',
    evidence: 'P1-self',
    quote: 'The number of lithography systems we are able to produce is limited by the production capacity of one of our key suppliers, Carl Zeiss SMT, our sole supplier of lenses, mirrors, illuminators, collectors and other critical optical components (which we refer to as optics). We have an exclusive arrangement with Carl Zeiss SMT.',
    note: 'The most explicit single-supplier dependence disclosed anywhere in this dataset: ASML states both exclusivity and that its own output is capped by this supplier’s capacity. The same report describes the EXE:5200B projection optics as developed with Carl Zeiss SMT as strategic partner. ASML names no customers: it discloses only that its largest customer was 23.9% of net sales in 2025.',
  });
  edge('carl-zeiss-smt-gmbh', 'asml', 'Lenses, mirrors, illuminators, collectors and other critical optics', 'asml-20f-2025', 2025,
    'Disclosed as the sole supplier of optics under an exclusive arrangement, and as a cap on ASML’s own system output.');

  source('hpq-10k-fy2025-processors', {
    publisher: 'HP Inc.',
    title: 'Form 10-K, fiscal year ended October 31, 2025 — single-source suppliers',
    url: 'https://www.sec.gov/Archives/edgar/data/47217/000004721725000071/hpq-20251031.htm',
    published: '2025-12-10',
    evidence: 'P1-self',
    quote: 'We also rely on Intel, AMD, and NVIDIA, or other suppliers to provide us with a sufficient supply of processors for the majority of our PCs and workstations.',
    note: 'Item 1 of the same filing adds that "Our platforms incorporate processors from Intel, and AMD, including integrated AI acceleration, as well as NVIDIA GPUs for advanced graphics and compute workloads."',
  });
  for (const s of ['intel', 'amd', 'nvidia']) {
    edge(s, 'hp', 'Processors and GPUs for PCs and workstations', 'hpq-10k-fy2025-processors', 2025);
  }

  source('smci-10k-fy2026', {
    publisher: 'Super Micro Computer, Inc.',
    title: 'Form 10-K, fiscal year ended June 30, 2026 — Research and Development',
    url: 'https://www.sec.gov/Archives/edgar/data/1375365/000137536526000022/smci-20260630.htm',
    published: '2026-08-31',
    evidence: 'P1-self',
    quote: 'We work closely with NVIDIA, Intel and AMD, among others, to develop products that are compatible with the latest generation of industry-standard technologies under development.',
    note: 'Describes development collaboration with the processor vendors whose silicon the systems are built around. It is a named working relationship, not a disclosed purchase volume.',
  });
  for (const s of ['nvidia', 'intel', 'amd']) {
    edge(s, 'supermicro', 'Processors and accelerators for system platforms', 'smci-10k-fy2026', 2026,
      'Disclosed as a development collaboration with a processor vendor rather than as a procurement contract.');
  }

  /* ------------------------------------------------------------------ *
   * RELATIONSHIPS THAT ARE NOT PURCHASES, AND ARE RECORDED AS SUCH.
   *
   * Three relationships below are real, documented and named by both
   * parties, but none of the documents describes a sale. A design-tool
   * certification programme, a co-development of EUV optics and lasers,
   * and a transfer of process technology to a new foundry are each a
   * genuine dependency in this chain, and each would be misrepresented
   * by an edge that implied an invoice. They carry the relationship in
   * the product string and the qualification in the detail, so a reader
   * cannot mistake one for the other.
   * ------------------------------------------------------------------ */

  firm('trumpf-se-co-kg', 'TRUMPF SE + Co. KG', 'de', 'optics_laser',
    'Developed the pulsed CO2 laser amplifier that generates the light for EUV lithography.');

  source('tsmc-eda-alliance', {
    publisher: 'TSMC',
    title: 'TSMC EDA Alliance — Open Innovation Platform',
    kind: 'Company page',
    url: 'https://www.tsmc.com/english/dedicatedFoundry/oip/eda_alliance',
    published: '2026-10-01',
    evidence: 'P1-buyer',
    quote: 'To better serve our customers with a robust design ecosystem and enable customers’ design with TSMC latest technology, TSMC has been conducting full-line EDA Tool Certification Program with major partners including Cadence, Siemens EDA and Synopsys.',
    note: 'Read for this dataset on 2026-11-23. The partner list is dated 09/23/2026 and the certification-status tables 10/01/2026. IMPORTANT: the page nowhere describes TSMC as a purchaser of these tools, and uses no purchase, supply or licensing language. It is a certification and ecosystem programme, and is recorded here as exactly that. Eight further EDA firms are listed as Alliance partners without appearing in the certification tables.',
  });
  for (const s of ['cadence', 'siemens_eda', 'synopsys']) {
    edge(s, 'tsmc', 'EDA tools certified under the TSMC EDA Tool Certification Program', 'tsmc-eda-alliance', 2026,
      'A certification and ecosystem relationship in TSMC’s own words, not a disclosed purchase. The tools are certified against TSMC processes so that TSMC’s design customers can use them; the page does not say TSMC buys them.');
  }

  source('trumpf-euv-lithography', {
    publisher: 'TRUMPF SE + Co. KG',
    title: 'Generation of EUV radiation using a CO2 high-power laser system and tin / EUV Drive Laser',
    kind: 'Company page',
    url: 'https://www.trumpf.com/en_US/applications/euv-lithography/',
    published: '',
    evidence: 'P1-supplier',
    quote: 'ASML, Zeiss, and TRUMPF joined forces to develop a technology to produce extreme ultraviolet (EUV) light. Over their years of close collaboration, TRUMPF, ASML, and ZEISS have brought EUV technology to industrial maturity. The laser pulse for the plasma radiation is provided by a pulsable CO2 laser system developed by TRUMPF.',
    note: 'Read for this dataset on 2026-11-23; the pages carry no publication date, only a 2026 copyright. TRUMPF describes joint development and "close cooperation with ASML" and never says it sells or supplies the laser to ASML. ASML’s own 20-F names Carl Zeiss SMT as a key supplier and does not name TRUMPF at all, so this relationship rests on TRUMPF’s account alone.',
  });
  edge('trumpf-se-co-kg', 'asml', 'CO2 drive laser for EUV light generation — joint development', 'trumpf-euv-lithography', 2026,
    'Characterised by TRUMPF as joint development and close cooperation, not as a supply contract. ASML’s own annual report does not name TRUMPF among its suppliers.');

  source('ibm-rapidus-2024', {
    publisher: 'IBM',
    title: 'Rapidus and IBM Expand Collaboration to Chiplet Packaging Technology for 2nm-Generation Semiconductors',
    kind: 'Press release',
    url: 'https://newsroom.ibm.com/2024-06-03-Rapidus-and-IBM-Expand-Collaboration-to-Chiplet-Packaging-Technology-for-2nm-Generation-Semiconductors',
    published: '2024-06-03',
    evidence: 'P1-supplier',
    quote: 'Through this agreement, Rapidus will receive packaging technology from IBM for high-performance semiconductors. The agreement builds on an existing agreement with IBM for the joint development of 2nm node technology.',
    note: 'The 2022 release (newsroom.ibm.com/2022-12-12-IBM-and-Rapidus-Form-Strategic-Partnership...) established the earlier 2nm joint development and states that Rapidus engineers work alongside IBM researchers at the Albany NanoTech Complex. Both releases call the arrangement a joint development partnership. Neither states a licence fee, royalty or delivery of goods.',
  });
  edge('ibm_res', 'rapidus', '2nm node process technology and chiplet packaging technology', 'ibm-rapidus-2024', 2024,
    'A joint development partnership in both parties’ words. The 2024 release’s "Rapidus will receive packaging technology from IBM" is the clearest statement that technology moves from IBM to Rapidus; no goods, price or royalty is disclosed.');

  source('asx-20f-2025-tsmc', {
    publisher: 'ASE Technology Holding Co., Ltd.',
    title: 'Form 20-F, fiscal year ended December 31, 2025 — strategic alliance',
    url: 'https://www.sec.gov/Archives/edgar/data/1122411/000119312526135585/d50802d20f.htm',
    published: '2026-04-01',
    evidence: 'P1-self',
    quote: 'Through our strategic alliance with and close geographic proximity to TSMC, we are able to offer our customers a total semiconductor manufacturing solution that includes access to foundry services in addition to our packaging, testing, and direct shipment services.',
    note: 'An alliance giving ASE customers access to foundry services, described by ASE itself. It is not a disclosure that ASE buys wafers from TSMC.',
  });
  edge('tsmc', 'ase', 'Foundry services reached through a strategic alliance', 'asx-20f-2025-tsmc', 2025,
    'ASE describes an alliance that gives its customers access to TSMC foundry services alongside ASE packaging and test. Not a disclosed purchase of wafers by ASE.');

  /* ------------------------------------------------------------------ *
   * THE SYSTEM-BUILDER STEP.
   *
   * Without this step the graph had a structural hole rather than an
   * evidentiary one. Every chain ran upstream into TSMC or Intel and
   * then stopped, because the firms that turn silicon into machines —
   * the ODMs — were recorded only as suppliers to Apple and never as
   * buyers of anybody's chips. That truncated the downstream side of
   * every upstream firm at two steps.
   * ------------------------------------------------------------------ */

  firm('qct-quanta-cloud-technology', 'QCT', 'tw', 'assembly',
    'Server systems builder, named as "QCT" in NVIDIA’s Blackwell release. The dataset does not assert a corporate link to Quanta Computer, which is tracked separately, because the release does not state one.');
  firm('wiwynn-corporation', 'Wiwynn', 'tw', 'assembly', 'Data-centre server and rack systems builder.');
  firm('inventec-corporation', 'Inventec', 'tw', 'assembly', 'Notebook and server ODM.');
  firm('zt-systems', 'ZT Systems', 'us', 'assembly', 'Data-centre server and rack integration.');
  firm('asus-asustek-computer-inc', 'ASUS', 'tw', 'assembly', 'PC and server systems builder.');
  firm('gigabyte-technology-co-ltd', 'GIGABYTE', 'tw', 'assembly', 'Motherboards and server systems.');
  firm('dell-technologies-inc', 'Dell Technologies', 'us', 'brand', 'PC, server and storage systems vendor.');
  firm('hewlett-packard-enterprise-company', 'Hewlett Packard Enterprise', 'us', 'brand',
    'Enterprise server and networking vendor. A different company from HP Inc., which is tracked separately.');
  firm('cisco-systems-inc', 'Cisco', 'us', 'brand', 'Networking and data-centre systems vendor.');
  firm('aivres-systems', 'Aivres', 'us', 'assembly', 'Data-centre server systems builder.');
  firm('asrock-rack-inc', 'ASRock Rack', 'tw', 'assembly', 'Server motherboards and systems.');
  firm('eviden-atos', 'Eviden', 'fr', 'assembly', 'High-performance computing systems integrator.');

  source('nvidia-blackwell-2024-systems', {
    publisher: 'NVIDIA',
    title: 'NVIDIA Blackwell Platform Arrives to Power a New Era of Computing — Global Network of Blackwell Partners',
    kind: 'Press release',
    url: 'https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing/',
    published: '2024-03-18',
    evidence: 'P1-supplier',
    quote: 'Cisco, Dell, Hewlett Packard Enterprise, Lenovo and Supermicro are expected to deliver a wide range of servers based on Blackwell products, as are Aivres, ASRock Rack, ASUS, Eviden, Foxconn, GIGABYTE, Inventec, Pegatron, QCT, Wistron, Wiwynn and ZT Systems.',
    note: 'Read for this dataset on 2026-11-23. Every verb on this page is forward-looking: "are expected to deliver", "will be among the first", "expected to adopt". It establishes an announced relationship in March 2024, not a shipment. Two name cautions: the release prints "QCT", not "Quanta", and names Hewlett Packard Enterprise, which is a different company from HP Inc.',
  });
  for (const c of ['foxconn', 'wistron', 'pegatron-corporation', 'qct-quanta-cloud-technology', 'wiwynn-corporation',
    'inventec-corporation', 'zt-systems', 'asus-asustek-computer-inc', 'gigabyte-technology-co-ltd',
    'dell-technologies-inc', 'hewlett-packard-enterprise-company', 'cisco-systems-inc', 'aivres-systems',
    'asrock-rack-inc', 'eviden-atos', 'lenovo', 'supermicro']) {
    edge('nvidia', c, 'Blackwell platform products for server systems', 'nvidia-blackwell-2024-systems', 2024,
      'Announced in March 2024 as "expected to deliver" servers based on Blackwell. Delivery and current status are not established by the release.');
  }

  /* ------------------------------------------------------------------ *
   * ANNOUNCED AGREEMENTS, read from the parties' own releases.
   * ------------------------------------------------------------------ */

  source('intel-tower-foundry-2023', {
    publisher: 'Intel Corporation',
    title: 'Intel Foundry Services and Tower Semiconductor Announce New US Foundry Agreement',
    kind: 'Press release',
    url: 'https://www.intc.com/news-events/press-releases/detail/1643/intel-foundry-services-and-tower-semiconductor-announce-new',
    published: '2023-09-05',
    evidence: 'P1-supplier',
    quote: 'Intel will provide foundry services and 300mm manufacturing capacity to help Tower serve its customers globally. Intel will manufacture Tower’s highly differentiated 65-nanometer power management BCD (bipolar-CMOS-DMOS) flows, among other flows, at Intel’s Fab 11X in Rio Rancho, New Mexico.',
    note: 'Read for this dataset on 2026-11-23. Direction is explicit: Intel manufactures and Tower buys — "Tower will utilize Intel’s advanced manufacturing facility in New Mexico." Every verb is future tense, with full process qualification "planned in 2024", so this records an announced agreement and not production in progress. The release separately discloses a Synopsys IP agreement on Intel 3 and Intel 18A, and Tower’s own boilerplate names a 300mm facility being established in Italy by STMicroelectronics.',
  });
  edge('intel', 'tower', '65nm power-management BCD and other process flows, with 300mm capacity at Fab 11X', 'intel-tower-foundry-2023', 2023,
    'An announced agreement as of September 2023, with qualification planned for 2024. Tower committed up to $300 million for equipment and received a corridor of over 600,000 photo layers per month.');
  edge('st', 'tower', '300mm manufacturing capacity shared at the facility ST is establishing in Italy', 'intel-tower-foundry-2023', 2023,
    'Stated in Tower’s own company boilerplate in this release, which describes Tower as sharing a 300mm facility being established in Italy by STMicroelectronics. No volume or commercial term is disclosed.');
  edge('synopsys', 'intel', 'Intellectual property portfolio developed for Intel 3 and Intel 18A', 'intel-tower-foundry-2023', 2023,
    'A separate agreement disclosed in the same release, to develop a portfolio of intellectual property on Intel 3 and Intel 18A.');

  source('airproducts-samsung-2026', {
    publisher: 'Air Products',
    title: 'Air Products to Expand Industrial Gas Supply for Samsung Electronics’ Next-Generation Semiconductor Fab in South Korea',
    kind: 'Press release',
    url: 'https://www.prnewswire.com/apac/news-releases/air-products-to-expand-industrial-gas-supply-for-samsung-electronics-next-generation-semiconductor-fab-in-south-korea-302758325.html',
    published: '2026-04-30',
    evidence: 'P1-supplier',
    quote: 'Air Products has been selected by Samsung to supply industrial gases for its new advanced semiconductor fab in Pyeongtaek, Gyeonggi Province, South Korea. Under the agreement, Air Products will build, own and operate multiple state-of-the-art production facilities to supply nitrogen, oxygen, argon, and hydrogen for Samsung’s new semiconductor fab.',
    note: 'Read for this dataset on 2026-11-23. A supply agreement rather than a collaboration: Samsung "selected" Air Products. The plants are expected to come onstream in phases from 2028 through 2030, so the gas is contracted and not yet flowing.',
  });
  edge('airproducts', 'samsung', 'Nitrogen, oxygen, argon and hydrogen for the Pyeongtaek fab', 'airproducts-samsung-2026', 2026,
    'Contracted in April 2026; the production facilities are expected to come onstream in phases from 2028 through 2030, so supply had not begun at the time of the announcement.');

  source('synopsys-tsmc-2025', {
    publisher: 'Synopsys, Inc.',
    title: 'Synopsys Collaborates with TSMC to Drive the Next Wave of AI and Multi-Die Innovation',
    kind: 'Press release',
    url: 'https://news.synopsys.com/2025-09-24-Synopsys-Collaborates-with-TSMC-to-Drive-the-Next-Wave-of-AI-and-Multi-Die-Innovation',
    published: '2025-09-24',
    evidence: 'P1-supplier',
    quote: 'Synopsys’ analog and digital flows, along with the enabled Synopsys.ai, are certified on TSMC N2P and A16™ processes using TSMC NanoFlex™ architecture. Synopsys IC Validator™ signoff physical verification solution is certified for TSMC A16™ process to support DRC and LVS checking.',
    note: 'Read for this dataset on 2026-11-23. Collaboration and certification language throughout; no purchase is described. Checked specifically for Ansys: the release names no Ansys product as certified for any TSMC process — "Ansys" appears in the body only inside the trademark notice — so no Ansys relationship is recorded from this document.',
  });
  edge('synopsys', 'tsmc', 'Certified analog and digital design flows and signoff verification for TSMC processes', 'synopsys-tsmc-2025', 2025,
    'Certification of design flows against TSMC processes, in Synopsys’ own words. Not a disclosed purchase of tools by TSMC.');

  /* Ansys has no edge here, and that is the correct outcome rather than
     an oversight. Its corporate position IS documented — Synopsys' 10-K
     records the acquisition closing on 17 July 2025 — but a parent
     company is not a supply relationship, and the Synopsys/TSMC release
     was checked specifically for Ansys products and names none as
     certified. The registry carries the fact; the graph does not invent
     an edge from it. */
  const ansys = Object.keys(data.companies).find((id) => data.companies[id].vaultId === 'ansys');
  if (ansys) {
    data.companies[ansys].role =
      'Simulation and analysis software. Acquired by Synopsys, which recorded the acquisition as closing on 17 July 2025 in its fiscal 2025 Form 10-K. No public document found for this dataset names an Ansys supply relationship with a tracked firm.';
  }

  data.edges.sort((a, b) => a.customer.localeCompare(b.customer) || a.supplier.localeCompare(b.supplier));

  /* Publish the coverage the dataset actually achieves, computed from
     the edges rather than asserted in prose, so the number in the
     interface cannot drift from the graph. "Levels" are counted in both
     directions from each tracked firm: a buyer's chain runs upstream, a
     materials supplier's runs downstream, and most firms have some of
     each. */
  const upAdj = {};
  const downAdj = {};
  for (const e of data.edges) {
    (upAdj[e.customer] ||= []).push(e.supplier);
    (downAdj[e.supplier] ||= []).push(e.customer);
  }
  const reach = (root) => {
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
    const u = walk(upAdj);
    const d = walk(downAdj);
    return [u[0] + d[0], u[1] + d[1], u[2] + d[2]];
  };

  const tracked = [...new Set(Object.values(data.companies).map((c) => c.vaultId).filter(Boolean))];
  const nodeOf = {};
  for (const [id, c] of Object.entries(data.companies)) if (c.vaultId && !nodeOf[c.vaultId]) nodeOf[c.vaultId] = id;
  const counts = [0, 0, 0];
  const unnamed = [];
  for (const v of tracked) {
    const r = reach(nodeOf[v]);
    for (let i = 0; i < 3; i += 1) if (r[i] > 0) counts[i] += 1;
    if (r[0] === 0) unnamed.push(v);
  }
  data.meta.documentedLevels = {
    tracked: tracked.length,
    level1: counts[0],
    level2: counts[1],
    level3: counts[2],
    noDocumentedCounterparty: unnamed.sort(),
    note: 'Levels are steps away from the firm in the documented graph, counted upstream and downstream together. A firm with no documented counterparty is one that no public document read for this dataset names in a supply relationship; see meta.limits for why that is a finding rather than a gap.',
  };

  return data;
}
