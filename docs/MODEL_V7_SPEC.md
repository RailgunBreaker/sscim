# SSCIM Model v7.1 — Canonical Technical Specification

**Model version:**
<!-- BEGIN GENERATED: model-version -->
`sscim-model-v7.1-exposure-robustness`
<!-- END GENERATED: model-version -->

This document is the **canonical specification** of the SSCIM model. Every other
document in this repository explains the model for a particular audience and
**must link here rather than define a competing formula**. Where any other
document disagrees with this one, this one is correct and the other one is a
defect — `npm run docs:verify` exists to catch exactly that.

Parameter tables, the model-version label and the worked example below are
**generated from `app/src/engine/registry.js` and the engine itself** and
re-checked in CI, so they cannot drift from the code.

---

## Contents

1. [Model purpose and boundary](#1-model-purpose-and-boundary)
2. [Complete notation](#2-complete-notation)
3. [Exact executable formulas](#3-exact-executable-formulas)
4. [Order of operations](#4-order-of-operations)
5. [Parameter register](#5-parameter-register)
6. [Fallback and missing-data rules](#6-fallback-and-missing-data-rules)
7. [Worked numerical example](#7-worked-numerical-example)
8. [Sensitivity and robustness](#8-sensitivity-and-robustness)
9. [Validation status](#9-validation-status)
10. [v6 → v7 change log](#10-v6--v7-change-log)
11. [Limitations and calibration roadmap](#11-limitations-and-calibration-roadmap)

---

## 1. Model purpose and boundary

### 1.1 What SSCIM estimates

SSCIM computes, over a **frozen curated snapshot** of a semiconductor supply-chain
graph, three deliberately separate families of number:

1. **Structural baseline** — a time-invariant, event-free score per stage
   (and, aggregated by country share, per country) combining network influence,
   geographic concentration, standing policy exposure, non-substitutability and
   market importance.
2. **Operational event field** — a signed, bounded per-stage field in $[-1,1]$
   produced by propagating the current set of deduplicated incidents through the
   dependency graph. Positive is adverse, negative is mitigating.
3. **Scenario delta** — the difference the operational field and the headline
   index show when one hypothesised shock is added on top of the baseline.

These three layers never mix. The structural layer contains no event term; the
operational layer contains no structural score; the scenario is always reported
as a delta against an explicitly stated baseline.

### 1.2 What the outputs are

**Bounded comparative exposure scores.** Every published quantity is confined to
a stated interval ($[-1,1]$ for signed fields, $[0,10]$ for display scores) and
is meaningful only in comparison: stage A versus stage B, this scenario versus
the baseline, this snapshot versus a re-run with different assumptions.

### 1.3 What the outputs are NOT

They are **not**:

- **probabilities.** Nothing here is the chance of anything. The bounded
  aggregation operator in §3.7 is arithmetically the noisy-OR expression, and
  it is used for its monotonicity and saturation, **not** as a probability
  calculation and **not** under an independence assumption.
- **monetary losses.** The stage "turnover proxy" is an *importance weight*.
  Supply-chain turnover is sequential — the same wafer is counted at the wafer
  stage, again at the fab stage, again at packaging — so summing it is not an
  economic aggregate. No output is money.
- **forecasts.** Persistence profiles describe how a *recorded* incident's
  modelled source is carried forward from its own date to the evaluation date.
  They do not predict future incidents, and the model makes no statement about
  any date after the snapshot date.
- **observed trade flows.** Edge allocations, dependency matrices and the
  facility-network links are declared priors built from graph structure and
  curated shares. No bill of materials, shipment record or customs series enters
  the model anywhere.
- **causal estimates.** Nothing here is identified from an intervention,
  a natural experiment, or an outcome dataset.
- **calibrated risk estimates.** Every coefficient is `status: assumption`
  (§5). None has been fit to observed disruption outcomes.

### 1.4 What it is for

Framing questions, comparing scenarios against each other, revealing which
assumption a conclusion actually rests on, and guiding where to spend diligence
effort. It is a **research prototype and a deterministic comparison and
sensitivity environment**, not an investment or policy recommendation system.

### 1.5 Confidence and evidence quality

Every record carries a confidence label and provenance. These are **metadata**.
They are displayed, they drive no arithmetic, and they must never silently
multiply a modelled effect. Two records identical except for confidence produce
identical source vectors — asserted in
`app/src/engine/eventSource.test.js`.

---

## 2. Complete notation

Every symbol used anywhere in the model, with its domain, unit, source, and
whether it is **observed** (from a public record), **curated** (an analyst wrote
it after reading a source), **derived** (computed from other quantities), or
**assumed** (a declared prior with no empirical estimate behind it).

### 2.1 Structure

| Symbol | Meaning | Domain | Unit | Source |
| --- | --- | --- | --- | --- |
| $s, a, b$ | stage identifiers | stage set | — | curated |
| $\mathrm{IN}(b)$ | stages with an edge into $b$ | subset of stages | — | curated |
| $\mathrm{OUT}(a)$ | stages $a$ has an edge into | subset of stages | — | curated |
| $c$ | country identifier | country set | — | observed |
| $\sigma_{c,s}$ | country $c$'s share of stage $s$ | $[0,1]$ | share | curated |
| $\nu_a$ | non-substitutability of stage $a$ (v6 field name: `subst`) | $[0,1]$ after $/10$ | ordinal $\to$ dimensionless | curated |
| $m_s$ | market importance of stage $s$ | $[0,10]$ | ordinal | curated |
| $V_s$ | stage turnover proxy | $\ge 0$ | currency proxy, **not a loss base** | curated |
| $w_s$ | normalized stage economic weight | $[0,1]$, $\sum_s w_s = 1$ | dimensionless | derived |

### 2.2 Event severity, exposure and persistence

| Symbol | Meaning | Domain | Unit | Source |
| --- | --- | --- | --- | --- |
| $e$ | incident (a deduplicated group of records) | incident set | — | curated |
| $q_e$ | displayed severity of incident $e$ | $\{1,\dots,10\}$ | **ordinal rubric** | curated |
| $g$ | severity-to-intensity mapping | $[0,10] \to [0,1]$ | dimensionless | assumed (model form) |
| $d_{e,s}$ | signed direction of $e$ at stage $s$ | $[-1,1]$ | sign | curated |
| $\alpha_{e,s}$ | stage exposure: how much of stage $s$ the incident touches | $[0,1]$ | dimensionless stage-scope intensity | assumed unless explicitly measured; hazards use ordinal sample footprint |
| $t$ | evaluation offset in days before the snapshot date | $\ge 0$ | days | derived |
| $\mathrm{age}$ | incident age in days at the evaluation date | $\mathbb{R}$ | days | derived |
| $R_e(t)$ | temporal profile (persistence multiplier) | $[0,1]$ | dimensionless | assumed (profile) + curated (dates) |
| $H_a, H_m$ | acute and market half-lives | days | days | assumed |
| $T_r$ | outage recovery duration | days | days | assumed |
| $z_{e,s}(t)$ | signed source at stage $s$ for incident $e$ | $[-1,1]$ | dimensionless | derived |

### 2.3 Propagation

| Symbol | Meaning | Domain | Unit | Source |
| --- | --- | --- | --- | --- |
| $f_d$ | downstream transmission coefficient | $[0,1)$ | dimensionless | assumed |
| $f_u$ | upstream transmission coefficient | $[0,1)$ | dimensionless | assumed |
| $\phi$ | minimum dependency factor (v6 name: `specificityFloor`) | $[0,1]$ | dimensionless | assumed |
| $q_{ba}$ | share of $b$'s input dependence attributable to $a$ | $[0,1]$, $\sum_{a \in \mathrm{IN}(b)} q_{ba} = 1$ | share | curated if available, else equal-split fallback |
| $r_{ab}$ | share of $a$'s output exposure attributable to $b$ | $[0,1]$, $\sum_{b \in \mathrm{OUT}(a)} r_{ab} = 1$ | share | curated if available, else equal-split fallback |
| $D_{ba}$ | downstream dependency coefficient | $[0,1)$ | dimensionless | derived |
| $U_{ab}$ | upstream dependency coefficient | $[0,1)$ | dimensionless | derived |
| $x^d_{e,s}$ | downstream channel value | $[0,1]$ | dimensionless | derived |
| $x^u_{e,s}$ | upstream channel value | $[0,1]$ | dimensionless | derived |
| $p_{e,s}$ | combined per-incident field | $[-1,1]$ | dimensionless | derived |
| $F_s$ | aggregate operational field at stage $s$ | $[-1,1]$ | dimensionless | derived |

### 2.4 Structural and aggregate

| Symbol | Meaning | Domain | Unit | Source |
| --- | --- | --- | --- | --- |
| $\mathrm{DirectFootprint}_s$ | the stage's own normalized economic weight | $[0,1]$ | dimensionless | derived |
| $\mathrm{SpilloverReach}_s$ | economically weighted downstream field at OTHER stages | $\ge 0$ | dimensionless | derived |
| $NI^{\mathrm{raw}}_s$ | raw network influence = spillover reach (v7.1) | $\ge 0$ | dimensionless | derived |
| $NI_s$ | **snapshot-relative** network influence | $[0,10]$ | display score | derived |
| $\mathrm{HHI}^{-}_s, \mathrm{HHI}^{+}_s$ | HHI lower and upper bounds | $[0,1]$ | dimensionless | derived |
| $GEO_s$ | geographic concentration score | $[0,10]$ | display score | derived |
| $POL_s$ | policy exposure score | $[0,10]$ | display score | derived |
| $w^{\mathrm{struct}}_k$ | structural component weight | $[0,1]$, sums to 1 | dimensionless | assumed |
| $\mathrm{Struct}_s$ | structural vulnerability | $[0,10]$ | display score | derived |
| $L_c$ | country local pressure | $[-1,1]$ | dimensionless | derived |
| $K_c$ | country chain contribution | $\mathbb{R}$ | dimensionless | derived |
| $I$ | signed headline index | $[-1,1]$ | dimensionless | derived |
| $\hat I$ | displayed headline index | $[0,10]$ | display score | derived |
| $\mathrm{Crit}^{\mathrm{raw}}_j$ | raw company criticality | $\ge 0$ | dimensionless | derived |
| $\mathrm{Crit}_j$ | **snapshot-relative** company criticality | $[0,10]$ | display score | derived |

### 2.5 The six things that are easy to confuse

| These are different | and must never be substituted for one another |
| --- | --- |
| **severity** $q_e$ | how bad the incident is, on an ordinal human rubric |
| **stage exposure** $\alpha_{e,s}$ | how much of a stage the incident touches |
| **persistence** $R_e(t)$ | how much of the incident is still live at the evaluation date |
| **propagation** $D, U$ | how much of a shock a dependent stage feels |
| **structural vulnerability** $\mathrm{Struct}_s$ | how exposed a stage is *before any event* |
| **aggregation** $w_s$, $A$ | how per-stage numbers are combined into one number |

---

## 3. Exact executable formulas

Every formula below is implemented once, in the file named beside it.

### 3.1 Event source-vector construction — `engine/eventSource.js`

For incident $e$, stage $s$, evaluation time $t$:

$$
z_{e,s}(t) = d_{e,s}\; g(q_e)\; \alpha_{e,s}\; R_e(t)
$$

with $z_{e,s} \in [-1,1]$ by construction, since $|d| \le 1$, $g \in [0,1]$,
$\alpha \in [0,1]$ and $R \in [0,1]$.

Stage ids are deduplicated **before** the vector is built. The direction is:

$$
d_{e,s} =
\begin{cases}
+1 & \text{direction is } \texttt{adverse}\\
-1 & \text{direction is } \texttt{mitigating}\\
\mathrm{sign}(\text{curated signed component at } s) & \text{a signed decomposition exists}\\
\text{unscored} & \text{otherwise}
\end{cases}
$$

A `mixed` or `unclassified` direction with no signed decomposition produces **no
scalar field at all**. An unknown direction is never treated as adverse.

#### Evidence eligibility and component persistence correction (application 0.7.2)

Before constructing a factual source, require a verified occurrence, explicit baseline eligibility, supporting source location and review provenance. At least one claim-supporting source must be available by the evaluation date. URL existence and an authoritative publisher alone do not pass this gate. Confidence never multiplies exposure. Missing evidence yields an explicit exclusion and coverage diagnostic.

The source equation above uses stage/component persistence when available: each component has a site, process step (restart, wafer_input, finished_output or shipments), exposure fraction, assumed profile and optional observed residual milestones. Fractions partition the existing direct stage source; unspecified fractions retain the assumed profile. An observed residual overrides only the matching component once both its effective and information-available dates are reached. Updates remain attached to the original incident and cannot become independent shocks. See [exact milestone rules](RECOVERY_MILESTONES.md).

Severity is the ordinal-to-intensity mapping; exposure is an assumed affected stage-scope intensity unless documented as measured; persistence is the evolution of that effect. They are distinct. No generic 60-day recovery or 45-day market half-life was changed. Equal incoming allocation remains a sensitivity heuristic: [complementary-input counterexample](COMPLEMENTARY_INPUT_BENCHMARK.md) demonstrates why it is not a physical bottleneck model.

### 3.2 Severity mappings — `engine/severity.js`

$$
g_{\mathrm{linear}}(q) = \frac{q}{10},
\qquad
g_{\mathrm{concave}}(q) = \sqrt{\frac{q}{10}},
\qquad
g_{\mathrm{convex}}(q) = \left(\frac{q}{10}\right)^{2}
$$

All three are monotone increasing on $[0,10]$, agree at $q=0$ and $q=10$, and map
into $[0,1]$. `linear` is the continuity base. **No mapping is calibrated**; the
severity rubric is ordinal, so the cardinal mapping is a declared model form.

### 3.3 Modeled facility footprint — `engine/facilities.js`

Site weight, for a site with ordinal `scale` $k$ and a status:

$$
w(\text{site}) = \mathrm{map}(k)\cdot \mathrm{status}(\text{site}),
\qquad
\mathrm{map} \in \{\,1,\; k,\; k^{2}\,\}
$$

$$
\mathrm{status} =
\begin{cases}
1 & \texttt{operating}\\
w_{\mathrm{ramp}} & \texttt{ramping}\\
0 & \texttt{construction},\ \texttt{idle}
\end{cases}
$$

The **modeled facility footprint** of stage $s$ inside a hazard radius:

$$
\alpha_{e,s} \;=\; \frac{\sum_{\text{sites of } s \text{ inside}} w(\text{site})}
                        {\sum_{\text{sites of } s} w(\text{site})}
\;\in\; [0,1]
$$

This is a **share of the modeled site sample**. It is not capacity share, not
output, and not physical damage. `scale` is an analyst ordinal: ratios of its
values are not observed production capacity, and the ordinal-to-weight mapping is
a declared model form, not an estimate.

Zero footprint gives exactly zero source. The response is continuous and monotone
in the footprint everywhere, including across the 5% line, which is a **display
threshold only** and gates nothing the model computes.

### 3.4 Dependency matrices — `engine/propagation.js`

For every edge $a \to b$:

$$
D_{ba} = f_d\; q_{ba}\;\bigl[\phi + (1-\phi)\,\nu_a\bigr],
\qquad \sum_{a \in \mathrm{IN}(b)} q_{ba} = 1
$$

$$
U_{ab} = f_u\; r_{ab},
\qquad \sum_{b \in \mathrm{OUT}(a)} r_{ab} = 1
$$

Because the allocations are a partition of one at each node and the bracket is at
most one:

$$
\sum_{a \in \mathrm{IN}(b)} D_{ba} \le f_d < 1,
\qquad
\sum_{b \in \mathrm{OUT}(a)} U_{ab} \le f_u < 1
$$

**What that bound says, and what it does not.** It bounds each stage
**individually**: the inflow into any one node is a strict fraction of its
inputs' values, so the per-stage recursion settles on a DAG, every value stays
inside its clip, the result is order-independent, and **no truncation tolerance
is needed** (v6's `contributionTolerance` is removed from substantive
calculation; a display epsilon survives only for formatting).

It does **not** conserve anything network-wide. $f_d$ and $f_u$ are **per-stage
inheritance multipliers**, not shares of a fixed quantity being divided up. One
source reaches several buyers, each inheriting up to $f_d$ of what it depends on,
so the signal **branches**: the sum of propagated values across all stages
routinely exceeds the source magnitude. On the shipped snapshot a unit shock at
`gases` sums to about **2.09** across stages while no single stage exceeds 1.0.

The propagated field is therefore a **dimensionless dependency signal, not a
conserved physical mass**. The defensible claim is *"no stage exceeds its
bound"*, never *"the system cannot manufacture exposure"*.

### 3.5 Joint incident propagation — `engine/propagation.js`

Split the signed source into a nonnegative **adverse** vector $z^{+}$ and a
nonnegative **mitigating** vector $z^{-}$. For each sign, propagate the whole
incident source vector **jointly**:

$$
x^{d}_{e,b} = \mathrm{clip}_{[0,1]}\!\left( z_{e,b} + \sum_{a \in \mathrm{IN}(b)} D_{ba}\,x^{d}_{e,a} \right)
\qquad \text{in topological order}
$$

$$
x^{u}_{e,a} = \mathrm{clip}_{[0,1]}\!\left( z_{e,a} + \sum_{b \in \mathrm{OUT}(a)} U_{ab}\,x^{u}_{e,b} \right)
\qquad \text{in reverse topological order}
$$

Combine, counting the direct source **once**:

$$
p_{e,s} = \mathrm{clip}_{[-1,1]}\Bigl[\, z_{e,s} + \bigl(x^{d}_{e,s} - z_{e,s}\bigr) + \bigl(x^{u}_{e,s} - z_{e,s}\bigr) \,\Bigr]
$$

Do this separately for $z^{+}$ and $z^{-}$, then net:

$$
p_{e,s} = \mathrm{clip}_{[-1,1]}\bigl(p^{+}_{e,s} - p^{-}_{e,s}\bigr)
$$

Where a channel is restricted (`downstream` or `upstream` only), the other
channel's term is zero.

**Within one incident, reconvergent paths are summed, not combined as if
independent.** Two paths meeting at a stage are the same disruption arriving
twice; the noisy-OR interaction term has nothing to represent, and v7 does not
apply it.

This is a **bounded dependency-sensitivity calculation**. It is not a probability
and not a measured Leontief loss.

### 3.6 Adverse and mitigating aggregation — `engine/aggregation.js`

Across **distinct, deduplicated** incidents, at each stage, aggregate the two
signs separately and net:

$$
F_s = \mathrm{clip}_{[-1,1]}\Bigl( A\bigl(\{p^{+}_{e,s}\}_e\bigr) - A\bigl(\{p^{-}_{e,s}\}_e\bigr) \Bigr)
$$

with the bounded aggregation operator $A$ one of:

$$
A_{\mathrm{bounded\_union}}(x) = 1 - \prod_i (1-x_i),
\qquad
A_{\max}(x) = \max_i x_i,
\qquad
A_{\mathrm{clipped\_sum}}(x) = \min\Bigl(1, \textstyle\sum_i x_i\Bigr)
$$

`bounded_union` is the base **for continuity with v6 and for two properties of
the score**: a second adverse incident never lowers the total, and the total
never leaves $[0,1]$. It is **not** an independence assumption and must not be
described as one.

### 3.7 Temporal profiles — `engine/persistence.js`

$\mathrm{age} < 0$ (a record dated in the future) gives $R = 0$ under **every**
profile, with no exceptions.

$$
R_{\texttt{acute\_exponential}}(\mathrm{age}) = 2^{-\mathrm{age}/H_a}
$$

$$
R_{\texttt{market\_exponential}}(\mathrm{age}) = 2^{-\mathrm{age}/H_m}
$$

$$
R_{\texttt{persistent\_policy}}(\mathrm{age}) =
\begin{cases}
1 & \text{effectiveAfterDays} \le \mathrm{age} < \text{expiresAfterDays}\\
0 & \text{otherwise}
\end{cases}
$$

The interval is **half-open**: a control is in force on the day it takes effect
and not on the day it is superseded, so a rule and its replacement never both
score for the same day.

$$
R_{\texttt{outage\_recovery}}(\mathrm{age}) =
\begin{cases}
1 & \mathrm{age} < S\\
1 - \dfrac{\mathrm{age}-S}{T_r} & S \le \mathrm{age} < S + T_r\\
0 & \mathrm{age} \ge S + T_r
\end{cases}
$$

where $S$ is the record's `recoveryStartDays`.

$$
R_{\texttt{strategic\_context}}(\mathrm{age}) = 0 \quad \text{always}
$$

<!-- BEGIN GENERATED: persistence-table -->
| Profile | Formula | Half-life / duration parameter | Operationally scored |
| --- | --- | --- | --- |
| `acute_exponential` | `R(age) = 2^(-age / H_a)` | `acuteHalfLifeDays` | yes |
| `market_exponential` | `R(age) = 2^(-age / H_m)` | `marketHalfLifeDays` | yes |
| `persistent_policy` | `R(age) = 1 on [effectiveAfterDays, expiresAfterDays), else 0` | — | yes |
| `outage_recovery` | `R(age) = 1 before recoveryStartDays, then linear to 0 over T_r` | `outageRecoveryDays` | yes |
| `strategic_context` | `R(age) = 0` | — | no |
<!-- END GENERATED: persistence-table -->

### 3.8 Structural components — `engine/index.js`, `engine/policy.js`, `engine/math.js`

**Direct footprint and spillover reach (changed in v7.1).** v7.0 published one
quantity as "network influence":

$$
NI^{v7.0}_j = \sum_{s} w_s\, p_{j \to s}, \qquad p_{j \to j} = 1
$$

The $s = j$ term is $w_j \cdot 1 = w_j$, so **every stage scored at least its own
economic weight before any propagation occurred**. A large stage with no
downstream edge ranked as highly "network influential" on the strength of its own
size: in the shipped snapshot `m_ai` ranked **second** and has no outgoing edge at
all. It also counted economic size twice inside the structural index, which
already carries market importance as its own weighted component.

v7.1 publishes the two separately, because they answer different questions and
only one of them is about the network:

$$
\mathrm{DirectFootprint}_j = w_j
$$

$$
\mathrm{SpilloverReach}_j = \sum_{s \ne j} w_s \,\bigl|\,\mathrm{propagate}_{\mathrm{down}}(j)_s\,\bigr|
$$

The **structural index uses spillover reach**. Direct footprint is published
beside it and is deliberately **not** fed into the structural score. The v7.0
quantity is preserved for comparison as
`SYSTEM_WEIGHTED_REACH_INCLUDING_SOURCE` — named for what it is, and never called
network influence.

$$
NI^{\mathrm{raw}}_j = \mathrm{SpilloverReach}_j
$$

$$
NI_j = \mathrm{clip}_{[0,10]}\!\left( 10\,\frac{NI^{\mathrm{raw}}_j}{\max_k NI^{\mathrm{raw}}_k} \right)
\qquad \textbf{snapshot-relative}
$$

$NI_j$ is normalized by the largest value **in this snapshot**. It orders stages
within one snapshot and is **not comparable across snapshots**, because the
denominator changes when the stage set or the graph does. $NI^{\mathrm{raw}}$ is
published beside it for that reason.

**Geographic concentration — HHI with an explicit partial-observation
interval.** With observed country shares $\sigma_{c,s}$ summing to
$\Sigma_s \le 1$ and residual $\rho_s = 1 - \Sigma_s$:

$$
\mathrm{HHI}^{-}_s = \sum_c \sigma_{c,s}^{2}
\qquad\text{(residual infinitely fragmented — the least concentrated completion)}
$$

$$
\mathrm{HHI}^{+}_s = \mathrm{HHI}^{-}_s + \rho_s^{2}
\qquad\text{(residual is one undisclosed holder — the most concentrated completion)}
$$

Both are correct bounds on the true HHI given what is observed. The **upper bound
is the explicitly conservative published base**; both enter sensitivity.

$$
GEO_s = \mathrm{clip}_{[0,10]}\bigl(10 \cdot \mathrm{HHI}^{\pm}_s\bigr)
$$

**Policy exposure.** Register rows are first collapsed into **policy families**;
within a family only the strongest severity counts, so a duplicate report or a
revision is idempotent by construction. Then, over families $f$ covering stage
$s$:

$$
POL_s = \mathrm{clip}_{[0,10]}\Bigl( 10\; A_{\mathrm{pol}}\bigl(\{\,\mathrm{sev}_f/10\,\}_f\bigr) \Bigr)
$$

with $A_{\mathrm{pol}}$ one of the three bounded operators of §3.6.

**Structural vulnerability.** Five components, event-free by construction:

$$
\mathrm{Struct}_s = \mathrm{clip}_{[0,10]}\!\left(
w^{\mathrm{struct}}_{NI}\,NI_s
+ w^{\mathrm{struct}}_{\mathrm{geo}}\,GEO_s
+ w^{\mathrm{struct}}_{\mathrm{pol}}\,POL_s
+ w^{\mathrm{struct}}_{\nu}\,(10\nu_s)
+ w^{\mathrm{struct}}_{m}\,m_s
\right)
$$

with $\sum_k w^{\mathrm{struct}}_k = 1$. There is **no shock term**: v6 declared
a `shock` weight that was never read, and it is deleted.

### 3.9 Stage economic weights — `engine/math.js`

$$
w^{\mathrm{turnover}}_s = \frac{V_s}{\sum_t V_t},
\qquad
w^{\mathrm{equal}}_s = \frac{1}{n},
\qquad
w^{\mathrm{log}}_s = \frac{\log(1+V_s)}{\sum_t \log(1+V_t)}
$$

All three sum to one by construction, which is what makes the headline index a
plain weighted mean and the country chain contributions reconcile to it exactly.

**Turnover is an importance proxy, not a loss base.** Sequential supply-chain
turnover double-counts the same silicon at every stage.

### 3.10 Country measures — `engine/index.js`

**Local pressure** — normalized over the country's own modeled stage footprint:

$$
L_c = \mathrm{clip}_{[-1,1]}\!\left( \frac{\sum_s \sigma_{c,s}\,F_s}{\sum_s \sigma_{c,s}} \right)
$$

*"How hard is the part of the chain that sits here being squeezed?"* Comparable
between countries; says nothing about how much of the chain that is.

**Chain contribution** — the country's unnormalized share of the headline field:

$$
K_c = \sum_s \sigma_{c,s}\, w_s\, F_s
$$

*"How much of the headline number is this country?"* Because
$\sum_c \sigma_{c,s} = 1$ wherever shares are fully disclosed:

$$
\sum_c K_c = \sum_s w_s F_s = I
$$

so the chain contributions reconcile to the headline index exactly. The v6
`directSignals` term is **removed**: an incident reaches a country only through
its stage source and propagation, exactly once.

**Country structural score** is the share-weighted mean of the stage structural
components, recombined with the same weights:

$$
\mathrm{Struct}_c = \mathrm{clip}_{[0,10]}\left( \sum_k w^{\mathrm{struct}}_k \cdot \frac{\sum_s \sigma_{c,s}\,\mathrm{comp}_{k,s}}{\sum_s \sigma_{c,s}} \right)
$$

### 3.11 Company measures — `engine/index.js`

**Vulnerability** (share-independent): the mean adverse impact across the stages
the company is present in.

$$
\mathrm{Vuln}_j = \mathrm{clip}_{[0,10]}\!\left( 10\cdot\frac{1}{|S_j|}\sum_{s \in S_j} \max(0, F_s) \right)
$$

**Contribution** (share-weighted): market share does not cancel.

$$
\mathrm{Contrib}_j = \sum_{s \in S_j} \tilde\theta_{j,s}\,\max(0, F_s)\,w_s
$$

where $\tilde\theta_{j,s}$ is the company's within-stage share, renormalized when
a stage's disclosed company shares over-allocate.

**Criticality** — "if this company were fully disrupted". Its stakes are injected
as **one joint source vector** (a company present in several stages is one
disruption, not several), propagated in both directions, then weighted:

$$
\mathrm{Crit}^{\mathrm{raw}}_j = \frac{\sum_s w_s \max(0, \mathrm{propagate}(\theta_j)_s)}{\sum_s w_s}
$$

$$
\mathrm{Crit}_j = \mathrm{clip}_{[0,10]}\!\left( 10\,\frac{\mathrm{Crit}^{\mathrm{raw}}_j}{\max_k \mathrm{Crit}^{\mathrm{raw}}_k} \right)
\qquad \textbf{snapshot-relative}
$$

**Topology is applied exactly once.** The weight is the economic weight $w_s$,
which carries no topology. v6 weighted by $NI_s$ — itself a propagation-derived
reachability measure — so a company on a well-connected stage was rewarded twice
for the same connectivity.

As with network influence, the raw value is published beside the rescaled score,
and the rescaled score is **not comparable across snapshots**.

### 3.12 Headline index and scenario delta — `engine/index.js`, `engine/buildModel.js`

$$
I = \mathrm{clip}_{[-1,1]}\left(\sum_s w_s F_s\right),
\qquad
\hat I = \mathrm{clip}_{[0,10]}\bigl(5 + 5I\bigr)
$$

$\hat I = 5$ is neutral: no net active operational effect. Above 5 is net adverse,
below 5 net mitigating.

**Scenario delta.** With $\mathcal{E}$ the baseline record set and $h$ a
hypothesised incident:

$$
\Delta \hat I = \hat I\bigl(\mathcal{E} \cup \{h\}\bigr) - \hat I\bigl(\mathcal{E}\bigr),
\qquad
\Delta F_s = F_s\bigl(\mathcal{E} \cup \{h\}\bigr) - F_s\bigl(\mathcal{E}\bigr)
$$

Under history review the baseline is the reviewed date's record set, not today's,
so the delta stays meaningful.

---

## 4. Order of operations

```
raw records
  │
  ├─ (1) INCIDENT DEDUPLICATION            engine/eventSource.js groupIncidents()
  │      group by incidentId; select the primary record deterministically
  │      (declared primary → highest severity → lowest id).
  │      DEDUPLICATION HAPPENS HERE. Updates and recovery reports carry no
  │      source mass; they inform the curated persistence profile.
  │
  ├─ (2) SIGNED SOURCE VECTOR              engine/eventSource.js incidentSourceVector()
  │      deduplicate stage ids                     ← DEDUPLICATION (stages)
  │      resolve exposure α (curated, or counted 1/k fallback)
  │      resolve direction d (mixed/unclassified ⇒ unscored)
  │      z = d · g(q) · α · R
  │      CLIP to [-1,1] per component               ← CLIPPING
  │
  ├─ (3) PERSISTENCE                        engine/persistence.js
  │      R evaluated at the incident's age; future-dated ⇒ R = 0
  │      (applied inside step 2; listed separately because it is the step
  │       that makes the field time-dependent at all)
  │
  ├─ (4) JOINT PROPAGATION                  engine/propagation.js
  │      split z into z⁺ and z⁻              ← SIGN SEPARATION (before propagation)
  │      per sign: x^d in topological order, CLIP [0,1] at each node   ← CLIPPING
  │                x^u in reverse topological order, CLIP [0,1]        ← CLIPPING
  │      p = clip[-1,1]( z + (x^d − z) + (x^u − z) )                   ← CLIPPING
  │      net the two signs: p = clip[-1,1](p⁺ − p⁻)      ← SIGN CANCELLATION (first time)
  │
  ├─ (5) INCIDENT AGGREGATION               engine/index.js operationalField()
  │      per stage, per sign: A({p⁺}), A({p⁻})
  │      F_s = clip[-1,1]( A⁺ − A⁻ )         ← SIGN CANCELLATION (second and final time)
  │      Only DISTINCT incidents reach this step — see (1).
  │
  ├─ (6) GEOGRAPHIC / COMPANY AGGREGATION   engine/index.js
  │      stage weights w_s NORMALIZED to sum to one   ← NORMALIZATION
  │      country local pressure: normalize by Σσ      ← NORMALIZATION
  │      country chain contribution: NOT normalized (it must sum to I)
  │      company contribution: renormalize over-allocated within-stage shares
  │      relative scores: divide by the snapshot maximum ← NORMALIZATION (snapshot-relative)
  │      headline index I = Σ w_s F_s                  ← WEIGHTING
  │
  └─ (7) SCENARIO DELTA                     engine/buildModel.js
         re-run (1)–(6) with the hypothesis appended, subtract.
         The scenario NEVER rewrites history: HISTORY is baseline-only.
```

**Where each operation happens, stated once:**

- **Deduplication** — incidents at (1), stage ids at (2), policy families before
  §3.8, and nowhere else.
- **Clipping** — per source component at (2), at every node of each channel at
  (4), on the combined per-incident field at (4), on the netted field at (5), and
  on every display score at (6). Never anywhere else.
- **Normalization** — edge allocations at matrix-build time, stage weights at
  (6), country local pressure at (6), over-allocated company shares at (6),
  snapshot-relative scores at (6).
- **Weighting** — only at (6). No weight is applied inside propagation.
- **Sign cancellation** — twice, both times explicitly: netting the two channels
  per incident at (4), and netting the two aggregates per stage at (5). Adverse
  and mitigating sources never cancel *before* propagation, because a recovery is
  not "less earthquake".

---

## 5. Parameter register

**Every parameter below is `status: assumption`.** These are **continuity priors
and stress assumptions**, not statistically estimated coefficients. The
low/base/high triples are **assumption bounds**: a range a reasonable analyst
might defend. They are **not confidence intervals, not credible intervals, and
not a probability distribution over the true value.** Nothing has been fit to
observed disruption outcomes; see §11 for what would have to happen first.

### 5.1 Continuous parameters

<!-- BEGIN GENERATED: parameter-table -->
| Parameter | Symbol | Low | Base | High | Valid domain | Units | Component | Status |
| --- | --- | ---: | ---: | ---: | --- | --- | --- | --- |
| `downstreamTransmission` | $f_d$ | 0.3 | 0.55 | 0.8 | `[0, 1)` | dimensionless | propagation.downstream | assumption |
| `upstreamTransmission` | $f_u$ | 0.1 | 0.3 | 0.5 | `[0, 1)` | dimensionless | propagation.upstream | assumption |
| `minimumDependencyFactor` | $\phi$ | 0.1 | 0.25 | 0.4 | `[0, 1]` | dimensionless | propagation.downstream | assumption |
| `acuteHalfLifeDays` | $H_a$ | 7 | 14 | 30 | `[0.5, 3650]` | days | persistence.acute_exponential | assumption |
| `marketHalfLifeDays` | $H_m$ | 21 | 45 | 90 | `[0.5, 3650]` | days | persistence.market_exponential | assumption |
| `outageRecoveryDays` | $T_r$ | 30 | 60 | 120 | `[1, 3650]` | days | persistence.outage_recovery | assumption |
| `rampingSiteWeight` | $w_{\mathrm{ramp}}$ | 0.25 | 0.5 | 0.75 | `[0, 1]` | dimensionless | facilities.footprint | assumption |
<!-- END GENERATED: parameter-table -->

<!-- BEGIN GENERATED: parameter-detail -->
#### `downstreamTransmission` — $f_d$

**Definition.** Per-RECEIVING-STAGE inherited-sensitivity multiplier. Under incoming-share normalization it caps how much dependency signal a buyer stage can inherit from all of its modeled inputs combined in one hop. It is NOT a globally conserved fraction of an incident: the same source reaches several buyers, so signal branches rather than being divided up.

**Assumption range.** low 0.3 · base 0.55 · high 0.8 (dimensionless); valid domain `[0, 1)`.

**Rationale.** Strictly below 1 so that the incoming coefficients AT ANY ONE STAGE sum to less than one. That bounds each stage individually and makes the per-stage recursion settle on a DAG; it does NOT bound the network-wide total, because a source branches to several buyers and the summed signal across stages can exceed the source magnitude. The base retains the v6 value for continuity; the range spans "inputs are largely substitutable within one hop" (0.30) to "a buyer stage is nearly wholly dependent on its modeled inputs" (0.80).

**Affects.** stage operational field; headline index; country measures; company criticality; network influence.

**Status.** `assumption` — a continuity prior and stress assumption, not a statistically estimated coefficient, and the range is not a confidence interval.

#### `upstreamTransmission` — $f_u$

**Definition.** Per-SUPPLYING-STAGE upstream-inheritance multiplier. Under outgoing-share normalization it caps how much demand-side echo a supplier stage inherits from all of its modeled buyers combined in one hop. Like f_d it is a per-stage cap, not a conserved share of the incident.

**Assumption range.** low 0.1 · base 0.3 · high 0.5 (dimensionless); valid domain `[0, 1)`.

**Rationale.** Held below the downstream coefficient because a supplier losing one buyer has more resale options than a buyer losing a specific input has substitutes; strictly below 1 for the same per-stage bound as f_d. Base retains the v6 value.

**Affects.** stage operational field; headline index; country measures; company criticality.

**Status.** `assumption` — a continuity prior and stress assumption, not a statistically estimated coefficient, and the range is not a confidence interval.

#### `minimumDependencyFactor` — $\phi$

**Definition.** Floor on the dependency multiplier, so a fully substitutable input (non-substitutability 0) still transmits a residual fraction phi of the downstream coefficient rather than exactly zero.

**Assumption range.** low 0.1 · base 0.25 · high 0.4 (dimensionless); valid domain `[0, 1]`.

**Rationale.** Renamed from the v6 `specificityFloor`, which read as a floor on specificity rather than on the dependency it produces. Substitution is never instant or free even for a commodity input, so a hard zero is the less defensible end; the range spans "substitution is cheap" to "substitution is slow even where alternatives exist".

**Affects.** downstream dependency matrix D; stage operational field; headline index.

**Status.** `assumption` — a continuity prior and stress assumption, not a statistically estimated coefficient, and the range is not a confidence interval.

#### `acuteHalfLifeDays` — $H_a$

**Definition.** Half-life in days of the acute_exponential persistence profile: the age at which a physical-disruption incident’s modeled source is half its day-zero value.

**Assumption range.** low 7 · base 14 · high 30 (days); valid domain `[0.5, 3650]`.

**Rationale.** Spans the observable restart span of a single-site physical outage: inspection-and-restart within a week at the fast end, a quarter-scale rebuild at the slow end. v6 used one 12-day half-life for every event class, which is exactly what this profile split replaces.

**Affects.** event source vector; stage operational field; headline index; history.

**Status.** `assumption` — a continuity prior and stress assumption, not a statistically estimated coefficient, and the range is not a confidence interval.

#### `marketHalfLifeDays` — $H_m$

**Definition.** Half-life in days of the market_exponential persistence profile, used for allocation, pricing and licensing-throughput incidents whose effect decays on a commercial rather than a physical timescale.

**Assumption range.** low 21 · base 45 · high 90 (days); valid domain `[0.5, 3650]`.

**Rationale.** Allocation and pricing shocks persist through contract and qualification cycles rather than through repair, so they decay markedly more slowly than acute outages; the range spans roughly one quarter-cycle to three.

**Affects.** event source vector; stage operational field; headline index; history.

**Status.** `assumption` — a continuity prior and stress assumption, not a statistically estimated coefficient, and the range is not a confidence interval.

#### `outageRecoveryDays` — $T_r$

**Definition.** Length in days of the linear ramp-down of the outage_recovery persistence profile, from the start of recovery to full restoration.

**Assumption range.** low 30 · base 60 · high 120 (days); valid domain `[1, 3650]`.

**Rationale.** Applies where a record states that restoration has begun but is staged. Linear rather than exponential because staged restarts are reported as a sequence of line restarts, not as a decay; the range spans a one-month to a four-month restoration programme.

**Affects.** event source vector; stage operational field; headline index.

**Status.** `assumption` — a continuity prior and stress assumption, not a statistically estimated coefficient, and the range is not a confidence interval.

#### `rampingSiteWeight` — $w_{\mathrm{ramp}}$

**Definition.** Operational weight of a site whose status is "ramping" when computing the modeled facility footprint. Operating sites are 1; idle and under-construction sites are 0.

**Assumption range.** low 0.25 · base 0.5 · high 0.75 (dimensionless); valid domain `[0, 1]`.

**Rationale.** A ramping line produces something but not at its steady-state rate, and the snapshot records no ramp curve, so the discount is a judgement. The range spans "barely started" to "nearly at rate"; the two endpoints of the status scale (0 and 1) are definitional, not assumptions.

**Affects.** modeled facility footprint; hazard stage exposure; hazard scenario delta.

**Status.** `assumption` — a continuity prior and stress assumption, not a statistically estimated coefficient, and the range is not a confidence interval.
<!-- END GENERATED: parameter-detail -->

### 5.2 Structural component weights

Sensitivity varies each **raw** weight by ±25% and then renormalizes the
**complete** vector, so the effective weights always sum to one.

<!-- BEGIN GENERATED: structural-weight-table -->
| Component | Symbol | Raw low | Raw base | Raw high | Effective base (renormalized) | Status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `networkInfluence` | $w^{\mathrm{struct}}_{\mathrm{NI}}$ | 0.1875 | 0.25 | 0.3125 | 0.2777778 | assumption |
| `geo` | $w^{\mathrm{struct}}_{\mathrm{geo}}$ | 0.15 | 0.2 | 0.25 | 0.2222222 | assumption |
| `policy` | $w^{\mathrm{struct}}_{\mathrm{pol}}$ | 0.15 | 0.2 | 0.25 | 0.2222222 | assumption |
| `nonSubstitutability` | $w^{\mathrm{struct}}_{\nu}$ | 0.1125 | 0.15 | 0.1875 | 0.1666667 | assumption |
| `market` | $w^{\mathrm{struct}}_{\mathrm{mkt}}$ | 0.075 | 0.1 | 0.125 | 0.1111111 | assumption |
<!-- END GENERATED: structural-weight-table -->

The v6 `shock` weight (raw 0.10) is **deleted**: it was declared but never read,
because the structural layer is event-free by construction.

### 5.3 Categorical model forms

A model form is a **different model**, not a different value of the same model.
Sensitivity reports them separately from the numerical parameters, and never
averages across them.

<!-- BEGIN GENERATED: model-form-table -->
| Model form | Options (**base** in bold) | Component | Status |
| --- | --- | --- | --- |
| `severityMapping` | **linear** · concave · convex | event source vector | assumption |
| `facilityScaleMapping` | equal · **linear** · convex | facilities.footprint | assumption |
| `incidentAggregation` | **bounded_union** · max · clipped_sum | incident aggregation | assumption |
| `hhiResidual` | **upper** · lower | structural.geo | assumption |
| `stageWeighting` | **turnover_normalized** · equal · log_turnover | aggregation.weights | assumption |
| `policyAggregator` | **bounded_union** · max · clipped_sum | structural.policy | assumption |
<!-- END GENERATED: model-form-table -->

<!-- BEGIN GENERATED: model-form-detail -->
#### `severityMapping`

**Definition.** Mapping from the displayed 1-10 ordinal severity rubric to a [0,1] modeled intensity.

**Options.** `linear` (base), `concave`, `convex`

**Rationale.** Severity is an ORDINAL human rubric, so no mapping to a cardinal intensity is calibrated, or even identifiable from the rubric alone. Linear is the continuity base because it is the v6 behaviour and the least committed of the three; concave (square root) and convex (square) bracket it monotonically and are reported as model-form cases.

**Affects.** event source vector; stage operational field; headline index.

#### `facilityScaleMapping`

**Definition.** Mapping from a site’s ordinal 1-5 `scale` field to a site weight in the modeled facility footprint.

**Options.** `equal`, `linear` (base), `convex`

**Rationale.** `scale` is an analyst ordinal, so ratios of its values are NOT observed production capacity and no mapping is calibrated. Linear w(k)=k is the continuity base (the v6 behaviour); equal w(k)=1 discards the ordinal entirely and convex w(k)=k^2 assumes large sites dominate, bracketing it.

**Affects.** modeled facility footprint; hazard stage exposure; hazard scenario delta.

#### `incidentAggregation`

**Definition.** Bounded operator combining the per-stage fields of DISTINCT, deduplicated incidents of the same sign.

**Options.** `bounded_union` (base), `max`, `clipped_sum`

**Rationale.** bounded_union, 1 - prod(1 - x_i), is the continuity base because it saturates rather than exceeding 1 and a second adverse incident can never reduce the total. It is a BOUNDED AGGREGATION OPERATOR, not an assumption of probabilistic independence: the incidents are not events in a probability space. max (only the largest incident counts) and clipped_sum (fully additive up to the bound) bracket it.

**Affects.** stage operational field; headline index; country measures.

#### `hhiResidual`

**Definition.** Which bound of the partially observed Herfindahl-Hirschman index to publish as the geographic-concentration score.

**Options.** `upper` (base), `lower`

**Rationale.** Disclosed country shares often sum to less than one. The LOWER bound (sum of squared observed shares) assumes the unobserved residual is infinitely fragmented; the UPPER bound adds the squared residual, i.e. assumes it is one undisclosed holder. The upper bound is the explicitly conservative base for a concentration measure; both are published and both enter sensitivity.

**Affects.** geographic concentration; structural vulnerability; country structural score.

#### `stageWeighting`

**Definition.** How the stage economic weights used by the headline index and the country chain contribution are derived from the stage turnover proxy.

**Options.** `turnover_normalized` (base), `equal`, `log_turnover`

**Rationale.** Turnover is an IMPORTANCE PROXY, not an additive loss base: supply-chain turnover is sequential, so summing it counts the same silicon at every stage. turnover_normalized (value_s divided by the total) is the base because it is the most direct reading of the proxy and sums to one by construction; equal (1/n) drops the proxy entirely and log_turnover compresses its skew, bracketing it.

**Affects.** headline index; country chain contribution; network influence.

#### `policyAggregator`

**Definition.** Bounded operator combining per-family policy severities into a stage policy-exposure score.

**Options.** `bounded_union` (base), `max`, `clipped_sum`

**Rationale.** Replaces the v6 record-count-driven "strongest + 0.4 times the sum of the rest", which grew without bound in the number of RECORDS and so rose when one control was re-reported. The family-level bounded union saturates at 10 and is invariant to duplicate records and revisions by construction.

**Affects.** policy exposure; structural vulnerability; country structural score.
<!-- END GENERATED: model-form-detail -->

### 5.4 Renamed concepts

| v6 name | v7 name | Why |
| --- | --- | --- |
| `subst` | `nonSubstitutability` | v6 called the field "substitutability" while using it with the opposite sense: a HIGH value means the stage is HARD to substitute. |
| `specificityFloor` | `minimumDependencyFactor` | It is a floor on the dependency the factor produces, not on specificity. |
| `choke` | `networkInfluence` | It is a modelled reachability measure, not a validated centrality metric. |
| `halfLifeDays` (one global) | `acuteHalfLifeDays`, `marketHalfLifeDays`, `outageRecoveryDays` | One half-life for every event class was the defect; persistence is now per-incident. |
| `contributionTolerance` | *(removed)* | v7 propagation is exact on a finite DAG. A display epsilon survives for formatting only. |

A compatibility adapter (`registry.adaptLegacyPriors`, `registry.adaptLegacyStage`)
reads stored v6 artefacts. **The v7 output surface, UI, formulas and documentation
use the unambiguous names throughout.**

---

## 6. Fallback and missing-data rules

Every fallback below emits a **machine-readable diagnostic** that the model audit
exposes (`engine.MODEL_AUDIT.counts`, reported by `npm run audit:data`), so a
fallback is always counted and never invisible.

<!-- BEGIN GENERATED: fallback-table -->
| Fallback rule | Machine-readable diagnostic | What happens |
| --- | --- | --- |
| Unresolved factual evidence | `factual_evidence_excluded` | Factual records require verified occurrence, explicit eligibility, claim-supporting source location and provenance, with evidence available by the evaluation date. Missing or unresolved claims produce no source. Confidence remains metadata. |
| Legacy 1/k stage exposure | `legacy_equal_stage_exposure` | An operational record with no curated exposure vector splits one unit of exposure equally across its k unique stages. Sums to exactly 1 by construction, so splitting or duplicating a scope cannot create source mass. |
| Curation disagrees with the record | `curated_exposure_stage_mismatch` | The curated exposure names no stage the record carries. The curation is ignored, the legacy 1/k allocation applies, and the mismatch is reported. |
| Curation names an extra stage | `curated_exposure_orphan_stage` | A curated stage absent from the record's own tags is dropped and reported; the remaining curated stages are used. |
| Duplicate stage tags | `duplicate_stage_tags` | Stage ids are deduplicated before the source vector is built, so a stage listed twice cannot change any number. |
| Missing temporal profile, active record | `missing_profile_active` | An operational record inside the 900-day curated horizon with no explicit profile. HARD FAILURE: the data audit exits non-zero. |
| Missing temporal profile, archived record | `missing_profile_archived` | An operational record outside the 900-day horizon with no explicit profile falls back to acute_exponential and is counted as a legacy diagnostic. |
| Country-only record | `country_only_event` | A record with countries but no defensible stage mapping is displayed and operationally unscored. |
| Mixed or unclassified direction | `unknown_direction_unscored` | A record whose direction is not explicitly adverse or mitigating produces no scalar field unless the curation supplies a signed stage decomposition. An unknown direction is never treated as adverse. |
| Several records, one incident | `incident_deduplicated` | Records sharing an incidentId are collapsed; only the primary record carries source mass. Updates and recovery reports inform the curated persistence profile and are displayed, never scored independently. |
| Equal edge allocation | `edge-allocation (diagnostics scope)` | Where no evidence-based dependency share exists for a node's inbound or outbound edges, an equal split is used and the node is named in an engine diagnostic. The shipped snapshot supplies no allocations, so every allocation in it is this fallback. |
| Incomplete market-share residual | `geo (diagnostics scope)` | Where disclosed country shares sum to less than one, the HHI is published as the interval [lower, upper] and the conservative upper bound is the base. The residual and the interval are reported per stage. |
| Duplicate policy records | `policy (diagnostics scope)` | Register rows resolving to the same policy family are collapsed before scoring; the strongest severity within a family stands, and the collapse count is reported. |
| Incomplete facility coverage / ordinal scale | `facility footprint` | Facility coverage is a curated sample: an empty radius means no site IN THE SAMPLE. Site weight is an ordinal mapping chosen from a declared model form, never observed capacity. The 5% threshold is a display preference and gates nothing the model computes. |
<!-- END GENERATED: fallback-table -->

### 6.1 Curation coverage

<!-- BEGIN GENERATED: curation-coverage -->
- Curated horizon: **900 days**. Every operational incident within it must carry an explicit stage-exposure vector and an explicit temporal profile, each with a recorded basis; a missing one is a hard audit failure.
- Explicitly curated incidents in this build: **30**.
- Factual eligibility is checked before fallback arithmetic. Eligible older records without curation use the equal 1/k exposure and acute_exponential profile; unresolved records remain excluded. Small current persistence says nothing about their potential historical influence. Replay uses the current model and network, with dated evidence availability; zero under missing coverage does not establish safety.
<!-- END GENERATED: curation-coverage -->

### 6.2 The two rules that are hard failures

1. An operational incident **inside** the curated horizon with **no explicit
   temporal profile** fails `npm run audit:data`.
2. An operational incident inside the curated horizon whose curated exposure
   names **no stage the record carries** fails `npm run audit:data`.

Everything else degrades to a documented fallback and is counted.

---

## 7. Worked numerical example

<!-- BEGIN GENERATED: worked-example -->
**Fixture.** Four stages in a reconvergent diamond, with country shares that sum to one at every stage.

| Stage | Turnover proxy | $\nu$ (0–10) | Country shares |
| --- | ---: | ---: | --- |
| `A` Materials | 10 | 8 | xx 0.6, yy 0.4 |
| `B` Fabrication | 40 | 6 | xx 1 |
| `C` Assembly | 20 | 4 | yy 1 |
| `D` Systems | 30 | 2 | xx 0.5, yy 0.5 |

Edges: `A→B`, `B→C`, `A→C`, `C→D`. Stage `C` is reconvergent: it is reached both directly from `A` and through `B`.

**Step 1 — normalized stage weights.** $w_s = \mathrm{value}_s / \sum_t \mathrm{value}_t$:

> A = 0.1, B = 0.4, C = 0.2, D = 0.3  (sum = 1 exactly)

**Step 2 — unit non-substitutability.** $\nu_a = \mathrm{nonSubstitutability}_a / 10$:

> A = 0.8, B = 0.6, C = 0.4, D = 0.2

**Step 3 — edge allocations.** No evidence-based allocations exist for this fixture, so the equal-split fallback applies (and is reported as a diagnostic):

> incoming $q$: q_{BA} = 1; q_{CB} = 0.5, q_{CA} = 0.5; q_{DC} = 1
> outgoing $r$: r_{AB} = 0.5, r_{AC} = 0.5; r_{BC} = 1; r_{CD} = 1

**Step 4 — dependency matrices.** $D_{ba} = f_d\,q_{ba}[\phi + (1-\phi)\nu_a]$ with $f_d = 0.55$, $\phi = 0.25$; $U_{ab} = f_u\,r_{ab}$ with $f_u = 0.3$:

> $D_{BA} = 0.55 \times 1 \times (0.25 + 0.75 \times 0.8) = 0.4675$
> $D_{CA} = 0.55 \times 0.5 \times (0.25 + 0.75 \times 0.8) = 0.23375$
> $D_{CB} = 0.55 \times 0.5 \times (0.25 + 0.75 \times 0.6) = 0.1925$
> $D_{DC} = 0.55 \times 1 \times (0.25 + 0.75 \times 0.4) = 0.3025$
> $U_{AB} = 0.3 \times 0.5 = 0.15$
> $U_{AC} = 0.3 \times 0.5 = 0.15$
> $U_{BC} = 0.3 \times 1 = 0.3$
> $U_{CD} = 0.3 \times 1 = 0.3$

**Step 5 — the incident.** Severity $q_e = 6$, age 14 days, profile `acute_exponential`, curated exposure $\alpha_{e,A} = 0.5$, $\alpha_{e,B} = 0.25$, direction adverse ($d = +1$).

> severity intensity: $g(6) = 6/10 = 0.6$
> persistence multiplier: $R(14) = 2^{-14/14} = 0.5$ — the record is exactly one half-life old

**Step 6 — the signed source vector.** $z_{e,s} = d\,g(q_e)\,\alpha_{e,s}\,R_e$:

> $z_{e,A} = 1 \times 0.6 \times 0.5 \times 0.5 = 0.15$
> $z_{e,B} = 1 \times 0.6 \times 0.25 \times 0.5 = 0.075$

Every other stage has $z = 0$: the incident is not tagged there.

**Step 7 — downstream channel**, in topological order, $x^d_b = \mathrm{clip}_{[0,1]}(z_b + \sum_{a \in IN(b)} D_{ba} x^d_a)$:

> A = 0.15, B = 0.145125, C = 0.0629990625, D = 0.0190572164

Stage `C` shows the reconvergence explicitly: $x^d_C = D_{CB}x^d_B + D_{CA}x^d_A = 0.1925 \times 0.145125 + 0.23375 \times 0.15 = 0.0629990625$ — a plain sum, with no independence correction.

**Step 8 — upstream channel**, in reverse topological order, $x^u_a = \mathrm{clip}_{[0,1]}(z_a + \sum_{b \in OUT(a)} U_{ab} x^u_b)$:

> A = 0.16125, B = 0.075, C = 0, D = 0

**Step 9 — direct-source deduplication.** $p_{e,s} = \mathrm{clip}_{[-1,1]}[z_s + (x^d_s - z_s) + (x^u_s - z_s)]$. Both channels start from $z$, so adding them naively would count the direct source twice at every sourced stage:

> $p_{e,A} = 0.15 + (0.15 - 0.15) + (0.16125 - 0.15) = 0.16125$
> $p_{e,B} = 0.075 + (0.145125 - 0.075) + (0.075 - 0.075) = 0.145125$
> $p_{e,C} = 0 + (0.0629990625 - 0) + (0 - 0) = 0.0629990625$
> $p_{e,D} = 0 + (0.0190572164 - 0) + (0 - 0) = 0.0190572164$

**Step 10 — incident aggregation.** One incident, so the bounded aggregation operator is the identity here and the final stage field is:

> A = 0.16125, B = 0.145125, C = 0.0629990625, D = 0.0190572164

**Step 11 — headline index.** $I = \sum_s w_s\,F_s$, then displayed as $5 + 5I$:

> $I = 0.1 \times 0.16125 + 0.4 \times 0.145125 + 0.2 \times 0.0629990625 + 0.3 \times 0.0190572164 = 0.092491977422$
> displayed index $= 5 + 5 \times 0.092491977422 = 5.462459887109$

**Step 12 — country measures.**

| Country | Local pressure | Chain contribution |
| --- | ---: | ---: |
| `xx` | 0.1197160039 | 0.0705835825 |
| `yy` | 0.0721198267 | 0.021908395 |

The chain contributions sum to 0.092491977422, which is the signed headline index exactly — because every stage's country shares sum to one in this fixture.

**Step 13 — scenario delta.** A second, DISTINCT incident on stage `C`: severity 8, on its own date so $R = 1$, curated exposure $\alpha = 0.4$, giving $z_{C} = 0.32$.

The two incidents are aggregated per stage with the bounded operator $1 - \prod_i (1 - x_i)$, applied separately by sign:

> baseline field: A = 0.16125, B = 0.145125, C = 0.0629990625, D = 0.0190572164
> scenario-only field: A = 0.0624, B = 0.096, C = 0.32, D = 0.0968
> combined field: A = 0.213588, B = 0.227193, C = 0.3628393625, D = 0.1140124779

> displayed index with the scenario $= 6.095038079287$
> **scenario delta** $= 6.095038079287 - 5.462459887109 = 0.632578192178$

Check stage `A`: $1 - (1 - 0.16125)(1 - 0.0624) = 0.213588$ — saturating, so the combined value stays below the sum 0.22365.

This example is generated from `app/src/engine/workedExample.js` by `npm run docs:generate` and asserted against the live engine by `app/src/docs/specDocs.test.js`. The fixture uses incident `worked_incident` and scenario `worked_scenario`.
<!-- END GENERATED: worked-example -->

---

## 8. Sensitivity and robustness

Produced by `npm run sensitivity`
(`app/scripts/build-sensitivity.mjs` → `docs/benchmarks/v7-sensitivity.json`).

### 8.1 The design

- **Numerical parameters.** The seven continuous registry parameters plus the
  five raw structural weights — 12 dimensions — sampled over their declared
  assumption box with **Saltelli's construction**, and summarized with the
  first-order and total-order **Sobol** estimators. The generator is a fixed-seed
  `splitmix32`; there is **no unseeded `Math.random` anywhere in the path**, so
  two runs over the same snapshot produce byte-identical output.
- **Model forms.** A **full factorial** over the six categorical choices,
  reported separately.
- **One-at-a-time diagnostics.** Each parameter taken to the ends of its own
  range with everything else at base. Cheap and readable, and strictly less
  informative than the Sobol indices because it cannot see interactions — which
  is why both are reported.

### 8.2 Continuous versus categorical

The Sobol decomposition applies to the **continuous** parameters, where a
variance over a sampled box is meaningful. It does **not** apply to the
categorical model forms: there is no metric on `{linear, concave, convex}` to
take a variance over. Model forms are reported as a **range across the
factorial**, with the per-form marginal spread.

### 8.3 What is reported

- **Assumption envelope** — the span of a published quantity across the box.
- **First-order and total-order influence** per continuous parameter.
- **One-at-a-time ranges**, with monotonicity flags.
- **Rank stability** — Spearman correlation of stage, structural, company and
  network-influence orderings against the base, plus **top-five membership
  frequency**.
- **Sign stability** for scenario deltas: the share of samples in which a
  scenario's delta keeps its sign.
- **Model-form results, separately** from the numerical results.

### 8.4 Why the envelope is not a confidence interval

**Uniform sampling over an assumption box is a computational design, not a
probability distribution over what is true.** The bounds are a person's judgement
about what is defensible. Nothing establishes that the truth lies inside them,
still less that it is uniformly distributed across them. Consequently:

- the reported spread is an **assumption envelope**, never a confidence,
  credible, or prediction interval;
- a Sobol index answers *"how much of the variation across this box does this
  parameter drive"* — a statement about the model's structure, not about the
  world;
- **rank stability is the finding that travels.** An ordering that survives the
  whole box does not rest on the coefficients, and that conclusion is robust in a
  way no point estimate here is.

---

## 9. Validation status

| Activity | Status | What it does and does not show |
| --- | --- | --- |
| **Unit and invariant testing** | **Complete** for the invariants listed in §3 and §4 | The implementation satisfies its stated bounds, monotonicities, determinism and deduplication rules. Says nothing about whether the model is right. |
| **Synthetic parameter recovery** | **Complete** | Three coefficients are recoverable under a synthetic, **correctly specified** data-generating process, and the optimization is implemented correctly. The DGP is the model. See [SYNTHETIC_PARAMETER_RECOVERY.md](computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md). |
| **Numerical reproducibility** | **Complete** | Fixed-seed designs and deterministic ordering; two builds over one snapshot are bit-identical. |
| **Global sensitivity analysis** | **Complete** | The assumption envelope and rank stability across the declared box, with model forms reported separately. |
| **Empirical calibration** | **NOT DONE** | No parameter has been estimated from observed disruption outcomes. Every parameter is `status: assumption`. |
| **External validation** | **NOT DONE** | No out-of-sample test against real incident outcomes exists, because no such outcome dataset has been assembled. |

**A model is not "validated" by passing its own unit tests, and synthetic
recovery is not validation.** Neither word is used for either activity anywhere
in this repository. The two rows that would justify the word are the two marked
NOT DONE.

---

## 10. v6 → v7 change log

v6 results are **preserved with their original model version** in
`docs/benchmarks/v6-frozen-benchmark.json`, captured from the v6 engine before
the redesign. The v7 numbers are **never spliced into v6 history**: any
recomputed history is labelled "v7 retrospective" and never implies it was
published contemporaneously. The measured comparison is in
`docs/benchmarks/v6-to-v7-benchmark.json` (`npm run benchmark`).

The v6 methodology is preserved, with a historical warning, in
[`docs/archive/v6/`](archive/v6/README.md).

| Change | Expected directional effect | Why |
| --- | --- | --- |
| **Continuous exposure scaling** | Lowers large hazard deltas, raises small ones | v6 gave a 5.01% footprint the same full-severity shock as 100%, and gave 4.99% nothing. Broad shallow radii shrink; narrow marginal ones stop vanishing. |
| **Removal of multi-stage full-shock multiplication** | Lowers the field at broadly tagged incidents | v6 injected the full severity independently at every tagged stage, so tagging one earthquake to four stages injected four full shocks. Tagging is metadata, not a multiplier. |
| **Incident-level (joint) propagation** | Lowers reconvergent stages | Within one incident, two paths reconverging on a stage are the same disruption arriving twice; v6 combined them as if independent. |
| **Removal of country double counting** | Lowers country readings for countries both tagged on an incident and hosting its stages | v6's `directSignals` combined a country-tagged incident's raw magnitude on top of the same incident's stage field. |
| **Event-specific persistence** | **Raises the headline index — the largest single contributor** | v6 decayed every class at one 12-day half-life, so standing controls and same-week inspections faded identically and almost nothing older than a quarter counted. Allocation and licensing effects now decay on a commercial timescale, outages decline along a staged recovery, and dated controls are in force or not. |
| **Revised policy aggregation** | Lowers policy exposure where several register rows covered one stage | v6's "strongest + 0.4 × the sum of the rest" grew without bound in the number of RECORDS and rose when one control was re-reported. |
| **HHI bounds** | **No change to the published base score** | v6 silently used what v7 calls the upper bound. What changed is that the reader can now see it is one end of an interval, and the lower bound is published beside it. |
| **Relative-score labelling** | No numerical change to the relative scores; reorders company criticality | Network influence and criticality are now labelled snapshot-relative, with the raw measure published beside them. Criticality additionally stopped applying topology twice, which does reorder companies. |
| **Stage weights normalized to sum to one** | Changes the headline weighting, no stage field | v6 weighted by a max-normalized log1p transform whose weights summed to an arbitrary number. Normalizing directly is what makes country chain contributions reconcile to the index. |
| **`contributionTolerance` removed** | Negligible, and now exactly zero error | The contraction bounds make the propagation exact on a finite DAG; truncation was never necessary and silently discarded small tail contributions. |

---

## 10b. v7.0 → v7.1 change log (migration note)

v7.0 results are preserved in
[`docs/benchmarks/v7-exposure-robustness-frozen-benchmark.json`](benchmarks/v7-exposure-robustness-frozen-benchmark.json),
frozen before this revision. v7.1 is a **minor model revision**: it changes one
published structural construct and corrects several descriptions. **No
operational-layer number changes** — the headline index, stage fields, country
measures and scenario deltas are identical between v7.0 and v7.1.

| # | Change | Kind | Effect |
| --- | --- | --- | --- |
| 1 | **Network influence excludes the source stage.** `NI_j` was $\sum_s w_s p_{j \to s}$ including $p_{j\to j}=1$; it is now $\sum_{s \ne j} w_s p_{j \to s}$. | **Formula** | Re-ranks the structural network component. Terminal stages fall (`m_ai` from rank 2 to zero reach); connective upstream stages rise. Changes structural vulnerability and country structural scores. |
| 2 | **`DirectFootprint` published separately** and kept out of the structural score. | **Formula** | Removes double counting of economic size, which entered both through the old NI and through `market`. |
| 3 | **v7.0 measure retained as `SYSTEM_WEIGHTED_REACH_INCLUDING_SOURCE`.** | Naming | Comparison only. Never called network influence. |
| 4 | **$f_d$ / $f_u$ redefined in words** as per-stage inheritance multipliers, not conserved shares. | **Interpretation** | No numerical change. The previous "cannot manufacture exposure" and "contraction" language was true per stage and false network-wide; the propagated field branches. |
| 5 | **Benchmark ablation label corrected** and the v6 weighting explanation restated as *effective log-turnover* rather than "weights that did not sum to one". | **Interpretation** | No numerical change to v7.1 outputs; the v6→v7 attribution prose is corrected. |
| 6 | **Sobol estimator reports raw, unclipped values** with replicate seeds, convergence and standard errors. | Reporting | Previous clipping presented estimator noise as exact. |
| 7 | **Event-curation uncertainty** analysed separately from parameter and model-form uncertainty. | Reporting | New third uncertainty class, previously unmeasured and implicitly zero. |
| 8 | **Legacy-assisted historical periods** marked and counted. | Reporting | Fallback incidents are no longer described as immaterial to every published number. |

## 11. Limitations and calibration roadmap

### 11.1 What is not known

- **No parameter is calibrated.** Every coefficient is a declared prior.
- **No edge allocation is evidence-based.** The shipped snapshot supplies none,
  so every $q_{ba}$ and $r_{ab}$ in it is the equal-split fallback, counted in the
  audit.
- **`scale` is an analyst ordinal.** Facility coverage is a curated sample; an
  empty radius means "no site in this sample", never "no site".
- **Severity is an ordinal rubric.** The mapping to a cardinal intensity is a
  declared model form and is not identifiable from the rubric alone.
- **Country shares are partly undisclosed.** The HHI is an interval for that
  reason, and the interval is published.
- **The graph is a curated abstraction.** 24 stages is a modelling choice, not a
  fact about the industry.

### 11.1b Four distinct classes of uncertainty, kept apart

A single "uncertainty" figure would merge four things that behave differently
and are fixed by different work. They are measured separately and never summed.

<!-- BEGIN GENERATED: public-review-results -->
Data revision **public-review-2026-09-06**, dataset **2026-09-04**, model **sscim-model-v7.1-exposure-robustness**.

Corrected factual-baseline headline: **5.084617** (previous audited fixture: **6.027797**). The movement is an evidence/data correction, not evidence of declining real-world risk.

| Uncertainty class | Current tested headline range | Scope |
| --- | --- | --- |
| Numerical parameters | [5.057073, 5.126671] | Registry ranges and fixed-seed Saltelli design; bootstrap and convergence retained |
| Model form | [5.054260, 5.174697] | Discrete form combinations |
| Curation | [5.046012, 5.123222] | 141 scenarios including baseline and opposing adverse/mitigating settings |
| Data coverage | No scalar interval | Unresolved incidents excluded; missing denominators and site coverage remain explicit |

These ranges are not additive, proven bounds over all allowed inputs, or statistical confidence intervals. Company criticality is structurally unaffected by event curation; this is not empirical validation. Numerical-parameter ranking sensitivity is conditional on fixed company priors and network.

Reproduce with `npm run curation` and `npm run sensitivity -- --samples 1024`. Current artifacts use the `-public-review.json` suffix; earlier benchmark files remain preserved.
<!-- END GENERATED: public-review-results -->

Curation sampling uses a declared shared scope coordinate, with opposing mitigating coordinates tested separately; related policy and memory episodes also have shared-assumption scenarios. No incident independence or empirical probability model is asserted. Sensitivity indices apply only to the specified ranges and design. See [research review](PUBLIC_RESEARCH_REVIEW.md).

### 11.2 What would have to exist to calibrate each parameter

| Parameter | Data required |
| --- | --- |
| $f_d$, $\phi$, $q_{ba}$ | Firm- or stage-level input dependence: bills of materials, qualified-supplier lists, or observed output responses at buyer stages following supplier-side outages, with the outage timing and magnitude independently recorded. |
| $f_u$, $r_{ab}$ | Supplier revenue or utilization responses following buyer-side demand shocks, with the shock independently dated. |
| $H_a$, $T_r$ | Restart timelines for physical outages: dated line-restart schedules or output series spanning the disruption and the recovery, across many incidents. |
| $H_m$ | Price, allocation and lead-time series spanning allocation and licensing events, with a defensible counterfactual baseline. |
| $\nu_a$ | Observed substitution behaviour: qualification times, second-source adoption rates, or measured elasticities. Currently an analyst ordinal. |
| $\alpha_{e,s}$, $w_{\mathrm{ramp}}$, ordinal scale mapping | Site-level capacity and utilization data, and observed output loss at named sites during recorded incidents. |
| Policy severities and aggregation | Measured trade or output responses to individual controls, and to controls in combination, so the family aggregator's form is chosen rather than assumed. |

### 11.3 The procedure that would have to be followed

Before **any** parameter may be promoted to `status: calibrated`:

1. **Real incident outcomes.** A dataset of observed disruption outcomes — output
   loss, price movement, lead-time change — dated and attributed to specific
   incidents, assembled independently of the model.
2. **Holdout incidents.** A pre-registered split, with the holdout set untouched
   during estimation.
3. **Honest uncertainty.** Profile likelihood or bootstrap intervals, not Wald
   intervals on synthetic data. The existing synthetic intervals hold **under the
   simulation only** and are labelled that way.
4. **Out-of-sample validation.** Predictive performance on the holdout,
   reported whether or not it is good, against a stated naive baseline.
5. **Registry promotion.** Only then may `status` change, and the estimate,
   its interval, its estimation procedure and its holdout performance must be
   recorded in the registry entry alongside it.

Until all five are satisfied, the honest description of every number in this
document is: **a bounded comparative exposure score computed from declared
assumptions, reproducible to the last digit, and uncalibrated.**

---

## Appendix A — where each formula lives

| Section | File |
| --- | --- |
| §3.1 source vector, incident grouping | `app/src/engine/eventSource.js` |
| §3.2 severity mappings | `app/src/engine/severity.js` |
| §3.3 facility footprint | `app/src/engine/facilities.js` |
| §3.4–3.5 dependency matrices, joint propagation | `app/src/engine/propagation.js` |
| §3.6 bounded aggregation | `app/src/engine/aggregation.js` |
| §3.7 temporal profiles | `app/src/engine/persistence.js` |
| §3.8 policy families | `app/src/engine/policy.js` |
| §3.8–3.9 HHI bounds, stage weights, rank statistics | `app/src/engine/math.js` |
| §3.8, §3.10–3.12 structural, country, company, index | `app/src/engine/index.js` |
| §3.12 scenario delta | `app/src/engine/buildModel.js` |
| §5 parameter register | `app/src/engine/registry.js` |
| §6 curated event model | `app/src/engine/event-model.js` |
| §7 worked example fixture | `app/src/engine/workedExample.js` |
| §8 global sensitivity | `app/src/engine/sensitivity.js`, `app/scripts/build-sensitivity.mjs` |

## Appendix B — verification run

<!-- BEGIN GENERATED: verification-run -->
Model `sscim-model-v7.1-exposure-robustness` · dataset `2026-09-04`. The commit and timestamp of the recorded run are in
[`docs/benchmarks/verification-run.json`](benchmarks/verification-run.json); they are deliberately not quoted here, because a
document that pins the commit it was generated at can never be up to date with the commit that contains it.

| Command | Result | Detail |
| --- | --- | --- |
| `server: npm ci` | pass | added 113 packages, and audited 114 packages |
| `app: npm ci` | pass | added 156 packages, and audited 157 packages |
| `app: npm run snapshot` | pass | (109 companies, 24 stages, 167 events) |
| `app: npm run audit:data` | pass | audit:data PASSED — 0 hard failures, 28 warning(s). |
| `app: npm run docs:verify` | pass | docs:verify PASSED — documentation and code agree. |
| `app: npm test` | pass | Test Files  55 passed (55) · Tests  1018 passed (1018) |
| `app: npm run build` | pass | Published 44 documentation page(s) + /docs/ index · 1096 equation(s) rendered · KaTeX css + 20 font(s). |
| `app: npm run smoke` | pass | 173/173 checks passed |
| `app: npm run sensitivity -- --samples 1024` | pass | design: 12 continuous dimensions x 1024 samples = 14336 model evaluations |
| `app: npm run benchmark` | pass | SKIPPED, and the committed comparison is left untouched. |
| `app: npm run demo` | pass | headline index 5.084617 · 158 incidents from 167 records |
<!-- END GENERATED: verification-run -->
