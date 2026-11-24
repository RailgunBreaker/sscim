#!/usr/bin/env node
/* ====================================================================
   Public multi-tier semiconductor supplier dataset — authoring pass.

   This script is the single source of truth for the tiered supplier
   graph. It holds the *public documents* the graph is built from, the
   named relationships each document establishes, and a company registry
   giving each firm a country and a chain layer. It writes three files:

     data/sources.json    the documents, with URLs and how they were seen
     data/companies.json  the firms, with country and chain layer
     data/edges.json      supplier -> customer, each one citing a document

   The governing rule, and the reason this dataset exists:

     EVERY EDGE CITES A PUBLIC DOCUMENT THAT NAMES BOTH PARTIES.

   No edge is inferred from a process flow, a market-share table, an
   analyst's view of who probably supplies whom, or a prior. If no public
   document names the pair, the edge is absent — and that absence is a
   finding, not a gap to be filled with a guess. Huawei's upstream is
   nearly empty here for exactly that reason.

   Tier is not stored. It is derived at build time as the shortest
   upstream distance from a focal buyer, so changing the focal set
   re-tiers the whole graph without touching the data.

   Run:  node supplier-tiers/author-dataset.mjs
   ==================================================================== */

import { expandSystem } from './expand-system.mjs';
import { expandFilings } from './expand-filings.mjs';
import { expandCoverage } from './expand-coverage.mjs';
import { supplierCoverage, coverageSummary } from './coverage.mjs';
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");

/* ---------------------------------------------------------------- *
 * 1. Sources — the public documents, and how each one was seen.
 *
 * `evidence` records WHO published the relationship, which matters far
 * more than the publisher's prestige:
 *   P1-buyer     the buyer publishes its supplier's name
 *   P1-supplier  the supplier publishes its customer's name
 *   P1-self      a company's own filing names its counterparty
 *   P2-institutional  a research house identifies the pair
 *   P3-regulatory     a government document establishes the relation
 *
 * `seen` is honest about verification depth:
 *   fetched          the document was retrieved and read for this dataset
 *   search-indexed   the URL came from a search index, not opened here
 * ---------------------------------------------------------------- */
const SOURCES = {
  "apple-sl-fy2023": {
    publisher: "Apple Inc.",
    title: "Supplier List (fiscal year 2023)",
    kind: "Buyer-published supplier list",
    url: "https://s203.q4cdn.com/367071867/files/doc_downloads/2024/04/Apple-Supplier-List.pdf",
    published: "2024-04",
    evidence: "P1-buyer",
    seen: "fetched",
    retrieved: "2026-11-22",
    quote:
      "The Apple supplier list represents 98 percent of our direct spend for materials, manufacturing, and assembly of our products worldwide for fiscal year 2023.",
    note: "187 supplier names machine-extracted from the PDF's supplier-name column with pdftotext; the extraction is kept verbatim in data/raw-apple-supplier-list-fy2023.txt, minus three page-footer fragments the column capture caught.",
  },
  "apple-supplier-responsibility": {
    publisher: "Apple Inc.",
    title: "Supply Chain Innovation (supplier responsibility index)",
    kind: "Company page",
    url: "https://www.apple.com/supplier-responsibility/",
    evidence: "P1-buyer",
    seen: "fetched",
    retrieved: "2026-11-22",
    note: "Index page the supplier list is published from.",
  },
  "tsmc-scm-2026": {
    publisher: "TSMC",
    title: "TSMC 2026 Supply Chain Management Forum Presents Awards to Outstanding Suppliers",
    kind: "Buyer-published supplier award list",
    url: "https://pr.tsmc.com/english/news/3355",
    published: "2026-11-17",
    evidence: "P1-buyer",
    seen: "fetched",
    retrieved: "2026-11-22",
    quote:
      "This year's evaluation placed greater emphasis on overall performance in construction safety, sustainability, global support, and localization",
  },
  "tsmc-scm-2025": {
    publisher: "TSMC",
    title: "TSMC 2025 Supply Chain Management Forum Presents Awards to Outstanding Suppliers",
    kind: "Buyer-published supplier award list",
    url: "https://pr.tsmc.com/english/news/3274",
    published: "2025-11-28",
    evidence: "P1-buyer",
    seen: "fetched",
    retrieved: "2026-11-22",
    quote:
      "recognizing suppliers for their outstanding performance in driving improvements and efficiencies across the supply chain",
  },
  "tsmc-scm-2024": {
    publisher: "TSMC",
    title: "TSMC 2024 Supply Chain Management Forum Presents Awards to Outstanding Suppliers",
    kind: "Buyer-published supplier award list",
    url: "https://pr.tsmc.com/english/news/3192",
    published: "2024-12-02",
    evidence: "P1-buyer",
    seen: "fetched",
    retrieved: "2026-11-22",
    quote:
      "commend suppliers with outstanding performance in the innovation, technology collaboration, global production support",
  },
  "intel-epic-2026": {
    publisher: "Intel Corporation",
    title: "Intel Announces 2026 EPIC Supplier Award Recipients",
    kind: "Buyer-published supplier award list",
    url: "https://www.intel.com/content/www/us/en/newsroom/news/corporate/intel-announces-2026-epic-supplier-award-recipients.html",
    published: "2026-03-19",
    evidence: "P1-buyer",
    seen: "fetched",
    retrieved: "2026-11-22",
    quote:
      "Of the thousands of Intel suppliers around the world, only a few hundred qualify to participate in the EPIC Supplier Program.",
  },
  "intel-epic-2024": {
    publisher: "Intel Corporation",
    title: "Intel Announces 2024 EPIC Supplier Program Award Recipients",
    kind: "Buyer-published supplier award list",
    url: "https://www.intel.com/content/www/us/en/newsroom/news/intel-announces-2024-epic-supplier-program-award-recipients.html",
    published: "2024-03-28",
    evidence: "P1-buyer",
    seen: "fetched",
    retrieved: "2026-11-22",
    note: "Three award classes: Outstanding, Distinguished, Valued.",
  },
  "intel-epic-program": {
    publisher: "Intel Corporation",
    title: "Excellence, Partnership, Inclusion and Continuous Improvement (EPIC) Program",
    kind: "Company page",
    url: "https://www.intel.com/content/www/us/en/supplier/governance/quality/epic.htm",
    evidence: "P1-buyer",
    seen: "search-indexed",
    note: "Defines the programme the award lists are drawn from.",
  },
  "trumpf-asml-2025": {
    publisher: "TRUMPF (carried by Photonics Online)",
    title: "ASML Honors TRUMPF For New EUV Laser",
    kind: "Supplier-published award announcement",
    url: "https://www.photonicsonline.com/doc/asml-honors-trumpf-for-new-euv-laser-0001",
    published: "2025-10-24",
    evidence: "P1-supplier",
    seen: "fetched",
    retrieved: "2026-11-22",
    quote:
      'The Dutch technology company ASML yesterday honored TRUMPF with its prestigious Supplier Award in the "Technology" category.',
  },
  "nts-asml-2025": {
    publisher: "NPM Capital (on NTS Group)",
    title: "NTS Group wins ASML Supplier Award for global production strategy",
    kind: "Supplier-published award announcement",
    url: "https://www.npm-capital.com/en/news/nts-group-wins-asml-supplier-award-for-global-production-strategy?hsLang=en",
    published: "2025-11-21",
    evidence: "P1-supplier",
    seen: "fetched",
    retrieved: "2026-11-22",
    quote:
      "NTS Group was awarded a Supplier Award in the category Cost during the annual ASML Suppliers Day.",
  },
  "asml-20f-2014": {
    publisher: "ASML Holding N.V.",
    title: "Annual Report on Form 20-F, FY2014",
    kind: "Securities filing",
    url: "https://www.sec.gov/Archives/edgar/data/0000937966/000119312515042676/d737660d20f.htm",
    published: "2015-02",
    evidence: "P1-self",
    seen: "search-indexed",
    quote:
      "single supplier of lenses, mirrors, collectors and other optical components … 27.4% of our aggregate cost of sales were purchased from Zeiss",
    note: "The clearest filed statement of the Zeiss dependency and its size. Dated — the share will have moved — but the single-source structure is the point.",
  },
  "asml-20f-2024": {
    publisher: "ASML Holding N.V.",
    title: "Annual Report on Form 20-F, FY2024",
    kind: "Securities filing",
    url: "https://www.sec.gov/Archives/edgar/data/937966/000093796625000009/asml-20241231.htm",
    published: "2025-03-05",
    evidence: "P1-self",
    seen: "search-indexed",
  },
  "asml-berlin": {
    publisher: "ASML",
    title: "ASML Berlin",
    kind: "Company page",
    url: "https://asml.com/en/asml-berlin",
    evidence: "P1-self",
    seen: "search-indexed",
    quote:
      "manufactures many key components for our extreme ultraviolet (EUV) and deep ultraviolet (DUV) systems, including wafer tables and clamps, reticle chucks and mirror blocks",
    note: "Berliner Glas, acquired by ASML in November 2020 — an upstream supplier that became an internal site. Recorded as internalised, not as an arm's-length edge.",
  },
  "asml-supply-chain-2023": {
    publisher: "ASML",
    title: "6 ingredients of a robust supply chain",
    kind: "Company page",
    url: "https://www.asml.com/en/company/stories/2023/6-ingredients-robust-supply-chain",
    published: "2023",
    evidence: "P1-self",
    seen: "search-indexed",
  },
  "tsmc-ar-2024-customers": {
    publisher: "TSMC",
    title: "2024 Annual Report — customers accounting for at least 10% of consolidated net revenue",
    kind: "Annual report",
    url: "https://investor.tsmc.com/static/annualReports/2024/english/ebook/files/basic-html/page112.html",
    published: "2025-04",
    evidence: "P1-self",
    seen: "search-indexed",
    note: "Reports Customer A at 22% of 2024 net revenue — ANONYMISED. Establishes concentration, names nobody. No edge can be drawn from it.",
  },
  "tsmc-ar-2024-risk": {
    publisher: "TSMC",
    title: "2024 Annual Report — customer concentration risk factor",
    kind: "Annual report",
    url: "https://investor.tsmc.com/static/annualReports/2024/english/ebook/files/basic-html/page140.html",
    published: "2025-04",
    evidence: "P1-self",
    seen: "search-indexed",
  },
  "nvda-10k-fy2025": {
    publisher: "NVIDIA Corporation",
    title: "Annual Report on Form 10-K, fiscal 2025",
    kind: "Securities filing",
    url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm",
    published: "2025-02-26",
    evidence: "P1-self",
    seen: "search-indexed",
    note: "Direct Customer A 12%, B and C 11% each of FY2025 revenue — ANONYMISED. Establishes concentration, names nobody. No edge can be drawn from it.",
  },
  "techinsights-smic-n2": {
    publisher: "TechInsights",
    title: "TechInsights finds SMIC 7nm (N+2) in Huawei Mate 60 Pro",
    kind: "Teardown / reverse-engineering report",
    url: "https://www.techinsights.com/blog/techinsights-finds-smic-7nm-n2-huawei-mate-60-pro",
    published: "2023-09",
    evidence: "P2-institutional",
    seen: "search-indexed",
    note: "Physical die analysis, not a disclosure — the one class of evidence that still works when neither party will confirm the relationship.",
  },
  "techinsights-smic-7nm-card": {
    publisher: "TechInsights",
    title: "China's SMIC Plays 7 nm Card",
    kind: "Teardown / reverse-engineering report",
    url: "https://www.techinsights.com/blog/chinas-smic-plays-7-nm-card",
    evidence: "P2-institutional",
    seen: "search-indexed",
  },
  "fr-huawei-2020-08": {
    publisher: "U.S. Federal Register (Bureau of Industry and Security)",
    title:
      "Addition of Huawei Non-U.S. Affiliates to the Entity List, the Removal of Temporary General License, and Amendments to General Prohibition Three (85 FR 51596)",
    kind: "Rule",
    url: "https://www.federalregister.gov/documents/2020/08/20/2020-18213/addition-of-huawei-non-us-affiliates-to-the-entity-list-the-removal-of-temporary-general-license-and",
    published: "2020-08-20",
    evidence: "P3-regulatory",
    seen: "search-indexed",
    note: "Names Huawei's non-U.S. affiliates, HiSilicon among them — a government document establishing corporate affiliation.",
  },
  "fr-fdpr-2020-05": {
    publisher: "U.S. Federal Register (Bureau of Industry and Security)",
    title:
      "Export Administration Regulations: Amendments to General Prohibition Three (Foreign-Produced Direct Product Rule) and the Entity List (85 FR 29849)",
    kind: "Interim final rule",
    url: "https://www.govinfo.gov/content/pkg/FR-2020-05-19/html/2020-10856.htm",
    published: "2020-05-19",
    evidence: "P3-regulatory",
    seen: "search-indexed",
    note: "The rule that severed Huawei's foundry access and is the direct cause of the empty upstream recorded here.",
  },
  "fujifilm-samsung-2025": {
    publisher: "Fujifilm Holdings",
    title: 'Fujifilm receives Samsung Electronics "Most Valuable Partner Award" at Material Day 2025',
    kind: "Supplier-published award announcement",
    url: "https://www.fujifilm.com/kr/en/news/hq/13138",
    published: "2025-11-18",
    evidence: "P1-supplier",
    seen: "search-indexed",
    note: "Fujifilm states 14 companies were honoured; it names only itself, so only its own edge is recorded.",
  },
  "lam-supplier-awards-2024": {
    publisher: "Lam Research (carried by 3D InCites)",
    title: "Lam Research Honors Suppliers with 2024 Excellence Awards",
    kind: "Buyer-published supplier award list",
    url: "https://www.3dincites.com/2024/09/lam-research-honors-global-suppliers-with-2024-excellence-awards/",
    published: "2024-09-23",
    evidence: "P1-buyer",
    seen: "fetched",
    retrieved: "2026-11-22",
    quote:
      "Lam Research Corp. today announced this year's recipients of its annual Supplier Excellence Awards, recognizing nine companies from around the world for performance across a range of categories.",
    note:
      "Reaches a third documented step: these are suppliers to an equipment maker that is itself named as a supplier to TSMC and Intel. The release names the award category but never the product, so no edge from it claims one. Lam's 2023 list exists but was only available here as a summary rather than verbatim text, so it was left out.",
  },
  "semi-wafer-2025": {
    publisher: "SEMI",
    title: "SEMI Reports 2025 Annual Worldwide Silicon Wafer Shipments and Revenue Results",
    kind: "Industry association statistics",
    url: "https://www.semi.org/en/semi-press-release/semi-reports-2025-annual-worldwide-silicon-wafer-shipments-and-revenue-results",
    evidence: "P2-institutional",
    seen: "search-indexed",
    note: "Context for the wafer layer. Carries no firm-to-firm relationship, so it backs no edge.",
  },
};

