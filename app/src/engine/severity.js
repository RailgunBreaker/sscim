/* ====================================================================
   severity.js — the severity-to-intensity mapping g(q).

   The displayed severity q is a 1-10 HUMAN RUBRIC and it is ORDINAL: the
   rubric establishes that a 7 is worse than a 5, and nothing more. It does
   NOT establish that a 7 is 1.4 times as bad, and no data in this project
   could establish that, because the rubric is the only measurement.

   Everything downstream of the source vector is cardinal arithmetic, so a
   mapping from the ordinal to a [0,1] intensity has to be chosen. That
   choice is a MODEL FORM, declared in the registry, reported separately
   from the numerical parameters in global sensitivity, and never described
   as calibrated.

     linear   g(q) = q/10           continuity base (the v6 behaviour)
     concave  g(q) = sqrt(q/10)     low severities matter relatively more
     convex   g(q) = (q/10)^2       only the top of the scale matters

   All three are monotone increasing on [0,10], agree at q=0 (0) and q=10
   (1), and land in [0,1] — so swapping between them can reorder magnitudes
   but can never change a sign or leave the bounded range.
   ==================================================================== */
import { clamp } from './math.js';

export const SEVERITY_MAPPINGS = Object.freeze({
  linear: (u) => u,
  concave: (u) => Math.sqrt(u),
  convex: (u) => u * u,
});

export const SEVERITY_SCALE_MAX = 10;

/* g(q) for a displayed severity q on the 1-10 rubric. Out-of-range and
   non-numeric severities clamp to the rubric rather than throwing: a bad
   `sev` is a data defect the audit reports, not a reason for the whole
   dashboard to fail to render. */
export function severityIntensity(sev, form = 'linear') {
  const q = Number.isFinite(sev) ? clamp(sev, 0, SEVERITY_SCALE_MAX) : 0;
  const f = SEVERITY_MAPPINGS[form];
  if (!f) throw new Error(`unknown severity mapping "${form}" — expected one of ${Object.keys(SEVERITY_MAPPINGS).join('|')}`);
  return clamp(f(q / SEVERITY_SCALE_MAX), 0, 1);
}
