# Evidence coverage

*Generated from the vault by `server/scripts/build-evidence-coverage.mjs`. Last generated: 2026-09-06.*
*Model version: `sscim-model-v7.1-exposure-robustness` · snapshot date: 2026-09-04 · canonical specification: [MODEL_V7_SPEC.md](../MODEL_V7_SPEC.md).*

How much of this dataset carries a source, counted from
`server/data/sscim.db` rather than asserted. The companion
[source register](SOURCE-REGISTER.md) lists the sources themselves and
grades how complete each citation is; this page answers the prior
question — how much of the model is sourced at all.

## Five different claims, kept apart

Conflating these would be the most misleading thing this page could do, so
each is stated with its own scope.

| | What it checks | Status | What it does **not** tell you |
| --- | --- | --- | --- |
| **Schema integrity** | Every record has the fields and types the engine requires | Enforced on every build by `npm run audit:data` | Nothing about whether any value is correct |
| **Graph integrity** | The stage graph is acyclic and connected; declared shares sum sensibly | Enforced on every build; residuals reported as warnings | Nothing about whether any value is correct |
| **Citation completeness** | Whether each figure carries a source, and how complete that source is | Counted below | Whether the source supports the claim |
| **Source quality** | Whether the source is authoritative for the claim attached to it | Recorded per entry where a curator has judged it; see the evidence-tier notes | Not inferred from the presence of a URL |
| **Factual validation** | Whether each attached claim is supported | 4 occurrence claims reviewed against original documents; numerical exposure remains assumed | No independent outcome calibration or comprehensive coverage |

A passing data audit means the records are *well-formed and internally
consistent*. It is a structural audit. It is not factual validation, and
this project does not claim otherwise.

## Events — 167 records

| Class | Count | Share | What the record carries |
| --- | ---: | ---: | --- |
| **Full** | 24 | 14% | A URL is present; this count does not establish access or claim support |
| **Legal** | 2 | 1% | An exact *Federal Register* volume and page — complete by Chicago's convention for government material |
| **Short** | 141 | 84% | Issuing body, document type and date only. Hand-curated historical records for which no published document was found |
| **Uncited** | 0 | 0% | No source recorded |

See the [source register](SOURCE-REGISTER.md) for each entry, and for why a
short entry stays short rather than acquiring an invented title.

### Resolved citations and factual baseline eligibility

Raw source URLs: **24/167**. Separately resolved bibliographic records: **40/167**. Union of raw URL or separately resolved citation: **63/167**. These overlap and must not be added. The source register uses the resolved entries when available; the raw table above counts only the original source field.

Verified occurrence claims: **4/167**. Factual-baseline eligible at 2026-09-04: **3/167**. Eligibility does not imply nonzero persistence: a recovered site can be eligible and inactive. Other records remain context or unresolved. A lower index after exclusion is a data correction, not evidence of lower real-world risk.

| Record | Occurrence | Operational status | Exposure | Factual eligibility |
| --- | --- | --- | --- | --- |
| e1 | unresolved | unknown | assumed | excluded |
| h2510_truce | verified | verified_scoped | assumed | eligible |
| h2512_memory | unresolved | unknown | assumed | excluded |
| h2603_memorypeak | unresolved | unknown | assumed | excluded |
| h2606_subs | verified | verified_scoped | assumed | excluded |
| h2607_kumamoto | verified | verified_scoped | assumed | eligible |
| x2508_veurevoke | verified | partially_verified | assumed | eligible |
| p260807_man0807 | unresolved | unknown | assumed | excluded |

Numeric denominators and original values: [measurement basis](MEASUREMENT-BASIS.md). Claim sources, exact locations, information dates and provenance: [event evidence ledger](event-evidence.json). Source existence is distinct from claim verification.

### How each event was approved

Provenance is recorded per event, not implied by the source string.

| Provenance | Count | Meaning |
| --- | ---: | --- |
| **human** | 19 | A person approved it through the admin surface |
| **automatic** | 1 | Automatic triage approved it unattended. The source line says so; no reviewer identity is invented |
| **curated** | 147 | Hand-authored in the seed data, never in the review queue |
| **legacy** | 0 | Predates the provenance column; how it was approved is not recorded |

Automatic approval is **opt-in and off by default**
(`SSCIM_TRIAGE_AUTO_APPROVE`). `SELECT * FROM events WHERE
provenance='automatic'` is the complete list of what entered unattended.

## Facilities — 275 sites

| Class | Count | Share | What the record carries |
| --- | ---: | ---: | --- |
| **Cited** | 2 | 1% | A resolvable URL |
| **Named source, no URL** | 273 | 99% | A named source — company facility listings, site disclosures, filings — without a resolvable link |
| **Uncited** | 0 | 0% | No source recorded |

Separately, and orthogonally to the above:
**275 of 275** (100%)
facility records explicitly disclose in their own source line that the
site's significance ordinal is an analyst judgement.

Every facility's `scale` is an **analyst ordinal from 1 to 5, not measured
capacity**, whether or not the site carries a citation. Every share derived
from it is therefore a share of the modeled sample, never of world output.
The gap worth closing here is the URL: a named company facility listing is a
real source, but a reader cannot follow it without a link.

## Companies and stages — evidence notes

Evidence notes (`data_notes`) are where a curator records what a figure
rests on and how strong that is. Their absence is not an error; it is
uncatalogued judgement, and it is counted here rather than left implicit.

| Scope | With an evidence note | Without | Share covered |
| --- | ---: | ---: | ---: |
| Companies | 4 | 105 | 4% |
| Stages | 4 | 20 | 17% |

Notes by declared evidence tier: **B** 9 · **C** 4 · **A** 1.

## Relationships

| | Count | Sourcing |
| --- | ---: | --- |
| Company-to-company supply relationships | 243 | Revenue shares are analyst estimates from public disclosure; the supplier lists are sampled, not exhaustive |
| Ownership stakes | 75 | From public filings |
| Facility-to-facility links | *derived* | **Composed, never observed.** No record anywhere in this dataset states which plant ships to which plant. Every one is a modeled stage-mediated relationship |

## Analyst-judgement fields

These are declared judgements, not measurements, and they are load-bearing.
None is fitted to data.

- **Propagation priors** — downstream and upstream transmission coefficients, and the decay half-life. See [Methodology](../METHODOLOGY.md).
- **Facility significance** — the 1–5 ordinal every facility share derives from.
- **Stage substitutability and market weight** — two of the five structural-vulnerability components.
- **Event severity, direction, channel and scoring flag** — recorded per event in `app/src/engine/event-assumptions.js`, with the reasoning written out for each.

## What would close the gap

Nothing on this page is closed by better formatting. The short-citation
class shrinks when a URL is captured at review time, which the queue now
does automatically; the uncatalogued-judgement counts shrink when evidence
notes are written. Factual validation would require an independent
measurement to check against, and the [project
roadmap](../MODEL_ROADMAP.md) records what that would take.
