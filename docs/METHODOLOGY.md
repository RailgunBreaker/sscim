# SSCIM methodology

**Model version:** `sscim-model-v7.1-exposure-robustness`

This document describes what the engine in `app/src/engine/` computes, for a
reader who wants the reasoning rather than the reference. No formula here is
aspirational or simplified for exposition.

> **The canonical definition is [`docs/MODEL_V7_SPEC.md`](MODEL_V7_SPEC.md).**
> Every symbol, formula, parameter range and fallback rule is defined there,
> once. This page explains *why* the model is shaped that way; it defines
> nothing the specification does not, and where the two disagree the
> specification is correct. `npm run docs:verify` fails the build on drift.

Related reading: the [calculation walkthrough](calculation.md) for the steps in
order; the [reference library](reference/README.md) for where each input came
from; the [model roadmap](MODEL_ROADMAP.md) for what would have to be true before
any of it could be called calibrated. The superseded **v6** methodology is
preserved, with a historical warning, in
[`docs/archive/v6/`](archive/v6/README.md).

---

## Purpose and model boundary

SSCIM is a **deterministic comparison and sensitivity environment** over a
versioned semiconductor supply-chain snapshot. It asks how a recorded incident or
a hypothesised shock would move through a declared graph. It does not estimate
the chance, size, or timing of real-world losses, and it produces no forecast.

