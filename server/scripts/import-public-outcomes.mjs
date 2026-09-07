// Transcription of reviewed primary-source tables, not generated observations.
// Idempotent: only these named records are replaced; other curation is retained.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const target = new URL('../../docs/reference/observed-data.json', import.meta.url);
const data = JSON.parse(readFileSync(target));
const review = { verifiedAt: '2026-09-07', provenance: 'Codex primary-document review, including rendered financial tables; not independent human adjudication' };
const source = (url, date, section) => ({ url, publicationDate: date, informationAvailableDate: date, supportingSection: section, claimStatus: 'verified' });
const sources = {
  r21q1: source('https://www.renesas.com/en/document/ppt/2021-1q-presentation-material', '2021-04-28', 'Page 15, Impact from disasters: actual and outlook; billions of yen'),
  r21q2: source('https://www.renesas.com/en/document/ppt/2021-2q-presentation-material', '2021-07-29', 'Page 15, Fire impact, 2Q Actual column; units confirmed by Q1 table and Q2 transcript'),
  r22q1: source('https://www.renesas.com/en/document/ppt/2022-1q-presentation-material', '2022-04-27', 'Page 13, Earthquake impact; billions of yen'),
  r22q2: source('https://www.renesas.com/en/document/ppt/2022-2q-presentation-material', '2022-07-28', 'Page 22, Financial impact: result and forecast; actual and forecast columns kept separate'),
  t18: source('https://www.sec.gov/Archives/edgar/data/1046179/000119312518328409/d640016d6k.htm', '2018-11-16', 'Note 38, Significant losses from disasters; filing signature dated November 16'),
  nxp: source('https://www.sec.gov/Archives/edgar/data/1413447/000141344723000006/nxpi-20221231.htm', '2023-03-01', 'Commitments and contingencies, winter weather insurance proceeds; 2021 recognized amount'),
};
const financial = [];
function money(incidentId, companyId, periodStart, periodEnd, metric, amount, units, kind, src, limitations) {
  financial.push({ id: `${incidentId}_${periodEnd}_${metric}_${kind}`, incidentId, companyId, periodStart, periodEnd,
    metric, amount, units, kind, measurementBasis: metric === 'recognized_disaster_cost' || metric === 'insurance_proceeds' ? 'reported_accounting_amount' : 'issuer_attributed_impact',
    roundingUnit: units === 'JPY billion' ? .1 : units === 'USD million' ? 1 : .000001,
    claimStatus: 'verified', source: src, review, limitations });
}
const metrics = ['revenue_impact', 'operating_profit_impact_non_gaap', 'operating_profit_impact_gaap'];
const limit = 'Company-attributed effect for the specified quarter, not an independently identified causal effect. GAAP and non-GAAP are separate outcomes; do not add them together.';
function row3(incident, period, values, kind, src) {
  metrics.forEach((metric, i) => money(incident, 'renesas', `${period.slice(0, 4)}-${period.endsWith('03-31') ? '01' : '04'}-01`, period, metric, values[i], 'JPY billion', kind, src, limit));
}
row3('fukushima_earthquake_2021', '2021-03-31', [-2.4, -2.4, -3], 'reported_outcome', sources.r21q1);
row3('renesas_naka_fire_2021', '2021-06-30', [-12.6, -11.4, -19.3], 'reported_outcome', sources.r21q2);
row3('renesas_naka_fire_2021', '2021-06-30', [-17, -14, -21.5], 'issuer_forecast', sources.r21q1);
row3('fukushima_earthquake_2022', '2022-03-31', [-.7, -1.2, -2.1], 'reported_outcome', sources.r22q1);
row3('fukushima_earthquake_2022', '2022-06-30', [-2.2, -1.4, -2.1], 'reported_outcome', sources.r22q2);
row3('fukushima_earthquake_2022', '2022-06-30', [-2.6, -1.6, -2.5], 'issuer_forecast', sources.r22q1);
money('renesas_naka_fire_2021', 'renesas', '2021-04-01', '2021-06-30', 'gross_shipment_revenue_impact', -18.7, 'JPY billion', 'reported_outcome', sources.r21q2, 'Gross shipment-reduction impact before recovery measures; not the net revenue effect.');
money('renesas_naka_fire_2021', 'renesas', '2021-04-01', '2021-06-30', 'revenue_recovered_by_countermeasures', 6, 'JPY billion', 'reported_outcome', sources.r21q2, 'Inventory shipments, alternate production and procurement measures combined. Not a measured inventory-only effect. Published rounded figures do not exactly reconcile to net revenue.');
money('tsmc_virus_2018', 'tsmc', '2018-07-01', '2018-09-30', 'recognized_disaster_cost', 2.596046, 'TWD billion', 'reported_outcome', sources.t18, 'NT$2,596,046 thousand converted to billions. Cost of revenue, not lost revenue; do not equate it with the earlier percentage revenue forecast.');
money('texas_winter_storm_2021', 'nxp', '2021-01-01', '2021-12-31', 'insurance_proceeds', 177, 'USD million', 'reported_outcome', sources.nxp, 'Recognized insurance proceeds offsetting operational losses; not an independently measured gross loss or cash receipt date.');

