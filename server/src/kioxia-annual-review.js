// Reviewed against the archived PDF page images on September 20, 2026.
// Keep this source separate from incident-attributed recoveries.
export const kioxiaAnnualDocument = {
  id: 'kioxia_securities_fy2025',
  url: 'https://www.kioxia-holdings.com/content/dam/kioxia-hd/en-jp/ir/library/securities/asset/Annual-Securities-Report-FY2025-EN.pdf',
  publicationDate: '2026-06-24', reviewedAt: '2026-09-20', format: 'pdf',
  publicationDateEvidence: 'https://www.kioxia-holdings.com/en-jp/ir/library/securities.html',
  expectedSha256: '3e95d19961d6ebeec6a45875a7c7085eea5a04ed0342ff6e9659f32245d79c14',
  finding: 'Note 24 reports insurance income without incident attribution. Note 31 describes joint-operation governance. Neither establishes a 2022 contamination settlement or a disjoint loss allocation.',
  limitation: 'Partial English translation; the Japanese original prevails. Review covers Notes 24, 31, 33 and the disaster-risk disclosure. The absence of an identified settlement is not evidence of zero recovery.',
};

export function kioxiaAnnualObservations(document) {
  if (document.id !== kioxiaAnnualDocument.id || document.sha256 !== kioxiaAnnualDocument.expectedSha256)
    throw new Error('Kioxia annual review requires the reviewed source bytes');
  const source = supportingSection => ({ url: document.url, publicationDate: document.publicationDate,
    informationAvailableDate: document.publicationDate, publicationDateEvidence: document.publicationDateEvidence,
    sha256: document.sha256, hashBasis: 'raw_bytes', supportingSection, claimStatus: 'verified' });
  const review = { verifiedAt: '2026-09-20', provenance: 'Codex visual review of primary issuer PDF tables and notes; not independent causal validation' };
  return {
    unattributedRecoveries: [[2025, 2695], [2026, 188]].map(([year, value]) => ({
      id: `kioxia_unattributed_insurance_ended_${year}`, companyId: 'kioxia', incidentId: null,
      metric: 'insurance_claim_income', kind: 'reported_outcome', value, units: 'JPY million', roundingUnit: 1,
      accountingBasis: 'IFRS_other_income', periodStart: `${year - 1}-04-01`, periodEnd: `${year}-03-31`,
      attributionStatus: 'incident_unspecified', counterpartyClass: 'insurer', counterpartyId: null,
      cashAmount: null, claimStatus: 'verified', review,
      source: source('Note 24, printed page 59 (PDF page 61), Insurance claim income; columns are years ended March 2026 and March 2025'),
      interpretation: 'Company insurance income with no incident attribution in this table. Excluded from the 2022 contamination account pending an incident-specific reconciliation.',
    })),
    governanceEvidence: [{ id: 'kioxia_jv_voting_2026', companyId: 'kioxia', incidentId: null,
      asOfDate: '2026-03-31', ventureNames: ['Flash Partners, Ltd.', 'Flash Alliance, Ltd.', 'Flash Forward, LLC'],
      votingRightsShare: 0.501, controlBasis: 'equal_decision_making', accountingTreatment: 'IFRS joint operations',
      incidentCostAllocation: null, claimStatus: 'verified', review,
      source: source('Note 31, printed page 78 (PDF page 80), Joint Agreements, ownership table and following paragraph'),
      interpretation: 'Voting rights and joint control describe governance. They do not allocate contamination losses or replace the historical accounting-share disclosure.',
    }],
  };
}
