# SSCIM: Semiconductor Supply Chain Intelligence Map

SSCIM is an explainable research tool for exploring how a semiconductor disruption may move through a modeled supply chain. It combines a world map, a directed stage graph, a facility network, company footprints, and reviewed historical events over a single computational engine.

The application now opens with [documented observations and supplier disclosures](OBSERVED_DATA.md), including a public-source fab-capacity dataset. The assumption model is available through **Explore assumption model**. Observed data, conditional input-exposure calculations, and research scores have separate evidence requirements.

SSCIM includes a [historically tested TSMC revenue nowcast](PREDICTIVE_VALIDATION.md). The supply-chain research model remains uncalibrated. SSCIM does not provide a live trading signal, measured trade-flow model or investment advice.

An hourly local workflow now collects, evaluates and exports the evidence
described in [structured evidence and prospective operations](STRUCTURED_EVIDENCE.md):
every analytical dataset is exported to a queryable JSON/SQLite catalog, one
prospective revenue forecast is captured and pending, and four disclosed-loss
accounting scopes are reconciled in [chain loss accounting](CHAIN_LOSS_ACCOUNTING.md).
A scoped [recovery-duration fit](RECOVERY_CALIBRATION.md) over six reported
factory recoveries is available for research and promotes no global parameter.
Prospective accuracy and chain-wide loss remain unestablished.

## What it is for

- **General readers** — understand why a material, equipment supplier, fab, or region can matter far beyond its own borders. Start with the [public guide](PUBLIC_GUIDE.md).
- **Analysts and teams** — compare modeled exposure, trace pathways between plants and functional centres, and screen hazard footprints, with every assumption visible.
- **Researchers** — inspect a reproducible sensitivity model rather than a black-box risk score. Start with the [academic guide](ACADEMIC_GUIDE.md).
- **Contributors** — add evidence through a reviewed, auditable pipeline. Start with the [developer guide](DEVELOPER_GUIDE.md).

## Why this exists

Semiconductors are the most geopolitically concentrated industry in the world. One company in the Netherlands makes every EUV lithography machine. One island fabricates most leading-edge logic. Two Korean firms dominate HBM memory.

Existing maps of that structure — consortium charts, research-body diagrams, static infographics — are good at showing **where things are**. They are not built to show **what changes**: when an export rule lands or a fab halts, which nodes become newly exposed, how far the effect reaches, and what to watch next. SSCIM fills that gap with an engine you can interrogate rather than a score you have to trust.

## How it works

The model contains 24 production stages across seven tiers — research and IP, materials, equipment, fabrication, chip products, backend, systems, and end markets — connected by 34 directed edges describing declared production dependencies. Country-stage shares and company stakes locate real activity within that structure.

An incident seeds a signed shock across the stages it touches, scaled by a curated per-stage exposure. The engine ages it with the persistence profile curated for that incident, propagates the whole incident jointly across every reachable path using declared downstream and upstream transmission priors, combines separate incidents with a bounded rule, and aggregates the result.

The same code path serves reviewed historical events, a hazard footprint you place on the map, and company-disruption analysis. **Change the input, not the method** — that is what makes the three comparable.

Results appear across four synchronized views:

1. **Geographic** — every named plant on a world map, the modeled links between them, and a hazard radius you can place anywhere. Country-level exposure is drawn by production geography rather than headquarters.
2. **Industry flow** — stage-level structure and propagation.
3. **Topology** — derived country × stage functional centres and modeled routes, with reachability, betweenness, and reversible node/edge removal.
4. **Facility Playground** — pick one named plant and trace the modeled network around it: suppliers left, customers right, one hop or three or everything reachable, with expansion, collapse, recentring, filters, and a complete connection table. Every connection is a **modeled stage-mediated relationship**, never a confirmed shipment, customer contract, or trade route.

The whole of that state — view, pinned entity, reviewed date, and the entire playground exploration — is encoded in the URL, so a view can be linked and reproduced.

Read the explanation, source, confidence label, and assumptions before using any score.

## What the model separates, deliberately

- **Structural vulnerability** (time-invariant) from **operational impact** (event-driven). Blending them would produce a number that moves for two incompatible reasons.
- **Evidence quality** from **effect size**. Confidence is reported alongside a magnitude, never multiplied into it.
- **Company vulnerability** from **contribution** from **criticality** — three distinct questions, three separately labeled numbers.
- **Downstream input dependence** from **upstream revenue dependence**. A supplier's sales share to a customer is not the customer's dependence on that supplier.
- **Baseline history** from **the hazard overlay**. A hazard footprint is a bounded screening hypothesis, shown as a comparison against the live reading, and never rewrites the past.
- **One incident** from **several reports of it**. Distinct incidents accumulate through a bounded operator that is monotone — right for separate disruptions, wrong for repeated coverage of one. Records describing the same incident are therefore grouped *before* anything is scored: exactly one is scored, the rest are published as updates or recovery reports with their own sources and their own assessments.
- **A modeled relationship** from **an observed one**. No dataset here records which plant ships to which plant, so every facility-to-facility connection is labelled modeled, at every hop depth.

## Start here