/* ---------------------------------------------------------------- *
 * 2. Chain layers — one primary layer per firm, used for colour and
 *    filtering. Ordered roughly upstream to downstream, with the
 *    non-chain layers last so they can be switched off in one move.
 * ---------------------------------------------------------------- */
const LAYERS = {
  equipment: "Wafer-fab equipment",
  optics_laser: "Optics, lasers, light sources",
  wafers: "Silicon wafers",
  photomask: "Photomasks and blanks",
  materials: "Process materials and chemicals",
  metals: "Metals, targets, quartz, parts",
  foundry_idm: "Foundry and IDM",
  memory: "Memory",
  ic_other: "Other ICs — fabless, analog, RF, power, sensor",
  osat_test: "Packaging, assembly and test",
  substrates_pcb: "Substrates and PCB",
  passives: "Passive and discrete components",
  display_camera: "Display, camera and optical modules",
  mechanical: "Mechanical, enclosure, battery, other",
  assembly: "Final assembly (ODM/EMS)",
  brand: "Brand / system owner",
  construction: "Fab construction and facilities",
  services: "IT and business services",
};

/* ---------------------------------------------------------------- *
 * 3. Company registry. name -> [country, layer, role?]
 *    Country is the group parent's home, which is what public filings
 *    and policy documents key on; it is NOT where the plant is.
 * ---------------------------------------------------------------- */
