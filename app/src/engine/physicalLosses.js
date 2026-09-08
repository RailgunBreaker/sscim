import { reviewedClaim } from './evidenceContract.js';
import { validateRecoveryDurations } from './recoveryCalibration.js';
export function physicalLosses(data, recoveryData, asOf) {
  const durations=validateRecoveryDurations(recoveryData,asOf), seen=new Set(), records=[], rejected=[];
  for(const r of data.records||[]) {
    const recovery=durations.accepted.find(d=>d.id===r.recoveryId);
    const key=`${r.incidentId}:${r.scopeId}`;
    if(!r.id||seen.has(key)||!reviewedClaim(r,asOf)||r.review.verifiedAt>asOf
      ||r.kind!=='issuer_retrospective_estimate'||r.metric!=='gross_production_shortfall_equivalent_days'
      ||r.units!=='local_baseline_production_days'||r.accountingBoundary!=='gross_shortfall_before_subsequent_catchup'
      ||!r.denominator||JSON.stringify(r.components)!==JSON.stringify(['ruined_work_in_process','halted_or_reduced_production'])
      ||!Number.isFinite(r.value)||r.value<0||!r.scopeId||!recovery
      ||recovery.incidentId!==r.incidentId||recovery.facilityId!==r.facilityId||recovery.companyId!==r.companyId
      ||r.source.publicationDate<recovery.completion.date) { rejected.push(r.id); continue; }
    seen.add(key);
    const elapsedDays=(Date.parse(recovery.completion.date)-Date.parse(recovery.incidentDate))/86400000;
    const haltDays=(Date.parse(recovery.restart.date)-Date.parse(recovery.incidentDate))/86400000;
    records.push({...r,capacityRestored:true,restoredMetric:'wafer_input_capacity',completionDate:recovery.completion.date,
      elapsedDays, endpointLinearDiagnosticDays:haltDays+recovery.durationDays/2,
      // Even complete loss of all new input throughout this interval cannot
      // exceed elapsed time at a constant normal-input denominator. This is
      // a model-boundary diagnostic, NOT a derived quantity of destroyed WIP.
      exceedsElapsedTime:r.value>elapsedDays+1,
      diagnosticAssumptions:['constant local baseline','input-to-output equivalence','no production above baseline',
        'date-only timing tolerance of one day'],
      attributionStatus:'combined_wip_and_production_effect_not_separately_identified',
      catchupProduction:null,permanentLoss:null,downstreamLoss:null,supplierAllocation:null});
  }
  return {schemaVersion:1,asOf,records,rejected,rejectedRecoveryRecords:durations.rejected,
    localLossObservations:records.length,incidentCount:new Set(records.map(r=>r.incidentId)).size,
    chainWideLoss:null,normalizedDaysSubtotal:null,
    reason:'Local production-day denominators, WIP inventories, later catch-up and customer allocations are not a common additive chain loss measure.'};
}
