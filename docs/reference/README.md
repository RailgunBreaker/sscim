# SSCIM reference library

*Model version: `sscim-model-v7.1-exposure-robustness`. This library documents the
**data**. The **model** — every symbol, formula, parameter range and fallback
rule — is defined once, in [`docs/MODEL_V7_SPEC.md`](../MODEL_V7_SPEC.md), and
no page here defines a competing formula.*


Where every figure in the model comes from, and who decided it.

This library exists because a supply-chain model is easy to read as
measurement. Almost nothing here is measured. Some of it is sourced, some is
derived from what is sourced, and a meaningful part is analyst judgement
written down in the open. That distinction is the point of the project, so it
is recorded per field rather than as a disclaimer at the bottom of a page.

It was one document until it outgrew a single page. The sections below are
alphabetical; each states what it covers, how the data is structured, and what
it does **not** know.

## Sections

| Document | Covers | Last updated |
| --- | --- | --- |
| [Algorithm and priors](ALGORITHM-AND-PRIORS.md) | Every declared coefficient, what is computed rather than collected, why none of it is fitted, and the literature each method comes from | 2026-08-23 |
| [Companies and ownership](COMPANIES-AND-OWNERSHIP.md) | The 109 modeled companies, their stage stakes, and the 75 shareholder rows | 2026-08-22 |
| [Evidence coverage](EVIDENCE-COVERAGE.md) | **How much of the dataset carries a source at all** — counted from the vault, with schema integrity, graph integrity, citation completeness, source quality and factual validation reported as five separate claims | generated |
| [Events](EVENTS.md) | The 163 dated events, both curation routes, and the review gate between a candidate and an event | 2026-08-22 |
| [Facilities](FACILITIES.md) | The 275 named plants, what is sourced inside a record and what is judgement | 2026-08-22 |
| [Market and display data](MARKET-AND-DISPLAY-DATA.md) | Quotes, basemap tiles and logos — everything that is shown but never computed with | 2026-08-22 |
| [Source register](SOURCE-REGISTER.md) | **Every source cited, in Chicago bibliography style, alphabetised within issuing body** — generated from the vault, including the literature behind every method the engine runs | 2026-08-23 |
| [Supply-chain structure](SUPPLY-CHAIN-STRUCTURE.md) | The 24 stages, 34 flow edges, 243 customer relationships and the derived site network | 2026-08-22 |

## On citation completeness

Two documents, answering two different questions.

[Evidence coverage](EVIDENCE-COVERAGE.md) answers the prior one: **how much of
the model is sourced at all.** A register of citations can only describe the
things that have one, so the companies with no evidence note, the stages whose
shares are analyst judgement, and the facility records that name a source but
not a link are all invisible in it — and they are most of the uncertainty. That
page counts them, and keeps five claims apart that are easy to blur together:
schema integrity, graph integrity, citation completeness, source quality, and
factual validation. **The last of those is not established for this dataset**,
and a passing data audit does not establish it: the audit checks that records
are well-formed and internally consistent, which is a structural property, not
a factual one.

The [source register](SOURCE-REGISTER.md) renders every source in Chicago
bibliography style, and reports how complete each entry actually is rather than
presenting them as uniform. Four classes, counted:

- **Resolved** — looked up against the *Federal Register* or SEC EDGAR and tied
  to the actual document: real title, issuer, locator, date and permanent URL.
- **Full** — title, publisher, date and URL, captured automatically at review.
- **Legal** — issuing body and an exact *Federal Register* volume and page,
  which resolves without a title.
- **Short** — issuing body, document type and date only. These are the
  hand-curated historical records for which no published document was found.

**No entry is padded out.** A short entry stays short rather than acquiring an
invented title or page number to look like the others. Inventing bibliographic
detail to complete the shape of a citation would defeat the point of keeping
one.

That rule is what makes the *resolved* class worth trusting. Two resolvers turn
curator shorthand into the document it refers to, each against a free,
authoritative register:

