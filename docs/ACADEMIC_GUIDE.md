# SSCIM academic guide

**Model version:** `sscim-model-v7-exposure-robustness`. Canonical specification:
[`docs/MODEL_V7_SPEC.md`](MODEL_V7_SPEC.md).

For researchers deciding whether SSCIM is usable for a given question, and on what terms. The short answer: it is a transparent, deterministic, fully inspectable exposure-sensitivity model with declared priors, and it is not calibrated to anything. That combination makes it useful for some questions and unusable for others.

## Appropriate use

SSCIM supports exploratory and comparative research on supply-chain structure, exposure narratives, and sensitivity to declared assumptions. Suitable questions include:

- Which modeled production stages are structurally concentrated, and how much of that concentration is an artifact of disclosure gaps rather than real market structure?
- How does a result change when incident classification or the declared parameters change? A fixed-seed **global sensitivity design** (`npm run sensitivity`) samples the whole declared assumption box — twelve continuous dimensions — with Saltelli/Sobol first- and total-order estimators, and reports the categorical model forms separately. It answers not only "how much does the answer move" but "which assumption is it resting on".
- Which pathways does the declared graph make salient after a shock, and which of those survive removing an edge?
- What evidence would be needed to validate or reject the model's assumptions? This is the question the model is best suited to, because every assumption is written down in one place.

### Questions it cannot answer

- Anything probabilistic. There is no likelihood, no distribution over outcomes, and no confidence interval anywhere in the model. The bounded aggregation operator resembles a noisy-OR arithmetically but is not a probability calculation and encodes no independence assumption.
- Anything about realized magnitude. The model has never been fit to an observed disruption, so a score of 7 corresponds to no economic quantity. The stage turnover figure is an *importance weight*, not a loss base — supply-chain turnover is sequential, so summing it counts the same silicon several times.
- Anything about timing or recovery beyond what a record states. The temporal profiles carry a *recorded* incident forward from its own date; they predict nothing, and there is no inventory or capacity dataset behind them.
- Anything requiring measured trade. The dependency matrices are equal-allocation priors: **this snapshot supplies no evidence-based edge allocations at all**, and the model counts that fallback rather than hiding it.
- Any cross-snapshot comparison of a snapshot-relative score. Network influence and company criticality are normalized by the largest value in the current snapshot; use the raw measures, which are published beside them.

## Method boundary

