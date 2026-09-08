import { describe, it, expect } from 'vitest';
import data from '../../../docs/reference/supplier-loss-allocations.json';
import { supplierLossAllocation } from './supplierLossAllocation.js';
const run = input => supplierLossAllocation(input, '2026-09-08');
describe('source-bound supplier loss allocation', () => {
  it('partitions disclosed bases without turning transfers into additional losses', () => {
    const report = run(data);
    expect(report.coverage).toEqual({disclosedBases:5,allocatedBases:3,unknownSupplierBases:2,invalidBases:0});
    expect(report.rejected).toEqual([]);
    expect(report.accounts.find(a=>a.id==='gm_bolt_2021')).toMatchObject({value:2000,allocatedAmount:1900,remainder:100,conservationResidual:0,allocationIsEstimate:true,finalCashLoss:null});
    expect(report.accounts.find(a=>a.id==='lg_bolt_estimate')).toMatchObject({allocatedAmount:700,remainder:700,units:'KRW billion'});
    expect(report.accounts.find(a=>a.id==='hyundai_replacement_estimate')).toMatchObject({allocatedAmount:700,remainder:300,qualifier:'approximately'});
    expect(report.crossAccountTotal).toBeNull();
    expect(report.allIndustryLoss).toBeNull();
    expect(report.accounts.flatMap(a=>a.allocations).every(a=>a.cashPaid===null)).toBe(true);
  });
  it('retains two company charges on the same incident without assuming supplier responsibility', () => {
    const records = run(data).accounts.filter(a=>a.incidentId==='nand_contamination_2022');
    expect(records.map(a=>[a.value,a.units])).toEqual([[33.2,'JPY billion'],[207,'USD million']]);
    expect(records.every(a=>a.allocatedAmount===null && a.remainder===null)).toBe(true);
    expect(new Set(records.map(a=>a.accountingBasis)).size).toBe(2);
  });
  it('withdraws numerical attribution when supplier evidence is removed', () => {
    const r = run({...data,rules:[]});
    expect(r.coverage).toMatchObject({allocatedBases:0,unknownSupplierBases:5});
    expect(r.accounts.every(a=>a.allocatedAmount===null && a.remainder===null)).toBe(true);
  });
  it.each(['costBoundaryId','incidentId','units','metric','causeScope','scopeType','accountingBasis','perspectiveId','snapshotDate','periodStart','periodEnd'])('rejects a mismatched %s instead of silently applying the share', key => {
    const d = structuredClone(data); d.rules[0][key] = 'mismatch';
    const r = run(d);
    expect(r.rejected.some(x=>x.id===d.rules[0].id)).toBe(true);
    expect(r.accounts[0]).toMatchObject({status:'invalid_allocation',allocatedAmount:null,remainder:null});
  });
  it('excludes future disclosures even when the agreement is historically effective', () => {
    const r = supplierLossAllocation(data,'2021-10-12');
    expect(r.accounts.map(a=>a.id)).toEqual(['gm_bolt_2021']);
    expect(r.rules.map(a=>a.id)).toEqual(['gm_lg_recovery']);
    expect(supplierLossAllocation(data,'2021-10-11').accounts).toEqual([]);
  });
  it.each(['output_share','ownership_share','purchase_share'])('does not use %s as incident allocation', type => {
    const d = structuredClone(data); d.rules[0].type = type;
    expect(run(d).accounts[0].allocatedAmount).toBeNull();
  });
  it('rejects duplicate recovery claims, oversized shares, negative values and invalid sources', () => {
    const duplicate = structuredClone(data); duplicate.rules.push({...duplicate.rules[0],id:'duplicate'});
    expect(run(duplicate).accounts[0]).toMatchObject({status:'invalid_allocation',allocatedAmount:null});
    for (const patch of [{value:2500},{value:-1},{source:{}},{effectiveMonth:'2050-01'},{supplierCompanyId:'gm'}]) {
      const d = structuredClone(data); Object.assign(d.rules[0],patch);
      expect(run(d).accounts[0].allocatedAmount).toBeNull();
    }
    const d = structuredClone(data); d.rules[1].value = 1.1;
    expect(run(d).accounts[1].allocatedAmount).toBeNull();
  });
  it('fails closed on ID collisions and incomplete base boundaries', () => {
    expect(()=>run({...data,accounts:[...data.accounts,data.accounts[0]]})).toThrow(/duplicate/);
    const d=structuredClone(data);d.accounts[3].periodEnd='2027-01-01';
    expect(run(d).accounts.some(a=>a.id===d.accounts[3].id)).toBe(false);
  });
});