const C = {
  /* --- focal buyers and brands --- */
  "Apple Inc.": ["us", "brand", "Smartphone, PC and silicon designer; publishes its own supplier list"],
  "Huawei Technologies Co., Ltd.": ["cn", "brand", "Network equipment and handset maker; Entity-Listed since 2019"],
  "HiSilicon Technologies Co., Ltd.": ["cn", "ic_other", "Huawei's fabless design arm"],

  /* --- the two mid-chain buyers that publish their own supplier lists --- */
  "Taiwan Semiconductor Manufacturing Company Limited": ["tw", "foundry_idm", "Leading-edge logic foundry"],
  "Intel Corporation": ["us", "foundry_idm", "IDM and foundry"],
  "ASML Holding N.V.": ["nl", "equipment", "Lithography systems; sole EUV supplier"],
  "Samsung Electronics Company Limited": ["kr", "memory", "Memory, foundry and display"],
  "Semiconductor Manufacturing International Corporation": ["cn", "foundry_idm", "China's largest foundry; Entity-Listed since 2020"],

  /* --- Apple Supplier List FY2023, 190 names --- */
  "3M": ["us", "materials", "Adhesives, films, abrasives"],
  "AAC Acoustic Technologies Holdings Incorporated": ["cn", "passives", "Acoustic components"],
  "Advanced Semiconductor Engineering Technology Holding Co., Ltd.": ["tw", "osat_test", "World's largest OSAT"],
  "AGC Incorporated": ["jp", "photomask", "Glass, and EUV mask blanks"],
  "AKM Meadville Electronics (Xiamen) Company Limited": ["cn", "substrates_pcb", "PCB"],
  "Alpha and Omega Semiconductor Limited": ["us", "ic_other", "Power discretes"],
  "Alps Alpine Company Limited": ["jp", "passives", "Electromechanical components, sensors"],
  "Amkor Technology Incorporated": ["us", "osat_test", "OSAT"],
  "Amphenol Corporation": ["us", "passives", "Connectors"],
  "ams-OSRAM AG": ["at", "ic_other", "Optical sensors and LED"],
  "Analog Devices Incorporated": ["us", "ic_other", "Analog and mixed-signal IDM"],
  "AT & S Austria Technologie & Systemtechnik AG": ["at", "substrates_pcb", "IC substrates and HDI PCB"],
  "Baoji Titanium Industry Co., Ltd.": ["cn", "metals", "Titanium"],
  "Baotou Inst Magnetic New Materials Co., Ltd.": ["cn", "materials", "Magnetic materials"],
  "Beijing Zhong Ke San Huan High-Tech Co., Ltd.": ["cn", "materials", "Rare-earth magnets"],
  "Bichamp Cutting Technology (Hunan) Co., Ltd": ["cn", "mechanical", "Cutting tools"],
  "Biel Crystal Manufactory Limited": ["cn", "display_camera", "Cover glass"],
  "BOE Technology Group Company Limited": ["cn", "display_camera", "Display panels"],
  "Boyd Corporation": ["us", "materials", "Thermal and sealing"],
  "Broadcom Limited": ["us", "ic_other", "RF front-end, connectivity, custom ASIC"],
  "Bumchun Precision Company Limited": ["kr", "mechanical", "Precision metal parts"],
  "BYD Company Limited": ["cn", "assembly", "Assembly and batteries"],
  "Career Technology (Mfg.) Company Limited": ["tw", "substrates_pcb", "Flexible PCB"],
  "Catcher Technology Company Limited": ["tw", "mechanical", "Metal enclosures"],
  "Cathay Tat Ming (HK) Company Limited": ["cn", "mechanical", "Metal parts"],
  "Cheng Uei Precision Industry Company Limited (Foxlink)": ["tw", "passives", "Connectors and cables"],
  "Chengdu Homin Technology Company Limited": ["cn", "mechanical", "Precision components"],
  "China Circuit Technology (Shantou) Corporation": ["cn", "substrates_pcb", "PCB"],
  "Cirrus Logic Incorporated": ["us", "ic_other", "Audio and mixed-signal fabless"],
  "CN Innovations Holdings Limited": ["cn", "mechanical", "Precision metal and plastic"],
  "Coherent Corporation": ["us", "optics_laser", "Lasers and photonics"],
  "Compal Electronics Incorporated": ["tw", "assembly", "ODM"],
  "Compeq Manufacturing Company Limited": ["tw", "substrates_pcb", "PCB and substrates"],
  "Corning Incorporated": ["us", "display_camera", "Specialty glass"],
  "Cosmosupplylab Limited": ["cn", "mechanical", "Components"],
  "Cowell E Holdings Incorporated": ["kr", "display_camera", "Camera modules"],
  "Crystal-Optech Co., Ltd.": ["cn", "display_camera", "Optical filters and coatings"],
  "CymMetrik Enterprise Company Limited": ["cn", "mechanical", "Printing and packaging"],
  "Delta Electronics Incorporated": ["tw", "passives", "Power supplies and components"],
  "Derkwoo Electronics Company Limited": ["kr", "passives", "Electronic components"],
  "Dexerials Corporation": ["jp", "materials", "Optical adhesives and films"],
  "Diodes Incorporated": ["us", "ic_other", "Discrete and analog IDM"],
  "Dynapack International Technology Corporation": ["tw", "mechanical", "Battery packs"],
  "Flex Limited": ["sg", "assembly", "EMS"],
  "Flexium Interconnect Incorporated": ["tw", "substrates_pcb", "Flexible PCB"],
  "Fujian Nanping Aluminium Company Limited": ["cn", "metals", "Aluminium"],
  "Fujikura Limited": ["jp", "substrates_pcb", "Flexible PCB and connectors"],
  "General Interface Solution Limited": ["tw", "display_camera", "Touch and display modules"],
  "Genius Electronic Optical Company Limited": ["tw", "display_camera", "Camera lenses"],
  "GigaDevice Semiconductor Incorporated": ["cn", "memory", "NOR flash and MCU fabless"],
  "Global Lighting Technologies": ["tw", "display_camera", "Backlight"],
  "GoerTek Incorporated": ["cn", "assembly", "Acoustics and module assembly"],
  "Golden Arrow Printing Company Limited": ["cn", "mechanical", "Printing and packaging"],
  "Hama Naka Shoukin Industry Company Limited": ["jp", "metals", "Metal processing"],
  "Henkel AG & Company, KGaA": ["de", "materials", "Adhesives and surface treatment"],
  "Hi-P International Limited": ["sg", "mechanical", "Precision mechanics"],
  "Hirose Electric Company Limited": ["jp", "passives", "Connectors"],
  "Hon Hai Precision Industry Company Limited (Foxconn)": ["tw", "assembly", "Largest contract assembler"],
  "IDEMIA Group": ["fr", "services", "Secure identity"],
  "INB Electronics Limited": ["cn", "passives", "Electronic components"],
  "Infineon Technologies AG": ["de", "foundry_idm", "Power and automotive IDM"],
  "Interplex Holdings Pte. Ltd.": ["sg", "passives", "Interconnect"],
  "J.Pond Industry (Dongguan) Company Limited": ["cn", "mechanical", "Precision parts"],
  "Jabil Incorporated": ["us", "assembly", "EMS"],
  "Japan Aviation Electronics Industry Limited": ["jp", "passives", "Connectors"],
  "Japan Display Incorporated": ["jp", "display_camera", "Display panels"],
  "JCET Group Company Limited": ["cn", "osat_test", "OSAT"],
  "Jiangsu Kangrui New Material Technology Co.,Ltd.": ["cn", "materials", "New materials"],
  "Jiuquan Iron & Steel (Group) Co., Ltd.": ["cn", "metals", "Steel"],
  "Jones Tech PLC": ["cn", "materials", "EMI shielding and thermal"],
  "JX Nippon Mining & Metals Corporation (Eneos Holding)": ["jp", "metals", "Sputtering targets and high-purity metals"],
  "Kam Kiu Aluminium Products Group Limited": ["cn", "metals", "Aluminium extrusion"],
  "Keiwa Inc.": ["jp", "display_camera", "Optical films"],
  "Kioxia Holdings Corporation": ["jp", "memory", "NAND flash"],
  "Knowles Corporation": ["us", "passives", "MEMS microphones and capacitors"],
  "Kunshan Kersen Science and Technology Company Limited": ["cn", "mechanical", "Precision metal"],
  "Kyocera Corporation": ["jp", "substrates_pcb", "Ceramic packages and components"],
  "Largan Precision Company Limited": ["tw", "display_camera", "Camera lenses"],
  "Lens Technology Company Limited": ["cn", "display_camera", "Cover glass"],
  "LG Energy Solution": ["kr", "mechanical", "Batteries"],
  "LG Display Company Limited": ["kr", "display_camera", "Display panels"],
  "LG Innotek Company Limited": ["kr", "display_camera", "Camera modules and substrates"],
  "Lingyi iTech (Guangdong) Company": ["cn", "mechanical", "Precision parts"],
  "Lite-On Technology Corporation": ["tw", "passives", "Optoelectronics and power"],
  "Luen Fung Group": ["cn", "mechanical", "Metal parts"],
  "Lumentum Holdings Incorporated": ["us", "optics_laser", "Lasers and photonics"],
  "Lumileds Holding B.V.": ["nl", "ic_other", "LED"],
  "Luxshare Precision Industry Company Limited": ["cn", "assembly", "Connectors and assembly"],
  "LX Semicon Co., Ltd.": ["kr", "ic_other", "Display driver ICs"],
  "Marian Incorporated": ["us", "materials", "Converted materials"],
  "MicroChip Technology Incorporated": ["us", "foundry_idm", "Microcontroller IDM"],
  "Micron Technology Incorporated": ["us", "memory", "DRAM and NAND"],
  "MinebeaMitsumi Incorporated": ["jp", "passives", "Precision components and devices"],
  "Molex Incorporated": ["us", "passives", "Connectors"],
  "Murata Manufacturing Company Limited": ["jp", "passives", "MLCC and RF modules"],
  "Nanofilm Technologies International Private Limited": ["sg", "materials", "Vacuum coatings"],
  "Nan Ya PCB Corporation": ["tw", "substrates_pcb", "IC substrates and PCB"],
  "Nichia Corporation": ["jp", "ic_other", "LED and phosphors"],
  "Nidec Corporation": ["jp", "mechanical", "Motors"],
  "Nissha Company Limited": ["jp", "display_camera", "Touch sensors and decoration"],
  "Nitto Denko Corporation": ["jp", "materials", "Tapes, films, optical materials"],
  "NOK Corporation": ["jp", "materials", "Seals and flexible circuits"],
  "Nordic Semiconductor ASA": ["no", "ic_other", "Low-power wireless fabless"],
  "NXP Semiconductors N.V.": ["nl", "foundry_idm", "Automotive and secure-connectivity IDM"],
  "ON Semiconductor Corporation": ["us", "foundry_idm", "Power and sensing IDM"],
  "Paishing Technology Company": ["tw", "mechanical", "Precision parts"],
  "Parade Technologies Limited": ["tw", "ic_other", "Display interface fabless"],
  "Pegatron Corporation": ["tw", "assembly", "ODM"],
  "Phone In Mag-Electronics Company Limited": ["cn", "passives", "Magnetic components"],
  "Pioneer Material Precision Tech Company Limited": ["cn", "materials", "Precision materials"],
  "Platinum Optics Technology Incorporated": ["tw", "display_camera", "Optical filters"],
  "POSCO International": ["kr", "metals", "Steel and trading"],
  "Power Integrations Incorporated": ["us", "ic_other", "Power conversion fabless"],
  "Primax Electronics Limited": ["tw", "assembly", "Acoustic and peripheral ODM"],
  "Qorvo Incorporated": ["us", "ic_other", "RF front-end IDM"],
  "Quadrant Solutions": ["us", "materials", "Magnetic materials"],
  "Qualcomm Incorporated": ["us", "ic_other", "Mobile SoC and modem fabless"],
  "Quanta Computer Incorporated": ["tw", "assembly", "ODM; AI server assembly"],
  "R.R. Donnelley and Sons Company": ["us", "mechanical", "Printing and packaging"],
  "Radiant Opto-Electronics Corporation": ["tw", "display_camera", "Backlight modules"],
  "Renesas Electronics Corporation": ["jp", "foundry_idm", "MCU and analog IDM"],
  "Robert Bosch GmbH": ["de", "foundry_idm", "Automotive IDM and MEMS"],
  "Rohm Company Limited": ["jp", "foundry_idm", "Power and analog IDM"],
  "SABIC - Saudi Arabian Oil Company": ["sa", "materials", "Petrochemicals and polymers"],
  "Samsung Electro-Mechanics Company Limited": ["kr", "substrates_pcb", "Substrates, MLCC, camera modules"],
  "Samsung SDI Company Limited": ["kr", "mechanical", "Batteries"],
  "San'an Optoelectronics Co., Ltd.": ["cn", "ic_other", "Compound semiconductors and LED"],
  "Shandong Innovation Group": ["cn", "metals", "Aluminium"],
  "Shanghai Industrial Holdings Limited": ["cn", "materials", "Industrial materials"],
  "Sharp Corporation": ["jp", "display_camera", "Displays and camera modules"],
  "Shenzhen BSC technology Co., Ltd.": ["cn", "mechanical", "Precision components"],
  "Shenzhen Desay Battery Technology Company Limited": ["cn", "mechanical", "Battery packs"],
  "Shenzhen Everwin Precision Technology Company Limited": ["cn", "mechanical", "Precision structural parts"],
  "Shenzhen Forceblack Technology Co., Ltd": ["cn", "mechanical", "Components"],
  "Shenzhen Linkconn Electronics Co., Ltd.": ["cn", "passives", "Connectors"],
  "Shenzhen Sunway Communication Company Limited": ["cn", "passives", "Antennas and RF modules"],
  "Shenzhen YUTO Packaging Technology Company Limited": ["cn", "mechanical", "Packaging"],
  "Shin Zu Shing Company Limited": ["tw", "mechanical", "Hinges and precision metal"],
  "Simplo Technology Company Limited": ["tw", "mechanical", "Battery packs"],
  "SK hynix Incorporated": ["kr", "memory", "DRAM, NAND and HBM"],
  "Skyworks Solutions Incorporated": ["us", "ic_other", "RF front-end IDM"],
  "Solvay S.A.": ["be", "materials", "Specialty chemicals"],
  "Sony Corporation": ["jp", "ic_other", "CMOS image sensors"],
  "STMicroelectronics N.V.": ["ch", "foundry_idm", "Analog, MEMS and power IDM"],
  "Stora Enso Oyj": ["fi", "mechanical", "Paper and fibre packaging"],
  "Sumida Corporation": ["jp", "passives", "Inductors and coils"],
  "Sumitomo Chemical Company Limited": ["jp", "materials", "Photoresist and electronic chemicals"],
  "Sumitomo Electric Industries Limited": ["jp", "substrates_pcb", "Flexible circuits and compound substrates"],
  "Sunny Optical Technology Co., Ltd.": ["cn", "display_camera", "Lenses and camera modules"],
  "Sunrex Technology Corporation": ["tw", "mechanical", "Input devices"],
  "Sunwoda Electronic Company Limited": ["cn", "mechanical", "Battery packs"],
  "Suzhou Anjie Technology Company Limited": ["cn", "materials", "Functional materials"],
  "Suzhou Dongshan Precision Manufacturing Company Limited": ["cn", "substrates_pcb", "PCB and precision parts"],
  "Suzhou Zhongjiemai Panel Industry Technology Company Limited": ["cn", "display_camera", "Panel components"],
  "Synaptics Incorporated": ["us", "ic_other", "Touch and display fabless"],
  "Taiwan Hodaka Technology Company Limited": ["tw", "mechanical", "Precision parts"],
  "Taiwan Surface Mounting Technology Corporation": ["tw", "assembly", "SMT assembly"],
  "Taiyo Yuden Company Limited": ["jp", "passives", "MLCC and inductors"],
  "Tata Electronics": ["in", "assembly", "Assembly; building fab and OSAT capacity"],
  "TDK Corporation": ["jp", "passives", "Passives, sensors, batteries"],
  "Texas Instruments Incorporated": ["us", "foundry_idm", "Analog and embedded IDM"],
  "Tongda Group Holdings Limited": ["cn", "mechanical", "Structural parts"],
  "Toyoda Gosei Co., Limited": ["jp", "materials", "Polymers and LED"],
  "TPK Holding Company Limited": ["tw", "display_camera", "Touch panels"],
  "Trinseo S.A.": ["ie", "materials", "Polymers and latex"],
  "Tripod Technology Corporation": ["tw", "substrates_pcb", "PCB"],
  "Tsujiden Company Limited": ["jp", "display_camera", "Optical films"],
  "TXC Corporation": ["tw", "passives", "Crystal oscillators"],
  "Unimicron Technology Corporation": ["tw", "substrates_pcb", "ABF and IC substrates"],
  "Unisteel Technology Limited (SFS Group)": ["sg", "mechanical", "Precision fasteners"],
  "Unitech Printed Circuit Board Corporation": ["tw", "substrates_pcb", "PCB"],
  "United Test and Assembly Center Limited": ["sg", "osat_test", "OSAT"],
  "VARTA Microbattery GmbH": ["de", "mechanical", "Micro batteries"],
  "Viavi Solutions Incorporated": ["us", "optics_laser", "Optical filters and test"],
  "Western Digital Corporation": ["us", "memory", "NAND and storage"],
  "Winbond Electronics Corporation": ["tw", "memory", "Specialty DRAM and flash"],
  "Wingtech Technology Co., Ltd.": ["cn", "assembly", "ODM; owner of Nexperia"],
  "Wistron Corporation": ["tw", "assembly", "ODM"],
  "Yageo Corporation": ["tw", "passives", "Resistors and MLCC"],
  "Young Poong Corporation": ["kr", "metals", "Smelting and electronics"],
  "Zhejiang Tony Electronic Co., Ltd.": ["cn", "passives", "Electronic components"],
  "Zhen Ding Technology Holding Limited": ["tw", "substrates_pcb", "Flexible PCB and substrates"],
  "Zhenghe Group": ["cn", "mechanical", "Structural parts"],
  "Zhuhai CosMX Battery Co., Ltd.": ["cn", "mechanical", "Lithium batteries"],

  /* --- named by TSMC and/or Intel, not on Apple's list --- */
  "ABB Ltd.": ["ch", "construction", "Electrification and automation"],
  "ADVANTEST CORPORATION": ["jp", "equipment", "Automated test equipment"],
  "AEM Holdings Ltd.": ["sg", "equipment", "Test handling and burn-in"],
  "All Ring Tech Co., Ltd.": ["tw", "equipment", "Automation equipment"],
  "Applied Materials, Inc.": ["us", "equipment", "Deposition, etch, CMP, metrology"],
  "ASM International N.V.": ["nl", "equipment", "ALD and epitaxy"],
  "ASMPT Limited": ["hk", "equipment", "Back-end assembly and packaging equipment"],
  "Austin Commercial, LP.": ["us", "construction", "Fab construction"],
  "Bechtel": ["us", "construction", "Engineering and construction"],
  "Brewer Science, Inc.": ["us", "materials", "Lithography and bonding materials"],
  "Camtek": ["il", "equipment", "Inspection and metrology"],
  "Canon Inc.": ["jp", "equipment", "Lithography and packaging equipment"],
  "C-HAWK Technology Intl, Inc.": ["tw", "metals", "High-precision plastic parts"],
  "Chang Chun Petrochemical Co., Ltd.": ["tw", "materials", "Electronic chemicals and copper foil"],
  "China Steel Structure Co., Ltd.": ["tw", "construction", "Steel structures"],
  "Compass Group USA": ["us", "services", "Food services"],
  "CSUN / G2C+ Alliance": ["tw", "construction", "Construction alliance"],
  "DACIN Construction Co., Ltd.": ["tw", "construction", "Fab construction"],
  "Daewon Semiconductor Packaging Industrial Co., Ltd.": ["kr", "osat_test", "Packaging materials and services"],
  "Daifuku Co., Ltd.": ["jp", "equipment", "Fab automation and material handling"],
  "Deloitte Touche Tohmatsu Limited": ["uk", "services", "Professional services"],
  "DISCO Corporation": ["jp", "equipment", "Dicing, grinding, polishing"],
  "DS TECHNO CO., LTD.": ["kr", "metals", "Quartz parts"],
  "DSV Global Transport and Logistics": ["dk", "services", "Logistics"],
  "EBARA CORPORATION": ["jp", "equipment", "CMP and vacuum pumps"],
  "EKK EAGLE AMERICA, INC.": ["jp", "metals", "O-rings and seals"],
  "FormFactor, Incorporated": ["us", "equipment", "Probe cards and test"],
  "Fu Tsu Construction Co., Ltd.": ["tw", "construction", "Fab construction"],
  "FUJIMI INCORPORATED": ["jp", "materials", "CMP slurries and abrasives"],
  "GCON, Inc.": ["us", "construction", "Construction"],
  "GIGAPHOTON, INC.": ["jp", "optics_laser", "Excimer light sources"],
  "GOLD STONE DEVELOPMENT CO., LTD.": ["tw", "construction", "Fab construction"],
  "HCLTech": ["in", "services", "Engineering and IT services"],
  "Hitachi High-Tech Corporation": ["jp", "equipment", "Etch and metrology"],
  "HSINGMIEN INDUSTRY CO.,LTD.": ["tw", "metals", "Industrial supply"],
  "Jentech Precision Industrial Co., Ltd": ["tw", "metals", "Precision fab parts"],
  "JiangXi Redboard Technology Co., Ltd.": ["cn", "substrates_pcb", "PCB"],
  "JLL": ["us", "services", "Facilities management"],
  "JSR Corporation": ["jp", "materials", "Photoresists"],
  "JX Advanced Metals Corporation": ["jp", "metals", "Sputtering targets and high-purity metals"],
  "Kedge Construction Co., Ltd.": ["tw", "construction", "Fab construction"],
  "KellyOCG": ["us", "services", "Workforce solutions"],
  "Keysight Technologies, Inc.": ["us", "equipment", "Test and measurement"],
  "KLA Corporation": ["us", "equipment", "Process control, inspection, metrology"],
  "KOKUSAI ELECTRIC CORPORATION": ["jp", "equipment", "Thermal processing and ALD"],
  "Lam Research Corporation": ["us", "equipment", "Etch and deposition"],
  "Lasertec Corporation": ["jp", "equipment", "EUV mask inspection"],
  "LCY Group": ["tw", "materials", "Electronic chemicals and solvents"],
  "LEE MING Construction Co.LTD": ["tw", "construction", "Construction"],
  "Marketech International Corp.": ["tw", "construction", "Fab systems integration"],
  "Merck": ["de", "materials", "Electronic materials"],
  "ModusLink Corporation": ["us", "services", "Supply-chain services"],
  "Moses Lake Industries, Inc. (TAMA Chemicals)": ["us", "materials", "High-purity process chemicals"],
  "MSR-FSR LLC": ["us", "metals", "Parts cleaning and refurbishment"],
  "Murata Machinery, Ltd.": ["jp", "equipment", "Fab automation and material handling"],
  "NAMICS CORPORATION": ["jp", "materials", "Underfills and encapsulants"],
  "Nikon Corporation": ["jp", "equipment", "Lithography and metrology"],
  "Nova Ltd.": ["il", "equipment", "Metrology"],
  "NTS Group": ["nl", "equipment", "High-precision mechatronic modules"],
  "NuFlare Technology, Inc.": ["jp", "photomask", "Mask writers"],
  "Onto Innovation Inc.": ["us", "equipment", "Inspection and metrology"],
  "Organo Technology Co., Ltd.": ["jp", "construction", "Ultrapure water systems"],
  "RETECH ENVIRONMENTAL SOLUTIONS CO., LTD.": ["tw", "construction", "Environmental and abatement"],
  "Resonac Corporation": ["jp", "materials", "Packaging materials and specialty chemicals"],
  "Saigon Fabrication Ltd": ["vn", "metals", "Fabricated parts"],
  "Scientech Corporation": ["tw", "equipment", "Equipment and parts supply"],
  "SCREEN Semiconductor Solutions Co., Ltd.": ["jp", "equipment", "Cleaning and coat/develop"],
  "Securitas USA, Inc.": ["se", "services", "Site security"],
  "Senju Metal Industry Co., Ltd.": ["jp", "materials", "Solder materials"],
  "SHIBAURA MECHATRONICS CORPORATION": ["jp", "equipment", "Cleaning and vacuum equipment"],
  "Shin-Etsu Chemical Co., Ltd.": ["jp", "materials", "Photoresist, silicones, rare earths; parent of SEH"],
  "Shin-Etsu Handotai Co., Ltd.": ["jp", "wafers", "Silicon wafers — largest supplier"],
  "Shiny Chemical Industrial Co.": ["tw", "materials", "Electronic-grade solvents"],
  "Siliconware Precision Industries Co., Ltd.": ["tw", "osat_test", "OSAT; ASE subsidiary"],
  "SUMCO CORPORATION": ["jp", "wafers", "Silicon wafers"],
  "Sunlit": ["tw", "metals", "Industrial materials"],
  "Taiwan Pulp and Paper Corporation": ["tw", "mechanical", "Industrial paper"],
  "Taiwan Puritic Corp.": ["tw", "construction", "Cleanroom and purity systems"],
  "TASA Construction Corporation": ["tw", "construction", "Fab construction"],
  "Technoprobe S.p.A": ["it", "equipment", "Probe cards"],
  "Tessolve Semiconductor Private Limited": ["in", "osat_test", "Test and packaging engineering"],
  "The PEER Group Inc.": ["ca", "services", "Fab control software"],
  "TKG Solmics Co., Ltd.": ["kr", "metals", "Silicon and ceramic fab parts"],
  "Tokyo Electron Limited": ["jp", "equipment", "Coat/develop, etch, deposition"],
  "Tokyo Ohka Kogyo Co., Ltd.": ["jp", "materials", "Photoresists"],
  "TOPCO QUARTZ PRODUCTS CO., LTD.": ["tw", "metals", "Quartz parts"],
  "Tosoh Quartz, Inc.": ["jp", "metals", "Quartz parts"],
  "Tosoh SMD, Inc.": ["jp", "metals", "Sputtering targets"],
  "TRUMPF": ["de", "optics_laser", "EUV drive laser"],
  "TUNG KANG STEEL STRUCTURE CORP": ["tw", "construction", "Steel structures"],
  "ULVAC, Inc.": ["jp", "equipment", "Vacuum and deposition"],
  "Ultra Clean Holdings, Inc.": ["us", "equipment", "Subsystems and parts cleaning"],
  "United Integrated Services Co., Ltd.": ["tw", "construction", "Cleanroom and fab engineering"],
  "United Microelectronics Corporation": ["tw", "foundry_idm", "Mature-node foundry"],
  "U.P.Pro": ["us", "services", "Vendor-managed inventory"],
  "UST": ["us", "services", "Engineering services"],
  "V5 TECHNOLOGIES CO., LTD.": ["tw", "metals", "Fab parts and materials"],
  "Valex Corp.": ["us", "metals", "High-purity gas tubing"],
  "Veeco Instruments Inc.": ["us", "equipment", "Anneal, deposition, lithography"],
  "Veolia North America": ["fr", "construction", "Water and waste treatment"],
  "Wipro Limited": ["in", "services", "Engineering and IT services"],
  "Wonik QnC": ["kr", "metals", "Quartz parts"],
  "Zeiss Semiconductor Manufacturing Technology (Carl Zeiss SMT GmbH)": ["de", "optics_laser", "EUV and DUV optics — ASML's sole optics supplier"],
  "FUJIFILM Holdings Corporation": ["jp", "materials", "Photoresists and electronic materials"],

  /* --- named by Lam Research, a third documented step upstream ---
     Lam's release gives an award category and never a product, so every
     role below says so rather than filling the gap with a guess. */
  "Celestica Electronics SDN. BHD": ["ca", "equipment", "Named by Lam Research for operational execution; the source does not state what it supplies"],
  "Texon Co. Ltd": ["zz", "equipment", "Named by Lam Research for operational execution; the source does not state what it supplies"],
  "TOTO Ltd.": ["jp", "equipment", "Named by Lam Research for ESG performance; the source does not state what it supplies"],
  "Easys s.r.o.": ["cz", "equipment", "Named by Lam Research for quality; the source does not state what it supplies"],
  "CryoWest, Inc.": ["us", "equipment", "Named by Lam Research for rapid prototype materials; the source does not state what it supplies"],
  "Venture Corporation Limited": ["sg", "equipment", "Named by Lam Research for rapid prototype materials; the source does not state what it supplies"],
  "INFICON AG": ["ch", "equipment", "Named by Lam Research for new product introduction; the source does not state what it supplies"],
  "TOKAI CARBON KOREA": ["kr", "equipment", "Named by Lam Research for new product introduction; the source does not state what it supplies"],
  "Times Microwave Systems, Inc., an Amphenol Company": ["us", "equipment", "Named by Lam Research for new product introduction; the source does not state what it supplies"],
};

