# SSCIM methodology

## Purpose and model boundary

SSCIM is a deterministic sensitivity model over a versioned semiconductor supply-chain snapshot. It asks how an event or scenario would move through a declared graph; it does not estimate the probability, size, or timing of real-world losses.

Every displayed result belongs to one of two families:

- **Structural vulnerability:** a time-invariant 0–10 stage characteristic.
- **Operational impact:** a signed, event-driven field displayed on a 0–10 index where 5 is neutral.

## Structural layer

For each stage, SSCIM combines five components: network influence, geographic concentration, policy exposure, substitutability, and market sensitivity. The model removes the event-driven weight from the structural calculation and renormalizes the remaining declared weights. Network influence, concentration, and policy exposure are data/graph-derived; substitutability and market sensitivity are explicit analyst judgments.

Geographic concentration is Herfindahl-style and includes an `Other` residual when disclosed shares do not total one. Network influence is the normalized, economic-weighted reach of a unit adverse shock through the stage graph.

## Operational layer

Each event has an explicit, versioned classification: direction (`adverse`, `mitigating`, or `mixed`), propagation channel (`downstream`, `upstream`, or `both`), and an `operational` flag. These are not inferred from headlines at runtime.

An event’s starting magnitude is severity divided by ten, multiplied by exponential age decay. The model propagates it across declared graph edges using downstream and upstream transmission priors, applies specificity, truncates negligible contributions, and combines concurrent positive/negative effects separately before producing a signed field.

Only classifications marked `operational: true` contribute to the aggregate chain index. Other events can still be displayed and explained, but are excluded rather than being forced into a misleading single signed score.

## Aggregation and scenarios

Country results are share-weighted stage aggregates; they are production-geography measures, not headquarters measures. Company results use their modeled stage stakes. A scenario uses the same engine as an event but is explicitly simulated; it never silently rewrites baseline historical index values.

Low/base/high outputs are deterministic sensitivity cases based on different priors. They are not confidence intervals.

## Reproducibility and limitations

The graph, snapshot, assumptions, and priors are versioned. Record the commit, snapshot date, event/scenario, and parameters when comparing results. SSCIM lacks facility-level capacity, inventory, bill-of-material, qualification, and recovery-time data; it is not calibrated to observed outcomes. See [Calculation specification](calculation.md), [Validation note](validation/MLE_VALIDATION.md), and [Model roadmap](MODEL_ROADMAP.md).