Its outputs are **bounded comparative exposure scores**. They are not
probabilities, not monetary losses, not observed trade flows, not causal
estimates, and not calibrated risk estimates. The full boundary statement is
[spec §1](MODEL_V7_SPEC.md#1-model-purpose-and-boundary).

Three layers, kept separate because blending them would give one number that
moves for incompatible reasons with no way for a reader to tell which:

| Layer | Time-dependent | What it is |
| --- | --- | --- |
| **Structural vulnerability** | No | What is fragile about this part of the chain regardless of what happened this week. |
| **Operational event field** | Yes | What the currently recorded incidents are doing to it. |
| **Scenario delta** | Versus a stated baseline | What one hypothesis would change. |

**Confidence and evidence quality are metadata.** They are displayed. They never
multiply a modelled effect. Two records identical except for confidence produce
identical numbers — asserted in `app/src/engine/eventSource.test.js`.

---

## The five decisions that define v7

Everything else follows from these. Each replaced a specific defect; each is
stated as a design decision rather than as a formula, because the formulas are in
the specification.

### 1. An incident is a thing that happened, not a set of records about it

Records are grouped by incident before anything is scored, and only the primary
record of a group carries source mass. Five newspapers reporting one earthquake
is one earthquake.

*Why it matters.* The aggregation operator is monotone: a second adverse
contribution can only raise the total. Without deduplication, a well-covered
disruption reads as several simultaneous ones.

### 2. Tagging is metadata, not a multiplier

An incident's severity is distributed across the stages it touches by an explicit
**stage exposure** $\alpha_{e,s} \in [0,1]$, curated with a recorded basis.

*Why it matters.* The previous model injected the full severity independently at
every tagged stage, so tagging one earthquake to four stages injected four
full-severity shocks and the same disruption hit harder the more carefully it was
described. Where no curated exposure exists, a counted $1/k$ fallback splits one
unit of exposure across the $k$ unique stages — so splitting or duplicating a
scope cannot create source mass.

### 3. Persistence is a property of the incident, not of the model

Five explicit temporal profiles — acute exponential, market exponential,
persistent policy, outage recovery, strategic context — each with a recorded
basis pointing at dates in the record itself.

*Why it matters.* One global half-life for every event class meant a standing
export-control revocation and a same-week fab inspection decayed identically. A
rule in force scored a fifth of its own severity a month after it took effect.

A note on double counting: a standing regulatory regime's ongoing burden belongs
to the **structural** policy layer. So `persistent_policy` is reserved for
records carrying their own dated in-force window; a record whose regime is
already in the standing register gets `market_exponential`, modelling the
*adjustment* to the rule, which does fade.

### 4. One incident propagates once, jointly

The whole source vector of one incident is propagated in a single pass, and
reconvergent paths are summed.

*Why it matters.* Within one incident, two paths meeting at a stage are the same
disruption arriving twice — not two independent causes. Combining them with a
multiplicative independence correction adds an interaction term with nothing to
represent.

The bound that makes this work: because the edge allocations are a partition of
one at each node and both transmission coefficients are strictly below 1, the
incoming coefficients at any node sum to less than one. That bounds **each stage
individually**, so the recursion settles on a DAG, every value stays inside its
clip, and no truncation tolerance is needed.

It bounds nothing network-wide. The two coefficients are per-stage inheritance
multipliers rather than shares of a conserved quantity, so a source feeding
several buyers makes the signal **branch**: the summed field across stages
routinely exceeds the source magnitude, while no stage exceeds its own bound.
The propagated field is a dependency signal, not a mass.

### 5. Exposure is continuous

A hazard's effect on a stage is proportional to the **modeled facility
footprint** inside the radius. Zero footprint gives exactly zero. A larger
footprint never gives a smaller shock. 5.01% does not receive the same shock as
100%.

*Why it matters.* A 5% scoring threshold made 4.99% do nothing and 5.01% do
everything, which is a cliff in the middle of a screening tool. The 5% line
survives as a **display** preference that dims a row in the readout.

---

## Structural layer

Time-invariant and **event-free by construction**. Five components, weights
summing to one; there is no shock term, and the v6 declared-but-never-read
`shock` weight is deleted.

### Network influence

Inject a unit adverse shock at one stage, propagate downstream over the whole
DAG, weight the affected stages by their normalized economic weight, and sum.

This is a **modelled sensitivity proxy** — not a centrality metric with
established properties, and not a measure of realized economic loss. It replaced
a raw path-count "chokepoint centrality" that was sensitive to how the graph
happened to be drawn: adding an unrelated parallel path moved a node's score
without changing anything about how disruptive it actually is.

The published 0–10 figure is **snapshot-relative**: it is divided by the largest
raw value *in this snapshot*, so it orders stages within one snapshot and is not
comparable across snapshots. The raw measure is published beside it for exactly
that reason.

### Geographic concentration

Disclosed country shares often sum to less than one, and the concentration of the
**unobserved residual is not identified by the data**. A single HHI number would
be a choice presented as a measurement, so the model publishes both ends of the
interval: the lower bound treats the residual as infinitely fragmented, the upper
bound treats it as one undisclosed holder. Both are correct bounds. The upper
bound is the explicitly conservative published base, and both enter sensitivity.

### Policy exposure

Register rows are collapsed into **policy families** first; within a family only
the strongest severity counts; families are then combined with a bounded operator
that saturates at 10.

*Why it changed.* The previous formula — strongest instrument plus a discounted
sum of the rest — was driven by how many *rows* the register happened to contain.
Filing the same control twice, or logging a revision of it, raised a stage's
structural score without anything changing in the world, and with enough rows
every stage saturated regardless of severity. Under v7, invariance to duplicate
records is true by construction rather than by convention.

---

## Directional dependence

Two matrices, because the two directions measure genuinely different things:

- **Downstream** — how much a buyer stage's output depends on a supplier stage,
  from the normalized inbound allocation and the supplier's non-substitutability.
- **Upstream** — the demand-side echo a supplier feels when a buyer is
  disrupted, from the normalized outbound allocation.

The upstream coefficient is held below the downstream one because a supplier
losing one buyer has more resale options than a buyer losing a specific input has
substitutes.

**Neither is a measured input–output coefficient or a bilateral trade value.** No
facility-level, bill-of-materials, or inventory dataset exists here to build one.
Both are transparent priors built from graph structure and the one analyst
judgement the dataset already carries. Edge thickness in the flow graph renders
the downstream coefficient and is labelled "modeled input-dependence weight
(prior)" — never "value flow" or "trade intensity".

This distinction matters in practice. A supplier's sales share to a customer is
not the customer's input dependence on that supplier: ASML → TSMC at some
percentage of ASML's sales does not mean TSMC is that percentage dependent on
ASML for EUV, where the real dependence is closer to complete.

**Where evidence-based edge allocations are unavailable — which is every edge in
the shipped snapshot — an equal split is used and reported** as a counted
diagnostic, not presented as evidence.

---

## Operational layer

### Severity is ordinal

The 1–10 rubric establishes that a 7 is worse than a 5 and nothing more. Mapping
it to a cardinal intensity is a declared **model form** with three monotone
options, reported separately in sensitivity, and never called calibrated.

### Direction is explicit

An incident with a `mixed` or `unclassified` direction produces **no scalar
field**, unless the curation supplies an explicit signed per-stage decomposition.
An unknown direction is never treated as adverse: guessing "probably bad" is how
a model acquires a pessimism bias nobody declared and nobody can audit.

### Combining distinct incidents

Adverse and mitigating contributions are aggregated **separately** and then
netted, with a bounded operator whose base form saturates at 1 and is monotone in
each contribution.

**It is a bounded aggregation operator, not a probabilistic combination.** It is
used for two properties of the *score* — a second adverse incident never lowers
the total, and the total stays in range — and for continuity with v6. It encodes
no assumption that incidents are independent, because the inputs are not events
in a probability space. `max` and clipped-sum are the two declared alternatives
and both are reported in model-form sensitivity.

Splitting by sign before aggregating means a recovery **offsets** a disruption
rather than cancelling inside the bounded operator, where the order of the inputs
would change the answer.

---

## Aggregation

### The headline index

A plain weighted mean of the stage field, with weights that are a **partition of
one**. Turnover is an **importance proxy, not a loss base**: supply-chain
turnover is sequential, so the same wafer is counted at the wafer stage, again at
the fab stage, and again at packaging. Summing it is not an economic aggregate,
and no output derived from it is money. Equal and log-turnover weighting are
available as sensitivity modes.

### Two country measures

**Local pressure** is normalized over the country's own modeled stage footprint:
*how hard is the part of the chain sitting here being squeezed?* It is comparable
between countries and says nothing about how much of the chain that country
holds.

**Chain contribution** is deliberately unnormalized: *how much of the headline
number is this country?* Because country shares sum to one at each fully
disclosed stage, the chain contributions reconcile to the headline index exactly.

There is **no direct country signal**. The v6 model combined a country-tagged
incident's raw magnitude on top of the same incident's stage field, so an
incident counted twice for any country it was both tagged to and hosted stages
for. In v7 an incident reaches a country through its stage source and
propagation, exactly once.

Country results are **production geography**, not headquarters. Headquarters is
displayed separately and labelled "HQ:", never substituted for production
exposure.

### Company measures

Three separately labelled numbers, never blended, because a small and a large
single-stage company can share a vulnerability but never a contribution:

- **Vulnerability** — share-independent: the mean adverse impact across the
  stages the company occupies.
- **Contribution** — share-weighted: a larger stake at the same impact level
  always yields a larger contribution. An earlier formula divided by the sum of
  company shares, which made market share cancel algebraically for any
  single-stage company.
- **Criticality** — "if this company were fully disrupted": its stakes are
  injected as **one joint source vector**, propagated in both directions, and
  weighted by the **economic** weight.

**Topology is applied exactly once** in criticality. v6 propagated across the
graph and then weighted the result by network influence, which is itself a
propagation-derived reachability measure — so a company on a well-connected stage
was rewarded twice for the same connectivity.

As with network influence, the 0–10 criticality figure is **snapshot-relative**
and the raw value is published beside it.

---

## The site layer

Below the country layer sits a site layer of named plants covering every modeled
company. It carries location and output, **not capacity**: a site's weight is a
1–5 analyst ordinal mapped through a declared model form and discounted by
operating status, so every share it produces is a share of the *modeled site
sample*, never of world capacity.

Its purpose is the step a country marker cannot perform: resolving a hazard at a
coordinate into named plants and the stages they feed. The resulting shock is
handed to the ordinary scenario path and propagates through the identical engine.
Nothing in the site layer alters the propagation mathematics.

Sites are connected by a **derived** network composed from company-level customer
edges and the stage flow graph, introducing no coefficient not already declared.
Links whose commercial direction opposes the physical one (an OSAT invoicing a
fabless designer whose die flows *toward* it) are retained and marked as service
relationships. It is a modelled link set, not a shipment route: no dataset here
records which plant ships to which plant, and it is never an engine input.

---

## Computed history

The sparkline, multi-year chart and movers list re-run the operational
computation at each past offset and re-propagate — never using the reader's
clock. At $t$ days before the snapshot an incident's age is $(\text{daysAgo} -
t)$; a record with negative age had not happened yet and is excluded, so each
incident first appears at full persistence on its own date. Records past their
own profile's horizon at that date are skipped for speed, using **the incident's
own curated profile** rather than one global constant.

