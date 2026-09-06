/* Canonical public-review claim decisions. syncEventEvidence writes the same
   decisions to SQLite on seed/sync/export, retaining the pre-correction row.
   Classification approval and a URL in prose are not factual verification. */
import { db } from './db.js';
import { EVENT_INCIDENTS } from '../../app/src/engine/event-assumptions.js';

export const EVIDENCE_REVISION = 'public-review-2026-09-06';
const review = { verifiedAt: '2026-09-06', provenance: 'Codex source review; automated research assistance, not human sign-off', reviewerIdentity: null };
const assumedExposure = { status: 'assumed', units: 'dimensionless stage-scope intensity', measurementBasis: 'analyst assumption', referencePeriod: null, denominator: null, basis: 'Event-model coefficients are comparative scope assumptions, not measured capacity or production-loss shares.' };
const source = (url, publisher, documentIdentifier, supportingSection, publicationDate, effectiveDate, supports, extra = {}) => ({
  url, publisher, documentIdentifier, supportingSection, publicationDate, effectiveDate,
  informationAvailableDate: publicationDate, claimStatus: 'verified', supports, ...extra,
});
const RENESAS = 'https://www.renesas.com/en/about/newsroom/update-5-final-impact-2026-kumamoto-earthquake-renesas-operations';
const VEU = 'https://www.govinfo.gov/content/pkg/FR-2025-09-02/html/2025-16735.htm';
const SUBS = 'https://www.bis.gov/media/documents/bis-guidance-may-31-2026.pdf';
const TRUCE = 'https://www.mofcom.gov.cn/zwgk/zcfb/art/2025/art_b1ec77dd3f0d4762952904df7cdaadec.html';
const HBM2024 = 'https://www.federalregister.gov/documents/2024/12/05/2024-28270/foreign-produced-direct-product-rule-additions-and-refinements-to-controls-for-advanced-computing';

