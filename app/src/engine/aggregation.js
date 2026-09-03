/* ====================================================================
   aggregation.js — BOUNDED AGGREGATION OPERATORS across distinct,
   deduplicated incidents.

   READ THIS BEFORE READING THE FORMULAS. `bounded_union`,
   1 - prod(1 - x_i), is arithmetically the noisy-OR expression, and v6
   called it that. It is NOT used here as a probability calculation and
   the inputs are NOT probabilities: x_i is a bounded exposure score in
   [0,1], not the chance of anything. The operator is used for exactly two
   properties, both of which are statements about the SCORE and neither of
   which is a claim about the world:

     1. monotone — a second adverse incident never lowers the total;
     2. saturating — the total never leaves [0,1].

   It does NOT encode an assumption that incidents are independent, and it
   must not be described that way. Within one incident, correlated paths
   are handled by the joint propagation in propagation.js and never reach
   this file — that is the v6 defect this split exists to fix.

   Three forms are supported and reported separately in model-form
   sensitivity:
     bounded_union  1 - prod(1 - x_i)   continuity base; saturating
     max            max x_i             only the single largest counts
     clipped_sum    min(1, sum x_i)     fully additive up to the bound
   ==================================================================== */
import { clamp } from './math.js';

export const AGGREGATORS = Object.freeze({
  bounded_union: (values) => {
    let product = 1;
    for (const v of values) product *= (1 - clamp(v, 0, 1));
    return clamp(1 - product, 0, 1);
  },
  max: (values) => {
    let m = 0;
    for (const v of values) m = Math.max(m, clamp(v, 0, 1));
    return m;
  },
  clipped_sum: (values) => {
    let s = 0;
    for (const v of values) s += clamp(v, 0, 1);
    return clamp(s, 0, 1);
  },
});

export const AGGREGATOR_IDS = Object.freeze(Object.keys(AGGREGATORS));

/* Combine same-sign, nonnegative contributions in [0,1]. */
export function aggregateNonNegative(values, form = 'bounded_union') {
  const f = AGGREGATORS[form];
  if (!f) throw new Error(`unknown aggregation form "${form}" — expected one of ${AGGREGATOR_IDS.join('|')}`);
  if (!values || !values.length) return 0;
  return f(values);
}

/* Combine signed contributions in [-1,1]. Adverse (positive) and
   mitigating (negative) magnitudes are aggregated SEPARATELY with the same
   operator and then netted, so a mitigating incident offsets an adverse one
   rather than cancelling inside the bounded operator, where the order of
   the inputs would change the answer. */
export function aggregateSigned(values, form = 'bounded_union') {
  const pos = [];
  const neg = [];
  for (const v of values || []) {
    if (v > 0) pos.push(v);
    else if (v < 0) neg.push(-v);
  }
  return clamp(aggregateNonNegative(pos, form) - aggregateNonNegative(neg, form), -1, 1);
}
