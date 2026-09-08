/* ====================================================================
   reconcileBundle.js — what to do when the live vault is older than the
   build that is talking to it.

   THE FAILURE THIS EXISTS TO STOP. The dashboard prefers the live API and
   falls back to the bundled snapshot only when the API is unreachable. But
   there is a third case, and it is the dangerous one: the API answers
   perfectly well while serving a bundle from an older version of
   server/src/bundle.js. Nothing errors. Nothing retries. The response is
   valid JSON with a 200. It is simply missing a section the build now
   expects.

   That happened: the site layer shipped, the operator's long-running server
   process still had the previous bundle.js in memory, and the deployed map
   drew 0 of 275 plants with no indication anything was wrong. Absence read
   as "this project models no facilities" — the same failure as a marker
   hidden behind a zoom gate, arriving by a different route.

   THE RULE. For a section the live bundle does not carry at all, use the
   bundled snapshot's copy and SAY SO. Never silently show nothing that the
   build knows exists.

   WHAT IS NOT DONE, deliberately. A section the live vault *does* carry is
   always taken as-is, even if it is smaller than the snapshot's. The live
   vault is the authority on its own contents: 160 events rather than 163
   means three were withdrawn, and quietly re-adding them from a stale build
   artifact would be the same class of lie in the opposite direction. Only a
   MISSING section — one the running API has no concept of — is filled in.

   Pure and dependency-free so the merge rules are unit-testable.
   ==================================================================== */

/* Sections safe to fill from the snapshot when the live API omits them
   entirely. Each is either reference geography or a curated layer that the
   pipeline does not mutate between runs, so a build-time copy is a faithful
   stand-in. Deliberately excludes events, briefings, quotes and meta: those
   change under the operator's hands, and a stale copy of them would be
   actively misleading rather than merely incomplete. */
const FILLABLE = ['facilities', 'countries', 'stages', 'flowEdges', 'tierLabels', 'companies', 'customers', 'owners', 'policies', 'scenarios', 'dataNotes'];

const isEmpty = (v) => v == null
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

export function reconcileBundle(live, snapshot) {
  if (!live) return { bundle: snapshot, filled: [], dropped: 0, stale: false };
  if (!snapshot) return { bundle: live, filled: [], dropped: 0, stale: false };

  const out = { ...live };
  const filled = [];

  // Explicitly empty observed data can represent a withdrawal. Only a missing
  // section may use the snapshot, and that provenance remains visible.
  if (out.observedData == null && snapshot.observedData != null) {
    out.observedData = snapshot.observedData;
    filled.push('observedData');
  }
  if (out.revenueValidation == null && snapshot.revenueValidation != null) {
    out.revenueValidation = snapshot.revenueValidation;
    filled.push('revenueValidation');
  }
  for (const key of ['chainLossEvidence','lossReconciliations','supplierLossAllocations','semiconductorLossFollowup','recoveryCalibration','physicalLosses','lagTwoValidation','lossFilingMonitor','prospectivePerformance','prospectiveNewsPerformance','structuredCatalog','prospectiveNowcasts']) {
    if (out[key] == null && snapshot[key] != null) { out[key] = snapshot[key]; filled.push(key); }
  }

  for (const key of FILLABLE) {
    if (isEmpty(out[key]) && !isEmpty(snapshot[key])) {
      out[key] = snapshot[key];
      filled.push(key);
    }
  }

  /* Countries are a union rather than a replacement. The live vault may know
     the 16 scoring countries while the build also knows the host countries
     that exist purely so plants can be mapped; taking one or the other would
     either lose the hosts or overwrite a live edit. Live wins on any id both
     sides have. */
  if (!filled.includes('countries') && Array.isArray(snapshot.countries) && Array.isArray(out.countries)) {
    const known = new Set(out.countries.map((c) => c.id));
    const added = snapshot.countries.filter((c) => !known.has(c.id));
    if (added.length) {
      out.countries = [...out.countries, ...added];
      filled.push('countries(+hosts)');
    }
  }

  /* A facility whose operator or country is not in the effective bundle would
     render on the map, open a popup and join a hazard footprint while pointing
     at nothing. Dropping it is the only safe answer, and the count is
     reported rather than swallowed. */
  let dropped = 0;
  if (Array.isArray(out.facilities)) {
    const companyIds = new Set((out.companies || []).map((c) => c.id));
    const countryIds = new Set((out.countries || []).map((c) => c.id));
    const kept = out.facilities.filter((f) => companyIds.has(f.company) && countryIds.has(f.country));
    dropped = out.facilities.length - kept.length;
    if (dropped) out.facilities = kept;
  }

  return { bundle: out, filled, dropped, stale: filled.length > 0 };
}

/* One line for the freshness readout. Returns null when there is nothing to
   say, so the caller can render nothing rather than an empty warning. */
export function staleLiveMessage({ filled, dropped }) {
  if (!filled?.length) return null;
  const sections = filled.join(', ');
  return `The live vault is older than this build and served no ${sections}. `
    + `Showing the bundled snapshot for ${filled.length === 1 ? 'that section' : 'those sections'}`
    + (dropped ? `, minus ${dropped} record(s) it could not resolve` : '')
    + '. Restart the vault API to clear this.';
}