The model is a transparent exposure-sensitivity model, not an estimated causal model. Every coefficient lives in one schema-checked registry (`app/src/engine/registry.js`) and **every one of them reads `status: assumption`**: the transmission coefficients, the three persistence durations, the minimum dependency factor, the ramping-site weight, the structural weights, and the six categorical model forms. Each carries a definition, a valid domain, units, a rationale, and a low/base/high assumption range. The canonical table is [spec §5](MODEL_V7_SPEC.md#5-parameter-register), generated from the registry so it cannot drift.

**The low/base/high triples are assumption bounds, not confidence intervals.** Uniform sampling across them is a computational design for exploring the box; nothing establishes that the truth lies inside it.

Read [spec §9](MODEL_V7_SPEC.md#9-validation-status) before citing any parameter as estimated. It separates six activities that are routinely conflated — unit testing, synthetic parameter recovery, numerical reproducibility, sensitivity analysis, empirical calibration, and external validation — and states which have been done. The last two have not. Neither passing unit tests nor recovering parameters from data the model itself generated is validation, and the word is not used for either here; the [synthetic parameter recovery note](computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md) exists specifically to prevent that reading.

Do not interpret outputs as realized losses, probabilities, trade quantities, causal estimates, or company forecasts.

## Evidence tiers

Every input carries a provenance tier, and the tiers are used consistently across the codebase, the interface, and these documents:

| Tier | Meaning | Typical source |
| --- | --- | --- |
| **A** | Peer-reviewed foundations | Production-network shock propagation, Herfindahl concentration, path centrality |
| **B** | Institutional reports | SIA/BCG, SEMI capacity data, CSET, TrendForce/TechInsights/Gartner share estimates |
| **C** | Official primary sources | BIS/METI/MOFCOM rule texts, EU Chips Act, 10-K/20-F, 13F filings |
| **D** | Declared analyst judgment | Non-substitutability and market-sensitivity scores, per-incident stage exposures and temporal profiles, all propagation and persistence parameters, every categorical model form |
| **GRAPH** | Computed | Every derived quantity; no independent input |

A figure with no data-note entry is carried-over Tier-D judgment, not an individually verified number. `npm run audit:data` reports exactly which stages and companies have evidence notes and which do not; at the current snapshot most do not. Treat that report as part of the dataset description in any write-up.

## Reproducibility

The static snapshot, graph, event assumptions, and priors are all versioned in the repository, and the model is deterministic for a given snapshot and scenario — the same inputs produce bit-identical outputs, with no randomness anywhere in the engine.

To make a result reproducible, record:

1. The repository **commit hash**.
2. The **snapshot date** (the vault's `meta.snapshotDate`), which all incident ages are measured against. This is not the date you ran it.
3. The **model version** (`sscim-model-v7-exposure-robustness`). v6 and v7 produce materially different numbers from identical data — see the [change log](MODEL_V7_SPEC.md#10-v6--v7-change-log) — so a figure without a model version is not reproducible.
4. The selected **incident or scenario id**, and any parameter overrides.
5. Any temporary **topology removals** made in the network playground, which change the graph and therefore every derived value.
6. Which **parameter set and model forms** the reported figures come from, if not the registry base.

Items 2, 3 and 5 are the ones most often omitted and most likely to make a result unreproducible.

The global sensitivity artefact is itself byte-reproducible: every draw comes from a fixed-seed generator, and there is no unseeded randomness in the path.

## Relationship to the literature

The architecture borrows framing from established work; the specific formulas are original to this project and are **not** drawn from, validated against, or endorsed by the cited authors. The distinction matters for citation: cite these works for the concepts, and SSCIM for what SSCIM does with them.

- Production-network shock propagation and the network-origins-of-fluctuations framing — Acemoglu et al. (2012); Carvalho et al. (2021); Inoue & Todo (2019); Baqaee & Farhi (2019).
- Input specificity shaping downstream transmission — Barrot & Sauvagnat (2016), which motivates the specificity term.
- Topological ordering — Kahn (1962).
- Herfindahl–Hirschman concentration — Hirschman (1945); Herfindahl (1950); Rhoades (1993). SSCIM publishes it as a `[lower, upper]` **interval**, because the concentration of the undisclosed residual is not identified by the observed shares.
- Variance-based global sensitivity analysis — Sobol (2001); Saltelli et al. (2010), whose critique of one-at-a-time designs is why v7 replaced three jointly-moving presets with a global design.
- Separating structural sensitivity from realized impact — Gao et al. (2019).
- The risk of over-aggregating supply-network data into a single score — Diem et al. (2022), which motivates this model's refusal to collapse hazard, mixed, and strategic events into one signed number.

Full citations in Chicago author-date form are in the [source register](reference/SOURCE-REGISTER.md), which names the file implementing each method.

## Citation suggestion

Describe SSCIM by repository commit and snapshot date. The commit and date below are placeholders — substitute the ones your run actually used, which `docs/benchmarks/verification-run.json` records for the verified run. Cite the specific documents, sources, and assumptions used, and identify results as model-derived sensitivity outputs. For example:

> Supply-chain exposure figures were produced with SSCIM model version `sscim-model-v7-exposure-robustness` (commit `abc1234`, snapshot as-of `YYYY-MM-DD`), a deterministic exposure-sensitivity model whose propagation, persistence and structural parameters are declared and uncalibrated (`status: assumption`; ranges in `app/src/engine/registry.js`). Figures are bounded comparative exposure scores within that snapshot, not estimates of realized loss, and the reported spread is an assumption envelope rather than a confidence interval.

## Further reading

- [**Model v7 specification**](MODEL_V7_SPEC.md) — the canonical definition: notation, every formula, the parameter register, the fallback rules, a reproducible worked example, and the validation status of each activity separately.
- [Methodology](METHODOLOGY.md) — why the model is shaped this way.
- [Calculation walkthrough](calculation.md) — the seven steps in order.
- [Synthetic parameter recovery](computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md) — what that test does and does not establish.
- [Computation demonstration](computation-demo/COMPUTATION_DEMO.md) — the live engine's inputs, intermediates and outputs as CSV.
- [Model roadmap](MODEL_ROADMAP.md) — the data layer required before calibration is meaningful.
- [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md) — provenance of every input.
- [v6 archive](archive/v6/README.md) — the superseded model, preserved with a historical warning.
