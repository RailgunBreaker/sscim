# Reference — Algorithm and priors

*Model version: `sscim-model-v7-exposure-robustness`. Part of the
[reference library](README.md).*

Every coefficient this model uses, where it came from, and why none of it is
fitted. **The values themselves are published once**, in
[§5 of the canonical specification](../MODEL_V7_SPEC.md#5-parameter-register),
generated directly from `app/src/engine/registry.js` — so a coefficient cannot
differ between the code and the documentation. This page is about their
**provenance and status**, not their values.

The formulas are in [`docs/MODEL_V7_SPEC.md`](../MODEL_V7_SPEC.md); the reasoning
behind them is in the [methodology](../METHODOLOGY.md).

---

## Where the parameters live

One schema-checked registry: `app/src/engine/registry.js`. Nothing else in the engine
may hard-code a coefficient. Every entry carries, by construction and enforced at
import time:

- a machine name and the symbol used in the specification;
- a one-sentence semantic definition;
- **low / base / high** assumption values;
- a valid numerical domain and units;
- the model component that consumes it;
- a rationale for the value and the range;
- `status` — `assumption` or `calibrated`;
- the model version.

**Every parameter in this build is `status: assumption`.** None has been
estimated from observed disruption outcomes.

### The low/base/high triples are assumption bounds

They are a range a reasonable analyst might defend. They are **not confidence
intervals**, not credible intervals, and not a probability distribution over the
true value. Sampling uniformly across them, as the global sensitivity design
does, is a computational device for exploring the box — nothing establishes that
the truth lies inside it.

### Renamed in v7, because the old names were wrong

| Old name | Current name | Why |
| --- | --- | --- |
| `subst` | `nonSubstitutability` | The field was called "substitutability" while being used with the opposite sense: a high value means the stage is **hard** to substitute. |
| `specificityFloor` | `minimumDependencyFactor` | It is a floor on the dependency the factor produces, not on specificity. |
| `choke` | `networkInfluence` | It is a modelled reachability measure, not a validated centrality metric. |
| one global `halfLifeDays` | `acuteHalfLifeDays`, `marketHalfLifeDays`, `outageRecoveryDays` | One half-life for every event class was the defect; persistence is now per-incident. |
| `contributionTolerance` | *removed* | Propagation is exact on a finite DAG. A display epsilon survives for formatting only. |

A compatibility adapter reads stored artefacts written under the old names; the
current output surface, UI and documentation use the unambiguous names
throughout.

### Confidence is never multiplied into magnitude

An earlier version folded a confidence weight into the shock, conflating *how
sure we are* with *how large the effect is*, so a low-confidence severity-8
incident and a high-confidence severity-6 incident rendered identically.
Confidence is reported only as evidence-quality metadata.

---

## Categorical model forms

Six choices in the registry are **categorical**, not numerical: severity mapping,
facility ordinal mapping, incident aggregation, HHI residual bound, stage
weighting, and the policy aggregator. A model form is a **different model**, not
a different value of the same model, so sensitivity reports them separately and
never averages across them.

Each has a declared base — in every case the v6 behaviour where one existed, for
continuity — and alternatives that bracket it monotonically. See
[spec §5.3](../MODEL_V7_SPEC.md#53-categorical-model-forms).

---

## Sensitivity, not confidence

The principal uncertainty analysis is a **fixed-seed global design**
(`npm run sensitivity`): Saltelli sampling with Sobol first- and total-order
estimators over the assumption box, one-at-a-time diagnostics, rank stability,
sign stability, and a separate full factorial over the model forms. There is no
unseeded randomness anywhere in that path, so the artefact is byte-reproducible.

It replaced three presets that moved the transmission coefficients and the
half-life **together**, in the same direction, by the same relative amount — a
design that cannot separate one parameter's influence from another's and
systematically overstates the spread.

**The reported spread is an assumption envelope. It is not a confidence
interval**, and nothing in this model produces one.

---

## What is computed rather than collected

Nothing below is an input. Each is recomputed on every load, and each has exactly
one implementation.

| Output | Computed in | What it is not |
| --- | --- | --- |
| Dependency matrices D, U | `engine/propagation.js` | Not measured input–output coefficients |
| Edge allocations q, r | `engine/propagation.js` | **None supplied in this snapshot** — equal split, counted as a diagnostic |
| Network influence (raw + snapshot-relative) | `engine/index.js` | Not a centrality metric with established properties |
| Geographic concentration | `engine/math.js` `hhiBounds()` | An interval, not a point measurement — the residual is unobserved |
| Policy exposure | `engine/policy.js` | Family-deduplicated; not driven by how many rows the register holds |
| Structural vulnerability | `engine/index.js` | Not a probability |
| Operational field / chain index | `engine/index.js` | Not a forecast |
| Country local pressure / chain contribution | `engine/index.js` | Two different questions, never one number |
| Company criticality / vulnerability / contribution | `engine/index.js` | Three separate numbers, never blended |
| Site-to-site network | `engine/facilityNetwork.js` | **Not a shipment route** |
| Facility profiles | `engine/facilityProfile.js` | Generated from fields, not written per site |
| Hazard footprints | `engine/facilities.js` | A screening circle, not a damage model |
| Index history and attribution | `engine/timeseries.js` | Attribution is **marginal**, not standalone |

### Three properties worth stating

**Relative scores are snapshot-relative.** Network influence and company
criticality are divided by the largest raw value *in the current snapshot*. They
order things within one snapshot and are not comparable across snapshots, because
the denominator changes when the stage or company set does. The raw measure is
published beside each one.

**Company criticality applies topology exactly once.** It weights the propagated
field by the economic weight, which carries no topology. Weighting by network
influence — itself a propagation-derived reachability measure — rewarded a
company on a well-connected stage twice for the same connectivity.

**Attribution is marginal, not standalone.** An incident's contribution is the
index on its own date with that incident present, minus the same date with only
that incident removed. Because distinct incidents combine through a saturating
bounded operator, standalone magnitudes do not add up: two severity-7 incidents
on the same stages do not move the index twice as far as one. The marginal figure
is the honest answer to "what did this contribute to the number we published",
and it is deliberately smaller than the standalone figure whenever incidents
overlap.

---

## Screening rules with declared thresholds

| Rule | Threshold | Why | Does it gate a modelled value? |
| --- | --- | --- | --- |
| Hazard exposure display threshold | 5% of a stage's modeled site weight | Leads the readout with the material rows | **No.** Display only. Every stage with a nonzero footprint is scored, in proportion to it. |
| Facility colour bands | quiet < 0.10, moderate < 0.35, adverse above | A flat low threshold made 267 of 275 plants red; a map where everything is an alarm carries no information | No |
| Cluster radius | 34 screen pixels (~38 km at country zoom) | Overlap is a screen-space problem, so the rule is in screen space | No |
| Site link floor | 1e-9 | Numerical dust only — a floor near the real values deleted the entire back end of the chain | No |

The 5% line **used to** gate the model: below it a stage scored nothing, above it
a stage scored a full-severity shock. That cliff is gone; see
[spec §10](../MODEL_V7_SPEC.md#10-v6--v7-change-log).

---

## Where the methods come from

Every technique the engine runs is somebody else's, and each is cited in
[Source register §3](SOURCE-REGISTER.md#3-methods-and-the-literature-behind-them)
with the file that implements it:

| Method | Implemented in | Cited to |
| --- | --- | --- |
| Herfindahl–Hirschman concentration | `engine/math.js` `hhiBounds()` | Hirschman 1945; DOJ/FTC *Merger Guidelines* 2023 for the thresholds |
| Bounded saturating aggregation | `engine/aggregation.js` | Pearl 1988; Oniśko, Druzdzel and Wasyluk 2001 — cited for the **functional form only**, not for an independence assumption |
| Exponential salience decay | `engine/persistence.js` | Wu and Huberman 2007 |
| Betweenness centrality | `engine/networkAnalysis.js` `betweenness()` | Freeman 1977; Brandes 2001 |
| Topological ordering | `engine/math.js` `topologicalSort()` | Kahn 1962 |
| Widest-path / bottleneck routing | `engine/networkPaths.js` | Hu 1961 |
| Node-removal sensitivity | `engine/networkAnalysis.js` | Albert, Jeong and Barabási 2000 |
| Variance-based global sensitivity (Sobol / Saltelli) | `engine/sensitivity.js` | Sobol' 2001; Saltelli et al. 2010 |
| Rank correlation for stability | `engine/math.js` `spearman()` | Spearman 1904 |
| Shock propagation in production networks | `engine/index.js`, `engine/facilityNetwork.js` | Acemoglu et al. 2012; Barrot and Sauvagnat 2016; Carvalho et al. 2021; Inoue and Todo 2019 |
| Disruption severity | `engine/index.js` | Craighead et al. 2007 |
| Input-output structure | `engine/propagation.js` | Miller and Blair 2009 |

**The parameters are not cited, and that is deliberate.** The half-lives, the
transmission coefficients and the stage weights are ours (Tier D). A reference
attached to one of them would launder an assumption into a finding. What the
literature supports is the *form* of each calculation; the *values* fed into it
are declared judgement, and the distinction is the whole point of this document.

Two entries are cited against themselves rather than in support. **Saltelli et
al.** is the standard critique of one-at-a-time sensitivity analysis — which is
why v7 replaced the three jointly-moving presets with a variance-based global
design, and why the one-at-a-time diagnostics are reported *beside* the Sobol
indices rather than instead of them. **Miller and Blair** is cited to be explicit
that the dependency matrices are equal-allocation priors, **not** measured
technical coefficients.

The bounded aggregation operator deserves its own note. Arithmetically it is the
noisy-OR expression, and Pearl is cited for that form. It is **not** used here as
a probability calculation, the inputs are **not** probabilities, and it encodes
**no** assumption that incidents are independent. It is used for two properties
of the score: monotonicity and saturation.

---

## The academic boundary

SSCIM is a **deterministic comparison and sensitivity environment** over a
versioned snapshot. It asks how an incident would move through a declared graph.
It does not estimate the chance, size, or timing of real-world losses.

**Nothing here has been calibrated against an outcome dataset.** There is no
facility-level capacity, inventory, bill-of-materials, qualification or
recovery-time data to fit against, and every propagation coefficient is a
declared, uncalibrated prior chosen to produce directionally sensible,
reproducible, inspectable behaviour. A real capacity-constrained shock — a fab
physically destroyed — would propagate differently from what this model shows.

Passing unit tests is not validation, and recovering parameters from data the
model itself generated is not validation. See
[spec §9](../MODEL_V7_SPEC.md#9-validation-status) for the status of each
activity separately, the
[synthetic parameter recovery note](../computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md)
for what that test does and does not show, and the
[model roadmap](../MODEL_ROADMAP.md) for what calibration would require.

---

## Tier D in one list

Everything in the model that is ours rather than somebody else's:

| Judgement | Where |
| --- | --- |
| Stage non-substitutability (0–10) | `seed-data.js` (`subst` in the stored schema) |
| Stage market sensitivity (0–10) | `seed-data.js` `market` |
| Facility significance (1–5 **ordinal**) and stage mapping | `facilities-data.js` |
| Policy severity, family assignment and the aggregator form | `seed-data.js` `POLICIES`, `engine/policy.js` |
| Incident severity, direction, channel, and whether it scores | `engine/event-assumptions.js` |
| Per-incident stage exposure and temporal profile, each with a recorded basis | `engine/event-model.js` |
| Every propagation, persistence and facility parameter | `engine/registry.js` |
| Every categorical model form | `engine/registry.js` `MODEL_FORMS` |
| The screening thresholds above | `engine/facilities.js`, `utils/facilityIcon.js`, `engine/facilityCluster.js` |
