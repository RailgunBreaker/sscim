# SSCIM — Semiconductor Supply Chain Intelligence Map

**A live intelligence layer over the global semiconductor supply chain**

Version: v4 (current build) · Status: working demo, pre-MVP1 · Data: curated sample, not yet sourced

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Product Architecture](#2-product-architecture)
3. [Data Model](#3-data-model)
4. [Risk & Impact Algorithm](#4-risk--impact-algorithm)
5. [Feature Reference](#5-feature-reference)
6. [Technical Implementation](#6-technical-implementation)
7. [Internationalization](#7-internationalization)
8. [Evidence Framework & Data Integrity](#8-evidence-framework--data-integrity)
9. [Known Limitations](#9-known-limitations)
10. [File Structure & Deployment](#10-file-structure--deployment)
11. [Roadmap](#11-roadmap)

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
│  16 countries, risk-colored  Value-weighted edges,           │
│  derived country links       importance-sized nodes          │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3: INTELLIGENCE PANEL                                 │
│  Event feed · Company impact rank · Movers · Capital rank    │
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

### 3.3 Companies (107)

Each company carries: a home country, a set of **stakes** — `{stageId: withinStageShare}` describing its production footprint, and (for ~45 of the 107) entries in the **customer graph** and/or **shareholder table**.

### 3.4 Customer graph (238 relationships)

A directed supplier→customer dataset: `supplier: [[customer, shareOfSupplierSales], ...]`. This is a *revenue relationship* dataset — "ASML → TSMC (35%)" means 35% of ASML's sales go to TSMC, which is a different quantity from how dependent TSMC is on ASML for lithography input. The product deliberately displays both numbers side by side wherever this distinction matters (see §4.5).

A reversed index (`SUPPLIERS`) is derived automatically from the customer graph for upstream-origin lookups.

### 3.5 Policy instruments (7)

Each policy carries a severity (0–10) and a list of affected stages, e.g. `{ id: "bis", sev: 9, stages: ["logic_ai","hbm","adv_fab","litho","depo","etch","metro"] }`. Policy exposure per stage is computed from this table, not hand-set.

### 3.6 Events (6 sample) and Scenarios (3 preset + unlimited custom)

Events carry severity, confidence (High/Medium/Low), age in days, affected stages/countries, first/second-order effect text, a background paragraph, a source citation, and a dated timeline. Scenarios inject a simulated event (severity, stages, `conf: "Simulated"`, `daysAgo: 0`) into the identical engine — including user-built custom scenarios via the in-app Scenario Builder.

### 3.7 Shareholder table (sample)

For ~25 major companies, a list of `[ownerName, ownershipShare]` pairs sourced from the pattern of public disclosures (13F filings, annual reports). State-linked capital (sovereign funds, government stakes, SOEs) is flagged.

---

## 4. Risk & Impact Algorithm

### 4.1 Node risk score

$$\text{risk} = 0.25\,C_{\text{choke}} + 0.20\,C_{\text{geo}} + 0.20\,C_{\text{policy}} + 0.15\,C_{\text{subst}} + 0.10\,C_{\text{shock}} + 0.10\,C_{\text{market}}$$

Four of six components are **computed**; two are **declared analyst inputs**. Every score breakdown in the UI tags each component with its source: `[GRAPH]`, `[HHI]`, `[POLICY DB]`, `[EVENT ENGINE]`, or `[ANALYST]`.

### 4.2 Chokepoint centrality — computed from graph structure

Path-participation centrality on the DAG: how many source→sink production paths run through a node.

$$\text{through}(n) = \text{pathsTo}(n) \times \text{pathsFrom}(n), \qquad C_{\text{choke}}(n) = 10\sqrt{\frac{\text{through}(n)}{\max_m \text{through}(m)}}$$

`pathsTo` and `pathsFrom` are computed via topological sort (Kahn's algorithm) in $O(V+E)$. The square root compresses the distribution so mid-tier nodes aren't crushed toward zero.

### 4.3 Geographic concentration — Herfindahl-Hirschman Index

Standard HHI over each stage's country market shares:

$$C_{\text{geo}}(n) = 10\sum_i \text{share}_i^2$$

A single-country monopoly (e.g. lithography: NL 80%, JP 20%) scores $10(0.8^2+0.2^2)=6.8$.

### 4.4 Policy exposure — from the policy-instrument database

$$C_{\text{policy}}(n) = \min\left(10,\ \max_p \sigma_p + 0.4\sum_{p \neq \text{max}} \sigma_p\right)$$

where $\sigma_p$ is the severity of each policy instrument affecting node $n$. The dominant policy sets the floor; secondary policies add a damped increment.

### 4.5 Stage importance — structural × economic

$$I_n = 10\left(0.6\cdot\frac{C_{\text{choke}}(n)}{10} + 0.4\cdot\frac{\ln v_n}{\ln v_{\max}}\right)$$

Blends graph centrality with log-compressed economic value (so a high-volume, low-differentiation stage like final assembly doesn't dominate purely on revenue). Used to weight every aggregate index below, and rendered visually as node/dot size in the flow graph.

### 4.6 Value-weighted edges

$$w_{a\to b} = \frac{v_b}{\sum_{c \,\in\, \text{out}(a)} v_c}$$

Each edge's weight is the destination stage's share of value among its siblings. Rendered as edge thickness in the flow graph.

### 4.7 Event shock — decay and propagation

Source shock at the event's origin stage(s):

$$s_0 = \sigma \cdot \kappa_{\text{conf}} \cdot e^{-d/12}$$

where $\sigma$ is severity (0–10), $\kappa_{\text{conf}} \in \{1.0, 0.75, 0.5\}$ for High/Medium/Low confidence (Simulated events use 1.0), and $d$ is days since the event — giving roughly a 12-day half-life.

Propagation from the source outward:

$$f_{\downarrow}(a\to b) = 0.55\,(0.5 + 0.5\,w_{a\to b}), \qquad f_{\uparrow} = 0.30$$

Downstream shock travels up to 2 hops, each hop multiplying by $f_\downarrow$ using that specific edge's value weight (so shock spreads more strongly along high-value paths). Upstream shock travels 1 hop at a flat $0.30$ multiplier (suppliers feel a demand-side echo, not a full mirror of the downstream effect). Where multiple events affect the same node, the node takes the **maximum** shock across all sources — shocks don't naively sum, avoiding runaway values when many events cluster on one stage.

### 4.8 Chain Impact Index — one comparable number per shock field

$$\text{CII/EII} = \frac{\sum_n s_n \, I_n}{\sum_n I_n}$$

An importance-weighted mean of the propagated shock field across all 24 nodes. Applied to an event's shock field, this is the **Event Impact Index (EII)** shown on every event card. Applied to a company-disruption shock field, it's the **Company Impact Index (CII)**.

### 4.9 Company Impact Index — simulated disruption

$$s_0(\text{stage}) = 10 \cdot \text{share}_{c,\text{stage}} \quad \Rightarrow \quad \text{propagate} \quad \Rightarrow \quad \text{CII}_c = \frac{\sum_n s_n I_n}{\sum_n I_n}$$

To simulate "what if company $c$ were fully disrupted," the engine injects a shock at every stage $c$ occupies, sized to $10\times$ its within-stage production share, with confidence 1.0 and zero decay — then runs the *identical* propagation function used for live events. The resulting per-node shock field is aggregated into the CII. Companies are ranked by this index; the ranking is a mathematical output, not an asserted list.

### 4.10 Company exposure — footprint-weighted mean

$$e_{c,\text{stage}} = \text{share}_{c,\text{stage}} \times s_{\text{stage}}, \qquad \bar e_c = \frac{\sum_{\text{stage}} \text{share}_{c,\text{stage}}\, s_{\text{stage}}}{\sum_{\text{stage}} \text{share}_{c,\text{stage}}}$$

Given *any* shock field (from a live event, a scenario, or another company's disruption), this computes how exposed a specific company is — used for the "most-exposed companies" list on every event and for the customer-graph spread trees.

### 4.11 Country scores — fully derived

Every country's six components are the **share-weighted average** of the components of every stage it participates in, plus direct country-tagged event shock (max-combined in). No country score is hand-set anywhere in the model; the map layer is a pure function of the stage-level data.

### 4.12 Capital Power Index

$$\text{CPI}_o = \sum_c \text{own}_{o,c} \cdot \text{CII}_c$$

For each owner $o$ (a fund, a government entity, a family holding), sum their ownership share in each company weighted by that company's Company Impact Index. This produces a ranking of "who holds rights over the chain's most structurally important capacity" — distinct from simple market-cap-weighted ownership rankings, because it's weighted by *chain criticality*, not just company size.

### 4.13 Computed history

$$\text{ChainIndex}(t) = \frac{\sum_n \text{total}(\text{stage}_n, \text{shock}_t)\, I_n}{\sum_n I_n}, \qquad \text{shock}_t = \text{propagate}\big(\{e : e.\text{daysAgo} - t \geq 0\}\big)$$

The 21-day sparkline and the "Movers 7D" list are not decorative — they re-run the *entire* engine at each past day by shifting every event's `daysAgo` back in time and re-propagating. This means historical values are internally consistent with the live model rather than being a separately-maintained time series.

---

## 5. Feature Reference

| Feature | Description |
|---|---|
| **World Map** | Real OpenStreetMap geography (CARTO dark basemap, OSM-tile fallback), 16 countries, node size = chain participation, color = risk score |
| **Derived country links** | Connections between countries computed from the 238-relationship customer graph — hover shows sectors and example company pairs, not manually asserted arcs |
| **Industry Flow Graph** | 24-stage DAG, edge thickness = value weight, node size = computed importance, tap to open a stage subsection |
| **Stage subsections** | Per-stage company list with market-share bars, live shock exposure, and each company's top customers with percentages |
| **Company detail** | Company Impact Index, production footprint, customers & suppliers with sales shares, major shareholders, two-layer upstream origin trace, two spread trees |
| **Customer-graph spread tree** | Named-relationship propagation: source → direct customers → their customers, with path-weight percentages and engine-computed exposure |
| **Stage-level spread tree** | Structural propagation view: hop 0/1/2 by graph distance, top 5 companies per hop |
| **Upstream origins tree** | Two supplier layers *behind* any company, via the reversed customer graph |
| **Company Impact Rank** | All 107 companies ranked by CII — the answer to "whose disruption hurts the chain most?" |
| **Capital Power Rank** | Shareholders ranked by ownership × chain-impact; state-linked capital flagged |
| **Movers 7D** | Stages ranked by absolute score change over the trailing week, computed via engine replay |
| **21-day sparkline** | Chain-wide risk index recomputed at each of the past 21 days |
| **Scenario presets** | Taiwan Strait crisis, China materials ban, Export controls max — each a pre-configured simulated event |
| **Scenario Builder** | User selects any stages, sets severity, names it, and runs a fully custom simulated event through the engine |
| **Global search** | Jump to any stage, company, or country by name |
| **GP Briefing generator** | Composes a full daily intelligence briefing from live model state — what changed, most-shocked nodes, company exposure leaders, country risk board, watch-next; copy or download as .txt |
| **Rich event detail** | Background paragraph, source citation, dated confidence timeline, and computed most-exposed-companies list per event |
| **Company logos** | Favicon-based identification for all 107 companies via each company's official domain, with monogram fallback |
| **In-app Guide** | Seven-step walkthrough, fully localized |
| **Methodology overlay** | Every formula (rendered in TeX/KaTeX), every propagation constant, explicit computed-vs-analyst source tags, and stated limitations |
| **Language switcher** | English, Simplified Chinese, Traditional Chinese, Japanese — UI chrome and guide fully translated (see §7) |

---

## 6. Technical Implementation

### 6.1 Stack

- **React 18** (function components, hooks: `useState`, `useEffect`, `useMemo`, `useRef`)
- **Leaflet 1.9.4** for the map layer, with CARTO dark tiles (OpenStreetMap data) and automatic fallback to standard OSM tiles
- **KaTeX 0.16.9** for formula rendering, loaded on demand
- No build step in the shipped artifact: React, ReactDOM, and Babel Standalone load from cdnjs; JSX transpiles in-browser
- No backend, no database — the entire computed model lives in a single `useMemo` block, recalculated when the scenario selection changes

### 6.2 Why a single computed model

The core engineering decision is that **nothing about risk, importance, or impact is stored — everything is derived at render time** from the four source tables (`STAGES`, `COMPANIES`, `CUSTOMERS`, `POLICIES`) plus whichever events/scenario are active. This means:

- Adding a new company, policy, or event automatically ripples through every dependent number (risk scores, rankings, spread trees, briefings) with no manual recalculation
- The "one engine, three uses" claim is structurally true, not just a marketing description — `propagate()` is one function called with three different input shapes
- The historical sparkline is trivially consistent with the live state, since it's the same function called with shifted event ages

The tradeoff: all computation happens client-side on every model-affecting state change. At current scale (24 stages, 107 companies, 34 edges) this is sub-millisecond and imperceptible. A production version ingesting hundreds of nodes and thousands of daily events would need to move propagation server-side and cache aggressively — the algorithm doesn't change, only where it executes.

### 6.3 Graph algorithms used

- **Topological sort** (Kahn's algorithm) to establish a valid processing order over the DAG, required before computing path-participation centrality
- **Forward/backward path counting** (`pathsTo`, `pathsFrom`) via single passes over the topological order — $O(V+E)$
- **Bounded-hop BFS-style propagation** (2 hops downstream, 1 hop upstream) rather than full graph diffusion, keeping shock computation fast and the effect interpretable ("this is a direct effect, this is second-order")
- **Max-combination** rather than summation when merging multiple shock sources onto one node, preventing unbounded accumulation

### 6.4 Rendering approach

The map and flow graph are both hand-built (Leaflet API calls for the map; raw SVG for the flow graph) rather than using a generic charting library — this gives full control over interaction (tap-to-highlight across layers), styling (the copper/terminal aesthetic), and the specific visual encodings the product needs (edge width = value weight, node size = importance, which no off-the-shelf chart type expresses directly).

### 6.5 Logo system

Company identification uses each company's official domain plus Google's public favicon service (`google.com/s2/favicons?domain=...`), a standard nominative-use pattern (the same approach used by many financial and news apps) rather than embedding or redistributing trademarked artwork. Failed loads degrade to a generated two-letter monogram — the UI never shows a broken image.

---

## 7. Internationalization

The product ships with English, Simplified Chinese (简体), Traditional Chinese (繁體), and Japanese (日本語) support via a lightweight in-house dictionary (no external i18n framework, to keep the standalone-file, zero-build-step property).

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

## 9. Known Limitations

**All figures are sample data.** Every market share, company stake, customer percentage, stage value, policy severity, shareholder stake, and event is illustrative — chosen to be directionally realistic but not individually cited. This is disclosed in-product (footer, briefing output, methodology) and must not be represented as sourced until Phase 1 data work is complete.

**Edges are value-weighted, not capacity-constrained.** The model captures relative value flow between stages but does not model absolute production capacity or bottleneck saturation — a real capacity-constrained shock (e.g., a fab physically destroyed) would propagate differently than the current value-weight-only model predicts.

**Propagation constants are unvalidated priors.** The 0.55 downstream factor, 0.30 upstream factor, and 12-day decay half-life were chosen to produce directionally sensible behavior, not fit to data. Section 11 outlines the calibration plan.

**Customer-graph relationships are one axis of dependency.** A supplier's sales share to a customer is not the same as that customer's *input* dependence on the supplier (ASML → TSMC at 35% of ASML's sales does not mean TSMC is 35% dependent on ASML — for EUV specifically, it's closer to complete dependence). The product surfaces both the relationship percentage and the engine-computed exposure number side by side specifically to prevent this conflation, but the underlying dataset does not yet capture reverse (input-side) concentration explicitly.

**Long-tail coverage is incomplete by design.** Stage company lists show a curated top set plus an "Others" remainder; 107 companies is a deliberate ceiling — beyond this, additional entries add sourcing burden without materially changing chain-impact rankings.

**Shareholder data ages quickly.** Ownership stakes shift quarterly; this is the most compliance-sensitive dataset in the product and requires the tightest citation-and-date discipline in production.

**Client-side computation ceiling.** As noted in §6.2, the current single-model-in-memory architecture is appropriate at demo scale but would need server-side computation and caching at production data volumes.

---

## 10. File Structure & Deployment

| File | Purpose |
|---|---|
| `sscim-app.html` | The complete standalone product — single file, no build step, React/Babel from CDN |
| `sscim-v4.jsx` | Source JSX (same code, as an editable React component, for further development) |
| `index.html` | Commercial landing page — positioning, use cases, pricing tiers |
| `intro.html` | Introduction and user guide page |
| `README-launch.md` | Deploy instructions and the two-week validation playbook |
| `SSCIM-status-report.md` | Project status and phased roadmap (companion document to this one) |

**Deployment:** any static host works. Drag the HTML files onto Netlify Drop, or push to a GitHub Pages repository — no server, no environment variables, no build pipeline. External dependencies are limited to the cdnjs script CDN, Google Fonts, CARTO/OpenStreetMap tile servers, and the Google favicon service.

---

## 11. Roadmap

Phased plan (detailed further in `SSCIM-status-report.md`):

1. **Demand validation** — structured demos with target users (funds, strategy teams, journalists, researchers); collect explicit willingness-to-pay signals before further build-out.
2. **Sourced database** — replace sample figures with cited, dated values for the highest-importance ~150–250 nodes; formalize the analyst rubric for substitutability and market sensitivity.
3. **GP News briefing launch** — weekly-to-daily briefing as the demand-validation and data-collection vehicle, using the manually curated internal graph.
4. **Live ingestion pipeline** — automated monitoring of official sources and trusted media, entity extraction and event classification with mandatory human review, automated event-to-node mapping.
5. **Calibration** — backtest propagation parameters (hop factors, decay constant, confidence weights) against documented historical episodes (2021 ABF substrate shortage, 2023 Ga/Ge licensing action, successive export-control rounds) before any score ships without a "sample data" label.
6. **Capital-flow layer expansion** — extend the capital layer from ownership stakes to directed money-flow edges: CHIPS Act/EU Chips Act/METI subsidy disbursements and announced fab investments as tracked flows on the same graph.
7. **Dashboard premium tier** — full interactive product (scenario mode, company impact analysis) as the paid tier once briefing subscribers validate demand.

---

*This document describes the current demo build. All company names, market shares, and events referenced are used for descriptive and illustrative purposes. Nothing in this document or the associated product constitutes investment advice.*
