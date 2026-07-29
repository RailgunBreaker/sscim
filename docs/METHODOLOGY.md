# SSCIM methodology

This document describes exactly what `app/src/engine/{priors,math,graph,index}.js` computes. No formula here is aspirational or simplified for exposition. Where this document and the code could drift apart, every numerical coefficient lives in one place — `MODEL_PRIORS` in `app/src/engine/priors.js` — and the in-app methodology overlay reads the same object.

For each equation derived step by step with real numbers, see the [Calculation specification](calculation/README.md). For what the model would need before any of it could be called calibrated, see the [Model roadmap](MODEL_ROADMAP.md).

## Purpose and model boundary

SSCIM is a deterministic sensitivity model over a versioned semiconductor supply-chain snapshot. It asks how an event or scenario would move through a declared graph; it does not estimate the probability, size, or timing of real-world losses.

Every displayed result belongs to one of two families, and the separation is load-bearing:

- **Structural vulnerability** — a time-invariant 0–10 stage characteristic. What is fragile about this part of the chain regardless of what happened this week.
- **Operational impact** — a signed, event-driven field displayed on a 0–10 index where 5 is neutral. What the currently selected events or scenario do to it.

Blending the two would give a single number that moves for two incompatible reasons with no way for a reader to tell which. They are computed, displayed, and labeled separately.

## Notation

| Symbol | Meaning |
| --- | --- |
| $n$, $j$, $k$ | a production stage (24 in the current snapshot) |
| $a \to b$ | a declared edge: supplier stage $a$ feeding buyer stage $b$ (34 edges) |
| $v_n$ | stage $n$'s annual economic value, US$B |
| $EW_n$ | log-compressed economic weight, $\ln(1+v_n)/\max_m \ln(1+v_m)$ |
| $c$, $S_c$ | a company, and the set of stages it occupies |
| $\text{share}_{c,s}$ | company $c$'s within-stage share of stage $s$ |
| $\text{field}_n$ | the signed operational shock field at stage $n$, in $[-1,1]$ |

## Structural layer

### Composite

$$\text{struct}_n = w_{\text{ni}}\,NI_n + w_{\text{geo}}\,GEO_n + w_{\text{pol}}\,POL_n + w_{\text{subst}}\,\text{subst}_n + w_{\text{mkt}}\,\text{mkt}_n$$

Five components. The event-driven term is dropped entirely and the remaining declared weights renormalized to sum to 1 — that is what keeps this number time-invariant. Three components are graph- or data-derived (network influence, geographic concentration, policy exposure); two are declared analyst judgments (substitutability, market sensitivity). Every breakdown bar in the interface carries its own source tag, `[GRAPH/DATA]` or `[ANALYST]`, so a reader can tell which is which without consulting this document.

### Network influence

For each stage $j$: inject a unit adverse shock at $j$ alone, propagate downstream over every reachable path, weight each affected stage by its log-compressed economic weight, sum, and normalize 0–10 against the largest such sum in the graph.

$$NI_j = 10\cdot\frac{\sum_n EW_n\cdot\left|\text{propagate}_{\downarrow}(j)_n\right|}{\max_k \sum_n EW_n\cdot\left|\text{propagate}_{\downarrow}(k)_n\right|}, \qquad EW_n=\frac{\ln(1+v_n)}{\max_m \ln(1+v_m)}$$

This replaced an earlier raw path-count "chokepoint centrality", which counted source→sink paths through a node and was therefore sensitive to how the graph happened to be drawn: adding an unrelated parallel path moved a node's centrality without changing anything about how disruptive it actually is. Network influence is a **modeled sensitivity proxy** — not a validated centrality metric, and not a measure of realized economic loss.

### Geographic concentration

$$HHI = \sum_i \text{share}_i^2 + \text{residual}^2, \qquad \text{residual} = \max\left(0,\,1-\textstyle\sum_i \text{share}_i\right)$$

Herfindahl-style, with the undisclosed remainder treated as one unmodeled "Other" competitor rather than ignored. Worked: shares `{a: 0.5, b: 0.25}` give residual `0.25`, so `HHI = 0.5² + 0.25² + 0.25² = 0.375` and `score₁₀ = 3.75`.

Ignoring that residual — the earlier behaviour — **understates** concentration whenever disclosed shares do not sum to 1, which is the common case in this snapshot. Shares summing to materially more than 1 are normalized for the computation and flagged as a diagnostic rather than silently accepted.

### Policy exposure

$$POL_n = \min\left(10,\ \max_p \sigma_p + 0.4\sum_{p \neq \max} \sigma_p\right)$$

The dominant instrument sets the floor; each additional instrument affecting the same stage adds a discounted increment. Both the per-instrument severity $\sigma_p$ and the 0.4 discount are declared judgments.

## Directional dependence

Two matrices replace what was previously a single value-weighted edge, because the two directions measure genuinely different things:

