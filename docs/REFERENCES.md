# SSCIM references — where every figure comes from

This document answers one question for every number the interface can show:
**where did it come from, and who decided it.**

It exists because a supply-chain model is easy to read as measurement. Almost
nothing here is measured. Some of it is sourced, some of it is derived from
what is sourced, and a meaningful part of it is analyst judgement written down
in the open. The distinction is the point of the project, so it is stated
per-field rather than in a general disclaimer at the bottom.

Counts in this document are as of the snapshot in `server/data/sscim.db` and
move with it. Where a number is quoted, the query that produces it is given so
you can re-derive it rather than trust it.

## The one rule

Every meaningful statement traces to exactly one of three things: **a source**,
**an explicit assumption**, or **an implemented calculation**. If it is none of
those, it does not belong in the model.

| Tier | Meaning | Example in this project |
| --- | --- | --- |
| **A** | Peer-reviewed / primary academic | Substitution and concentration literature behind the HHI treatment |
| **B** | Institutional and industry reporting | TrendForce, IDC, SemiAnalysis market-share notes |
| **C** | Official primary source | Federal Register rule texts, SEC filings, company site listings |
| **D** | Declared analyst judgement | Stage substitutability, facility significance, propagation priors |
| **GRAPH** | Computed from the above | Network influence, dependence matrices, the index |

Tiers A–C are things somebody else published. **Tier D is us**, and it is
labelled as such everywhere it surfaces, including in the interface.

---

## 1. Events

**163 events** in the vault, from two routes that never mix.

### 1a. Code-defined events — 147 records

Hand-curated, in three files, each event carrying a `source` string and an
authoritative `dateISO`:

| File | Records | Covers |
| --- | --- | --- |
| `server/src/seed-data.js` (`EVENTS`) | 6 | Illustrative examples for a fresh install |
| `server/src/history-events.js` | 38 | Recent, densely covered history |
| `server/src/decade-events.js` | 103 | Backfill to 2016 |

Span **2016-09-05 → 2026-07-28**. Confidence as recorded: 131 High, 16 Medium.

Their `source` fields are the actual originating documents and reports. The
distribution is dominated by primary regulatory and company sources:

- **Regulatory / state**: BIS (20), Commerce Department (8), MOFCOM (7),
  Executive Orders (4), METI (3), Presidential determinations (2), plus USTR,
  NDRC, SAMR, CAC, DOJ, Dutch and Japanese ministries, Taiwan authorities.
- **Company disclosure**: TSMC (8), Samsung (4), ASML (4), NVIDIA (3), Intel,
  Qualcomm, Sony, Renesas, Rapidus, GlobalFoundries, ASE, Ibiden, Toyota,
  Volkswagen, SK, Apple, AMD, Murata, Toshiba, SoftBank, JASM.
- **Trade press and research**: Reuters (3+1 joint with Bloomberg), TrendForce
  (2 + 1 joint with IDC), IDC, TechInsights, DRAMeXchange, Bloomberg, BBC.

Re-derive the full distribution:

```sql
SELECT source, COUNT(*) FROM events WHERE source IS NOT NULL GROUP BY source ORDER BY 2 DESC;
```

### 1b. Reviewed pipeline events — 16 records

Everything else arrived through the candidate pipeline and was approved by a
human. Their `source` field records the feed **and** that a human reviewed it,
in the form `<feed> (<url>) - AI-drafted, human-reviewed`.

**A candidate is not an event.** The AI step drafts prose and *proposes* a
classification; severity, direction, channel and whether an event counts toward
the score become real only when a person approves them through
`server/scripts/review.mjs`. That gate is what keeps "human-reviewed" true.

### 1c. Discovery feeds

Three feeds, used for **discovery only** — none of them can write an event.

| Feed | Endpoint | Cost | What it can and cannot see |
| --- | --- | --- | --- |
| USGS earthquakes | `earthquake.usgs.gov/fdsnws/event/1/query` | free, keyless | Reports that the ground shook near a modeled fab cluster. Never that a fab stopped. |
| US Federal Register | `federalregister.gov/api/v1/documents.json` | free, keyless | Authoritative for BIS rules and entity-list actions. Publishes rule text, not impact. |
| webz.io news | `api.webz.io/newsApiLite` | free tier, needs `WEBZ_TOKEN` | Where plant halts, fires and shortages actually surface. Silent when no token is set. |

Candidates on record: webz-news 72, federal-register 7, manual 4, usgs 1.

