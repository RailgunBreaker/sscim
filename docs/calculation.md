# SSCIM calculation specification

`app/src/engine/` and `app/src/engine/priors.js` are authoritative. This is the readable calculation reference.

## Inputs

The versioned snapshot contains stage nodes, directed dependencies, country shares, company stakes, and reviewed events. An event has severity `sev`, an authoritative date, selected stages, and a versioned classification. Event age is calculated against the snapshot date—not the visitor’s clock.

## Structural vulnerability

For stage `n`, structural vulnerability is a weighted sum of five bounded components:

```text
struct(n) = wNI·NI(n) + wGEO·GEO(n) + wPOL·POL(n)
          + wSUB·SUB(n) + wMKT·MKT(n)
```

The weights are derived from `MODEL_PRIORS.componentWeights` after excluding the event/shock weight and renormalizing the remaining five. `NI`, `GEO`, and `POL` are derived from graph/snapshot data. `SUB` and `MKT` are declared analyst inputs.

For geographic concentration, shares include the residual:

```text
residual = max(0, 1 - sum(country shares))
HHI = sum(share²) + residual²
```

## Event magnitude and propagation

Initial magnitude is bounded severity multiplied by genuine exponential half-life decay:

```text
s0 = clamp(sev / 10, 0, 1) · 2 ^ (-ageDays / halfLifeDays)
```

The current base priors are: half-life 12 days, downstream transmission 0.55, upstream transmission 0.30, specificity floor 0.25, and contribution tolerance `1e-4`. Downstream is an input-dependence proxy; upstream is a supplier-revenue echo proxy. Neither is a measured input-output coefficient.

The engine follows every declared reachable path until a contribution falls below tolerance. It does not use an arbitrary fixed hop limit.

## Combining events and the displayed index

Same-sign contributions are bounded using:

```text
combinePositive(v1 … vk) = 1 - Π(1 - vi)
```

Positive and negative effects are combined separately into a signed stage field. The aggregate operational index is an economic-weighted mean of the stage field, clamped to `[-1, 1]`; display uses:

```text
displayIndex = 5 + 5 · operationalIndex
```

Thus 5 is neutral, above 5 is net adverse, and below 5 is net mitigating. Only reviewed events classified as operational enter this aggregate.

## Sensitivity and interpretation

Low/base/high presets rerun the same calculation at ±30% on transmission and half-life. They are deterministic assumption tests, not statistical intervals. Outputs are modeled sensitivities, not probabilities, trade flows, physical shipment paths, realized losses, or forecasts.

Read [Methodology](METHODOLOGY.md) for interpretation and [Academic guide](ACADEMIC_GUIDE.md) for reproducibility.
