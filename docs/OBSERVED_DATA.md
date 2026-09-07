# Observed data and analytical remediation

Reviewed September 7, 2026. The new default workspace reads
`reference/observed-data.json`; the v7 assumption model remains an explicitly
selected research view. This is a substantive new dataset and calculation path,
not empirical validation of v7.

## Dataset assembled from primary documents

| Dataset | Records | Meaning |
| --- | ---: | --- |
| Fab capacity | 48 | Twelve UMC fabs, annually for 2022–2025; issuer-reported calculated maximum output |
| Supplier relationships | 14 | Five AMD, eight NVIDIA and one GlobalFoundries product-scoped supplier disclosures |
| Disruption/recovery observations | 16 | Eight incidents, preserving tool, wafer-input, production-capacity and qualitative restart definitions |
| Reported financial outcomes | 16 | Five incidents; issuer-attributed revenue/profit effects, recognized costs and insurance proceeds kept separate |
| Earlier issuer forecasts | 6 | Two incidents with subsequent comparable outcomes; three accounting metrics per incident |
| Reported manufacturing routes | 1 | Intel Kulim die sort to Penang assembly, documented in an original factory-tour report; allocation and volume unknown |
| Plant shipment links | 0 | None asserted or synthesized |

UMC's [fourth-quarter 2025 report, page 9](https://event-prod.zucast.com/attach/52d41749702efeb443f2539fd74e4c14/10561/UMC25Q4_report.pdf)
contains the fab table. Its footnote describes calculated maximum output,
not measured shipments. The import preserves the native wafer diameter,
thousand-wafer rounding, period, source, and review provenance. The PDF table
was visually checked; its downloaded SHA-256 is recorded. Future estimates
in the adjacent quarterly table were not imported as historical actuals.

