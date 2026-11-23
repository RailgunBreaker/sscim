import COMPANY_CONTROL from '../data/companyControl.json' with { type: 'json' };
import PUBLIC_SUPPLIER_TIERS from '../data/publicSupplierTiers.json' with { type: 'json' };

/* ====================================================================
   engine/companyProfile.js — one standardized profile for every company.

   The same argument as engine/facilityProfile.js, applied one layer up.
   109 hand-written company introductions would drift: the tenth would
   mention market share, the fiftieth would not, one firm would be
   "critical" and an identical one "significant", and a reader comparing
   two companies would be comparing two authors. Generating every
   profile from the same fields makes the comparison honest — if two
   read differently, the companies differ, not the prose.

   The generator takes NO free prose. Every sentence is a rendering of a
   field, and the fact table always has the same rows in the same order
   with an em dash where a value is unknown, because a missing row lets
   a reader think the field does not apply when it simply is not known.

   PROFILE SHAPE — identical for all 109:
     headline     what it is: chain position, HQ, control in one line
     intro        generated sentences: what it does, where it sits,
                  who controls it, and the caveat for its situation
     facts        a fixed key/value table
     stageRoles   the modeled stages it occupies, with its share
     control      who actually decides, and through what mechanism
     chain        the modeled chain and the documented chain, SEPARATELY
     caveats      the limits that apply to this record

   THE ONE THING THIS FILE REFUSES TO DO is merge the modeled chain with
   the documented one. They answer different questions and carry
   different warrants: the modeled chain is composed from declared
   priors and is complete over the sample; the documented chain is
   whatever a public document happened to name and is radically
   incomplete. Averaging them, or showing them in one list, would
   produce a number that reads as evidence and is not.

   Pure and dependency-free except for two generated data files, so the
   wording is unit-testable.
   ==================================================================== */

export const CONTROL_TYPES = COMPANY_CONTROL.meta.types;
export const PASSIVE_MANAGERS = COMPANY_CONTROL.meta.passiveManagers;

/* What a company's chain position is called, derived from the stages it
   occupies rather than stored — so it cannot disagree with the stakes. */
const STAGE_GROUP = {
  research: 'Research and IP',
  eda: 'EDA software',
  design: 'Chip design',
  wafers: 'Silicon wafers',
  resist: 'Photoresists',
  gases: 'Specialty gases',
  substrates: 'Substrates',
  litho: 'Lithography',
  depo: 'Deposition',
  etch: 'Etch and clean',
  cmp: 'CMP and slurries',
  metro: 'Metrology and inspection',
  adv_fab: 'Advanced fabrication',
  mature_fab: 'Mature-node fabrication',
  memory_fab: 'Memory fabrication',
  hbm: 'HBM',
  logic_ai: 'Logic and AI accelerators',
  analog: 'Analog, power and RF',
  adv_pkg: 'Advanced packaging',
  osat: 'Assembly and test',
  systems: 'Systems assembly',
  m_ai: 'AI datacentre demand',
  m_auto: 'Automotive demand',
  m_consumer: 'Consumer demand',
};

const THE_COUNTRIES = new Set(['us', 'nl', 'uk', 'ph']);
const withArticle = (id, name) => (THE_COUNTRIES.has(id) ? `the ${name}` : name);

const list = (items) => {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
};

const pct = (v) => `${Math.round(v * 100)}%`;

/* ---------------------------------------------------------------- *
 * Control
 * ---------------------------------------------------------------- */
export function companyControl(companyId) {
  return COMPANY_CONTROL.control[companyId] || null;
}

/* The control fact as one sentence. This is the sentence the whole
   control dataset exists for: it must never let a passive index manager
   read as a controller, and it must say "nobody" out loud when nobody
   controls the company. */
export function controlSentence(companyId, { COMPANY_BY_ID = {} } = {}) {
  const ctl = companyControl(companyId);
  const name = COMPANY_BY_ID[companyId]?.name || companyId;
  if (!ctl) return `Control of ${name} is not recorded in this dataset.`;

  if (ctl.type === 'widely_held') {
    return `${name} has no controlling shareholder. ${ctl.basis} Its largest holders are passive index managers, which hold shares for fund investors and do not direct the business — they are custodians, not controllers.`;
  }
  if (ctl.type === 'unestablished') {
    return `This dataset could not establish who controls ${name}. ${ctl.basis}`;
  }
  const stake = ctl.stake !== null ? ` (about ${pct(ctl.stake)})` : '';
  return `${name} is controlled by ${ctl.controller}${stake}. ${ctl.basis}`;
}