$$D[b][a] = f_{\downarrow}\cdot\frac{1}{\text{indeg}(b)}\cdot\big(\phi + (1-\phi)\cdot\text{spec}(a)\big), \qquad U[a][b] = \frac{f_{\uparrow}}{\text{outdeg}(a)}$$

with $f_{\downarrow}=0.55$, $f_{\uparrow}=0.30$, $\phi=0.25$, and $\text{spec}(a)=\text{clamp}(\text{subst}_a/10,0,1)$.

- **$D[b][a]$** — downstream **input dependence**: how much buyer stage $b$'s output depends on supplier stage $a$, from $b$'s in-degree (an equal-allocation prior across declared inputs, *not* a bill of materials) and $a$'s substitutability-derived specificity.
- **$U[a][b]$** — upstream **supplier-revenue dependence**: the demand-side echo felt by supplier $a$ when buyer $b$ is disrupted, split evenly across $a$'s declared outputs.

Neither is a measured input–output coefficient or a bilateral trade value; no facility-level, bill-of-materials, or inventory dataset exists here to build one. Both are transparent priors built only from graph structure and the one analyst-judgment input the dataset already has. Edge thickness in the flow graph renders $D[b][a]$, labeled "modeled input-dependence weight (prior)" — never "value flow" or "trade intensity".

This distinction matters in practice. A supplier's sales share to a customer is not the customer's input dependence on that supplier: ASML → TSMC at some percentage of ASML's sales does not mean TSMC is that percentage dependent on ASML for EUV, where the real dependence is closer to complete.

## Operational layer

### Event magnitude and decay

$$s_0 = \text{sign}\cdot\text{clamp}(\text{sev}/10,0,1)\cdot 2^{-\text{age}/H}, \qquad H = 12\text{ days}$$

A true half-life: `decay(0)=1`, `decay(12)=0.5`, `decay(24)=0.25`. An earlier version used $e^{-\text{age}/12}$ while *calling* it a 12-day half-life; that function's actual half-life is $12\ln 2 \approx 8.32$ days.

`age` is measured against the frozen snapshot date (`MODEL_PRIORS.datasetAsOf`), never the visitor's clock. `sign` comes from the event's declared classification, never from severity or headline text.

**Confidence is never multiplied into magnitude.** An earlier version multiplied a confidence weight into the shock, conflating *how sure we are* with *how large the effect is* — so a low-confidence severity-8 event and a high-confidence severity-6 event rendered identically. Confidence is now reported only as evidence-quality metadata alongside the magnitude.

### Propagation

A shock propagates downstream in topological order via $D$, and/or upstream in reverse-topological order via $U$, across **every reachable path** — not a fixed hop cutoff. Propagation along a path stops once a contribution's magnitude falls below $\tau=10^{-4}$. The graph is validated before any of this runs: no dangling edges, no duplicates, no cycles (a DAG is required for a topological order to exist). An invalid graph surfaces as an explicit diagnostic rather than silently propagating arbitrary values.

### Combining simultaneous shocks

$$\text{combinePositive}(v_1,\dots,v_k) = 1-\prod_i(1-v_i)$$

Bounded noisy-OR. Positive (adverse) and negative (mitigating) magnitudes are combined separately, then netted and clamped to $[-1,1]$. A second adverse contribution can only add, never subtract, and the combined magnitude never exceeds 1. This replaces two failure modes at once: `Math.max` merging, which silently discarded every contribution but the largest, and naive summation, which is unbounded and can exceed the valid range. It is a declared pragmatic aggregation prior, not a result drawn from the cited literature.

### Aggregate index

$$\text{operationalIndex} = \text{clamp}_{[-1,1]}\!\left(\frac{\sum_n EW_n\cdot\text{field}_n}{\sum_n EW_n}\right), \qquad \text{displayIndex}=5+5\cdot\text{operationalIndex}$$

## Event classification

Every event and scenario id is looked up in a small versioned table (`app/src/engine/event-assumptions.js`) giving direction (`adverse`/`mitigating`/`mixed`), channel (`downstream`/`upstream`/`both`), and whether it counts toward the scored aggregate at all. This is **never** inferred at runtime from event prose — no model call, no keyword matching, no sentiment analysis. An id with no recorded assumption defaults to unclassified: displayed, but excluded from the score rather than guessed.

Only `operational: true` classifications contribute to the chain index. In the current snapshot that means a hazard-signal event whose own text states no disruption occurred, a reallocative event with simultaneous winners and losers, and a long-term subsidy signal are all displayed and individually propagated, but excluded from the aggregate — collapsing any of them into one signed magnitude would misrepresent what they describe.

## Company metrics

Three separately labeled numbers, never blended, because a small and a large single-stage company can share a vulnerability but never a contribution:

$$\text{vulnerability}_c = 10\cdot\frac{1}{|S_c|}\sum_{s\in S_c}\max(0,\text{field}_s)$$

Share-**independent**: the average adverse impact across the stages $c$ occupies, regardless of relative size there.

$$\text{contribution}_c = \sum_{s\in S_c}\text{share}_{c,s}\cdot\max(0,\text{field}_s)\cdot EW_s$$

