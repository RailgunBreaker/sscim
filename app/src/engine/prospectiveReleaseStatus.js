export function prospectiveReleaseStatus(predictions, scoring, schedule, asOf) {
  const time=Date.parse(asOf);
  if(!Number.isFinite(time)) throw new Error('Invalid release status time');
  return predictions.map(p=>{
    const matches=(schedule.records||[]).filter(s=>s.companyId===p.companyId&&s.metric===p.metric&&s.targetPeriod===p.targetPeriod);
    if(matches.length>1) throw new Error('Ambiguous release schedule');
    const expected=matches[0],scheduledAt=expected?.scheduledAt||null;
    if(expected&&(expected.kind!=='issuer_schedule'||!scheduledAt.endsWith('Z')||!Number.isFinite(Date.parse(scheduledAt)))) throw new Error('Invalid issuer schedule');
    const scored=scoring.results.find(r=>r.modelId===p.modelId&&r.targetPeriod===p.targetPeriod)?.state==='scored';
    return {modelId:p.modelId,targetPeriod:p.targetPeriod,scheduledAt,
      status:scored?'scored':!expected?'schedule_unavailable':time<Date.parse(scheduledAt)?'awaiting_scheduled_release':'awaiting_verified_outcome_after_scheduled_release',
      sourceUrl:expected?schedule.source.url:null,
      limitation:'Scheduled press-release time is not an observed outcome or a guaranteed SEC availability time.'};
  });
}
