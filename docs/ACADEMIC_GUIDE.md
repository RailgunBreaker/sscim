# SSCIM academic guide

For researchers deciding whether SSCIM is usable for a given question, and on what terms. The short answer: it is a transparent, deterministic, fully inspectable sensitivity model with declared priors, and it is not calibrated to anything. That combination makes it useful for some questions and unusable for others.

## Appropriate use

SSCIM supports exploratory and comparative research on supply-chain structure, exposure narratives, and sensitivity to declared assumptions. Suitable questions include:

- Which modeled production stages are structurally concentrated, and how much of that concentration is an artifact of disclosure gaps rather than real market structure?
- How does a result change when event classification or transmission priors change? (The sensitivity envelope re-runs everything at ±30% on the transmission coefficients and half-life.)
- Which pathways does the declared graph make salient after a shock, and which of those survive removing an edge?
- What evidence would be needed to validate or reject the model's assumptions? This is the question the model is best suited to, because every assumption is written down in one place.

### Questions it cannot answer

- Anything probabilistic. There is no likelihood, no distribution over outcomes, no confidence interval.
- Anything about realized magnitude. The model has never been fit to an observed disruption, so a score of 7 corresponds to no economic quantity.
- Anything about timing or recovery. There is no time-to-recover, inventory, or capacity data in the dataset.
- Anything requiring measured trade. The dependence matrices are equal-allocation priors from graph degree, not input–output coefficients.

## Method boundary

The model is a transparent sensitivity model, not an estimated causal model. Its transmission coefficients ($f_\downarrow = 0.55$, $f_\uparrow = 0.30$), half-life ($H = 12$ days), specificity floor ($\phi = 0.25$), component weights, and several stage attributes (substitutability, market sensitivity) are **declared priors**: chosen to produce directionally sensible, reproducible, inspectable behaviour, and not fitted to any outcome dataset.

The [validation note](computation-demo/validation/MLE_VALIDATION.md) documents what was and was not established when the parameters were examined against the engine. Read it before citing any parameter as estimated — it exists specifically to prevent that.

Do not interpret outputs as realized losses, probabilities, trade quantities, or company forecasts.

## Evidence tiers

Every input carries a provenance tier, and the tiers are used consistently across the codebase, the interface, and these documents:

| Tier | Meaning | Typical source |
| --- | --- | --- |
| **A** | Peer-reviewed foundations | Production-network shock propagation, Herfindahl concentration, path centrality |
| **B** | Institutional reports | SIA/BCG, SEMI capacity data, CSET, TrendForce/TechInsights/Gartner share estimates |
| **C** | Official primary sources | BIS/METI/MOFCOM rule texts, EU Chips Act, 10-K/20-F, 13F filings |
| **D** | Declared analyst judgment | Substitutability and market-sensitivity scores, all propagation coefficients |
| **GRAPH** | Computed | Every derived quantity; no independent input |

A figure with no data-note entry is carried-over Tier-D judgment, not an individually verified number. `npm run audit:data` reports exactly which stages and companies have evidence notes and which do not; at the current snapshot most do not. Treat that report as part of the dataset description in any write-up.

## Reproducibility

The static snapshot, graph, event assumptions, and priors are all versioned in the repository, and the model is deterministic for a given snapshot and scenario — the same inputs produce bit-identical outputs, with no randomness anywhere in the engine.

To make a result reproducible, record:

1. The repository **commit hash**.
2. The **snapshot date** (`MODEL_PRIORS.datasetAsOf`), which all event ages are measured against. This is not the date you ran it.
3. The selected **event or scenario id**, and any parameter overrides.
4. Any temporary **topology removals** made in the network playground, which change the graph and therefore every derived value.
5. Which **sensitivity case** (low / base / high) the reported figures come from.

Items 2 and 4 are the ones most often omitted and most likely to make a result unreproducible.

## Relationship to the literature

The architecture borrows framing from established work; the specific formulas are original to this project and are **not** drawn from, validated against, or endorsed by the cited authors. The distinction matters for citation: cite these works for the concepts, and SSCIM for what SSCIM does with them.

- Production-network shock propagation and the network-origins-of-fluctuations framing — Acemoglu et al. (2012); Carvalho et al. (2021); Inoue & Todo (2019); Baqaee & Farhi (2019).
- Input specificity shaping downstream transmission — Barrot & Sauvagnat (2016), which motivates the specificity term.
- Topological ordering — Kahn (1962).
- Herfindahl–Hirschman concentration — Hirschman (1945); Herfindahl (1950); Rhoades (1993).
- Separating structural sensitivity from realized impact — Gao et al. (2019).
- The risk of over-aggregating supply-network data into a single score — Diem et al. (2022), which motivates this model's refusal to collapse hazard, mixed, and strategic events into one signed number.

Full citations in Chicago author-date form are in the [repository README](README.md) and the [calculation specification](calculation.md).

## Citation suggestion

Describe SSCIM by repository commit and snapshot date. Cite the specific documents, sources, and assumptions used, and identify results as model-derived sensitivity outputs. For example:

> Supply-chain exposure figures were produced with SSCIM (commit `abc1234`, snapshot 2026-07-29), a deterministic sensitivity model with declared, uncalibrated propagation priors ($f_\downarrow = 0.55$, $f_\uparrow = 0.30$, $H = 12$ days). Figures are model-derived comparative sensitivities within that snapshot, not estimates of realized loss.

## Further reading

- [Methodology](METHODOLOGY.md) — every equation the engine implements.
- [Calculation specification](calculation.md) — the same, derived at length with worked numbers.
- [Validation note](computation-demo/validation/MLE_VALIDATION.md) — what was and was not established.
- [Model roadmap](MODEL_ROADMAP.md) — the data layer required before calibration is meaningful.
- [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md) — provenance of every input.