/* ---------------------------------------------------------------- *
 * The documented chain — the public-supplier-tier dataset, crosswalked.
 * ---------------------------------------------------------------- */
const PUBLIC_BY_VAULT = (() => {
  const out = {};
  for (const [pid, c] of Object.entries(PUBLIC_SUPPLIER_TIERS.companies)) {
    if (c.vaultId) (out[c.vaultId] ||= []).push(pid);
  }
  return out;
})();

export function documentedChain(companyId) {
  const publicIds = PUBLIC_BY_VAULT[companyId] || [];
  if (!publicIds.length) return { covered: false, aliases: [], suppliers: [], customers: [] };
  const set = new Set(publicIds);
  const suppliers = [];
  const customers = [];
  for (const e of PUBLIC_SUPPLIER_TIERS.edges) {
    if (set.has(e.customer)) suppliers.push(e);
    if (set.has(e.supplier)) customers.push(e);
  }
  return {
    covered: suppliers.length + customers.length > 0,
    aliases: publicIds.map((id) => PUBLIC_SUPPLIER_TIERS.companies[id].name),
    publicIds,
    suppliers,
    customers,
  };
}

export const publicCompanyName = (publicId) =>
  PUBLIC_SUPPLIER_TIERS.companies[publicId]?.name || publicId;
export const publicSource = (sourceId) => PUBLIC_SUPPLIER_TIERS.sources[sourceId] || null;

/* ---------------------------------------------------------------- *
 * The profile
 * ---------------------------------------------------------------- */

export function companyHeadline(company, ctx = {}) {
  const { COUNTRY_NAMES = {} } = ctx;
  const ctl = companyControl(company.id);
  const stages = Object.keys(company.stakes || {});
  const where = stages.length ? (STAGE_GROUP[stages[0]] || stages[0]) : 'No modeled stage';
  const country = COUNTRY_NAMES[company.country] || company.country;
  const ctlLabel = ctl ? CONTROL_TYPES[ctl.type].label : 'Control not recorded';
  return `${where} · ${country} · ${ctlLabel}`;
}

/* The standardized introduction. Same sentence order for every company:
     1. what it is and where it sits in the chain
     2. its modeled position, with its largest stage share
     3. who controls it
     4. what the public record does and does not show about its chain */
export function companyIntro(company, ctx = {}) {
  const { COUNTRY_NAMES = {}, STAGE_BY_ID = {}, CUSTOMERS = {}, SUPPLIERS = {} } = ctx;
  const country = withArticle(company.country, COUNTRY_NAMES[company.country] || company.country);
  const sentences = [];

  const stakes = Object.entries(company.stakes || {}).sort((a, b) => b[1] - a[1]);
  const stageNames = stakes.map(([sid]) => STAGE_BY_ID[sid]?.name || STAGE_GROUP[sid] || sid);

  // 1 + 2. identity and modeled position
  if (stakes.length > 0) {
    const [topStage, topShare] = stakes[0];
    sentences.push(
      `${company.name} is modeled in ${country}, occupying ${list(stageNames)}.`
      + ` Its largest modeled position is ${pct(topShare)} of ${STAGE_BY_ID[topStage]?.name || STAGE_GROUP[topStage] || topStage}`
      + ' — a source-informed share estimate, not capacity data.',
    );
  } else {
    sentences.push(
      `${company.name} is modeled in ${country} and holds no share in any modeled stage;`
      + ' it is carried so that its relationships and sites can be represented at all.',
    );
  }

  // 3. control
  sentences.push(controlSentence(company.id, ctx));

  // 4. the chain, both readings, never merged
  const modCust = (CUSTOMERS[company.id] || []).length;
  const modSup = (SUPPLIERS[company.id] || []).length;
  const doc = documentedChain(company.id);
  const docN = doc.covered ? doc.suppliers.length + doc.customers.length : 0;

  if (modCust || modSup) {
    sentences.push(
      `The model gives it ${modSup} supplier${modSup === 1 ? '' : 's'} and ${modCust} customer${modCust === 1 ? '' : 's'},`
      + ' composed from supplier-revenue shares and stage reachability rather than observed trade.',
    );
  } else {
    sentences.push(
      'The model gives it no supplier or customer edge: nothing in the curated customer sample names a counterparty for it.'
      + ' That is a coverage gap in the sample, not evidence that it trades with nobody.',
    );
  }

  sentences.push(
    docN
      ? `Separately, ${docN} of its relationships ${docN === 1 ? 'is' : 'are'} named in a public document that cites both parties.`
      : 'No public document in the supplier-tier dataset names a counterparty for it, so it has no documented chain here — an absence of disclosure, not of trade.',
  );

  return sentences.join(' ');
}

