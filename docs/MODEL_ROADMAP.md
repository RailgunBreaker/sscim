# SSCIM project roadmap

**Model version:** `sscim-model-v7.1-exposure-robustness`. The canonical
specification is [`docs/MODEL_V7_SPEC.md`](MODEL_V7_SPEC.md); its
[§11](MODEL_V7_SPEC.md#11-limitations-and-calibration-roadmap) states the data
each parameter would need and the five steps that must be completed before any
parameter may be promoted from `status: assumption` to `status: calibrated`.


This roadmap records what SSCIM has already delivered, what changed from the
earlier release, and what the project intends to build next. It is both a
public progress record and a planning document for contributors.

SSCIM is currently an **explainable sensitivity model**, not a calibrated
forecasting system. A planned item is not evidence that the data, model, or
interface already supports it.

## Status labels

| Label | Meaning |
| --- | --- |
| **Delivered** | Implemented, documented, and available in the current codebase |
| **In progress** | Work has started, but is not yet a dependable public capability |
| **Planned** | Agreed direction; design and implementation remain |
| **Research prerequisite** | Requires new evidence, definitions, or validation before implementation would be defensible |

## Release history

A dated, public version of this history — with the limits of each capability
stated alongside it — is published at [updates.html](../updates.html). Both are
generated from the same entries in `app/src/data/releases.js`, so the page and
this document cannot drift apart.

### Evidence operations — delivered 9 September 2026

Collection became continuous rather than occasional, and every new claim landed
with the boundary that keeps it honest.

- an **hourly local workflow** that refreshes original disclosures, captures and
  scores the prospective forecast, checks source availability and document
  hashes, ingests news, reruns every evidence evaluator and exports the catalog,
  under a lock, with per-step status and a degraded-run marker;
- one **prospective revenue forecast** captured before its outcome, with input
  dataset, protocol and engine archived by content hash — one captured, zero
  scored, one pending;
- **four disclosed-loss accounting scopes** — reconciliation, supplier
  allocation, physical production losses and reimbursement follow-up — which
  are never added together and leave unknown attribution null;
- a **recovery-duration fit** over six reported factory recoveries that beats
  the 60-day default in one temporal test, loses to simpler predictors overall,
  and promotes no global parameter;
- a **queryable JSON/SQLite catalog** of every analytical dataset, with
  per-record evidence status, sources and typed scalar leaves.

None of it establishes prospective accuracy or chain-wide loss: the captured
forecast has no outcome yet, the historical tests reuse inspected samples, and
the loss ledgers cover selected issuers rather than the chain.

### Live-first release — delivered, current as of 22 August 2026

The dashboard stopped offering ways to invent events and started offering the
two things the record can actually support: what the chain looked like in the
past, and what an individual reader needs to watch.

- **scenario authoring removed** — the four preset crises, the draft composer,
  the scenario builder and the propagation playback controls. A tool whose
  claim is that its events are dated, sourced and human-reviewed should not
  spend its main interface on invented ones;
- **history review** — a slider that re-derives the entire model, not just the
  chart, using the current network and model for a past date, using the engine's own back-dating rule;
- an event timeline where each marker is sized by that event's **marginal**
  contribution to the index on its own day, since propagation saturates and
  standalone magnitudes do not add up;
- a **watchlist** for specific companies, products (chain stages), plants, or a
  route through the chain, stored in the reader's browser and deliberately
  never written into a shared link;
- plant markers that carry function in their **shape** and live effect in their
  **colour**, so the map reads as geography at rest and stays legible without
  colour vision;
- one remaining hypothesis — the hazard overlay — shown in amber, labelled, and
  cleared in one click.

### Site-layer release — delivered 22 August 2026

A country marker cannot answer the question an earthquake asks, because a
hazard happens at a point.

- 244 named production and R&D sites covering all 109 modeled companies across
  the 16 modeled countries, with operator, coordinates, output, stage mapping
  and operating status;
- a hazard footprint tool reporting the plants inside a radius and the share of
  each stage's modeled sites they carry;
- a standardized, generated profile for every site, so two profiles differ only
  where the sites differ;
- a derived site-to-site network composed from the company customer table and
  the stage flow graph;
- audit checks that hard-fail a dangling site or a stub profile.

The site layer knows where plants are and what they make; it does not know how
much they make. Significance is a 1–5 analyst ordinal, so every share it
reports is a share of the modeled sample and never of world capacity.

### Foundation release — delivered

The first release established the research model and the public exploration
interface:

- a versioned semiconductor supply-chain snapshot with 24 production stages
  and 34 directed dependencies;
- a deterministic propagation engine shared by historical events,
  hypothetical scenarios, and company-disruption analysis;
- map, industry-flow, topology, company, country, and event views;
- structural-vulnerability and operational-impact measures kept separate;
- declared and inspectable propagation priors, including the per-incident persistence half-lives and durations;
- source notes, methodology, calculation examples, and data audits;
- a static publication that remains readable when the author's computer and
  local API are offline.

This release made the method reproducible, but updating evidence still
depended heavily on manual editing and the interface did not clearly separate
reviewed source material from generated proposals.

### Reviewed-vault release — delivered 30 July 2026

This release turned the earlier snapshot into a reviewed publication
workflow while retaining the static fallback:

- a SQLite evidence vault and an Express API for events, companies,
  relationships, policies, ownership, computed history, and briefings;
- a scheduled candidate pipeline that fetches source material, drafts
  structured proposals, checks duplicates, and sends candidates to human
  review;
- an administrator dashboard for reviewing, approving, rejecting, and
  publishing candidates without exposing an administrator-login link in the
  public navigation;
- an audit-and-test publication gate: approved changes generate a fresh
  snapshot and are committed only when validation succeeds;
- a Cloudflare Tunnel path for the live API, with the latest versioned static
  snapshot retained as the public fallback;
- a reviewed “What changed” briefing and a briefing archive backed by the
  vault rather than hard-coded page copy;
- resizable map, supply-chain, and Chain Index History panels;
- Chain Index History windows for 3 days, 7 days, 30 days, 6 months, 1 year,
  5 years, and all available history;
- a redesigned topology workspace with clearer guidance, selectable nodes and
  routes, connection inspection, comparison, and reversible edge sketching;
- a responsive documentation reader with a document tree, in-document heading
  navigation, automatic Markdown discovery, equations, and separate public,
  academic, developer, architecture, data, and methodology guides;
- a modernized visual system, improved typography, a visible white logo, and
  removal of the duplicate methodology panel from the dashboard.

#### What changed from the foundation release

| Area | Foundation release | Current release |
| --- | --- | --- |
| Publication | Manually maintained static snapshot | Reviewed vault feeds a tested, versioned snapshot |
| Evidence intake | Direct data editing | Candidate → human decision → audit → publication |
| Availability | Static public site | Live API when reachable, static fallback at all times |
| Event briefing | Page-level snapshot text | Reviewed vault briefing and archive |
| History | Fixed presentation | Resizable chart with seven time windows |
| Topology | Dense network display | Guided, interactive analysis workspace |
| Documentation | Separate Markdown files | Searchable document and heading navigation |
| Administration | Script-oriented review | Dedicated operations dashboard |

## Planned releases

The order below expresses dependency, not a promised delivery date.

### 1. Operational hardening — planned

The next engineering release should make the reviewed-vault workflow easier to
operate and diagnose:

- run the local API and tunnel as managed background services with restart and
  health checks;
- show pipeline runs, audit results, publication commits, and useful failure
  logs in the administrator dashboard;
- add documented backup, restore, and database-migration procedures;
- add a public, citation-first archive for reviewed events and source articles,
  distinct from the existing briefing archive;
- make publication status explicit: approved in the vault, included in a
  snapshot, committed, deployed, or failed at a gate;
- strengthen duplicate-event review so one disruption represented by several
  articles is not counted several times;
- evaluate an optional managed always-on API without removing the static
  fallback.

**In progress as of 9 September 2026.** An hourly local workflow
(`node server/scripts/run-operations.mjs`) refreshes original disclosures,
captures and scores the prospective forecast, checks source availability and
document hashes, ingests news, reruns every evidence evaluator and exports the
structured catalog. It records per-step status, attempts and timestamps, marks
a run degraded when a required step fails, and holds a workflow lock so two
copies cannot write at once. This is a local scheduled task on one machine, not
a managed service: it does not publish, approve events, or deploy, and the
machine's own task status is the authoritative execution state. See
[structured evidence and prospective operations](STRUCTURED_EVIDENCE.md).

### 2. Historical and research access — planned

- retain longer, denser Chain Index and event histories;
- let readers move from a chart point to the events, assumptions, and sources
  that produced it;
- export reproducible research bundles containing the commit, snapshot date,
  parameters, selected event or scenario, outputs, and citations;
- publish machine-readable data dictionaries and schema versions;
- add accessibility review, keyboard-complete network controls, and improved
  small-screen analysis layouts.

### 3. Data-layer expansion — research prerequisite

The current graph is stage-level and intentionally does not pretend to contain
facility capacity, physical trade flow, inventory, or switching constraints.
The following data must be acquired and defined before a capacity-constrained
or time-dependent model would be credible.

#### Dependence types that must remain separate

The current directional dependence matrices are equal-allocation priors
derived from graph in/out-degree and one analyst-judgment substitutability
score. A future data layer needs separate measures for:

- **buyer input dependence** — the fraction of buyer B's physical input that
  comes from supplier A;
- **supplier revenue dependence** — the fraction of supplier A's revenue that
  comes from buyer B;
- **qualification dependence** — whether B can technically source the same
  input from an alternative supplier;
- **capacity and utilization** — whether another supplier can absorb shifted
  demand;
- **inventory days** — the buffer between a disruption and a downstream
  production effect;
- **time to recover and time to switch** — distinct recovery and alternate-
  qualification clocks;
- **alternative-supplier count** — an observed measure kept separate from the
  current 0–10 substitutability judgment.

#### Geography that must not be conflated

- **Facility geography** identifies actual production sites. It cannot be
  inferred from company headquarters or aggregate country-stage shares.
- **Headquarters geography** is already displayed as headquarters and must not
  stand in for production location.
- **Shipping and logistics geography** requires physical routes, ports,
  straits, airfreight lanes, and chokepoints. Current geopolitical scenarios
  shock linked stages; they do not simulate transport routes.
- **End-customer geography** describes where output is consumed. Current
  country scores describe production-side participation.

#### Market denominators and units that must not be merged

- **DRAM, NAND, and HBM** need separate denominators. HBM is already a separate
  stage; `memory_fab` still uses a documented revenue-weighted DRAM/NAND blend
  as a stopgap.
- **Merchant AI accelerators and captive hyperscaler ASICs** are different
  markets. The current `logic_ai` entries do not all share a directly
  comparable denominator and remain audit-flagged.
- **Advanced-node capacity and total foundry revenue** are different measures.
  The current `adv_fab` shares are capacity-weighted judgments rather than one
  disclosed, unit-consistent series.
- Every share should carry an estimate type, unit, date, source, denominator,
  and evidence tier.

#### Relationship-percentage semantics

Each supplier-to-customer percentage must state whether it is a supplier
revenue share or a buyer input share. These numbers describe different sides
of the same edge and are not interchangeable. The current named relationship
dataset discloses the former; it does not establish the latter.

### 4. Time- and capacity-aware model — planned after the data layer

Once the required observations exist, the project can design and test:

- inventory-buffered propagation rather than instantaneous edge transmission;
- capacity limits, utilization, and alternative-supplier ramp constraints;
- facility-level and logistics-route disruptions;
- explicit recovery curves and scenario durations;
- uncertainty ranges and sensitivity results for all newly measured inputs.

This would be a new model version. It must not silently change historical
scores computed under the current stage-level method.

### 5. Calibration and validation — research prerequisite

Every parameter in `app/src/engine/registry.js` is `status: assumption`:
the transmission coefficients, the three persistence durations, the minimum
dependency factor, the ramping-site weight, the structural weights, and every
categorical model form are declared priors, not fitted coefficients. The
canonical list, with each one's range and rationale, is
[spec §5](MODEL_V7_SPEC.md#5-parameter-register).

A defensible calibration programme would:

1. define observable outcomes before fitting;
2. assemble documented disruption episodes with dated downstream effects,
   such as the 2021 ABF substrate shortage, the 2023 gallium/germanium
   licensing action, and successive export-control rounds;
3. separate training events from held-out evaluation events;
4. compare the current method with transparent baselines;
5. report error measures, goodness-of-fit, sensitivity, missing-data rules,
   and failure cases;
6. publish the dataset and procedure sufficiently for independent
   reproduction.

Until that work succeeds, SSCIM outputs remain comparative modeled
sensitivities—not probabilities, forecasts, realized losses, or investment
signals.

**Where this stands on 9 September 2026.** Steps 1, 3, 4 and 5 have been
carried out for two scoped targets, and neither promoted a model parameter:

- a historical TSMC revenue nowcast that beats its declared baselines on
  original source vintages, with one prospective forecast captured, pending and
  unscored — [predictive validation](PREDICTIVE_VALIDATION.md);
- a recovery-duration fit over six reported factory recoveries across five
  incidents, which beats the 60-day global default on the one 2026 temporal
  test and loses to both the issuer's own target and a simple empirical median
  overall — [recovery calibration](RECOVERY_CALIBRATION.md).

Every parameter in `app/src/engine/registry.js` therefore still reads
`status: assumption`. Reported disruption losses are accumulating in four
separate accounting scopes that cannot be added together
([chain loss accounting](CHAIN_LOSS_ACCOUNTING.md)), which is evidence about
the outcomes step 2 would need — not the held-out chain-wide outcome set that
calibration requires.

## Release gates

Every future public release should satisfy all applicable gates:

1. **Evidence** — claims have stable sources, dates, definitions, and evidence
   tiers.
2. **Human review** — automated analysis may draft a candidate but cannot
   approve it.
3. **Model integrity** — units, denominators, graph rules, and assumptions pass
   the data audit.
4. **Regression safety** — computation, API, UI, and publication tests pass.
5. **Reproducibility** — the commit, snapshot date, model version, and
   parameters can be recovered.
6. **Documentation** — public meaning, developer impact, migration, and known
   limitations are updated with the code.
7. **Resilience** — a failed live service or publication run leaves the last
   good static release available.

## How contributors should use this roadmap

Open a contribution against one named roadmap item and state its status.
Research-prerequisite items should begin with evidence and definitions, not a
UI control or an invented coefficient. When an item is delivered, move it into
the release history with the commit and snapshot in which it became public.

For the current equations, read the [Methodology](METHODOLOGY.md). For concrete
inputs and outputs, read [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md).
For deployment and fallback behaviour, read the
[System architecture](SYSTEM_ARCHITECTURE.md).


## Public research review correction — 2026-09-06

Application patch 0.7.2 retains the v7.1 model identifier and global defaults; the data revision is `public-review-2026-09-06`. The factual baseline excludes unresolved claims independently of confidence. Exposure magnitudes remain explicit assumptions. Company coefficients have unresolved denominators and rankings are illustrative. Recovery evidence applies only to the documented component after publication. Historical calculations are **current-model retrospective replay**, distinct from archived contemporaneous outputs and genuine point-in-time validation requiring dated input vintages. Missing coverage and neutral scores do not establish safety. See the [implementation report](PUBLIC_RESEARCH_REVIEW.md) and [canonical specification](MODEL_V7_SPEC.md).