A scenario **never rewrites history**: a hypothetical cannot change the past, so
the published series is baseline-only.

---

## Uncertainty

The principal uncertainty analysis is a **fixed-seed global sensitivity design**
(`npm run sensitivity`): Saltelli sampling with Sobol first- and total-order
estimators over the declared assumption box, plus one-at-a-time diagnostics, rank
stability, sign stability, and a separate full factorial over the categorical
model forms.

*Why it replaced the previous approach.* v6 shipped three presets that moved the
transmission coefficients and the half-life **together**, in the same direction,
by the same relative amount. That design cannot separate one parameter's
influence from another's, and it systematically overstates the spread, because
perfectly correlated movement is the widest possible envelope.

**Uniform sampling over an assumption box is a computational design, not a
probability distribution over what is true.** The reported spread is an
**assumption envelope**. It is not a confidence, credible, or prediction
interval, and nothing in this model produces one. The finding that travels is
**rank stability**: an ordering that survives the whole box does not rest on the
coefficients.

---

## What the data does not know

The data audit separates hard failures from warnings, and the build only
stops on hard failures. That is the right gate for a prototype, but it
leaves real limitations sitting in a log nobody reads. They are stated here,
countable, because a limitation that is not visible is indistinguishable
from one that does not exist.

| Limitation | Extent in this snapshot |
| --- | --- |
| **No evidence-based edge allocations** | **Every** dependency coefficient rests on an equal split: 17 stages have no inbound allocation, 21 no outbound. This is the single largest unevidenced input to the model. |
| **Missing evidence notes** | 20 of 24 stages and 105 of 109 companies carry no evidence note. Figures without one are carried-over analyst judgement, not individually verified numbers. |
| **Partial country-share coverage** | 6 stages disclose less than 100% of their country shares, so their concentration is published as a `[lower, upper]` interval rather than a point. |
| **Company shares summing above 100%** | Two stages exceed 100% because the underlying estimates use overlapping category definitions from different sources. Shares are renormalized for computation and treated as within the modeled sample. |
| **Host-only countries** | 8 of 24 countries carry no stage share. They host facilities and contribute nothing to any score - a real distinction the map cannot show by itself. |
| **Curated versus legacy-assisted events** | 30 incidents carry a curated stage exposure and persistence profile with a recorded basis. 49 scored incidents do not, and run on an equal 1/k split and a default acute profile. |
| **Curation grading** | 10 of the 30 curated incidents are individually evidence-graded; the other 20 use a default uncertainty band. |