export const EVENT_EVIDENCE_REVIEWS = {
  e1: {
    occurrence: { status: 'unresolved', claim: 'The particular July 3, 2026 interim final rule and its alleged first HBM controls have not been verified.', basis: 'Targeted BIS and Federal Register searches did not identify a matching July 3 rule. Section C of 2024-28270 already introduces HBM controls. It does not establish this separate 2026 event.' },
    operationalStatus: { status: 'unknown', basis: 'No exact 2026 rule identified; claimed August 2 effective date is unsupported.' },
    baseline: { eligible: false, reason: 'Exact dated incident unresolved; the 2024 rule is contextual contradiction evidence, never a replacement citation.' },
    sources: [source(HBM2024, 'Bureau of Industry and Security / Federal Register', '2024-28270; 89 FR 96790', 'Section C, Addition of High Bandwidth Memory (HBM) Controls', '2024-12-05', null, ['context'], { relation: 'contradicts first-time HBM claim; does not verify July 2026 incident' })],
  },
  p260807_man0807: {
    occurrence: { status: 'unresolved', claim: 'August 7 DDR4 USD 42.45 print, 3.28% increase and linked allocation assertions are not verified against an accessible original source.' },
    operationalStatus: { status: 'unknown', basis: 'A secondary price story alone does not establish measured physical supply disruption at HBM producers.' },
    baseline: { eligible: false, reason: 'Original cited page could not be read; exact dated multi-claim narrative remains unresolved.' },
    sources: [{ url: 'https://tech-insider.org/dram-ram-price-crisis-2026/', publisher: 'Tech Insider', documentIdentifier: 'dram-ram-price-crisis-2026', supportingSection: null, publicationDate: null, effectiveDate: null, informationAvailableDate: null, claimStatus: 'unresolved', accessStatus: 'unavailable during review', supports: [] }],
  },
  x2508_veurevoke: {
    occurrence: { status: 'verified', claim: 'BIS removed the named Intel Dalian, Samsung China and SK hynix China entities from the VEU list, effective December 31, 2025.' },
    operationalStatus: { status: 'partially_verified', basis: 'Dated removal of general authorisation is supported. Individual licences, tool shipments and actual fab throughput are not measured here; the persistent procurement exposure is an assumption, not a claim that factories stopped.' },
    baseline: { eligible: true, reason: 'Verified authorisation change; restricted to assumed direct equipment-procurement exposure.' },
    sources: [source(VEU, 'Bureau of Industry and Security / U.S. Government Publishing Office', '2025-16735; 90 FR 42321; Docket 250825-0144', 'Summary; Dates; I Background; II Removals; amendment to supplement 7 of part 748', '2025-09-02', '2025-12-31', ['occurrence', 'operational_status'], { informationAvailableDate: '2025-08-29', informationDateBasis: 'Document footer records public filing on August 29, 2025 at 08:45.' })],
  },
  h2607_kumamoto: {
    occurrence: { status: 'verified', claim: 'The July 28 earthquake disrupted Renesas Kawashiri. Phased production resumed August 4; wafer-input capacity returned to its pre-earthquake level on August 23.' },
    operationalStatus: { status: 'verified_scoped', basis: 'Kawashiri wafer-input restoration only, reported August 24. Finished output, shipments, backlog and other operators are outside this verified scope.' },
    baseline: { eligible: true, reason: 'Corrected to the verified Kawashiri wafer-input component; observed recovery overrides that component. Wider original earthquake narrative remains in the audit trail and unverified reports.' },
    sources: [source(RENESAS, 'Renesas Electronics Corporation', 'Update 5 (FINAL) - Impact of the 2026 Kumamoto Earthquake on Renesas Operations', 'Body paragraph 2: phased resumption and pre-earthquake wafer input capacity', '2026-08-24', '2026-08-23', ['occurrence', 'operational_status', 'recovery'])],
  },
  h2606_subs: {
    occurrence: { status: 'verified', claim: 'May 31 BIS guidance confirms enforcement of an existing advanced-computing licence requirement for D:5/Macau-headquartered entities and ultimate parents, including recipients elsewhere.' },
    operationalStatus: { status: 'verified_scoped', basis: 'The guidance describes a preexisting requirement and explicitly does not require bona fide compliant data-center operators to cease ongoing use, storage, disposal or servicing.' },
    baseline: { eligible: false, reason: 'Verified clarification of existing controls; no separately evidenced new physical or procurement disruption. Retained as context, not an independent adverse shock.' },
    sources: [source(SUBS, 'Bureau of Industry and Security', 'bis-guidance-may-31-2026.pdf', 'Page 1, paragraphs 1-4, especially preexisting requirement and ongoing-use qualification', '2026-05-31', null, ['occurrence', 'operational_status'])],
  },
  h2510_truce: {
    occurrence: { status: 'verified', claim: 'MOFCOM and GACC Announcement 70 suspended Announcements 55, 56, 57, 58, 61 and 62 from November 7, 2025 through the stated November 10, 2026 endpoint.' },
    operationalStatus: { status: 'verified_scoped', basis: 'The notice supports the specified suspension and dates; it does not measure shipments or abolish every materials control.' },
    baseline: { eligible: true, reason: 'Verified suspension within its dated window. Modeled relief intensity is assumed, and direct exposure is restricted to materials.' },
    sources: [source(TRUCE, 'Ministry of Commerce and General Administration of Customs, China', 'MOFCOM/GACC Announcement 2025 No. 70', 'Operative paragraph listing suspended announcements and ending date', '2025-11-07', '2025-11-07', ['occurrence', 'operational_status'])],
  },
  h2603_memorypeak: {
    occurrence: { status: 'unresolved', claim: 'The March 10 record mixes Q1 assertions with later Q2 figures; exact source locations and information dates are unresolved.' },
    operationalStatus: { status: 'unknown', basis: 'Forecasts and later observations are not established as information available on the recorded date.' },
    baseline: { eligible: false, reason: 'Unresolved dated claims; grouped with the broader commodity-memory allocation episode, not scored as an independent shock.' }, sources: [],
  },
  h2512_memory: {
    occurrence: { status: 'unresolved', claim: 'Broad shortage episode has generic publisher attribution but no verified source supporting this exact dated narrative.' },
    operationalStatus: { status: 'unknown', basis: 'No reviewed operational status source for the modeled scope.' },
    baseline: { eligible: false, reason: 'Exact claim not reviewed; primary of one commodity-memory allocation episode pending evidence.' }, sources: [],
  },
};