const observed = [];
function observation(id, incidentId, incidentDate, observedAt, companyId, facilityId, scope, metric, denominator, value, src, limitations) {
  observed.push({ id, incidentId, incidentDate, observedAt, companyId, facilityId, scope, metric, denominator, value,
    units: 'fraction', kind: 'observed', claimStatus: 'verified', source: src, review, limitations });
}
observation('tsmc_virus_tools_complete_2018', 'tsmc_virus_2018', '2018-08-03', '2018-08-06', 'tsmc', null,
  'TSMC Taiwan tools affected by August 2018 virus', 'tools_restored', 'tools affected by this incident', { low: 1, high: 1 }, sources.t18,
  'Confirmed retrospectively in November filing. The August 5 forecast cannot be used as August 6 outcome evidence. Tools are not shipments.');
observation('kawashiri_lightning_20220711', 'kawashiri_voltage_drop_2022', '2022-07-05', '2022-07-11', 'renesas', 'renesas_kawashiri',
  'Renesas Kawashiri factory', 'wafer_input_capacity_restored', 'pre-voltage-drop wafer input capacity', { low: 1, high: 1 }, sources.r22q2,
  'Wafer input capacity restored; does not recover previously lost output or quantify customer consequences.');
observation('renesas_kumamoto_recovery_20160522', 'kumamoto_earthquake_2016', '2016-04-14', '2016-05-22', 'renesas', null,
  'Renesas manufacturing operations affected by April 2016 Kumamoto earthquakes', 'wafer_input_capacity_restored', 'pre-earthquake wafer input capacity', { low: 1, high: 1 },
  source('https://www.renesas.com/en/about/newsroom/update-8-final-impact-2016-kumamoto-earthquake-renesas-electronics-operations', '2016-05-23', 'Final update, restoration completed May 22; overall supplier-chain recovery still ongoing'),
  'Group manufacturing scope as worded by final notice. Supplier-chain recovery explicitly remained incomplete. Incident begins April 14, including subsequent earthquakes.');

function upsert(existing, additions) {
  const ids = new Set(additions.map(r => r.id));
  return [...(existing || []).filter(r => !ids.has(r.id)), ...additions];
}
data.financialOutcomes = upsert(data.financialOutcomes, financial);
data.observations = upsert(data.observations, observed);
data.manufacturingRoutes = upsert(data.manufacturingRoutes, [{
  id: 'intel_kulim_diesort_to_penang_assembly_2023', kind: 'reported_manufacturing_route',
  from: { id: 'intel_kulim_diesort', name: 'Intel Kulim Die Sort and Die Preparation (KMDSDP)', companyId: 'intel' },
  to: { id: 'intel_penang_assembly', name: 'Intel Penang Assembly and Test (PGAT)', companyId: 'intel' },
  productScope: 'Tested processor dies on reels sent for package assembly and testing',
  reportedAt: '2023-09-18', allocationShare: null, shipmentVolume: null, shipmentUnits: null,
  evidenceBasis: 'firsthand_factory_tour_reporting', claimStatus: 'verified', review,
  source: { ...source('https://www.tomshardware.com/news/inside-intel-packaging-factory/3', '2023-09-18',
    'Paul Alcorn factory visit, pages 2-3: tested dies leave Kulim on reels; the next section identifies arrival at PGAT'),
    supportingUrls: ['https://www.tomshardware.com/news/inside-intel-packaging-factory/2'] },
  limitations: 'A reported manufacturing transfer route, not a shipment ledger, exclusive dependency, allocation percentage or current capacity claim. The older map combines Penang and Kulim; these precise process-site identities are not assigned invented coordinates.',
}]);
// Pin the reviewed PDFs, permitting independent reproduction of the table audit.
for (const [name, key] of [['renesas2021', 'r21q2'], ['renesas2022', 'r22q2'], ['renesas2021q1', 'r21q1'], ['renesas2022q1', 'r22q1']]) {
  try {
    const bytes = readFileSync(new URL(`../../tmp/pdfs/${name}.pdf`, import.meta.url));
    data.sourceArtifacts = upsert(data.sourceArtifacts, [{ id: key, url: sources[key].url,
      sha256: createHash('sha256').update(bytes).digest('hex'), reviewedAt: review.verifiedAt, review: 'Rendered relevant table checked against source header, columns and units' }]);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
console.log(`Imported ${financial.length} financial records and ${observed.length} additional recovery observations.`);
