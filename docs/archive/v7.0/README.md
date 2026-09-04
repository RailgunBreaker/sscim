# Archived SSCIM v7.0 documentation

> **WARNING - HISTORICAL DOCUMENT - SSCIM MODEL v7.0**
>
> Everything in this folder describes a **superseded model**. It is kept for
> the record and must not be read as a description of what the code now does.

The current model is **v7.1**, `sscim-model-v7.1-exposure-robustness`. Its
canonical specification is [`docs/MODEL_V7_SPEC.md`](../../MODEL_V7_SPEC.md),
and the release table for every version is
[`docs/MODEL_ARCHIVE.md`](../../MODEL_ARCHIVE.md).

## Identification

| | |
| --- | --- |
| Model identifier | `sscim-model-v7-exposure-robustness` |
| Public version | v7.0 |
| Application version | `0.0.0` — no release version was set until v7.1 |
| Dataset as-of | `2026-09-04` |
| Source commit | `a737f6963dbf75d08e9d2f70f4f57c7eff1eabf5` |
| Frozen benchmark | [`docs/benchmarks/v7-exposure-robustness-frozen-benchmark.json`](../../benchmarks/v7-exposure-robustness-frozen-benchmark.json) |
| Specification | [`MODEL_V7.0_SPEC.md`](MODEL_V7.0_SPEC.md) |
| Validation artefacts | [`validation/`](validation/SYNTHETIC_PARAMETER_RECOVERY.md) |
| Status | **superseded** by v7.1 |

## Contents

| File | What it is |
| --- | --- |
| [`MODEL_V7.0_SPEC.md`](MODEL_V7.0_SPEC.md) | The canonical v7.0 specification, byte-for-byte as it stood at commit `a737f696`, plus a prepended banner and four repointed links. |
| [`validation/`](validation/SYNTHETIC_PARAMETER_RECOVERY.md) | The v7.0 synthetic-recovery page and its three data artefacts, computed against the `2026-08-29` dataset. |

### Exactly what was altered when this folder was created

Nothing in the body of either archived document was rewritten. The complete
list of edits:

1. An archive banner was **prepended** to each markdown file.
2. Relative links were repointed for the deeper folder, and one now names the
   archived v7.0 validation page rather than the regenerated v7.1 one:

   | In `MODEL_V7.0_SPEC.md` | Was | Now |
   | --- | --- | --- |
   | v6 archive | `archive/v6/README.md` | `../v6/README.md` |
   | Verification run | `benchmarks/verification-run.json` | `../../benchmarks/verification-run.json` |
   | Validation page | `computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md` | `validation/SYNTHETIC_PARAMETER_RECOVERY.md` |

   In `validation/SYNTHETIC_PARAMETER_RECOVERY.md`, the three
   `../../MODEL_V7_SPEC.md` links now point at `../MODEL_V7.0_SPEC.md`, so
   that the archived page cites the archived specification.

The specification body is verifiable against the source commit:

```bash
git show a737f6963dbf75d08e9d2f70f4f57c7eff1eabf5:docs/MODEL_V7_SPEC.md | sha256sum
# ddda80826e6a103cef21e205568afeefd2214b9fee52bb68cd91d5cf7cdee087
```

`MODEL_V7.0_SPEC.md` is that content with the banner in front and the three
links above repointed, and nothing else.

### The generated blocks in here are frozen

The archived specification still carries `<!-- BEGIN GENERATED -->` markers,
because it is a copy of the file that was canonical at the time. They are
**not** refreshed. `npm run docs:generate` refuses to enter `docs/archive/`,
and `npm run docs:verify` asserts that it refuses, because regenerating them
would restate a superseded model's parameter tables with current values and
destroy the only readable definition behind the frozen benchmark.

## Why v7.0 was superseded

v7.0 was a sound redesign whose **documentation and reporting made four
claims that measurement did not support**. Three of them were about how
confident a reader should be; one was a defect in a published quantity.

1. **Network influence counted each stage's own weight.** `NI_s` summed
   `w_j · p` over all stages *including the source*, where `p_{s→s} = 1`.
   Every stage therefore scored at least its own size before any propagation
   occurred, and stage size was counted twice — once here and once in the
   `market` component. In the shipped data `m_ai` ranked second on structural
   vulnerability **while having no outgoing edge at all**.
2. **Propagation was described as conserving exposure.** `f_d` and `f_u` were
   presented as globally conserved fractions that "cannot manufacture
   exposure". They are per-stage inheritance multipliers, and the signal
   branches: a unit shock at `gases` sums to about 2.09 across stages.
3. **The v6-v7 benchmark ablation was mislabelled.** The row labelled
   "12-day market half-life" executed 21 and 7 days.
4. **Curation uncertainty was unmeasured**, and archived fallbacks were said
   to be unable to affect any published number materially. That is true of
   the current snapshot and false of the historical series.

The full change log is
[§10b of the current specification](../../MODEL_V7_SPEC.md#10b-v70--v71-change-log-migration-note).

## Which v7.1 changes moved a number, and which did not

Measured by recomputing the current engine over the **same** `2026-09-04`
dataset and comparing against the frozen v7.0 benchmark, so that dataset drift
cannot be mistaken for model change.

### Changed numerical output

| Output | v7.0 | v7.1 | Cause |
| --- | --- | --- | --- |
| Stage structural vulnerability | — | **23 of 24 stages changed** | The `SpilloverReach` correction. |
| Structural top five | `adv_fab`, `litho`, `logic_ai`, `hbm`, `systems` | `adv_fab`, `litho`, `adv_pkg`, `hbm`, `metro` | Same. |
| `m_ai` structural | 3.841678 | **2.441778** | The stage with no outgoing edge loses the self-weight that inflated it. This is the defect above, corrected. |
| `adv_pkg` structural | 4.795959 | **6.285192** | Largest increase; genuine downstream reach was previously diluted by every stage carrying its own weight. |
| Benchmark ablation "12-day half-life" | 5.706 | **5.500** | The ablation now executes the parameters its label claims. This is a benchmark artefact, not a model output. |
| Part B of synthetic recovery | top stage 77.5% `adv_fab` / 22.5% `litho` | **100% `adv_fab`** | Structural reordering, compounded with the dataset moving from `2026-08-29` to `2026-09-04`. |

### Unchanged numerical output

Verified identical, not assumed:

| Output | Result |
| --- | --- |
| Headline chain index | **6.027797 in both** |
| Computed history | **0 of 22 points changed** |
| Company criticality | **0 of 109 companies changed** |
| Every registry parameter value | unchanged; no `base`, `low` or `high` moved |
| Propagation output | unchanged; the v7.1 edit to `propagation.js` is comment-only |

### Changed only interpretation, testing or documentation

| Change | Nature |
| --- | --- |
| Propagation semantics rewritten as per-stage multipliers | Comments and prose. No executable line changed. |
| Curation-uncertainty analysis (`npm run curation`) | New measurement of an envelope that was previously unreported. Adds a number; moves none. |
| Sobol raw values, bootstrap standard errors, convergence, multi-seed replication | Reporting of the same estimator. The displayed clipped indices are unchanged; the raw ones are now published beside them. |
| Legacy-fallback envelope (`npm run legacy`) and the history-chart marking | New disclosure of which dates depend on uncurated records. |
| Registry symbols stored as real LaTeX | Rendering only. |
| `DirectFootprint` and `SYSTEM_WEIGHTED_REACH_INCLUDING_SOURCE` exports | The v7.0 quantity is retained under an accurate name; nothing consumes it structurally. |
| Proprietary release track, version `0.0.0` to `0.7.1` | Packaging and legal posture. |
