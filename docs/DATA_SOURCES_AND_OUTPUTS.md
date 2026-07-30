# SSCIM data sources, inputs, and outputs

What enters the model, where it came from, how it is processed, and what each output does and does not mean.

## Provenance rule

Every meaningful statement is traceable to exactly one of three things: **a source**, **an explicit assumption**, or **an implemented calculation**. If it is none of these, it does not belong in the model. The evidence tiers below are used consistently in the codebase, the interface, and every document here.

| Tier | Meaning |
| --- | --- |
| **A** | Peer-reviewed academic foundations |
| **B** | Institutional and industry reports |
| **C** | Official primary sources — rule texts, filings |
| **D** | Declared analyst judgment; not fitted to anything |
| **GRAPH** | Computed from the above; no independent input |

## Inputs

| Input group | Size | Tier | Status and interpretation |
| --- | --- | --- | --- |
| Stage graph | 24 stages, 34 directed edges | B | Curated from published process-flow descriptions; validated acyclic. Changed by review, never by scraping. |
| Production geography | Country shares per stage, 16 countries | B | Capacity and market estimates. Undisclosed remainder is kept as an **explicit residual**, not silently dropped — see the HHI treatment in the methodology. |
| Company footprint | 109 companies, within-stage stakes | B / C | Source-informed share estimates and filings. **Not** facility-level capacity data; no fab locations, no utilization. |
| Customer relationships | 243 supplier→customer edges | C + B | Disclosed customer concentration plus trade-press estimates, top customers only. This is *supplier-revenue share*, which is **not** buyer input-dependence — the two directions are different quantities and are modeled separately. |
| Ownership | 75 shareholder rows | C | 13F filings, annual reports, exchange disclosures. Ages quickly; the most compliance-sensitive dataset here. |
| Policy instruments | 7 | C + D | Rule texts are Tier C; the severity score and the 0.4 additional-instrument discount are Tier D judgments. |
| Historical events | 147 code-defined (6 illustrative, 141 sourced over ten years, Aug 2016 → Jul 2026) plus reviewed pipeline events | B / C | Dated, cited, human-reviewed before publication. Ages derive from an authoritative `dateISO`, never hand-maintained. Coverage is uneven by year and thickens toward the present — see the density caveat below. |
| Event classifications | one per event id | D | Direction, channel, and whether it counts toward the score. Hand-curated in `event-assumptions.js`; **never inferred from headline text at runtime**. |
| Stage judgments | substitutability, market sensitivity | D | Analyst scores 0–10 against a written rubric. |
| Model priors | transmission, half-life, weights, specificity floor, tolerance | D | Explicit assumptions in `app/src/engine/priors.js`. Not fitted parameters. |
| Candidate feeds | USGS, Federal Register, news | — | **Discovery only.** A candidate is not an event and never reaches the model unreviewed. |
| Market quotes | 92 of 109 listed companies | — | Yahoo Finance. **Display metadata only — never an engine input.** |

### What is deliberately absent

No facility geography, no bill of materials, no inventory days, no capacity or utilization, no time-to-recover, no qualification relationships, no alternative-supplier counts. The dependence matrices are equal-allocation priors derived from graph degree precisely *because* none of that data exists here. See the [Model roadmap](MODEL_ROADMAP.md) for what acquiring it would involve.

### The event-density caveat

The event record is a **curated sample, not a census**, and its density is uneven: recent months are ingested daily through the pipeline, while 2017 is represented by a handful of records written in one pass. Because the operational index aggregates whatever events are inside the decay horizon, a period covered more thoroughly scores higher than an equally eventful period covered more thinly — the index is measuring the dataset as well as the world.

The dashboard's HISTORY panel reports this directly, as the correlation between the index and the trailing 30-day severity mass of scored events, next to per-year event counts. Read those counts before reading a trend into the yearly means. Two consequences follow: cross-year comparisons of the *level* are weak evidence, and a single real event entered several times (one earthquake reported by six sources, each approved separately) inflates the index materially, because simultaneous shocks accumulate through noisy-OR rather than being deduplicated by the model.

## Processing

1. **Ingest** feeds into a candidate queue. Nothing is published by this step.
2. **Deduplicate** at ingest. An identical restatement of a story already seen is collapsed automatically; a near-duplicate is left pending but flagged, because a one-token difference can be two genuinely different rules. Duplicates are marked, not deleted, so the record of what arrived stays intact.
3. **Draft** an optional AI classification. Drafts are proposals with no authority — an unreviewed candidate cannot affect any score.
4. **Review.** A human checks source quality, duplication, scope, affected stages, severity, and uncertainty, and may override every proposed field.
5. **Approve**, which writes the event into the vault and records its classification.
6. **Publish**, once per review session rather than once per decision: regenerate the snapshot, run the audit and tests, then commit and push. This fires automatically when the reviewer stops deciding or the queue empties, and can be triggered explicitly at any time.
7. **Gate.** Audit and tests must pass or nothing is published and the previous deployment stays live.

## Outputs

| Output | Meaning | Do not interpret as |
| --- | --- | --- |
| Structural vulnerability | Stable modeled sensitivity of a stage, country, or company footprint | A probability, or realized risk |
| Operational index | Event-driven signed sensitivity, displayed around neutral 5 | A forecast, loss estimate, or market signal |
| Network influence | Normalized reach of a unit shock through the graph | A validated centrality metric, or economic loss |
| Company vulnerability | Average adverse impact across occupied stages, size-independent | A company-level risk rating |
| Company contribution | Share-weighted share of an aggregate modeled effect | A financial-loss estimate |
| Company criticality | Effect of fully disrupting that company, normalized against the observed maximum | An investment view of any kind |
| Capital power | Ownership stake weighted by company criticality | Influence, control, or intent |
| Index history | The operational model replayed over the snapshot's event record, daily across a ten-year window | A live market or macro time series |
| Per-event index impact | The **marginal** change on the event's own date: the index with that event minus the index without it | An additive decomposition — marginal effects do not sum to the index, because shocks combine through a saturating noisy-OR |
| Topology routes and metrics | Graph-derived pathways and counterfactual sensitivity | Trade volumes, logistics routes, or contracts |
| Sensitivity envelope (low/base/high) | The same computation at ±30% on transmission and half-life | A confidence interval — it is not one |
| Briefing | A textual summary generated from current model state | Independent reporting or investment research |
| Static snapshot | A versioned dataset deployed to the public site | A continuously live database |

## Data quality, stated plainly

`npm run audit:data` reports which inputs carry an evidence note and which are carried-over judgment. At the current snapshot most stages and most companies have **no** individual evidence note, meaning they are Tier-D analyst judgment rather than individually verified figures.

This is a meaningfully improved snapshot, not a fully sourced production database, and it should not be represented as one. Any write-up using these figures should say which of them carry evidence notes.

## Further reading

- [Methodology](METHODOLOGY.md) — how these inputs become those outputs.
- [Data pipeline](computation-demo/DATA_PIPELINE.md) — each input's candidate feed and its automation ceiling.
- [Real-data example](computation-demo/REAL_DATA_EXAMPLE.md) — an end-to-end run on genuinely fetched data.
- [Model roadmap](MODEL_ROADMAP.md) — the missing data layer.
