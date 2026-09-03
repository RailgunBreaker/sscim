/* ====================================================================
   policy.js — stage POLICY EXPOSURE from a register of standing controls.

   THE v6 DEFECT. Policy exposure was

       clamp10( strongest + 0.4 * sum(the rest) )

   over RECORDS. That is driven by how many rows the register happens to
   contain: filing the same control twice, or logging a revision of it,
   raised a stage's structural score without anything changing in the
   world. It also had no fixed point — with enough rows every stage
   saturates at 10 regardless of severity.

   THE v7 CONSTRUCT. Two steps, in this order:

     1. DEDUPLICATE INTO FAMILIES. Every record resolves to a stable
        policy family (its own `family` field, else the curated map, else
        its id with a revision suffix stripped). Within a family only the
        STRONGEST severity counts, so a revision or a duplicate report is
        idempotent by construction, not by convention.

     2. AGGREGATE FAMILIES with a bounded operator on sev/10:

          bounded_union  10 * (1 - prod_f (1 - sev_f/10))   [base]
          max            max_f sev_f
          clipped_sum    10 * min(1, sum_f sev_f/10)

        All three are bounded by 10, monotone in each family severity, and
        invariant to duplicate families. The aggregator is a registry model
        form and is reported separately in model-form sensitivity.

   This is a bounded exposure score in [0,10]. It is not a probability of
   enforcement, a compliance cost, or a measured trade effect.
   ==================================================================== */
import { clamp10 } from './math.js';
import { AGGREGATORS } from './aggregation.js';

/* Curated family keys for register entries whose id does not already read
   as a family. The current register is one row per family, so this is
   empty by design — it exists so that when a revision is filed it can be
   attached to its family explicitly rather than by string surgery. */
export const POLICY_FAMILIES = Object.freeze({});

/* Revision suffixes a register id may carry: "-r2", "_rev3", ".v2",
   "-2025", "_amended". Stripped only when the remainder is non-empty. */
const REVISION_SUFFIX = /(?:[-_.](?:r|rev|v|amd|amended|update|revision)\d*|[-_.](?:19|20)\d{2}(?:[-_.]?\d{1,2})?)$/i;

export function policyFamilyOf(policy) {
  if (!policy) return null;
  if (policy.family) return String(policy.family);
  const mapped = POLICY_FAMILIES[policy.id];
  if (mapped) return mapped;
  const id = String(policy.id ?? '');
  const stripped = id.replace(REVISION_SUFFIX, '');
  return stripped || id;
}

/* Collapse a register into families: one severity per family per stage,
   taken as the strongest recorded. Returns the family table plus the
   deduplication counts the audit reports. */
export function buildPolicyFamilies(POLICIES = []) {
  const families = new Map();
  let duplicateRecords = 0;
  for (const p of POLICIES) {
    const family = policyFamilyOf(p);
    if (!family) continue;
    const sev = Number.isFinite(p.sev) ? clamp10(p.sev) : 0;
    const stages = [...new Set(p.stages || [])];
    if (!families.has(family)) {
      families.set(family, { family, sev, stages: new Set(stages), records: [p.id] });
      continue;
    }
    duplicateRecords += 1;
    const f = families.get(family);
    f.sev = Math.max(f.sev, sev);      // a revision never adds; the strongest reading stands
    stages.forEach((s) => f.stages.add(s));
    f.records.push(p.id);
  }
  return {
    families: [...families.values()].map((f) => ({ ...f, stages: [...f.stages].sort() }))
      .sort((a, b) => (a.family < b.family ? -1 : 1)),
    duplicateRecords,
    recordCount: POLICIES.length,
  };
}

/* Stage policy exposure in [0,10], with the family decomposition kept so
   the UI and the audit can show which families produced a score. */
export function policyExposure(stageIds, POLICIES, form = 'bounded_union') {
  const aggregate = AGGREGATORS[form];
  if (!aggregate) throw new Error(`unknown policy aggregator "${form}" — expected one of ${Object.keys(AGGREGATORS).join('|')}`);
  const { families, duplicateRecords, recordCount } = buildPolicyFamilies(POLICIES);

  const scores = {};
  const breakdown = {};
  for (const sid of stageIds) {
    const hits = families.filter((f) => f.stages.includes(sid));
    breakdown[sid] = hits.map((f) => ({ family: f.family, sev: f.sev, records: f.records }));
    scores[sid] = hits.length ? clamp10(10 * aggregate(hits.map((f) => f.sev / 10))) : 0;
  }
  return { scores, breakdown, families, duplicateRecords, recordCount, form };
}