### The three uncertainties, kept apart

They are measured separately because they behave differently, and because
adding them together would imply a precision none of them has:

| Class | What varies | Headline effect | Artefact |
| --- | --- | --- | --- |
| **Parameter** | the registry coefficients | envelope about 1.3 index points | `docs/benchmarks/v7-sensitivity.json` |
| **Model form** | the categorical structural choices | envelope about 1.1 index points | same file, reported separately |
| **Event curation** | per-incident exposure and persistence judgements | envelope about 0.72 index points | `docs/benchmarks/v7-curation-uncertainty.json` |

Curation uncertainty is the newest of the three and was previously
unmeasured - which meant it was implicitly treated as zero. It is the same
order of magnitude as the other two.

### Legacy-assisted history

The 49 uncurated incidents move today's reading by **nothing**: they are
years old, and their persistence multipliers at the snapshot date are
negligible. They move the **pre-curation historical peak by about one index
point**. Earlier documentation said fallbacks could not materially affect
any published number; that was true of the current snapshot and false of the
historical series, and the claim is withdrawn. The history panel marks
legacy-assisted periods, and `docs/benchmarks/v7-legacy-fallback.json`
quantifies them.

## Reproducibility and limitations

The graph, snapshot, assumptions and parameters are all versioned. When comparing
results, record the commit, the snapshot date, the incident or scenario, and the
parameters.

