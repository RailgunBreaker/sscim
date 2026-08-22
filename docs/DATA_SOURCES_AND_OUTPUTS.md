# SSCIM data sources, inputs, and outputs

What enters the model, where it came from, how it is processed, and what each output does and does not mean.

For a per-field account of where every figure originates -- every feed endpoint, every event source, every facility citation, and every analyst judgement listed separately -- see [References](REFERENCES.md).

## Provenance rule

Every meaningful statement is traceable to exactly one of three things: **a source**, **an explicit assumption**, or **an implemented calculation**. If it is none of these, it does not belong in the model. The evidence tiers below are used consistently in the codebase, the interface, and every document here.

| Tier | Meaning |
| --- | --- |
| **A** | Peer-reviewed academic foundations |
| **B** | Institutional and industry reports |
| **C** | Official primary sources — rule texts, filings |
| **D** | Declared analyst judgment; not fitted to anything |
| **GRAPH** | Computed from the above; no independent input |

## Inputs

| Input group | Size | Tier | Status and interpretation |
| --- | --- | --- | --- |
| Stage graph | 24 stages, 34 directed edges | B | Curated from published process-flow descriptions; validated acyclic. Changed by review, never by scraping. |
| Production geography | Country shares per stage, 16 modeled countries | B | Capacity and market estimates. Undisclosed remainder is kept as an **explicit residual**, not silently dropped — see the HHI treatment in the methodology. |
| Company footprint | 109 companies, within-stage stakes | B / C | Source-informed share estimates and filings. **Not** capacity data; no utilization. |
| Facility geography | 275 sites, 24 countries, all 109 companies | C + D | Named plants with operator, coordinates, what they make, and the stages they feed. Site identity and rough location are Tier C (public company site listings); the `scale` 1–5 significance ordinal is Tier D and is **the only field the impact math uses**. Coordinates are site/city approximations good to a few km. Coverage is a **curated sample, not a census** — an empty hazard radius means no site *in this sample*. Eight of the 24 countries are **host-only**: they carry no stage share, contribute nothing to any score, and exist so that real plants (Infineon Villach, ST Catania, onsemi Rožnov, Micron Sanand, IBM Bromont) can be mapped at all. Before they were added, the country list was a scoring list being used as a geography list, and the map implied the industry stopped at sixteen borders. |
| Site-to-site network | ~850 modeled links | — | **Derived, not input.** Composed from the company `customers` edges and the stage flow graph — see below. No dataset here records which plant ships to which plant. |
| Customer relationships | 243 supplier→customer edges | C + B | Disclosed customer concentration plus trade-press estimates, top customers only. This is *supplier-revenue share*, which is **not** buyer input-dependence — the two directions are different quantities and are modeled separately. |
| Ownership | 75 shareholder rows | C | 13F filings, annual reports, exchange disclosures. Ages quickly; the most compliance-sensitive dataset here. |
| Policy instruments | 7 | C + D | Rule texts are Tier C; the severity score and the 0.4 additional-instrument discount are Tier D judgments. |
| Historical events | 147 code-defined (6 illustrative, 141 sourced over ten years, Aug 2016 → Jul 2026) plus reviewed pipeline events | B / C | Dated, cited, human-reviewed before publication. Ages derive from an authoritative `dateISO`, never hand-maintained. Coverage is uneven by year and thickens toward the present — see the density caveat below. |
| Event classifications | one per event id | D | Direction, channel, and whether it counts toward the score. Hand-curated in `event-assumptions.js`; **never inferred from headline text at runtime**. |
| Stage judgments | substitutability, market sensitivity | D | Analyst scores 0–10 against a written rubric. |
| Model priors | transmission, half-life, weights, specificity floor, tolerance | D | Explicit assumptions in `app/src/engine/priors.js`. Not fitted parameters. |
| Candidate feeds | USGS, Federal Register, news | — | **Discovery only.** A candidate is not an event and never reaches the model unreviewed. |
| Market quotes | 92 of 109 listed companies | — | Yahoo Finance. **Display metadata only — never an engine input.** |

### What is deliberately absent

No bill of materials, no inventory days, no capacity or utilization figures, no time-to-recover, no qualification relationships, no alternative-supplier counts. The dependence matrices are equal-allocation priors derived from graph degree precisely *because* none of that data exists here. See the [Model roadmap](MODEL_ROADMAP.md) for what acquiring it would involve.

