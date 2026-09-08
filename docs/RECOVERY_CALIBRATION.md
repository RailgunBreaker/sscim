# Recovery duration calibration with reported factory outcomes

Evaluated September 9, 2026. A scoped recovery-duration model is now fitted
to **six factory recoveries across five Renesas incidents**. The all-data
fitted median is **10.47 days** from partial restart to full wafer-input
capacity. This is an exploratory empirical coefficient, not a validated
replacement for the global `outageRecoveryDays = 60` assumption.

## Observations and boundaries

| Factory / incident | Disclosed partial restart | Full wafer-input capacity | Calendar days |
| --- | --- | --- | --- |
| Kawashiri, 2016 Kumamoto earthquake | 2016-04-22 | 2016-05-22 | 30 |
| Naka, February 2021 earthquake | 2021-02-15 | 2021-02-21 | 6 |
| Naka, March 2022 earthquake | 2022-03-17 | 2022-03-26 | 9 |
| Takasaki, March 2022 earthquake | 2022-03-17 | 2022-03-23 | 6 |
| Kawashiri, July 2022 voltage drop | 2022-07-06 | 2022-07-11 | 5 |
| Kawashiri, July 2026 earthquake | 2026-08-04 | 2026-08-23 | 19 |

Each record in [the structured dataset](reference/recovery-durations.json)
contains the restart and completion sources, publication and information
availability dates, the actual restart definition, review provenance, and
any earlier issuer target. The 2016 restart was disclosed retrospectively
on May 10; it is not treated as information captured on April 22.

Renesas confirms the [2016 completion](https://www.renesas.com/en/about/newsroom/update-8-final-impact-2016-kumamoto-earthquake-renesas-electronics-operations),
[February 2021 completion](https://www.renesas.com/en/about/newsroom/final-update-impact-february-13-earthquake-coast-fukushima-prefecture-renesas-electronics-operation),
[March 2022 Naka completion](https://www.renesas.com/en/about/newsroom/update-4-final-impact-march-16-earthquake-coast-fukushima-prefecture-renesas-operation-1),
[March 2022 Takasaki completion](https://www.renesas.com/en/about/newsroom/update-3-impact-march-16-earthquake-coast-fukushima-prefecture-renesas-operation),
and [July 2022 completion](https://www.renesas.com/en/about/newsroom/update-2-final-impact-instantaneous-voltage-drop-operation-kawashiri-factory).
The latest pair uses the [August 4, 2026 restart disclosure](https://www.renesas.com/en/about/newsroom/impact-26-earthquake-kumamoto-4)
and [August 24 completion disclosure](https://www.renesas.com/en/about/newsroom/update-5-final-impact-2026-kumamoto-earthquake-renesas-operations).

These are issuer-reported milestones, reviewed by the coding agent. They
are not independently measured factory telemetry. Wafer supply restart,
partial test-line resumption and phased production restart are recorded
separately. The evaluator reports sensitivity to omitting each restart
definition. It excludes tools, shipment recovery, generic production input,
and production-level endpoints that do not explicitly establish wafer-input
capacity. It does not infer percentages from a qualitative restart.

## Estimation and uncertainty

For duration `d` in incident `i` with `n_i` reported factories, each factory
gets likelihood weight `1 / n_i`. Each incident therefore contributes the
same total weight. The weighted lognormal maximum-likelihood estimates are:

```text
mu = mean_across_incidents(mean_across_factories(log(d)))
sigma² = mean_across_incidents(mean_across_factories((log(d) - mu)²))
fitted median duration = exp(mu)
```

The all-data result is `mu = 2.3483`, `sigma = 0.7051`, and median `10.47`
days. The lognormal distribution is a candidate model form, not an
empirically established population law. A median is used for absolute-error
scoring; the report also retains the fitted mean.

The exact incident-cluster bootstrap enumerates all `5^5 = 3,125` ordered
resamples and gives a nominal 95% percentile interval of **5.81–19.85 days
for the fitted population median**. This is not a prediction interval for
an individual incident. Five selected clusters cannot establish nominal
coverage or account for undisclosed incidents and publication bias.
Calendar-day endpoint uncertainty is separately assessed by shifting each
elapsed duration by up to one day; no time-of-day precision is invented.

## Chronological test and useful baselines

The protocol uses incidents before 2026 for fitting and the 2026 incident
for testing. Training labels must have been published before the test
incident, and restart information must precede actual completion. Both
factories affected by the March 2022 earthquake remain in the same group.

| Predictor for the 19-day 2026 outcome | Predicted days | Absolute error, days |
| --- | --- | --- |
| Earlier-data fitted median | 9.02 | 9.98 |
| Current global assumption | 60 | 41 |
| Earlier incident-weighted empirical median | 6 | 13 |
| Latest earlier incident | 5 | 14 |
| Issuer's approximate three-week target | 21 | 2 |

The fitted candidate beats the generic defaults in this one test. The
issuer's contemporaneous target is substantially closer. That target is an
informed approximate schedule, not a calibrated probabilistic forecast.

The evaluator also reports three expanding-history tests, each requiring
at least two earlier incidents. They are diagnostics, not three additional
independent final holdouts. The protocol was written after historical
sources were inspected, so none of these results is claimed as a pristine
untouched holdout or prospective operational performance.

Across the three expanding-history tests, weighting incidents equally, mean
absolute error is **7.29 days for the fitted model**, **5.17 for the earlier
empirical median**, **6.00 for the latest earlier incident**, and **49.50 for
the global default**. The candidate loses to the empirical median in two
of three tests. Its one later win is insufficient to claim an advantage
over simple data-based predictors.

## Implementation and deployment

Run `npm --prefix server run calibrate:recovery`. The evaluator writes
[the full report](benchmarks/recovery-calibration.json), including input
and engine hashes, exclusions, split membership, each prediction, baseline
errors, issuer comparisons, bootstrap uncertainty and sensitivity results.
The hourly evidence workflow reruns this evaluator, and the structured
JSON/SQLite exporter includes the dataset, protocol and report. The observed
workspace displays the comparison.

The previous capacity-fraction exponential challenge remains a separate
cross-metric diagnostic. This duration fit does not rescue that failed
comparison. A completion date by itself does not identify an exponential
half-life; an exponential curve never exactly reaches full restoration.

**No global parameter is promoted.** The global outage model also assumes
a linear path from zero restored capacity after a chosen recovery start;
partial restarts are not necessarily zero, and these endpoint data cannot
validate that path or its integrated lost output. The sample does not
identify transmission, inventory, supplier allocation or chain-wide loss.
Further promotion requires representative independent incidents, comparable
within-recovery measurements, and forecasts scored after capture.

The report now includes a machine-readable replacement assessment. It
records improvement over the registry on all three temporal tests, failure
to beat the empirical median overall, and the absence of trajectory and
prospective validation. It therefore does not authorize a global replacement.
[Physical production losses](CHAIN_LOSS_ACCOUNTING.md#physical-production-losses-beyond-recovery-dates) applies verified
restoration to its stated capacity measure while retaining unquantified
catch-up and downstream balances.