/* ---------------------------------------------------------------- *
 * 4. Aliases. The same firm is printed differently by different
 *    publishers; the graph must not split it into two nodes.
 * ---------------------------------------------------------------- */
const ALIASES = {
  ASML: "ASML Holding N.V.",
  "ASM": "ASM International N.V.",
  "Applied Materials": "Applied Materials, Inc.",
  "All RING TECH Co.,Ltd.": "All Ring Tech Co., Ltd.",
  "DACIN Construction Co ., Ltd.": "DACIN Construction Co., Ltd.",
  "DACIN CONSTRUCTION CO.,LTD": "DACIN Construction Co., Ltd.",
  "JENTECH PRECISION INDUSTRIAL CO., LTD": "Jentech Precision Industrial Co., Ltd",
  "KOKUSAI ELECTRIC": "KOKUSAI ELECTRIC CORPORATION",
  "Lam Research Corp.": "Lam Research Corporation",
  "MURATA MACHINERY, LTD.": "Murata Machinery, Ltd.",
  "Murata Machinery, LTD.": "Murata Machinery, Ltd.",
  "TOKYO ELECTRON LIMITED": "Tokyo Electron Limited",
  "TOKYO OHKA KOGYO CO., LTD.": "Tokyo Ohka Kogyo Co., Ltd.",
  "Tokyo Ohka Kogyo Co.": "Tokyo Ohka Kogyo Co., Ltd.",
  "NAMICS Corporation": "NAMICS CORPORATION",
  "ASAHI KASEI CORPORATION": "Asahi Kasei Corporation",
  "Jiangxi Redboard Technology Co., Ltd.": "JiangXi Redboard Technology Co., Ltd.",
  "JX Metals Corporation": "JX Advanced Metals Corporation",
  "HCL Technologies Ltd.": "HCLTech",
  "Taiwan Semiconductor Manufacturing Company, Ltd (TSMC)":
    "Taiwan Semiconductor Manufacturing Company Limited",
  "Unimicron Technology Corp.": "Unimicron Technology Corporation",
  "Technoprobe": "Technoprobe S.p.A",
  "Tokyo Electron Limited – Outstanding with Sustainability Distinction": "Tokyo Electron Limited",
  "JLL – Distinguished with Safety Distinction": "JLL",
  "Nikon Corporation – Distinguished with Safety Distinction": "Nikon Corporation",
  "Daewon Semiconductor Packaging Industrial Co., Ltd. – Innovation":
    "Daewon Semiconductor Packaging Industrial Co., Ltd.",
  "GCON, Inc. – Quality": "GCON, Inc.",
  "Hitachi High-Tech Corporation – Technology": "Hitachi High-Tech Corporation",
  "KellyOCG – Supplier Diversity": "KellyOCG",
  "Keysight Technologies, Inc. – Technology": "Keysight Technologies, Inc.",
  "Infineon Technologies": "Infineon Technologies AG",
  "Siliconware Precision Industries Co., Ltd": "Siliconware Precision Industries Co., Ltd.",
};

