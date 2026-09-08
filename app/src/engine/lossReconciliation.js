import { reviewedClaim, validDate } from './evidenceContract.js';
const day = date => Date.parse(date+'T00:00:00Z');
const contract = ['companyId','incidentId','units','metric','accountingBasis','causeScope'];
export function lossReconciliation(data, asOf) {
  const records = [], rejected = [], ids = new Set();
  for (const r of data.records || []) {
    if (!r.id || ids.has(r.id)) throw new Error('Duplicate or missing reconciliation record');
    ids.add(r.id);
    if (!reviewedClaim(r,asOf) || !validDate(r.periodStart) || !validDate(r.periodEnd) || r.periodStart>r.periodEnd
      || r.source.publicationDate<r.periodEnd || !Number.isFinite(r.value) || !Number.isFinite(r.roundingUnit) || r.roundingUnit<=0
      || contract.some(k => !r[k]) || !['reported_outcome','issuer_retrospective_estimate'].includes(r.kind)
      || !Array.isArray(r.atoms) || !r.atoms.length || new Set(r.atoms).size!==r.atoms.length) {rejected.push(r.id);continue;}
    records.push(r);
  }
  function selection(selectedIds) {
    if (!selectedIds.length || new Set(selectedIds).size!==selectedIds.length) throw new Error('Empty or duplicate selection');
    const chosen=selectedIds.map(id=>records.find(r=>r.id===id));
    if(chosen.some(r=>!r)) throw new Error('Unavailable or ineligible record');
    const first=chosen[0];
    if(chosen.some(r=>contract.some(k=>r[k]!==first[k]))) throw new Error('Incompatible accounting boundary');
    for(let i=0;i<chosen.length;i++) for(let j=i+1;j<chosen.length;j++) {
      const a=chosen[i],b=chosen[j];
      if(a.atoms.some(atom=>b.atoms.includes(atom)) && a.periodStart<=b.periodEnd && b.periodStart<=a.periodEnd) throw new Error('Overlapping economic components would double-count');
    }
    return chosen;
  }
  function subtotal(selectedIds) {
    const chosen=selection(selectedIds), first=chosen[0];
    return { value:chosen.reduce((s,r)=>s+r.value,0), units:first.units, metric:first.metric,
      companyId:first.companyId, incidentId:first.incidentId, selectedRecordIds:selectedIds,
      allIndustryLoss:false, permanentEconomicLoss:null };
  }
  const bridges=(data.bridges||[]).map(b=>{
    try {
      const parent=records.find(r=>r.id===b.parentId), children=selection(b.childIds);
      if(!parent || children.some(r=>contract.some(k=>r[k]!==parent[k]))) throw new Error('Invalid parent contract');
      // Prove coverage atom by atom, including complete time coverage. Equal
      // totals alone cannot establish that all reported components are included.
      if(children.some(r=>r.atoms.some(a=>!parent.atoms.includes(a)))) throw new Error('Foreign economic component');
      for(const atom of parent.atoms) {
        const spans=children.filter(r=>r.atoms.includes(atom)).sort((a,b)=>a.periodStart.localeCompare(b.periodStart));
        let next=day(parent.periodStart);
        for(const r of spans) {if(day(r.periodStart)!==next || r.periodEnd>parent.periodEnd) throw new Error('Incomplete component/time partition');next=day(r.periodEnd)+86400000;}
        if(next!==day(parent.periodEnd)+86400000) throw new Error('Incomplete component/time partition');
      }
      const childSum=children.reduce((s,r)=>s+r.value,0), residual=parent.value-childSum;
      const roundingTolerance=(parent.roundingUnit+children.reduce((s,r)=>s+r.roundingUnit,0))/2;
      return {...b,parentValue:parent.value,childSum,residual,roundingTolerance,units:parent.units,
        status:Math.abs(residual)<=1e-9?'reconciled':Math.abs(residual)<=roundingTolerance+1e-9?'consistent_with_source_rounding':'unreconciled',
        coverage:'complete_for_declared_parent',independentCausalValidation:false};
    } catch(error) {return {...b,status:'invalid_partition',reason:error.message,coverage:'incomplete_or_incompatible'};}
  });
  const scopedAccounts=[...new Set(bridges.map(b=>b.parentId))].map(parentId=>{
    const parent=records.find(r=>r.id===parentId), checks=bridges.filter(b=>b.parentId===parentId);
    const closed=Boolean(parent) && checks.every(b=>['reconciled','consistent_with_source_rounding'].includes(b.status));
    return {parentId,companyId:parent?.companyId||null,incidentId:parent?.incidentId||null,
      periodStart:parent?.periodStart||null,periodEnd:parent?.periodEnd||null,metric:parent?.metric||null,units:parent?.units||null,
      disclosedScopeComplete:closed,disclosedImpact:closed?parent.value:null,
      status:closed?'reconciled_for_disclosed_scope':'incomplete_or_unreconciled',
      independentEconomicLoss:null,sourceUrl:parent?.source.url||null};
  });
  return {asOf,records,rejected,bridges,scopedAccounts,subtotal,allIndustryLoss:null,
    reason:'Scoped issuer disclosures can reconcile while losses outside those company, period and metric boundaries remain unmeasured.'};
}
