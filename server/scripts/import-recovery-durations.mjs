import { writeFileSync } from 'node:fs';
const reviewedAt = '2026-09-09';
const base = 'https://www.renesas.com/en/about/';
const sources = {};
function source(id, path, date, section) {
  sources[id] = { id, url: base + path, publicationDate: date, informationAvailableDate: date,
    supportingSection: section, claimStatus: 'verified' };
}
source('kumamoto2016_restart', 'press-room/update-7-impact-2016-kumamoto-earthquake-renesas-electronics-operations-0', '2016-05-10', 'Kawashiri Factory: actual partial resumption April 22; May 22 is a target here.');
source('kumamoto2016_complete', 'newsroom/update-8-final-impact-2016-kumamoto-earthquake-renesas-electronics-operations', '2016-05-23', 'Restoration completed May 22; overall supplier-chain recovery remains incomplete.');
source('fukushima2021_restart', 'newsroom/update-2-impact-february-13-earthquake-coast-fukushima-prefecture-renesas-electronics-operation', '2021-02-15', 'Wafer supply restarted February 15; front-end processes planned for February 16.');
source('fukushima2021_complete', 'newsroom/final-update-impact-february-13-earthquake-coast-fukushima-prefecture-renesas-electronics-operation', '2021-02-22', 'Actual restoration of pre-earthquake wafer-input capacity February 21.');
source('fukushima2022_restart', 'newsroom/update-2-impact-march-16-earthquake-coast-fukushima-prefecture-renesas-operation', '2022-03-18', 'Naka and Takasaki: partial test-line production March 17; March 23 full capacity is a forecast.');
source('fukushima2022_takasaki_complete', 'newsroom/update-3-impact-march-16-earthquake-coast-fukushima-prefecture-renesas-operation', '2022-03-23', 'Takasaki actual full wafer-input capacity March 23; Naka only approximately 50%.');
source('fukushima2022_naka_complete', 'newsroom/update-4-final-impact-march-16-earthquake-coast-fukushima-prefecture-renesas-operation-1', '2022-03-26', 'Naka actual full wafer-input capacity March 26; lost production still outstanding.');
source('lightning2022_restart', 'newsroom/impact-instantaneous-voltage-drop-operation-kawashiri-factory', '2022-07-06', 'Actual partial process resumption July 6; July 11 full capacity is a target.');
source('lightning2022_complete', 'newsroom/update-2-final-impact-instantaneous-voltage-drop-operation-kawashiri-factory', '2022-07-11', 'Actual full wafer-input capacity July 11; lost work-in-process and production remain.');
source('kumamoto2026_restart', 'newsroom/impact-26-earthquake-kumamoto-4', '2026-08-04', 'Actual phased production restart August 4; approximately three weeks to full wafer-input capacity is a target.');
source('kumamoto2026_complete', 'newsroom/update-5-final-impact-2026-kumamoto-earthquake-renesas-operations', '2026-08-24', 'Actual pre-earthquake wafer-input capacity restored evening August 23 after August 4 restart.');
function record(id, incidentId, incidentDate, facilityId, restartDate, completedDate, startSource, endSource, restartDefinition, issuerTargetDays = null, targetQualifier = null) {
  return { id, incidentId, incidentDate, companyId: 'renesas', facilityId,
    scope: facilityId.replaceAll('_', ' '), metric: 'wafer_input_capacity_recovery_duration', units: 'days',
    kind: 'observed', claimStatus: 'verified', review: { verifiedAt: reviewedAt,
      provenance: 'Codex primary-source reading of actual milestones; not independent human adjudication.' },
    restart: { date: restartDate, definition: restartDefinition, source: sources[startSource] },
    completion: { date: completedDate, definition: 'Full pre-incident wafer-input capacity', source: sources[endSource] },
    source: sources[endSource], datePrecision: 'calendar_day',
    issuerTarget: issuerTargetDays == null ? null : { kind: 'issuer_forecast', durationDays: issuerTargetDays,
      qualifier: targetQualifier, source: sources[startSource] },
    limitations: 'Elapsed calendar dates, not exact timestamps. Partial restart is not zero production. Endpoint restoration does not recover accumulated lost output or establish a linear trajectory.' };
}
const records = [
  record('kawashiri_2016_duration','kumamoto_earthquake_2016','2016-04-14','renesas_kawashiri','2016-04-22','2016-05-22','kumamoto2016_restart','kumamoto2016_complete','partial_manufacturing_process_resumption',30,'scheduled_date'),
  record('naka_2021_quake_duration','fukushima_earthquake_2021','2021-02-13','renesas_naka','2021-02-15','2021-02-21','fukushima2021_restart','fukushima2021_complete','wafer_supply_restart'),
  record('naka_2022_quake_duration','fukushima_earthquake_2022','2022-03-16','renesas_naka','2022-03-17','2022-03-26','fukushima2022_restart','fukushima2022_naka_complete','partial_test_line_resumption',6,'scheduled_date'),
  record('takasaki_2022_quake_duration','fukushima_earthquake_2022','2022-03-16','renesas_takasaki','2022-03-17','2022-03-23','fukushima2022_restart','fukushima2022_takasaki_complete','partial_test_line_resumption',6,'scheduled_date'),
  record('kawashiri_2022_lightning_duration','kawashiri_voltage_drop_2022','2022-07-05','renesas_kawashiri','2022-07-06','2022-07-11','lightning2022_restart','lightning2022_complete','partial_manufacturing_process_resumption',5,'scheduled_date'),
  record('kawashiri_2026_duration','kumamoto_earthquake_2026','2026-07-28','renesas_kawashiri','2026-08-04','2026-08-23','kumamoto2026_restart','kumamoto2026_complete','phased_production_resumption',21,'approximate_target_horizon'),
];
const data = { schemaVersion: 1, reviewedAt, scope: 'Renesas disclosed wafer-input restoration after partial restart, selected Japanese physical outages',
  records, exclusions: [
    { id: 'naka_fire_2021', reason: 'Published production capacity/production level endpoints do not explicitly establish the same wafer-input target.' },
    { id: 'tools_and_shipments', reason: 'Tool availability, shipping recovery, generic production input and qualitative restart are distinct targets.' },
    { id: 'nishiki_2026', reason: 'Full production capacity disclosure does not explicitly identify wafer-input capacity.' },
  ], limitations: ['Purposive single-company sample; not a census of disruptions.',
    'Restart definitions differ and are recorded explicitly; endpoint comparability does not imply identical processes.',
    'Dates verified by the coding agent; source statements are issuer reports, not independent factory measurements.'] };
writeFileSync(new URL('../../docs/reference/recovery-durations.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(`Imported ${records.length} recovery-duration records from ${new Set(records.map(r => r.incidentId)).size} incidents.`);