// Asahi Kasei is named by TSMC but is not on Apple's list.
C["Asahi Kasei Corporation"] = ["jp", "materials", "Advanced packaging materials and chemicals"];

/* ---------------------------------------------------------------- *
 * 5. The relationships, grouped by the document that establishes them.
 * ---------------------------------------------------------------- */

// TSMC award lists: [supplier, award citation]
const TSMC_AWARDS = {
  "tsmc-scm-2026": [
    ["ABB Ltd.", "Excellence in Construction Safety"],
    ["ADVANTEST CORPORATION", "Excellent Production Support"],
    ["All Ring Tech Co., Ltd.", "Excellent Production Support"],
    ["Applied Materials, Inc.", "Excellent Technology and Production Support"],
    ["ASM International N.V.", "Excellent Production Support and Excellence in Green Manufacturing"],
    ["ASML", "Excellent Technology and Production Support and Excellent Globalization Support"],
    ["Austin Commercial, LP.", "Excellence in Construction Safety"],
    ["DACIN Construction Co ., Ltd.", "Excellence in Fab Construction"],
    ["Daifuku Co., Ltd.", "Excellence in Fab Automation"],
    ["DISCO Corporation", "Excellent Production Support"],
    ["EBARA CORPORATION", "Excellent Production Support"],
    ["FUJIMI INCORPORATED", "Excellent Technology and Production Support"],
    ["GOLD STONE DEVELOPMENT CO., LTD.", "Excellence in Fab Construction"],
    ["Jentech Precision Industrial Co., Ltd", "Excellent Production Support"],
    ["JX Advanced Metals Corporation", "Excellent Production Support"],
    ["Kedge Construction Co., Ltd.", "Excellence in Fab Construction"],
    ["KLA Corporation", "Excellent Technology and Production Support and Excellence in Green Manufacturing"],
    ["Lam Research Corporation", "Excellent Technology and Production Support and Excellent Globalization Support"],
    ["Lasertec Corporation", "Excellent Production Support"],
    ["LEE MING Construction Co.LTD", "Excellence in Construction Safety"],
    ["NAMICS CORPORATION", "Excellent Production Support"],
    ["Pegatron Corporation", "Excellent IT Service"],
    ["Resonac Corporation", "Excellent Production Support"],
    ["RETECH ENVIRONMENTAL SOLUTIONS CO., LTD.", "Excellence in Green Manufacturing"],
    ["SCREEN Semiconductor Solutions Co., Ltd.", "Excellent Production Support"],
    ["Shin-Etsu Handotai Co., Ltd.", "Excellent Technology and Production Support"],
    ["Shiny Chemical Industrial Co.", "Excellence in Green Manufacturing"],
    ["Siliconware Precision Industries Co., Ltd.", "Excellent Turnkey Production Support"],
    ["SUMCO CORPORATION", "Excellent Production Support"],
    ["Taiwan Pulp and Paper Corporation", "Excellent Production Support"],
    ["Taiwan Puritic Corp.", "Excellence in Fab Construction"],
    ["Tokyo Electron Limited", "Excellent Production Support"],
    ["Tokyo Ohka Kogyo Co.", "Excellent Technology and Production Support and Excellent Globalization Support"],
    ["United Integrated Services Co., Ltd.", "Excellent Globalization Support"],
    ["V5 TECHNOLOGIES CO., LTD.", "Excellent Production Support"],
  ],
  "tsmc-scm-2025": [
    ["ADVANTEST CORPORATION", "Excellent Production Support"],
    ["All RING TECH Co.,Ltd.", "Excellent Production Support"],
    ["Applied Materials, Inc.", "Excellent Contribution in Green Manufacturing and Excellent Technology Development and Production Support"],
    ["ASAHI KASEI CORPORATION", "Excellent Technology Development and Production Support"],
    ["ASML", "Excellent Contribution in Green Manufacturing and Excellent Production Support"],
    ["Austin Commercial, LP.", "Excellence in New Fab Construction"],
    ["Canon Inc.", "Excellent Production Support"],
    ["Chang Chun Petrochemical Co., Ltd.", "Excellent Production Support"],
    ["China Steel Structure Co., Ltd.", "Excellence in New Fab Construction"],
    ["CSUN / G2C+ Alliance", "Excellent Production Support"],
    ["DISCO Corporation", "Excellent Production Support"],
    ["EBARA CORPORATION", "Excellent Production Support"],
    ["Fu Tsu Construction Co., Ltd.", "Excellence in New Fab Construction"],
    ["JENTECH PRECISION INDUSTRIAL CO., LTD", "Excellent Production Support"],
    ["JSR Corporation", "Excellent Technology Development and Production Support"],
    ["KLA Corporation", "Excellent Production Support"],
    ["KOKUSAI ELECTRIC", "Excellent Production Support"],
    ["Lam Research Corporation", "Excellent Technology Development and Production Support"],
    ["Marketech International Corp.", "Excellent Safety Performance in New Fab Construction"],
    ["Merck", "Excellent Contribution in Green Manufacturing"],
    ["Murata Machinery, LTD.", "Excellence in New Fab Automation"],
    ["Onto Innovation Inc.", "Excellent Production Support"],
    ["Resonac Corporation", "Excellent Technology Development and Production Support"],
    ["SCREEN Semiconductor Solutions Co., Ltd.", "Excellent Production Support"],
    ["Shin-Etsu Handotai Co., Ltd.", "Excellent Technology Development and Production Support"],
    ["SUMCO CORPORATION", "Excellent Contribution in Green Manufacturing and Excellent Production Support"],
    ["Sunlit", "Excellent Production Support"],
    ["Taiwan Puritic Corp.", "Excellence in New Fab Construction"],
    ["TASA Construction Corporation", "Excellent Safety Performance in New Fab Construction"],
    ["ULVAC, Inc.", "Excellent Production Support"],
  ],
  "tsmc-scm-2024": [
    ["Applied Materials, Inc.", "Excellent Technology Collaboration"],
    ["ASAHI KASEI CORPORATION", "Excellent Technology Collaboration and Production Support in Advanced Packaging"],
    ["ASM International N.V.", "Excellent Production Support"],
    ["ASML", "Excellent Production Support"],
    ["Canon Inc.", "Excellent Production Support in Advanced Packaging"],
    ["DACIN CONSTRUCTION CO.,LTD", "Excellent Performance in New Fab Construction"],
    ["DISCO Corporation", "Excellent Production Support in Advanced Packaging"],
    ["HSINGMIEN INDUSTRY CO.,LTD.", "Excellent Production Support"],
    ["JX Advanced Metals Corporation", "Excellent Technology Collaboration and Production Support"],
    ["KLA Corporation", "Excellent Technology Collaboration and Production Support"],
    ["Lam Research Corporation", "Excellent Contribution in Green Manufacturing and Excellent Technology Collaboration and Production Support"],
    ["LCY Group", "Excellent Contribution in Green Manufacturing"],
    ["MURATA MACHINERY, LTD.", "Excellent Performance in Fab Automation"],
    ["NAMICS CORPORATION", "Excellent Technology Collaboration and Production Support in Advanced Packaging"],
    ["NuFlare Technology, Inc.", "Distinguished Mask Writer Collaboration"],
    ["Organo Technology Co., Ltd.", "Excellent Performance in New Fab Construction"],
    ["Scientech Corporation", "Excellent Production Support in Advanced Packaging"],
    ["SCREEN Semiconductor Solutions Co., Ltd.", "Excellent Contribution in Green Manufacturing and Excellent Production Support"],
    ["SHIBAURA MECHATRONICS CORPORATION", "Excellent Production Support in Advanced Packaging"],
    ["Shin-Etsu Chemical Co., Ltd.", "Excellent Production Support"],
    ["SUMCO CORPORATION", "Excellent Production Support"],
    ["Technoprobe S.p.A", "Excellent Production Support"],
    ["TOKYO ELECTRON LIMITED", "Excellent Technology Collaboration and Production Support"],
    ["TOKYO OHKA KOGYO CO., LTD.", "Novel Technology Collaboration"],
    ["TOPCO QUARTZ PRODUCTS CO., LTD.", "Excellent Production Support"],
    ["TUNG KANG STEEL STRUCTURE CORP", "Excellent Performance in New Fab Construction"],
    ["United Integrated Services Co., Ltd.", "Excellent Performance in New Fab Construction"],
  ],
};