export const EVENT_FACT_CORRECTIONS = {
  x2508_veurevoke: {
    title: 'BIS revokes three China VEU authorisations',
    summary: 'A final rule removes Intel Dalian, Samsung China and SK hynix China from the VEU list, effective December 31, 2025.',
    first: 'The named entities lose a general authorisation for eligible items. Applicable licensing and other authorisations govern subsequent transactions.',
    second: 'Procurement friction can affect equipment availability; no measured fab shutdown, universal shipment ban or global capacity loss is established by this rule.',
    detail: 'FR document 2025-16735 was filed August 29 and published September 2, 2025. The rule supports authorisation removal and its effective date, not the earlier assertions that every spare requires an individual licence or that one third of global output is disrupted. Source injections cover equipment only; fab consequences are propagated.',
    source: VEU,
  },
  h2607_kumamoto: {
    title: 'Kumamoto earthquake disrupts Renesas Kawashiri wafer input; restoration reported',
    summary: 'Renesas confirms disruption after the July 28 earthquake, phased restart from August 4 and restoration of Kawashiri wafer-input capacity on August 23, reported August 24.',
    first: 'Verified physical scope: Kawashiri wafer input. The recovery evidence is effective in the model only when the August 24 publication is available.',
    second: 'Finished-chip output, shipments, backlog and the other operators in the original narrative remain unverified here; they are not direct source injections.',
    watch: 'Evidence for finished output and shipment recovery; verified status of other affected sites',
    detail: 'The corrected factual component is restricted to the site and process observed by Renesas. An assumed analog-stage intensity is retained for comparison and is not measured capacity share. Original wider claims and timelines are preserved in event_evidence.original_record_json and the linked reports. Restoration of wafer input is not earthquake-wide or downstream recovery.',
    source: RENESAS,
    stages: ['analog'],
    timeline: [['Jul 28, 2026', 'Earthquake disruption reported retrospectively by Renesas'], ['Aug 4, 2026', 'Phased production restart'], ['Aug 23, 2026', 'Kawashiri wafer-input capacity restored'], ['Aug 24, 2026', 'Final update published; recovery evidence becomes available']],
  },
  h2606_subs: {
    title: 'BIS clarifies enforcement of existing overseas-entity chip controls',
    dateISO: '2026-05-31', date: 'May 31, 2026',
    summary: 'May 31 guidance confirms continuing enforcement of licence requirements for specified advanced-computing items destined for entities with D:5/Macau headquarters or ultimate parents.',
    first: 'The guidance describes a preexisting requirement introduced in November 2023, subject to applicable exceptions.',
    second: 'Bona fide compliant data-center operators are not required by this guidance to stop ongoing use, storage, disposal or servicing.',
    detail: 'This is a clarification of enforcement after the AI Diffusion Rule, not evidence of a newly extended June 1 ban or an observed independent supply cut. Retained as verified policy context with no separate operational source.',
    source: SUBS, timeline: [['May 31, 2026', 'BIS guidance published']],
  },
  h2510_truce: {
    title: 'China suspends specified October materials controls for one year',
    summary: 'Announcement 70 suspends six specified 2025 announcements from November 7, 2025 to November 10, 2026.',
    first: 'The named controls are suspended in the documented window; the notice does not suspend all materials export requirements.',
    second: 'Materials-stage relief is a comparative assumption. Downstream analog consequences are propagated rather than separately injected.',
    detail: 'MOFCOM/GACC Announcement 2025 No. 70 gives the formal suspension window. The October 30 date remains the episode anchor; the model activates the suspension eight days later when the November 7 notice is available. The model uses a half-open window ending November 10, a declared day-resolution endpoint convention.',
    source: TRUCE,
  },
};

function defaultReview(row) {
  return {
    occurrence: { status: 'unresolved', claim: row.title, basis: 'Legacy citation or review approval has not been checked against the exact claim in this audit.' },
    operationalStatus: { status: 'unknown', basis: 'No claim-level operational-status verification recorded.' },
    baseline: { eligible: false, reason: 'Unreviewed factual record is excluded by default; retain for context and later review.' },
    sources: [],
  };
}

export function syncEventEvidence() {
  const rows = db.prepare('SELECT * FROM events').all();
  const insert = db.prepare('INSERT OR IGNORE INTO event_evidence (event_id, revision, evidence_json, original_record_json) VALUES (?, ?, ?, ?)');
  const columns = { dateISO: 'date_iso', date: 'date', title: 'title', summary: 'summary', first: 'first', second: 'second', watch: 'watch', detail: 'detail', source: 'source', stages: 'stages_json', timeline: 'timeline_json' };
  db.transaction(() => {
    for (const row of rows) {
      const decision = EVENT_EVIDENCE_REVIEWS[row.id] || defaultReview(row);
      const evidence = { revision: EVIDENCE_REVISION, ...decision, exposure: assumedExposure, review: EVENT_EVIDENCE_REVIEWS[row.id] ? review : { verifiedAt: null, provenance: 'Default evidence quarantine; exact claim not reviewed', reviewerIdentity: null } };
      insert.run(row.id, EVIDENCE_REVISION, JSON.stringify(evidence), JSON.stringify(row));
      const correction = EVENT_FACT_CORRECTIONS[row.id];
      if (correction) {
        const values = Object.entries(correction).map(([key, value]) => key === 'stages' || key === 'timeline' ? JSON.stringify(value) : value);
        db.prepare(`UPDATE events SET ${Object.keys(correction).map((key) => `${columns[key]} = ?`).join(', ')} WHERE id = ?`).run(...values, row.id);
        if (correction.dateISO) db.prepare("UPDATE events SET days_ago = CAST(julianday(COALESCE((SELECT value FROM meta WHERE key='snapshot_date'), '2026-09-04')) - julianday(date_iso) AS INTEGER) WHERE id = ?").run(row.id);
      }
      const incident = EVENT_INCIDENTS[row.id];
      if (incident) db.prepare('UPDATE events SET incident_id = ?, incident_role = ? WHERE id = ?').run(incident.incident, incident.role, row.id);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('data_revision', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(EVIDENCE_REVISION);
  })();
  return { records: rows.length, reviewed: Object.keys(EVENT_EVIDENCE_REVIEWS).length };
}
