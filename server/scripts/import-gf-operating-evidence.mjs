// Curated transcription of reviewed primary filings, not automatic claim extraction.
// Pins prevent a changed source from silently reusing the reviewed transcription.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { acquireOperationLock } from '../src/operations.js';
import { writeAtomicJson } from '../src/atomic-json.js';
const root = new URL('../../', import.meta.url);
const release = acquireOperationLock(fileURLToPath(new URL('server/data/operations/workflow.lock', root)));
try {
  const reviewedAt = '2026-09-17';
  const review = { verifiedAt: reviewedAt, provenance: 'Codex review of primary SEC filings; not independent operational measurement' };
  const definitions = {
    annual: { url: 'https://www.sec.gov/Archives/edgar/data/1709048/000170904826000022/gfs-20251231.htm',
      date: '2026-02-27', sha256: '2e330c345eca27b7fbc85028cd56ba2240b3e3d2b5602774fa0245b44f4b1efa',
      index: 'https://www.sec.gov/Archives/edgar/data/1709048/000170904826000022/0001709048-26-000022-index.html' },
    interim: { url: 'https://www.sec.gov/Archives/edgar/data/1709048/000170904826000219/gfs-20260630_d2.htm',
      date: '2026-08-05', sha256: '661998cf22d36fe83fea81ecbf50332b8a087da9123bc44b98d5a122c96bfdd6',
      index: 'https://www.sec.gov/Archives/edgar/data/1709048/000170904826000219/0001709048-26-000219-index.htm' },
    contract: { url: 'https://www.sec.gov/Archives/edgar/data/1709048/000170904825000024/exhibit413-gfsoitecaddendu.htm',
      date: '2025-03-20', sha256: 'eddef65e8023ad1bd39df7f6aa82ef17d7413abbb0ff9c121c926ec20043b548',
      index: 'https://www.sec.gov/Archives/edgar/data/1709048/000170904825000024/0001709048-25-000024-index.html' },
  };
  const artifacts = [];
  for (const [id, definition] of Object.entries(definitions)) {
    const archivePath = `artifacts/collected/gf/${definition.sha256}.html`;
    const archive = new URL(archivePath, root);
    let bytes;
    if (process.argv.includes('--offline')) bytes = readFileSync(archive);
    else {
      const response = await fetch(definition.url, { headers: { 'User-Agent': 'SSCIM public-source research alansong0318@outlook.com' }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    if (createHash('sha256').update(bytes).digest('hex') !== definition.sha256) throw new Error(`${id}: source changed; review required before import`);
    mkdirSync(new URL('artifacts/collected/gf/', root), { recursive: true });
    if (!existsSync(archive)) writeFileSync(archive, bytes);
    artifacts.push({ id, url: definition.url, sha256: definition.sha256, hashBasis: 'raw_bytes', archivePath, bytes: bytes.length,
      reviewedAt, claimVerification: 'Manual source review; matching bytes alone do not validate claims' });
  }
  const source = (id, supportingSection) => ({ url: definitions[id].url, publicationDate: definitions[id].date,
    informationAvailableDate: definitions[id].date, publicationDateEvidence: definitions[id].index,
    supportingSection, sha256: definitions[id].sha256, hashBasis: 'raw_bytes', claimStatus: 'verified' });
  const make = (id, metric, value, units, periodEnd, src, details = {}) => ({ id, companyId: 'gf',
    kind: 'reported_operating_metric', metric, value, units, periodEnd, scope: 'GlobalFoundries consolidated',
    claimStatus: 'verified', review, source: src, incidentId: null, ...details });
  const shareSource = source('annual', 'Item 3.D Risk Factors, silicon supply chain: Soitec share of 2025 SOI wafer spend');
  const records = [
    make('gf_soitec_soi_spend_share_2025', 'supplier_procurement_spend_share', .71, 'fraction_of_soi_wafer_spend', '2025-12-31', shareSource,
      { periodStart: '2025-01-01', supplierCompanyId: 'soitec', customerCompanyId: 'gf', relationshipKind: 'company',
        productScope: 'SOI wafer procurement', inputShare: null, spendShare: .71,
        precision: 'approximately', denominator: 'GlobalFoundries SOI wafer procurement expenditure in 2025',
        limitations: 'Expenditure share is not physical input share. Not comparable to the 61% wafer-supply share reported for 2024.' }),
    make('gf_installed_capacity_2025', 'installed_capacity', 2800000, 'wafers_per_year', '2025-12-31',
      source('annual', 'Item 4.D Property, Plants and Equipment: year-end total installed capacity'),
      { precision: 'approximately 2.8 million', waferBasis: null, facilityId: null, facilityAllocation: null,
        limitations: 'The cited passage does not specify wafer diameter or equivalence. No site split; cannot calculate comparable utilization or facility shares.' }),
    make('gf_wafer_shipments_2025', 'wafer_shipments', 2300000, '300mm_equivalent_wafers', '2025-12-31',
      source('annual', 'Item 5 Operating Results, Net Revenue: annual wafer shipment volume'),
      { periodStart: '2025-01-01', precision: 'reported to 0.1 million wafers', waferBasis: '300mm_equivalent',
        limitations: 'Rounded annual shipments, not installed capacity or incident-attributed lost output.' }),
    make('gf_wafer_shipments_2026_q2', 'wafer_shipments', 625000, '300mm_equivalent_wafers', '2026-06-30',
      source('interim', 'Management discussion, Net Revenue: three months ended June 30, 2026'),
      { periodStart: '2026-04-01', precision: 'reported to one thousand wafers', waferBasis: '300mm_equivalent',
        limitations: 'Interim company-wide shipments; does not identify plant or customer allocation or disruption losses.' }),
  ];
  const components = ['inventory_work_in_progress_and_others', 'inventory_raw_materials_and_supplies', 'inventory_reserves', 'inventory_total'];
  for (const [periodEnd, amounts, document, section] of [
    ['2024-12-31', [1088, 665, -129, 1624], 'annual', 'Note 8 Inventories, 2024 comparative column'],
    ['2025-12-31', [1018, 649, -90, 1577], 'annual', 'Note 8 Inventories, 2025 column'],
    ['2026-06-30', [1136, 626, -140, 1622], 'interim', 'Note 9 Inventories, June 2026 column; USD millions per financial statement presentation'],
  ]) for (let i = 0; i < components.length; i++) records.push(make(`gf_${components[i]}_${periodEnd}`, components[i], amounts[i], 'USD_million', periodEnd,
    source(document, section), { currency: 'USD', measurementBasis: 'accounting_carrying_value', precision: 'reported to USD million',
      snapshotGroup: `gf_inventory_${periodEnd}`, inventoryDays: null, physicalQuantity: null, supplierAllocation: null,
      limitations: 'Accounting inventory at a point in time, not safety-stock days or disruption loss. Reserves are signed deductions. Comparative data retain this filing availability date.' }));
  records.push({ id: 'gf_soitec_materials_addendum_2024', companyId: 'gf', kind: 'reported_supply_contract',
    metric: 'supply_contract_terms', value: null, units: 'qualitative', periodStart: '2024-10-09',
    effectiveDate: '2024-10-09', contractId: '00037735.0', supplierCompanyId: 'soitec', customerCompanyId: 'gf', relationshipKind: 'company',
    parties: ['GlobalFoundries U.S. Inc.', 'SOITEC S.A.'], supplierAffiliate: 'Soitec Microelectronics Singapore Pte. Ltd',
    productScope: ['300mm RFSOI', 'FD products'], committedVolumes: null, unitPrices: null, supplierAllocation: null, facilityRoutes: null,
    disclosureStatus: 'public_exhibit_with_redacted_commercial_terms', claimStatus: 'verified', review,
    source: source('contract', 'Opening recitals and product/volume/price/allocation tables; commercial entries redacted'),
    limitations: 'A named supplying affiliate and its address do not establish shipments between particular plants. Redacted terms remain unknown.' });
  const dataset = { schemaVersion: 1, reviewedAt, records, sourceArtifacts: artifacts,
    limitations: ['Retrospectively collected issuer disclosures, not prospective model validation.',
      'No incident-specific counterfactual, downstream losses or whole-chain loss total is identified by these operating records.',
      'Null redacted or undisclosed values mean unknown, never zero.'] };
  const observedPath = new URL('docs/reference/observed-data.json', root);
  const observed = JSON.parse(readFileSync(observedPath));
  const relationship = { id: 'soitec_gf_soi_2025_spend', level: 'company', supplier: 'soitec', customer: 'gf',
    productScope: 'GlobalFoundries silicon-on-insulator (SOI) wafer inputs', periodEnd: '2025-12-31',
    inputShare: null, spendShare: .71, supplierRevenueShare: null,
    shareBasis: 'Approximately 71% of SOI wafer spend in 2025; physical wafer share is not disclosed in this claim',
    claimStatus: 'verified', source: shareSource, review, operatingEvidenceId: records[0].id,
    limitations: 'Preserves the commercial dependency, but expenditure concentration cannot be used as a physical input or plant-shipment share. The 2024 61% supply share has a different denominator.' };
  observed.relationships = observed.relationships.filter(r => r.id !== relationship.id).concat(relationship);
  observed.reviewedAt = reviewedAt;
  observed.sourceArtifacts = [...(observed.sourceArtifacts || []).filter(r => r.url !== shareSource.url), artifacts[0]];
  writeAtomicJson(new URL('docs/reference/gf-operating-evidence.json', root), dataset);
  writeAtomicJson(observedPath, observed);
  console.log(`Imported ${records.length} operating/contract records from ${artifacts.length} pinned primary sources; updated one company dependency.`);
} finally { release(); }