Facility geography is the one item that has since been added, and it is worth being precise about what was and was not acquired. The site layer knows **where plants are and what they make**. It does not know **how much they make**: `scale` is a 1–5 analyst ordinal, not wafer starts. Every share the site layer produces is therefore a share of the *modeled site sample*, never of world capacity, and is labelled that way in the interface. Mixing a published wafer-start figure for the handful of fabs that report one with a guess for the rest would produce a number that reads as measured and is not — so the model uses the ordinal alone.

### What the site layer is for

A country marker cannot answer the question an earthquake asks, because a hazard happens at a point, not in a country. The M7.1 Kumamoto event hit Kyushu; Kyushu is JASM, Sony CIS and Renesas Kawashiri, and it is not Naka or Yokkaichi. The site layer exists to make that distinction available:

- **A hazard radius resolves to named plants.** Drop an epicentre on the map, set a radius, and the readout lists the modeled sites inside it with operator, distance, status and output.
- **Exposure is reported per stage**, as the share of that stage's modeled site weight sitting inside the radius. A 150 km circle over Pyeongtaek/Icheon contains 94% of the modeled HBM sites; the same circle over a mature-node region contains almost none of it. That contrast is the point.
- **Stages below a 5% exposure threshold are listed as *touched*, not shocked.** A radius clipping one small plant at the edge of a cluster must not shock that plant's entire stage.
- **Nothing here models damage.** The radius is a screening circle — the same judgement the USGS ingest filter makes upstream when it decides a quake is worth a human's attention. Shaking intensity, building standards and fab hardening are all outside the model.

A hazard footprint runs through the identical propagation engine every recorded event uses, so its Δ is comparable with the index it modifies. Severity stays the operator's input: the site layer says what is exposed, not how hard it was hit.

**The hazard overlay is now the only hypothesis the dashboard states.** The preset scenario library, the draft composer, the scenario builder modal and the propagation playback controls have been removed. What replaced them is not another way to invent an event but the question the data can actually answer: *history review*, which re-derives the whole model — map, stage fields, country readings, index — as it stood on any past date, using the engine's own back-dating rule. A reviewed date is a real past state of the record; a hazard is a bounded screening hypothesis you place yourself. The interface keeps the three states (live, reviewed, hazard) visually distinct because the worst failure mode of a model like this is a reader quoting a hypothetical number as an observed one.

### Every site has a standardized profile

All 275 profiles are **generated from the same fields by the same code** (`app/src/engine/facilityProfile.js`), not written per site. Hand-writing 275 introductions would drift: the tenth would mention capacity and the fiftieth would not, one plant would be "critical" and an identical one "significant", and a reader comparing two sites would be comparing two authors as much as two facilities. Generating them means two profiles differ only where the sites differ. The only free prose in a profile is the record's own one-line `output`.

Each profile carries the same sections — headline, introduction, a fixed nine-row fact table (an em dash where a value is unknown, never a missing row), the stages it feeds with its share of each, and the caveats that apply to that record. The generator states plainly what a reader would otherwise infer wrongly: a design campus "produces no physical output", a datacentre "is a demand site, not a production site", and a fab under construction "has no output to lose yet". The audit fails the build if any site produces a stub profile.

### The site-to-site network is derived, and is not a shipment route

The vault knows separately that company A supplies company B, and that stage X feeds stage Y. Neither fact is geographic. `app/src/engine/facilityNetwork.js` composes them into site-to-site links: a link exists when the two operators have a `customers` edge, one site's stage reaches the other's in the flow graph, and both sites carry exposure weight. Its weight is `companyShare × siteShare(supplier) × siteShare(customer) × reach`, where `reach` is the engine's own downstream propagation — no new coefficient is introduced.

Three properties are worth stating because each was a bug first:

- **Reachability, not adjacency.** JSR sells photoresist to TSMC, but the graph routes resist → litho → adv_fab. A direct-edge test silently dropped 130 of 243 company edges — most of the upstream half of the chain.
- **Commercial direction ≠ physical direction.** ASE "supplies" NVIDIA, but packaging sits downstream of design: the die moves from the fab to the packager and back while the invoice goes the other way. Those links are kept and marked `service`, drawn dashed, rather than being quietly relabelled or dropped.
- **The cap applies to drawing, not to knowing.** The map draws the strongest few hundred links; every built link stays in the per-site index, so a plant's own profile lists all of its connections. Both numbers are shown.

