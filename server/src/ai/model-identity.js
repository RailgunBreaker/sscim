// Tool/helper calls can appear before the drafting model in modelUsage. Preserve
// the full reported set instead of labeling the run with its first entry.
export function modelIdentity(envelope) {
  const modelIds = Object.keys(envelope.modelUsage || {}).sort();
  return { modelIds, model: modelIds.length ? `claude-code[${modelIds.join(',')}]` : 'claude-code[unknown]',
    modelIdentityBasis: modelIds.length ? 'all_reported_usage_models; primary_drafter_unspecified' : 'unreported' };
}
