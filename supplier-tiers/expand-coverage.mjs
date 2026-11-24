/* Named counterparties checked on 2026-11-25. This pass supplements, rather
 * than replaces, the filing pass. Historical disclosures are not live supply
 * claims. Product adoption and certification are qualified on their edges. */
export function expandCoverage(data) {
  const idOf = ref => {
    if (data.companies[ref]) return ref;
    const id = Object.keys(data.companies).find(id => data.companies[id].vaultId === ref);
    if (!id) throw new Error(`Unknown coverage company: ${ref}`);
    return id;
  };
  const firm = (id, name, country, layer, role) => {
    if (data.companies[id]) throw new Error(`Duplicate coverage company: ${id}`);
    data.companies[id] = { name, country, layer, role };
  };
  const source = (id, publisher, title, url, published, evidence, note) => {
    if (data.sources[id]) throw new Error(`Duplicate coverage source: ${id}`);
    data.sources[id] = { publisher, title, url, published, evidence, note,
      kind: 'Company disclosure', seen: 'fetched', retrieved: '2026-11-25' };
  };
  const edge = (supplier, customer, product, sourceId, year, detail) => {
    const s = idOf(supplier), c = idOf(customer);
    if (s === c || !data.sources[sourceId]) throw new Error('Invalid coverage edge');
    let e = data.edges.find(e => e.supplier === s && e.customer === c);
    if (!e) data.edges.push(e = { supplier: s, customer: c, products: [], sources: [], years: [], details: [] });
    for (const [field, value] of [['products', product], ['sources', sourceId], ['years', year], ['details', detail]]) {
      if (value && !e[field].includes(value)) e[field].push(value);
    }
  };

  source('marvell-2026-q2-foundry', 'Marvell Technology', 'Form 10-Q, quarter ended August 1, 2026: manufacturing concentration',
    'https://investor.marvell.com/sec-filings/all-sec-filings/content/0001835632-26-000025/mrvl-20260801.htm', '2026-08-28', 'P1-buyer',
    'Risk factors identify TSMC as the sole foundry for advanced process-node wafers. This does not identify all mature-node or packaging suppliers.');
  edge('tsmc', 'marvell', 'Advanced process-node wafer fabrication', 'marvell-2026-q2-foundry', 2026, 'Named sole advanced-node foundry in the August 2026 quarterly filing; not exclusivity for every Marvell product.');

  source('ibiden-2026-customers', 'IBIDEN', 'Consolidated financial statements, year ended March 31, 2026, printed page 45',
    'https://www.ibiden.com/ir/items/FinancialReview2026.pdf#page=53', '2026', 'P1-supplier',
    'Major-customer table names NVIDIA and Intel for FY2026; FY2025 also names AMD. The disclosure is customer-level, not a particular chip bill of materials.');
  for (const customer of ['nvidia', 'intel']) edge('ibiden', customer, 'Electronic components and IC package substrates', 'ibiden-2026-customers', 2026, 'Named major customer in FY2026 financial statements; no product-specific allocation disclosed.');
  edge('ibiden', 'amd', 'Electronic components and IC package substrates', 'ibiden-2026-customers', 2025, 'Named in the comparative FY2025 customer table; this is historical evidence, not confirmation of FY2026 volume.');

  source('shinko-intel-2025', 'Intel', '2025 EPIC supplier award recipients',
    'https://www.intel.com/content/www/us/en/newsroom/news/corporate/intel-announces-2025-epic-supplier-award-recipients.html', '2025-04-08', 'P1-buyer',
    'Intel names Shinko for substrate technology, cost and scale. An award documents a relationship, not its quantity or continuation.');
  edge('shinko', 'intel', 'Package substrates', 'shinko-intel-2025', 2025, 'Intel supplier recognition for substrate technology, cost and scale.');

  source('broadcom-pcn-284825', 'Broadcom', 'Product Change Notice PCN-284825: final-test site change',
    'https://www.mouser.com/PCN/Broadcom_Limited_PCN_284825_PCN_Letter.pdf', '2025-06-12', 'P1-buyer',
    'Broadcom-authored notice hosted by distributor Mouser adds Inari Malaysia and removes UTAC Singapore for the listed BCM89834/BCM89836 automotive Ethernet parts.');
  edge('inari', 'broadcom', 'Final testing of specified automotive Ethernet ICs', 'broadcom-pcn-284825', 2025, 'Qualified final-test site added in a product change notice; only the listed parts are covered.');
  edge('utac', 'broadcom', 'Historical final testing of specified automotive Ethernet ICs', 'broadcom-pcn-284825', 2025, 'The notice REMOVES UTAC-SG for the listed parts. Retained as historical evidence, not current supply.');

  source('qualcomm-cariad-2022', 'Qualcomm', 'CARIAD selects Qualcomm for Volkswagen automated driving',
    'https://www.qualcomm.com/news/releases/2022/05/cariad-selects-qualcomm-power-volkswagens-future-automated-driving', '2022-05-02', 'P1-supplier',
    'Volkswagen subsidiary CARIAD selected Snapdragon Ride SoCs for a future software platform. Selection is not proof of production deliveries.');
  edge('qualcomm', 'vw', 'Selected Snapdragon Ride automated-driving SoCs', 'qualcomm-cariad-2022', 2022, 'Customer is Volkswagen subsidiary CARIAD, represented at tracked group level. Announced selection for future vehicles; no shipment date inferred.');

  source('nvidia-alibaba-2017', 'NVIDIA', 'China cloud providers adopt NVIDIA Volta GPUs',
    'https://nvidianews.nvidia.com/news/china-s-top-cloud-providers-adopt-nvidia-volta-gpus-to-supercharge-next-gen-ai-services', '2017-09-25', 'P1-supplier',
    'NVIDIA identifies Alibaba Cloud among adopters incorporating Tesla V100 accelerators. Historical adoption, not present export eligibility or a direct purchase channel.');
  edge('nvidia', 'alibaba', 'Tesla V100 accelerators in cloud infrastructure', 'nvidia-alibaba-2017', 2017, 'Historical adoption by Alibaba Cloud. The announcement does not disclose the procurement intermediary or current shipments.');

  source('imec-asml-2026-delivery', 'imec', 'Arrival of ASML EXE:5200 High NA EUV system',
    'https://www.imec-int.com/en/press/imec-receives-worlds-most-advanced-high-na-euv-system', '2026-03-18', 'P1-buyer',
    'imec reports arrival and installation in Leuven; full qualification was anticipated for Q4 2026.');
  edge('asml', 'imec', 'EXE:5200 High NA EUV lithography system', 'imec-asml-2026-delivery', 2026, 'Delivered research equipment. Qualification anticipated for Q4 2026 in the March announcement; not independently confirmed here.');

  source('leti-amat-1998-order', 'Applied Materials', 'LETI selects DPS Centura silicon etch system',
    'https://ir.appliedmaterials.com/news-releases/news-release-details/leti-chooses-applied-materials-silicon-etch-dps-centura-sub-010', '1998', 'P1-supplier',
    'LETI selected a DPS Centura etch system with delivery planned for Q4 1998. This is historical equipment-selection evidence.');
  edge('amat', 'leti', 'DPS Centura silicon etch system', 'leti-amat-1998-order', 1998, 'Historical selection/order; announced delivery schedule is not evidence of current equipment use.');

  source('ansys-tsmc-a16-2025', 'Ansys', 'TSMC A16 certification and 3D-IC multiphysics design solutions',
    'https://ansys.synopsys.com/en-in/news-center/press-releases/4-23-25-ansys-tools-certified-for-tsmc-16a', '2025-04-23', 'P1-supplier',
    'RedHawk-SC, Totem and RedHawk-SC Electrothermal are certified for TSMC A16. Design-enablement dependency, not a disclosed software purchase by the foundry.');
  edge('ansys', 'tsmc', 'Certified power-integrity and thermal-analysis design tools', 'ansys-tsmc-a16-2025', 2025, 'Certification / design enablement, not a disclosed purchase. Kept distinct from the corporate acquisition of Ansys.');
  data.companies[idOf('ansys')].role = 'Simulation and analysis software, including TSMC-certified power-integrity and thermal tools. Acquired by Synopsys in July 2025; retained as a tracked system company.';

  source('unisoc-s752-arm', 'UNISOC', 'S752 tablet-platform specifications',
    'https://www.unisoc.com/en/product/LaptopsTablets/S752', null, 'P1-buyer',
    'Product specifications identify Arm Mali G57 graphics and A76/A55 CPU cores. Undated page checked November 25, 2026. No foundry is named by the process-node specification.');
  edge('arm', 'unisoc', 'Arm CPU and Mali G57 GPU intellectual property', 'unisoc-s752-arm', null, 'Named IP incorporated in S752; license terms and procurement channel are not disclosed. No TSMC edge inferred from 6nm.');

  source('empyrean-huahong-2017', 'Hua Hong Grace and Empyrean', 'Hua Hong adopts ALPS and Skipper EDA tools (joint release)',
    'https://www.design-reuse-embedded.com/news/201704099', '2017-04-13', 'P1-buyer',
    'Joint company announcement, reproduced by Design & Reuse, reports ALPS simulation used for completed IP tape-outs and earlier Skipper adoption.');
  edge('empyrean', 'huahong', 'ALPS circuit simulation and Skipper layout-analysis software', 'empyrean-huahong-2017', 2017, 'Historical tool adoption by Hua Hong Grace, represented at Hua Hong group level.');

  source('tsmc-2013-materials', 'TSMC', '2013 annual report: raw-material supply',
    'https://investor.tsmc.com/static/annualReports/2013/english/c_5_3.html', '2014', 'P1-buyer',
    'The materials table names Air Liquide, Air Products, Linde and Taiyo Nippon Sanso as specialty-gas suppliers. Historical annual-report evidence.');
  for (const supplier of ['tnsc', 'linde', 'airliquide', 'airproducts']) edge(supplier, 'tsmc', 'Specialty gases', 'tsmc-2013-materials', 2013, 'Named in the 2013 raw-material supply table; does not establish current supplier shares.');

  source('dupont-tsmc-2025-tcia', 'TSMC', '2025 Taiwan Continuous Improvement Awards: supplier participants',
    'https://www.tsmc.com/english/event/CSD_37', '2025', 'P1-buyer',
    'TSMC identifies DuPont Specialty Materials Taiwan among its award-winning suppliers. Award groups are not supplier-chain depth levels.');
  edge('dupont', 'tsmc', 'Specialty materials (product not specified in award)', 'dupont-tsmc-2025-tcia', 2025, 'Named supplier award recipient; no exact material or purchase volume inferred. Taiwan subsidiary represented at tracked group level.');

  firm('advanced-energy-industries', 'Advanced Energy Industries, Inc.', 'us', 'equipment', 'Precision power-conversion and control equipment; named revenue customers include Applied Materials and Lam Research.');
  source('advanced-energy-2024-revenue', 'Advanced Energy Industries', '2024 Form 10-K, Note 3: significant customers',
    'https://www.sec.gov/Archives/edgar/data/927003/000155837025001038/R11.htm', '2025', 'P1-supplier',
    'Applied Materials and Lam account for 26% and 11% of 2024 revenue respectively. This filing names these customers, correcting the earlier blanket anonymity claim.');
  for (const customer of ['amat', 'lam']) edge('advanced-energy-industries', customer, 'Power-conversion and control products', 'advanced-energy-2024-revenue', 2024, 'Named revenue customer; exact tool configuration is not disclosed.');

  source('nsig-2025-trustee', 'CICC / National Silicon Industry Group', 'NSIG bond trustee report based on issuer disclosures',
    'https://static.sse.com.cn/disclosure/bond/announcement/company/c/new/2025-03-14/240187_20250314_LLRS.pdf', '2025-03-14', 'P1-self',
    'Issuer-supplied business information reproduced in the trustee filing names TSMC, UMC, GlobalFoundries, ST, Towerjazz, SMIC and Hua Hong Grace among wafer customers.');
  for (const customer of ['tsmc', 'umc', 'gf', 'st', 'tower', 'smic', 'huahong']) edge('nsig', customer, 'Semiconductor silicon wafers', 'nsig-2025-trustee', 2025, 'Named customer in issuer-supplied information in the bond trustee filing. No specific wafer size or volume assigned to individual customers.');

  firm('hubei-xingfu-electronic-materials', 'Hubei Xingfu Electronic Materials Co., Ltd.', 'cn', 'materials', 'Electronic-grade wet chemicals for semiconductor manufacturing.');
  firm('hubei-xingfa-chemicals', 'Hubei Xingfa Chemicals Group Co., Ltd.', 'cn', 'materials', 'Chemical raw materials, including yellow phosphorus supplied to Xingfu.');
  source('xingfu-2024-ipo-response', 'Hubei Xingfu / Zhongqin Wanxin', 'IPO inquiry response: customers and raw-material purchases',
    'https://static.sse.com.cn/stock/disclosure/announcement/c/202406/001800_20240629_94NS.pdf', '2024-06-29', 'P1-self',
    'Printed pp.69-70 and 81 identify YMTC and CXMT sales and Hua Hong Grace as an existing customer. Printed p.3 identifies purchases of yellow phosphorus from Xingfa and subsidiaries. These are recorded transactions, not a list of competitors.');
  for (const customer of ['ymtc', 'cxmt', 'huahong']) edge('hubei-xingfu-electronic-materials', customer, 'Electronic-grade wet chemicals', 'xingfu-2024-ipo-response', 2023, 'Named historical sales/customer disclosure covering 2021-2023. Individual chemical qualifications differ by customer.');
  edge('hubei-xingfa-chemicals', 'hubei-xingfu-electronic-materials', 'Yellow phosphorus raw material', 'xingfu-2024-ipo-response', 2023, 'Disclosed related-party raw-material purchases; ownership alone is not the basis of this edge.');

  firm('arteris-ip', 'Arteris, Inc.', 'us', 'services', 'Licenses network-on-chip interconnect intellectual property for semiconductor designs.');
  source('arteris-customers-2022', 'Arteris IP / Sondrel', 'AI and NoCs Are Driving the Future of ADAS, slide 8 (PDF page 10)',
    'https://www.techinsights.com/sites/default/files/2022-11/FPC-Day-1-Session-Slides-Track-B-PM_3.pdf#page=10', '2022-11-01', 'P1-supplier',
    'Company-authored conference slides hosted by TechInsights. Visually checked the customer panel (data as of June 2022), which includes Biren, Cambricon, UNISOC, Bosch, NXP, Samsung, Renesas, ST, Microchip and TI. Ecosystem-partner logos below that panel are NOT treated as customers.');
  for (const customer of ['biren', 'cambricon', 'unisoc', 'bosch', 'nxp', 'samsung', 'renesas', 'st', 'microchip', 'ti']) {
    edge('arteris-ip', customer, 'System-on-chip interconnect intellectual property', 'arteris-customers-2022', 2022, 'Listed as a publicly disclosed customer in the June 2022 customer panel. Historical license relationship; no product-specific IP version or present license availability inferred.');
  }
  source('arteris-cambricon-2017', 'Arteris', 'Cambricon licenses FlexNoC interconnect IP',
    'https://www.arteris.com/press-releases/cambricon-arterisip-flexnoc-machine-learning-neural-networks/', '2017-04-18', 'P1-supplier',
    'Supplier announcement explicitly records a Cambricon FlexNoC license for machine-learning SoCs.');
  edge('arteris-ip', 'cambricon', 'FlexNoC interconnect IP', 'arteris-cambricon-2017', 2017, 'Historical license announced in April 2017.');

  source('pti-2023-awards', 'Powertech Technology', '2023 ESG Insight: customer recognition, page 5',
    'https://www.pti.com.tw/Handlers/CsrDownload.ashx?id=a015f1d4-02a4-49c9-bf31-8196aa7da643&lang=en#page=5', '2024', 'P1-supplier',
    'Downloaded and visually checked page 5: Micron external-manufacturing supplier award and Winbond assembly/testing supplier recognition, both for 2023.');
  for (const customer of ['micron', 'winbond']) edge('pti', customer, 'Semiconductor assembly and testing', 'pti-2023-awards', 2023, 'Historical customer award; neither volumes nor current exclusivity are disclosed.');

  source('skmaterials-2019-airgas', 'SK Materials', '4Q2019 investor presentation: major subsidiaries, slide 7 (PDF page 8)',
    'https://www.sk-materials.com/new/pds/boards/ir/SKMR_4Q19(Eng)%5B1%5D.pdf#page=8', '2020-02-07', 'P1-supplier',
    'Downloaded and visually checked the SK Airgas customer map: SK Hynix Icheon and Cheongju on-site supply. SK Airgas was then wholly owned by SK Materials.');
  edge('skmaterials', 'skhynix', 'Industrial gases supplied on site by historical subsidiary SK Airgas', 'skmaterials-2019-airgas', 2019, 'Historical group-level supply through SK Airgas at Icheon and Cheongju, as disclosed in February 2020. Does not assert present ownership or a specialty-gas product not named on this slide.');

  data.meta.coverageReviewed = '2026-11-25';
  firm('torlens-precision-jiangsu', 'Torlens Precision Manufacturing (Jiangsu) Co., Ltd.', 'cn', 'equipment', 'Precision chambers and process components for semiconductor equipment. Chinese legal name: 托伦斯精密制造（江苏）股份有限公司.');
  firm('donghelong-kunshan', 'Donghelong (Kunshan) Electronics Co., Ltd.', 'cn', 'services', 'Outsourced yttria coating and sealing of semiconductor equipment components. Chinese legal name: 东贺隆（昆山）电子有限公司.');
  firm('anhui-fude-technology', 'Anhui Fude Technology Development Co., Ltd.', 'cn', 'services', 'Component cleaning and surface-treatment services. Chinese legal name: 安徽富乐德科技发展股份有限公司.');
  source('torlens-2026-ipo-response', 'Torlens Precision Manufacturing / CICC', 'IPO inquiry response: customer sales and outsourced processing',
    'https://reportdocs.static.szse.cn/UpFiles/rasinfodisc1/202603/RAS_202603_12170502EC22EADB224924BFC1E1A03D70B0B1.pdf', '2026-03-12', 'P1-self',
    'Printed p.260 shows sales to NAURA and AMEC; pp.286-287 name Donghelong Kunshan and Anhui Fude as paid surface-treatment subcontractors. Raw-material supplier names elsewhere are not automatically linked to the equipment buyers.');
  for (const customer of ['naura', 'amec']) edge('torlens-precision-jiangsu', customer, 'Precision semiconductor-equipment process components', 'torlens-2026-ipo-response', 2025, 'Named customer sales in the 2022 to first-half-2025 disclosure.');
  edge('donghelong-kunshan', 'torlens-precision-jiangsu', 'Yttria coating and sealing services', 'torlens-2026-ipo-response', 2025, 'Named paid surface-treatment subcontractor, including first-half-2025 purchases.');
  edge('anhui-fude-technology', 'torlens-precision-jiangsu', 'Thermal spray and sandblasting services', 'torlens-2026-ipo-response', 2025, 'Named paid surface-treatment subcontractor; a service dependency, not a wafer or chip shipment.');
  // Downstream adoption and end-use: retain the named entity rather than
  // attributing its purchases to a similarly named tracked subsidiary.
  firm('toyota-motor-corporation', 'Toyota Motor Corporation', 'jp', 'brand', 'Vehicle manufacturer; NVIDIA DRIVE adopter');
  firm('aurora-innovation-inc', 'Aurora Innovation', 'us', 'brand', 'Autonomous-driving systems developer');
  firm('rivian-automotive-inc', 'Rivian Automotive', 'us', 'brand', 'Electric vehicle manufacturer');
  firm('tencent-holdings', 'Tencent', 'cn', 'services', 'Cloud services operator');
  firm('akamai-technologies', 'Akamai Technologies', 'us', 'services', 'Cloud and content delivery services');
  firm('servicenow-inc', 'ServiceNow', 'us', 'services', 'Enterprise software and cloud services');
  firm('verizon-communications', 'Verizon Communications', 'us', 'services', 'Telecommunications operator');
  firm('visa-inc', 'Visa', 'us', 'services', 'Payments network operator');

  source('amd-q4-2024-downstream', 'AMD', 'Q4 2024 earnings presentation, slides 23-24',
    'https://ir.amd.com/financial-information/sec-filings/content/0000002488-25-000009/amdq424earningsslidesfin.htm', '2025-02-04', 'P1-supplier',
    'Names cloud launches, enterprise deployments and server platforms. Adoption does not disclose direct purchasing channels or volumes.');
  for (const customer of ['microsoft', 'google', 'amazon', 'alibaba', 'tencent-holdings']) {
    edge('amd', customer, 'AMD-powered cloud compute instances', 'amd-q4-2024-downstream', 2024,
      'Named Q4 2024 cloud instance launches. Product adoption; procurement through OEMs or distributors is not specified.');
  }
  for (const customer of ['cisco-systems-inc', 'dell-technologies-inc', 'hewlett-packard-enterprise-company', 'lenovo', 'supermicro']) {
    edge('amd', customer, 'EPYC Turin server platforms', 'amd-q4-2024-downstream', 2024,
      'Named OEM/ODM platform launches in Q4 2024; no shipment volume or exclusive sourcing inferred.');
  }
  for (const customer of ['akamai-technologies', 'servicenow-inc', 'verizon-communications', 'visa-inc']) {
    edge('amd', customer, 'Enterprise deployments of AMD computing', 'amd-q4-2024-downstream', 2024,
      'Named enterprise deployment in supplier earnings presentation; end user, not necessarily a direct chip purchaser.');
  }
  source('nvidia-drive-customers-2025', 'NVIDIA', 'Toyota, Aurora and Continental adopt NVIDIA DRIVE',
    'https://nvidianews.nvidia.com/news/toyota-aurora-continental-nvidia-drive', '2025-01-06', 'P1-supplier',
    'Named automotive platform adoption and development. Continental mass manufacture of Aurora Driver was planned for 2027, not confirmed production.');
  for (const customer of ['toyota-motor-corporation', 'aurora-innovation-inc', 'continental-ag', 'rivian-automotive-inc', 'byd-company-limited']) {
    edge('nvidia', customer, 'NVIDIA DRIVE automated-driving computing', 'nvidia-drive-customers-2025', 2025,
      'Named platform adoption/development roadmap. This does not establish completed vehicle shipments or direct purchasing terms.');
  }
  source('infineon-rivian-r2-2025', 'Infineon Technologies', 'Power modules for Rivian R2 traction inverters',
    'https://www.infineon.com/technology-news/2025/infatv202505-108', '2025-05-19', 'P1-supplier',
    'Announced HybridPACK Drive G2, AURIX TC3x and OPTIREG supply for R2, expected to start in 2026. Actual start not confirmed by this source.');
  edge('infineon', 'rivian-automotive-inc', 'Traction inverter power modules, microcontrollers and power management ICs', 'infineon-rivian-r2-2025', 2025,
    'Announced future supply for the R2 platform; 2026 start was an expectation in May 2025, not verified deliveries.');
  // Targeted zero-counterparty audit: documented physical and service supply.
  firm('hemlock-semiconductor', 'Hemlock Semiconductor', 'us', 'materials', 'Semiconductor-grade polysilicon producer');
  firm('benchmark-electronics', 'Benchmark Electronics', 'us', 'assembly', 'Electronics manufacturing and engineering services');
  firm('foxsemicon-integrated-technology', 'Foxsemicon Integrated Technology', 'tw', 'equipment', 'Semiconductor equipment components and manufacturing');
  firm('horiba-ltd', 'HORIBA', 'jp', 'equipment', 'Measurement and process-control equipment');
  firm('celestica-inc', 'Celestica', 'ca', 'assembly', 'Electronics manufacturing services; group-level disclosure');
  firm('xpeng-inc', 'XPENG', 'cn', 'brand', 'Electric vehicle manufacturer and cloud services customer');
  firm('anthropic-pbc', 'Anthropic', 'us', 'services', 'AI model developer and cloud compute customer');
  firm('semtech-corporation', 'Semtech', 'us', 'ic_other', 'Analog and connectivity semiconductor designer');

  source('marvell-aws-agreement-2024', 'Marvell Technology', 'Expanded AWS relationship: semiconductor supply and EDA cloud infrastructure',
    'https://investor.marvell.com/sec-filings/all-sec-filings/content/0001835632-24-000193/final2024_12x02xmarvell-.htm', '2024-12-02', 'P1-self',
    'Five-year agreement names both directions: Marvell semiconductor products for AWS and AWS cloud compute for Marvell chip design.');
  edge('marvell', 'amazon', 'AI and data-center semiconductors', 'marvell-aws-agreement-2024', 2024, 'Multi-year supply agreement includes custom AI, optical DSP, retimer and Ethernet products; no volumes inferred.');
  edge('amazon', 'marvell', 'Cloud compute infrastructure for EDA', 'marvell-aws-agreement-2024', 2024, 'AWS supplies cloud infrastructure used by Marvell for silicon design. Service supply, not reverse shipment of chips.');
  source('xiaomi-14t-specifications', 'Xiaomi', 'Xiaomi 14T specifications',
    'https://www.mi.com/global/product/xiaomi-14t/specs/', 'undated', 'P1-buyer',
    'Official product specifications name the MediaTek Dimensity 8300-Ultra. Undated page; access date is not a shipment date.');
  edge('mediatek', 'xiaomi', 'Dimensity 8300-Ultra smartphone processor', 'xiaomi-14t-specifications', null, 'Named processor in Xiaomi 14T; product adoption does not disclose purchasing channel or volume.');
  source('asm-supplier-day-2024', 'ASM International', 'Supplier Day 2024 performance and sustainability awards',
    'https://www.asm.com/news/asm-celebrates-innovation-and-partnership-at-supplier-day-2024', '2024', 'P1-buyer',
    'Names Benchmark Electronics, Foxsemicon, Horiba and Celestica as suppliers. KLK omitted because the short name does not resolve an unambiguous entity here.');
  for (const supplier of ['benchmark-electronics', 'foxsemicon-integrated-technology', 'horiba-ltd', 'celestica-inc']) {
    edge(supplier, 'asmi', 'Supplier contributions to ASM equipment operations', 'asm-supplier-day-2024', 2024, 'Buyer-named supplier award; exact part, volume and allocation to individual tool models are undisclosed. Celestica is represented at group level, not assigned to its Malaysian subsidiary.');
  }
  source('hemlock-sumco-award-2022', 'Hemlock Semiconductor', 'SUMCO Japan 2022 Supplier of the Year award',
    'https://www.hscpoly.com/hemlock-semiconductor-wins-2022-supplier-of-the-year-award-from-sumco-japan/', '2023-07-07', 'P1-supplier',
    'Article describes the 2022 award and polysilicon supply relationship. Page also displays a later September 2025 update date.');
  edge('hemlock-semiconductor', 'sumco', 'Semiconductor-grade polysilicon', 'hemlock-sumco-award-2022', 2022, 'Historical supplier recognition; no current volume or exclusivity claim.');
  source('aws-ansys-gateway-2023', 'Amazon Web Services', 'Architecture of Ansys Gateway powered by AWS',
    'https://aws.amazon.com/blogs/apn/accelerate-your-ansys-simulations-with-ansys-gateway-powered-by-aws/', '2023-02-16', 'P1-supplier',
    'Joint AWS/Ansys technical article states the control plane is hosted in Ansys AWS account; application compute runs in end customers accounts.');
  edge('amazon', 'ansys', 'AWS hosting for Ansys Gateway control plane', 'aws-ansys-gateway-2023', 2023, 'Cloud service dependency in the documented architecture; end-customer application workloads are not attributed to Ansys purchases.');
  source('azure-synopsys-cloud-2022', 'Microsoft Azure', 'Synopsys Cloud on Azure',
    'https://azure.microsoft.com/en-us/blog/accelerate-silicon-design-innovation-on-azure-with-synopsys-cloud/', '2022-03-30', 'P1-supplier',
    'Microsoft names Azure as the infrastructure running Synopsys Cloud chip-design and verification tools.');
  edge('microsoft', 'synopsys', 'Azure infrastructure for Synopsys Cloud EDA', 'azure-synopsys-cloud-2022', 2022, 'Named cloud infrastructure dependency; not a physical semiconductor supply link.');
  source('alibaba-xpeng-cloud-2024', 'Alibaba Cloud', 'Customer deployments of cloud infrastructure and AI models',
    'https://www.alibabacloud.com/en/press-room/alibaba-cloud-empowers-customers-and-partners-with?_p_lc=1', '2024-09-20', 'P1-supplier',
    'Names XPENG as a user of Alibaba Cloud models and cloud computing for smart cockpit and autonomous driving.');
  edge('alibaba', 'xpeng-inc', 'Cloud computing and AI model services', 'alibaba-xpeng-cloud-2024', 2024, 'Named service customer; no inference of a particular chip installed in a vehicle.');
  source('anthropic-cloud-compute-2025', 'Anthropic', 'Expansion of Google Cloud TPUs and services',
    'https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services', '2025-10-23', 'P1-buyer',
    'Names Google Cloud TPU use and expansion plans, and Amazon as primary training partner and cloud provider.');
  edge('google', 'anthropic-pbc', 'Cloud TPU compute and services', 'anthropic-cloud-compute-2025', 2025, 'Existing use plus announced expansion; planned capacity is not treated as delivered or as direct ownership of physical chips.');
  edge('amazon', 'anthropic-pbc', 'Cloud compute and Trainium training infrastructure', 'anthropic-cloud-compute-2025', 2025, 'Buyer names Amazon as its primary cloud provider and training partner.');
  source('tower-semtech-shipments-2024', 'Tower Semiconductor', 'Semtech recognizes CY2024 wafer manufacturing and shipments',
    'https://towersemi.com/2024/12/10/12102024/', '2024-12-10', 'P1-supplier',
    'Names Semtech and actual CY2024 wafer shipments using Tower SiGe technology for connectivity ICs.');
  edge('tower', 'semtech-corporation', 'SiGe wafer fabrication for connectivity ICs', 'tower-semtech-shipments-2024', 2024, 'Supplier disclosure with named customer quotation and recognition of wafer shipments; no quantity inferred.');
  data.edges.sort((a, b) => a.customer.localeCompare(b.customer) || a.supplier.localeCompare(b.supplier));
  source('renesas-tsmc-2012-outsourcing', 'Renesas', 'TSMC microcontroller manufacturing agreement',
    'https://www.renesas.com/en/about/newsroom/renesas-electronics-and-tsmc-collaborate-construct-ecosystem-microcontrollers', '2012-05-28', 'P1-buyer',
    'Renesas describes existing 90nm MCU outsourcing and an agreement to extend manufacturing to 40nm and future processes.');
  edge('tsmc', 'renesas', 'Outsourced microcontroller wafer manufacturing', 'renesas-tsmc-2012-outsourcing', 2012, 'Historical existing 90nm arrangement and announced 40nm extension; not a claim about current production mix.');
  source('infineon-tsmc-2009-production', 'TSMC / Infineon', 'Extension of embedded-flash development and production agreement',
    'https://pr.tsmc.com/english/news/1584', '2009-11-05', 'P1-supplier',
    'Joint announcement extends the development and production partnership to 65nm embedded flash.');
  edge('tsmc', 'infineon', 'Embedded-flash wafer manufacturing', 'infineon-tsmc-2009-production', 2009, 'Historical development and production agreement; no present-day share inferred.');
  source('arm-nvidia-grace-ip', 'Arm', 'NVIDIA partner profile: Grace CPU and BlueField processors',
    'https://www.arm.com/partners/catalog/nvidia', null, 'P1-supplier',
    'Undated profile checked November 25, 2026 identifies Neoverse V2 cores in Grace and Arm processors in BlueField.');
  edge('arm', 'nvidia', 'Arm Neoverse V2 CPU intellectual property', 'arm-nvidia-grace-ip', null, 'Named IP incorporation in Grace, not an acquisition or a disclosed physical chip sale by Arm.');
  source('nvidia-qct-2024-systems', 'NVIDIA', 'Computer manufacturers announce Blackwell systems',
    'https://nvidianews.nvidia.com/news/computer-industry-ai-factories-data-centers/', '2024-06-02', 'P1-supplier',
    'Names QCT among manufacturers announcing systems using NVIDIA GPUs and networking; Quanta chairman confirms participation.');
  edge('nvidia', 'quanta', 'GPUs and networking for announced Blackwell systems', 'nvidia-qct-2024-systems', 2024, 'Announced adoption through Quanta Cloud Technology; not proof of volume delivery on the announcement date.');
  source('rapidus-asml-delivery-2024', 'Rapidus', 'Engineering interview describing EUV equipment arrival',
    'https://www.rapidus.inc/en/interview/it0007/', '2026-01-26', 'P1-buyer',
    'Rapidus describes receiving ASML EUV lithography equipment in December 2024.');
  edge('asml', 'rapidus', 'EUV lithography equipment', 'rapidus-asml-delivery-2024', 2024, 'Buyer reports December 2024 delivery in a January 2026 retrospective.');
  data.edges.sort((a, b) => a.customer.localeCompare(b.customer) || a.supplier.localeCompare(b.supplier));
  return data;
}
