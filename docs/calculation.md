# SSCIM calculation specification

This document describes the implemented sensitivity model. Code in `app/src/engine/` and priors in `priors.js` are authoritative.

## Inputs

The snapshot supplies a directed stage graph, country shares by stage, company stakes, event classifications, and selected relationship data. Each event provides a severity, date, affected stages, direction, and channel. Dates are re-aged against the snapshot date.

## Structural vulnerability

Each stage receives a 0–10 structural score from weighted components: network influence, geographic concentration, policy exposure, substitutability, and market sensitivity. The first three are derived from the graph/data; substitutability and market sensitivity are declared analyst inputs.

Geographic concentration uses a Herfindahl-style sum of squared country shares, including an explicit residual for unmodeled share. Network influence is the normalized weighted reach of a unit adverse shock through the declared graph.

## Event field

Event strength decays with age:

```text
decay(age) = 2 ^ (-age / 12 days)
```

The current default transmission priors are 0.55 downstream and 0.30 upstream. A specificity multiplier and a `1e-4` contribution tolerance shape propagation. Multiple adverse contributions are combined with a bounded noisy-OR style rule rather than simple addition.

## Interpretation

Outputs are relative model sensitivities. They are not probabilities, causal effects, observed trade flows, production loss, or financial forecasts. The low/base/high controls vary priors deterministically; they are sensitivity cases, not confidence intervals.

See [Academic guide](ACADEMIC_GUIDE.md) and [Validation note](validation/MLE_VALIDATION.md).
