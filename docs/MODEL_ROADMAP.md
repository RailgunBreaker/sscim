# SSCIM project roadmap

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

### Foundation release — delivered

The first release established the research model and the public exploration
interface:

- a versioned semiconductor supply-chain snapshot with 24 production stages
  and 34 directed dependencies;
- a deterministic propagation engine shared by historical events,
  hypothetical scenarios, and company-disruption analysis;
- map, industry-flow, topology, company, country, and event views;
- structural-vulnerability and operational-impact measures kept separate;
- declared and inspectable propagation priors, including a 12-day half-life;
- source notes, methodology, calculation examples, and data audits;
- a static publication that remains readable when the author's computer and
  local API are offline.

This release made the method reproducible, but updating evidence still
depended heavily on manual editing and the interface did not clearly separate
reviewed source material from generated proposals.

### Reviewed-vault release — delivered, current as of 30 July 2026

The current release turns the earlier snapshot into a reviewed publication
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

The current `downstreamTransmission`, `upstreamTransmission`,
`halfLifeDays`, `specificityFloor`, and noisy-OR combination are declared
priors, not fitted coefficients.

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