SSCIM has no facility-level capacity, inventory, bill-of-materials, qualification
or recovery-time data, and has not been fit to any outcome dataset. **Every
propagation coefficient is a declared, uncalibrated prior** chosen to produce
directionally sensible, reproducible, inspectable behaviour.

Passing unit tests is not validation, and recovering parameters from data the
model itself generated is not validation. Neither word is used for either
activity here — see [spec §9](MODEL_V7_SPEC.md#9-validation-status) for the
status of each activity separately, and
[SYNTHETIC_PARAMETER_RECOVERY.md](computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md)
for what the recovery test does and does not show.

---

## Parameter reference

**Parameter values are not repeated here.** They are published once, in
[spec §5](MODEL_V7_SPEC.md#5-parameter-register), generated directly from
`app/src/engine/registry.js`, so a coefficient cannot change in the code without
the published table changing with it. Every parameter carries a definition, a
low/base/high assumption range, a valid domain, units, the component that
consumes it, a rationale, and `status: assumption`.

### Where the *data* comes from

Source tiers: **[A]** academic · **[B]** institutional reports · **[C]** official
filings and rule texts · **[D]** declared analyst judgement · **[GRAPH]**
computed from the above.

| Input | Meaning | How it is found |
| --- | --- | --- |
| $q_e$ (`sev`) | realized-scale judgement per incident, 1–10 (**ordinal**) | hand-curated against cited sources [B/C] |
| direction / channel / operational | per-incident classification | hand-curated table [D], never inferred at runtime |
| $\alpha_{e,s}$ | stage exposure per incident | hand-curated with a recorded basis [D]; counted $1/k$ fallback outside the curated horizon |
| temporal profile | per-incident persistence shape and its dates | hand-curated with a recorded basis [D/C] |
| $V_s$ (`stages.value`) | stage turnover proxy, US$B — **an importance weight, not a loss base** | segment-size estimates [B] |
| $\nu_s$, $m_s$ | non-substitutability / market sensitivity, 0–10 | analyst judgement [D] against a written rubric |
| $\sigma_{c,s}$ | country share of a stage | capacity/market estimates [B]; residual kept explicit as an HHI interval |
| company within-stage share | 0–1 | share estimates [B], filings [C] |
| edges $a\to b$ | stage topology, checked acyclic on every build | curated from published process flows [B] |
| $q_{ba}$, $r_{ab}$ | edge allocations | **none supplied in this snapshot**; equal split used and counted [GRAPH] |
| facility `scale` | site significance, **1–5 analyst ordinal** | analyst judgement [D]; ratios are not capacity |
| owner stakes | major-shareholder holdings, 0–1 | public filings [C] |
| quotes (price, P/E) | market metadata | refreshed per build — **display only, never a model input** |
| `datasetAsOf` | the frozen date every incident age measures against | declared in the vault's `meta` table |