// Intel EPIC lists: [supplier, award class, citation]
const INTEL_AWARDS = {
  "intel-epic-2026": [
    ["AEM Holdings Ltd.", "EPIC", "Excellence in Business Enablement"],
    ["AGC Incorporated", "EPIC", "Excellence in Technology Partnership on EUV Mask Blanks"],
    ["Applied Materials", "EPIC", "Excellence in Technology Development"],
    ["ASM", "EPIC", "Excellence in Technology Development"],
    ["ASML", "EPIC", "Excellence in Business Enablement"],
    ["ASMPT Limited", "EPIC", "Excellence in Business Collaboration"],
    ["Bechtel", "EPIC", "Excellence in Construction Management"],
    ["Camtek", "EPIC", "Excellence in Business Enablement"],
    ["C-HAWK Technology Intl, Inc.", "EPIC", "Excellence in Alternate Source HVM Plastic Parts Supply"],
    ["Deloitte Touche Tohmatsu Limited", "EPIC", "Excellence in ERP Implementation & Operations Enablement"],
    ["DISCO Corporation", "EPIC", "Excellence in Technology Development and Sustainability"],
    ["DS TECHNO CO., LTD.", "EPIC", "Excellence in Quartz Parts Cost and Performance"],
    ["EKK EAGLE AMERICA, INC.", "EPIC", "Excellence in O-Ring/Seal Cost, Technology Leadership and Manufacturing"],
    ["FormFactor, Incorporated", "EPIC", "Excellence in Sort Test Development"],
    ["HCLTech", "EPIC", "Excellence in Strategic 360 Collaboration for Product Engineering Services"],
    ["Infineon Technologies", "EPIC", "Excellence in Platform Power Management Solutions for Server, AI, Client, Network, and Graphics Products"],
    ["JiangXi Redboard Technology Co., Ltd.", "EPIC", "Excellence in Quality and Supply Flexibility"],
    ["KLA Corporation", "EPIC", "Excellence in Technology Development"],
    ["KOKUSAI ELECTRIC CORPORATION", "EPIC", "Excellence in Local R&D Investment to Enable Next Generation Diffusion Technology"],
    ["Lam Research Corp.", "EPIC", "Excellence in Sustainability Support"],
    ["Lasertec Corporation", "EPIC", "Excellence in EUV Mask Technology Development"],
    ["ModusLink Corporation", "EPIC", "Excellence in Strategic Partnership"],
    ["MSR-FSR LLC", "EPIC", "Excellence in Parts Clean Technology and Cost"],
    ["Murata Machinery, Ltd.", "EPIC", "Excellence in Manufacturing Automation"],
    ["NAMICS Corporation", "EPIC", "Excellence in Underfill Development"],
    ["Nova Ltd.", "EPIC", "Excellence in Integrated CMP Metrology Solutions"],
    ["Saigon Fabrication Ltd", "EPIC", "Excellence in Manufacturing, Cost and Local for Local"],
    ["Securitas USA, Inc.", "EPIC", "Excellence in Site Support Services"],
    ["Senju Metal Industry Co., Ltd.", "EPIC", "Excellence in Solder Materials Development"],
    ["Siliconware Precision Industries Co., Ltd.", "EPIC", "Excellence in Delivery and Cycle Time"],
    ["Tessolve Semiconductor Private Limited", "EPIC", "Excellence in Advanced Packaging and Post-Silicon Test"],
    ["TKG Solmics Co., Ltd.", "EPIC", "Excellence in Silicon Parts, Cost, Quality and Technology"],
    ["Tokyo Electron Limited", "EPIC", "Excellence in Technology Development and Sustainability"],
    ["Tosoh Quartz, Inc.", "EPIC", "Excellence in Quartz Parts Quality, Technology and Availability"],
    ["Ultra Clean Holdings, Inc.", "EPIC", "Excellence in Parts Clean Cost, Quality and Delivery Performance"],
    ["United Microelectronics Corporation", "EPIC", "Excellence in Quality Management"],
    ["U.P.Pro", "EPIC", "Excellence in VMI Cost and Operational Performance"],
    ["UST", "EPIC", "Excellence in Engineering Services Quality and Lab Readiness"],
    ["Veeco Instruments Inc.", "EPIC", "Excellence in Anneal Technology"],
    ["Wipro Limited", "EPIC", "Excellence in Engineering Services Quality and Go-to-Market Enablement"],
    ["Wonik QnC", "EPIC", "Excellence in Quartz Parts Quality, Technology, Availability and Cost"],
  ],
  "intel-epic-2024": [
    ["ASM", "Outstanding", "Outstanding Supplier Award"],
    ["HCL Technologies Ltd.", "Outstanding", "Outstanding Supplier Award"],
    ["Securitas USA, Inc.", "Outstanding", "Outstanding Supplier Award"],
    ["Senju Metal Industry Co., Ltd.", "Outstanding", "Outstanding Supplier Award"],
    ["Taiwan Semiconductor Manufacturing Company, Ltd (TSMC)", "Outstanding", "Outstanding Supplier Award"],
    ["Tokyo Electron Limited – Outstanding with Sustainability Distinction", "Outstanding", "Outstanding with Sustainability Distinction"],
    ["AGC Incorporated", "Distinguished", "Distinguished Supplier Award"],
    ["Applied Materials, Inc.", "Distinguished", "Distinguished Supplier Award"],
    ["ASML", "Distinguished", "Distinguished Supplier Award"],
    ["Brewer Science, Inc.", "Distinguished", "Distinguished Supplier Award"],
    ["Compass Group USA", "Distinguished", "Distinguished Supplier Award"],
    ["DSV Global Transport and Logistics", "Distinguished", "Distinguished Supplier Award"],
    ["FormFactor, Incorporated", "Distinguished", "Distinguished Supplier Award"],
    ["GIGAPHOTON, INC.", "Distinguished", "Distinguished Supplier Award"],
    ["JLL – Distinguished with Safety Distinction", "Distinguished", "Distinguished with Safety Distinction"],
    ["JX Metals Corporation", "Distinguished", "Distinguished Supplier Award"],
    ["KLA Corporation", "Distinguished", "Distinguished Supplier Award"],
    ["KOKUSAI ELECTRIC CORPORATION", "Distinguished", "Distinguished Supplier Award"],
    ["Lam Research Corporation", "Distinguished", "Distinguished Supplier Award"],
    ["Lasertec Corporation", "Distinguished", "Distinguished Supplier Award"],
    ["Murata Machinery, Ltd.", "Distinguished", "Distinguished Supplier Award"],
    ["NAMICS Corporation", "Distinguished", "Distinguished Supplier Award"],
    ["Nikon Corporation – Distinguished with Safety Distinction", "Distinguished", "Distinguished with Safety Distinction"],
    ["Jiangxi Redboard Technology Co., Ltd.", "Distinguished", "Distinguished Supplier Award"],
    ["Shin-Etsu Chemical Co., Ltd.", "Distinguished", "Distinguished Supplier Award"],
    ["Siliconware Precision Industries Co., Ltd.", "Distinguished", "Distinguished Supplier Award"],
    ["Moses Lake Industries, Inc. (TAMA Chemicals)", "Distinguished", "Distinguished Supplier Award"],
    ["Technoprobe", "Distinguished", "Distinguished Supplier Award"],
    ["The PEER Group Inc.", "Distinguished", "Distinguished Supplier Award"],
    ["Tosoh Quartz, Inc.", "Distinguished", "Distinguished Supplier Award"],
    ["Tosoh SMD, Inc.", "Distinguished", "Distinguished Supplier Award"],
    ["Ultra Clean Holdings, Inc.", "Distinguished", "Distinguished Supplier Award"],
    ["Unimicron Technology Corp.", "Distinguished", "Distinguished Supplier Award"],
    ["Valex Corp.", "Distinguished", "Distinguished Supplier Award"],
    ["Veolia North America", "Distinguished", "Distinguished Supplier Award"],
    ["Daewon Semiconductor Packaging Industrial Co., Ltd. – Innovation", "Valued", "Valued Supplier Award — Innovation"],
    ["GCON, Inc. – Quality", "Valued", "Valued Supplier Award — Quality"],
    ["Hitachi High-Tech Corporation – Technology", "Valued", "Valued Supplier Award — Technology"],
    ["KellyOCG – Supplier Diversity", "Valued", "Valued Supplier Award — Supplier Diversity"],
    ["Keysight Technologies, Inc. – Technology", "Valued", "Valued Supplier Award — Technology"],
  ],
};