| Script | Register | Turns "…" into |
| --- | --- | --- |
| `server/scripts/resolve-citations.mjs` | *Federal Register* | "BIS interim final rule (May 15, 2020)" → the rule, its title, agency, locator and URL |
| `server/scripts/resolve-sec-citations.mjs` | SEC EDGAR | "Qualcomm / NXP joint announcement" → the 8-K that carries the release |
| `server/scripts/resolve-method-citations.mjs` | Crossref, Open Library | a technique the engine runs → the paper or book it comes from, with its DOI |

Neither will write a citation unless an **exact identifier** ties the two
together: a register citation, an executive order number, an SEC accession
number, or a document number a person confirmed after reading it. Similarity
search exists in both scripts purely as a search aid for a human, and cannot
write anything.

```bash
cd server
npm run sources:propose   # search aid — prints candidates, stores nothing
npm run sources:resolve   # writes only what a human confirmed
npm run sources           # regenerate the register
```

The distinction is not academic. Verifying the August 2022 rule against its own
text showed it controls **gallium oxide** and diamond substrates, not silicon
carbide as the event record had claimed; the event was corrected against the
document. A fuzzy match would have attached a citation and left the error in
place, which is precisely the failure a register exists to catch.

The entries that stay short are a finding, not a gap. Presidential CFIUS
orders, export-licence revocations and settlement announcements were never
published as *Federal Register* documents. Samsung, SK hynix, Toshiba, SoftBank,
Kioxia, Taipower and the Chinese, Japanese and Dutch ministries are not SEC
registrants, so their announcements are real and in neither register. And where
a company furnished several reports in the same week and none could be tied to
the event by its own text, none was cited: no citation beats a plausible one.

## The one rule

Every meaningful statement traces to exactly one of three things: **a source**,
**an explicit assumption**, or **an implemented calculation**. If it is none of
those, it does not belong in the model.

| Tier | Meaning | Example in this project |
| --- | --- | --- |
| **A** | Peer-reviewed / primary academic | Concentration and substitution literature behind the HHI treatment |
| **B** | Institutional and industry reporting | TrendForce, IDC, SemiAnalysis market-share notes |
| **C** | Official primary source | Federal Register rule texts, SEC filings, company site listings |
| **D** | Declared analyst judgement | Stage substitutability, facility significance, propagation priors |
| **GRAPH** | Computed from the above | Network influence, dependence matrices, the index |

Tiers A–C are things somebody else published. **Tier D is us**, and it is
labelled as such everywhere it surfaces, including in the interface.

## What is deliberately absent, everywhere

No bill of materials. No inventory days. No capacity or utilisation figures. No
time-to-recover. No qualification relationships. No alternative-supplier counts.
No shipment or customs data.

The dependence matrices are equal-allocation priors derived from graph degree
**precisely because** none of that exists here. See the
[Model roadmap](../MODEL_ROADMAP.md) for what acquiring it would involve.

## Checking any of it yourself

Nothing in this library needs to be taken on trust. The vault database is
committed to the repository, so every figure the deployed site shows traces to
a row you can query and a commit you can read.

```bash
# every event with its source, newest first
sqlite3 server/data/sscim.db \
  "SELECT date_iso, source, title FROM events ORDER BY date_iso DESC LIMIT 40;"

# every facility with its source
sqlite3 server/data/sscim.db "SELECT id, name, source FROM facilities ORDER BY country, id;"

# the evidence notes and their tiers
sqlite3 server/data/sscim.db "SELECT tier, scope, source FROM data_notes ORDER BY tier;"

# what the review queue decided, and why
cd server && node scripts/review.mjs list

# the full data audit, including every gap it knows about
cd app && npm run audit:data

# regenerate the source register after any data change
cd server && node scripts/build-source-register.mjs
```

## Further reading

- [Data sources, inputs, and outputs](../DATA_SOURCES_AND_OUTPUTS.md) — how the data flows and what each output means
- [Methodology](../METHODOLOGY.md) — every formula and declared prior
- [Model v7 specification](../MODEL_V7_SPEC.md) — the canonical definition of every formula
- [Calculation walkthrough](../calculation.md) — the arithmetic, step by step
- [Academic guide](../ACADEMIC_GUIDE.md) — how to cite this, and what not to claim
- [Model roadmap](../MODEL_ROADMAP.md) — delivered, planned, and the gaps between