The USGS filter is deliberately generous — it triggers on proximity to a
cluster, not on a damage estimate — because a false positive costs a reviewer
a minute and a missed quake cannot be recovered. See
`server/src/ingest/usgs.mjs` `FAB_CLUSTERS`.

`manual` is the fourth route: records entered by hand with their real upstream
article, used when a feed is unavailable. They go through the identical review
gate.

---

## 2. Facilities — 275 sites

`server/src/facilities-data.js`. Every record is a real, publicly-known site of
a company already in the vault, and every record carries its own `source`
string — **136 distinct source strings** across the file, almost all of the
form *"<company> facility listings / site disclosures; scale is an analyst
judgement."*

The split inside a single facility record is the important part:

| Field | Tier | Origin |
| --- | --- | --- |
| operator, site, country, rough location | **C** | Public company site listings and programme announcements |
| `output` — what it makes | **C** | The same listings, compressed to one line |
| `node`, `waferSize`, `status`, `since` | **C** | Company disclosures where stated, omitted where not |
| `stages` — which chain steps it feeds | **D** | Analyst mapping onto the 24 modeled stages |
| **`scale` — 1–5 significance** | **D** | **Analyst ordinal. The only field the impact maths uses.** |

**There is no capacity data.** `scale` is not wafer starts. Mixing a published
wafer-start figure for the ten fabs that report one with a guess for the other
265 would produce a number that reads as measured and is not — so the model
uses the ordinal alone, and every share it produces is a share **of the modeled
site sample**, never of world capacity.

Coordinates are site- or city-level approximations good to a few kilometres:
enough to decide whether a plant is inside a 200 km hazard radius, not enough
to site a building.

Composition: 95 wafer fabs, 63 assembly & test, 45 materials, 37 R&D/design,
30 equipment, 5 datacentres. Status: 249 operating, 20 ramping, 6 construction.

### Known omissions, named

- **Zeiss SMT and Trumpf are absent.** Both are effectively single points of
  failure for EUV. Adding them means adding companies with stage stakes, which
  re-normalises every criticality score — a model change, not a map change, and
  it should be made deliberately.
- **Sites outside the 24 modeled countries** are omitted. Eight of those 24 are
  *host-only* (Austria, Italy, Czechia, India, Thailand, Canada, Switzerland,
  Poland): they carry no stage share, contribute nothing to any score, and
  exist purely so real plants can be mapped.
- Coverage is a **curated sample, not a census**. An empty hazard radius means
  no site *in this sample*.

---

## 3. Structural inputs

| Input | Size | Tier | Origin |
| --- | --- | --- | --- |
| Stage graph | 24 stages, 34 edges | B | Published process-flow descriptions; validated acyclic |
| Production geography | country shares per stage | B | Capacity and market estimates; undisclosed remainder kept as an **explicit residual** |
| Company footprint | 109 companies | B / C | Share estimates and filings — not capacity |
| Customer relationships | 243 edges | C + B | Disclosed customer concentration plus trade press, **top customers only** |
| Ownership | 75 rows | C | 13F filings, annual reports, exchange disclosures |
| Policy instruments | 7 | C + D | Rule text is C; the severity score and the 0.4 discount are D |
| Countries | 24 (16 scoring + 8 host) | B | See §2 |

### Evidence notes

`server/src/data-notes.js` attaches a citation to specific figures — 14 notes
on record (1 tier A, 9 tier B, 4 tier C). Examples, verbatim from the vault:

- `stage:litho` — TrendForce *ASML EUV Dominance* (2025–2026); ASML FY2025 20-F
- `company:tsmc` — TrendForce press release 20260312-12965 (4Q25 top-10 foundry)
- `owners:intel` — Intel 8-K filings (SEC EDGAR, Aug 18 & Sept 15 2025)
- `customer:tsmc->nvidia` — CNBC, *Nvidia set to supplant Apple as TSMC's top customer*
- `customer:skhynix->nvidia` — TrendForce, *NVIDIA drives 27% of SK hynix revenue*
- `company:cxmt` — SemiAnalysis, *China's CXMT Is Set to Challenge DRAM Incumbents*
- `owners:tsmc` — TSMC 2025 Annual Report; MarketScreener shareholder data
- `owners:foxconn` — Focus Taiwan / TWSE disclosure (2025-12-02)
- `stage:m_ai` — Dell'Oro / TrendForce / BloombergNEF datacentre-spend trackers

**Coverage is thin and the audit says so on every run**: most stages and most
companies have no evidence note. That is a real gap, reported rather than
hidden — run `npm run audit:data` in `app/` to see the current count.

---

## 4. Analyst judgements — tier D, listed