| You want to | Read |
| --- | --- |
| Use the dashboard without technical background | [Public guide](PUBLIC_GUIDE.md) |
| Understand the equations | [Methodology](METHODOLOGY.md) |
| See every formula, exactly as implemented | [Model v7 specification](MODEL_V7_SPEC.md) — canonical |
| Follow the calculation step by step | [Calculation walkthrough](calculation.md) |
| Evaluate it for research | [Academic guide](ACADEMIC_GUIDE.md) |
| Set up, build, or change the software | [Developer guide](DEVELOPER_GUIDE.md) |
| Understand the deployment | [System architecture](SYSTEM_ARCHITECTURE.md) |
| Know what enters the model | [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md) |
| See what earlier releases delivered and what comes next | [Project roadmap](MODEL_ROADMAP.md) |
| Follow evidence to publication | [Data pipeline](computation-demo/DATA_PIPELINE.md) |
| See what is collected, scored and exported today | [Structured evidence and prospective operations](STRUCTURED_EVIDENCE.md) |
| Follow a disclosed loss through its accounting scope | [Chain loss accounting](CHAIN_LOSS_ACCOUNTING.md) |
| Check the recovery-duration fit and why it is not promoted | [Recovery duration calibration](RECOVERY_CALIBRATION.md) |
| Find any document quickly | [Documentation reference](DOCUMENTATION_REFERENCE.md) |

## Project status and roadmap

The foundation release established the stage graph, deterministic propagation
engine, and public analysis views. The current reviewed-vault release adds
human approval, audited publication, a live API with a static fallback,
historical time windows, an interactive topology workspace, archived
briefings, and the integrated documentation reader.

Next work is split deliberately between engineering and research. Operational
hardening, publication logs, backups, and a citation-first event archive can
advance with the current model. Facility capacity, inventory, qualification,
logistics, time-to-recover, and calibrated coefficients require new evidence
before the model can use them responsibly. The [project roadmap](MODEL_ROADMAP.md)
records these items, their status, and the release gates for calling them
delivered.

## Data and limits

The public site is built from a versioned static snapshot. When the vault API is unreachable — which is the normal case for the static deployment — the interface says **STATIC SNAPSHOT** rather than **LIVE VAULT**, and shows the dataset date. Sources, classifications, and company/country data are curated; model outputs are derived; propagation coefficients and certain stage judgments are **declared priors** — chosen to produce directionally sensible, reproducible, inspectable behaviour, and fitted to nothing.

Country coverage has two tiers and the interface distinguishes them: some countries carry a production share and contribute to scores, while others appear only because facilities are located there and contribute nothing to any number. The landing page states both counts; `npm run audit:data` reports the split on every run.

Facility significance is an **analyst ordinal (1–5), not measured capacity**, so every share derived from it is a share of the modeled sample rather than of world output.

The research model does not consume measured inventory, bills of materials or qualification constraints. The separate [observed-data workspace](OBSERVED_DATA.md) contains 48 UMC capacity records, 16 recovery observations, 16 reported financial outcomes, six earlier issuer forecasts, 14 company relationships and one reported manufacturing route. This remains incomplete coverage and does not establish chain-wide predictive accuracy. See [spec §9](MODEL_V7_SPEC.md#9-validation-status) and the [synthetic parameter recovery note](computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md) for the limits of model validation.

## Contributing

Submit evidence with a stable source, a date, a bounded claim, the affected stages, and its uncertainty. Candidates are reviewed before approval — an AI may draft a proposal, but a proposal has no authority until a human accepts it.

**Automatic approval is opt-in and off by default.** With `SSCIM_TRIAGE_AUTO_APPROVE` unset, every relevant candidate waits for a person. Setting it to `on` enables bounded unattended approval (High confidence only, no duplicate flag, never without a draft); anything approved that way is recorded with `provenance='automatic'` and its source line says *"AI-drafted, automatically approved by triage — not human-reviewed"*. No reviewer identity is ever invented for an unattended approval. `SELECT * FROM events WHERE provenance='automatic'` is the complete list of what went in that way.

Automatic **rejection** is configured separately (`SSCIM_TRIAGE_AUTO_REJECT`) and also defaults off. Relevant and irrelevant proposals wait for review unless their respective automatic action is explicitly enabled. Automatic operational approval additionally requires a matching source passage classified as observed evidence.

Internal review notes — candidate identifiers, approve/reject commands, the publication log — stay in the `event_candidates` table behind the admin token and never reach a public field. A test over the generated snapshot fails the build if one does.

Approval updates the local vault; publication rebuilds the snapshot, runs the audit and tests, and pushes only if that gate passes.

## Acknowledgements

The architecture draws framing from network economics, industrial organization, and production-network macroeconomics; the specific formulas are original to this project and are not endorsed by the cited authors. Citations are listed in the [academic guide](ACADEMIC_GUIDE.md).

## Languages

[日本語](README.ja.md) · [简体中文](README.zh.md)


## Public research review correction — 2026-09-06

Application patch 0.7.2 retains the v7.1 model identifier and global defaults; the data revision is `public-review-2026-09-06`. The factual baseline excludes unresolved claims independently of confidence. Exposure magnitudes remain explicit assumptions. Company coefficients have unresolved denominators and rankings are illustrative. Recovery evidence applies only to the documented component after publication. Historical calculations are **current-model retrospective replay**, distinct from archived contemporaneous outputs and genuine point-in-time validation requiring dated input vintages. Missing coverage and neutral scores do not establish safety. See the [implementation report](PUBLIC_RESEARCH_REVIEW.md) and [canonical specification](MODEL_V7_SPEC.md).
