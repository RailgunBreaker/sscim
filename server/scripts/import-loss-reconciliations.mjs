import { readFileSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
const root = new URL('../../', import.meta.url);
const review = { verifiedAt:'2026-09-08', provenance:'Codex primary-source review; Sony table visually checked; not independent adjudication of counterfactual losses' };
const src = (url,date,section) => ({ url, publicationDate:date, informationAvailableDate:date, supportingSection:section, claimStatus:'verified' });
const sony = src('https://www.sony.com/SonyInfo/IR/library/presen/er/16q4_sonypre.pdf','2017-04-28','PDF page 3, slide 5: FY16 earthquake impact table, annual and quarterly columns; excludes insurance recoveries');
const wdc = src('https://www.sec.gov/Archives/edgar/data/106040/000010604022000055/wdc-20220701.htm','2022-08-25','Flash Ventures contamination incident and Note 10: fiscal-year charges and recovery from the June 2019 power outage');
const nokia = src('https://www.nokia.com/newsroom/nokia-corporation-financial-report-for-q4-and-full-year-2020/','2021-02-04','COVID-19 factory-closure net sales effect; most sales expected to shift to future periods');
const records = [];
const sonyAtoms = ['semiconductor_damage','semiconductor_recovery','semiconductor_opportunity','imaging_opportunity','corporate_opportunity'];
function add(id,value,atoms,options={}) {
  records.push({ id, value, atoms, companyId:'sony', incidentId:'kumamoto_earthquake_2016',
    periodStart:'2016-04-01', periodEnd:'2017-03-31', units:'JPY billion', roundingUnit:.1,
    metric:'operating_income_reduction', causeScope:'earthquake', accountingBasis:'issuer_estimate_before_insurance',
    kind:'issuer_retrospective_estimate', claimStatus:'verified', source:sony, review,
    sourceSignedAmount:-value, permanentEconomicLoss:null, ...options });
}
add('sony_fy16_consolidated',52.8,sonyAtoms,{label:'Consolidated operating-income impact'});
add('sony_fy16_semiconductors',38.8,sonyAtoms.slice(0,3),{label:'Semiconductors total'});
add('sony_fy16_imaging',10.5,[sonyAtoms[3]],{label:'Imaging opportunity losses'});
add('sony_fy16_corporate',3.5,[sonyAtoms[4]],{label:'Corporate unallocated fixed costs'});
add('sony_fy16_damage',16.7,[sonyAtoms[0]],{label:'Physical damage'});
add('sony_fy16_recovery',1.8,[sonyAtoms[1]],{label:'Recovery expenses and others'});
add('sony_fy16_semiconductor_opportunity',20.3,[sonyAtoms[2]],{label:'Semiconductor opportunity losses'});
add('sony_fy16_all_opportunity',34.3,sonyAtoms.slice(2),{label:'Consolidated opportunity losses'});
for (const [q,start,end,value] of [
  [1,'2016-04-01','2016-06-30',34.2],[2,'2016-07-01','2016-09-30',13.7],
  [3,'2016-10-01','2016-12-31',3.8],[4,'2017-01-01','2017-03-31',1.1],
]) add(`sony_fy16_q${q}`,value,sonyAtoms,{periodStart:start,periodEnd:end,label:`Q${q} consolidated impact`});
const newRecord = (id,value,companyId,incidentId,periodStart,periodEnd,units,metric,kind,source,extra={}) => ({
  id,value,companyId,incidentId,periodStart,periodEnd,units,metric,kind,source,review,
  claimStatus:'verified', roundingUnit:1, atoms:[id], accountingBasis:'reported_accounting_amount', permanentEconomicLoss:null,...extra });
records.push(newRecord('wdc_contamination_fy2022',207,'wdc','flash_ventures_contamination_2022','2021-07-03','2022-07-01','USD million','recognized_disaster_cost','reported_outcome',wdc,{
  label:'Contamination charges in cost of revenue',causeScope:'manufacturing_contamination',
  limitations:'Western Digital reported charges; not total Flash Ventures or downstream-customer losses. No doubling by its generally 50% wafer share.' }));
for (const [id,value,start,end,label] of [
  ['wdc_power_cost_fy2020',68,'2019-06-29','2020-07-03','Power-outage charges'],
  ['wdc_power_recovery_fy2021',-75,'2020-07-04','2021-07-02','Utility/insurance recovery'],
  ['wdc_power_recovery_fy2022',-7,'2021-07-03','2022-07-01','Utility/insurance recovery'],
]) records.push(newRecord(id,value,'wdc','flash_ventures_power_outage_2019',start,end,'USD million','net_recognized_incident_cost','reported_outcome',wdc,{
  label,causeScope:'power_outage', accountingRole:value<0?'recovery_transfer':'charge',
  limitations:'Recognized in cost of revenue. Recovery is a transfer; net company expense is not society-wide resource loss.' }));
records.push(newRecord('nokia_factory_closures_2020',200,'nokia','nokia_factory_closures_2020','2020-01-01','2020-12-31','EUR million','revenue_timing_impact','issuer_retrospective_estimate',nokia,{
  label:'Factory-closure sales impact, primarily Alcatel Submarine Networks', causeScope:'covid_factory_closures',
  accountingBasis:'issuer_estimated_net_sales_timing', majorityExpectedDeferred:true,
  recoveryObserved:false, limitations:'Issuer expects most sales to shift to later periods. Not evidence of EUR 200 million permanently lost sales, or a semiconductor-only cause.' }));
const observed = JSON.parse(readFileSync(new URL('docs/reference/observed-data.json',root)));
for (const [suffix,metric,sign,atoms] of [
  ['net','revenue_impact',-1,['shipment_loss','countermeasures']],
  ['gross','gross_shipment_revenue_impact',-1,['shipment_loss']],
  ['recovered','revenue_recovered_by_countermeasures',-1,['countermeasures']],
]) {
  const original = observed.financialOutcomes.find(r => r.incidentId === 'renesas_naka_fire_2021' && r.metric === metric && r.kind === 'reported_outcome');
  records.push({ ...original, id:`renesas_naka_q2_${suffix}`, originalRecordId:original.id,
    originDataset:'docs/reference/observed-data.json', label:`Naka Q2 ${suffix} revenue effect`,
    value:sign*original.amount, atoms, metric:'net_revenue_shortfall', causeScope:'fire',
    accountingBasis:'issuer_attributed_revenue_after_countermeasures', kind:'issuer_retrospective_estimate', permanentEconomicLoss:null });
}
const bridges = [
  { id:'sony_segments', parentId:'sony_fy16_consolidated', childIds:['sony_fy16_semiconductors','sony_fy16_imaging','sony_fy16_corporate'], dimension:'segments' },
  { id:'sony_cost_categories', parentId:'sony_fy16_consolidated', childIds:['sony_fy16_damage','sony_fy16_recovery','sony_fy16_all_opportunity'], dimension:'cost_categories' },
  { id:'sony_semiconductor_categories', parentId:'sony_fy16_semiconductors', childIds:['sony_fy16_damage','sony_fy16_recovery','sony_fy16_semiconductor_opportunity'], dimension:'cost_categories' },
  { id:'sony_quarters', parentId:'sony_fy16_consolidated', childIds:[1,2,3,4].map(q=>`sony_fy16_q${q}`), dimension:'time' },
  { id:'renesas_countermeasures', parentId:'renesas_naka_q2_net', childIds:['renesas_naka_q2_gross','renesas_naka_q2_recovered'], dimension:'cost_categories' },
];
const sourceArtifacts = [{ url:sony.url, sha256:'504d8788cecec743920442bcb375dcb62c85166878112d4ea7d6ccf1d0a078ed',
  inspectedPage:3, inspectedSlide:5, type:'primary_pdf', publicationDate:'2017-04-28' }];
writeAtomicJson(new URL('docs/reference/loss-reconciliations.json',root), { schemaVersion:1,reviewedAt:'2026-09-08',records,bridges,sourceArtifacts,
  entities:[{id:'flash_ventures',type:'company_group',name:'Flash Ventures joint business ventures'}],
  relationships:[{id:'flash_ventures_wdc_wafer_contract_2022',supplier:'flash_ventures',customer:'wdc',level:'company_group',
    claimStatus:'verified',source:wdc,review,periodEnd:'2022-07-01',inputShare:.5,shareQualifier:'generally',
    scope:'Western Digital rolling three-month forecast generally equals 50% of Flash Ventures output; half of fixed costs is payable regardless of output purchased.',
    relationshipKind:'contractual_wafer_supply',allocatedIncidentLoss:null,
    limitations:'Historical contractual relationship, not plant-to-plant shipment data or proof that incident costs should be doubled.'}],
  coverage:[{scope:'Sony FY2016 disclosed consolidated earthquake operating-income estimate',status:'reconciliation_available'},
    {scope:'Western Digital recognized incident costs and recoveries',status:'company_accounting_available'},
    {scope:'Nokia factory-closure sales timing',status:'issuer_estimate_available'},
    {scope:'Other firms and semiconductor end markets',status:'not_exhaustively_covered'}],
  limitations:['A reconciled disclosure is not independent causal validation.','No cross-company or cross-currency economic-loss total is inferred.','Revenue deferrals and insurer/utility transfers are not permanent social losses.'] });
console.log(`Imported ${records.length} reconciliation records and ${bridges.length} bridges.`);
