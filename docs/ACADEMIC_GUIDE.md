# SSCIM academic guide

## Appropriate use

SSCIM supports exploratory and comparative research on supply-chain structure, exposure narratives, and sensitivity to declared assumptions. Suitable questions include:

- Which modeled production stages are structurally concentrated?
- How does a result change when event classification or transmission priors change?
- Which pathways does the declared graph make salient after a shock?
- What evidence would be needed to validate or reject the model’s assumptions?

## Reproducibility

The static snapshot, graph, event assumptions, and priors are versioned in the repository. The model is deterministic for a given snapshot and scenario. Record the commit, snapshot date, selected event/scenario, parameters, and any temporary topology removals when reporting results.

## Method boundary

The model is a transparent sensitivity model, not an estimated causal model. Its transmission coefficients, half-life, and some stage attributes are declared priors. It has not been fit to an outcome dataset and its sensitivity envelope is not a statistical confidence interval.

Do not interpret outputs as realized losses, probabilities, trade quantities, or company forecasts. See [Calculation specification](calculation.md), [Validation note](validation/MLE_VALIDATION.md), and [Model roadmap](MODEL_ROADMAP.md).

## Citation suggestion

Describe SSCIM by repository commit and snapshot date. Cite the specific documents, sources, and assumptions used; identify results as model-derived sensitivity outputs.
