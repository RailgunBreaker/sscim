// Reviewed primary-source facts; rerunning does not infer new claims from a URL.
import { readFileSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
const root = new URL('../../', import.meta.url);
const review = { verifiedAt: '2026-09-08', provenance: 'Primary-source review; Kioxia table and LG circular page visually checked. Verification concerns disclosure, not causal accuracy.' };
const source = (url, publicationDate, supportingSection, sha256) => ({ url, publicationDate, informationAvailableDate: publicationDate, supportingSection, claimStatus: 'verified', ...(sha256 ? { sha256, hashBasis: 'raw_bytes' } : {}) });
const gm = source('https://news.gm.com/home.detail.html/Pages/news/us/en/2021/oct/1012-boltev.html', '2021-10-12', 'Opening two paragraphs: recall charges and estimated recovery');
const lg = source('https://links.sgx.com/FileOpen/LGES%202024%20-%20Final%20Offering%20Circular%20%28dd%2024.06.24%29.ashx?App=Prospectus&FileID=63194', '2024-06-24', 'PDF pages 22–23, printed pages 13–14: Hyundai replacement agreement and Bolt cost sharing', '36436f4b51c12bafc2f8cd939054390b4b6b262e80e4719bd42a9bc832d2428d');
const kioxia = source('https://www.kioxia-holdings.com/content/dam/kioxia-hd/en-jp/about/asset/Financial-Results-FY2021-4Q-en.pdf', '2022-05-13', 'Page 3, FY21 contamination-related charges and footnote 3', 'c0e6c289db7b48708e14e194774cc784db437360832d24fa95530681aa42e54f');
const account = (id, companyId, incidentId, value, units, boundaryLabel, src, extra = {}) => ({
  id, companyId, incidentId, value, units, boundaryLabel, costBoundaryId: id, perspectiveId: companyId,
  accountingBasis: 'disclosed_recall_cost_estimate', metric: 'recall_cost', scopeType: 'recall_population',
  snapshotDate: src.publicationDate, periodStart: null, periodEnd: null,
  sector: 'batteries_and_vehicles', causeScope: 'battery_defect_recall', kind: 'issuer_retrospective_estimate',
  claimStatus: 'verified', source: src, review, ...extra,
});
const accounts = [
  account('gm_bolt_2021', 'gm', 'bolt_battery_recall', 2000, 'USD million', 'GM recall charges disclosed October 2021', gm, {
    accountingBasis: 'reported_charges_with_estimated_recovery', kind: 'reported_outcome',
    valueTiming: 'Charges disclosed by October 12, 2021; recovery announced for Q3 earnings.',
  }),
  account('lg_bolt_estimate', 'lg_electronics', 'bolt_battery_recall', 1400, 'KRW billion', 'Combined LG reimbursement estimate, as described in June 2024', lg, {
    perspectiveId: 'lg_combined', valueTiming: 'Historical October 2021 estimate; July 2022 sharing agreement. Not a refreshed final cost.',
  }),
  account('hyundai_replacement_estimate', 'hyundai', 'hyundai_battery_recall', 1000, 'KRW billion', 'Hyundai battery-system replacement estimate', lg, {
    perspectiveId: 'lges_disclosure', qualifier: 'approximately', valueTiming: 'March 2021 agreement described in June 2024; cumulative cash paid not disclosed here.',
  }),
  account('kioxia_contamination_fy2021', 'kioxia', 'nand_contamination_2022', 33.2, 'JPY billion', 'Kioxia FY2021 contamination charge', kioxia, {
    sector: 'semiconductors', causeScope: 'material_contamination', kind: 'reported_outcome',
    accountingBasis: 'IFRS_operating_income_charge', metric: 'operating_income_reduction', scopeType: 'accounting_period',
    periodStart: '2021-04-01', periodEnd: '2022-03-31', sourceSignedAmount: -33.2,
  }),
];
const prior = JSON.parse(readFileSync(new URL('docs/reference/loss-reconciliations.json', root)));
const wdc = prior.records.find(r => r.id === 'wdc_contamination_fy2022');
if (!wdc) throw new Error('Missing original Western Digital record');
accounts.push(account('wdc_contamination_linked', 'wdc', 'nand_contamination_2022', wdc.value, wdc.units, 'Western Digital FY2022 contamination charge', wdc.source, {
  sector: 'semiconductors', causeScope: 'material_contamination', kind: wdc.kind, metric: wdc.metric,
  accountingBasis: wdc.accountingBasis, scopeType: 'accounting_period', periodStart: wdc.periodStart, periodEnd: wdc.periodEnd,
  recordReference: 'docs/reference/loss-reconciliations.json#' + wdc.id,
}));
const rules = [];
function rule(id, baseId, supplierCompanyId, type, value, src, effectiveMonth, extra = {}) {
  const b = accounts.find(a => a.id === baseId);
  rules.push({ id, baseId, supplierCompanyId, customerCompanyId: b.companyId, relationshipKind: 'incident_cost_reimbursement',
    costBoundaryId: b.costBoundaryId, incidentId: b.incidentId, units: b.units, accountingBasis: b.accountingBasis,
    metric: b.metric, causeScope: b.causeScope, scopeType: b.scopeType,
    perspectiveId: b.perspectiveId, snapshotDate: b.snapshotDate, periodStart: b.periodStart, periodEnd: b.periodEnd,
    type, value, kind: type === 'fixed_amount' ? 'issuer_retrospective_estimate' : 'disclosed_contract',
    effectiveMonth, claimStatus: 'verified', source: src, review, ...extra });
}
rule('gm_lg_recovery', 'gm_bolt_2021', 'lg_electronics', 'fixed_amount', 1900, gm, '2021-10', { settlementStatus: 'estimated_recovery', amountMeaning: 'GM estimated recovery from LG; cash receipt not established.' });
rule('lg_equal_sharing', 'lg_bolt_estimate', 'lg_energy_solution', 'cost_share', 0.5, lg, '2022-07', { settlementStatus: 'agreed_cost_share', amountMeaning: 'Application to the historical combined estimate; not a final payment.' });
rule('hyundai_lges_sharing', 'hyundai_replacement_estimate', 'lg_energy_solution', 'cost_share', 0.7, lg, '2021-03', { qualifier: 'approximately', settlementStatus: 'monthly_payments_reported_amount_unknown', amountMeaning: 'Approximate share; monthly payments reported, cumulative paid amount absent.' });
const data = { schemaVersion: 1, reviewedAt: review.verifiedAt,
  entities: [['gm','General Motors'],['lg_electronics','LG Electronics'],['lg_energy_solution','LG Energy Solution'],['hyundai','Hyundai Motor'],['kioxia','Kioxia'],['wdc','Western Digital']].map(([id,name]) => ({id,name,type:'company'})),
  accounts, rules,
  scopeGaps: [
    { incidentId: 'bolt_battery_recall', sectors: ['batteries_and_vehicles'], unmeasured: ['final cash settlement','consumer losses','production interruption','legal costs outside each disclosed base'], reason: 'GM and LG estimates have different perspectives and currencies; they are overlapping views.' },
    { incidentId: 'hyundai_battery_recall', sectors: ['batteries_and_vehicles'], unmeasured: ['cumulative payments','losses outside battery replacement'], reason: 'Replacement estimate covers one disclosed cost boundary.' },
    { incidentId: 'nand_contamination_2022', sectors: ['semiconductors'], unmeasured: ['material supplier identity and reimbursement','downstream customer losses','intercompany overlap'], reason: 'Company charges do not establish supplier responsibility or an additive chain total.' },
  ],
  limitations: ['Battery recalls extend sector coverage; they do not calibrate semiconductor disruption propagation.', 'Historical disclosures are dated snapshots, not current outstanding balances.', 'Unknown losses outside the declared boundaries remain unquantified.'],
};
writeAtomicJson(new URL('docs/reference/supplier-loss-allocations.json', root), data);
console.log(JSON.stringify({accounts:accounts.length,rules:rules.length}));
