import { it, expect } from 'vitest';
import data from '../../../docs/reference/semiconductor-loss-followup.json';
import { semiconductorLossFollowup } from './semiconductorLossFollowup.js';
const run=d=>semiconductorLossFollowup(d,'2026-09-08');
it('nets the recognized recovery once and keeps insurance cash separate from supplier reimbursement',()=>{
  const r=run(data),a=r.accounts[0];
  expect(a).toMatchObject({value:207,recognizedRecovery:37,netOfSelectedRecoveries:170,insurerCashReceived:36,materialSupplierRecoveries:[],finalOutstandingClaim:null,finalCashLoss:null});
  expect(()=>r.recoverySubtotal(data.recoveries.map(r=>r.id))).toThrow(/Incompatible|Overlapping/);
  expect(r.accounts[1]).toMatchObject({value:3400,units:'TWD million',recognizedRecovery:null,netOfSelectedRecoveries:null});
});
it('does not turn unavailable later recoveries into zero reimbursement',()=>{
  const r=semiconductorLossFollowup(data,'2023-01-01');
  expect(r.accounts[0]).toMatchObject({recognizedRecovery:null,netOfSelectedRecoveries:null,insurerCashReceived:null});
});
it('does not infer a supplier-specific loss, zero loss, or a bound from confounded company declines',()=>{
  const r=run(data);
  expect(r.downstream.map(d=>d.value)).toEqual([137.4,18]);
  expect(r.downstream.every(d=>!d.eligibleForLossScoring&&d.supplierAttributedLoss===null&&d.identifiedLossBounds===null)).toBe(true);
});
it.each(['companyId','incidentId','units','metric','accountingBasis'])('rejects a recovery with a mismatched %s',key=>{
  const d=structuredClone(data);d.recoveries[0][key]='other';
  expect(run(d).accounts[0]).toMatchObject({status:'invalid_recovery_selection',netOfSelectedRecoveries:null});
});
it('rejects negative recoveries, anonymous material-supplier attribution and duplicate IDs',()=>{
  for(const patch of [{value:-1},{counterpartyClass:'material_supplier',counterpartyId:null},{source:{}}]){
    const d=structuredClone(data);Object.assign(d.recoveries[0],patch);
    expect(run(d).accounts[0].netOfSelectedRecoveries).toBeNull();
  }
  expect(()=>run({...data,recoveries:[...data.recoveries,data.recoveries[0]]})).toThrow(/duplicate/);
});
it('rejects overlapping quarterly and annual recovery representations',()=>{
  const d=structuredClone(data);d.recoveries.push({...d.recoveries[0],id:'quarter',periodStart:'2024-01-01'});
  expect(run(d).accounts[0].netOfSelectedRecoveries).toBeNull();
});
it('allows a net accounting credit without describing it as negative economic damage',()=>{
  const d=structuredClone(data);d.recoveries[0].value=210;
  expect(run(d).accounts[0]).toMatchObject({netOfSelectedRecoveries:-3,finalCashLoss:null,allIndustryLoss:null});
});
it('rejects contradictory included recoveries and does not double count a declared recognized component',()=>{
  const bad=structuredClone(data);bad.recoveries[1].value=40;
  expect(run(bad).accounts[0].netOfSelectedRecoveries).toBeNull();
  const d=structuredClone(data);d.recoveries[1].measure='recognized_recovery';
  expect(run(d).accounts[0]).toMatchObject({recognizedRecovery:37,netOfSelectedRecoveries:170});
});
