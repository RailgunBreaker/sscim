# SSCIM v7 — Computation demonstration

*Model version: `sscim-model-v7-exposure-robustness`. Canonical specification:
[`docs/MODEL_V7_SPEC.md`](../MODEL_V7_SPEC.md).*

Every table referenced here is **exported from the running engine** by
`npm run demo` (`app/scripts/build-computation-demo.mjs`) into
[`csv/`](csv/). Nothing on this page is transcribed by hand, which is why this
page quotes filenames and column names rather than numbers: a number written
into prose is a number that can go stale, and this document is checked in CI.

> The **v6** computation demonstration — with its own worked numbers, produced
> by the superseded engine — is preserved at
> [`docs/archive/v6/COMPUTATION_DEMO-v6.md`](../archive/v6/COMPUTATION_DEMO-v6.md),
> with its CSV exports in [`docs/archive/v6/csv/`](../archive/v6/csv/).
> Do not read either as current.

---

## Where the numbers on this page come from

| Artefact | Produced by | Contains |
| --- | --- | --- |
| [`csv/`](csv/) | `npm run demo` | Every input, intermediate and output table of the live engine |
| [`docs/MODEL_V7_SPEC.md` §7](../MODEL_V7_SPEC.md#7-worked-numerical-example) | `npm run docs:generate` | A **hand-checkable arithmetic walkthrough** on a four-stage frozen fixture |
| [`docs/benchmarks/v7-sensitivity.json`](../benchmarks/v7-sensitivity.json) | `npm run sensitivity` | The global sensitivity design and its results |
| [`docs/benchmarks/v6-to-v7-benchmark.json`](../benchmarks/v6-to-v7-benchmark.json) | `npm run benchmark` | The measured v6 → v7 differences, with ablations |
| [`validation/`](validation/) | `node docs/computation-demo/validation/mle-validation.mjs` | Synthetic parameter recovery and reproducibility checks |

If you want to reproduce the model **by hand**, use the specification's worked
example: it is small enough for a calculator and every intermediate is printed.
If you want to inspect the model **on the real snapshot**, use the CSVs here.

---

## 1. Source — where the code and data live

### 1.1 Computation source

| File | Role |
| --- | --- |
| `app/src/engine/registry.js` | The **schema-checked parameter registry** — every coefficient and every categorical model form, with domain, units, rationale and status |
| `app/src/engine/eventSource.js` | Incident deduplication and the signed source vector |
| `app/src/engine/severity.js` | The three severity-to-intensity mappings |
| `app/src/engine/persistence.js` | The five temporal profiles |
| `app/src/engine/propagation.js` | Edge allocations, dependency matrices, joint propagation |
| `app/src/engine/aggregation.js` | The bounded aggregation operators |
| `app/src/engine/policy.js` | Policy families and the family-level aggregator |
| `app/src/engine/math.js` | HHI bounds, normalized stage weights, topological sort, rank correlation |
| `app/src/engine/facilities.js` | The modeled facility footprint |
| `app/src/engine/index.js` | `buildEngine(data)` — composes everything above |
| `app/src/engine/sensitivity.js` | The global sensitivity design |

### 1.2 Data source

A **frozen, curated demonstration snapshot**, not a live feed. The master tables
live in `server/src/seed-data.js`, are exported by
`app/scripts/build-vault-snapshot.mjs`, and are committed as
`app/src/data/vault-snapshot.json`. The engine never mutates it.

Evidence tiers (A academic / B institutional / C official filings / D analyst
judgement) and coverage counts are in
[EVIDENCE-COVERAGE.md](../reference/EVIDENCE-COVERAGE.md), counted from the vault
rather than asserted.

**Every propagation coefficient is a declared, uncalibrated prior**, chosen for
reproducible and inspectable behaviour, not fitted to any observed disruption
episode.

---

## 2. The parameters — `csv/01_parameter_registry.csv`

Seven continuous parameters, each with `low`, `base`, `high`, a valid domain,
units, the component that consumes it, a rationale, and `status`. Five raw
structural weights are in `csv/01b_structural_weights.csv`; six categorical model
forms are in `csv/01c_model_forms.csv`.

**Every row reads `status: assumption`.** The low/base/high triples are stress
bounds a person chose. They are not confidence intervals and not a distribution
over the truth.

The published table in
[spec §5](../MODEL_V7_SPEC.md#5-parameter-register) is **generated from the same
registry** as this CSV, so the two cannot disagree.

---

## 3. The structure — stages, shares, edges

| Table | File | What to look at |
| --- | --- | --- |
| Stages | `csv/02_stages.csv` | `stage_weight` sums to exactly 1. `network_influence_raw` and `network_influence_snapshot_relative` are **both** published — the second is comparable only within this snapshot. `geo_hhi_lower` and `geo_hhi_upper` bracket the concentration; `geo_score_published` is the conservative upper bound. |
| Country shares | `csv/03_stage_country_shares.csv` | Where these sum to less than 1 for a stage, the residual is unobserved and drives the HHI interval. |
| Edges | `csv/04_dependency_matrices.csv` | `D_ba` and `U_ab` per edge, with the allocations that produced them. **`allocation_source` reads `equal_split_fallback` on every row**: this snapshot supplies no evidence-based dependency shares. |
| Policy families | `csv/05_policy_families.csv` | Register rows after family deduplication. Within a family only the strongest severity counts. |

Check the contraction bound yourself: group `csv/04_dependency_matrices.csv` by
`buyer_b` and sum `D_ba`. Every group total is at or below the registry's
`downstreamTransmission`, which is strictly below 1. The same holds for `U_ab`
grouped by `supplier_a` against `upstreamTransmission`. That bound is what makes
the propagation finite and order-independent with no truncation.

---

## 4. The incidents — `csv/06_incidents.csv`

One row per **deduplicated incident**, not per record. The columns follow the
source-vector formula exactly:

```
severity_intensity_g  ×  exposure (per stage)  ×  persistence_R  ×  direction
                                                                    = source_vector
```

- `record_count` and `records` show which raw records were collapsed into the
  incident and in what role.
- `profile` is the curated temporal profile; `persistence_R` is its multiplier at
  the snapshot date.
- `exposure_source` is `curated` where a person wrote an explicit exposure vector
  and `legacy_equal_split` where the counted $1/k$ fallback applied.
- `scored` and `unscored_reason` say whether the incident produced a field at
  all, and why not when it did not.

`csv/07_curated_event_model.csv` carries the curated exposures themselves, one
row per (incident, stage), **each with the basis a person recorded for it** —
both for the exposure and for the persistence profile.

`csv/12_unscored_records.csv` lists every record that produced no field, with the
reason: not operational, a mixed or unclassified direction with no signed
decomposition, a country-only record with no stage mapping, or a future date.

---

## 5. The outputs

| Table | File |
| --- | --- |
| Headline figures | `csv/10_headline.csv` |
| Country local pressure and chain contribution | `csv/08_country_metrics.csv` |
| Company criticality (raw and snapshot-relative), vulnerability, contribution | `csv/09_company_metrics.csv` |
| Stage operational field and structural vulnerability | `csv/02_stages.csv` |

### The reconciliation worth checking

`csv/10_headline.csv` reports both `operational_index_signed` and
`country_chain_contribution_total`. They are equal wherever every stage's country
shares sum to one, because

$$
\sum_c K_c \;=\; \sum_c \sum_s \sigma_{c,s} w_s F_s \;=\; \sum_s w_s F_s \Bigl(\sum_c \sigma_{c,s}\Bigr) \;=\; I
$$

In this snapshot the two differ slightly, and the difference is exactly the
**undisclosed country residual**: six stages disclose less than 100% of their
country shares (see `csv/11_model_audit.csv`). That gap is a property of the
data, and the model surfaces it rather than normalizing it away.

---

## 6. The audit — `csv/11_model_audit.csv`

Every fallback the model took, counted. This is the machine-readable companion to
[spec §6](../MODEL_V7_SPEC.md#6-fallback-and-missing-data-rules), and the same
counts are reported by `npm run audit:data`.

Read it before reading anything else on this page. It tells you, for this build:

- how many incidents fell back to the equal $1/k$ stage exposure;
- how many archived records fell back to the legacy temporal profile;
- how many raw records were collapsed into an existing incident;
- how many stages have no evidence-based edge allocation (all of them);
- how many stages disclose less than their full country shares;
- how many register rows were collapsed into an existing policy family.

**A fallback is never invisible here.** If a number in this model rests on an
equal split rather than on evidence, this file says so and says how often.

---

## 7. Uncertainty

Not on this page. The principal analysis is the fixed-seed global design in
[`docs/benchmarks/v7-sensitivity.json`](../benchmarks/v7-sensitivity.json), which
covers all twelve continuous dimensions and, separately, the categorical model
forms, and reports first- and total-order influence, one-at-a-time diagnostics,
rank stability, top-five membership frequency and scenario sign stability.

The span it reports is an **assumption envelope**. Uniform sampling over an
assumption box is a computational design, not a probability distribution over
what is true, so it is not a confidence interval — see
[spec §8.4](../MODEL_V7_SPEC.md#84-why-the-envelope-is-not-a-confidence-interval).

---

## 8. Regenerating everything

```bash
cd app
npm run snapshot      # export the vault to app/src/data/vault-snapshot.json
npm run audit:data    # read-only diagnostics; fails on malformed data
npm run demo          # the CSVs referenced above
npm run sensitivity   # docs/benchmarks/v7-sensitivity.json
npm run benchmark     # docs/benchmarks/v6-to-v7-benchmark.json
npm run docs:generate # regenerate every generated documentation block
npm run docs:verify   # fail on any code–documentation drift
npm test              # the full unit suite
```
