/* ====================================================================
   graph.js — directional dependence matrices and all-paths propagation.

   Replaces the old two-hop-downstream/one-hop-upstream "propagate()"
   with propagation over every reachable path in the DAG, using two
   distinct, explicitly-labeled dependence proxies (see MISSION spec /
   README "Model status and limitations"):

     D[b][a] — downstream INPUT-DEPENDENCE proxy: how much buyer stage b
               depends on supplier stage a for input, given b's in-degree
               and a's substitutability-derived specificity. This is a
               transparent equal-allocation prior, NOT a measured input-
               output coefficient (no BOM/facility data exists yet).

     U[a][b] — upstream SUPPLIER-REVENUE-DEPENDENCE proxy: the demand-side
               echo felt by supplier a when buyer b is disrupted, given
               a's out-degree. Also a prior, not a measured trade flow.

   Neither matrix is a measured trade/input coefficient — both are
   declared, transparent priors built only from graph structure (in/out
   degree) and the one analyst-judgment input the dataset already has
   (stage substitutability). See MODEL_ROADMAP.md for what real data
   would need to replace these.
   ==================================================================== */
import { clamp, combineSigned, topologicalSort } from './math.js';

export function buildAdjacency(stageIds, edges) {
  const OUT = {}, IN = {};
  stageIds.forEach((id) => { OUT[id] = []; IN[id] = []; });
  edges.forEach(([a, b]) => {
    if (!(a in OUT) || !(b in OUT)) return; // invalid edges are reported by diagnostics.validateGraph, not silently traversed
    OUT[a].push(b);
    IN[b].push(a);
  });
  return { OUT, IN };
}

/* Builds the two directional dependence-proxy matrices described above.
   `getSubstitutability(stageId)` returns the stage's 0-10 substitutability
   score (higher = more substitutable / less specific). */
export function buildDependenceMatrices(stageIds, OUT, IN, getSubstitutability, priors) {
  const D = {}, U = {};
  stageIds.forEach((id) => { D[id] = {}; U[id] = {}; });

  // NOTE ON NAMING: the dataset's stage field is called "subst" ("substitutability
  // risk") but, by this dataset's own convention (see original WEIGHTS/risk-score
  // usage), a HIGH value means the stage is HARD to substitute — i.e. high
  // specificity/criticality, not high substitutability. specificity(a) below
  // uses the score directly, matching that existing convention: higher score
  // -> higher specificity -> stronger downstream transmission.
  const specificity = {};
  stageIds.forEach((a) => {
    const subst = getSubstitutability(a) ?? 0;
    specificity[a] = clamp(subst / 10, 0, 1);
  });

  stageIds.forEach((a) => {
    const outdeg = OUT[a].length;
    OUT[a].forEach((b) => {
      const indeg = IN[b].length || 1;
      const baseInputShare = 1 / indeg;
      D[b][a] = priors.downstreamTransmission * baseInputShare
        * (priors.specificityFloor + (1 - priors.specificityFloor) * specificity[a]);
      U[a][b] = outdeg ? priors.upstreamTransmission / outdeg : 0;
    });
  });
  return { D, U };
}

/* Propagates a single signed shock (positive=adverse, negative=mitigating)
   originating at `sourceId` across every reachable path in the DAG —
   downstream via D (topological order), upstream via U (reverse
   topological order), each hop combined with same-node contributions via
   combineSigned (bounded noisy-OR), truncated once a contribution's
   magnitude falls below `tolerance`. Returns a plain object mapping every
   stage id to its signed contribution (0 for unreached stages). */
export function propagateFromSource({ sourceId, magnitude, channel, stageIds, OUT, IN, TOPO, REV_TOPO, D, U, tolerance }) {
  const field = Object.fromEntries(stageIds.map((id) => [id, 0]));
  if (!Number.isFinite(magnitude) || magnitude === 0) return field;

  const downstream = channel === 'downstream' || channel === 'both';
  const upstream = channel === 'upstream' || channel === 'both';

  const dField = {};
  if (downstream) {
    dField[sourceId] = magnitude;
    for (const n of TOPO) {
      if (n === sourceId) continue;
      const contributions = [];
      for (const p of IN[n] || []) {
        const pv = dField[p];
        const coeff = D[n]?.[p];
        if (pv && coeff) contributions.push(pv * coeff);
      }
      if (contributions.length) {
        const combined = combineSigned(contributions);
        if (Math.abs(combined) >= tolerance) dField[n] = combined;
      }
    }
  }

  const uField = {};
  if (upstream) {
    uField[sourceId] = magnitude;
    for (const n of REV_TOPO) {
      if (n === sourceId) continue;
      const contributions = [];
      for (const s of OUT[n] || []) {
        const sv = uField[s];
        const coeff = U[n]?.[s];
        if (sv && coeff) contributions.push(sv * coeff);
      }
      if (contributions.length) {
        const combined = combineSigned(contributions);
        if (Math.abs(combined) >= tolerance) uField[n] = combined;
      }
    }
  }

  stageIds.forEach((id) => {
    if (id === sourceId) { field[id] = magnitude; return; }
    const vals = [];
    if (dField[id]) vals.push(dField[id]);
    if (uField[id]) vals.push(uField[id]);
    if (vals.length) field[id] = combineSigned(vals);
  });
  return field;
}

export { topologicalSort };
