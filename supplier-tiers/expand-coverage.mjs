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