[AMD's 2024 report, printed page 23](https://ir.amd.com/financial-information/sec-filings/content/0001193125-25-067185/0001193125-25-067185.pdf)
supports its disclosed foundry relationships. The complete dependency on TSMC
applies only to microprocessor/GPU wafers at nodes of 7nm or smaller, not all
AMD products. The publication date is supported by the
[SEC filing record](https://www.sec.gov/Archives/edgar/data/2488/000119312525067185/0001193125-25-067185-index.html).
[NVIDIA's fiscal 2025 filing, Manufacturing](https://www.sec.gov/Archives/edgar/data/1045810/000104581025000023/nvda-20250126.htm)
identifies foundries, memory suppliers and assembly contractors; it does not
quantify their allocation shares. Unknown shares remain unknown.

[GlobalFoundries' 2024 filing, Risk Factors](https://www.sec.gov/Archives/edgar/data/1709048/000170904825000024/gfs-20241231.htm)
reports that Soitec supplied 61% of its SOI wafers. This is a buyer input share
for a defined wafer class, not a supplier revenue share or a whole-company
production allocation. A hypothetical 50% reduction in Soitec supply gives a
30.5% known exposure component and a 30.5–69.5% interval while the remaining
39% of supply is unspecified. The graph can trace Soitec to GF to AMD, but
product continuity across those two disclosures is not established.

The recovery ledger identifies the exact production step and scope. For example,
Renesas reports [88% N3 capacity at the end of May 2021](https://www.renesas.com/en/about/press-room/update-9-notice-regarding-semiconductor-manufacturing-factory-naka-factory-fire-production-capacity),
while [the June update](https://www.renesas.com/en/about/press-room/update-10-notice-regarding-semiconductor-manufacturing-factory-naka-factory-fire-production-capacity)
distinguishes restored production from expected future shipments.
[TSMC's April 2024 statement](https://www.sec.gov/Archives/edgar/data/1046179/000104617924000050/a20240418.htm)
reports tool recovery. That quantity is not converted into wafer-output recovery.
Every imported observation carries its own source location and limitations.
The ledger also includes [TSMC's 2018 virus update](https://pr.tsmc.com/english/news/1969),
[NXP's Austin restart announcement](https://www.nxp.com/company/about-nxp/newsroom/NW-NXP-RESUMES-OPERATIONS-AUSTIN?lv=true)
and [Toshiba's Kaga update](https://toshiba.semicon-storage.com/us/company/news/2024/01/corporate-20240126-1.html).
Qualitative restarts and imprecise dates remain text, without invented recovery
percentages. The Toshiba page was updated on March 4, so the early-February
observation is not backdated to the page's original January 26 heading.

## Calculation changes

### Financial outcomes and manufacturing route

The financial ledger transcribes actual and forecast columns from Renesas'
[2021 Q1](https://www.renesas.com/en/document/ppt/2021-1q-presentation-material),
[2021 Q2](https://www.renesas.com/en/document/ppt/2021-2q-presentation-material),
[2022 Q1](https://www.renesas.com/en/document/ppt/2022-1q-presentation-material), and
[2022 Q2](https://www.renesas.com/en/document/ppt/2022-2q-presentation-material)
presentations. Source tables were visually reviewed. For the Naka fire, reported
Q2 revenue impact was -12.6 billion yen against an earlier -17 billion forecast.
Gross shipment impact (-18.7 billion), countermeasure recovery (+6.0 billion),
non-GAAP profit and GAAP profit remain separate targets. Published rounding is
preserved even where the gross and recovered figures do not exactly reconcile.

[TSMC's retrospective filing](https://www.sec.gov/Archives/edgar/data/1046179/000119312518328409/d640016d6k.htm)
reports the 2018 virus cost and achieved tool restoration. The cost is not lost
revenue. [NXP's filing](https://www.sec.gov/Archives/edgar/data/1413447/000141344723000006/nxpi-20221231.htm)
reports 2021 storm insurance proceeds; proceeds are not gross operational loss.
`financialEvidence.js` compares identical company, incident, quarter, currency,
metric and accounting basis only. It rejects forecasts unavailable before the
target quarter ended, ambiguous outcomes, and duplicate IDs. Its external
prediction scorer rejects incident leakage and predictions dated after target
completion. A supplied historical prediction date does not prove prospective
capture. Six issuer comparisons are only two incidents, and do not validate an
SSCIM prediction model. Rounding bounds are not statistical confidence intervals.

The [original Intel factory-tour report](https://www.tomshardware.com/news/inside-intel-packaging-factory/3),
read with its [Kulim section](https://www.tomshardware.com/news/inside-intel-packaging-factory/2),
documents the die-sort-to-assembly manufacturing route. This is firsthand
reporting, not an issuer shipment ledger. The route has no invented allocation,
volume, current shipping confirmation or coordinates. Removing it removes the
reachable manufacturing destination; neither case estimates production loss.

### Source-constrained calculations

`observedAnalysis.js` computes company reach from the documented company graph.
Removing the links changes TSMC's documented downstream reach from two companies
to zero. A scoped AMD input-exposure scenario becomes unavailable when the
supporting TSMC relationship is removed. Company links are never expanded into
plant-to-plant shipment edges. Multi-hop company paths are marked as inferences;
product continuity and production propagation are not assumed.

Conditional input exposure uses a documented **buyer input share**, when one
exists. It never substitutes a supplier's revenue share. Unquantified or
incomplete input shares produce bounds, not fabricated point estimates. These
are conditional input-exposure calculations, not forecasts of lost output.

Capacity shares require a declared facility population, matching period and
units, and complete source-supported numeric coverage. Missing, duplicated,
ordinal or incompatible rows return unavailable. The displayed UMC population
shares use reported maximum capacity, separately within each wafer diameter;
they are not global market shares or measures of interchangeable products.

Source publication and information-availability dates gate historical use.
Past recovery observations do not silently become current status. Invalid dates,
forecast records, missing review provenance and non-HTTP citations are rejected.
The live bundle refreshes every minute, including events; previously only quotes
refreshed after page load. Refresh failures retain and label the last dataset.

## Validation results

The separate [monthly revenue prediction test](PREDICTIVE_VALIDATION.md) now
passes its recorded historical benchmark on 24 held-out months: MAE is 36.45%
below the strongest of three simple baselines, and intervals cover 22/24
outcomes. All 156 source values match dated original SEC disclosures. This
establishes a bounded historical nowcasting result, not validation of the
chain-wide disruption model described below.

The old synthetic recovery design has rank 2 for 3 parameters: its market
half-life sensitivity is exactly zero. The corrected controlled experiment
excites both propagation directions and market decay and obtains 60 valid
interval fits in 60 replications. The report retains the original snapshot's
rank deficiency. Changing the experiment does not validate the original inputs
or calibrate a parameter.

The external recovery challenge fits a candidate exponential half-life using
two capacity observations from the 2021 Naka fire, then evaluates three
wafer-input observations from the separate 2022 earthquake. All observations
from the earthquake are held out together; later training evidence is rejected.
Tool-recovery and production-level measurements are excluded from that fit.

The fitted candidate is approximately **44.9 days**. On the held-out observations,
its mean distance from the reported capacity fractions is **0.717**, versus
**0.508** for the 14-day baseline. This fails to justify replacing the baseline.
The sample is tiny, purposive, and spans different hazard and capacity scopes.
The evaluator now rejects mixed recovery metrics by default; reproducing this
earlier diagnostic requires explicit `allowCrossMetricDiagnostic: true`.
The calculation exposes the poor transfer of a universal recovery curve;
**none of the seven global parameters is promoted to calibrated**.

## News processing

Both draft backends now require a supporting quotation present in the supplied
input before proposing operational inclusion. Seed incidents were removed as
severity anchors; severity remains an uncalibrated review ordinal. Quote matching
is traceability, not a semantic accuracy test. External reading without a retained
input passage cannot silently qualify a proposal. Auto-rejection now defaults off,
and automatic operational approval requires a matching passage.

`reference/news-benchmark.json` supplies eighteen source-grounded development
examples across five incidents and two negative controls. `evaluate-news.mjs` scores saved predictions,
keeps missing predictions in denominators, rejects model mismatches and training
incident leakage, and reports detection latency only when real timestamps exist.
These are paraphrases, not a representative sample of raw feed articles. Two
irrelevant examples cannot establish relevance specificity, and labels have
not received independent human adjudication. The initial installed-backend run
classified relevance correctly in 18/18 cases and
operational status in 16/18: one missed recovery and one forecast false alarm.
The original predictions and result are retained as `news-*-initial.json`.
The follow-up prompt explicitly classifies observed versus forecast evidence;
the deterministic boundary rejects forecasts and missing evidence kinds.
Rerunning these development cases after examining their errors is regression
testing, not an independent accuracy estimate. The follow-up run classified
both relevance and operational status correctly in 18/18 cases. See `news-evaluation.json` for
the current run and its source/prompt hashes. Detection latency remains unknown
because historical publication dates do not establish pipeline detection times.
Both runs predate the model-identity logging repair: the old backend retained
only its first reported usage model, which could be a helper. Their reported
model IDs therefore do not establish which model drafted the answers. Future
runs retain the full reported usage set; the completed reports flag this limit.

A subsequent frozen incident holdout contains 12 paraphrased cases across six
incident/control groups, disjoint from prompt-development incidents. The actual
backend run classified relevance correctly in 12/12 cases and operational status
in 11/12: operational precision 5/5, recall 5/6. It missed Sony's report that
three sites had resumed production, interpreting the passage as merely a
negative damage finding. That error is retained; the prompt was not tuned and
the holdout was not rerun after inspection. See
`benchmarks/news-incident-holdout-evaluation.json` and the saved predictions.
The backend reported both `claude-haiku-4-5-20251001` and `claude-opus-5` in usage;
the primary drafter cannot be inferred from this set. One irrelevant control,
AI-assisted labels and purposive paraphrases do not establish representative
feed accuracy or independent human validation. Stored legacy and forecast
drafts cannot bypass the observed-evidence gate for automatic operational approval.

The separate `audit-news-timeliness.mjs` audit uses actual queue creation times
and feed-supplied publication timestamps. On September 7, it found median
publication-to-insertion lags of **6.08 hours across 72 Webz records** and
**25.75 hours across 88 RSS records**. There were 84 pending RSS candidates,
with a median queue age of approximately 26.13 hours at that audit. These are
historical, potentially backfilled records, not a prospective latency guarantee
or evidence that every real disruption was detected. The report does not
substitute event dates or earthquake origin times for publication timestamps.

## Reproduce

From the repository root:

```text
node server/scripts/evaluate-observed-data.mjs
node server/scripts/import-public-outcomes.mjs
node server/scripts/check-observed-sources.mjs
node server/scripts/run-news-benchmark.mjs
node server/scripts/run-news-benchmark.mjs --benchmark docs/reference/news-incident-holdout.json --output-prefix docs/benchmarks/news-incident-holdout
node server/scripts/audit-news-timeliness.mjs
node server/scripts/evaluate-news.mjs --predictions predictions.json --model MODEL_ID
node docs/computation-demo/validation/mle-validation.mjs
```

News predictions use `{id, modelId, relevant, operational, detectedAt?}`.
The import script idempotently transcribes the named public outcome records;
it does not discover new outcomes or manufacture measurements. Preserve the
committed holdout run; use a new output prefix for any later regression run.
Offline evaluation requires an explicit prediction file and model ID and writes
`news-evaluation-offline.json`, preserving the actual backend run by default.
The availability checker detects unavailable or changed sources; HTTP success
never promotes a source to verified. Run `npm run snapshot` in `app` after
editing the ledger to rebuild the static bundle. The live API reads the ledger
through the same bundle builder.
The availability check retrieved 21 of 22 source URLs on September 7, 2026.
The TSMC virus page was readable during source review but returned HTTP 403 to
the standalone availability checker. This remains an explicit retrieval failure
in the report; no successful refresh is claimed for that page.

## Remaining operational release blockers

This work replaces invented precision with a usable, source-supported subset.
It does not establish complete coverage of 275 plants, validated shipment
dependencies, news-model accuracy, or chain-wide predictive accuracy. Public
sources do not disclose many product allocations, inventories, substitution
constraints or plant shipment links. Additional evidence must extend the same
ledger; it must not be synthesized to make a map complete. The original 167-event
research baseline and its evidence counts are a separate dataset and have not
been inflated by counting recovery milestones as new incidents.
