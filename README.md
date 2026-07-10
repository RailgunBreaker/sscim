# SSCIM — Semiconductor Supply Chain Intelligence Map

**Language:** English · [日本語](README.ja.md) · [简体中文](README.zh.md)

**A live intelligence layer over the global semiconductor supply chain**

Version: v5 (current build) · Status: working demo, pre-MVP1 · Data: best-effort real-data pass (see §8, §9)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Product Architecture](#2-product-architecture)
3. [Data Model](#3-data-model)
4. [Model Methodology](#4-model-methodology)
5. [Feature Reference](#5-feature-reference)
6. [Technical Implementation](#6-technical-implementation)
7. [Internationalization](#7-internationalization)
8. [Evidence Framework & Data Integrity](#8-evidence-framework--data-integrity)
9. [Model Status, Limitations & Known Issues](#9-model-status-limitations--known-issues)
10. [File Structure & Deployment](#10-file-structure--deployment)
11. [Roadmap](#11-roadmap)
12. [Acknowledgements & Methodology Citations](#12-acknowledgements--methodology-citations)

---

## 1. Introduction

### 1.1 The problem

Existing semiconductor supply-chain maps — industry consortium diagrams, research-institute charts, static infographics — do a good job of showing **structure**: which companies occupy which part of the chain, which countries host which capabilities. What they cannot show is **motion**: when a new export-control rule, a geopolitical event, or a company's capacity decision lands, which nodes are newly exposed, how far the effect travels, and what to watch next.

Semiconductors are also unusually concentrated. A single company in the Netherlands (ASML) makes essentially all EUV lithography equipment. A single island (Taiwan) fabricates most leading-edge logic. A pair of South Korean firms dominate HBM memory. This concentration means shocks — policy, geopolitical, or company-specific — propagate through the chain in predictable but non-obvious ways.

### 1.2 What SSCIM is

SSCIM is a live intelligence layer that combines:

- A **world map** (real OpenStreetMap geography) showing where semiconductor capability sits, by country
- An **industry flow graph** — the full production pipeline from research/IP through end markets
- A **company layer** — production shares, customer relationships, and shareholder structure for over 100 companies
- A **propagation engine** that models how shocks (events, hypothetical scenarios, or a single company's disruption) spread through the graph
- An **intelligence panel** that explains what changed, why it matters, and what to watch next
- A **briefing generator** that composes a daily intelligence summary from the live model state

The one-sentence description: *a live semiconductor supply-chain intelligence map that shows not only where the chain is, but what changed, which nodes are affected, and what may happen next.*

### 1.3 Target users

Investors and market watchers tracking policy/geopolitical/technology effects on semiconductor companies; policy and geopolitical-risk researchers studying export controls and supply-chain security; students and analysts who need a fast, structured view of the industry; corporate strategy teams tracking exposure and chokepoints; and journalists covering the beat. The commercial hypothesis targets the mid-tier this list implies — buyers who cannot justify enterprise data-vendor pricing but need more than free public maps provide.

### 1.4 Companion product: GP News

SSCIM's engine can generate a daily semiconductor intelligence briefing (**GP News**) without a human writing it from scratch: the "GP Briefing" feature in the app composes what-changed, most-shocked nodes, company exposure leaders, country risk board, and watch-next items directly from live model state. The recommended go-to-market sequence launches the briefing first — lower friction, faster demand signal — with the interactive dashboard following as a premium tier.

---

## 2. Product Architecture

SSCIM is built as **three synchronized layers over one computational engine**. Selecting any element in any layer highlights the corresponding elements in the other two.

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: WORLD MAP          LAYER 2: INDUSTRY FLOW          │
│  (OpenStreetMap / Leaflet)   (24-stage dependency DAG)       │
│  16 countries, structural     Modeled input-dependence        │
│  vulnerability colored        edges, network-influence-sized │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: INTELLIGENCE PANEL                                 │
│  Event feed · Company criticality rank · Movers · Capital    │
│  Detail view: score breakdown, spread trees, sources          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  PROPAGATION ENGINE    │
              │  (one code path, three │
              │   uses: events,        │
              │   scenarios, company   │
              │   disruption)          │
              └───────────────────────┘
```

The central design principle — **"one engine, three uses"** — is a methodological consistency claim: live events, hypothetical scenarios, and company-disruption simulations are not three separate features with three separate formulas. They are three different *inputs* to the same shock-propagation function. This is what lets the product make a credible claim to explainability rather than presenting three black boxes under one roof.

---

## 3. Data Model

### 3.1 Stages (24 nodes)

The supply chain is modeled as a directed acyclic graph (DAG) of 24 production stages across seven tiers:

| Tier | Stages |
|---|---|
| Inputs & IP | Research/IP, EDA software, Chip design, Silicon wafers, Photoresists, Specialty gases/chemicals, IC substrates (ABF) |
| Equipment | Lithography (EUV/DUV), Deposition, Etch & clean, CMP & slurries, Metrology/inspection |
| Fabrication | Advanced fab (≤7nm), Mature-node fab, Memory fab (DRAM/NAND) |
| Chip products | Logic & AI accelerators, Analog/power/RF, HBM |
| Backend | Advanced packaging, OSAT/test |
| Systems | Final systems (ODM/EMS) |
| End markets | AI data centers, Automotive/industrial, Consumer/mobile |

Each stage carries: a sample global value figure ($B), country market shares (summing to ≤1, remainder is unmodeled long tail), and two analyst-judgment scores (substitutability, market sensitivity).

**34 directed edges** connect stages (e.g., `lithography → advanced fab`, `advanced fab → logic/AI`), forming the DAG that the propagation engine traverses.

### 3.2 Countries (16)

United States, China, Taiwan, South Korea, Japan, Netherlands, Germany, France, United Kingdom, Belgium, Ireland, Israel, Singapore, Malaysia, Vietnam, Philippines. Country risk scores and map-node sizing are **fully derived** — computed as the share-weighted aggregate of every stage a country participates in. No country score is hand-set.

### 3.3 Companies (109)

Each company carries: a home country, a set of **stakes** — `{stageId: withinStageShare}` describing its production footprint, and (for a subset of the 109) entries in the **customer graph** and/or **shareholder table**. (Two entries — CXMT and Kioxia — were added during the §9 real-data pass: the original dataset merged CXMT's DRAM output into a combined "YMTC / CXMT" entry and omitted Kioxia, Japan's NAND maker, entirely.)

### 3.4 Customer graph (243 relationships)

A directed supplier→customer dataset: `supplier: [[customer, shareOfSupplierSales], ...]`. This is a *revenue relationship* dataset — "ASML → TSMC (35%)" means 35% of ASML's sales go to TSMC, which is a different quantity from how dependent TSMC is on ASML for lithography input. The product deliberately displays both numbers side by side wherever this distinction matters (see §4.5).

A reversed index (`SUPPLIERS`) is derived automatically from the customer graph for upstream-origin lookups.

### 3.5 Policy instruments (7)

Each policy carries a severity (0–10) and a list of affected stages, e.g. `{ id: "bis", sev: 9, stages: ["logic_ai","hbm","adv_fab","litho","depo","etch","metro"] }`. Policy exposure per stage is computed from this table, not hand-set.

### 3.6 Events (6 sample) and Scenarios (3 preset + unlimited custom)

Events carry severity, confidence (High/Medium/Low), age in days, affected stages/countries, first/second-order effect text, a background paragraph, a source citation, and a dated timeline. Scenarios inject a simulated event (severity, stages, `conf: "Simulated"`, `daysAgo: 0`) into the identical engine — including user-built custom scenarios via the in-app Scenario Builder.

### 3.7 Shareholder table (sample)

For ~25 major companies, a list of `[ownerName, ownershipShare]` pairs sourced from the pattern of public disclosures (13F filings, annual reports). State-linked capital (sovereign funds, government stakes, SOEs) is flagged.

---

## 4. Model Methodology

> **This section was rewritten to describe exactly what `app/src/engine/{priors,math,graph,index}.js` computes** — no formula below is aspirational or simplified for exposition. See `MODEL_ROADMAP.md` for the data-layer work this model would need before any of it could be called calibrated, and §9 for the full "Model status and limitations" statement. Every numerical coefficient lives in one place, `app/src/engine/priors.js` (`MODEL_PRIORS`), so this document, the in-app Methodology overlay, and the code cannot silently drift apart.

### 4.1 Structural vulnerability (per stage — time-invariant)

$$\text{struct}_n = w_{\text{ni}}\,NI_n + w_{\text{geo}}\,GEO_n + w_{\text{pol}}\,POL_n + w_{\text{subst}}\,\text{subst}_n + w_{\text{mkt}}\,\text{mkt}_n$$

Five components, renormalized to sum to 1 after dropping the event-driven term entirely (weights derive from `MODEL_PRIORS.componentWeights`, which also feeds the in-app breakdown — see §4.9 for why the event/scenario layer is kept structurally separate from this number). Three components are graph/data-derived (network influence, geographic concentration, policy exposure); two are declared analyst judgments (substitutability, market sensitivity) — every breakdown bar in the UI tags its source `[GRAPH/DATA]` or `[ANALYST]`.

### 4.2 Network influence — a Leontief-style sensitivity proxy

For every stage $j$: inject a unit adverse shock at $j$ alone, propagate it downstream over every reachable path (§4.4), weight each affected stage by its log-compressed economic weight, sum, then normalize 0–10 against the largest such sum in the graph.

$$NI_j = 10\cdot\frac{\sum_n EW_n\cdot\left|\text{propagate}_{\downarrow}(j)_n\right|}{\max_k \sum_n EW_n\cdot\left|\text{propagate}_{\downarrow}(k)_n\right|}, \qquad EW_n=\frac{\ln(1+v_n)}{\max_m \ln(1+v_m)}$$

This replaces the earlier version's raw path-count "chokepoint centrality," which counted source→sink paths through a node and was highly sensitive to how the graph happened to be drawn (adding an unrelated parallel path could move a node's centrality without changing anything about how disruptive it actually is). Network influence is a **modeled sensitivity proxy**, not a validated centrality metric or a measure of realized economic loss.

### 4.3 Geographic concentration — HHI with an explicit residual

$$HHI = \sum_i \text{share}_i^2 + \text{residual}^2, \qquad \text{residual} = \max(0,\,1-\textstyle\sum_i \text{share}_i)$$

Example: shares `{a: 0.5, b: 0.25}` → residual `0.25` → `HHI = 0.5² + 0.25² + 0.25² = 0.375` → `score₁₀ = 3.75`. When a stage's disclosed country shares sum to less than 1, the shortfall is treated as an unmodeled "Other" and included in the index — the earlier version silently ignored this residual, which **understated** concentration whenever the sample's disclosed shares didn't sum to 1 (several stages in the current snapshot are in exactly this situation — see the `audit:data` warnings). Shares summing to materially more than 1 are normalized for the computation and flagged as a diagnostic, not silently accepted.

### 4.4 Directional dependence matrices — priors, not measured trade flow

For every edge $a\to b$ ($a$ = supplier stage, $b$ = buyer stage), two distinct matrices replace the earlier version's single value-weighted edge:

$$D[b][a] = f_{\downarrow}\cdot\underbrace{\frac{1}{\text{indeg}(b)}}_{\text{base input share}}\cdot\big(\phi + (1-\phi)\cdot\text{spec}(a)\big), \qquad U[a][b] = \frac{f_{\uparrow}}{\text{outdeg}(a)}$$

with $f_{\downarrow}=0.55$ (`downstreamTransmission`), $f_{\uparrow}=0.30$ (`upstreamTransmission`), $\phi=0.25$ (`specificityFloor`), and $\text{spec}(a)=\text{clamp}(\text{subst}_a/10,\,0,\,1)$.

- **`D[b][a]`** is a downstream **input-dependence** proxy: how much buyer stage $b$'s output depends on supplier stage $a$, given $b$'s in-degree (an equal-allocation prior across $b$'s declared inputs — not a bill-of-materials weight) and $a$'s substitutability-derived specificity.
- **`U[a][b]`** is an upstream **supplier-revenue-dependence** proxy: the demand-side echo felt by supplier $a$ when buyer $b$ is disrupted, split evenly across $a$'s declared outputs.

Neither matrix is a measured input–output coefficient or a bilateral trade value — no facility-level, bill-of-materials, or inventory dataset exists yet to build one. Both are declared, transparent priors built only from graph structure (in/out-degree) and the one analyst-judgment input the dataset already has (stage substitutability). Edge thickness in the flow graph now renders `D[b][a]`, labeled "modeled input-dependence weight (prior)" — never "value flow" or "trade intensity."

### 4.5 All-reachable-paths propagation

A shock at any stage propagates downstream (topological order, via $D$) and/or upstream (reverse-topological order, via $U$) across **every** reachable path in the graph — not a fixed two-hop-downstream/one-hop-upstream cutoff as in the earlier version. At each node, contributions from all direct predecessors (downstream) or successors (upstream) are combined via the bounded noisy-OR rule in §4.7; propagation along a path stops once a contribution's magnitude falls below a tolerance ($\tau=10^{-4}$), not after a fixed hop count. The stage graph is validated before any of this runs — no dangling edges, no duplicate edges, no cycles (a DAG is required for a topological order to exist) — and an invalid graph surfaces as an explicit diagnostic rather than silently propagating arbitrary values.

### 4.6 Event magnitude, decay, and operational impact

$$s_0 = \text{sign}\cdot\text{clamp}(\text{sev}/10,\,0,\,1)\cdot\text{decay}(\text{age},\,H), \qquad \text{decay}(\text{age},H)=2^{-\text{age}/H}, \qquad H = 12\text{ days}$$

This is a **true half-life**: `decay(0,12)=1`, `decay(12,12)=0.5`, `decay(24,12)=0.25`. The earlier version used $e^{-\text{age}/12}$ and *called* it a 12-day half-life, but that function's actual half-life is $12\ln 2 \approx 8.32$ days — a real, if subtle, correctness bug, now fixed. `sign` is $+1$ (adverse) or $-1$ (mitigating), taken from the event's declared assumption (§4.8), never inferred from severity. `age` is measured in days before the frozen snapshot date (`MODEL_PRIORS.datasetAsOf`), never the visitor's real-time clock — this is a static demonstration snapshot, not a live feed.

$$\text{operationalIndex}(\text{field}) = \text{clamp}_{[-1,1]}\!\left(\frac{\sum_n EW_n\cdot\text{field}_n}{\sum_n EW_n}\right), \qquad \text{displayIndex}=5+5\cdot\text{operationalIndex}$$

Critically, **confidence (High/Medium/Low/Simulated) is never multiplied into this magnitude.** The earlier version multiplied a confidence weight ($\kappa_{\text{conf}}\in\{1.0,0.75,0.5\}$) directly into the shock, conflating *how sure we are* with *how large the effect is* — a Low-confidence severity-8 event and a High-confidence severity-6 event could render identically. Confidence is now reported only as evidence-quality metadata alongside the magnitude. Only events whose declared assumption marks them `operational: true` contribute to this aggregate; hazard-signal, mixed-reallocative, and long-term-strategic events are still displayed and individually propagated (§4.8), but excluded from the single score. A scenario's chain index is shown as **active** vs. **baseline** with their signed delta, never as a silent rewrite of the historical series (which stays baseline-only — a hypothetical scenario cannot change the past). A deterministic **sensitivity envelope** (low/base/high) re-runs the computation at ±30% on the transmission coefficients and half-life — bounds on model sensitivity, explicitly not a confidence interval.

### 4.7 Combining simultaneous shocks — bounded noisy-OR

$$\text{combinePositive}(v_1,\dots,v_k) = 1-\prod_i(1-v_i), \qquad \text{combinePositive}(0.4,\,0.5)=0.7$$

Signed values combine by separating positive (adverse) and negative (mitigating) magnitudes, combining each set with the formula above, then netting and clamping to $[-1,1]$. A second simultaneous adverse contribution can only add to, never subtract from, the combined effect, and the combined magnitude never exceeds 1. This replaces two problems in the earlier version at once: `Math.max`-merging multiple shocks on one node (which silently discarded every contribution but the single largest) and any naive-sum alternative (which is unbounded and can exceed the score's valid range). This is a declared pragmatic aggregation prior, not a formula drawn from the cited literature (§12).

### 4.8 Event semantics — explicit, hand-curated, never inferred

Every event/scenario id is looked up in a small, versioned table (`app/src/engine/event-assumptions.js`) giving its direction (adverse/mitigating/mixed), propagation channel (downstream/upstream/both), and whether it counts toward the scored operational aggregate at all — **not** inferred at runtime from event prose (no LLM, no keyword matching, no sentiment analysis). An id with no recorded assumption defaults to "unclassified": displayed, but excluded from the score rather than guessed. In the current snapshot: the export-control and material-licensing events are adverse/operational; the reported capacity-increase event is mitigating/operational; a hazard-signal event whose own text states no disruption occurred, a reallocative event with simultaneous winners and losers, and a long-term strategic/subsidy signal are all displayed but excluded from the aggregate — collapsing any of those three into one signed magnitude would misrepresent what they actually describe.

### 4.9 Company metrics — three separately-labeled numbers, never blended

A small and a large single-stage company can share the same vulnerability, but never the same contribution or criticality:

$$\text{vulnerability}_c = 10\cdot\frac{1}{|S_c|}\sum_{s\in S_c}\max(0,\text{field}_s)$$

Share-**independent**: the average adverse impact across the stages $c$ occupies, regardless of relative size there.

$$\text{contribution}_c = \sum_{s\in S_c}\text{share}_{c,s}\cdot\max(0,\text{field}_s)\cdot EW_s$$

Share-**weighted**: market share does not cancel — a larger stake at the same impact level always yields a larger contribution. (The earlier version divided by the sum of company shares in the exposure formula, which made market share cancel out algebraically for any single-stage company — a company with 5% share and one with 50% share of the same stage produced an identical number. Fixed.) If a stage's disclosed company shares sum to more than 1, shares are normalized for this computation and flagged as "within modeled sample."

$$\text{raw}_c = \frac{\sum_n \max(0,\text{propagate}_{\text{both}}(\text{stakes}_c))_n\cdot NI_n}{\sum_n NI_n}, \qquad \text{criticality}_c = 10\cdot\frac{\text{raw}_c}{\max_k \text{raw}_k}$$

"If this company were fully disrupted": inject a shock at every stage it occupies (sized to its within-stage share), propagate in both directions, and take the network-influence-weighted mean — then normalize against the largest raw value actually achieved across every company in the current snapshot, the same max-observed approach §4.2's network influence uses, rather than the theoretical ceiling of every stage saturating at once. That ceiling is practically unreachable by any real company footprint (even a company touching all 24 stages via propagation came out under 2 on a nominal 0–10 scale), which squashed every company's criticality into a sliver near 0 and made the "0–10" framing misleading — normalizing against the observed maximum instead means the single most systemically critical company in the snapshot scores at (or near) 10, and increasing a company's market share still can never reduce its own number.

### 4.10 Capital Power

$$\text{CapitalPower}_o = \sum_c \text{own}_{o,c}\cdot\text{criticality}_c$$

For each owner $o$, sum their ownership share in each company weighted by that company's systemic-criticality number (§4.9) — a ranking of who holds rights over the chain's most structurally critical capacity, with state-linked capital flagged.

### 4.11 Countries and the map layer

Country structural/operational scores are share-weighted aggregates of the stage-level numbers above (§4.1, §4.6) — **production geography**, not company headquarters. Company headquarters is shown separately and labeled "HQ:" throughout; it is never substituted for facility-level production exposure, which this dataset does not yet contain (see `MODEL_ROADMAP.md`). Map links aggregate the sample's supplier-revenue relationships between company *headquarters* countries, labeled "modeled supplier-revenue relationship weight" — never "trade intensity," since the underlying number measures neither bilateral trade nor buyer input dependence.

### 4.12 Computed history

The 21-day sparkline and the "Movers 7D" list re-run the operational-impact computation (§4.6) at each past day by shifting every event's `daysAgo` forward from the frozen snapshot date and re-propagating — never using `Date.now()`. History is always the **baseline** series (real snapshot events only); an active hypothetical scenario is shown as a separate current-value comparison point and never rewrites this series.

---

## 5. Feature Reference

| Feature | Description |
|---|---|
| **World Map** | Real OpenStreetMap geography (CARTO dark basemap, OSM-tile fallback), 16 countries, node size/color = structural vulnerability, hover shows operational impact & scenario Δ separately |
| **Derived country links** | Connections between countries computed from the customer graph, labeled "modeled supplier-revenue relationship weight" (HQ↔HQ, sample only) — never "trade intensity" |
| **Industry Flow Graph** | 24-stage DAG, edge thickness = modeled input-dependence prior, node color/size = structural vulnerability, +Δ badge = current operational scenario delta, tap to open a stage subsection |
| **Stage subsections** | Per-stage company list with market-share bars, modeled contribution, and each company's top customers with percentages |
| **Company detail** | Three separately-labeled numbers — systemic criticality, vulnerability (share-independent), contribution (share-weighted) — plus production footprint, customers & suppliers, major shareholders, two-layer upstream origin trace, two spread trees |
| **Customer-graph spread tree** | Named-relationship propagation: source → direct customers → their customers, with path-weight percentages and engine-computed contribution |
| **Stage-level spread tree** | All-reachable-paths propagation view, ranked by modeled contribution |
| **Upstream origins tree** | Two supplier layers *behind* any company, via the reversed customer graph |
| **Company Rank** | All 109 companies ranked by systemic criticality — the answer to "whose disruption hurts the chain most?" |
| **Capital Power Rank** | Shareholders ranked by ownership × company systemic criticality; state-linked capital flagged |
| **Movers 7D** | Stages ranked by absolute baseline operational-impact change over the trailing week, computed via engine replay |
| **21-day sparkline** | Baseline operational chain index recomputed at each of the past 21 days (never rewritten by an active scenario) |
| **Scenario presets** | Taiwan Strait crisis, China materials ban, Export controls max — each a pre-configured hypothetical event, shown as active vs. baseline with a signed delta |
| **Scenario Builder** | User selects any stages, sets severity, names it, and runs a fully custom hypothetical event through the identical engine |
| **Global search** | Jump to any stage, company, or country by name |
| **GP Briefing generator** | Composes a daily intelligence briefing — ranked by scenario marginal delta when active, by baseline operational impact otherwise; every line labeled structural/operational/scenario-delta; copy or download as .txt |
| **Rich event detail** | Background paragraph, source citation, dated confidence timeline, explicit exclusion banner for hazard/mixed/strategic events, and computed top-contribution companies list per event |
| **Company logos** | Favicon-based identification for all 109 companies via each company's official domain, with monogram fallback |
| **In-app Guide** | Seven-step walkthrough, fully localized |
| **Methodology overlay** | Every formula (rendered in TeX/KaTeX) transcribed directly from the engine source, every propagation prior, explicit structural/operational/scenario-delta tags, and the full "Model status and limitations" statement |
| **Language switcher** | English, Simplified Chinese, Traditional Chinese, Japanese — UI chrome and guide fully translated (see §7) |

---

## 6. Technical Implementation

### 6.1 Stack

- **Frontend**: React 18 + Vite, built as a proper ES-module project under `app/` (`src/components`, `src/data`, `src/engine`, `src/i18n`, `src/utils`) — no more in-browser Babel transpilation; `npm run build` produces a minified, code-bundled artifact.
- **Leaflet** and **KaTeX** are real npm dependencies, imported directly (`import L from 'leaflet'`, `import katex from 'katex'`) instead of being injected from a CDN `<script>` tag at runtime.
- **Backend**: a small Node/Express API (`server/`) backed by **SQLite** (via `better-sqlite3`) — the vault described in §3 and §9. Public `GET` endpoints serve the current dataset; a bearer-token-authenticated `/api/admin/*` surface supports live writes (update a company's stakes, add an event, revise a shareholder stake) without touching application code or redeploying the frontend.
- The frontend fetches the entire dataset once on load (`GET /api/bundle`) and builds the derived engine (risk scores, propagation, rankings) from whatever the vault currently holds.

### 6.2 Why the data moved out of the bundle

Earlier builds computed everything from four **hardcoded** JS tables (`STAGES`, `COMPANIES`, `CUSTOMERS`, `POLICIES`) baked into the shipped file — accurate to the "one engine, three uses" claim, but it meant every data correction required a code change and a redeploy. The vault split separates *that* concern from the algorithm:

- `server/` owns the data — companies, stages, the customer graph, shareholder table, policies, events, scenarios — in a real relational/JSON-hybrid SQLite schema, with a `data_notes` table carrying the evidence-tier citation for each headline correction (see §9).
- `app/src/engine/index.js` is a **factory**, `buildEngine(data)`, not a set of modules computed once at import time. It takes whatever the vault returns and (re)computes structural vulnerability, network influence, directional propagation, company metrics, rankings, and history from it (see §4). The "one engine, three uses" claim still holds — the same propagation code path runs for live events, hypothetical scenarios, and company-disruption simulations — it's just parameterized over runtime data instead of closed over static imports.
- Editing data is now: call the admin API (or a future admin UI) — not edit a JS array and rebuild. Adding a new company, policy, or event still ripples through every dependent number automatically, the same as before, because the derivation logic didn't change, only where the source tables come from.

The tradeoff: the app now depends on the vault API being reachable (there's a loading state, and a clear error screen if it isn't — see `App.jsx`). At current scale (24 stages, ~109 companies) the single-`GET`-then-compute-client-side approach is still sub-second and simple; a production version ingesting thousands of daily events would want the propagation itself computed server-side and cached, which is a change to *where* `buildEngine` runs, not to the algorithm.

### 6.3 Graph algorithms used

- **Graph validation** (`engine/diagnostics.js`) before anything else runs: every edge's endpoints must exist among the declared stage ids, no duplicate edges, and the graph must be acyclic — an invalid graph surfaces as a diagnostic instead of propagating arbitrary values.
- **Topological sort** (Kahn's algorithm, `engine/math.js`) establishes the processing order for downstream propagation; its reverse establishes the order for upstream propagation.
- **All-reachable-paths propagation** (`engine/graph.js`) — a single forward pass in topological order (downstream) and/or a single backward pass in reverse-topological order (upstream), each node combining all its direct predecessors'/successors' contributions via the bounded noisy-OR in §4.7, truncated once a contribution's magnitude falls below a fixed tolerance rather than after a fixed hop count. This replaces the earlier version's bounded-hop BFS (2 hops downstream, 1 hop upstream), which structurally could not represent an effect reaching a stage more than two hops from its source.
- **Bounded noisy-OR combination** (§4.7) rather than `Math.max` or naive summation when merging multiple simultaneous shock sources onto one node — monotonic (a second contribution never reduces the combined effect) and bounded (never exceeds the valid range).

### 6.4 Rendering approach

The map and flow graph are both hand-built (Leaflet API calls for the map; raw SVG for the flow graph) rather than using a generic charting library — this gives full control over interaction (tap-to-highlight across layers), styling (the copper/terminal aesthetic), and the specific visual encodings the product needs (edge width = value weight, node size = importance, which no off-the-shelf chart type expresses directly).

### 6.5 Logo system

Company identification uses each company's official domain plus Google's public favicon service (`google.com/s2/favicons?domain=...`), a standard nominative-use pattern (the same approach used by many financial and news apps) rather than embedding or redistributing trademarked artwork. Failed loads degrade to a generated two-letter monogram — the UI never shows a broken image.

---

## 7. Internationalization

The product ships with English, Simplified Chinese (简体), Traditional Chinese (繁體), and Japanese (日本語) support via a lightweight in-house dictionary (no external i18n framework — kept intentionally simple even after the move to a Vite build, since the dictionary itself has no need for the tooling a larger i18n framework provides).

**Fully localized:** UI chrome (pane titles, tabs, buttons), the product's full name, scenario names, risk labels, the What-Changed and Chain-Index labels, search placeholder, and — most substantially — the complete seven-step in-app guide, independently written (not machine-translated in place) for each language.

**Deliberately left in English for now:** sample event background/source/timeline text, the Methodology overlay's prose, and the generated briefing text. This is a considered Phase-1 boundary: these are exactly the strings that will be replaced once real, cited data replaces the sample dataset, so translating them now would be discarded work. The in-app guide explicitly discloses this boundary to the user in their selected language.

The landing (`index.html`) and introduction (`intro.html`) pages carry an equivalent language switcher with headline, section, and pricing translations.

---

## 8. Evidence Framework & Data Integrity

The methodology defines four evidence classes used to ground both the algorithm's design and (in the production version) each individual data point:

| Tier | Description | Examples |
|---|---|---|
| **A — Academic** | Peer-reviewed foundations | Production-network shock propagation (network economics), Herfindahl concentration (industrial organization), path centrality (network science) |
| **B — Institutional reports** | Industry and research-body publications | SIA/BCG resilience studies, SEMI capacity data, CSET Supply Chain Explorer, TrendForce/TechInsights/Gartner share estimates |
| **C — Official sources** | Primary government/company documents | BIS/METI/MOFCOM rule texts, NIST & CHIPS Program documents, EU Chips Act, company filings (10-K/20-F, 13F) |
| **D — Analyst judgment** | Declared expert input | Substitutability and market-sensitivity scores, scored against a written rubric (to be formalized in Phase 1) |

Production data points are designed to display `[tier · citation · date]`. Where sources conflict, the intended behavior is to show the range rather than silently picking one number. Weights and propagation constants (the 0.55/0.30 hop factors, the 12-day decay constant) are treated as Tier-D priors until calibrated against documented historical episodes (see §11).

This framework directly implements the data-integrity rules from the original project brief: no unsourced claims, confidence labels on everything, "unavailable" rather than guessed values, and a hard separation between confirmed fact and interpretation.

---

## 9. Model Status, Limitations & Known Issues

**This is a research prototype and sensitivity-ranking tool, not a calibrated forecasting system.** SSCIM's public dashboard runs entirely client-side against a static, curated, frozen demonstration snapshot (`app/src/data/vault-snapshot.json`, built from `server/src/seed-data.js` — see §6.2) — not a live feed, not real-time data, and not a database of verified current trade flows. Every propagation coefficient in §4 (`MODEL_PRIORS` in `app/src/engine/priors.js`) is a **declared, unvalidated sensitivity prior**: chosen to produce directionally sensible, reproducible, inspectable behavior, not fit to any observed disruption episode. Nothing in this system is a causal or probabilistic forecast. Scores support **comparison and sensitivity ranking within this snapshot only** — a company's or country's number here is not a predicted financial loss, and should never be represented as one.

**No facility-level, bill-of-materials, inventory, capacity, or time-to-recover data exists in this dataset.** The directional dependence matrices in §4.4 are transparent equal-allocation priors built from graph structure (in/out-degree) and one analyst-judgment input (stage substitutability) — not a measured input–output coefficient, not a bill of materials, and not a capacity-constrained flow model. A real capacity-constrained shock (e.g., a fab physically destroyed) would propagate differently than this model predicts. See `MODEL_ROADMAP.md` for the full list of data-layer work (facility geography, buyer-input vs. supplier-revenue dependence, capacity/utilization, inventory days, time-to-recover/time-to-switch, alternative-supplier counts, and more) this model would need before any of it could be calibrated.

**Real-data pass applied to company/market-share figures, not full Phase-1 sourcing.** A best-effort research pass replaced the original illustrative sample with current, cited figures wherever a reliable public source exists — company 10-K/20-F/Annual Report filings, TrendForce/TechInsights/Gartner market-share tracking, and named trade press. Headline corrections (e.g., the U.S. government's 9.9% Intel stake, Nvidia overtaking Apple as TSMC's top customer, corrected HBM shares) are logged with their source in `server/src/data-notes.js` and surfaced by `npm run audit:data` (§10). Figures **without** a data-note entry are still carried-over analyst judgment (Tier D per §8), not individually verified — `npm run audit:data` currently reports 20/24 stages and 105/109 companies with no evidence note. This dataset is a meaningfully-improved snapshot, not a fully sourced production database, and should not be represented as such.

**Customer-graph relationships are one axis of dependency, and the two directions are not interchangeable.** A supplier's sales share to a customer (§4.4's `U`, a supplier-revenue-dependence proxy) is not the same as that customer's *input* dependence on the supplier (§4.4's `D`, a downstream input-dependence proxy) — ASML → TSMC at some percentage of ASML's sales does not mean TSMC is that percentage dependent on ASML for EUV input; for EUV specifically it is closer to complete dependence. The product now exposes `D` and `U` as two separately-labeled matrices for exactly this reason (§4.4), but the underlying disclosed-relationship dataset (`CUSTOMERS`) is still supplier-revenue-share data, not directly-measured buyer input dependence.

**Long-tail coverage is incomplete by design.** Stage company lists show a curated top set plus an "Others"/residual remainder; ~110 companies is a deliberate ceiling. `npm run audit:data` reports each supplier's disclosed customer-revenue coverage explicitly (most suppliers disclose well under 100% — by design, the sample lists top customers only, not an exhaustive revenue reconciliation).

**Shareholder data ages quickly.** Ownership stakes shift quarterly; this is the most compliance-sensitive dataset in the product and would require the tightest citation-and-date discipline in any production version.

**Static-only deployment is intentional, not a fallback of last resort.** The public dashboard is deployed as a static GitHub Pages site with no backend. `VaultContext.jsx` first attempts to reach a configured API and falls back to the bundled static snapshot when none is reachable — on the public deployment, that fallback path is the only path, by design (see the footer's "STATIC SNAPSHOT" notice). The `server/` API exists in this repository for local development and is out of scope for the frontend/model corrections described in §4; it is not modified, re-enabled, or required by the static deployment.

---

## 10. File Structure & Deployment

All three public pages — the landing page, the guide, and the dashboard — are React pages built from one Vite project (`app/`), sharing theme, the i18n pattern, and components like `Tex` (KaTeX formula rendering). The public deployment is **static-only**: the dashboard runs entirely against the bundled snapshot in `app/src/data/vault-snapshot.json` (see §9). `server/` (a small Node/Express + SQLite API) exists for local development and is not part of the public deployment.

```
/
├── README.md / README.ja.md / README.zh.md   This document, in English/Japanese/Simplified Chinese
├── MODEL_ROADMAP.md      Deferred data-layer work (facility geography, dependence-type splits, evidence tiers, …) — describes, does not implement
├── app/                  The site — Vite + React source, three entry points
│   ├── index.html          Vite entry → landing page (built output: index.html)
│   ├── intro.html          Vite entry → guide page (built output: intro.html)
│   ├── sscim-app.html      Vite entry → dashboard (built output: sscim-app.html)
│   ├── vitest.config.js    Vitest config (node environment, @vitejs/plugin-react for JSX)
│   ├── scripts/
│   │   ├── build-vault-snapshot.mjs   generates vault-snapshot.json from server/src/seed-data.js
│   │   └── audit-snapshot.mjs          read-only diagnostics over the committed snapshot — npm run audit:data
│   ├── src/
│   │   ├── landing/         Landing.jsx, main.jsx, i18n.js — marketing/positioning page
│   │   ├── intro/            Intro.jsx, main.jsx, i18n.js — guide/walkthrough page
│   │   ├── components/       Dashboard UI components (Header, FlowGraph, OsmMap, Detail, Briefing, Methodology, Tex, …) + *.test.js
│   │   ├── data/              VaultContext.jsx (fetches the API, falls back to vault-snapshot.json) + vault-snapshot.json + compMeta.js
│   │   ├── engine/             priors.js, math.js, graph.js, diagnostics.js, event-assumptions.js, index.js (buildEngine), buildModel.js + *.test.js
│   │   ├── i18n/                dashboard language dictionary + t()
│   │   ├── utils/                color/label/accessibility helpers (colors.js, a11y.js, tooltip.js) + tooltip.test.js
│   │   ├── App.jsx, main.jsx, theme.js   — dashboard root
│   ├── vite.config.js      multi-page build (rollupOptions.input: landing/intro/dashboard), base: './' (relative asset paths), outputs to ../dist-app
│   └── package.json        scripts: dev, build, test (vitest run), audit:data
└── server/               Local-dev-only vault — Node/Express + SQLite API (out of scope for the static deployment)
    ├── src/
    │   ├── db.js           schema (stages, companies, customers, owners, policies, events, scenarios, data_notes)
    │   ├── seed-data.js     current dataset (real-data-pass values, see §9) — source of vault-snapshot.json
    │   ├── data-notes.js    citations behind the headline corrections
    │   ├── seed.js          populates data/sscim.db from seed-data.js
    │   ├── routes/public.js  GET endpoints (including GET /api/bundle)
    │   ├── routes/admin.js   bearer-token-authenticated writes (PUT/POST/DELETE)
    │   └── index.js          Express app
    └── package.json
```

**Development:** `cd app && npm install && npm run dev` (serves all three pages on `:5173` — `/index.html`, `/intro.html`, `/sscim-app.html` — falling back to the static snapshot automatically with no backend running). Optionally, `cd server && npm install && cp .env.example .env && npm run seed && npm run dev` to also run the local API (`:8787`) and exercise the live-data code path.

**Verification:** `cd app && npm run audit:data && npm test && npm run build` — data-integrity diagnostics, the unit-test suite, then the production build (see §4, §6.3, and `.github/workflows/static.yml`, which runs the same three steps on every push to `main`).

**Production deployment (public site):** `app/` only. `npm run build` produces `dist-app/` containing all three built pages (`index.html`, `intro.html`, `sscim-app.html`) plus a shared `assets/` folder — deployed as-is to GitHub Pages by `.github/workflows/static.yml`. No backend is required or deployed; `VITE_API_BASE_URL` may optionally be set to point at a self-hosted `server/` instance, but the dashboard is fully functional without one via the bundled static snapshot.

---

## 11. Roadmap

**Model/data-layer roadmap:** see `MODEL_ROADMAP.md` for the specific deferred data work this model needs before it could be calibrated — facility geography, buyer-input vs. supplier-revenue vs. qualification dependence, capacity/utilization, inventory days, time-to-recover/time-to-switch, alternative-supplier counts, evidence-tiered market-share estimates and denominators (DRAM/NAND/HBM kept separate, merchant vs. captive AI accelerators kept separate, advanced-node vs. total foundry capacity kept separate), and backtesting the propagation priors against documented historical episodes. That document describes deferred work; it does not implement any of it.

**Product/business roadmap:**

1. **Demand validation** — structured demos with target users (funds, strategy teams, journalists, researchers); collect explicit willingness-to-pay signals before further build-out.
2. **Sourced database** — replace sample figures with cited, dated values for the highest-importance ~150–250 nodes; formalize the analyst rubric for substitutability and market sensitivity.
3. **GP News briefing launch** — weekly-to-daily briefing as the demand-validation and data-collection vehicle, using the manually curated internal graph.
4. **Live ingestion pipeline** — automated monitoring of official sources and trusted media, entity extraction and event classification with mandatory human review, automated event-to-node mapping.
5. **Calibration** — backtest propagation parameters (transmission coefficients, decay half-life) against documented historical episodes (2021 ABF substrate shortage, 2023 Ga/Ge licensing action, successive export-control rounds) before any score ships without a "sample data" label.
6. **Capital-flow layer expansion** — extend the capital layer from ownership stakes to directed money-flow edges: CHIPS Act/EU Chips Act/METI subsidy disbursements and announced fab investments as tracked flows on the same graph.
7. **Dashboard premium tier** — full interactive product (scenario mode, company impact analysis) as the paid tier once briefing subscribers validate demand.

---

## 12. Acknowledgements & Methodology Citations

The propagation/scoring model in §4 is original engineering, but its **architecture and stated limitations** draw on established results from network science, industrial-organization economics, and production-network macroeconomics. The citations below identify the specific concept each part of the model borrows, or the limitation it is designed to be honest about — **they are not a claim that any coefficient in this model has been calibrated to, validated against, or endorsed by the cited work.** None of the individuals or institutions below were consulted on, reviewed, or endorse SSCIM. Formatted per the *Chicago Manual of Style* (17th ed.), author-date system.

**Production-network shock propagation and the network-origins-of-fluctuations framing (§4.2, §4.4–§4.7)** motivate treating a supply chain as a directed graph whose structure shapes how idiosyncratic shocks aggregate — the specific dependence-proxy formulas and noisy-OR combination in this model are original, not drawn from these papers:

> Acemoglu, Daron, Vasco M. Carvalho, Asuman Ozdaglar, and Alireza Tahbaz-Salehi. 2012. "The Network Origins of Aggregate Fluctuations." *Econometrica* 80 (5): 1977–2016. https://doi.org/10.3982/ECTA9623.
>
> Carvalho, Vasco M., Makoto Nirei, Yukiko U. Saito, and Alireza Tahbaz-Salehi. 2021. "Supply Chain Disruptions: Evidence from the Great East Japan Earthquake." *Quarterly Journal of Economics* 136 (2): 1255–1321. https://doi.org/10.1093/qje/qjaa044.
>
> Barrot, Jean-Noël, and Julien Sauvagnat. 2016. "Input Specificity and the Propagation of Idiosyncratic Shocks in Production Networks." *Quarterly Journal of Economics* 131 (3): 1543–92. https://doi.org/10.1093/qje/qjw018. (Motivates §4.4's specificity term — input specificity shapes how strongly a supplier-side shock transmits downstream.)
>
> Inoue, Hiroyasu, and Yasuyuki Todo. 2019. "Firm-Level Propagation of Shocks Through Supply-Chain Networks." *Nature Sustainability* 2: 841–47. https://doi.org/10.1038/s41893-019-0351-x.
>
> Baqaee, David Rezza, and Emmanuel Farhi. 2019. "The Macroeconomic Impact of Microeconomic Shocks: Beyond Hulten's Theorem." *Econometrica* 87 (4): 1155–1203. https://doi.org/10.3982/ECTA15202.

**The topological sort underlying all-reachable-paths propagation (§4.5, §6.3)** uses Kahn's algorithm:

> Kahn, Arthur B. 1962. "Topological Sorting of Large Networks." *Communications of the ACM* 5 (11): 558–62. https://doi.org/10.1145/368996.369025.

**Geographic concentration (§4.3)** uses the Herfindahl-Hirschman Index:

> Hirschman, Albert O. 1945. *National Power and the Structure of Foreign Trade*. Berkeley: University of California Press.
>
> Herfindahl, Orris C. 1950. "Concentration in the U.S. Steel Industry." PhD diss., Columbia University.
>
> Rhoades, Stephen A. 1993. "The Herfindahl-Hirschman Index." *Federal Reserve Bulletin* 79 (3): 188–89.

**Risk-exposure indexing across a supply network (§4.2, §4.9)** motivates separating structural sensitivity from realized/operational impact:

> Gao, Sky (Xibei), David Simchi-Levi, Chung-Piaw Teo, and Zhaotong Yan. 2019. "Disruption Risk Mitigation in Supply Chains: The Risk Exposure Index Revisited." *Operations Research* 67 (3): 831–52. https://doi.org/10.1287/opre.2018.1776.

**Aggregation-limitation critique (throughout §4, §9)** — this model's explicit "structural vs. operational vs. scenario-delta" separation, its refusal to collapse hazard/mixed/strategic events into one signed number, and its sensitivity-envelope framing are motivated by documented risks of over-aggregating supply-chain network data into a single score:

> Diem, Christian, András Borsos, Tobias Reisch, János Kertész, and Stefan Thurner. 2022. "Quantifying Firm-Level Economic Systemic Risk from Nation-Wide Supply Networks." *Scientific Reports* 12: 7719. https://doi.org/10.1038/s41598-022-11522-z.

**Company disclosures** informing specific data-note corrections (§8, `server/src/data-notes.js`) — cited inline in the data files where a specific figure is drawn from them, not reproduced wholesale here:

> ASML Holding N.V. 2026. *Annual Report 2025*. Veldhoven: ASML.
>
> NVIDIA Corporation. 2026. *Form 10-K for Fiscal Year 2026*. Santa Clara, CA: U.S. Securities and Exchange Commission.
>
> Micron Technology, Inc. 2025. *Form 10-K for Fiscal Year 2025*. Boise, ID: U.S. Securities and Exchange Commission.
>
> Taiwan Semiconductor Manufacturing Company. 2026. *Annual Report 2025*. Hsinchu: TSMC.
>
> Tokyo Electron Limited. 2025. *Integrated Report 2025*. Tokyo: Tokyo Electron.
>
> Semiconductor Industry Association and Boston Consulting Group. 2021. *Strengthening the Global Semiconductor Supply Chain in an Uncertain Era*. Washington, DC: SIA/BCG.
>
> Center for Security and Emerging Technology, Georgetown University. 2021. "The Semiconductor Supply Chain." Issue Brief, January 2021. https://cset.georgetown.edu/publication/the-semiconductor-supply-chain/.
>
> Additional company 10-K/20-F/annual-report disclosures; SEMI capacity statistics; TrendForce, TechInsights, and Gartner market-share estimates, cited inline in the data files where a specific figure is drawn from them.

These citations are provided for methodological transparency and academic attribution — see §9 and `MODEL_ROADMAP.md` for what would actually be required before any coefficient here could be called calibrated.

---

*This document describes the current demo build. All company names, market shares, and events referenced are used for descriptive and illustrative purposes. Nothing in this document or the associated product constitutes investment advice.*
