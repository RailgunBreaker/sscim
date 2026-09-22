export const phisonAnnualDocument = {
  id: 'phison_annual_2022',
  url: 'https://www.phison.com/wp-content/uploads/2025/11/Phison_Electronic_Corporation_2022_Annual_Report.pdf',
  publicationDate: '2023-05-12', publicationDateBasis: 'report_print_date',
  // The migrated archive does not establish the original online availability date.
  informationAvailableDate: '2026-09-21', reviewedAt: '2026-09-21', format: 'pdf',
  publicationDateEvidence: 'https://www.phison.com/investor-relations/annual-reports/',
  expectedSha256: '5b7ab1df5d9d29c394db508a0738db037782fd4e2970359fd1b0084e9b8262f7',
  finding: 'Table 3 records 2022 purchases from Kioxia Taiwan and sales to Kioxia and Apacer. The supplier-concentration discussion describes the sourcing relationship but does not quantify a contamination loss.',
  limitation: 'May 12, 2023 is the printed report date. Availability is conservatively dated to this review of the migrated archive. Commercial transactions are not incident losses or proof of affected shipments.',
};

export function customerLossObservations(document) {
  if (document.id !== phisonAnnualDocument.id || document.sha256 !== phisonAnnualDocument.expectedSha256
    || document.url !== phisonAnnualDocument.url) throw new Error('Phison customer review requires the reviewed annual report');
  const source = supportingSection => ({ url: document.url, publicationDate: document.publicationDate,
    publicationDateBasis: document.publicationDateBasis, informationAvailableDate: document.informationAvailableDate,
    sha256: document.sha256, hashBasis: 'raw_bytes', supportingSection, claimStatus: 'verified' });
  const claim = { claimStatus: 'verified', review: { verifiedAt: '2026-09-21',
    provenance: 'Codex visual review of primary annual-report tables and supplier-risk discussion; not independent incident-loss validation' } };
  const transactions = [
    ['phison_purchase_kioxia_taiwan_2022', 'kioxia_taiwan', 'Kioxia Taiwan Corporation', 'phison', 'Phison Electronics Corporation', 'purchase', 11413643, 32, 302],
    ['phison_sale_kioxia_2022', 'phison', 'Phison Electronics Corporation', 'kioxia', 'Kioxia Corporation', 'sale', -1640541, -3, 302],
    ['phison_sale_apacer_2022', 'phison', 'Phison Electronics Corporation', 'apacer', 'Apacer Technology Inc.', 'sale', -1074199, -2, 303],
  ];
  return {
    customerTransactions: transactions.map(([id, supplierId, supplierName, customerId, customerName, transactionType, sourceSignedValue, sourceSignedSharePercent, page]) => ({
      ...claim, id, companyId: 'phison', incidentId: null, investigationIncidentId: 'nand_contamination_2022',
      kind: 'reported_outcome', metric: 'commercial_transaction', reportingScope: 'phison_parent_company',
      supplierId, supplierName, customerId, customerName, transactionType,
      periodStart: '2022-01-01', periodEnd: '2022-12-31', value: Math.abs(sourceSignedValue), units: 'TWD thousand',
      sourceSignedValue, sharePercent: Math.abs(sourceSignedSharePercent), sourceSignedSharePercent, percentageRoundingUnit: 1,
      shareBasis: transactionType === 'purchase' ? 'Phison parent-company total purchases' : 'Phison parent-company total sales',
      accountingBasis: 'related_party_commercial_transactions', productScope: 'Products not itemized in this transaction row',
      supplierFacilityId: null, affectedShipments: null, incidentLoss: null, inputVolumeShare: null,
      source: source(`Consolidated financial statement appendix, Table 3, printed page ${page - 12} (PDF page ${page}), parent-company transaction row`),
      interpretation: 'Annual commercial flow for follow-up. No incident attribution, facility allocation or physical supply share is established. Parentheses distinguish sales in the source table; they are not negative losses.',
    })),
    customerSupplyStatements: [{ ...claim, id: 'phison_supplier_concentration_2022_report', companyId: 'phison',
      supplierId: 'kioxia_taiwan', incidentId: null, kind: 'issuer_qualitative_assessment', statementAsOf: '2023-05-12',
      assessment: 'Phison identifies Kioxia Taiwan as its major supplier and describes supply as stable in its supplier-concentration discussion.',
      incidentLoss: null, outageDays: null, mitigationEffect: null,
      source: source('Section 7.6.9, printed page 194 (PDF page 205), concentration of purchasing sources'),
      limitation: 'General supplier-risk assessment at report time. It does not establish uninterrupted deliveries during the incident, zero losses or a measured benefit from mitigation.',
    }],
  };
}