These are ours. Nobody published them; they are declared so they can be argued
with.

| Judgement | Where | Note |
| --- | --- | --- |
| Stage substitutability (0–10) | `seed-data.js` `subst` | Scored against a written rubric |
| Stage market sensitivity (0–10) | `seed-data.js` `market` | As above |
| Facility significance (1–5) | `facilities-data.js` `scale` | Not capacity |
| Facility → stage mapping | `facilities-data.js` `stages` | Which chain steps a plant feeds |
| Policy severity + 0.4 discount | `seed-data.js` `POLICIES` | Rule text is sourced; severity is not |
| Event direction / channel / scored | `app/src/engine/event-assumptions.js` | One entry per event id, **never inferred from headline text at runtime** |
| Propagation priors | `app/src/engine/priors.js` | 12-day half-life, 0.55 downstream, 0.30 upstream, 0.25 specificity floor |

None of these are fitted parameters. Nothing in this model has been calibrated
against an outcome dataset.

---

## 5. Derived — computed, not collected

Nothing below is an input. Each is recomputed from the tables above on every
load, and each has exactly one implementation.

| Output | Computed in | What it is not |
| --- | --- | --- |
| Dependence matrices D, U | `engine/graph.js` | Not measured input–output coefficients |
| Network influence | `engine/index.js` | Not a validated centrality metric |
| Structural vulnerability | `engine/index.js` | Not a probability |
| Operational impact / chain index | `engine/index.js` | Not a forecast |
| Company criticality / vulnerability / contribution | `engine/index.js` | Three separate numbers, never blended |
| Site-to-site network (~850 links) | `engine/facilityNetwork.js` | **Not a shipment route** — no dataset here records which plant ships to which plant |
| Facility profiles | `engine/facilityProfile.js` | Generated from fields, not written per site |
| Hazard footprints | `engine/facilities.js` | A screening circle; models no shaking intensity, building standards or fab hardening |
| Index history | `engine/timeseries.js` | Replayed from the same events; attribution is **marginal**, not standalone |

---

## 6. Display-only

| Item | Source | Status |
| --- | --- | --- |
| Market quotes (92 of 109 companies) | Yahoo Finance (`query1.finance.yahoo.com/v7/finance/quote`) | **Never an engine input.** Price and P/E are metadata. |
| Basemap tiles | CARTO dark basemap, falling back to OpenStreetMap standard | © OpenStreetMap contributors © CARTO |
| Company logos | Company domains via `DOMAINS` in the vault | Presentation only |
| Briefing archive (5 on record) | Generated from the vault at each pipeline run | A derived readout of the day's state |

---

## 7. What is deliberately absent

No bill of materials. No inventory days. No capacity or utilisation figures. No
time-to-recover. No qualification relationships. No alternative-supplier counts.
No shipment or customs data.

The dependence matrices are equal-allocation priors derived from graph degree
**precisely because** none of that data exists here. See the
[Model roadmap](MODEL_ROADMAP.md) for what acquiring it would involve.

### The event-density caveat

The event record is a curated sample and its density is uneven: recent months
are ingested daily, while 2017 is a handful of records written in one pass.
Because the index aggregates whatever is inside the decay horizon, a
well-covered period scores higher than an equally eventful but thinly covered
one — the index measures the dataset as well as the world. The history panel
reports this directly, alongside per-year event counts.

---

## 8. Checking any of it yourself

Everything above is in the repository; none of it requires taking this document
on trust.

```bash
# every event with its source, newest first
sqlite3 server/data/sscim.db \
  "SELECT date_iso, source, title FROM events ORDER BY date_iso DESC LIMIT 40;"

# every facility with its source
sqlite3 server/data/sscim.db \
  "SELECT id, name, source FROM facilities ORDER BY country, id;"

# the evidence notes and their tiers
sqlite3 server/data/sscim.db "SELECT tier, scope, source FROM data_notes ORDER BY tier;"

# what the review queue decided, and why
cd server && node scripts/review.mjs list

# the full data audit, including every gap it knows about
cd app && npm run audit:data
```

The vault database is committed to the repository, so every figure the deployed
site shows can be traced to a row you can query and a commit you can read.

## Further reading

- [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md) — how the data flows and what each output means
- [Methodology](METHODOLOGY.md) — every formula and declared prior
- [Calculation specification](calculation.md) — the arithmetic, step by step
- [Academic guide](ACADEMIC_GUIDE.md) — how to cite this, and what not to claim
- [Model roadmap](MODEL_ROADMAP.md) — delivered, planned, and the gaps between