What the network is not: a shipment route, a logistics lane, or an observed trade flow. Two sites of the same company pair receive links in proportion to their significance ordinals, which is an allocation assumption and exactly as strong as the ordinals themselves. The label used throughout the interface is "modeled site-to-site link".

### The event-density caveat

The event record is a **curated sample, not a census**, and its density is uneven: recent months are ingested daily through the pipeline, while 2017 is represented by a handful of records written in one pass. Because the operational index aggregates whatever events are inside the decay horizon, a period covered more thoroughly scores higher than an equally eventful period covered more thinly — the index is measuring the dataset as well as the world.

The dashboard's HISTORY panel reports this directly, as the correlation between the index and the trailing 30-day severity mass of scored events, next to per-year event counts. Read those counts before reading a trend into the yearly means. Two consequences follow: cross-year comparisons of the *level* are weak evidence, and a single real event entered several times (one earthquake reported by six sources, each approved separately) inflates the index materially, because simultaneous shocks accumulate through noisy-OR rather than being deduplicated by the model.

## Processing

1. **Ingest** feeds into a candidate queue. Nothing is published by this step.
2. **Deduplicate** at ingest. An identical restatement of a story already seen is collapsed automatically; a near-duplicate is left pending but flagged, because a one-token difference can be two genuinely different rules. Duplicates are marked, not deleted, so the record of what arrived stays intact.
3. **Draft** an optional AI classification. Drafts are proposals with no authority — an unreviewed candidate cannot affect any score.
4. **Review.** A human checks source quality, duplication, scope, affected stages, severity, and uncertainty, and may override every proposed field.
5. **Approve**, which writes the event into the vault and records its classification.
6. **Publish**, once per review session rather than once per decision: regenerate the snapshot, run the audit and tests, then commit and push. This fires automatically when the reviewer stops deciding or the queue empties, and can be triggered explicitly at any time.
7. **Gate.** Audit and tests must pass or nothing is published and the previous deployment stays live.

## Outputs

| Output | Meaning | Do not interpret as |
| --- | --- | --- |
| Structural vulnerability | Stable modeled sensitivity of a stage, country, or company footprint | A probability, or realized risk |
| Operational index | Event-driven signed sensitivity, displayed around neutral 5 | A forecast, loss estimate, or market signal |
| Network influence | Normalized reach of a unit shock through the graph | A validated centrality metric, or economic loss |
| Company vulnerability | Average adverse impact across occupied stages, size-independent | A company-level risk rating |
| Company contribution | Share-weighted share of an aggregate modeled effect | A financial-loss estimate |
| Company criticality | Effect of fully disrupting that company, normalized against the observed maximum | An investment view of any kind |
| Capital power | Ownership stake weighted by company criticality | Influence, control, or intent |
| Index history | The operational model replayed over the snapshot's event record, daily across a ten-year window | A live market or macro time series |
| Per-event index impact | The **marginal** change on the event's own date: the index with that event minus the index without it | An additive decomposition — marginal effects do not sum to the index, because shocks combine through a saturating noisy-OR |
| Topology routes and metrics | Graph-derived pathways and counterfactual sensitivity | Trade volumes, logistics routes, or contracts |
| Sensitivity envelope (low/base/high) | The same computation at ±30% on transmission and half-life | A confidence interval — it is not one |
| Briefing | A textual summary generated from current model state | Independent reporting or investment research |
| Static snapshot | A versioned dataset deployed to the public site | A continuously live database |

## Data quality, stated plainly

`npm run audit:data` reports which inputs carry an evidence note and which are carried-over judgment. At the current snapshot most stages and most companies have **no** individual evidence note, meaning they are Tier-D analyst judgment rather than individually verified figures.

This is a meaningfully improved snapshot, not a fully sourced production database, and it should not be represented as one. Any write-up using these figures should say which of them carry evidence notes.

## Further reading

- [Methodology](METHODOLOGY.md) — how these inputs become those outputs.
- [Data pipeline](computation-demo/DATA_PIPELINE.md) — each input's candidate feed and its automation ceiling.
- [Real-data example](computation-demo/REAL_DATA_EXAMPLE.md) — an end-to-end run on genuinely fetched data.
- [Model roadmap](MODEL_ROADMAP.md) — the missing data layer.