/* Lam Research's own award list: [supplier, award category]. The release
   states the category and not the product, so the edge carries the
   category and says nothing about what moves. */
const LAM_AWARDS_2024 = [
  ["Celestica Electronics SDN. BHD", "Excellence in Operational Execution (No Demand Unmet) Award"],
  ["Texon Co. Ltd", "Excellence in Operational Execution (No Demand Unmet) Award"],
  ["TOTO Ltd.", "Environmental, Social and Governance (ESG) Excellence Award"],
  ["Easys s.r.o.", "Excellence in Quality Award"],
  ["CryoWest, Inc.", "Rapid Prototype Materials Performance Award"],
  ["Venture Corporation Limited", "Rapid Prototype Materials Performance Award"],
  ["INFICON AG", "New Product Introduction Performance Award"],
  ["TOKAI CARBON KOREA", "New Product Introduction Performance Award"],
  ["Times Microwave Systems, Inc., an Amphenol Company", "New Product Introduction Performance Award"],
];

// Everything else, written out one relationship at a time.
const OTHER_EDGES = [
  {
    supplier: "Zeiss Semiconductor Manufacturing Technology (Carl Zeiss SMT GmbH)",
    customer: "ASML Holding N.V.",
    product: "Lenses, mirrors, collectors and other optical components — sole source",
    sources: ["asml-20f-2014", "asml-20f-2024"],
    year: 2014,
    detail:
      "ASML's own filing calls Zeiss its single supplier of these components and puts Zeiss at 27.4% of aggregate cost of sales in 2014. The single-source structure, not the dated percentage, is what this edge records.",
  },
  {
    supplier: "TRUMPF",
    customer: "ASML Holding N.V.",
    product: "EUV high-energy drive laser",
    sources: ["trumpf-asml-2025"],
    year: 2025,
    detail: 'ASML Supplier Award 2025, "Technology" category, for the laser driving the next EUV generation.',
  },
  {
    supplier: "NTS Group",
    customer: "ASML Holding N.V.",
    product: "High-precision mechatronic production",
    sources: ["nts-asml-2025"],
    year: 2025,
    detail: 'ASML Supplier Award 2025, "Cost" category. The specific module is not named by the source.',
  },
  {
    supplier: "FUJIFILM Holdings Corporation",
    customer: "Samsung Electronics Company Limited",
    product: "Advanced semiconductor materials",
    sources: ["fujifilm-samsung-2025"],
    year: 2025,
    detail:
      'Samsung "Most Valuable Partner Award" at Material Day 2025. Fujifilm says 14 firms were honoured but names only itself, so the other 13 edges cannot be drawn.',
  },
  {
    supplier: "Semiconductor Manufacturing International Corporation",
    customer: "HiSilicon Technologies Co., Ltd.",
    product: "7nm-class logic (N+2) — Kirin 9000s",
    sources: ["techinsights-smic-n2", "techinsights-smic-7nm-card"],
    year: 2023,
    detail:
      "Established by die analysis, not by disclosure. Neither party has confirmed it. This is the only kind of evidence left once export controls make the relationship unspeakable for both sides.",
  },
  {
    supplier: "HiSilicon Technologies Co., Ltd.",
    customer: "Huawei Technologies Co., Ltd.",
    product: "In-house SoC design (Kirin, Kunpeng, Ascend)",
    sources: ["fr-huawei-2020-08"],
    year: 2020,
    detail:
      "Affiliation established by the U.S. rule that added Huawei's non-U.S. affiliates, HiSilicon among them, to the Entity List.",
  },
];

/* ---------------------------------------------------------------- *
 * 6. Focal buyers — tier 0. Tier is derived from these at build time.
 * ---------------------------------------------------------------- */
