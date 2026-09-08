import {it,expect} from 'vitest';
import {prospectiveReleaseStatus} from './prospectiveReleaseStatus.js';
const prediction={companyId:'tsmc',metric:'revenue',modelId:'test',targetPeriod:'2026-09'};
const schedule={source:{url:'https://example.com/calendar'},records:[{...prediction,kind:'issuer_schedule',scheduledAt:'2026-10-08T05:30:00Z'}]};
it('distinguishes awaiting publication from awaiting verified outcomes without creating accuracy results',()=>{
  const pending={results:[]};
  expect(prospectiveReleaseStatus([prediction],pending,schedule,'2026-09-09T00:00:00Z')[0].status).toBe('awaiting_scheduled_release');
  const after=prospectiveReleaseStatus([prediction],pending,schedule,'2026-10-08T05:30:00Z')[0];
  expect(after.status).toBe('awaiting_verified_outcome_after_scheduled_release');
  expect(after.actual).toBeUndefined();
  expect(prospectiveReleaseStatus([prediction],{results:[{...prediction,state:'scored'}]},schedule,'2026-10-10T00:00:00Z')[0].status).toBe('scored');
});
it('rejects ambiguous schedules and tolerates missing publication dates',()=>{
  expect(()=>prospectiveReleaseStatus([prediction],{results:[]},{...schedule,records:[...schedule.records,...schedule.records]},'2026-09-09T00:00:00Z')).toThrow(/Ambiguous/);
  expect(prospectiveReleaseStatus([prediction],{results:[]},{records:[]},'2026-09-09T00:00:00Z')[0].status).toBe('schedule_unavailable');
});
