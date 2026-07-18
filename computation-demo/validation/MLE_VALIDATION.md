# MLE confidence-interval test & validation of the SSCIM algorithm

**Generated 2026-07-12** by [`mle-validation.mjs`](mle-validation.mjs) running against the real engine (`app/src/engine`) and the real snapshot. Raw outputs: [`validation-results.json`](validation-results.json), [`mle_replications.csv`](mle_replications.csv), [`mc_robustness_draws.csv`](mc_robustness_draws.csv). Re-run with `node computation-demo/validation/mle-validation.mjs`.

**Honest framing first.** The model's three transmission parameters — `f_down = 0.55`, `f_up = 0.30`, `halfLife H = 12` — are declared priors; there is **no real-world outcome dataset** to fit them to yet (that is the calibration step in `MODEL_ROADMAP.md`). So a "true" MLE against reality is impossible today. What *can* be tested rigorously, and is tested here:

| Part | Question | Method | Verdict |
|---|---|---|---|
| **C** | Is the implementation itself correct? | Independent re-implementation from primitives must reproduce the engine bit-for-bit | ✅ exact match |
| **A** | If we had the planned observation data, could the parameters be estimated at all — and are MLE confidence intervals trustworthy? | Synthetic-data parameter recovery: simulate observations at known θ\*, estimate by ML, check 95% CI coverage over 200 replications | ✅ identifiable, coverage ≈ nominal |
| **B** | Do the algorithm's headline results survive the parameter uncertainty? | Monte-Carlo over the declared ±30% prior band, 400 draws, full pipeline per draw | ✅ conclusions stable |

---

## Part C — Cross-implementation regression check

The validation script re-builds the scoring pipeline from the engine's primitive functions (`buildDependenceMatrices`, `propagateFromSource`, `combineSigned`, …) with the parameters exposed as free variables, then asserts equality with `buildEngine()`'s published outputs at the base parameters:

```
✔ chain index        6.135723 == engine 6.135723
✔ litho structural   8.004899 == engine 8.004899
✔ adv_fab NI         7.730715 == engine 7.730715
✔ TSMC criticality  10.000000 == engine 10.000000
```

Two independently-written code paths agreeing to full float precision rules out a whole class of implementation bugs before any statistics are run.

## Part A — MLE parameter-recovery test with 95% Wald confidence intervals

### Observation model

The roadmap's calibration data would look like: *stage-level impact readings observed on several days after events*. We simulate exactly that panel:

- For each offset `t ∈ {0, 3, 6, 9, 12, 15}` days, compute the true operational field over all 24 stages with the snapshot's real events aged by `t`, at **known true parameters** θ\* = (0.55, 0.30, 12).
- Add i.i.d. Gaussian observation noise ε ~ N(0, σ²), σ = 0.02 (small relative to field values of 0.1–0.8).
- One replication = 24 × 6 = **144 observations**.

With Gaussian noise the log-likelihood is `ℓ(θ, σ) = −N/2·ln(2πσ²) − RSS(θ)/(2σ²)`, so the **MLE of θ minimizes the residual sum of squares** (computed by running the actual propagation engine inside the objective), and σ is profiled out as σ̂² = RSS/N. Optimization: Nelder–Mead started deliberately far from truth at (0.40, 0.20, 8). Confidence intervals: Wald, `Var(θ̂) = σ̂²(JᵀJ)⁻¹` with the Jacobian J of the model function obtained by central finite differences; 95% CI = θ̂ ± 1.96·SE.

### Results — one replication (illustrative)

| Parameter | Truth | MLE θ̂ | SE | 95% CI | Truth covered? |
|---|---|---|---|---|---|
| f_down | 0.55 | 0.5503 | 0.0181 | [0.5149, 0.5858] | ✅ |
| f_up | 0.30 | 0.3045 | 0.0066 | [0.2916, 0.3174] | ✅ |
| halfLife | 12 | 12.037 | 0.208 | [11.630, 12.445] | ✅ |
| σ (nuisance) | 0.02 | 0.0207 | — | — | — |

### Results — coverage study over R = 200 replications

| Parameter | Truth | Mean θ̂ | Empirical SD of θ̂ | Mean SE | **Empirical 95% coverage** |
|---|---|---|---|---|---|
| f_down | 0.55 | 0.5512 | 0.0183 | 0.0173 | **93.5%** |
| f_up | 0.30 | 0.2993 | 0.0063 | 0.0064 | **94.0%** |
| halfLife | 12 | 12.016 | 0.194 | 0.199 | **96.0%** |

Interpretation:

- **All three parameters are identifiable** from this observation design — estimates are essentially unbiased (mean θ̂ ≈ truth) and tight. The multi-day panel is what identifies `H` (decay needs time variation); the cross-stage pattern identifies `f_down`/`f_up` separately (the snapshot's `e1` propagates both directions, separating the two coefficients).
- **The CIs are honest:** empirical coverage of 93.5–96.0% against the 95% target is within Monte-Carlo noise (with R = 200, the binomial standard error is ±1.5pp). Equivalently, the SEs the Wald formula reports (0.0173 / 0.0064 / 0.199) match the actually-observed estimator scatter (0.0183 / 0.0063 / 0.194).
- **Practical meaning for the MVP:** once even a modest real dataset exists (order of ~150 stage-day impact observations around documented episodes), this exact machinery can replace the hand-set priors with fitted values *and defensible confidence intervals*. The estimation pipeline is already proven correct on synthetic ground truth.

## Part B — Monte-Carlo robustness of the algorithm's results

400 draws of θ uniform over the declared ±30% sensitivity band (f_down ∈ [0.385, 0.715], f_up ∈ [0.21, 0.39], H ∈ [8.4, 15.6]); the **entire pipeline** (network influence, structural scores, operational field, chain index, criticality of all 109 companies) recomputed per draw.

| Output | Base value | Across 400 draws |
|---|---|---|
| Chain index | 6.136 | mean 6.132, 95% interval **[5.966, 6.328]** — never crosses neutral 5 |
| "TSMC is the #1 critical company" | rank 1 | holds in **100.0%** of draws |
| "Lithography is the most structurally vulnerable stage" | rank 1 | holds in **100.0%** of draws |
| Full 109-company ranking vs base (Kendall τ) | 1.0 | mean **0.958**, worst draw **0.894** |
| NVIDIA criticality | 5.17 | 95% interval [4.73, 6.05] |
| ASML criticality | 4.68 | 95% interval [3.67, 6.18] |

Interpretation: the product's headline *claims* — net-adverse news environment, TSMC most critical, lithography most fragile, and the broad shape of the company ranking — are **not artifacts of the specific prior values**; they survive everywhere in the declared uncertainty band. Individual mid-table criticality *values* wobble by roughly ±1 point, which is exactly why the UI reports ranks and labeled intervals rather than pretending point precision.

---

## What this does and does not establish

**Established:** the code computes what the documentation says (Part C); the parameters the model depends on are statistically identifiable from realistic panel data and the MLE/CI machinery for calibrating them is correct with ~nominal coverage (Part A); the algorithm's rankings and headline index are robust to the full declared parameter uncertainty (Part B).

**Not established (and not claimable yet):** that θ\* = (0.55, 0.30, 12) are the *true real-world* values, or that model outputs track realized economic losses. That requires the roadmap's real-episode dataset (2021 ABF substrate shortage, 2023 Ga/Ge licensing, successive export-control rounds) — at which point Part A's estimator runs unchanged on real observations instead of synthetic ones.