export function companyFacts(company, ctx = {}) {
  const { COUNTRY_NAMES = {}, STAGE_BY_ID = {}, CUSTOMERS = {}, SUPPLIERS = {}, COMPANY_RANK = [] } = ctx;
  const ctl = companyControl(company.id);
  const doc = documentedChain(company.id);
  const stakes = Object.entries(company.stakes || {}).sort((a, b) => b[1] - a[1]);
  const rank = COMPANY_RANK.findIndex((x) => x.id === company.id) + 1;

  return [
    ['HQ country', COUNTRY_NAMES[company.country] || company.country],
    ['Modeled stages', stakes.length
      ? stakes.map(([sid, sh]) => `${STAGE_BY_ID[sid]?.name || STAGE_GROUP[sid] || sid} ${pct(sh)}`).join(', ')
      : '—'],
    ['Control', ctl ? CONTROL_TYPES[ctl.type].label : '—'],
    ['Controller', ctl?.controller || (ctl?.type === 'widely_held' ? 'None — no controlling shareholder' : '—')],
    ['Controlling stake', ctl?.stake != null ? pct(ctl.stake) : '—'],
    ['Control evidence', ctl ? `Tier ${ctl.tier}${ctl.confidence === 'low' ? ' — low confidence' : ''}` : '—'],
    ['Modeled suppliers', String((SUPPLIERS[company.id] || []).length)],
    ['Modeled customers', String((CUSTOMERS[company.id] || []).length)],
    ['Documented suppliers', doc.covered ? String(doc.suppliers.length) : '—'],
    ['Documented customers', doc.covered ? String(doc.customers.length) : '—'],
    ['Criticality rank', rank > 0 ? `#${rank} of ${COMPANY_RANK.length}` : '—'],
  ];
}

export function companyStageRoles(company, ctx = {}) {
  const { STAGE_BY_ID = {} } = ctx;
  return Object.entries(company.stakes || {})
    .map(([sid, share]) => ({
      stageId: sid,
      stageName: STAGE_BY_ID[sid]?.name || STAGE_GROUP[sid] || sid,
      share,
    }))
    .sort((a, b) => b.share - a.share);
}

export function companyCaveats(company, ctx = {}) {
  const { CUSTOMERS = {}, SUPPLIERS = {} } = ctx;
  const ctl = companyControl(company.id);
  const doc = documentedChain(company.id);
  const out = [
    'Stage shares are source-informed share estimates, not capacity or utilization. No figure here is measured output.',
    'The modeled chain is composed from supplier-revenue share and stage reachability. It records no shipment, contract or trade flow.',
  ];
  if (ctl?.type === 'widely_held') {
    out.push('No shareholder controls this company. Its largest holders are passive index managers, which are custodians rather than controllers — naming one of them as an owner of the business would be wrong.');
  }
  if (ctl?.confidence === 'low') {
    out.push(`Control here is a low-confidence judgement: ${ctl.note || 'the mechanism is believed real, the current holder was not verified.'}`);
  }
  if (ctl) {
    out.push('Control is the most perishable data in this project. Stakes move, consortia sell down, and a company that was state-controlled last year may not be this year.');
  }
  if (!doc.covered) {
    out.push('No public document in the supplier-tier dataset names this company, so it has no documented chain. That is a statement about disclosure, not about the company.');
  }
  if (!(CUSTOMERS[company.id] || []).length && !(SUPPLIERS[company.id] || []).length) {
    out.push('This company has no modeled chain edge at all, so it contributes nothing to propagation and nothing propagates to it. It is present for its stage share and its sites.');
  }
  return out;
}

export function companyProfile(company, ctx = {}) {
  return {
    id: company.id,
    name: company.name,
    headline: companyHeadline(company, ctx),
    intro: companyIntro(company, ctx),
    facts: companyFacts(company, ctx),
    stageRoles: companyStageRoles(company, ctx),
    control: companyControl(company.id),
    documented: documentedChain(company.id),
    caveats: companyCaveats(company, ctx),
  };
}

