/* Claim verification is an eligibility decision, never an impact multiplier.
   Canonical vault adapters mark every incident as factual. Unmarked inputs to
   the mathematical primitive are retained for synthetic fixtures; they must
   never be used as a public factual dataset. */
export function eventEvaluationDate(event, ageDays, suppliedDate) {
  if (suppliedDate) return suppliedDate;
  const raw = event?.dateISO || event?.date;
  const start = raw ? Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : `${raw} UTC`) : NaN;
  return Number.isFinite(start) && Number.isFinite(ageDays)
    ? new Date(start + ageDays * 86400000).toISOString().slice(0, 10) : null;
}

export function factualEligibility(event, evaluationDate) {
  if (event?.recordKind === 'scenario' || event?.recordKind === 'synthetic') {
    return { eligible: true, reason: 'explicit_illustrative_input', factual: false };
  }
  const e = event?.evidence;
  if (event?.recordKind !== 'factual' && !e) return { eligible: true, reason: 'unmarked_computational_fixture', factual: false };
  const deny = (reason) => ({ eligible: false, reason, factual: true });
  if (!e) return deny('missing_evidence_ledger');
  if (e.occurrence?.status !== 'verified' || e.baseline?.eligible !== true) return deny('unresolved_factual_claim');
  const claimSources = (e.sources || []).filter((s) => s.claimStatus === 'verified' && s.supports?.includes('occurrence') && s.url && s.supportingSection);
  if (!claimSources.length) return deny('source_exists_but_claim_unverified');
  if (!e.review?.verifiedAt || !e.review?.provenance) return deny('missing_claim_review_provenance');
  if (!evaluationDate) return deny('missing_evaluation_date');
  if (!claimSources.some((s) => s.informationAvailableDate && s.informationAvailableDate <= evaluationDate)) return deny('evidence_not_available_at_evaluation');
  return { eligible: true, reason: e.baseline.reason, factual: true };
}
