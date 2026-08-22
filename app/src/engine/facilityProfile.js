/* ====================================================================
   engine/facilityProfile.js — one standardized profile for every site.

   Why generated rather than written: 244 hand-written site introductions
   would drift. The tenth would mention capacity, the fiftieth would not;
   one would call a plant "critical" and an identical one "significant";
   and a reader comparing two sites would be comparing two authors as much
   as two facilities. Generating the prose from the same structured fields
   for every record makes the comparison honest — if two profiles read
   differently, it is because the sites differ, not the wording.

   The generator therefore takes NO free prose except the record's own
   `output` line, and every sentence it emits is a rendering of a field
   that the audit checks.

   PROFILE SHAPE — identical for all 244 sites:
     headline      what it is, in one line: kind, operator, place
     intro         2-4 generated sentences: role, output, network position,
                   and the caveat that applies to THIS kind of site
     facts         a fixed key/value table (never a variable set of keys)
     stageRoles    which modeled stages it feeds and its share of each
     caveats       the limits that apply to this record specifically

   Pure and dependency-free so the wording is unit-testable.
   ==================================================================== */

export const KIND_LABEL = Object.freeze({
  fab: 'Wafer fab',
  assembly: 'Assembly & test',
  materials: 'Materials plant',
  equipment: 'Equipment plant',
  rnd: 'R&D / design site',
  datacenter: 'Datacentre',
});

/* The same kinds as noun phrases, for use mid-sentence. KIND_LABEL is a
   column heading ("Assembly & test"); this is what you can write "is a …"
   in front of without it reading like a form field. */
const KIND_NOUN = Object.freeze({
  fab: 'wafer fab',
  assembly: 'assembly and test plant',
  materials: 'materials plant',
  equipment: 'equipment plant',
  rnd: 'design and R&D site',
  datacenter: 'datacentre',
});

/* Countries that take a definite article. Getting this wrong reads as
   machine-written, which undermines the point of standardizing the prose. */
const THE_COUNTRIES = new Set(['us', 'nl', 'uk', 'ph']);
const withArticle = (id, name) => (THE_COUNTRIES.has(id) ? `the ${name}` : name);

/* What a site of each kind DOES in the chain, in one standardized clause.
   This is the sentence that stops a design campus being read as a fab. */
const KIND_ROLE = Object.freeze({
  fab: 'fabricates wafers',
  assembly: 'packages and tests finished die',
  materials: 'supplies process materials',
  equipment: 'builds production equipment',
  rnd: 'designs and develops — it produces no physical output',
  datacenter: 'consumes finished silicon — it is a demand site, not a production site',
});

/* The caveat that applies to each kind. A hazard on a design campus or a
   datacentre does NOT remove wafers from the chain, and saying so once per
   profile is cheaper than a reader inferring it wrongly once. */
const KIND_CAVEAT = Object.freeze({
  fab: null,
  assembly: null,
  materials: null,
  equipment: 'Disruption here delays future capacity rather than current output — equipment lead times are quarters, not days.',
  rnd: 'No wafers are made here. A disruption at this site delays designs and roadmaps; it does not remove supply from the chain in the current period.',
  datacenter: 'This site buys silicon rather than making it. It appears in the model as demand, so a disruption here reduces pull-through rather than supply.',
});

const STATUS_NOTE = Object.freeze({
  operating: null,
  ramping: 'Still ramping, so its contribution is discounted to half weight in hazard exposure.',
  construction: 'Under construction and carries no exposure weight — it has no output to lose yet.',
  idle: 'Idle, so it carries no exposure weight in the current snapshot.',
});

const SCALE_WORD = Object.freeze({
  5: 'among the most significant sites in its part of the chain',
  4: 'a major site in its part of the chain',
  3: 'a significant site',
  2: 'a secondary site',
  1: 'a minor or not-yet-material site',
});

const list = (items) => {
  const a = items.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
};

const pct = (v) => `${Math.round(v * 100)}%`;

/* The one-line headline: kind · operator · place. */
export function facilityHeadline(facility, { COMPANY_BY_ID = {}, COUNTRY_NAMES = {} } = {}) {
  const operator = COMPANY_BY_ID[facility.company]?.name || facility.company;
  const country = COUNTRY_NAMES[facility.country] || facility.country;
  return `${KIND_LABEL[facility.kind] || facility.kind} · ${operator} · ${country}`;
  /* headline keeps the bare country name — it is a label row, not prose */
}

/* The standardized introduction. Same sentence order for every site:
     1. what it is and who runs it
     2. what it makes (the record's own `output` line)
     3. where it sits in the modeled network, with its stage shares
     4. the caveat for its kind, and its status if not simply operating */
