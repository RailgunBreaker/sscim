import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeAtomicJson } from '../src/atomic-json.js';
import { acquireOperationLock } from '../src/operations.js';
import { fetchPublicDocument, issuerReleaseSectionHash } from '../src/public-source-document.js';
import { kioxiaAnnualDocument, kioxiaAnnualObservations } from '../src/kioxia-annual-review.js';
import { kioxiaQuarterDocument, producerLossObservations } from '../src/producer-loss-review.js';
import { phisonAnnualDocument, customerLossObservations } from '../src/customer-loss-review.js';
import { apacerAnnualDocument, apacerCounterpartyObservations } from '../src/apacer-counterparty-review.js';
import { customerInventoryObservations } from '../src/customer-inventory-review.js';
const root = new URL('../../', import.meta.url);
const release = acquireOperationLock(fileURLToPath(new URL('server/data/operations/workflow.lock', root)));
try {
  const reviewedAt = '2026-09-17';
  const documents = [
    { ...apacerAnnualDocument },
    { ...phisonAnnualDocument },
    { ...kioxiaQuarterDocument },
    { ...kioxiaAnnualDocument },
    { id: 'wdc_2024q3', url: 'https://www.sec.gov/Archives/edgar/data/106040/000010604024000022/wdc-20240329.htm', publicationDate: '2024-04-30',
      finding: 'Note 3 reports USD 1 million quarterly and USD 37 million nine-month contamination recovery. Note 10 places the USD 36 million insurer recovery in the quarter ended December 29, 2023, recorded in cost of revenue.' },
    { id: 'wdc_2024', url: 'https://www.sec.gov/Archives/edgar/data/106040/000010604024000031/wdc-20240628.htm', publicationDate: '2024-08-20',
      finding: 'Notes 3 and 10 report USD 207 million FY2022 charge, USD 37 million FY2024 recognized recovery, and USD 36 million insurer receipt. Remaining recoveries cannot be estimated.' },
    { id: 'wdc_2026', url: 'https://www.sec.gov/Archives/edgar/data/106040/000162828026057139/wdc-20260703.htm', publicationDate: '2026-08-14',
      finding: 'Reviewed annual filing; no new quantified reimbursement attributed to the 2022 contamination incident was identified. Generic contamination risk discussion is not an incident outcome.' },
    { id: 'sandisk_2026', url: 'https://www.sec.gov/Archives/edgar/data/2023554/000162828026057406/sndk-20260703.htm', publicationDate: '2026-08-17',
      finding: 'Reviewed annual filing; no new quantified reimbursement attributed to the 2022 contamination incident was identified. Absence of a disclosure does not establish zero recovery.' },
    { id: 'kioxia_2025_circular', url: 'https://links.sgx.com/FileOpen/Kioxia%20Holdings%20Corp_946237_010_CL_NoDISC_PW_17July0630H.ashx?App=Prospectus&FileID=66909', publicationDate: '2025-07-16',
      expectedSha256: '8066a674702d2fa415d5a791ff1a2855b7fc276cd0f0fce1b5a97b9ebb3fe2f7', format: 'pdf',
      finding: 'Printed page 60 identifies JPY 7,571 million contamination-related insurance income in the year ended March 2024; excludes sales and other impacts. Printed page 98 describes 50% joint-operation accounting, not an incident loss allocation.' },
    { id: 'kioxia_fy2023', url: 'https://www.kioxia-holdings.com/content/dam/kioxia-hd/en-jp/about/asset/Financial-Results-FY2023-4Q-en.pdf', publicationDate: '2024-05-15',
      expectedSha256: 'f9382d499b2a3a722dfee94b1c14fadf1b7d584b8eff0e280b4fa48633495345', format: 'pdf',
      finding: 'Page 3 footnote 4 reports JPY 7.6 billion insurance proceeds in FY2023. The later circular supplies the precise amount and explicit incident attribution; these are corroborating views of one recovery.' },
    { id: 'kioxia_fy2022', url: 'https://www.kioxia-holdings.com/content/dam/kioxia-hd/en-jp/about/asset/Financial-Results-FY2022-4Q-en.pdf', publicationDate: '2023-05-12',
      expectedSha256: 'b08e190597583cd2468c62df2e4c0a2233cfb61fd4e78a26a29219dcea6183e4', format: 'pdf',
      finding: 'Page 3 repeats the FY2021 JPY 33.2 billion charge and shows a dash for FY2022 contamination charges. The dash is retained as reported, not treated as proof of zero economic loss.' },
    { id: 'wdc_proxy_2024', url: 'https://www.sec.gov/Archives/edgar/data/106040/000130817924000755/wdc4316471-def14a.htm', publicationDate: '2024-10-07', reviewedAt: '2026-09-18',
      expectedSha256: '1699f203ae18bf3be57b35e9aee7931332a14fa97d5dc1f84ffe9f689412f3b9',
      finding: 'Appendix A says recoveries were received in both quarters ended December 2023 and March 2024. Payer identity, payment medium and exact settlement date are not specified for March.' },
    { id: 'wdc_availability_2022', url: 'https://www.westerndigital.com/company/newsroom/press-releases/2022/2022-02-09-western-digital-comments-on-production-status-of-its-joint-venture-flash-memory-manufacturing-facilities', publicationDate: '2022-02-09', reviewedAt: '2026-09-18',
      expectedSectionSha256: '01b7676a5e5a6182355482d0858f91d7828d8ac93df698fc600dff22bc8a8ce6', sectionIssuer: 'wdc',
      finding: 'WDC initially forecast at least 6.5 exabytes of reduced availability for its own flash supply. This is not a joint-company total or measured downstream loss.' },
    { id: 'wdc_update_2022', url: 'https://www.westerndigital.com/company/newsroom/press-releases/2022/2022-03-02-western-digital-provides-update-on-production-status-and-fiscal-outlook', publicationDate: '2022-03-02', reviewedAt: '2026-09-18',
      expectedSectionSha256: 'f346f1c96be708d66c48daedecfec4ee7169ad4208714f8dec87202260d12bd3', sectionIssuer: 'wdc',
      finding: 'WDC updated the availability forecast to approximately 7 exabytes, mainly fiscal Q3/Q4, while output ramped after normal operations resumed. The USD 250-270 million outlook adjustment also includes stock compensation and other items, so is not a contamination-only loss forecast.' },
    { id: 'kioxia_restoration_2022', url: 'https://www.kioxia.com/en-jp/about/news/2022/20220303-1.html', publicationDate: '2022-03-03', reviewedAt: '2026-09-18',
      expectedSectionSha256: 'db99e7f83dc91390b6c66a0daa8eb06fb1bcc6fcb852d767b33ecf59dae64426', sectionIssuer: 'kioxia',
      finding: 'Kioxia reports normal operations restored in late February, with output still ramping and shipment impacts expected. No exact recovery day, recovered backlog volume or final customer loss is disclosed.' },
    { id: 'wdc_2022q3', url: 'https://www.sec.gov/Archives/edgar/data/106040/000010604022000040/wdc-20220401.htm', publicationDate: '2022-05-04', reviewedAt: '2026-09-18',
      expectedSha256: '24983e4f04077209dabc770d56647fce03f5fda90f9293caa80c3a7756eac936',
      finding: 'Note 10 reports USD 203 million contamination charges for both Q3 and nine months. MD&A attributes lower enterprise SSD revenues primarily to contamination-related supply impact, without quantifying that revenue loss.' },
    { id: 'wdc_2022q4_release', url: 'https://www.sec.gov/Archives/edgar/data/106040/000010604022000049/ex991-pressreleaseq422.htm', publicationDate: '2022-08-05', reviewedAt: '2026-09-18',
      expectedSha256: 'feba6f30f8d5ce25a36f3fc942a2bba9ffdeadc5e8c4c2460b416140f439d69e',
      finding: 'Preliminary earnings reconciliation reports USD 4 million Q4 contamination charges and USD 207 million annually. Enterprise SSD revenue grew 38% year over year and more than doubled sequentially; this is not a quantified recovery of the earlier shortfall.' },
    { id: 'sandisk_2025q3', url: 'https://www.sec.gov/Archives/edgar/data/2023554/000202355425000027/sndk-20250328.htm', publicationDate: '2025-05-12', reviewedAt: '2026-09-18',
      expectedSha256: '36ce1676c9c2405c0da2ff8c6fed46edfe36912825f6a0bd08c10f27eab84818',
      finding: 'MD&A repeats USD 36 million insurer recoveries for the nine months ended March 2024. Note 2 identifies pre-separation accounts as derived from WDC records. This historical flash-business view is not evidence of an additional 2025 recovery.' },
    { id: 'tsmc_photoresist_2019_guidance', url: 'https://pr.tsmc.com/system/files/newspdf/PGWQISTHTH/NEWS_FILE_EN.pdf', publicationDate: '2019-02-15', reviewedAt: '2026-09-18', format: 'pdf',
      expectedSha256: '2872fbc0b2a6dd6d56b4841e3851ca77069bdc10c70271c9559add378f97d4cf',
      finding: 'Page 1 forecasts USD 550 million Q1 revenue reduction and USD 550 million Q2 replacement revenue. The separate USD 230 million Q1 uplift combines production pull-in and stronger demand. Incident gross-margin effects are forecasts, not supplier payments or observed customer losses.' },
    { id: 'tsmc_2019q1_call', url: 'https://investor.tsmc.com/japanese/encrypt/files/encrypt_file/english/2019/Q1/TSMC%201Q19%20transcript.pdf', publicationDate: '2019-04-18', reviewedAt: '2026-09-18', format: 'pdf',
      expectedSha256: 'fae18ba8236ff760e27cc8a70203b830803fe5e4188082d328cf9dec0de391cf',
      finding: 'Page 3 retrospectively attributes about 2.6 percentage points of Q1 gross-margin reduction to photoresist, matching the February forecast. The same issuer supplies both estimates; the Q2 wafer replacement remains forward-looking.' },
    { id: 'tsmc_2019q2_report', url: 'https://investor.tsmc.com/schinese/encrypt/files/encrypt_file/english/2019/Q2/2Q19ManagementReport.pdf', publicationDate: '2019-07-18', reviewedAt: '2026-09-18', format: 'pdf',
      expectedSha256: '0770d4bdf93ca2379ccdebb966eb72f410f6c5f2caf2a0f19788c1f6163c6359',
      finding: 'Page 2 reports a 1.7 percentage-point sequential gross-margin increase driven by absence of the incident and foreign exchange. This mixed change does not isolate realized catch-up revenue or the incident-only margin contribution.' },
  ];
  for (const doc of documents) {
    let bytes;
    doc.lastFetchAttemptAt = new Date().toISOString();
    try {
      ({ bytes } = await fetchPublicDocument(doc.url));
      doc.retrievedAt = new Date().toISOString();
      doc.retrievalStatus = 'retrieved';
    } catch (error) {
      // Explicit review-time fallback only. Never promote an unpinned or changed archive.
      if (!process.argv.includes('--allow-reviewed-archive') || !doc.expectedSha256) throw error;
      const archived = new URL(`artifacts/collected/chain-loss/${doc.expectedSha256}.${doc.format || 'html'}`, root);
      bytes = readFileSync(archived);
      doc.retrievedAt = statSync(archived).mtime.toISOString();
      doc.retrievalStatus = 'reviewed_archive_network_unavailable';
      console.warn(`${doc.id}: latest retrieval unavailable; checking the previously retrieved, hash-pinned archive.`);
    }
    doc.sha256 = createHash('sha256').update(bytes).digest('hex');
    if (doc.expectedSectionSha256) {
      doc.sectionSha256 = issuerReleaseSectionHash(bytes, doc.sectionIssuer);
      doc.sectionHashBasis = doc.sectionIssuer === 'wdc' ? 'issuer_release_opening_through_outlook_before_company_boilerplate' : 'issuer_release_body_before_share_controls';
      if (doc.sectionSha256 !== doc.expectedSectionSha256) throw new Error(`${doc.id}: reviewed release text changed`);
    }
    if (doc.expectedSha256 && doc.expectedSha256 !== doc.sha256) throw new Error(`${doc.id}: reviewed source bytes changed`);
    doc.hashBasis = 'raw_bytes'; doc.reviewedAt ||= reviewedAt;
    doc.archivePath = `artifacts/collected/chain-loss/${doc.sha256}.${doc.format || 'html'}`;
    mkdirSync(new URL('artifacts/collected/chain-loss/', root), { recursive: true });
    if (doc.retrievalStatus === 'retrieved') writeFileSync(new URL(doc.archivePath, root), bytes);
    if (doc.id === 'wdc_2024q3') {
      const text = bytes.toString().replace(/<[^>]*>/g, ' ').replace(/&#160;|&nbsp;/g, ' ').replace(/\s+/g, ' ');
      if (!text.includes('Recovery from contamination incident 1') || !text.includes('37') || !text.includes('December 29, 2023')) throw new Error('Reviewed quarterly source anchors changed');
    }
  }
  const document = documents.find(d => d.id === 'wdc_2024q3');
  const source = section => ({ url: document.url, publicationDate: document.publicationDate, informationAvailableDate: document.publicationDate,
    publicationDateEvidence: 'https://www.sec.gov/Archives/edgar/data/106040/000010604024000022/0000106040-24-000022-index.htm',
    supportingSection: section, sha256: document.sha256, hashBasis: 'raw_bytes', claimStatus: 'verified' });
  const make = (id, value, start, end, counterpartyClass, section) => ({ id, companyId: 'wdc', incidentId: 'nand_contamination_2022',
    metric: 'recognized_recovery', value, units: 'USD million', roundingUnit: 1, kind: 'reported_outcome', accountingBasis: 'reported_accounting_amount',
    periodStart: start, periodEnd: end, counterpartyClass, counterpartyId: null, claimStatus: 'verified',
    review: { verifiedAt: reviewedAt, provenance: 'Codex review of primary SEC filings; not independent causal validation' }, source: source(section) });
  const records = [
    make('wdc_recovery_2024q2_insurer', 36, '2023-09-30', '2023-12-29', 'insurer', 'Note 10 Flash Ventures: receipt during the quarter ended December 29, 2023, recorded in Cost of revenue'),
    make('wdc_recovery_2024q3_unassigned', 1, '2023-12-30', '2024-03-29', 'undisclosed', 'Note 3: Recovery from contamination incident, three months ended March 29, 2024'),
    make('wdc_recovery_2024_nine_months', 37, '2023-07-01', '2024-03-29', 'mixed_or_unspecified', 'Note 3: Recovery from contamination incident, nine months ended March 29, 2024'),
  ];
  const kioxiaSource = (id, section) => {
    const doc = documents.find(d => d.id === id);
    return { url: doc.url, publicationDate: doc.publicationDate, informationAvailableDate: doc.publicationDate,
      supportingSection: section, sha256: doc.sha256, hashBasis: 'raw_bytes', claimStatus: 'verified',
      ...(doc.sectionSha256 ? { sectionSha256: doc.sectionSha256, sectionHashBasis: doc.sectionHashBasis } : {}) };
  };
  const review = { verifiedAt: reviewedAt, provenance: 'Primary issuer PDF tables and footnotes visually reviewed; disclosure verification, not independent causal validation' };
  const kioxia = (id, metric, value, roundingUnit, start, end, source) => ({ id, companyId: 'kioxia', incidentId: 'nand_contamination_2022',
    metric, value, units: 'JPY billion', roundingUnit, kind: 'reported_outcome', accountingBasis: 'IFRS_operating_income_effect',
    periodStart: start, periodEnd: end, claimStatus: 'verified', review, source });
  const preciseSource = kioxiaSource('kioxia_2025_circular', 'Printed page 60 (PDF page 73), non-GAAP operating profit reconciliation, FY ended March 31, 2024 and footnote 3');
  records.push(
    { ...kioxia('kioxia_recovery_fy2023_precise', 'recognized_recovery', 7.571, 0.001, '2023-04-01', '2024-03-31', preciseSource),
      sourceValue: 7571, sourceUnits: 'JPY million', sourceSignedAdjustment: -7571, normalizationDivisor: 1000,
      counterpartyClass: 'insurer', counterpartyId: null, cashSettlementDate: null,
      excludedScope: ['sales-related impacts', 'other related impacts', 'non-operating or non-material impacts'],
      interpretation: 'Positive insurance income; the negative source adjustment removes that income from non-GAAP profit. Not an additional expense.' },
    { ...kioxia('kioxia_recovery_fy2023_rounded', 'recognized_recovery', 7.6, 0.1, '2023-04-01', '2024-03-31',
      { ...kioxiaSource('kioxia_fy2023', 'Page 3 footnote 4: FY2023 non-GAAP reconciliation deducts JPY 7.6 billion insurance proceeds'),
        informationAvailableDate: preciseSource.publicationDate }),
      attributionSource: preciseSource, counterpartyClass: 'insurer', counterpartyId: null,
      interpretation: 'Earlier rounded insurance figure; incident attribution depends on the later circular. Corroboration only, not a second recovery.' },
    kioxia('kioxia_charge_fy2021_corroboration', 'operating_income_reduction', 33.2, 0.1, '2021-04-01', '2022-03-31',
      kioxiaSource('kioxia_fy2022', 'Page 3: FY2021 comparative contamination-related charges column and footnote 3')),
  );
  const boundaryEvidence = [{ id: 'kioxia_flash_jv_accounting', companyId: 'kioxia', incidentId: 'nand_contamination_2022',
    claimStatus: 'verified', review, source: kioxiaSource('kioxia_2025_circular', 'Printed page 98 (PDF page 111), The Flash JV Companies'),
    equityShare: 0.501, recognizedAccountShare: 0.5, outputPurchaseShare: 0.5, sandiskFixedCostShare: 0.5,
    accountingTreatment: 'IFRS joint operation: Kioxia recognizes half of JV assets, liabilities, revenue and expenses.',
    transactionPath: 'Kioxia fabricates wafers and sells to the JVs; the JVs sell output to Kioxia and Sandisk; both complete further processing and sell to their own customers.',
    incidentCostAllocation: null, disjointIncidentComponentsVerified: false,
    limitation: 'Contract and accounting shares do not identify the contamination charge components, eliminations, insurer identities or downstream losses.' }];
  const periodObservations = [{ id: 'kioxia_fy2022_charge_dash', companyId: 'kioxia', incidentId: 'nand_contamination_2022',
    metric: 'contamination_charge_presentation', periodStart: '2022-04-01', periodEnd: '2023-03-31', reportedSymbol: '-', value: null,
    claimStatus: 'verified', review, source: kioxiaSource('kioxia_fy2022', 'Page 3, contamination-related charges, FY2022 column'),
    interpretation: 'No separate amount shown in this charge row; does not establish zero sales impact or final settlement.' }];
  const newReview = { verifiedAt: '2026-09-18', provenance: 'Primary issuer releases and SEC proxy appendix reviewed; source claims retain their original forecast or reported status' };
  const wdcCharge = (id, value, start, end, doc, section) => ({ id, companyId: 'wdc', incidentId: 'nand_contamination_2022',
    metric: 'recognized_disaster_cost', value, units: 'USD million', roundingUnit: 1, kind: 'reported_outcome',
    accountingBasis: 'reported_accounting_amount', periodStart: start, periodEnd: end,
    claimStatus: 'verified', review: newReview, source: kioxiaSource(doc, section) });
  records.push(
    wdcCharge('wdc_charge_2022_nine_months', 203, '2021-07-03', '2022-04-01', 'wdc_2022q3', 'Note 10 Flash Ventures, contamination charges for the nine months ended April 1, 2022'),
    { ...wdcCharge('wdc_charge_2022q4', 4, '2022-04-02', '2022-07-01', 'wdc_2022q4_release', 'Preliminary reconciliation of GAAP to non-GAAP financial measures, contamination-related charges, quarter ended July 1, 2022'),
      outcomeStatus: 'preliminary_earnings_release' },
    { id: 'sandisk_historical_insurance_2024', companyId: 'sandisk', incidentId: 'nand_contamination_2022',
      metric: 'recognized_recovery', value: 36, units: 'USD million', roundingUnit: 1, kind: 'reported_outcome',
      accountingBasis: 'historical_flash_business_carveout', periodStart: '2023-07-01', periodEnd: '2024-03-29',
      counterpartyClass: 'insurer', counterpartyId: null, claimStatus: 'verified', review: newReview,
      source: kioxiaSource('sandisk_2025q3', 'MD&A Gross Profit and Gross Margin, nine months ended March 28, 2025 versus March 29, 2024') },
  );
  const reportingRelationships = [{ id: 'sandisk_pre_separation_accounts', fromCompanyId: 'wdc', toCompanyId: 'sandisk',
    type: 'historical_carveout', separationDate: '2025-02-21', relatedRecordId: 'sandisk_historical_insurance_2024',
    parentRecordId: 'wdc_recovery_2024q2_insurer', claimStatus: 'verified', review: newReview,
    source: kioxiaSource('sandisk_2025q3', 'Note 2 Basis of Presentation, Periods Prior to the Separation'),
    interpretation: 'Pre-separation financial statements derive from WDC accounts. The historical insurer amount is corroborating evidence and cannot be added as a new recovery. The USD 1 million difference from WDC total recovery remains unallocated.' }];
  const receiptEvidence = [{ id: 'wdc_march2024_receipt', companyId: 'wdc', incidentId: 'nand_contamination_2022',
    metric: 'recovery_receipt_disclosure', kind: 'reported_outcome', periodStart: '2023-12-30', periodEnd: '2024-03-29',
    reportedReceipt: true, value: null, cashAmount: null, paymentMedium: 'unspecified', counterpartyId: null,
    relatedRecordId: 'wdc_recovery_2024q3_unassigned', claimStatus: 'verified', review: newReview,
    source: { ...kioxiaSource('wdc_proxy_2024', 'Appendix A, Explanations of Adjustments to Non-GAAP Measures: Recovery from contamination incident'),
      publicationDateEvidence: 'https://investor.wdc.com/sec-filings/sec-filing/def-14a/0001308179-24-000755' },
    interpretation: 'Recovery receipt is reported for this quarter. The separately reported USD 1 million accounting recovery is not an independently disclosed cash amount.' }];
  const forecast = (id, value, qualifier, doc, supersedesId = null) => ({ id, companyId: 'wdc', incidentId: 'nand_contamination_2022',
    metric: 'flash_availability_reduction', value, units: 'exabytes', qualifier, kind: 'issuer_forecast',
    scopeId: 'wdc_own_flash_availability', supersedesId, permanentLoss: null, downstreamLoss: null,
    claimStatus: 'verified', review: newReview, source: kioxiaSource(doc, 'Opening production-status paragraphs and forward-looking statements') });
  const operationalEvidence = [
    forecast('wdc_flash_availability_initial', 6.5, 'at_least', 'wdc_availability_2022'),
    { ...forecast('wdc_flash_availability_update', 7, 'approximately', 'wdc_update_2022', 'wdc_flash_availability_initial'),
      expectedTiming: 'Predominantly fiscal Q3 and Q4 of FY2022; not an exact period partition' },
    { id: 'kioxia_operations_restored', companyId: 'kioxia', incidentId: 'nand_contamination_2022', kind: 'reported_outcome',
      metric: 'normal_operations_restored', facilityIds: ['kioxia_yokkaichi','kioxia_kitakami'], reportedTiming: 'late February 2022',
      exactDate: null, fullOutputRestored: null, catchupVolume: null, shipmentImpactExpected: true,
      claimStatus: 'verified', review: newReview, source: kioxiaSource('kioxia_restoration_2022', 'Both production-status paragraphs'),
      interpretation: 'Operations resumed; full output, backlog clearance and customer recovery dates remain unquantified.' },
    { id: 'wdc_q3_mixed_adjustment_forecast', companyId: 'wdc', incidentId: 'nand_contamination_2022', kind: 'issuer_forecast',
      metric: 'non_gaap_gross_margin_adjustments', lower: 250, upper: 270, units: 'USD million', periodEnd: '2022-04-01',
      causeScope: 'mixed', components: ['stock_based_compensation', 'contamination_charges', 'other_adjustments'], contaminationOnlyAmount: null,
      claimStatus: 'verified', review: newReview, source: kioxiaSource('wdc_update_2022', 'Fiscal Q3 outlook footnote 1'),
      interpretation: 'Combined outlook adjustment cannot be scored against the USD 207 million annual contamination-only charge.' },
  ];
  const productEvidence = [{ id: 'wdc_enterprise_ssd_2022q3_effect', companyId: 'wdc', incidentId: 'nand_contamination_2022',
    metric: 'enterprise_ssd_revenue_effect', kind: 'reported_outcome', periodStart: '2022-01-01', periodEnd: '2022-04-01',
    direction: 'decrease', causalStatus: 'issuer_attributed_unquantified', value: null, units: 'USD million',
    externalCustomerLoss: null, catchupAmount: null, permanentLoss: null, claimStatus: 'verified', review: newReview,
    source: kioxiaSource('wdc_2022q3', 'MD&A Results of Operations, Net Revenue, Cloud revenue discussion'),
    interpretation: 'WDC attributes lower enterprise SSD revenues primarily to contamination-related supply constraints. The amount and losses at its customers are not isolated.' },
    { id: 'wdc_enterprise_ssd_2022q4_growth', companyId: 'wdc', incidentId: 'nand_contamination_2022',
      metric: 'enterprise_ssd_revenue_growth_yoy', kind: 'reported_outcome', periodStart: '2022-04-02', periodEnd: '2022-07-01',
      value: 38, units: 'percent', causalStatus: 'growth_not_identified_catchup', outcomeStatus: 'preliminary_earnings_release',
      externalCustomerLoss: null, catchupAmount: null, permanentLoss: null, claimStatus: 'verified', review: newReview,
      source: kioxiaSource('wdc_2022q4_release', 'Page 3 End Market Summary, fourth-quarter Cloud bullet'),
      interpretation: 'Subsequent enterprise SSD revenue growth is reported; no counterfactual, deferred-sales bridge or final missed-demand amount is supplied.' }];
  const photoresist = (id, metric, value, units, kind, quarter, doc, section, extra = {}) => ({
    id, companyId: 'tsmc', incidentId: 'photoresist_contamination_2019', metric, value, units, kind,
    periodStart: quarter === 1 ? '2019-01-01' : '2019-04-01', periodEnd: quarter === 1 ? '2019-03-31' : '2019-06-30',
    claimStatus: 'verified', review: { verifiedAt: '2026-09-18', provenance: 'Primary issuer PDFs visually reviewed; management attribution is not independent causal validation' },
    source: kioxiaSource(doc, section), ...extra,
  });
  const photoresistEvidence = [
    photoresist('tsmc_q1_revenue_shortfall_forecast', 'incident_revenue_reduction', 550, 'USD million', 'issuer_forecast', 1,
      'tsmc_photoresist_2019_guidance', 'Page 1, first incident-impact bullet', { qualifier: 'approximately', causeScope: 'incident_only', direction: 'decrease' }),
    photoresist('tsmc_q2_replacement_forecast', 'replacement_revenue', 550, 'USD million', 'issuer_forecast', 2,
      'tsmc_photoresist_2019_guidance', 'Page 1, second incident-impact bullet', { qualifier: 'approximately', causeScope: 'incident_only', direction: 'increase' }),
    photoresist('tsmc_q1_mixed_uplift_forecast', 'additional_revenue', 230, 'USD million', 'issuer_forecast', 1,
      'tsmc_photoresist_2019_guidance', 'Page 1, production pull-in and demand paragraph', { qualifier: 'approximately', causeScope: 'mixed', direction: 'increase', components: ['production_pull_in', 'increased_demand'] }),
    ...[['tsmc_q1_margin_forecast', 'issuer_forecast', 'tsmc_photoresist_2019_guidance', 'Page 1, first incident-impact bullet'],
      ['tsmc_q1_margin_reported', 'reported_outcome', 'tsmc_2019q1_call', 'Page 3, management discussion of Q1 profitability']].map(([id, kind, doc, section]) =>
      photoresist(id, 'incident_gross_margin_reduction', 2.6, 'percentage points', kind, 1, doc, section,
        { qualifier: 'approximately', causeScope: 'incident_only', direction: 'decrease', scopeId: 'company_gross_margin', accountingBasis: 'issuer_attributed_margin_effect' })),
    photoresist('tsmc_q2_margin_forecast', 'incident_gross_margin_improvement', 1.5, 'percentage points', 'issuer_forecast', 2,
      'tsmc_photoresist_2019_guidance', 'Page 1, second incident-impact bullet', { qualifier: 'approximately', causeScope: 'incident_only', direction: 'increase' }),
    photoresist('tsmc_q2_margin_reported', 'total_gross_margin_change_qoq', 1.7, 'percentage points', 'reported_outcome', 2,
      'tsmc_2019q2_report', 'Page 2, Gross Profit Analysis', { causeScope: 'mixed', direction: 'increase', components: ['absence_of_photoresist_incident', 'foreign_exchange'] }),
  ];
  // Keep previously reviewed byte baselines immutable on a rerun.
  const path = new URL('docs/reference/chain-loss-verification.json', root);
  let previous;
  try { previous = JSON.parse(readFileSync(path)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const d of documents) {
    const prior = previous?.documents?.find(p => p.url === d.url);
    if (prior && (d.expectedSectionSha256 ? prior.sectionSha256 !== d.sectionSha256 : prior.sha256 !== d.sha256)) throw new Error(`${d.id}: document changed; manual re-review required`);
  }
  writeAtomicJson(path, { schemaVersion: 1, reviewedAt: '2026-09-22', records, documents, boundaryEvidence, periodObservations, receiptEvidence, operationalEvidence, reportingRelationships, productEvidence, photoresistEvidence,
    ...kioxiaAnnualObservations(documents.find(d => d.id === kioxiaAnnualDocument.id)),
    ...producerLossObservations(documents),
    ...customerLossObservations(documents.find(d => d.id === phisonAnnualDocument.id)),
    ...apacerCounterpartyObservations(documents.find(d => d.id === apacerAnnualDocument.id)),
    ...customerInventoryObservations(documents),
    limitations: ['Quarterly and annual disclosures are corroborating views, not additional losses.',
      'Receipt in the March 2024 quarter is reported; the USD 1 million counterparty, cash amount and settlement details remain unspecified.',
      'Equal reported amounts do not establish a complete time partition or the final disposition of remaining claims.'] });
  console.log(`Reviewed ${documents.length} documents; ${records.length} amount records, ${receiptEvidence.length} receipt disclosure, ${operationalEvidence.length} production/outlook records and ${photoresistEvidence.length} photoresist observations.`);
} finally { release(); }
