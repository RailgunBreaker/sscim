import { readFileSync } from 'node:fs';
import { writeAtomicJson } from '../src/atomic-json.js';
const root = new URL('../../', import.meta.url);
const review = {verifiedAt:'2026-09-08',provenance:'Primary issuer disclosures reviewed; Nikon slide visually checked. Disclosure verification does not establish independent causal attribution.'};
const source = (url, publicationDate, supportingSection, extra={}) => ({url,publicationDate,informationAvailableDate:publicationDate,supportingSection,claimStatus:'verified',...extra});
const wdc = source('https://www.sec.gov/Archives/edgar/data/106040/000010604024000031/wdc-20240628.htm','2024-08-20','Note 3 segment gross-profit reconciliation and Note 10 Flash Ventures: 37 total recovery; 36 received from insurers', {filingIndexUrl:'https://www.sec.gov/Archives/edgar/data/106040/0000106040-24-000031-index.htm'});
const tsmc = source('https://www.sec.gov/Archives/edgar/data/1046179/000119312522104891/R40.htm','2022-04-14','Significant Operation Losses: Q1 2019 photoresist charge', {filingIndexUrl:'https://www.sec.gov/Archives/edgar/data/1046179/000119312522104891/0001193125-22-104891-index.html'});
const nikon = source('https://www.nikon.com/company/ir/ir_library/result/pdf/2017/17_all_e.pdf','2017-05-11','Slide 14: imaging business actual results and multiple drivers of change', {sha256:'3f05998279e3526642cede7c92aaaa31c90695616f479a134e04fb34cdf49ed9',hashBasis:'raw_bytes'});
const original = JSON.parse(readFileSync(new URL('docs/reference/loss-reconciliations.json',root))).records.find(r=>r.id==='wdc_contamination_fy2022');
if(!original) throw new Error('Missing original charge');
const bases = [
  {...original,id:'wdc_contamination_charge',incidentId:'nand_contamination_2022',recordReference:'docs/reference/loss-reconciliations.json#'+original.id},
  {id:'tsmc_photoresist_charge',companyId:'tsmc',incidentId:'photoresist_contamination_2019',value:3400,units:'TWD million',metric:'cost_of_revenue_charge',accountingBasis:'IFRS_cost_of_revenue',periodStart:'2019-01-01',periodEnd:'2019-03-31',kind:'reported_outcome',claimStatus:'verified',review,source:tsmc,label:'TSMC photoresist charge recognized in Q1 2019',measurementQualification:'Estimated loss recognized in cost of revenue; disclosed here again in the 2021 annual filing.'},
];
const common = {baseId:'wdc_contamination_charge',companyId:'wdc',incidentId:'nand_contamination_2022',units:original.units,metric:original.metric,accountingBasis:original.accountingBasis,periodStart:'2023-07-01',periodEnd:'2024-06-28',kind:'reported_outcome',claimStatus:'verified',review,source:wdc};
const recoveries = [
  {...common,id:'wdc_contamination_recovery_fy2024',value:37,measure:'recognized_recovery',counterpartyClass:'mixed_or_unspecified',counterpartyId:null,includesIds:['wdc_contamination_insurer_cash_fy2024'],label:'FY2024 total recognized recovery'},
  {...common,id:'wdc_contamination_insurer_cash_fy2024',value:36,measure:'cash_received',counterpartyClass:'insurer',counterpartyId:null,includesIds:[],label:'Insurer cash recovery included in the total'},
];
const downstream = [
  {id:'nikon_imaging_sales_decline_fy2017',companyId:'nikon',incidentId:'kumamoto_earthquake_2016',value:137.4,units:'JPY billion',metric:'year_over_year_sales_decrease',periodStart:'2016-04-01',periodEnd:'2017-03-31',kind:'reported_outcome',claimStatus:'verified',review,source:nikon,causalStatus:'multiple_drivers_unseparated',drivers:['market_decline','earthquake_supply_disruption','foreign_exchange','product_mix'],supplierCompanyId:null,label:'Imaging sales decline; earthquake contribution not isolated'},
  {id:'nikon_imaging_income_decline_fy2017',companyId:'nikon',incidentId:'kumamoto_earthquake_2016',value:18,units:'JPY billion',metric:'year_over_year_operating_income_decrease',periodStart:'2016-04-01',periodEnd:'2017-03-31',kind:'reported_outcome',claimStatus:'verified',review,source:nikon,causalStatus:'multiple_drivers_unseparated',drivers:['market_decline','earthquake_supply_disruption','foreign_exchange','product_mix','cost_controls'],supplierCompanyId:null,label:'Imaging operating-income decline; earthquake contribution not isolated'},
];
const questions = [
  {id:'nand_supplier_reimbursement',incidentId:'nand_contamination_2022',status:'not_identified_in_reviewed_sources',needed:'Named material supplier, incident-specific payment or liability, currency and settlement scope',reviewedSourceUrls:[wdc.url],nextAction:'Review subsequent WDC and Sandisk filings; do not relabel insurers as material suppliers.'},
  {id:'photoresist_supplier_reimbursement',incidentId:'photoresist_contamination_2019',status:'not_identified_in_reviewed_sources',needed:'Material supplier identity and disclosed reimbursement amount',reviewedSourceUrls:[tsmc.url],nextAction:'Review later TSMC filings and original settlement disclosures; supplier names in unconfirmed press reports are insufficient.'},
  {id:'nikon_supplier_loss',incidentId:'kumamoto_earthquake_2016',status:'causal_component_not_identified',needed:'Supplier-specific lost deliveries, inventory substitutions, sales deferrals and unrecovered margin',reviewedSourceUrls:[nikon.url],nextAction:'Obtain an issuer bridge isolating the earthquake from demand, currency and mitigation effects.'},
];
writeAtomicJson(new URL('docs/reference/semiconductor-loss-followup.json',root),{schemaVersion:1,reviewedAt:review.verifiedAt,bases,recoveries,downstream,questions,entities:[{id:'nikon',type:'company',name:'Nikon'}],limitations:['Search coverage is not proof that undisclosed compensation does not exist.','A selected charge less disclosed recoveries is not final cash loss or social damage.','Year-over-year declines are not causal disruption-loss estimates.']});
console.log(JSON.stringify({bases:bases.length,recoveries:recoveries.length,downstream:downstream.length}));
