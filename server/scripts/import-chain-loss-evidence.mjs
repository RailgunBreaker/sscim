import { writeFileSync } from 'node:fs';
const source = (url, publicationDate, supportingSection) => ({ url, publicationDate, informationAvailableDate: publicationDate,
  supportingSection, claimStatus: 'verified' });
const ford = source('https://www.sec.gov/Archives/edgar/data/37996/000003799621000026/f-20210331.htm', '2021-04-29', 'MD&A Automotive and Outlook, pp. 36 and 56; reported Q1 loss versus Q2 and full-year forecasts');
const stellantis = source('https://www.stellantis.com/en/news/press-releases/2021/october/third-quarter-2021-shipments-and-revenues', '2021-10-28', 'Opening production-loss disclosure: approximately 600 thousand units, 30% of planned Q3 production');
const annual = source('https://www.sec.gov/Archives/edgar/data/1605484/000160548423000020/stellantis-20221231.htm', '2023-02-24', '2021 semiconductor shortage discussion: approximately 20 percent of planned production');
const renault = source('https://media.renaultgroup.com/third-quarter-2021-priority-given-to-value-over-volume-optimized-revenues-in-a-context-strongly-marked-by-the-semiconductor-crisis/?lang=fra', '2021-10-22', 'Q3 production loss from unavailable components; full-year figure explicitly anticipated');
const mobility = source('https://press.spglobal.com/2023-07-13-S-P-Global-Mobility-The-semiconductor-shortage-is-mostly-over-for-the-auto-industry', '2023-07-13', 'Retrospective global light-vehicle production loss estimates and methodology, 2021 through H1 2023');
const review = { verifiedAt: '2026-09-08', provenance: 'Codex primary-source review; not independent human adjudication' };
const incidentId = 'global_automotive_semiconductor_shortage_2021';
function record(id, companyId, periodStart, periodEnd, metric, value, units, kind, src) {
  return { id, companyId, incidentId, periodStart, periodEnd, metric, value, units, kind,
    causeScope: 'semiconductor_shortage',
    denominator: metric === 'production_loss_fraction' ? 'Company planned vehicle production for the stated period' : null,
    measurementBasis: 'issuer_attributed_shortfall', precision: 'approximately; no statistical error band published',
    claimStatus: 'verified', source: src, review,
    limitations: 'Attributed to the overall semiconductor shortage by the company; not a separately identified loss from one fab. Vehicles, wholesale units, profit and fractions are distinct targets. Planned output is not an independently measured counterfactual.' };
}
const records = [
  record('ford_2021q1_lost_units','ford','2021-01-01','2021-03-31','vehicle_production_shortfall',200000,'vehicles','reported_outcome',ford),
  record('ford_2021q1_lost_fraction','ford','2021-01-01','2021-03-31','production_loss_fraction',.17,'fraction','reported_outcome',ford),
  record('ford_2021q2_loss_forecast','ford','2021-04-01','2021-06-30','production_loss_fraction',.5,'fraction','issuer_forecast',ford),
  record('ford_2021_wholesale_forecast','ford','2021-01-01','2021-12-31','wholesale_unit_shortfall',1100000,'wholesale vehicles','issuer_forecast',ford),
  record('ford_2021_ebit_forecast','ford','2021-01-01','2021-12-31','adjusted_ebit_headwind',2500000000,'USD','issuer_forecast',ford),
  record('stellantis_2021q3_lost_units','stellantis','2021-07-01','2021-09-30','vehicle_production_shortfall',600000,'vehicles','reported_outcome',stellantis),
  record('stellantis_2021q3_lost_fraction','stellantis','2021-07-01','2021-09-30','production_loss_fraction',.3,'fraction','reported_outcome',stellantis),
  record('stellantis_2021_lost_fraction','stellantis','2021-01-01','2021-12-31','production_loss_fraction',.2,'fraction','reported_outcome',annual),
  { ...record('renault_2021q3_lost_units','renault','2021-07-01','2021-09-30','vehicle_production_shortfall',170000,'vehicles','reported_outcome',renault), causeScope: 'component_shortage', limitations: 'Issuer estimates losses from unavailable components in the semiconductor-crisis context; the source does not isolate a semiconductor-only counterfactual.' },
  { ...record('renault_2021_loss_forecast','renault','2021-01-01','2021-12-31','vehicle_production_shortfall',500000,'vehicles','issuer_forecast',renault), causeScope: 'component_shortage' },
];
const sectorEstimates = [
  ['spglobal_2021_light_vehicle_loss','2021-01-01','2021-12-31',9500000,'greater_than'],
  ['spglobal_2021q3_light_vehicle_loss','2021-07-01','2021-09-30',3500000,'approximately'],
  ['spglobal_2022_light_vehicle_loss','2022-01-01','2022-12-31',3000000,'approximately'],
  ['spglobal_2023h1_light_vehicle_loss','2023-01-01','2023-06-30',524000,'approximately'],
].map(([id,periodStart,periodEnd,value,qualifier]) => ({ id, periodStart, periodEnd, value, qualifier,
  scopeId: 'global_light_vehicles', geography: 'global', sector: 'light_vehicle_manufacturing',
  companyId: null, metric: 'light_vehicle_production_shortfall', units: 'light vehicles',
  causeScope: 'semiconductor_shortage', accountingBoundary: 'final_vehicle_output',
  kind: 'external_retrospective_estimate', measurementBasis: 'publisher_estimated_counterfactual',
  estimator: 'S&P Global Mobility', claimStatus: 'verified', source: mobility, review,
  method: 'Publisher compares OEM disruption announcements with its estimates of contemporaneous planned production.',
  independentlyReproduced: false, uncertaintyInterval: null,
  limitations: 'Published sector-wide estimate, not a census of realized lost units. Underlying OEM-level allocations and counterfactual plans are not supplied here. Does not cover other semiconductor end markets or identify losses by upstream plant.' }));
const data = { schemaVersion: 1, reviewedAt: '2026-09-08', entities: [
  { id: 'ford', name: 'Ford Motor Company', type: 'company' }, { id: 'stellantis', name: 'Stellantis N.V.', type: 'company' },
  { id: 'renault', name: 'Renault Group', type: 'company' }],
  incidents: [{ id: incidentId, name: 'Global automotive semiconductor shortage, 2021', datePrecision: 'year', startDate: '2021-01-01', endDate: '2021-12-31',
    limitations: 'An aggregate shortage episode, not an independent single-facility disruption.' }], records, sectorEstimates,
  transmissionEvidence: [{ id: 'naka_fire_ford_outlook_2021', incidentId: 'renesas_naka_fire_2021',
    downstreamIncidentId: incidentId, supplierCompanyId: 'renesas', supplierFacilityId: 'renesas_naka', customerCompanyId: 'ford',
    relationshipKind: 'issuer_reported_contributing_disruption', intermediaryCompanyIds: null, allocatedLoss: null, allocationShare: null,
    claimStatus: 'verified', source: ford, review,
    claim: 'Ford includes the Naka fire in its discussion of the worsening shortage and revised second-quarter production outlook.',
    limitations: 'The disclosure does not specify a direct shipment route, named tier-one intermediaries, or the fraction of Ford losses caused by the fire.' }],
  limitations: ['Losses cover a disclosed subset of downstream companies, not the global chain.',
    'Repeated metrics for the same company and period are not independent observations.',
    'Reported losses and forecasts must not be pooled or automatically added to upstream financial losses.'] };
writeFileSync(new URL('../../docs/reference/chain-loss-evidence.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(`Imported ${records.length} downstream records and one documented contributing-disruption link.`);
