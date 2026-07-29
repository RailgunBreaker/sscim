# SSCIM data sources, inputs, and outputs

## Inputs

| Input group | Examples | Status and interpretation |
| --- | --- | --- |
| Supply-chain structure | 24 stages and directed stage dependencies | Curated model structure; changed by review, not automatic scraping. |
| Production geography | Country shares by stage | Curated snapshot input; incomplete coverage is represented as residual share where applicable. |
| Company footprint | Company home country and stage stakes | Curated, source-informed input; not facility-level capacity data. |
| Relationship data | Selected supplier/customer and ownership relationships | Partial sample; revenue relationship is not buyer input-dependence. |
| Historical events | Dated sources, severity, stages, confidence, and classification | Human-reviewed before model publication. |
| Candidate feeds | USGS, Federal Register, configured news feed | Discovery only; a candidate is not a published event. |
| Model priors | Transmission, half-life, component weights, specificity floor | Explicit assumptions in `app/src/engine/priors.js`, not fitted parameters. |

## Processing

1. Ingest feeds into a candidate queue without publishing them.
2. Optionally create an AI draft classification; drafts remain proposals.
3. A human checks source quality, duplication, scope, stages, severity, and uncertainty.
4. Approval updates the SQLite vault and recorded event assumption.
5. Snapshot generation rebuilds derived model data for the frontend.
6. Audit and tests act as a publication gate.

## Outputs

| Output | Meaning | Do not interpret as |
| --- | --- | --- |
| Structural vulnerability | Stable modeled sensitivity of a stage/country/company footprint | Probability or realized risk. |
| Operational index | Event-driven signed sensitivity, displayed around neutral value 5 | Forecast, loss estimate, or market signal. |
| Index history | Replayed operational model state over the snapshot’s event history | A live market or macro time series. |
| Topology routes/metrics | Graph-derived pathways and counterfactual sensitivity | Trade volumes, logistics routes, or contracts. |
| Briefing | A textual summary built from current model state | Independent reporting or investment research. |
| Static snapshot | Versioned dataset deployed to the public site | A continuously live database. |

## Provenance rule

Every meaningful statement should be traceable to either a source, an explicit assumption, or an implemented calculation. If it is none of these, it does not belong in the model.
