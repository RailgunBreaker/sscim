[SSCIM calculation specification](README.md) · section 40 of 49

# 40. Parameter Provenance: Where the Current Numbers Actually Came From

## 40.1 Audit conclusion

After checking `app/src/engine/priors.js`, `MODEL_ROADMAP.md`, and `computation-demo/validation/MLE_VALIDATION.md`, the correct conclusion is:

> **The current parameter values were not calculated from real historical semiconductor outcomes. They were manually declared as transparent sensitivity priors.**

The repository explicitly says that nothing in `MODEL_PRIORS` has been fitted to observed disruption episodes. The values exist to make the demonstration reproducible, inspectable, and directionally sensible. SSCIM therefore must not describe `0.55`, `0.30`, `12`, or `0.25` as empirical estimates.

The current parameter vector is:

```math
\theta_0
=
\begin{bmatrix}
f_{\mathrm{down}} \\
f_{\mathrm{up}} \\
H \\
\phi
\end{bmatrix}
=
\begin{bmatrix}
0.55 \\
0.30 \\
12 \\
0.25
\end{bmatrix}
```

The repository's MLE validation does not discover these values from reality. It creates synthetic observations using the same values as known ground truth and tests whether the estimator recovers them. This validates the estimation machinery, not the real-world truth of the starting numbers.

---

## 40.2 Why `downstreamTransmission = 0.55` was selected

### Current rationale

`0.55` is a hand-set midpoint prior. It represents the judgment that a material supplier disruption should pass **more than half**, but not all, of its remaining effect to a dependent buyer after inventories, alternate sourcing, scheduling flexibility, and spare capacity absorb part of the shock.

It also encodes the qualitative assumption:

```math
f_{\mathrm{down}}>f_{\mathrm{up}}
```

because a critical physical-input shortage is assumed to propagate more strongly forward than a demand reduction propagates backward. No real event dataset was used to solve for exactly `0.55`.

### How it should be calculated from real data

For each historical supplier-to-buyer observation $n$, collect:

- supplier shock $S_{i,n}$;
- buyer shock $S_{j,n}$;
- buyer input dependence $d_{ij,n}$;
- effective specificity $q_{ij,n}$;
- event age $t_n$;
- half-life $H$.

Define the decayed, edge-adjusted supplier exposure:

```math
X_n
=
S_{i,n}
\left(\frac{1}{2}\right)^{t_n/H}
d_{ij,n}q_{ij,n}
```

The observation equation is:

```math
S_{j,n}=f_{\mathrm{down}}X_n+\varepsilon_n
```

Estimate the coefficient by constrained least squares, equivalent to Gaussian maximum likelihood:

```math
\hat f_{\mathrm{down}}
=
\arg\min_{0\leq f\leq1}
\sum_{n=1}^{N}
\left(S_{j,n}-fX_n\right)^2
```

For this one-parameter linear case:

```math
\hat f_{\mathrm{down}}
=
\min\left(1,
\max\left(0,
\frac{\sum_{n=1}^{N}X_nS_{j,n}}
{\sum_{n=1}^{N}X_n^2}
\right)\right)
```

`0.55` should remain only until a real event panel produces this estimate.

---

## 40.3 Why `upstreamTransmission = 0.30` was selected

### Current rationale

`0.30` is a hand-set weaker upstream-echo prior. It assumes that a buyer's demand reduction affects its suppliers, but suppliers may partly redirect sales, reduce utilization, draw down inventories, or serve other customers. It was not calculated from disclosed buyer-supplier outcomes.

### How it should be calculated

For each buyer-to-supplier observation $n$, collect buyer demand shock $D_{j,n}$, supplier revenue dependence $r_{ij,n}$, and observed supplier effect $S^{\mathrm{up}}_{i,n}$.

Define:

```math
Z_n=D_{j,n}r_{ij,n}
```

Then:

```math
S^{\mathrm{up}}_{i,n}=f_{\mathrm{up}}Z_n+\varepsilon_n
```

Estimate:

```math
\hat f_{\mathrm{up}}
=
\arg\min_{0\leq f\leq1}
\sum_{n=1}^{N}
\left(S^{\mathrm{up}}_{i,n}-fZ_n\right)^2
```

with closed form:

```math
\hat f_{\mathrm{up}}
=
\min\left(1,
\max\left(0,
\frac{\sum_{n=1}^{N}Z_nS^{\mathrm{up}}_{i,n}}
{\sum_{n=1}^{N}Z_n^2}
\right)\right)
```

---

## 40.4 Why `halfLifeDays = 12` was selected

### Current rationale

`12` is a manually selected short-run demonstration timescale. It means modeled event influence halves roughly every two weeks:

```math
S(t)=S_0 2^{-t/12}
```

Therefore:

```math
S(12)=0.5S_0,
\qquad
S(24)=0.25S_0,
\qquad
S(36)=0.125S_0
```

The repository contains no historical recovery panel from which twelve days was derived.

### How it should be calculated

For event observations $(t_k,S_k)$:

```math
S_k=S_0e^{-\kappa t_k}+\varepsilon_k
```

with:

```math
H=\frac{\ln 2}{\kappa}
```

For positive observations, log-linearization gives:

```math
\ln\left(\frac{S_k}{S_0}\right)=-\kappa t_k+\eta_k
```

A simple slope estimate is:

```math
\hat\kappa
=
-\frac{\sum_k t_k\ln(S_k/S_0)}
{\sum_k t_k^2}
```

and:

```math
\hat H=\frac{\ln 2}{\hat\kappa}
```

More correctly, all dynamic parameters should be fitted jointly by running the full engine inside the objective:

```math
(\hat f_{\mathrm{down}},\hat f_{\mathrm{up}},\hat H)
=
\arg\min_{f_d,f_u,H}
\sum_{e,s,t}
\left[
Y_{e,s,t}-\widehat Y_{e,s,t}(f_d,f_u,H)
\right]^2
```

---

## 40.5 Why `specificityFloor = 0.25` was selected

### Current rationale

The floor prevents a nominally substitutable input from transmitting exactly zero disruption. The transformation is:

```math
q_{ij}=\phi+(1-\phi)(1-u_{ij})
```

With $\phi=0.25$:

```math
u_{ij}=0 \Rightarrow q_{ij}=1
```

```math
u_{ij}=1 \Rightarrow q_{ij}=0.25
```

The 25% residual represents qualification, contracting, logistics, switching, and ramp-up friction. The exact number was manually chosen and is not a measured average.

### How it should be calculated

For each substitution episode, define residual disruption:

```math
R_n
=
\frac{\text{realized disruption after substitution}}
{\text{counterfactual disruption without substitution}}
```

The model predicts:

```math
\widehat R_n(\phi)=\phi+(1-\phi)(1-u_n)
```

Estimate:

```math
\hat\phi
=
\arg\min_{0\leq\phi\leq1}
\sum_{n=1}^{N}
\left[
R_n-\left(\phi+(1-\phi)(1-u_n)\right)
\right]^2
```

Let:

```math
A_n=R_n-(1-u_n),
\qquad
B_n=u_n
```

Then $A_n=\phi B_n+\varepsilon_n$, so:

```math
\hat\phi
=
\min\left(1,
\max\left(0,
\frac{\sum_n B_nA_n}{\sum_n B_n^2}
\right)\right)
```

---

## 40.6 Why `contributionTolerance = 10^{-4}` was selected

This is a numerical pruning rule rather than an economic coefficient. Recursive path expansion stops when:

```math
|C_p|<\tau,
\qquad
\tau=10^{-4}
```

The repository explains its purpose but does not provide a benchmark proving that $10^{-4}$ is optimal.

To select it empirically, use a near-zero reference tolerance such as:

```math
\tau_{\mathrm{ref}}=10^{-10}
```

For each candidate tolerance, calculate relative output error:

```math
E(\tau)
=
\frac{\lVert R(\tau)-R(\tau_{\mathrm{ref}})\rVert_1}
{\lVert R(\tau_{\mathrm{ref}})\rVert_1}
```

Select the largest tolerance satisfying an accuracy requirement:

```math
\hat\tau
=
\max\left\{
\tau:E(\tau)\leq\epsilon
\right\}
```

For example, use $\epsilon=10^{-3}$ if less than 0.1% aggregate output error is acceptable.

---

## 40.7 Why the component weights are `0.25/0.20/0.20/0.15/0.10/0.10`

The current vector is:

```math
w_0
=
\begin{bmatrix}
0.25 & 0.20 & 0.20 & 0.15 & 0.10 & 0.10
\end{bmatrix}^{\top}
```

for chokepoint, geography, policy, substitutability, current shock, and market components.

The weights encode the analyst priority ordering:

```math
\text{chokepoint}
>
\text{geography}\approx\text{policy}
>
\text{substitutability}
>
\text{shock}\approx\text{market}
```

They are normalized because:

```math
0.25+0.20+0.20+0.15+0.10+0.10=1
```

No regression or documented expert-elicitation procedure in the repository derives these exact percentages.

Given normalized component vector $x_n$ and realized outcome $Y_n$, estimate them by constrained regression:

```math
\widehat Y_n=x_n^{\top}w
```

```math
\hat w
=
\arg\min_w
\sum_{n=1}^{N}
\left(Y_n-x_n^{\top}w\right)^2
```