export function facilityIntro(facility, ctx = {}) {
  const { COMPANY_BY_ID = {}, COUNTRY_NAMES = {}, STAGE_BY_ID = {}, layer = null } = ctx;
  const operator = COMPANY_BY_ID[facility.company]?.name || facility.company;
  const country = withArticle(facility.country, COUNTRY_NAMES[facility.country] || facility.country);
  const kindNoun = KIND_NOUN[facility.kind] || (KIND_LABEL[facility.kind] || facility.kind).toLowerCase();
  const sentences = [];

  // 1. identity. A site that has not opened gets a target year, not a
  // founding year — "on record since 2027" for a hole in the ground reads
  // as a data error even though the field is correct.
  const spec = [facility.node, facility.waferSize].filter(Boolean).join(', ');
  const dated = !facility.since ? ''
    : facility.status === 'construction' ? `, targeted for ${facility.since}`
    : facility.status === 'ramping' ? `, ramping since ${facility.since}`
    : `, on record here since ${facility.since}`;
  sentences.push(
    `${facility.name} is ${/^[aeiou]/i.test(kindNoun) ? 'an' : 'a'} ${kindNoun} operated by ${operator} in ${country}${dated}.`
    + ` It ${KIND_ROLE[facility.kind] || 'participates in the chain'}${spec ? ` (${spec})` : ''}.`,
  );

  // 2. output — the only free text in the profile, and it is one clause
  if (facility.output) sentences.push(`${facility.output}.`.replace(/\.\.$/, '.'));

  // 3. network position
  const stageNames = (facility.stages || []).map((sid) => STAGE_BY_ID[sid]?.name || sid);
  if (stageNames.length) {
    let s = `In the model it feeds ${list(stageNames)}`;
    if (layer) {
      const shares = (facility.stages || [])
        .map((sid) => ({ sid, share: layer.shareOfStage(facility, sid) }))
        .filter((x) => x.share > 0)
        .sort((a, b) => b.share - a.share);
      if (shares.length) {
        const top = shares[0];
        s += `, holding ${pct(top.share)} of the modeled sites for ${STAGE_BY_ID[top.sid]?.name || top.sid}`;
      }
    }
    s += `. On the 1–5 significance ordinal this dataset uses it is a ${facility.scale}, ${SCALE_WORD[Math.round(facility.scale)] || 'of unstated significance'}.`;
    sentences.push(s);
  }

  // 4. caveats that apply to this record
  const tail = [STATUS_NOTE[facility.status], KIND_CAVEAT[facility.kind]].filter(Boolean);
  if (tail.length) sentences.push(tail.join(' '));

  return sentences.join(' ');
}

/* The fixed fact table. Always the same keys in the same order, with an
   explicit em dash where a record has nothing — a missing row would let a
   reader think the field does not apply when it simply is not known. */
export function facilityFacts(facility, ctx = {}) {
  const { COMPANY_BY_ID = {}, COUNTRY_NAMES = {} } = ctx;
  return [
    ['Operator', COMPANY_BY_ID[facility.company]?.name || facility.company],
    ['Type', KIND_LABEL[facility.kind] || facility.kind],
    ['Country', COUNTRY_NAMES[facility.country] || facility.country],
    ['Coordinates', `${facility.lat.toFixed(2)}°, ${facility.lng.toFixed(2)}° (approximate)`],
    ['Process / node', facility.node || '—'],
    ['Wafer size', facility.waferSize || '—'],
    ['Status', facility.status],
    ['On record since', facility.since ? String(facility.since) : '—'],
    ['Significance (1–5)', `${facility.scale} — analyst ordinal, not capacity`],
  ];
}

/* Per-stage rows: what this site feeds and how much of that stage's modeled
   site weight it represents. */
export function facilityStageRoles(facility, ctx = {}) {
  const { STAGE_BY_ID = {}, layer = null } = ctx;
  return (facility.stages || []).map((sid) => ({
    stageId: sid,
    stageName: STAGE_BY_ID[sid]?.name || sid,
    share: layer ? layer.shareOfStage(facility, sid) : 0,
  })).sort((a, b) => b.share - a.share);
}

/* The limits that apply to THIS record — assembled, not written, so no site
   can quietly ship without them. */
export function facilityCaveats(facility) {
  const out = [
    'Coordinates are site- or city-level approximations, good to a few kilometres — enough to decide whether a plant sits inside a hazard radius, not enough to site a building.',
    'Significance is a 1–5 analyst ordinal, not capacity. Every share shown is a share of the modeled site sample, never of world capacity.',
  ];
  if (STATUS_NOTE[facility.status]) out.push(STATUS_NOTE[facility.status]);
  if (KIND_CAVEAT[facility.kind]) out.push(KIND_CAVEAT[facility.kind]);
  if (facility.source) out.push(`Source: ${facility.source}`);
  return out;
}

/* The whole profile in one call — what the detail panel and the popup both
   render, so they can never disagree about a site. */
export function facilityProfile(facility, ctx = {}) {
  return {
    id: facility.id,
    name: facility.name,
    headline: facilityHeadline(facility, ctx),
    intro: facilityIntro(facility, ctx),
    facts: facilityFacts(facility, ctx),
    stageRoles: facilityStageRoles(facility, ctx),
    caveats: facilityCaveats(facility),
  };
}
