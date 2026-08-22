/* ====================================================================
   citations.js — full Chicago bibliography entries for the sources this
   project uses repeatedly, and the renderer that formats them.

   WHY A SEPARATE FILE. A vault record's `source` field is a curator's note:
   "ASML Q3 2024 release (Oct 15, 2024)". That is enough to find the document
   and not enough to be a citation. Where a source recurs — a standing dataset,
   an institutional publisher, a named report — its full bibliographic detail
   belongs somewhere it can be written once, verified once, and reused.

   WHAT GOES IN HERE. Only entries whose details have actually been checked
   against the publisher. An entry with a title nobody verified is worse than
   no entry, because it looks authoritative. Where a detail is genuinely
   unavailable the field is omitted and the renderer simply leaves it out —
   it never invents a title, an author, or an access date to complete the
   shape of a citation.

   STYLE. Chicago notes-bibliography, author-first, as used for bibliographies
   rather than footnotes. Government and legal material follows Chicago's
   convention of citing the issuing body, the document, and the Federal
   Register volume/page where one exists.
   ==================================================================== */

/* Render one entry as a Chicago bibliography line. Every field is optional;
   the renderer emits only the ones present, in Chicago's order. */
export function chicago(c) {
  if (!c) return '';
  const parts = [];

  // Author / issuing body, ending in a period.
  if (c.author) parts.push(/[.?!]$/.test(c.author) ? c.author : `${c.author}.`);

  // Title: quoted for a part, italic for a standalone work.
  if (c.title) {
    parts.push(c.standalone ? `*${c.title}*.` : `"${c.title}."`);
  } else if (c.description) {
    // No published title: describe the document rather than inventing one.
    parts.push(`${c.description}.`);
  }

  if (c.container) parts.push(`*${c.container}*,`);
  if (c.edition) parts.push(`${c.edition},`);

  /* Federal Register and similar legal locators. Comma only when a date
     follows; otherwise the locator closes the entry, and a trailing comma
     before a bracket reads as a citation that was cut off. */
  if (c.register) parts.push(c.date ? `${c.register},` : `${c.register}.`);

  if (c.date) parts.push(`${c.date}.`);
  if (c.doi) parts.push(`https://doi.org/${c.doi}.`);
  else if (c.url) parts.push(`${c.url}.`);
  if (c.accessed) parts.push(`Accessed ${c.accessed}.`);
  if (c.note) parts.push(`${c.note}`);

  return parts.join(' ').replace(/,\s*\./g, '.').replace(/\s+/g, ' ').trim();
}

/* --- Standing datasets and services -------------------------------------
   Queried continuously rather than cited once. Details verified against each
   publisher's own citation guidance where they publish one. */
export const DATASETS = {
  usgs_comcat: {
    author: 'U.S. Geological Survey, Earthquake Hazards Program',
    title: 'Advanced National Seismic System (ANSS) Comprehensive Catalog of Earthquake Events and Products',
    standalone: true,
    date: '2017',
    doi: '10.5066/F7MS3QZH',
    note: 'Queried through the FDSN event web service at earthquake.usgs.gov/fdsnws/event/1/query.',
    role: 'Candidate discovery — seismic events near modeled fab clusters.',
  },
  federal_register_api: {
    author: 'Office of the Federal Register, National Archives and Records Administration',
    title: 'Federal Register Documents API (v1)',
    standalone: true,
    url: 'https://www.federalregister.gov/developers/documentation/api/v1',
    role: 'Candidate discovery — US rules, notices and entity-list actions.',
  },
  webz_news: {
    author: 'Webz.io',
    title: 'News API Lite',
    standalone: true,
    url: 'https://webz.io/products/news-api',
    role: 'Candidate discovery — plant halts, fires and shortages as reported.',
  },
  yahoo_finance: {
    author: 'Yahoo Finance',
    description: 'Quote API (v7)',
    url: 'https://query1.finance.yahoo.com/v7/finance/quote',
    role: 'Display metadata only — price and P/E. Never an engine input.',
  },
  openstreetmap: {
    author: 'OpenStreetMap contributors',
    title: 'OpenStreetMap',
    standalone: true,
    url: 'https://www.openstreetmap.org',
    note: 'Licensed under the Open Database License (ODbL).',
    role: 'Basemap geometry.',
  },
  carto_basemaps: {
    author: 'CARTO',
    title: 'CARTO Basemaps (dark_all)',
    standalone: true,
    url: 'https://carto.com/basemaps',
    role: 'Basemap tile rendering, over OpenStreetMap data.',
  },
};

/* --- Institutional publishers --------------------------------------------
   Bodies whose individual documents are cited per event in the register's
   index. Listed here as organisational authors so a reader can see the whole
   set of institutions the project rests on, with what each publishes.

   These are NOT stand-ins for the specific documents. Each entry says what
   kind of material the body issues; the per-event index says which. */
