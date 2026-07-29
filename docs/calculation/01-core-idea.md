[SSCIM calculation specification](README.md) · section 1 of 49

# 1. Core Idea

SSCIM converts real-world semiconductor supply-chain data into structured risk scores.

The complete pipeline is:

```text
Raw data
  ↓
Data cleaning and normalization
  ↓
Supply-chain graph construction
  ↓
Structural-risk calculation
  ↓
Event-shock calculation
  ↓
Shock propagation through the graph
  ↓
Aggregation by company, stage, country, and shareholder
  ↓
Rankings, indices, trends, and sensitivity results
```

The model combines two fundamentally different input types.

## 1.1 Observed data

Observed data come from the real world.

Examples:

- TSMC foundry market share
- ASML's relationship with leading-edge fabs
- Taiwan's share of advanced-node fabrication
- a factory fire date
- an earthquake severity estimate
- a company's customer concentration
- a country's export-control exposure

Observed data may change when the real world changes.

## 1.2 Model parameters

Model parameters tell the algorithm how to process observed data.

Examples:

- downstream transmission coefficient
- upstream transmission coefficient
- event half-life
- minimum specificity floor
- policy-overlap factor
- structural-score weights
- numerical pruning threshold

These parameters are not automatically facts. In the current model, many are declared priors. Later, they should be calibrated using historical disruptions.

The general model is:

```math
\text{Output}
=
F(\text{Observed Data},\text{Model Parameters})
```

---

[Contents](README.md) · [2. Notation →](02-notation.md)
