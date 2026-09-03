# SSCIM v7 — Calculation Walkthrough

**Model version:** `sscim-model-v7-exposure-robustness`

> **This document explains the calculation. It does not define it.**
> The canonical, authoritative definition of every formula, symbol,
> parameter and fallback is [**`docs/MODEL_V7_SPEC.md`**](MODEL_V7_SPEC.md).
> Where this page and the specification disagree, the specification is
> correct and this page is a defect — `npm run docs:verify` exists to catch
> exactly that. Nothing here defines a formula the specification does not.
>
> The **v6** calculation specification this replaces is preserved, with a
> historical warning, at
> [`docs/archive/v6/CALCULATION-v6.md`](archive/v6/CALCULATION-v6.md).

---

## Contents

1. [What is being calculated, and what it is not](#1-what-is-being-calculated-and-what-it-is-not)
2. [The seven steps, end to end](#2-the-seven-steps-end-to-end)
3. [Step 1 — incident deduplication](#3-step-1--incident-deduplication)
4. [Step 2 — the signed source vector](#4-step-2--the-signed-source-vector)
5. [Step 3 — persistence](#5-step-3--persistence)
6. [Step 4 — joint propagation](#6-step-4--joint-propagation)
7. [Step 5 — incident aggregation](#7-step-5--incident-aggregation)
8. [Step 6 — geographic and company aggregation](#8-step-6--geographic-and-company-aggregation)
9. [Step 7 — scenario delta](#9-step-7--scenario-delta)
10. [The structural layer](#10-the-structural-layer)
11. [Hazard scenarios and the facility footprint](#11-hazard-scenarios-and-the-facility-footprint)
12. [A fully worked number](#12-a-fully-worked-number)
13. [Where every formula lives](#13-where-every-formula-lives)

---

## 1. What is being calculated, and what it is not

Three deliberately separate layers, which never mix:

| Layer | Time-dependent? | What it answers |
| --- | --- | --- |
| **Structural baseline** | No | How exposed is this stage *before anything happens*? |
| **Operational event field** | Yes | What is the current set of recorded incidents doing to it? |
| **Scenario delta** | Yes, versus a stated baseline | What would this hypothesis change? |

Every published number is a **bounded comparative exposure score**. None of them
is a probability, a monetary loss, a forecast, an observed trade flow, a causal
estimate, or a calibrated risk estimate. See
[spec §1](MODEL_V7_SPEC.md#1-model-purpose-and-boundary) for the full boundary
statement.

**Confidence is metadata.** Every record carries a confidence label. It is
displayed and it drives no arithmetic. Two records identical except for
confidence produce identical numbers.

---

## 2. The seven steps, end to end

```
raw records
  → (1) incident deduplication
  → (2) signed source vector      z = d · g(q) · α · R
  → (3) persistence               R evaluated at the record's age
  → (4) joint propagation         x^d, x^u, then p with the source counted once
  → (5) incident aggregation      F_s, bounded, per sign, then netted
  → (6) geographic / company aggregation, and the headline index
  → (7) scenario delta
```

Clipping, normalization, weighting, deduplication and sign cancellation each
happen at exactly the points listed in
[spec §4](MODEL_V7_SPEC.md#4-order-of-operations), and nowhere else.

---

## 3. Step 1 — incident deduplication

**The question this answers:** five newspapers report one earthquake. Is that one
earthquake or five?

Records are grouped by `incidentId`. Within a group, exactly one record — the
**primary** — carries source mass. Updates and recovery reports are displayed,
keep their own source and their own assessment, and inform the curated
persistence profile, but they are **never independent shocks**.

The primary is chosen deterministically: the declared primary, else the most
severe record, else the lowest id. Never "whichever came first in the array",
because the order a bundle happens to serialize in is not a modelling decision.

**Why it matters.** The aggregation operator in step 5 is monotone: a second
adverse contribution can only raise the total. So if one earthquake arrived as
five records, it would read as five simultaneous disruptions and inflate the
index for something that happened once.

*Reference: [spec §4 step 1](MODEL_V7_SPEC.md#4-order-of-operations).*

---

## 4. Step 2 — the signed source vector

For incident $e$, stage $s$, at evaluation time $t$:

$$
z_{e,s}(t) = d_{e,s}\; g(q_e)\; \alpha_{e,s}\; R_e(t)
$$

Four separate things, each doing one job:

| Factor | What it is | Range |
| --- | --- | --- |
| $d_{e,s}$ | the **direction** — adverse $(+1)$ or mitigating $(-1)$ | $[-1,1]$ |
| $g(q_e)$ | the **intensity** — severity mapped from the ordinal rubric | $[0,1]$ |
| $\alpha_{e,s}$ | the **stage exposure** — how much of the stage is touched | $[0,1]$ |
| $R_e(t)$ | the **persistence** — how much is still live at $t$ | $[0,1]$ |

### 4.1 Direction

Adverse gives $+1$, mitigating gives $-1$. A `mixed` or `unclassified` direction
produces **no scalar field at all**, unless the curation supplies an explicit
signed per-stage decomposition.

**An unknown direction is never treated as adverse.** Guessing "probably bad" is
how a model acquires a pessimism bias nobody declared and nobody can audit.

### 4.2 Intensity: severity is ordinal

The 1–10 severity rubric establishes that a 7 is worse than a 5. It does **not**
establish that a 7 is 1.4 times as bad, and no data in this project could,
because the rubric is the only measurement. Everything downstream is cardinal
arithmetic, so a mapping has to be chosen — and that choice is a declared
**model form**, reported separately in sensitivity, never called calibrated:

$$
g_{\mathrm{linear}}(q) = \frac{q}{10},
\qquad
g_{\mathrm{concave}}(q) = \sqrt{\frac{q}{10}},
\qquad
g_{\mathrm{convex}}(q) = \left(\frac{q}{10}\right)^{2}
$$

`linear` is the base. All three agree at $q = 0$ and $q = 10$ and are monotone
between, so swapping between them can reorder magnitudes but can never change a
sign or leave $[0,1]$.

### 4.3 Stage exposure

$\alpha_{e,s}$ says **how much of stage $s$ this incident actually touches**. It
is an analyst's reading of the record, and every curated value carries a recorded
basis naming what in the record supports it.

Stage ids are **deduplicated before** the vector is built, so a stage tagged
twice cannot change any number.

Where no curated exposure exists, a **counted fallback** splits one unit of
exposure equally across the $k$ unique stages: $\alpha = 1/k$. It sums to exactly
one by construction, which is the property that makes splitting a scope in two,
or tagging the same incident more thoroughly, unable to create source mass. Every
use of it is reported as a diagnostic.

---

## 5. Step 3 — persistence

$R_e(t) \in [0,1]$ scales the source by how much of the incident is still live at
the evaluation date. It never changes a sign and never exceeds 1.

A record dated in the **future** gives $R = 0$ under every profile, with no
exceptions: an incident must not contribute to the index before its own date.

| Profile | Shape | Used for |
| --- | --- | --- |
| `acute_exponential` | $2^{-\mathrm{age}/H_a}$ | Physical disruption with no recorded restart schedule |
| `market_exponential` | $2^{-\mathrm{age}/H_m}$ | Allocation, pricing, licensing throughput |
| `persistent_policy` | 1 inside a dated window, 0 outside | A control that is in force until superseded |
| `outage_recovery` | 1, then linear to 0 over $T_r$ | A staged restart that has begun |
| `strategic_context` | 0 always | Long-horizon signals: displayed, unscored |

**Why five and not one.** A standing revocation and a same-week inspection halt
are not the same shape of thing. Treating them identically — as the previous
model did, with one 12-day half-life for every class — made a rule in force score
a fifth of its own severity a month after it took effect, while a fab that
restarted in three days kept most of its weight for a fortnight.

**Why `persistent_policy` is used sparingly.** A standing regulatory regime's
ongoing burden belongs to the **structural** policy layer. Representing it in
both layers would count the same control twice. So a record whose regime is
already in the standing register is given `market_exponential` — modelling the
*adjustment* to the rule, which does fade — and `persistent_policy` is reserved
for records that carry their own dated in-force window.

---

## 6. Step 4 — joint propagation

### 6.1 The dependency matrices

For each edge $a \to b$:

$$
D_{ba} = f_d\; q_{ba}\;\bigl[\phi + (1-\phi)\,\nu_a\bigr],
\qquad
U_{ab} = f_u\; r_{ab}
$$

$q_{ba}$ and $r_{ab}$ are **normalized edge allocations**: $b$'s inbound shares
sum to one, and $a$'s outbound shares sum to one. Where no evidence-based
allocation exists — which is every edge in the shipped snapshot — an equal split
is used **and reported**.

$\nu_a$ is stage $a$'s non-substitutability on $[0,1]$: the harder an input is to
substitute, the more of a supplier-side disruption a buyer feels. $\phi$ is the
floor, so a fully substitutable input still transmits a residual fraction rather
than exactly zero — substitution is never instant or free.

**The bound that makes everything else work.** Because the allocations are a
partition of one and the bracket is at most one:

$$
\sum_{a \in \mathrm{IN}(b)} D_{ba} \le f_d < 1,
\qquad
\sum_{b \in \mathrm{OUT}(a)} U_{ab} \le f_u < 1
$$

The propagation is therefore a **contraction**: finite, bounded, and
order-independent on any DAG. No truncation tolerance is needed, and none is
used.

### 6.2 The two channels

Split the signed source into a nonnegative adverse vector and a nonnegative
mitigating vector. For each sign, propagate the **whole incident source vector at
once**:

$$
x^{d}_{b} = \mathrm{clip}_{[0,1]}\!\left( z_b + \sum_{a \in \mathrm{IN}(b)} D_{ba}\,x^{d}_{a} \right)
\quad\text{(topological order)}
$$

$$
x^{u}_{a} = \mathrm{clip}_{[0,1]}\!\left( z_a + \sum_{b \in \mathrm{OUT}(a)} U_{ab}\,x^{u}_{b} \right)
\quad\text{(reverse topological order)}
$$

### 6.3 Counting the direct source once

$$
p_{e,s} = \mathrm{clip}_{[-1,1]}\Bigl[\, z_s + (x^{d}_{s} - z_s) + (x^{u}_{s} - z_s) \,\Bigr]
$$

Both channels **start from $z$**, so adding them naively would count the direct
source twice at every sourced stage. Subtracting $z$ from each channel's
contribution removes exactly that duplication.

### 6.4 Reconvergence is a sum, not an independence correction

When two paths of the **same incident** meet at a stage, that is one disruption
arriving twice — not two independent causes. The inflows are summed and clipped
once. The multiplicative $1-(1-x)(1-y)$ form is not applied, because the
interaction term it introduces has nothing within a single incident to represent.

---

## 7. Step 5 — incident aggregation

Across **distinct, deduplicated** incidents, at each stage, aggregate the two
signs separately and then net:

$$
F_s = \mathrm{clip}_{[-1,1]}\Bigl( A\bigl(\{p^{+}_{e,s}\}\bigr) - A\bigl(\{p^{-}_{e,s}\}\bigr) \Bigr)
$$

with $A$ one of three bounded operators:

$$
A_{\mathrm{bounded\_union}}(x) = 1 - \prod_i (1-x_i),
\qquad
A_{\max}(x) = \max_i x_i,
\qquad
A_{\mathrm{clipped\_sum}}(x) = \min\Bigl(1, \textstyle\sum_i x_i\Bigr)
$$

`bounded_union` is the base. **It is a bounded aggregation operator, not a
probabilistic combination.** It is used for two properties of the *score* — a
second adverse incident never lowers the total, and the total never leaves
$[0,1]$ — and for continuity with the previous model. It encodes no assumption
that incidents are independent, because the inputs are not events in a
probability space.

Signs are aggregated separately so that a mitigating incident **offsets** an
adverse one rather than cancelling inside the bounded operator, where the order
of the inputs would change the answer.

---

## 8. Step 6 — geographic and company aggregation

### 8.1 Stage weights

$$
w_s = \frac{V_s}{\sum_t V_t}, \qquad \sum_s w_s = 1
$$

Normalized **directly** to sum to one, which makes the headline index a plain
weighted mean and makes the country contributions below reconcile to it exactly.

**Turnover is an importance proxy, not a loss base.** Supply-chain turnover is
sequential: the same wafer is counted at the wafer stage, again at the fab stage,
and again at packaging. Summing it is not an economic aggregate, and no output
derived from it is money. Equal and log-turnover weighting are available as
sensitivity modes.

### 8.2 The headline index

$$
I = \sum_s w_s\,F_s, \qquad \hat I = 5 + 5I
$$

$\hat I = 5$ is neutral. Above 5 is net adverse, below 5 net mitigating.

### 8.3 Two country measures, kept apart

| Measure | Formula | The question it answers |
| --- | --- | --- |
| **Local pressure** | $L_c = \dfrac{\sum_s \sigma_{c,s} F_s}{\sum_s \sigma_{c,s}}$ | How hard is the part of the chain sitting *here* being squeezed? |
| **Chain contribution** | $K_c = \sum_s \sigma_{c,s}\,w_s\,F_s$ | How much of the headline number *is* this country? |

Local pressure is normalized over the country's own modeled footprint, so it is
comparable between countries and says nothing about how much of the chain that
country holds. Chain contribution is deliberately **not** normalized, which is
what makes $\sum_c K_c = I$ wherever country shares are fully disclosed.

There is **no direct country signal**. An incident reaches a country's output
through its stage source and propagation, **exactly once**.

### 8.4 Company measures

Three deliberately distinct numbers:

- **Vulnerability** — share-independent: the mean adverse impact across the
  stages the company is present in.
- **Contribution** — share-weighted: a larger stage share at the same impact
  level produces a larger contribution.
- **Criticality** — "if this company were fully disrupted": its stakes are
  injected as **one joint source vector**, propagated in both directions, and
  weighted by the **economic** weight.

**Topology is applied exactly once** in criticality. Weighting the propagated
field by network influence — itself a propagation-derived reachability measure —
would reward a company on a well-connected stage twice for the same
connectivity.

### 8.5 Relative scores are snapshot-relative

Network influence and company criticality are published as **both**:

- a **raw** measure, comparable across snapshots;
- a **0–10 snapshot-relative** score, divided by the largest raw value *in this
  snapshot*.

The 0–10 score orders things within one snapshot and nothing else: the
denominator changes when the company set or the graph does. It is labelled
"snapshot-relative" everywhere it appears.

---

## 9. Step 7 — scenario delta

$$
\Delta \hat I = \hat I\bigl(\mathcal{E} \cup \{h\}\bigr) - \hat I\bigl(\mathcal{E}\bigr)
$$

The hypothesis $h$ runs through the identical source-vector and propagation path
every recorded incident uses, so its delta is comparable with the index it
modifies. Under history review the baseline is the reviewed date's record set,
not today's. A scenario **never rewrites history**: the published history series
is baseline-only.

---

## 10. The structural layer

Time-invariant and **event-free by construction** — there is no shock term, and
the previous model's declared-but-never-read `shock` weight is deleted.

$$
\mathrm{Struct}_s = w^{\mathrm{struct}}_{NI}\,NI_s
+ w^{\mathrm{struct}}_{\mathrm{geo}}\,GEO_s
+ w^{\mathrm{struct}}_{\mathrm{pol}}\,POL_s
+ w^{\mathrm{struct}}_{\nu}\,(10\nu_s)
+ w^{\mathrm{struct}}_{m}\,m_s
$$

with the five weights summing to one.

### 10.1 Geographic concentration is an interval

Disclosed country shares often sum to less than one, and the concentration of the
unobserved residual is **not identified by the data**. A single HHI number would
be a choice presented as a measurement, so both ends are published:

$$
\mathrm{HHI}^{-}_s = \sum_c \sigma_{c,s}^{2}
\qquad
\mathrm{HHI}^{+}_s = \mathrm{HHI}^{-}_s + \Bigl(1 - \textstyle\sum_c \sigma_{c,s}\Bigr)^{2}
$$

The lower bound assumes the residual is infinitely fragmented; the upper bound
assumes it is one undisclosed holder. Both are correct bounds. The **upper bound
is the explicitly conservative published base**, and both enter sensitivity.

### 10.2 Policy exposure is family-deduplicated

Register rows are first collapsed into **policy families**; within a family only
the strongest severity counts. Families are then combined with a bounded operator
that saturates at 10.

**Adding a duplicate report, or a revision, cannot raise a stage's policy
exposure.** That is true by construction, not by convention — which is the point,
because the previous formula was driven by how many *rows* the register happened
to contain.

---

## 11. Hazard scenarios and the facility footprint

A hazard is a coordinate, a radius and an operator-supplied severity. The
geometry says **what is exposed**; the severity says **how hard it was hit**.
Neither substitutes for the other.

$$
\alpha_{e,s} = \frac{\sum_{\text{sites of } s \text{ inside the radius}} w(\text{site})}
                     {\sum_{\text{sites of } s} w(\text{site})}
$$

This is the **modeled facility footprint**: a share of the modeled *site sample*.
It is not capacity share, not output, and not physical damage.

$$
w(\text{site}) = \mathrm{map}(\text{scale}) \cdot \mathrm{status}(\text{site})
$$

`scale` is an **analyst ordinal on 1–5**. Ratios of its values are not observed
production capacity, and the ordinal-to-weight mapping (`equal`, `linear`,
`convex`) is a declared model form. Operating sites weigh 1; idle and
under-construction sites weigh 0 — they have no output to lose. The ramping
discount is a registry parameter, stress-tested over its declared range.

**Exposure is continuous.** Zero footprint gives exactly zero source; a larger
footprint never gives a smaller shock; and 5.01% does not receive the same shock
as 100%. The 5% line is a **display threshold** that dims a row in the readout
and gates nothing the model computes.

*The previous model refused to shock a stage below 5% and shocked it at full
severity above 5%, so 4.99% did nothing and 5.01% did everything — see
[spec §10](MODEL_V7_SPEC.md#10-v6--v7-change-log).*

---

## 12. A fully worked number

A complete, reproducible arithmetic walkthrough — from the source vector through
both channels, direct-source deduplication, the final stage field, the country
contributions and a scenario delta — is
[**§7 of the specification**](MODEL_V7_SPEC.md#7-worked-numerical-example).

It is **generated from the live engine** by `npm run docs:generate`, from the
frozen fixture in `app/src/engine/workedExample.js`, and asserted against the
engine by `app/src/docs/specDocs.test.js`. A formula change the documentation
does not follow fails CI.

---

## 13. Where every formula lives

| Concept | File |
| --- | --- |
| Incident grouping, source vector | `app/src/engine/eventSource.js` |
| Severity mappings | `app/src/engine/severity.js` |
| Temporal profiles | `app/src/engine/persistence.js` |
| Dependency matrices, joint propagation | `app/src/engine/propagation.js` |
| Bounded aggregation operators | `app/src/engine/aggregation.js` |
| Policy families | `app/src/engine/policy.js` |
| HHI bounds, stage weights, rank statistics | `app/src/engine/math.js` |
| Facility footprint | `app/src/engine/facilities.js` |
| Structural, country, company, headline index | `app/src/engine/index.js` |
| Scenario delta | `app/src/engine/buildModel.js` |
| Parameter registry | `app/src/engine/registry.js` |
| Curated event model | `app/src/engine/event-model.js` |
| Global sensitivity | `app/src/engine/sensitivity.js` |

**Parameter values are not repeated on this page.** They are published once, in
[spec §5](MODEL_V7_SPEC.md#5-parameter-register), generated directly from
`app/src/engine/registry.js`, so a coefficient cannot change in the code without
the published table changing with it.
