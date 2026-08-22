# Reference — Algorithm and priors

*Last updated: 2026-08-22. Part of the [reference library](README.md).*

Every coefficient this model uses, where it came from, and why none of it is
fitted. The formulas themselves are in the
[Methodology](../METHODOLOGY.md); this page is about their **provenance**.

## The declared priors

All of them live in one file — `app/src/engine/priors.js` — so a coefficient
cannot differ between the code, the documentation and the in-app methodology
panel. Every one is **tier D**: a stated assumption, not a fitted parameter.

| Prior | Value | What it governs |
| --- | --- | --- |
| `halfLifeDays` | 12 | Event decay. A **true** half-life: decay(0)=1, decay(12)=0.5, decay(24)=0.25 |
| `downstreamTransmission` | 0.55 | How strongly a shock moves toward buyers |
| `upstreamTransmission` | 0.30 | The demand-side echo toward suppliers |
| `specificityFloor` | 0.25 | Floor on how little a highly substitutable input can transmit |
| `contributionTolerance` | 1e-4 | Where propagation along a path stops |
| `componentWeights` | — | Relative weight of each structural component |

An earlier version used `e^(−age/12)` while *calling* it a 12-day half-life;
that function's actual half-life is 12·ln2 ≈ 8.32 days. The distinction is
recorded here because it is exactly the kind of error a declared-prior file is
meant to make visible.

**Confidence is never multiplied into magnitude.** An earlier version folded a
confidence weight into the shock, conflating *how sure we are* with *how large
the effect is*, so a low-confidence severity-8 event and a high-confidence
severity-6 event rendered identically. Confidence is now reported only as
evidence-quality metadata.

## Sensitivity, not confidence

Low/base/high outputs re-run the whole computation at ±30% on the transmission
coefficients and the half-life. They bound how sensitive a result is to those
priors. **They are not confidence intervals**, and nothing in this model
produces one.

## What is computed rather than collected

Nothing below is an input. Each is recomputed on every load, and each has
exactly one implementation.

| Output | Computed in | What it is not |
| --- | --- | --- |
| Dependence matrices D, U | `engine/graph.js` | Not measured input–output coefficients |
| Network influence | `engine/index.js` | Not a validated centrality metric |
| Geographic concentration (HHI) | `engine/index.js` | Includes an explicit residual for undisclosed share |
| Structural vulnerability | `engine/index.js` | Not a probability |
| Operational impact / chain index | `engine/index.js` | Not a forecast |
| Company criticality / vulnerability / contribution | `engine/index.js` | Three separate numbers, never blended |
| Site-to-site network | `engine/facilityNetwork.js` | **Not a shipment route** |
| Facility profiles | `engine/facilityProfile.js` | Generated from fields, not written per site |
| Hazard footprints | `engine/facilities.js` | A screening circle, not a damage model |
| Index history and attribution | `engine/timeseries.js` | Attribution is **marginal**, not standalone |

### Two properties worth stating

**Network influence replaced a raw path count.** The earlier "chokepoint
centrality" counted source→sink paths through a node and was therefore
sensitive to how the graph happened to be drawn: adding an unrelated parallel
path changed a node's centrality without changing anything about how disruptive
it actually is.

**Attribution is marginal, not standalone.** An event's contribution is the
index on its own date with that event present, minus the same date with only
that event removed. Because propagation combines through a saturating noisy-OR,
standalone magnitudes do not add up — two severity-7 events on the same stages
do not move the index twice as far as one. The marginal figure is the honest
answer to "what did this event contribute to the number we published", and it
is deliberately smaller than the standalone figure whenever events overlap.

## Screening rules with declared thresholds

| Rule | Threshold | Why |
| --- | --- | --- |
| Hazard stage exposure | 5% of a stage's modeled site weight | A radius clipping one small plant must not shock its whole stage |
| Facility colour bands | quiet < 0.10, moderate < 0.35, adverse above | A flat low threshold made 267 of 275 plants red; a map where everything is an alarm carries no information |
| Cluster radius | 34 screen pixels (~38 km at country zoom) | Overlap is a screen-space problem, so the rule is in screen space |
| Site link floor | 1e-9 | Numerical dust only — a floor near the real values deleted the entire back end of the chain |

## The academic boundary

SSCIM is a **deterministic sensitivity model** over a versioned snapshot. It
asks how an event would move through a declared graph. It does not estimate the
probability, size, or timing of real-world losses.

**Nothing here has been calibrated against an outcome dataset.** There is no
facility-level capacity, inventory, bill-of-materials, qualification or
recovery-time data to fit against, and every propagation coefficient is a
declared, unvalidated prior chosen to produce directionally sensible,
reproducible, inspectable behaviour. A real capacity-constrained shock — a fab
physically destroyed — would propagate differently than this model predicts.

See the [validation note](../computation-demo/validation/MLE_VALIDATION.md) for
what has and has not been established, and the
[Model roadmap](../MODEL_ROADMAP.md) for what calibration would require.

## Tier D in one list

Everything in the model that is ours rather than somebody else's:

| Judgement | Where |
| --- | --- |
| Stage substitutability (0–10) | `seed-data.js` `subst` |
| Stage market sensitivity (0–10) | `seed-data.js` `market` |
| Facility significance (1–5) and stage mapping | `facilities-data.js` |
| Policy severity and the 0.4 additional-instrument discount | `seed-data.js` `POLICIES` |
| Event severity, direction, channel, and whether it scores | `engine/event-assumptions.js` |
| All propagation priors above | `engine/priors.js` |
| The screening thresholds above | `engine/facilities.js`, `utils/facilityIcon.js`, `engine/facilityCluster.js` |