const FOCAL = ["Apple Inc.", "Huawei Technologies Co., Ltd."];

/* ---------------------------------------------------------------- *
 * 7. Policy annotations — facts about a firm, not edges.
 * ---------------------------------------------------------------- */
const ANNOTATIONS = {
  "Huawei Technologies Co., Ltd.": [
    {
      text: "On the U.S. Entity List since 2019; the May 2020 foreign-produced direct product rule cut off foundry access for its designs.",
      sources: ["fr-fdpr-2020-05", "fr-huawei-2020-08"],
    },
  ],
  "Semiconductor Manufacturing International Corporation": [
    {
      text: "Added to the U.S. Entity List in December 2020 under the military-civil fusion rationale.",
      sources: ["fr-huawei-2020-08"],
    },
  ],
  "ASML Holding N.V.": [
    {
      text: "Berliner Glas, which makes wafer tables and clamps, reticle chucks and mirror blocks, was acquired by ASML in November 2020 — an upstream supplier internalised rather than an arm's-length one.",
      sources: ["asml-berlin"],
    },
  ],
  "Taiwan Semiconductor Manufacturing Company Limited": [
    {
      text: "Reports one customer at 22% of 2024 net revenue, and its top ten at about 76%, without naming any of them. The concentration is disclosed; the identities are not.",
      sources: ["tsmc-ar-2024-customers", "tsmc-ar-2024-risk"],
    },
  ],
};

/* ================================================================ *
 * Build
 * ================================================================ */

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const problems = [];
const resolve = (raw) => {
  const name = ALIASES[raw] ?? raw;
  if (!C[name]) problems.push(`no registry entry for ${JSON.stringify(raw)}${ALIASES[raw] ? ` (alias of ${JSON.stringify(name)})` : ""}`);
  return name;
};

/* Apple's tier 1 comes straight out of the extracted PDF text, so the
   layer nearest the buyer is machine-derived rather than curated. */
const appleRaw = readFileSync(join(DATA, "raw-apple-supplier-list-fy2023.txt"), "utf8")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const edges = [];
const push = (supplier, customer, product, sources, year, detail) => {
  const s = resolve(supplier);
  const c = resolve(customer);
  const key = `${slug(s)}->${slug(c)}`;
  const existing = edges.find((e) => e.key === key);
  if (existing) {
    // Same pair named by more than one document: merge rather than duplicate.
    for (const id of sources) if (!existing.sources.includes(id)) existing.sources.push(id);
    if (product && !existing.products.includes(product)) existing.products.push(product);
    existing.years = [...new Set([...existing.years, year])].sort();
    if (detail && !existing.details.includes(detail)) existing.details.push(detail);
    return;
  }
  edges.push({
    key,
    supplier: slug(s),
    customer: slug(c),
    products: product ? [product] : [],
    sources: [...sources],
    years: [year],
    details: detail ? [detail] : [],
  });
};

for (const raw of appleRaw) {
  push(raw, "Apple Inc.", "Named in Apple's supplier list for direct materials, manufacturing or assembly", ["apple-sl-fy2023"], 2023);
}
for (const [sourceId, rows] of Object.entries(TSMC_AWARDS)) {
  const year = Number(SOURCES[sourceId].published.slice(0, 4));
  for (const [supplier, citation] of rows) {
    push(supplier, "Taiwan Semiconductor Manufacturing Company Limited", citation, [sourceId], year);
  }
}
for (const [sourceId, rows] of Object.entries(INTEL_AWARDS)) {
  const year = Number(SOURCES[sourceId].published.slice(0, 4));
  for (const [supplier, cls, citation] of rows) {
    push(supplier, "Intel Corporation", `${citation}${cls && cls !== "EPIC" ? ` (${cls})` : ""}`, [sourceId], year);
  }
}
for (const [supplier, citation] of LAM_AWARDS_2024) {
  push(supplier, "Lam Research Corporation", citation, ["lam-supplier-awards-2024"], 2024);
}
for (const e of OTHER_EDGES) {
  push(e.supplier, e.customer, e.product, e.sources, e.year, e.detail);
}

if (problems.length) {
  console.error("Registry gaps — fix these before the dataset is usable:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}

/* Only firms that actually appear in an edge reach the dataset, so the
   registry can carry spares without inflating the graph. */
const used = new Set();
for (const e of edges) {
  used.add(e.supplier);
  used.add(e.customer);
}
const companies = {};
for (const [name, [country, layer, role]] of Object.entries(C)) {
  const id = slug(name);
  if (!used.has(id)) continue;
  companies[id] = { name, country, layer, role: role ?? null };
  const ann = ANNOTATIONS[name];
  if (ann) companies[id].annotations = ann;
}
const unusedRegistry = Object.keys(C).filter((n) => !used.has(slug(n)));

for (const e of edges) delete e.key;
edges.sort((a, b) => a.customer.localeCompare(b.customer) || a.supplier.localeCompare(b.supplier));

const meta = {
  title: "Public multi-tier semiconductor supplier graph",
  generated: new Date().toISOString().slice(0, 10),
  focal: FOCAL.map(slug),
  rule: "Every edge cites a public document that names both parties. Nothing is inferred from a process flow, a market-share estimate, or a prior.",
  tierRule:
    "Tier is derived at build time as the shortest upstream distance from a focal buyer. It is not stored, so changing the focal set re-tiers the graph.",
  limits: [
    "Buyer-published supplier lists and award lists are selective. Apple's covers 98% of direct spend by value and omits everything indirect; TSMC's and Intel's name award winners, which is a subset of their suppliers, not a census.",
    "An edge records that a relationship was publicly named in a given year. It carries no volume, no revenue share, no contract and no direction of dependence.",
    "Absence of an edge is absence of a public document naming the pair, not absence of a relationship. The upstream of firms under export control is close to unobservable this way, and that is visible in the graph as an almost empty Huawei branch.",
    "Country is the group parent's home jurisdiction, which is what filings and policy documents key on. It is not where the plant is.",
    "Shin-Etsu Chemical and Shin-Etsu Handotai are kept as separate nodes because the award lists name them separately; Handotai is the wafer subsidiary of Chemical.",
    "Disclosure thresholds and anonymised concentration tables can hide counterparties. Other filings explicitly name suppliers or customers, including Advanced Energy and Marvell in this dataset. Absence from one filing is not proof of absence from public sources.",
    "A few relationships are documented but are not purchases, and they say so on their own edge. TSMC's EDA Tool Certification Program, the ASML-ZEISS-TRUMPF co-development of EUV, the IBM-Rapidus joint development, and ASE's foundry alliance with TSMC are each named by both parties without any document describing a sale. They are recorded because they are real dependencies, and qualified because they are not invoices.",
    "Three-level coverage is incomplete and remains a research backlog. Each direction is measured separately. Historical, announced and design-enablement dependencies do not prove current shipments or a product-specific bill of materials; combining dated links does not establish simultaneous trade.",
  ],
  layers: LAYERS,
  countries: {
    us: "United States", jp: "Japan", tw: "Taiwan", kr: "South Korea", cn: "China",
    nl: "Netherlands", de: "Germany", at: "Austria", fr: "France", be: "Belgium",
    ch: "Switzerland", it: "Italy", ie: "Ireland", uk: "United Kingdom", fi: "Finland",
    no: "Norway", se: "Sweden", dk: "Denmark", sg: "Singapore", my: "Malaysia",
    vn: "Vietnam", in: "India", il: "Israel", ca: "Canada", hk: "Hong Kong", sa: "Saudi Arabia",
  },
  evidenceClasses: {
    "P1-buyer": "The buyer publishes its supplier's name",
    "P1-supplier": "The supplier publishes its customer's name",
    "P1-self": "A company's own filing names its counterparty",
    "P2-institutional": "A research house identifies the pair, typically by teardown",
    "P3-regulatory": "A government document establishes the relationship",
  },
};

expandSystem({ meta, sources: SOURCES, companies, edges });
expandFilings({ meta, sources: SOURCES, companies, edges });
expandCoverage({ meta, sources: SOURCES, companies, edges });
const coverage = supplierCoverage(companies, edges);
meta.documentedLevels = coverageSummary(coverage);

mkdirSync(DATA, { recursive: true });
const write = (file, obj) => {
  writeFileSync(join(DATA, file), JSON.stringify(obj, null, 2) + "\n");
  console.log(`  ${file.padEnd(16)} ${JSON.stringify(obj).length.toLocaleString()} bytes`);
};
write("sources.json", { meta: { generated: meta.generated }, sources: SOURCES });
write("companies.json", { meta, companies });
write("edges.json", { meta: { generated: meta.generated, count: edges.length }, edges });
write("coverage.json", { reviewed: meta.coverageReviewed, summary: meta.documentedLevels, companies: coverage });

/* The dashboard reads one generated file rather than three, so the
   dataset cannot drift from what the app ships. JSON rather than a JS
   module, matching how `vault-snapshot.json` is already delivered: a
   176KB object literal in a .js file is 176KB of JAVASCRIPT for the
   bundler to parse and for rollup to hold in its module graph, and
   adding that much to the dashboard entry was enough to lose vite's
   html-inline-proxy race on a cold multi-entry build. A .json import
   is data to the bundler, and the build is stable again.

   Generated, never hand-edited: change the tables above and re-run. */
const APP_DATA = join(HERE, "..", "app", "src", "data", "publicSupplierTiers.json");
writeFileSync(APP_DATA, JSON.stringify({ meta, sources: SOURCES, companies, edges }, null, 2) + "\n");
console.log(`  app data         ${APP_DATA}`);

console.log(`\n${Object.keys(companies).length} companies, ${edges.length} edges, ${Object.keys(SOURCES).length} sources.`);
if (unusedRegistry.length) {
  console.log(`\n${unusedRegistry.length} registry entries carry no edge yet:`);
  for (const n of unusedRegistry) console.log("  -", n);
}
