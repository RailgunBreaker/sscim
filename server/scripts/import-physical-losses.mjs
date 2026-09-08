import { writeFileSync } from 'node:fs';
const source=(path,date,section)=>({url:'https://www.renesas.com/en/about/newsroom/'+path,publicationDate:date,informationAvailableDate:date,supportingSection:section,claimStatus:'verified'});
const naka=source('update-4-final-impact-march-16-earthquake-coast-fukushima-prefecture-renesas-operation-1','2022-03-26','Naka: ruined work-in-process and reduced production, approximately two weeks for 200mm and three for 300mm; recovery of shortfalls continues.');
const takasaki=source('update-3-impact-march-16-earthquake-coast-fukushima-prefecture-renesas-operation','2022-03-23','Takasaki: approximately ten days of production from ruined work-in-process and halted production; recovery continues.');
const lightning=source('update-2-final-impact-instantaneous-voltage-drop-operation-kawashiri-factory','2022-07-11','Updated assessment: approximately one week combined ruined work-in-process and halted production; earlier two-week maximum was preliminary.');
const review={verifiedAt:'2026-09-09',provenance:'Codex reading of primary issuer disclosures, not independent factory telemetry'};
const make=(id,incidentId,facilityId,scopeId,scope,value,recoveryId,src)=>({id,incidentId,companyId:'renesas',facilityId,scopeId,scope,
  metric:'gross_production_shortfall_equivalent_days',units:'local_baseline_production_days',value,
  kind:'issuer_retrospective_estimate',claimStatus:'verified',review,source:src,recoveryId,
  precision:'approximately; no statistical uncertainty published', components:['ruined_work_in_process','halted_or_reduced_production'],
  accountingBoundary:'gross_shortfall_before_subsequent_catchup', denominator:'One day of normal production for this source-defined line or factory; absolute volume undisclosed',
  downstreamLoss:null,catchupProduction:null,permanentLoss:null,supplierAllocation:null});
const records=[
  make('naka_2022_200mm_loss','fukushima_earthquake_2022','renesas_naka','naka_200mm','Naka 200mm line',14,'naka_2022_quake_duration',naka),
  make('naka_2022_300mm_loss','fukushima_earthquake_2022','renesas_naka','naka_300mm','Naka 300mm line',21,'naka_2022_quake_duration',naka),
  make('takasaki_2022_loss','fukushima_earthquake_2022','renesas_takasaki','takasaki_factory','Takasaki factory',10,'takasaki_2022_quake_duration',takasaki),
  make('kawashiri_2022_loss','kawashiri_voltage_drop_2022','renesas_kawashiri','kawashiri_factory','Kawashiri factory',7,'kawashiri_2022_lightning_duration',lightning),
];
writeFileSync(new URL('../../docs/reference/physical-losses.json',import.meta.url),JSON.stringify({schemaVersion:1,reviewedAt:'2026-09-09',records,
  limitations:['Production-equivalent days have different local denominators and cannot be added across lines or factories.',
    'Full wafer-input restoration is not recovery of accumulated output shortfalls.',
    'Issuer estimates do not identify downstream customer losses or a whole-chain economic total.']},null,2)+'\n');
console.log(`Imported ${records.length} physical loss records.`);
