# Predictive validation: measured scope and results

Evaluated September 7, 2026. **The TSMC monthly consolidated-revenue nowcast
passes the recorded historical benchmark.** This is a separate prediction
target from plant recovery or chain-wide disruption loss. The seven global
v7 parameters remain assumptions; no revenue coefficient is substituted for
physical transmission, inventory or recovery parameters.

September 9 update: [recovery-duration calibration](RECOVERY_CALIBRATION.md)
now fits six factory outcomes across five incidents. The 2026 temporal test
has 9.98 days of error versus 41 for the global default and 2 for the issuer
target. This retrospective, single-issuer result does not promote a global
parameter or establish prospective performance.

The exact lag-two rule has also been evaluated on the reused 24-month
historical sample: MAE TWD 20.93 billion, 22/24 interval coverage, and lower
error than all four available-information baselines. That evaluation is
[below](#the-captured-two-month-lag-rule-on-historical-data). The stored
September 2026 prospective forecast still awaits its outcome.

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

## The captured two-month-lag rule on historical data

Evaluated September 9, 2026. The exact point rule and interval calibration
used by the captured September 2026 forecast have now been replayed over
January 2024 through December 2025. No coefficient, interval radius or stored
forecast was changed to obtain these results.

| Predictor | Mean absolute error, TWD billion |
| --- | ---: |
| Captured lag-two rule | 20.93 |
| Latest month publicly available at origin | 33.06 |
| Fixed two-month-lag value | 31.82 |
| Same month last year | 68.64 |
| Mean of latest 12 available months | 44.65 |

Across 24 months, weighted absolute percentage error is **7.49%**. The fixed
nominal 80% intervals cover **22/24 outcomes (91.7%)**. Historical error is
34.2% below the best of these four baselines. This is a retrospective horizon
diagnostic; there is no new independent significance test or prospective
qualification claim.

### Information available at prediction time

The point rule is the same target month a year earlier multiplied by the
geometric mean of the latest three available year-over-year growth ratios,
with the input history ending two months before the target. Baselines receive
all observations public at the reconstructed origin; the fixed lag-two value
is also retained as a separate comparator. No unavailable preceding-month
figure is imputed.

The fixed interval is calibrated on January 2022 through December 2023. The
test cannot start before those calibration outcomes were disclosed. Each
reconstructed origin is the later of the target month's first day and one
day after the latest required input or interval-calibration disclosure. In
particular, January 2024 waits for December 2023's disclosure. Every origin
must remain within the target month and precede its outcome disclosure.

That January wait gives the latest-available and trailing-mean baselines
December revenue, even though the captured candidate rule still uses November
as its last predictor. The fixed two-month-lag comparator retains November.
This avoids withholding information from a baseline to favor the candidate.

The dataset uses the previously audited 156 original SEC revenue vintages.
That verifies historical information availability, not actual historical
forecast issuance. These test outcomes had already been inspected for other
models. The reused historical sample is not described as an untouched
holdout. Revenue is also a different target from physical disruption losses.

### Prospective scoring and publication schedule

The September 2026 forecast remains its original captured record, with its
original input, protocol and engine snapshots. A regression test verifies
that this replay uses the same interval radius. Pending outcomes contribute
no error or coverage score.

TSMC's calendar, checked September 9, schedules August revenue for September
10 and September revenue for October 8, both at 13:30 Taipei time.
[Issuer financial calendar](https://investor.tsmc.com/english/financial-calendar).
The structured schedule also includes the remaining 2026 monthly releases.
The monitor distinguishes waiting for a scheduled release from waiting for a
verified outcome after that scheduled time. A calendar entry never creates
an actual revenue amount or a successful score. The SEC filing may arrive
later than the scheduled press release; the current collector and scorer
conservatively wait until the next UTC day for a date-only filing.

Run `npm --prefix server run evaluate:lag-two` to reproduce
[lag-two-validation.json](benchmarks/lag-two-validation.json). Input and engine
hashes, origin dates, source links, every prediction, baseline and interval
are retained. The hourly workflow now runs this evaluation alongside actual
prospective scoring, and exports both as separate structured datasets.

## What this establishes

September 8 update: [Structured evidence and prospective operations](STRUCTURED_EVIDENCE.md)
records the first actual September forecast, with archived inputs and a separate
experimental two-month input horizon. It has one pending outcome and zero scored
outcomes. Downstream issuer-reported shortage losses and the first news-monitoring
cycle are also available, and the disclosed losses are accounted for in
[chain loss accounting](CHAIN_LOSS_ACCOUNTING.md); none of it closes chain-wide
causal validation.

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
