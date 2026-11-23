import { readFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const stageLayer = {
  research: 'services', eda: 'services', design: 'ic_other', wafers: 'wafers',
  resist: 'materials', gases: 'materials', substrates: 'substrates_pcb',
  litho: 'equipment', depo: 'equipment', etch: 'equipment', cmp: 'equipment', metro: 'equipment',
  adv_fab: 'foundry_idm', mature_fab: 'foundry_idm', memory_fab: 'memory',
  logic_ai: 'ic_other', analog: 'ic_other', hbm: 'memory', adv_pkg: 'osat_test',
  osat: 'osat_test', systems: 'assembly', m_ai: 'brand', m_auto: 'brand', m_consumer: 'brand',
};

// Registry coverage is separate from relationship evidence. Never import modeled edges.
export function expandSystem(data) {
  const vault = read('../app/src/data/vault-snapshot.json');
  const crosswalk = read('./data/company-crosswalk.json');
  for (const [id, vaultId] of Object.entries(crosswalk)) {
    if (!data.companies[id]) throw new Error(`Missing crosswalk endpoint: ${id}`);
    data.companies[id].vaultId = vaultId;
  }
  for (const c of vault.companies) {
    const matches = Object.entries(data.companies).filter(([, p]) => p.vaultId === c.id);
    if (!matches.length) {
      const stage = Object.keys(c.stakes || {})[0];
      data.companies[`system-${c.id}`] = {
        name: c.name, country: c.country, layer: stageLayer[stage] || 'services',
        role: 'Company tracked in the system; public relationship coverage is shown separately.',
        vaultId: c.id,
      };
    }
    for (const p of Object.values(data.companies).filter(p => p.vaultId === c.id)) {
      p.aliases = [...new Set([...(p.aliases || []), c.name, c.id])];
    }
  }
  const idOf = (vaultId) => {
    if (data.companies[vaultId]) return vaultId;
    const result = Object.keys(data.companies).find(id => data.companies[id].vaultId === vaultId);
    if (!result) throw new Error(`Unknown system company ${vaultId}`);
    return result;
  };
  const source = (id, publisher, title, url, published, evidence, note) => {
    data.sources[id] = { publisher, title, url, published, evidence, kind: 'Company disclosure',
      seen: 'fetched', retrieved: '2026-11-23', note };
  };
  const edge = (supplier, customer, product, sourceId, year, detail = '') => {
    const s = idOf(supplier), c = idOf(customer);
    let e = data.edges.find(e => e.supplier === s && e.customer === c);
    if (!e) { e = { supplier: s, customer: c, products: [], sources: [], years: [], details: [] }; data.edges.push(e); }
    for (const [field, value] of [['products', product], ['sources', sourceId], ['years', year], ['details', detail]]) {
      if (value && !e[field].includes(value)) e[field].push(value);
    }
  };
  source('nvidia-supply-fy2024', 'NVIDIA', 'FY2024 Sustainability Report — Responsible Supply Chain, page 19',
    'https://images.nvidia.com/aem-dam/Solutions/documents/FY2024-NVIDIA-Corporate-Sustainability-Report.pdf',
    '2024', 'P1-buyer', 'Historical company disclosure; not a verification of current contracts.');
  for (const [s, product] of [['tsmc', 'Semiconductor wafers'], ['samsung', 'Semiconductor wafers and memory'],
    ['micron', 'Memory'], ['skhynix', 'Memory'], ['foxconn', 'Assembly, testing and packaging'], ['wistron', 'Assembly, testing and packaging']]) {
    edge(s, 'nvidia', product, 'nvidia-supply-fy2024', 2024);
  }
  source('amd-10k-2024', 'AMD', '2024 Form 10-K — Manufacturing Arrangements and Assembly and Test Facilities',
    'https://ir.amd.com/financial-information/sec-filings/content/0000002488-25-000012/amd-20241228.htm',
    '2025-02-05', 'P1-self', 'Manufacturing counterparties disclosed for fiscal 2024.');
  for (const [s, product] of [['tsmc', 'HPC, FPGA, Adaptive SoC and programmable logic wafers'],
    ['gf', '12 nm and 14 nm HPC wafers'], ['umc', 'Programmable logic wafers'], ['samsung', 'Programmable logic wafers'],
    ['spil', 'Assembly, testing, marking and packaging'], ['kyec', 'Assembly, testing, marking and packaging']]) {
    edge(s, 'amd', product, 'amd-10k-2024', 2024);
  }
  source('mediatek-dimensity-9300', 'MediaTek', 'Dimensity 9300 announcement',
    'https://www.mediatek.com/press-room/mediateks-new-all-big-core-design-for-flagship-dimensity-9300-chipset-maximizes-smartphone-performance-and-efficiency',
    '2023-11-06', 'P1-buyer', 'Product-specific manufacturing process and CPU IP disclosure.');
  edge('tsmc', 'mediatek', '4 nm Dimensity 9300 manufacturing', 'mediatek-dimensity-9300', 2023);
  edge('arm', 'mediatek', 'Cortex-X4 and Cortex-A720 CPU IP', 'mediatek-dimensity-9300', 2023);
  source('nvidia-blackwell-2024', 'NVIDIA', 'Blackwell platform launch — named adopters and system partners',
    'https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing/',
    '2024-03-18', 'P1-supplier', 'Announced adoption and planned availability, not proof of delivered shipments or a direct procurement contract.');
  for (const c of ['amazon', 'google', 'microsoft', 'meta', 'tesla', 'lenovo', 'supermicro']) {
    edge('nvidia', c, 'Blackwell platform — announced adoption / system integration', 'nvidia-blackwell-2024', 2024,
      'Announced plans in March 2024; delivery and current deployment status are not verified.');
  }
  source('linde-samsung-2025', 'Linde', 'Expanded gas supply to Samsung in South Korea',
    'https://www.linde.com/news-and-media/2025/linde-to-expand-supply-of-industrial-gases-to-samsung-in-south-korea',
    '2025-04-29', 'P1-supplier', 'Existing supply and announced expansion at Pyeongtaek.');
  edge('linde', 'samsung', 'High-purity industrial gases', 'linde-samsung-2025', 2025);
  source('airliquide-micron-2024', 'Air Liquide', 'Idaho industrial gas supply contract for Micron',
    'https://www.airliquide.com/group/press-releases-news/2024-06-05/air-liquide-signed-major-contract-support-semiconductor-industry-us-investment-more-250-million',
    '2024-06-05', 'P1-supplier', 'Announced long-term contract; facility operation was expected by end 2025.');
  edge('airliquide', 'micron', 'Ultra-pure nitrogen and other gases', 'airliquide-micron-2024', 2024,
    'Contract announcement; operational start has not been independently verified.');
  source('globalwafers-micron-2026', 'GlobalWafers', 'Micron long-term supply cooperation and proposed financing',
    'https://www.sas-globalwafers.com/en/gwc_news_en_20261103-1/', '2026-11-03', 'P1-supplier',
    'Describes existing supply arrangements and a planned ten-year agreement. Financing and future commitments are proposals.');
  edge('globalwafers', 'micron', 'Raw silicon wafers', 'globalwafers-micron-2026', 2026,
    'Existing product supply disclosed; planned ten-year agreement is not recorded as completed.');
  source('siltronic-awards-2025', 'Siltronic', 'April 2026 investor presentation, page 23 — 2025 supplier awards',
    'https://www.siltronic.com/fileadmin/investorrelations/2026/Q1/20260429_SiltronicInvestorPresentation_.pdf',
    '2026-04-29', 'P1-supplier', 'Supplier awards identify counterparties; they do not establish purchase volumes or current contracts.');
  for (const customer of ['intel', 'samsung', 'micron', 'st']) {
    edge('siltronic', customer, 'Silicon wafers — supplier award', 'siltronic-awards-2025', 2025);
  }
  source('sksiltron-award-history', 'SK Siltron', 'Corporate award history — named wafer customers',
    'https://www.sksiltron.com/en/company/award.do', '', 'P1-supplier',
    'Historical awards dated 2014–2018. They are not evidence of current supply.');
  for (const [customer, year] of [['skhynix', 2014], ['samsung', 2015], ['ti', 2017], ['st', 2018]]) {
    edge('sksiltron', customer, 'Silicon wafers — historical supplier recognition', 'sksiltron-award-history', year,
      'Historical supplier award; ongoing supply has not been verified.');
  }
  source('entegris-award-history', 'Entegris', 'Corporate history — supplier awards',
    'https://www.entegris.com/en/home/about-us/corporate-overview.html', '', 'P1-supplier',
    'Dated corporate timeline records awards from UMC (2010), STMicroelectronics (2014) and Samsung (2015).');
  for (const [customer, year] of [['umc', 2010], ['st', 2014], ['samsung', 2015]]) {
    edge('entegris', customer, 'Supplier award; specific supplied product not stated', 'entegris-award-history', year,
      'Historical supplier recognition; ongoing supply and product scope have not been verified.');
  }
  data.companies['wacker-chemie-ag'] = { name: 'Wacker Chemie AG', country: 'de', layer: 'materials',
    role: 'Chemical manufacturer supplying polysilicon used to produce silicon wafers.' };
  source('wacker-ar2024-siltronic', 'Wacker Chemie', 'Annual Report 2024 — supply to Siltronic',
    'https://reports.wacker.com/2024/annual-report/_assets/downloads/entire-wacker-ar24.pdf',
    '2025', 'P1-self', 'Annual report identifies polysilicon supply to Siltronic.');
  edge('wacker-chemie-ag', 'siltronic', 'Polysilicon for silicon wafer production', 'wacker-ar2024-siltronic', 2024);
  data.meta.systemCompanyCount = vault.companies.length;
  data.meta.coverageReviewed = '2026-11-23';
  data.edges.sort((a, b) => a.customer.localeCompare(b.customer) || a.supplier.localeCompare(b.supplier));
  return data;
}
