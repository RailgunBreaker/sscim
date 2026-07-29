# SSCIM: Semiconductor Supply Chain Intelligence Map

SSCIM is an explainable research tool for exploring how a semiconductor disruption may move through a modeled supply chain. It combines a world map, a directed stage graph, company footprints, historical events, and user-built scenarios.

## What it is for

- **General readers:** understand why a material, equipment supplier, fab, or region can matter beyond its own borders.
- **Analysts and teams:** compare modeled exposure, pathways, and alternative scenarios with visible assumptions.
- **Researchers:** inspect a reproducible sensitivity model rather than a black-box risk score.
- **Contributors:** add evidence through a reviewed, auditable pipeline.

SSCIM is not a live trading signal, a prediction engine, a measured trade-flow model, or investment advice.

## How it works

The model contains 24 semiconductor stages: research and IP, materials, equipment, fabrication, chip products, backend, systems, and end markets. Directed edges describe declared production dependencies. Country-stage shares and company stakes locate activity within that structure.

An event or scenario seeds a shock at selected stages. The engine applies its declared downstream and upstream transmission rules, event age decay, and overlap rule. The result is displayed across three synchronized views:

1. **Map:** country-level modeled exposure.
2. **Industry flow:** stage-level structure and propagation.
3. **Topology:** derived country × stage functional centres and modeled routes.

Read the explanation, source, confidence label, and assumptions before using any score.

## Start here

- [Public guide](PUBLIC_GUIDE.md) — how to read the dashboard without technical background.
- [Developer guide](DEVELOPER_GUIDE.md) — local setup, code layout, tests, and publishing workflow.
- [Academic guide](ACADEMIC_GUIDE.md) — suitable research questions, reproducibility, and limitations.
- [Calculation specification](calculation.md) — concise algorithm and interpretation rules.
- [System architecture](SYSTEM_ARCHITECTURE.md) — application components, deployment, and publication boundary.
- [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md) — what enters the model and what each output means.
- [Data pipeline](computation-demo/DATA_PIPELINE.md) — evidence-to-publication process.

## Data and limits

The public site is built from a versioned static snapshot. Sources, classifications, and company/country data are curated; model outputs are derived; propagation coefficients and certain stage judgments are declared priors. The model has no facility-level capacity, inventory, bill-of-material, qualification, or recovery-time data. See [Model roadmap](MODEL_ROADMAP.md).

## Contributing

Submit evidence with a stable source, date, bounded claim, affected stages, and uncertainty. Candidate articles are reviewed before approval. Approval updates the local vault, rebuilds the static snapshot, runs audit/tests, then publishes only if the gate passes.

## Languages

[日本語](README.ja.md) · [简体中文](README.zh.md)
