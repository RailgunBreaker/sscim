/* Plain-language "introductions" shown when a user clicks a sector, company,
   or country — separate from the vault (server/, VaultContext.jsx,
   vault-snapshot.json), which stay untouched. STAGE_INTRO is a small,
   hand-written, generic description of what each of the 24 process steps
   actually is (textbook-level industry knowledge, not a claim about any
   specific company or figure). introForCompany()/introForCountry() are
   pure functions that generate a one-line introduction purely from fields
   already present and audited in the dataset (name, HQ, stage stakes,
   customer/supplier counts) — no new factual claims are introduced. */

export const STAGE_INTRO = {
  research: 'Foundational IP and chip-architecture licensing (e.g. instruction-set architectures) that most downstream chip designs are built on top of.',
  eda: 'Electronic design automation: the specialized software used to design, simulate, and verify a chip before it is ever manufactured.',
  design: 'Turning a product idea into a manufacturable chip layout — the fabless design work that a foundry then physically produces.',
  wafers: 'Ultra-pure single-crystal silicon discs, sliced and polished, that serve as the base material every chip is built on.',
  resist: 'Light-sensitive chemical coatings applied to a wafer that harden or dissolve where lithography light strikes them, transferring a circuit pattern.',
  gases: 'Specialty gases and process chemicals (etchants, dopants, cleaning agents) consumed in high volume throughout wafer fabrication.',
  substrates: 'The organic (ABF) substrate material that carries a finished chip die and connects it to the package and circuit board.',
  litho: 'Lithography: projecting a circuit pattern onto a photoresist-coated wafer using EUV or DUV light — the single most precision-critical step in fabrication.',
  depo: 'Deposition: building up thin films of conductive or insulating material, layer by layer, on the wafer surface.',
  etch: 'Etch & clean: chemically or physically removing material to carve the deposited layers into the intended circuit pattern.',
  cmp: 'Chemical-mechanical planarization: polishing each processed layer flat before the next one is built on top of it.',
  metro: 'Metrology & inspection: measuring and photographing in-process wafers to catch defects before they propagate through hundreds of further steps.',
  adv_fab: 'Leading-edge logic fabrication (roughly ≤7nm-class nodes) — the most capital-intensive and geographically concentrated stage in the chain.',
  mature_fab: 'Established-node fabrication for chips that don’t need the latest process — power management, sensors, and many automotive/industrial parts.',
  memory_fab: 'Fabrication of DRAM and NAND flash memory — the working and storage memory used across nearly every electronic system.',
  logic_ai: 'Logic chips and AI accelerators: the processors and GPUs that run general computing and, increasingly, AI training/inference workloads.',
  analog: 'Analog, power-management, and RF chips — the less glamorous parts that regulate power and handle real-world signals in nearly every device.',
  hbm: 'High-bandwidth memory: stacked DRAM bonded directly next to a processor, the memory technology AI accelerators depend on for throughput.',
  adv_pkg: 'Advanced packaging: bonding multiple chiplets/dies (e.g. a processor and its HBM stacks) into one finished package rather than one chip.',
  osat: 'Outsourced assembly and test: the final packaging and functional testing step for chips that don’t use advanced packaging.',
  systems: 'Final systems assembly (ODM/EMS) — turning finished chips into the servers, phones, and devices that reach an end customer.',
  m_ai: 'AI data centers: the end-market demand for AI training/inference infrastructure that pulls on logic, HBM, and advanced packaging capacity.',
  m_auto: 'Automotive and industrial end markets — long-qualification-cycle demand for mature-node logic, analog, and power chips.',
  m_consumer: 'Consumer and mobile end markets — phones, PCs, and consumer electronics, the largest-volume destination for finished chips.',
};

/* A short, purely data-derived introduction for a company — no fact beyond
   what's already in the audited dataset (name, HQ country, stage stakes,
   customer count). Deliberately generic rather than asserting anything
   about the company that isn't already a verified field. */
export function introForCompany(co, { STAGE_BY_ID, COUNTRY_NAMES, CUSTOMERS, SUPPLIERS }) {
  const stakes = Object.entries(co.stakes || {}).sort((a, b) => b[1] - a[1]);
  if (!stakes.length) return `${co.name}, headquartered in ${COUNTRY_NAMES[co.country]}.`;
  const [topStageId, topShare] = stakes[0];
  const topStageName = STAGE_BY_ID[topStageId]?.name ?? topStageId;
  const others = stakes.slice(1, 3).map(([sid]) => STAGE_BY_ID[sid]?.name).filter(Boolean);
  const custCount = (CUSTOMERS?.[co.id] || []).length;
  const supCount = (SUPPLIERS?.[co.id] || []).length;
  let s = `${co.name}, headquartered in ${COUNTRY_NAMES[co.country]}, is modeled with roughly ${(topShare * 100).toFixed(0)}% within-stage share of ${topStageName}`;
  if (others.length) s += ` (also active in ${others.join(', ')})`;
  s += '.';
  if (custCount || supCount) {
    const parts = [];
    if (supCount) parts.push(`${supCount} modeled supplier${supCount === 1 ? '' : 's'}`);
    if (custCount) parts.push(`${custCount} modeled customer${custCount === 1 ? '' : 's'}`);
    s += ` Tracked with ${parts.join(' and ')} in the customer graph.`;
  }
  return s;
}

/* Same principle for a country: derived purely from its stage participation
   (already-audited share data) and headquartered-company count — not a new
   claim beyond what the dataset already verifies. */
/* Regional-indicator flag emoji from a country id — 'uk' is special-cased
   to the ISO 3166-1 code 'gb' since the dataset's id predates that fix;
   every other id already is a valid two-letter code. */
const ISO_OVERRIDE = { uk: 'gb' };
export function flagEmoji(countryId) {
  const iso = (ISO_OVERRIDE[countryId] || countryId || '').toUpperCase();
  if (iso.length !== 2) return '';
  const codePoints = [...iso].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

export function introForCountry(countryId, { COUNTRY_NAMES, STAGE_BY_ID, COMPANIES }, model) {
  const name = COUNTRY_NAMES[countryId];
  const c = model.countriesActive[countryId];
  if (!c || !c.stages?.length) return `${name} — no modeled stage participation in the current snapshot.`;
  const top = c.stages.slice(0, 3).map(([sid, sh]) => `${STAGE_BY_ID[sid]?.name ?? sid} (${(sh * 100).toFixed(0)}%)`);
  const hqCount = COMPANIES.filter((co) => co.country === countryId).length;
  let s = `${name} participates in ${c.stages.length} modeled stage${c.stages.length === 1 ? '' : 's'}, most heavily in ${top.join(', ')}.`;
  if (hqCount) s += ` ${hqCount} modeled compan${hqCount === 1 ? 'y is' : 'ies are'} headquartered here (not necessarily produced here).`;
  return s;
}