subject to:

```math
w_k\geq0,
\qquad
\sum_kw_k=1
```

Validation must hold out complete events rather than random rows:

```math
\hat w^{(-e)}
=
\arg\min_w
\sum_{n:\operatorname{event}(n)\neq e}
\left(Y_n-x_n^{\top}w\right)^2
```

---

## 40.8 Why the sensitivity range is `±30%`

The current deterministic scenarios are:

```math
\theta_{\mathrm{low}}=0.7\theta_0
```

```math
\theta_{\mathrm{high}}=1.3\theta_0
```

The 30% band is explicitly a robustness envelope, not a confidence interval. It asks whether conclusions survive materially different plausible assumptions.

After real calibration, replace it with statistical uncertainty:

```math
CI_{95\%,k}
=
\hat\theta_k\pm1.96\,SE(\hat\theta_k)
```

or jointly sample:

```math
\theta^{(b)}
\sim
\mathcal N(\hat\theta,\widehat\Sigma_{\theta})
```

---

## 40.9 What the synthetic MLE validation proves

The validation creates stage-level synthetic observations at:

```math
t\in\{0,3,6,9,12,15\}
```

across 24 stages, giving:

```math
24\times6=144
```

observations per replication. It generates them using assumed truth:

```math
\theta^{*}=(0.55,0.30,12)
```

and Gaussian noise:

```math
\varepsilon\sim\mathcal N(0,0.02^2)
```

The estimator minimizes:

```math
RSS(\theta)
=
\sum_{n=1}^{144}
\left[Y_n-\widehat Y_n(\theta)\right]^2
```

with profiled variance:

```math
\hat\sigma^2=\frac{RSS(\hat\theta)}{N}
```

This establishes that the three dynamic parameters are identifiable under this observation design and that the estimator can recover known synthetic values. It does **not** establish:

```math
(0.55,0.30,12)
=
\text{true real-world semiconductor parameters}
```

---

## 40.10 Required real calibration dataset

| Field | Meaning |
|---|---|
| `event_id` | Historical disruption identifier |
| `event_date` | Event start date |
| `observation_date` | Date impact was measured |
| `origin_node` | Initially affected company, stage, or country |
| `target_node` | Node where an effect was observed |
| `direction` | Downstream or upstream |
| `origin_impact` | Measured origin production or demand loss |
| `target_impact` | Measured target production, revenue, or delivery effect |
| `buyer_input_share` | $d_{ij}$ |
| `supplier_revenue_share` | $r_{ij}$ |
| `substitutability` | $u_{ij}$ |
| `inventory_days` | Buffer before disruption is felt |
| `time_to_switch` | Substitute qualification and ramp time |
| `time_to_recover` | Origin recovery time |
| `capacity_utilization` | Available capacity slack |
| `measurement_uncertainty` | Confidence level or standard error |

The roadmap proposes episodes such as the 2021 ABF substrate shortage, the 2023 gallium/germanium licensing action, and successive export-control rounds. These still require a structured outcome panel before empirical calibration can occur.

---

## 40.11 Final provenance table

| Parameter | Current value | How the current value was obtained | Defensible future estimator |
|---|---:|---|---|
| $f_{\mathrm{down}}$ | 0.55 | Hand-set directionally sensible prior | Constrained MLE/least squares on supplier-to-buyer outcomes |
| $f_{\mathrm{up}}$ | 0.30 | Hand-set weaker upstream-echo prior | Constrained MLE/least squares on buyer-to-supplier outcomes |
| $H$ | 12 days | Hand-set roughly two-week decay prior | Nonlinear decay fit or joint full-engine MLE |
| $\phi$ | 0.25 | Hand-set residual switching-friction floor | Fit residual loss in substitution episodes |
| $\tau$ | $10^{-4}$ | Numerical pruning choice | Convergence-error and runtime benchmark |
| Component weights | 0.25/0.20/0.20/0.15/0.10/0.10 | Analyst priority judgment | Constrained regression or documented expert elicitation |
| Sensitivity band | ±30% | Deterministic robustness scenario | Empirical covariance and confidence intervals |
| `datasetAsOf` | 2026-07-29 | Snapshot freeze date | Direct metadata; not estimated |

The scientifically correct statement is:

> SSCIM currently uses transparent, reproducible priors. The formulas for estimating them are ready, and synthetic tests show that the three main dynamic parameters are recoverable, but no real-world calibration has yet produced the current numerical values.

---

[← 39. Full End-to-End Worked Example](39-full-end-to-end-worked-example.md) · [Contents](README.md) · [41. Calibration Framework →](41-calibration-framework.md)
