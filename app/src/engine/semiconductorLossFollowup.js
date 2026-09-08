import { reviewedClaim, validDate } from './evidenceContract.js';
const contract = ['companyId','incidentId','units','metric','accountingBasis'];
const tidy = n => Number(n.toPrecision(12));
export function semiconductorLossFollowup(data, asOf) {
  const rejected=[], ids=new Set();
  function eligible(r) {
    if(!r.id || ids.has(r.id)) throw new Error('Missing or duplicate follow-up evidence ID');
    ids.add(r.id);
    const valid = reviewedClaim(r,asOf) && Number.isFinite(r.value) && r.value>=0 && r.kind==='reported_outcome'
      && validDate(r.periodStart) && validDate(r.periodEnd) && r.periodStart<=r.periodEnd && r.periodEnd<=r.source.publicationDate;
    if(!valid) rejected.push(r.id);
    return valid;
  }
  const bases=(data.bases||[]).filter(eligible).filter(b=>{
    if(contract.every(k=>typeof b[k]==='string' && b[k]))return true;
    rejected.push(b.id);return false;
  });
  const recoveries=(data.recoveries||[]).filter(eligible).filter(r=>{
    const b=bases.find(b=>b.id===r.baseId);
    const valid = b && contract.every(k=>b[k]===r[k]) && ['recognized_recovery','cash_received'].includes(r.measure)
      && ['insurer','material_supplier','mixed_or_unspecified'].includes(r.counterpartyClass)
      && (r.counterpartyClass!=='material_supplier'||Boolean(r.counterpartyId)) && Array.isArray(r.includesIds);
    if(!valid)rejected.push(r.id);return valid;
  });
  function recoverySubtotal(selectedIds) {
    if(!selectedIds.length || new Set(selectedIds).size!==selectedIds.length)throw new Error('Empty or duplicate recovery selection');
    const selected=selectedIds.map(id=>recoveries.find(r=>r.id===id));
    if(selected.some(r=>!r))throw new Error('Unavailable recovery');
    const first=selected[0];
    if(selected.some(r=>r.baseId!==first.baseId || r.measure!==first.measure || contract.some(k=>r[k]!==first[k])))throw new Error('Incompatible recovery basis');
    for(let i=0;i<selected.length;i++) for(let j=i+1;j<selected.length;j++) {
      const a=selected[i],b=selected[j];
      if(a.includesIds.includes(b.id)||b.includesIds.includes(a.id)||a.periodStart<=b.periodEnd&&b.periodStart<=a.periodEnd)throw new Error('Overlapping recovery claims');
    }
    return tidy(selected.reduce((sum,r)=>sum+r.value,0));
  }
  const accounts=bases.map(b=>{
    const rows=recoveries.filter(r=>r.baseId===b.id);
    const recognized=rows.filter(r=>r.measure==='recognized_recovery'&&!rows.some(parent=>parent.includesIds.includes(r.id)));
    const invalid=(data.recoveries||[]).some(r=>r.baseId===b.id&&rejected.includes(r.id));
    let total=null,error=invalid?'Ineligible recovery evidence':null;
    for(const parent of rows) {
      const children=parent.includesIds.map(id=>rows.find(r=>r.id===id));
      if(new Set(parent.includesIds).size!==parent.includesIds.length||children.some(child=>!child||child.id===parent.id
        || child.value>parent.value || child.periodStart<parent.periodStart || child.periodEnd>parent.periodEnd
        || child.includesIds.length)) error='Invalid or nested recovery components';
    }
    try {if(recognized.length&&!error)total=recoverySubtotal(recognized.map(r=>r.id));}catch(e){error=e.message;}
    const insurerCash=rows.filter(r=>r.measure==='cash_received'&&r.counterpartyClass==='insurer');
    let cash=null;
    try {if(insurerCash.length)cash=recoverySubtotal(insurerCash.map(r=>r.id));}catch(e){error=e.message;}
    return {...b,recoveries:rows,status:error?'invalid_recovery_selection':total===null?'recovery_not_quantified':'selected_recoveries_reconciled',reason:error,
      recognizedRecovery:error?null:total,netOfSelectedRecoveries:error||total===null?null:tidy(b.value-total),
      insurerCashReceived:error?null:cash,materialSupplierRecoveries:error?[]:rows.filter(r=>r.counterpartyClass==='material_supplier'),
      finalOutstandingClaim:null,finalCashLoss:null,allIndustryLoss:null};
  });
  const downstream=(data.downstream||[]).filter(eligible).map(r=>({...r,
    disruptionAttributedLoss:null,supplierAttributedLoss:null,identifiedLossBounds:null,eligibleForLossScoring:false,
    exclusionReason:'The issuer reports multiple drivers without isolating incident or supplier effects. Neither zero loss nor the total decline is an identified disruption loss.'}));
  return {asOf,accounts,recoveries,downstream,rejected,recoverySubtotal,questions:data.questions||[],allIndustryLoss:null};
}