export function publicCompanyRecord(publicId) {
  return PUBLIC_SUPPLIER_TIERS.companies[publicId] || null;
}

export function publicCompanyIdForSystem(companyId) {
  return Object.keys(PUBLIC_SUPPLIER_TIERS.companies).find(id => PUBLIC_SUPPLIER_TIERS.companies[id].vaultId === companyId) || null;
}

// Public-only counterparties receive profiles, never modeled stakes or watchlist identities.
export function publicCompanyProfile(publicId, ctx = {}) {
  const c = publicCompanyRecord(publicId);
  if (!c) return null;
  const modeled = c.vaultId && ctx.COMPANY_BY_ID?.[c.vaultId];
  const suppliers = PUBLIC_SUPPLIER_TIERS.edges.filter(e => e.customer === publicId);
  const customers = PUBLIC_SUPPLIER_TIERS.edges.filter(e => e.supplier === publicId);
  const sourceIds = [...new Set([...suppliers, ...customers].flatMap(e => e.sources))];
  const documented = { covered: suppliers.length + customers.length > 0, aliases: [c.name],
    publicIds: [publicId], suppliers, customers };
  const country = PUBLIC_SUPPLIER_TIERS.meta.countries[c.country] || c.country;
  const layer = PUBLIC_SUPPLIER_TIERS.meta.layers[c.layer] || c.layer;
  const dates = [...new Set([...suppliers, ...customers].flatMap(e => e.years))].sort();
  const base = modeled ? companyProfile(modeled, ctx) : {
    id: publicId, name: c.name,
    headline: `${layer} · ${country} · Chain context`,
    intro: `${c.name} is recorded in ${country}, in ${layer.toLowerCase()}. ${c.role || ''} `
      + `The public record contains ${suppliers.length} named suppliers and ${customers.length} named customers. `
      + 'This company is included to explain the chain; it is outside the tracked company set.',
    facts: [
      ['HQ country', country], ['Modeled stages', 'Not in the tracked model'],
      ['Control', 'Not researched'], ['Controller', 'Not established'], ['Controlling stake', 'Not established'],
      ['Control evidence', 'Not researched'], ['Modeled suppliers', 'Not applicable'],
      ['Modeled customers', 'Not applicable'], ['Documented suppliers', String(suppliers.length)],
      ['Documented customers', String(customers.length)], ['Criticality rank', 'Not ranked'],
    ],
    stageRoles: [], control: null,
    caveats: [
      'This is a chain-context profile, not an additional tracked or scored company.',
      'Headquarters and chain position come from the public-company registry; headquarters is not the location of every facility.',
      'Control and ownership have not been researched for this record. No controller is inferred from a name or supply relationship.',
      'Each relationship cites a public document. Disclosure years do not prove that a relationship remains active today.',
      'Missing relationships mean missing evidence in this dataset, not an absence of trade.',
    ],
  };
  return { ...base, name: c.name, publicId, tracked: Boolean(modeled), modeledCompanyId: modeled?.id || null,
    documented, sourceIds, annotations: c.annotations || [],
    facts: [...base.facts.map(([key, value]) => [key,
      key === 'Documented suppliers' ? String(suppliers.length) : key === 'Documented customers' ? String(customers.length) : value]),
      ['Chain position', layer], ['Tracking scope', modeled ? 'System company' : 'Chain context only'],
      ['Relationship sources', String(sourceIds.length)], ['Disclosure years', dates.join(', ') || 'No relationships documented']],
  };
}

/* Coverage, for the audit and for the interface to state plainly rather
   than leave a reader to infer from a thin-looking page. */
export function controlCoverage(companies) {
  const byType = {};
  let low = 0;
  for (const c of companies) {
    const ctl = companyControl(c.id);
    const t = ctl ? ctl.type : 'missing';
    byType[t] = (byType[t] ?? 0) + 1;
    if (ctl?.confidence === 'low') low += 1;
  }
  return { total: companies.length, byType, lowConfidence: low };
}

export function documentedCoverage(companies) {
  const covered = companies.filter((c) => documentedChain(c.id).covered);
  return { total: companies.length, covered: covered.length, ids: covered.map((c) => c.id) };
}
