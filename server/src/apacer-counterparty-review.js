export const apacerAnnualDocument = {
  id: 'apacer_annual_2022',
  url: 'https://www.apacer.com/upload/media/investor/financial/Annual_Report/2022_Annual_Report_EN.pdf',
  publicationDate: '2023-04-30', publicationDateBasis: 'report_print_date',
  informationAvailableDate: '2026-09-21', reviewedAt: '2026-09-21', format: 'pdf',
  expectedSha256: 'ebfea018d826bef0d5ea2b747f54ddcaa2fc0005aa5f87fe35435cfa0704ffb6',
  finding: 'Phison purchases are reported separately for Apacer parent, UD INFO and the consolidated group. The parent amount differs from Phison reported sales to Apacer; no explanation of that difference is established.',
  limitation: 'The printed date does not establish original online availability. This review establishes accounting disclosures, not incident losses, replacement purchases or uninterrupted deliveries.',
};

export function apacerCounterpartyObservations(document) {
  if (document.id !== apacerAnnualDocument.id || document.url !== apacerAnnualDocument.url
    || document.sha256 !== apacerAnnualDocument.expectedSha256) throw new Error('Apacer review requires the reviewed annual report');
  const source = supportingSection => ({ url: document.url, publicationDate: document.publicationDate,
    publicationDateBasis: document.publicationDateBasis, informationAvailableDate: document.informationAvailableDate,
    sha256: document.sha256, hashBasis: 'raw_bytes', supportingSection, claimStatus: 'verified' });
  const records = [
    ['apacer_parent_phison_purchases_2022', 'apacer_parent', 'Apacer parent company', 1073281, 'Printed page 247 (PDF page 249), related-party transaction table: The Company / Phison'],
    ['apacer_udinfo_phison_purchases_2022', 'udinfo_in_apacer_consolidation', 'UD INFO within Apacer consolidation', 130914, 'Printed page 247 (PDF page 249), related-party transaction table: UD / Phison'],
    ['apacer_group_phison_purchases_2022', 'apacer_consolidated', 'Apacer consolidated group', 1204195, 'Note 7(b)(ii), printed page 243 (PDF page 245), Phison purchases row'],
    ['apacer_parent_phison_purchases_note_2022', 'apacer_parent', 'Apacer parent company (corroborating note)', 1073281, 'Parent-only notes, printed page 312 (PDF page 314), Phison purchases row'],
  ];
  return { counterpartyPurchaseEvidence: records.map(([id, buyerScopeId, buyerScopeLabel, value, section]) => ({
    id, companyId: 'apacer', supplierId: 'phison', buyerScopeId, buyerScopeLabel, value, units: 'TWD thousand', roundingUnit: 1,
    periodStart: '2022-01-01', periodEnd: '2022-12-31', kind: 'reported_outcome', metric: 'related_party_purchases',
    accountingBasis: 'reported_2022_consolidation_scope', incidentId: null, incidentLoss: null,
    claimStatus: 'verified', review: { verifiedAt: '2026-09-21', provenance: 'Codex visual review of primary annual-report financial tables; not independent incident-loss validation' },
    source: source(section),
    limitation: 'Commercial purchases within the stated reporting scope. No incident attribution or physical shipment allocation. Repeated parent-only disclosure is corroboration, not another purchase.',
  })), counterpartyConsolidationEvidence: [{
    id: 'apacer_udinfo_consolidation_2022', companyId: 'apacer', includedCompanyId: 'udinfo',
    groupScopeId: 'apacer_consolidated', componentScopeId: 'udinfo_in_apacer_consolidation',
    kind: 'reported_consolidation_scope', controlObtainedDate: '2022-08-01', consolidationStartDate: '2022-08-01',
    claimStatus: 'verified', review: { verifiedAt: '2026-09-22', provenance: 'Codex visual review of primary business-combination note' },
    source: source('Note 6(g)(i), printed page 211 (PDF page 213), UD INFO acquisition and consolidation from acquisition date'),
    limitation: 'UD INFO entered the group during the year. Its component is retained within the reported consolidation scope, not treated as a full-year standalone purchase total.',
  }] };
}