Share-**weighted**: a larger stake at the same impact level always yields a larger contribution. An earlier exposure formula divided by the sum of company shares, which made market share cancel algebraically for any single-stage company — a 5% holder and a 50% holder of the same stage produced an identical number.

$$\text{criticality}_c = 10\cdot\frac{\text{raw}_c}{\max_k \text{raw}_k}, \qquad \text{raw}_c = \frac{\sum_n \max(0,\text{propagate}_{\text{both}}(\text{stakes}_c))_n\cdot NI_n}{\sum_n NI_n}$$

"If this company were fully disrupted": shock every stage it occupies (sized to its within-stage share), propagate both directions, take the network-influence-weighted mean, then normalize against the largest raw value **actually achieved** across companies in the snapshot rather than a theoretical ceiling. That ceiling is practically unreachable — even a company reaching all 24 stages through propagation scored under 2 on a nominal 0–10 scale — which squashed every company into a sliver near 0 and made the "0–10" framing misleading.

## Aggregation and scenarios

Country results are share-weighted stage aggregates: **production geography**, not headquarters. Headquarters is displayed separately and labeled "HQ:", never substituted for the facility-level exposure this dataset does not contain.

A scenario runs the same engine as an event, seeded with an explicitly simulated input. It is shown as **active vs. baseline** with a signed delta, and never rewrites the historical series — a hypothetical cannot change the past.

Low/base/high outputs re-run the computation at ±30% on the transmission coefficients and half-life. They bound how sensitive the result is to those priors. **They are not confidence intervals**, and nothing in this model produces one.

## Computed history

The sparkline, multi-year chart, and movers list re-run the operational computation at each past offset and re-propagate — never using `Date.now()`. At $t$ days before the snapshot an event's age is $(\text{daysAgo} - t)$; events with negative age had not happened yet and are excluded, so each event first appears at full magnitude on its own date and decays from there. An earlier version *added* $t$, pre-echoing future events into the past so no event could peak on its own date.

## Reproducibility and limitations

The graph, snapshot, assumptions, and priors are all versioned. When comparing results, record the commit, snapshot date, event or scenario, and parameters.

SSCIM has no facility-level capacity, inventory, bill-of-materials, qualification, or recovery-time data, and has not been fit to any outcome dataset. Every propagation coefficient is a declared, unvalidated prior chosen to produce directionally sensible, reproducible, inspectable behaviour.

See the [Calculation specification](calculation/README.md), the [Validation note](computation-demo/validation/MLE_VALIDATION.md), and the [Model roadmap](MODEL_ROADMAP.md).

## Parameter reference

Source tiers: **[A]** academic · **[B]** institutional reports · **[C]** official filings and rule texts · **[D]** declared analyst judgment · **[GRAPH]** computed from the above.

| Symbol / coefficient | Meaning | Value | How it is found |
| --- | --- | --- | --- |
| $H$ (`halfLifeDays`) | event-shock half-life | 12 days | declared prior [D]; swept ±30% |
| $f_{\downarrow}$ (`downstreamTransmission`) | supplier disruption passed per edge | 0.55 | declared prior [D], unvalidated |
| $f_{\uparrow}$ (`upstreamTransmission`) | demand echo passed back per edge | 0.30 | declared prior [D]; deliberately below $f_{\downarrow}$ |
| $\phi$ (`specificityFloor`) | residual transmission of a fully substitutable input | 0.25 | declared prior [D] |
| $\tau$ (`contributionTolerance`) | propagation truncation threshold | $10^{-4}$ | declared prior [D] |
| component weights | structural-vulnerability mix | .25/.20/.20/.15/.10/.10 | declared prior [D]; renormalized |
| `datasetAsOf` | frozen date all event ages measure against | 2026-07-29 | declared |
| $\text{sev}$ | realized-scale judgment per event, 1–10 | per event | hand-curated against cited sources [B/C] |
| direction / channel / operational | per-event classification | per event | hand-curated table [D], never inferred |
| $v_n$ (`stages.value`) | stage annual economic value, US$B | per stage | segment-size estimates [B] |
| $\text{subst}_n$, $\text{mkt}_n$ | substitutability / market sensitivity | 0–10 | analyst judgment [D] against a written rubric |
| $\text{share}_i$ | country share of a stage | 0–1 | capacity/market estimates [B]; residual kept explicit |
| $\text{share}_{c,s}$ | company within-stage share | 0–1 | share estimates [B], filings [C] |
| edges $a\to b$ | stage topology (34, validated acyclic) | topology | curated from published process flows [B] |
| $\text{indeg}$, $\text{outdeg}$ | equal-allocation input/customer split | per node | [GRAPH]; a stand-in until real BOM data exists |
| $\text{own}_{o,c}$ | major-shareholder stakes | 0–1 | public filings [C] |
| quotes (price, P/E) | market metadata | refreshed per build, or on demand against a live backend | Yahoo Finance — **display only, never a model input** |