export const PUBLISHERS = {
  bis: {
    author: 'U.S. Department of Commerce, Bureau of Industry and Security',
    description: 'Export Administration Regulations rulemaking, Entity List actions and denial orders',
    url: 'https://www.bis.gov',
    kind: 'regulator',
  },
  federal_register: {
    author: 'Office of the Federal Register',
    description: 'Rules, proposed rules, notices and presidential documents',
    url: 'https://www.federalregister.gov',
    kind: 'regulator',
  },
  mofcom: {
    author: "People's Republic of China, Ministry of Commerce (MOFCOM)",
    description: 'Export control announcements, unreliable-entity listings and trade measures',
    url: 'http://english.mofcom.gov.cn',
    kind: 'regulator',
  },
  ndrc: {
    author: "People's Republic of China, National Development and Reform Commission",
    description: 'Industrial policy and investment guidance',
    kind: 'regulator',
  },
  samr: {
    author: 'State Administration for Market Regulation (China)',
    description: 'Merger review and antitrust decisions',
    kind: 'regulator',
  },
  cac: {
    author: 'Cyberspace Administration of China',
    description: 'Cybersecurity review decisions',
    kind: 'regulator',
  },
  meti: {
    author: 'Japan, Ministry of Economy, Trade and Industry (METI)',
    description: 'Export control revisions and semiconductor industrial policy',
    url: 'https://www.meti.go.jp/english/',
    kind: 'regulator',
  },
  dutch_government: {
    author: 'Government of the Netherlands',
    description: 'Export licensing measures for advanced semiconductor manufacturing equipment',
    kind: 'regulator',
  },
  ustr: {
    author: 'Office of the United States Trade Representative',
    description: 'Section 301 and Section 232 actions',
    kind: 'regulator',
  },
  reuters: { author: 'Reuters', description: 'Wire reporting', kind: 'press' },
  bloomberg: { author: 'Bloomberg', description: 'Wire reporting', kind: 'press' },
  nikkei: { author: 'Nikkei', description: 'Business reporting', kind: 'press' },
  bbc: { author: 'BBC News', description: 'News reporting', kind: 'press' },
  digitimes: { author: 'DigiTimes', description: 'Supply-chain trade reporting', kind: 'press' },
  cnbc: { author: 'CNBC', description: 'Business reporting', kind: 'press' },
  focus_taiwan: { author: 'Focus Taiwan (Central News Agency)', description: 'News reporting', kind: 'press' },
  trendforce: {
    author: 'TrendForce',
    description: 'Memory and foundry contract-price series, market-share research',
    url: 'https://www.trendforce.com',
    kind: 'research',
  },
  idc: { author: 'International Data Corporation (IDC)', description: 'Market tracking and forecasts', url: 'https://www.idc.com', kind: 'research' },
  semianalysis: { author: 'SemiAnalysis', description: 'Semiconductor industry analysis', url: 'https://semianalysis.com', kind: 'research' },
  techinsights: { author: 'TechInsights', description: 'Teardown and process analysis', url: 'https://www.techinsights.com', kind: 'research' },
  dramexchange: { author: 'DRAMeXchange (TrendForce)', description: 'Memory spot and contract pricing', kind: 'research' },
  csis: { author: 'Center for Strategic and International Studies', description: 'Export-control and technology policy analysis', url: 'https://www.csis.org', kind: 'research' },
  nand_research: { author: 'NAND Research', description: 'Storage and memory industry analysis', kind: 'research' },
  silicon_analysts: { author: 'Silicon Analysts', description: 'Semiconductor market data', kind: 'research' },
  astute: { author: 'Astute Group', description: 'Component market notes', kind: 'research' },
  marketscreener: { author: 'MarketScreener', description: 'Shareholder and ownership data', kind: 'research' },
  sec_edgar: {
    author: 'U.S. Securities and Exchange Commission',
    title: 'EDGAR Full-Text Search',
    standalone: true,
    url: 'https://www.sec.gov/edgar',
    kind: 'filings',
  },
};

/* Map a recorded source string onto a publisher key, so the register can show
   which institution stands behind a curator's note. Ordered: first match wins,
   specific before general. */
const PUBLISHER_PATTERNS = [
  [/^BIS\b|Bureau of Industry/i, 'bis'],
  [/\bFR\b|Federal Register/i, 'federal_register'],
  [/MOFCOM/i, 'mofcom'],
  [/NDRC/i, 'ndrc'],
  [/SAMR/i, 'samr'],
  [/\bCAC\b/i, 'cac'],
  [/METI/i, 'meti'],
  [/Dutch|Netherlands/i, 'dutch_government'],
  [/USTR/i, 'ustr'],
  [/DRAMeXchange/i, 'dramexchange'],
  [/TrendForce/i, 'trendforce'],
  [/\bIDC\b/i, 'idc'],
  [/SemiAnalysis/i, 'semianalysis'],
  [/TechInsights/i, 'techinsights'],
  [/\bCSIS\b/i, 'csis'],
  [/NAND Research/i, 'nand_research'],
  [/Silicon Analysts/i, 'silicon_analysts'],
  [/Astute/i, 'astute'],
  [/MarketScreener/i, 'marketscreener'],
  [/SEC EDGAR|8-K|10-K|20-F/i, 'sec_edgar'],
  [/Reuters/i, 'reuters'],
  [/Bloomberg/i, 'bloomberg'],
  [/Nikkei/i, 'nikkei'],
  [/\bBBC\b/i, 'bbc'],
  [/DigiTimes/i, 'digitimes'],
  [/CNBC/i, 'cnbc'],
  [/Focus Taiwan/i, 'focus_taiwan'],
];

export function publisherFor(sourceString) {
  const hit = PUBLISHER_PATTERNS.find(([re]) => re.test(String(sourceString || '')));
  return hit ? hit[1] : null;
}

/* Every publisher a recorded string names, not just the first — a note like
   "BIS interim final rule; CSIS analysis" rests on two institutions. */
export function publishersFor(sourceString) {
  const s = String(sourceString || '');
  return [...new Set(PUBLISHER_PATTERNS.filter(([re]) => re.test(s)).map(([, k]) => k))];
}
