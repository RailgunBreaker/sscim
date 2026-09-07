# Predictive validation: measured scope and results

Evaluated September 7, 2026. **The TSMC monthly consolidated-revenue nowcast
passes the recorded historical benchmark.** This is a separate prediction
target from plant recovery or chain-wide disruption loss. The seven global
v7 parameters remain assumptions; no revenue coefficient is substituted for
physical transmission, inventory or recovery parameters.

## Data and historical availability

The dataset contains 156 monthly observations, January 2013 through December
2025, in nominal millions of New Taiwan dollars. Values come from TSMC's
[annual monthly tables](https://investor.tsmc.com/english/monthly-revenue/2025),
which use consolidated TIFRS figures from 2013 onward and describe the monthly
figures as unaudited. Each annual table is retained as a short factual excerpt,
with its URL and a sum check allowing the source's rounding differences.

All **156/156 values match dated original SEC 6-K disclosures**. The audit
stores filing date, document URL, downloaded SHA-256, unit and amount for each
month. It does not substitute today's annual table for an unverified vintage.
For example, [January 2024 revenue was disclosed on February 7](https://www.sec.gov/Archives/edgar/data/1046179/000104617924000014/tsm-revenue20240207x6k.htm).
The January nowcast is reconstructed at January 11, after the preceding-month
filing, and before that February outcome disclosure.

The audit uses automated title, unit and table extraction from original filings;
it is not independent human adjudication. SEC filing dates are conservative
availability dates, not claims about the earliest press-release timestamp.
Each reconstructed nowcast is dated one day after its latest required filing.
The evaluator rejects an input disclosed too late for the target month, and
rejects an outcome disclosed on or before the reconstructed issuance date.

The initial protocol flagged unverified historical vintages. That concern was
subsequently addressed by the separate SEC audit without changing the model,
test periods, baseline definitions, or numerical test results. The original
protocol is retained; the report records the resolution separately.

## Prediction and separation of data

This is a **current-month nowcast after the preceding-month disclosure**. It
does not forecast the target month before that month begins. For target month
`t`, the model uses the same month's revenue a year earlier, multiplied by the
geometric average of recent year-over-year revenue growth ratios:

```text
prediction[t] = revenue[t-12] * exp(mean(log(revenue[t-j] / revenue[t-j-12])))
j = 1, ..., k
```

Only previous months can enter the predictor. Windows `k = 1, 3, 6, 12` were
compared using mean absolute error in January 2019–December 2021. The selected
window is **3 months**. Earlier data supplies lagged predictors; there is no
claim that every earlier observation independently trains a coefficient.

January 2022–December 2023 calibrates a fixed interval using the 20th ordered
absolute log error among 24 calibration predictions, the finite-sample rank
for nominal 80% coverage. The resulting log-error radius is approximately
0.18326. Intervals are `prediction * exp(±radius)`.

January 2024–December 2025 is the final 24-month test period. Neither its errors
nor the calibration errors choose the model window. Earlier test outcomes may
become inputs to subsequent test predictions after publication, as in an actual
rolling nowcast; they do not refit the selection rule or interval radius.

This is a retrospective protocol recorded before candidate scoring, not an
independently preregistered study. Public outcome tables were accessible, and
the 2013 and 2024 source tables were inspected before protocol recording.
No method or test-period selection followed inspection of test performance.

## Held-out results

| Method | Mean absolute error, TWD billion | Absolute error / total revenue |
| --- | ---: | ---: |
| Selected seasonal-growth nowcast | **18.13** | **6.49%** |
| Previous month | 28.53 | 10.21% |
| Same month last year | 68.64 | 24.57% |
| Trailing 12-month average | 39.76 | 14.24% |

The candidate has **36.45% lower MAE than the strongest of these three
baselines**. It also beats each baseline separately in 2024 and 2025.
Its nominal 80% intervals cover **22/24 outcomes (91.67%)**, with mean interval
width equal to 36.32% of actual revenue. March and April 2024 fall outside
their intervals; these misses remain in the report and interface.

A paired circular moving-block bootstrap uses three-month blocks, 5,000
resamples and seed 20260907. The 90% interval for candidate-minus-previous-month
MAE is **-17.71 to -3.00 billion TWD**. Intervals against the other two baselines
also remain below zero. This is conditional, approximate time-series inference
on a short sample, not a guarantee of future improvement or proof that the
24 months are independent incidents.

All recorded gates pass: complete 24-month test; at least 5% MAE improvement
over every baseline; negative upper bootstrap differences; interval coverage
at least 75%; mean relative interval width no greater than 60%. These are
project benchmark criteria, not an external operational certification.

Time-series evaluation and simple benchmarks follow the principles explained
in [Forecasting: Principles and Practice](https://otexts.com/fpp3/tscv.html).
Time dependence and distribution shift limit ordinary conformal coverage;
see [Conformal prediction beyond exchangeability](https://arxiv.org/abs/2202.13415).
The observed coverage here is reported empirically without an exchangeability
or future-coverage guarantee.

## What this establishes

The repository now has a reproducible historical prediction test that beats
its declared baselines on a consistently defined, independently reported
outcome, with original source vintages, chronological separation and measured
interval coverage. The default workspace exposes every test prediction and
outcome source. The API and bundled snapshot carry the same evaluation.

It does **not** establish prospective operational performance, disruption
causality, plant-level output recovery, supplier loss transmission, or accuracy
for other companies. Nominal revenue combines volume, pricing, currency and
product mix. A revenue prediction error cannot be labeled disruption damage.
Prospective qualification requires predictions recorded before future outcome
disclosures and continuing evaluation under the same target and horizon.

The old fire-to-earthquake recovery calculation is retained only as an explicit
cross-metric diagnostic. Its default API now returns
`incompatible_recovery_targets` when production capacity and wafer-input
capacity are mixed. Its poor baseline comparison remains visible and does not
authorize a recovery coefficient.

## Reproduce and inspect

```text
node server/scripts/audit-revenue-vintages.mjs
node server/scripts/evaluate-revenue-prediction.mjs
cd app
npm run snapshot
npm run verify
npm run build
```

The source audit respects a delay between requests and saves unavailable or
unmatched records. `--resume` retains only previously matched records whose
annual-table amount remains unchanged; omit it to retrieve every document
again. The evaluation itself is offline and refuses missing or mismatched
original disclosures.

- Data: `reference/tsmc-monthly-revenue.json`
- Recorded protocol: `reference/revenue-prediction-protocol.json`
- Original-disclosure audit: `benchmarks/revenue-vintage-audit.json`
- Complete results, hashes and 24 predictions: `benchmarks/revenue-prediction.json`
- Pure engine and leakage checks: `app/src/engine/revenuePrediction.js`

Tests verify that changing test outcomes cannot select the model or widen its
calibrated intervals, and reject missing months, duplicate records, wrong
currencies, changed targets, missing baselines, late disclosures and overlapping
evaluation periods.
