# SSCIM: Semiconductor Supply Chain Intelligence Map

SSCIM is an explainable research tool for exploring how a semiconductor disruption may move through a modeled supply chain. It combines a world map, a directed stage graph, company footprints, historical events, and user-built scenarios over a single computational engine.

**SSCIM is not** a live trading signal, a prediction engine, a measured trade-flow model, or investment advice.

## What it is for

- **General readers** — understand why a material, equipment supplier, fab, or region can matter far beyond its own borders. Start with the [public guide](PUBLIC_GUIDE.md).
- **Analysts and teams** — compare modeled exposure, pathways, and alternative scenarios with every assumption visible.
- **Researchers** — inspect a reproducible sensitivity model rather than a black-box risk score. Start with the [academic guide](ACADEMIC_GUIDE.md).
- **Contributors** — add evidence through a reviewed, auditable pipeline. Start with the [developer guide](DEVELOPER_GUIDE.md).

## Why this exists

Semiconductors are the most geopolitically concentrated industry in the world. One company in the Netherlands makes every EUV lithography machine. One island fabricates most leading-edge logic. Two Korean firms dominate HBM memory.

Existing maps of that structure — consortium charts, research-body diagrams, static infographics — are good at showing **where things are**. They are not built to show **what changes**: when an export rule lands or a fab halts, which nodes become newly exposed, how far the effect reaches, and what to watch next. SSCIM fills that gap with an engine you can interrogate rather than a score you have to trust.

## How it works

The model contains 24 production stages across seven tiers — research and IP, materials, equipment, fabrication, chip products, backend, systems, and end markets — connected by 34 directed edges describing declared production dependencies. Country-stage shares and company stakes locate real activity within that structure.

An event or scenario seeds a shock at selected stages. The engine ages it with a 12-day half-life, propagates it across every reachable path using declared downstream and upstream transmission priors, combines overlapping contributions with a bounded rule, and aggregates the result.

The same code path serves historical events, hypothetical scenarios, and company-disruption analysis. **Change the input, not the method** — that is what makes the three comparable.

Results appear across three synchronized views:

1. **Map** — country-level modeled exposure, by production geography rather than headquarters.
2. **Industry flow** — stage-level structure and propagation.
3. **Topology** — derived country × stage functional centres and modeled routes.

Read the explanation, source, confidence label, and assumptions before using any score.

## What the model separates, deliberately

- **Structural vulnerability** (time-invariant) from **operational impact** (event-driven). Blending them would produce a number that moves for two incompatible reasons.
- **Evidence quality** from **effect size**. Confidence is reported alongside a magnitude, never multiplied into it.
- **Company vulnerability** from **contribution** from **criticality** — three distinct questions, three separately labeled numbers.
- **Downstream input dependence** from **upstream revenue dependence**. A supplier's sales share to a customer is not the customer's dependence on that supplier.
- **Baseline history** from **hypothetical scenarios**. A scenario is shown as a comparison and never rewrites the past.

## Start here

| You want to | Read |
| --- | --- |
| Use the dashboard without technical background | [Public guide](PUBLIC_GUIDE.md) |
| Understand the equations | [Methodology](METHODOLOGY.md) |
| See every formula derived with real numbers | [Calculation specification](calculation.md) |
| Evaluate it for research | [Academic guide](ACADEMIC_GUIDE.md) |
| Set up, build, or change the software | [Developer guide](DEVELOPER_GUIDE.md) |
| Understand the deployment | [System architecture](SYSTEM_ARCHITECTURE.md) |
| Know what enters the model | [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md) |
| Follow evidence to publication | [Data pipeline](computation-demo/DATA_PIPELINE.md) |
| Find any document quickly | [Documentation reference](DOCUMENTATION_REFERENCE.md) |

## Data and limits

The public site is built from a versioned static snapshot. Sources, classifications, and company/country data are curated; model outputs are derived; propagation coefficients and certain stage judgments are **declared priors** — chosen to produce directionally sensible, reproducible, inspectable behaviour, and fitted to nothing.

The model has no facility-level capacity, inventory, bill-of-materials, qualification, or recovery-time data. A real capacity-constrained shock, such as a fab physically destroyed, would propagate differently than this model predicts. See the [Model roadmap](MODEL_ROADMAP.md) for the full list of what calibration would require, and the [validation note](computation-demo/validation/MLE_VALIDATION.md) for what has and has not been established.

## Contributing

Submit evidence with a stable source, a date, a bounded claim, the affected stages, and its uncertainty. Candidates are reviewed before approval — an AI may draft a proposal, but a proposal has no authority until a human accepts it. Approval updates the local vault; publication rebuilds the snapshot, runs the audit and tests, and pushes only if that gate passes.

## Acknowledgements

The architecture draws framing from network economics, industrial organization, and production-network macroeconomics; the specific formulas are original to this project and are not endorsed by the cited authors. Citations are listed in the [academic guide](ACADEMIC_GUIDE.md).

## Languages

[日本語](README.ja.md) · [简体中文](README.zh.md)
