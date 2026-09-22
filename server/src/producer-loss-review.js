// Incident accounting boundaries reviewed on September 21, 2026.
export const kioxiaQuarterDocument = {
  id: 'kioxia_fy2022q1',
  url: 'https://www.kioxia-holdings.com/content/dam/kioxia-hd/en-jp/about/asset/Financial-Results-FY2022-1Q-en.pdf',
  publicationDate: '2022-08-10', reviewedAt: '2026-09-21', format: 'pdf',
  expectedSha256: 'a1a35d72b286b5ad8d489c88a299aa0ffe303f808a4f82ae8236ef2d99f6212d',
  finding: 'Pages 3-4 report quarterly sales and attribute shipment disruption to both contamination and COVID-19 interruptions. The sales difference is not an incident-only loss.',
};
const hashes = {
  wdc_2024: 'c151243f9f20a24ba3ee7ff9e0001ae13b57c25707e2cd6c32384deab66fe0ac',
  kioxia_2025_circular: '8066a674702d2fa415d5a791ff1a2855b7fc276cd0f0fce1b5a97b9ebb3fe2f7',
  [kioxiaQuarterDocument.id]: kioxiaQuarterDocument.expectedSha256,
};
export function producerLossObservations(documents) {
  const source = (id, supportingSection) => {
    const matches = documents.filter(d => d.id === id);
    if (matches.length !== 1 || matches[0].sha256 !== hashes[id]) throw new Error(`${id}: reviewed producer source missing or changed`);
    const d = matches[0];
    return { url: d.url, publicationDate: d.publicationDate, informationAvailableDate: d.publicationDate,
      sha256: d.sha256, hashBasis: 'raw_bytes', supportingSection, claimStatus: 'verified' };
  };
  const review = { verifiedAt: '2026-09-21', provenance: 'Codex review of primary WDC filing and visually inspected Kioxia PDF pages; disclosure reconciliation, not independent causal validation' };
  const claim = { claimStatus: 'verified', review, kind: 'reported_outcome' };
  const wdcSource = source('wdc_2024', 'Note 10, Flash Ventures, printed page 87: utilization costs and February 2022 contamination charges');
  return {
    producerCostEvidence: [
      { ...claim, id: 'wdc_contamination_cost_scope', companyId: 'wdc', incidentId: 'nand_contamination_2022',
        metric: 'recognized_disaster_cost', value: 207, units: 'USD million', periodStart: '2021-07-03', periodEnd: '2022-07-01',
        accountingLine: 'cost_of_revenue', accountingBasis: 'reported_accounting_amount', relatedRecordId: 'wdc_contamination_fy2022',
        components: [
          { id: 'inventory_and_rework', label: 'Inventory written off and reprocessing', value: null },
          { id: 'decontamination_and_restoration', label: 'Cleanup and restoring production', value: null },
          { id: 'underabsorbed_overhead', label: 'Unabsorbed manufacturing overhead', value: null },
        ], componentCoverage: 'principal_categories_not_exhaustive', source: wdcSource,
        limitation: 'The filing names principal categories without amounts. This accounting charge is not a measured physical-damage total or a downstream loss.' },
      { ...claim, id: 'kioxia_contamination_cost_scope', companyId: 'kioxia', incidentId: 'nand_contamination_2022',
        metric: 'operating_income_reduction', value: 33.2, units: 'JPY billion', periodStart: '2021-04-01', periodEnd: '2022-03-31',
        accountingLine: 'cost_of_sales', accountingBasis: 'IFRS_operating_income_effect', relatedRecordId: 'kioxia_charge_fy2021_corroboration',
        components: [], componentCoverage: 'not_itemized',
        source: source('kioxia_2025_circular', 'Printed page 73 (PDF page 86), Incident of use of contaminated material in certain manufacturing process'),
        limitation: 'The circular locates the charge in cost of sales. It does not supply component amounts or an elimination bridge to WDC and the joint ventures.' },
    ],
    otherCauseCosts: [[2023, 286, '2022-07-02', '2023-06-30'], [2024, 249, '2023-07-01', '2024-06-28']].map(([year, value, periodStart, periodEnd]) => ({
      ...claim, id: `wdc_demand_utilization_${year}`, companyId: 'wdc', incidentId: null,
      metric: 'underutilization_cost', value, units: 'USD million', periodStart, periodEnd,
      accountingBasis: 'reported_accounting_amount', causeScope: 'demand_alignment', source: wdcSource,
      interpretation: 'The issuer attributes these costs to reducing wafer supply to match demand. They are excluded from the 2022 contamination account.',
    })),
    companySalesEvidence: [[2022, 1, 393.8, '2022-01-01', '2022-03-31'], [2022, 2, 367.3, '2022-04-01', '2022-06-30']]
      .map(([year, quarter, value, periodStart, periodEnd]) => ({
        ...claim, id: `kioxia_sales_calendar_${year}q${quarter}`, companyId: 'kioxia', incidentId: null,
        metric: 'company_sales', value, units: 'JPY billion', roundingUnit: 0.1, periodStart, periodEnd,
        accountingBasis: 'IFRS_company_sales', source: source(kioxiaQuarterDocument.id, 'Page 3, Sales row: FY21 Q4 and FY22 Q1'),
      })),
    salesAttributionEvidence: [{ ...claim, id: 'kioxia_sales_2022q2_mixed_causes', companyId: 'kioxia',
      incidentId: 'nand_contamination_2022', metric: 'shipment_disruption_attribution', periodStart: '2022-04-01', periodEnd: '2022-06-30',
      causeScope: 'mixed', components: ['manufacturing_contamination', 'covid_assembly_test_logistics'],
      reportedBitGrowth: 'Low-20% decrease', bitGrowthValue: null, reportedYenAspGrowth: 'Low-teens % increase',
      priceContext: 'Yen-denominated prices also benefited from a stronger US dollar.',
      source: source(kioxiaQuarterDocument.id, 'Page 4, Recent Sales Trends table and accompanying bullets'),
      incidentSalesLoss: null, customerLoss: null, catchupAmount: null,
    }],
  };
}
