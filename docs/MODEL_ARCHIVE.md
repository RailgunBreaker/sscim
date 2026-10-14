# SSCIM model archive

One row per model release. This file is the index: if a number is quoted
anywhere in this repository, this table says which model produced it, from
which dataset, and where the readable definition behind it lives.

Only the row marked **current** describes what the code does now.

## Releases

| | v6 | v7.0 | v7.1 |
| --- | --- | --- | --- |
| **Public version** | v6 | v7.0 | **v7.1** |
| **Model identifier** | `sscim-model-v6-client-sensitivity` | `sscim-model-v7-exposure-robustness` | `sscim-model-v7.1-exposure-robustness` |
| **Application version** | `0.0.0` | `0.0.0` | `0.7.1` |
| **Dataset as-of** | `2026-08-29` | `2026-09-04` | `2026-09-04` |
| **Source commit** | `7749dc869d76a70fa1a4c09928c96f4a2c2e14cc` | `a737f6963dbf75d08e9d2f70f4f57c7eff1eabf5` | see [Why v7.1 has no commit here](#why-v71-has-no-commit-in-that-row) |
| **Specification** | [`archive/v6/CALCULATION-v6.md`](archive/v6/CALCULATION-v6.md) | [`archive/v7.0/MODEL_V7.0_SPEC.md`](archive/v7.0/MODEL_V7.0_SPEC.md) | [`MODEL_V7_SPEC.md`](MODEL_V7_SPEC.md) |
| **Archive index** | [`archive/v6/README.md`](archive/v6/README.md) | [`archive/v7.0/README.md`](archive/v7.0/README.md) | — |
| **Frozen benchmark** | [`benchmarks/v6-frozen-benchmark.json`](benchmarks/v6-frozen-benchmark.json) | [`benchmarks/v7-exposure-robustness-frozen-benchmark.json`](benchmarks/v7-exposure-robustness-frozen-benchmark.json) | none — a benchmark is frozen when the model is *replaced* |
| **Validation artefact** | none | [`archive/v7.0/validation/`](archive/v7.0/validation/SYNTHETIC_PARAMETER_RECOVERY.md) | [`computation-demo/validation/`](computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md) |
| **Worked demonstration** | [`archive/v6/COMPUTATION_DEMO-v6.md`](archive/v6/COMPUTATION_DEMO-v6.md) (dataset `2026-07-29`) | §7 of its specification | [`computation-demo/COMPUTATION_DEMO.md`](computation-demo/COMPUTATION_DEMO.md) |
| **Status** | superseded | superseded | **current** |
| **Headline chain index** | 5.395609 (dataset `2026-08-29`) | 6.027797 (dataset `2026-09-04`) | 6.027797 (dataset `2026-09-04`) |

## Numerical compatibility

| Pair | Comparable? | Why |
| --- | --- | --- |
| v6 → v7.0 | **No.** Breaking. | Different formulas throughout: per-incident persistence profiles replace one global half-life, an explicit stage-exposure vector replaces full severity at every tagged stage, joint propagation replaces per-stage noisy-OR, and the HHI becomes an interval. The measured differences are in [`benchmarks/v6-to-v7-benchmark.json`](benchmarks/v6-to-v7-benchmark.json). |
| v7.0 → v7.1 | **Partly.** | Verified over the same `2026-09-04` dataset: the headline index, the 22-point computed history and all 109 company-criticality scores are **identical**; stage structural vulnerability changed for **23 of 24 stages** and the structural top-five reordered. Quote a v7.0 structural number only as v7.0. Full breakdown in [`archive/v7.0/README.md`](archive/v7.0/README.md). |
| v6 demo → v6 benchmark | **Same model, different snapshots.** | The demonstration runs on `2026-07-29`, the frozen benchmark on `2026-08-29`. Their numbers should not be expected to match. The **frozen benchmark is authoritative** for the v6→v7 comparison; the demonstration is authoritative for how the v6 formulas worked, and for nothing numerical beyond its own snapshot. See the provenance note in [`archive/v6/COMPUTATION_DEMO-v6.md`](archive/v6/COMPUTATION_DEMO-v6.md). |

## Four different identifiers, deliberately kept apart

Confusing these is what produced the defects this archive exists to prevent —
a validation page labelled v7.1 sitting on top of v7.0 numbers, and archive
banners pointing at a model two releases out of date.

| Identifier | What it pins down | Example |
| --- | --- | --- |
| **Model identifier** | Which formulas ran. Set in `app/src/engine/registry.js` and stamped into every generated artefact. | `sscim-model-v7.1-exposure-robustness` |
| **Dataset snapshot** | Which facts went in. Independent of the model — the same model over two snapshots gives two answers, and neither is wrong. | `2026-09-04` |
| **Source-code commit** | Which revision of the repository. Pins the code, not the artefact: an artefact is written *after* the commit that contains the code that wrote it. | `a737f696` |
| **Artefact-generation commit** | The commit that carries the written artefact. Always **later** than the source commit it records, and never knowable from inside the artefact itself. | the commit that added `archive/v7.0/` |

### Why v7.1 has no commit in that row

A commit hash cannot be placed inside a file that the same commit creates: the
hash covers the file's contents, so writing it in would change it. Recording
the **parent** commit instead is truthful but names the code that came before
the artefact rather than the model that produced it.

For the two superseded releases the problem does not arise — their frozen
benchmarks were written *before* the commits that archived them, so
`7749dc86` and `a737f696` are genuine pre-artefact source commits, and they
are labelled as such above.

For the current release, the model is identified by a **digest of its own
output surface** instead:

<!-- BEGIN GENERATED: model-digest -->
| | |
| --- | --- |
| Model | `sscim-model-v7.1-exposure-robustness` |
| Dataset | `2026-09-04` |
| Output digest | `sha256:9b0feb59d61245e85c6f75d9e06b27ae4add86bbfc96eae2b6441d8ff1643c85` |
<!-- END GENERATED: model-digest -->

Recompute it with `npm run digest`. It covers the declared parameter values,
the structural weights, the record counts, the headline index and envelope,
every stage's structural vulnerability and network terms, every company
criticality score, every country structural score and the whole computed
history — canonically ordered and fixed to a stated precision, with wall-clock
time and git state excluded.

Two properties make it the right identifier here:

- It is **not self-referential.** It is derived from what the engine computes,
  so it can be written into a file that the same commit creates, and
  recomputed at any later commit to check the claim.
- It is **insensitive to everything that is not the model.** Two commits that
  differ only in documentation, styling or user-interface code produce the
  same digest. A changed parameter, weight, edge or event produces a different
  one. `npm test` asserts the recorded value, so a model change cannot reach
  `main` without this table being updated deliberately.

## Recommended Git tags — not created

Frozen benchmarks reference their source commits by hash, which is durable but
opaque. Annotated tags would make the two archived releases findable. **These
have deliberately not been created**, because tags are published refs and
changing them is an external action:

```bash
git tag -a v6-final     7749dc869d76a70fa1a4c09928c96f4a2c2e14cc \
  -m "Final sscim-model-v6-client-sensitivity source. Frozen benchmark: docs/benchmarks/v6-frozen-benchmark.json (dataset 2026-08-29)."
git tag -a v7.0-final   a737f6963dbf75d08e9d2f70f4f57c7eff1eabf5 \
  -m "Final sscim-model-v7-exposure-robustness source. Frozen benchmark: docs/benchmarks/v7-exposure-robustness-frozen-benchmark.json (dataset 2026-09-04)."
git push origin v6-final v7.0-final
```

## Rules this archive enforces

`npm run docs:verify` fails the build on each of these. They are not
conventions; they are checks.

1. Every markdown file under `docs/archive/` carries a historical banner.
2. Every archive banner naming the current model names the **actual** current
   model — the check that the three v6 banners failed while they still said
   `sscim-model-v7-exposure-robustness`.
3. No archived model is described as current outside a historical context.
4. Every frozen benchmark has a specification, archived or canonical, that
   defines the numbers in it.
5. The current validation prose and its machine-readable output agree on model
   version and dataset date — the check that failed while
   `SYNTHETIC_PARAMETER_RECOVERY.md` said v7.1 and the JSON beside it said
   v7.0 and `2026-08-29`.
6. Superseded validation artefacts live under their own archive folder.
7. Frozen artefacts are never regenerated: the documentation generator refuses
   to enter `docs/archive/`.
8. Archive provenance dates are chronological, or carry an explicit written
   exception — as the v6 demonstration's `2026-07-12` generation date does.
9. Every path named in this file exists.
10. v6-only formulas remain permitted inside clearly marked v6 payloads, and
    nowhere else.
