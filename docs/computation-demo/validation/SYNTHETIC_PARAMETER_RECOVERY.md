# Synthetic parameter recovery

*Model version: `sscim-model-v7.1-exposure-robustness`. Canonical specification:
[`docs/MODEL_V7_SPEC.md`](../../MODEL_V7_SPEC.md) — see
[§9, validation status](../../MODEL_V7_SPEC.md#9-validation-status).*

Produced by `node docs/computation-demo/validation/mle-validation.mjs`.
Artefacts: `validation-results.json`, `mle_replications.csv`,
`mc_robustness_draws.csv`, all in this folder.

> **This page was previously called "MLE validation". The name was wrong.**
> Nothing here validates the model against the world, and the old title
> invited a reader to believe otherwise.

---

## What this establishes, and what it does not

| | |
| --- | --- |
| ✅ **Recoverability under a synthetic, correctly specified data-generating process** | The "observations" are generated **by the model itself** at known parameters, plus Gaussian noise. Recovering those parameters shows they are identifiable *from data the model generated*, and that the estimator does not systematically miss. |
| ✅ **Numerical optimization** | The Nelder–Mead search and the Wald variance machinery a future calibration would use are implemented correctly. |
| ✅ **Pipeline regression** | The engine at base parameters still produces the recorded values, and two builds over one snapshot are bit-identical. A change in the computation fails this run. |
| ❌ **Real-world identifiability** | The data-generating process *is* the model. Under misspecification — which is the real case, since the world is not this model — identifiability does not follow. |
| ❌ **External validity** | No real disruption outcome appears anywhere in this test. Nothing here is evidence that the model describes the semiconductor supply chain. |
| ❌ **Calibrated uncertainty** | The intervals below are computed under the synthetic process with noise of known form. Their coverage is a statement about that simulation. They are **not** real-world confidence intervals for any parameter, and every parameter remains `status: assumption`. |
| ❌ **An independent implementation** | The script **imports the engine's own primitives**. It cannot detect an error that is *in* those primitives. Part C is a regression check, not a cross-implementation check. |

The v6 version of this document described Part C as a "cross-implementation
regression check". It was not: both sides imported the same primitives, so the
two could only ever disagree by transcription error. v7 calls the engine
directly, which is the honest version of the same check.

---

## Part A — synthetic parameter recovery

### The design

Three parameters are estimated: `downstreamTransmission`,
`upstreamTransmission`, `marketHalfLifeDays`. Their true values are the registry
base values.

At each offset $t$ in $\{0, 7, 14, 21, 28, 35\}$ days before the snapshot date,
every stage's operational field is "observed" with Gaussian noise:

$$
y_{t,n} = F_n\bigl(\text{records aged } +t;\ \theta^{*}\bigr) + \varepsilon,
\qquad \varepsilon \sim N(0, \sigma^{2})
$$

24 stages × 6 offsets = **144 observations per replication**, $\sigma = 0.02$.

Gaussian noise means the maximum-likelihood estimate of $\theta$ minimizes the
residual sum of squares; $\sigma$ is profiled out. Optimization starts
deliberately far from the truth.

### The interval, and what it means

The Wald interval is built from the Jacobian,
$\mathrm{Var}(\hat\theta) = \hat\sigma^{2}(J^{\top}J)^{-1}$.

The asymptotic normal approximation holds **here** because three conditions are
true of this simulation: the noise really is Gaussian, the model really is
correctly specified, and the truth really is interior. None of the three is known
to be true of anything outside the simulation.

So the coverage this test reports is **synthetic coverage** — the fraction of
replications in which the simulated interval contained the value the simulation
started from. Calling it a 95% confidence level for a real parameter would be
false, and no parameter is promoted to `status: calibrated` on the strength of
it.

### Reading the output

`validation-results.json` → `partA.summary` gives, per parameter: the truth, the
mean estimate, the bias, the empirical standard deviation of the estimates, the
mean standard error, and the synthetic coverage. A well-behaved run has bias near
zero and the mean standard error close to the empirical standard deviation.

---

## Part B — output stability across the assumption box

Parameters are redrawn uniformly across their declared **assumption box** and the
whole pipeline is recomputed, to answer the narrow question the optimizer depends
on: does the **output ordering** survive?

Reported: the chain index across the box, Spearman rank correlation of company
criticality and structural vulnerability against the base ordering, the modal
top-five company set and how often it holds, and how often each stage takes the
structural top spot.

**This is a reproducibility check, not the uncertainty analysis.** The principal
uncertainty analysis is the fixed-seed global design in
`docs/benchmarks/v7-sensitivity.json` (`npm run sensitivity`), which covers all
twelve continuous dimensions, the categorical model forms, first- and
total-order influence, and sign stability.

The span reported here is an **assumption envelope**. Uniform sampling over an
assumption box is a computational design, not a probability distribution over
what is true, so the span is not a confidence interval and the percentiles
describe only where the sampled values fell.

---

## Part C — pipeline regression

Three assertions, each of which fails the run:

1. Setting the base parameters explicitly gives the same chain index as
   defaulting them.
2. Every published structural value is finite and inside $[0,10]$.
3. Two independent engine builds over the same snapshot are **bit-identical**.

Determinism is a property this model has to have: with fixed-seed sampling and a
deterministic node ordering, an artefact regenerated tomorrow must diff cleanly
against the one committed today.

---

## Determinism and reproducibility

Every random draw in this script comes from a seeded generator (`mulberry32`,
seeds 20260829 and 777). There is no unseeded `Math.random` in the path. Re-run
it and the CSVs are identical.

Replication counts can be reduced for a fast local run:

```bash
SSCIM_RECOVERY_REPS=5 SSCIM_RECOVERY_DRAWS=20 \
  node docs/computation-demo/validation/mle-validation.mjs
```

Paths derive from `import.meta.url`. The v6 version hard-coded an absolute
Windows directory, so it ran on exactly one machine.

---

## What would have to happen before "calibrated"

The roadmap is [spec §11](../../MODEL_V7_SPEC.md#11-limitations-and-calibration-roadmap).
In short, and in order:

1. **Real incident outcomes** — a dataset of observed disruption outcomes,
   dated and attributed, assembled independently of the model.
2. **Holdout incidents** — a pre-registered split, with the holdout untouched
   during estimation.
3. **Honest uncertainty** — profile likelihood or bootstrap intervals, not Wald
   intervals on synthetic data.
4. **Out-of-sample validation** — predictive performance on the holdout,
   reported whether or not it is good, against a stated naive baseline.
5. **Registry promotion** — only then may `status` change, and the estimate, its
   interval, its estimation procedure and its holdout performance must be
   recorded alongside it.

Until all five are satisfied, the honest description of every parameter is: a
continuity prior and a stress assumption, reproducible to the last digit, and
uncalibrated.
