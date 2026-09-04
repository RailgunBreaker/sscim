# Archived SSCIM v6 documentation

> **⚠ HISTORICAL DOCUMENT — SSCIM MODEL v6**
>
> Everything in this folder describes a **superseded model**. It is kept for
> the record and must not be read as a description of what the code now does.

The current model is **v7.1**, `sscim-model-v7.1-exposure-robustness`. Its canonical
specification is [`docs/MODEL_V7_SPEC.md`](../../MODEL_V7_SPEC.md).

## Identification

| | |
| --- | --- |
| Model identifier | `sscim-model-v6-client-sensitivity` |
| Public version | v6 |
| Application version | `0.0.0` |
| Frozen benchmark | [`docs/benchmarks/v6-frozen-benchmark.json`](../../benchmarks/v6-frozen-benchmark.json), dataset `2026-08-29` |
| Worked demonstration | [`COMPUTATION_DEMO-v6.md`](COMPUTATION_DEMO-v6.md), dataset `2026-07-29` |
| Source commit | `7749dc869d76a70fa1a4c09928c96f4a2c2e14cc` |
| Status | **superseded** |

The demonstration and the frozen benchmark run on **different snapshots**.
They are the same model family over different data, and the frozen benchmark
is the one authoritative for the v6-to-v7 comparison. The dates are explained
in the provenance note at the top of
[`COMPUTATION_DEMO-v6.md`](COMPUTATION_DEMO-v6.md).

Every release is listed in [`docs/MODEL_ARCHIVE.md`](../../MODEL_ARCHIVE.md).

## Why this folder exists

`docs/benchmarks/v6-frozen-benchmark.json` holds the complete v6 output surface,
captured from the v6 engine **before** the v7 redesign and never regenerated —
the code that produced it no longer exists. A frozen set of numbers with no
readable definition behind it is not a record of anything, so the v6 formulas
that produced them are preserved here.

## Contents

| File | What it is |
| --- | --- |
| [`CALCULATION-v6.md`](CALCULATION-v6.md) | The complete v6 calculation specification, as it stood at commit `7749dc8`. |

## What changed, in one table

The full change log with expected directional effects is
[§10 of the v7 specification](../../MODEL_V7_SPEC.md#10-v6--v7-change-log), and
the measured differences are in
[`docs/benchmarks/v6-to-v7-benchmark.json`](../../benchmarks/v6-to-v7-benchmark.json).

| v6 | v7 |
| --- | --- |
| One 12-day half-life for every event class | Per-incident temporal profiles |
| Full severity injected independently at every tagged stage | One source vector with an explicit per-stage exposure |
| Per-stage propagation combined with a noisy-OR | One joint propagation of the whole incident vector |
| A 5% hazard scoring threshold | Continuous exposure from the modeled facility footprint |
| Country `directSignals` on top of the stage field | Removed — an incident enters a country once |
| Record-count-driven policy saturation | Policy families with a bounded family-level aggregator |
| A single HHI with the residual folded in silently | An explicit `[lower, upper]` interval |
| Three jointly moving sensitivity presets | A fixed-seed global sensitivity design |

## Versioning discipline

v6 results are preserved **with their original model version**. v7 numbers are
never spliced into v6 history. Any recomputed history is labelled
"v7 retrospective" and never implies it was published contemporaneously.
