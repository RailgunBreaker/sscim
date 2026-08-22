# Reference — Events

*Last updated: 2026-08-22. Part of the [reference library](README.md).*

**163 events** in the vault, arriving by two routes that never mix. Every one
carries an authoritative `dateISO`, a `source` string, and a classification
recorded by hand.

## What an event record holds

| Field | Meaning | Tier |
| --- | --- | --- |
| `id` | Stable identifier; the key everything else joins on | — |
| `dateISO` | The authoritative date. Every age is derived from it, never hand-maintained | C |
| `sev` | Severity 1–10 — **realized operational scale**, never newsworthiness | D |
| `type` | Export Control, Natural Disaster, Market Shock, Policy Signal, … | D |
| `conf` | Evidence quality: High / Medium / Low / Simulated | D |
| `title`, `summary`, `detail` | Prose, restricted to what the source states | C |
| `first`, `second`, `watch` | First-order, second-order, what to watch next | D |
| `stages`, `countries` | Which parts of the chain and which geographies it touches | D |
| `source` | The originating document or report | C |

Severity anchors, so the scale means the same thing across a decade:
**9** = the October 2022 BIS export controls (broadest sector-wide restriction).
**7** = the M7.1 Kumamoto quake halting several named fabs with confirmed
damage; China's Ga/Ge licensing regime. **6** = a multi-week single-site
outage. **4** = one company losing one supply line.

## Classification is separate from the record

Direction, channel, and *whether an event counts toward the score* live in
`app/src/engine/event-assumptions.js`, keyed by event id — **never inferred
from headline text at runtime**. An id with no entry is displayed but silently
excluded from the scored index, which is the right default for something that
arrived unclassified and always a mistake for a hand-curated record; the sync
script refuses to run if a code-defined event lacks one.

`operational: false` is right more often than people expect. It covers hazard
signals where nothing was disrupted, mixed events with simultaneous winners and
losers, long-term strategic and subsidy announcements, and anything announced
but not yet in effect. Those events are real, displayed and individually
inspectable — they are simply not folded into one signed number where they
would misrepresent themselves.

## Route 1 — code-defined, 147 records

Hand-curated across three files:

| File | Records | Covers |
| --- | --- | --- |
| `server/src/seed-data.js` (`EVENTS`) | 6 | Illustrative examples for a fresh install |
| `server/src/history-events.js` | 38 | Recent, densely covered history |
| `server/src/decade-events.js` | 103 | Backfill to 2016 |

Span **2016-09-05 → 2026-07-28**. Confidence as recorded: 131 High, 16 Medium.

## Route 2 — reviewed pipeline events, 16 records

Everything else arrived through the candidate pipeline. Their `source` records
both the feed and the fact of review:
`<feed> (<url>) — AI-drafted, human-reviewed`.

**A candidate is not an event.** The AI step drafts prose and *proposes* a
classification; severity, direction, channel and whether it scores become real
only when a person approves them through `server/scripts/review.mjs`. That gate
is the whole reason the phrase "human-reviewed" is defensible.

The analysis agent runs with **no file, shell or git tools** — only WebFetch and
WebSearch. Candidates go in through the prompt and JSON comes back on stdout. It
cannot touch the database, the repository, or push anything.

## Discovery feeds

Used for discovery only. None can write an event.

| Feed | Endpoint | What it can and cannot see |
| --- | --- | --- |
| USGS Earthquake Catalog | `earthquake.usgs.gov/fdsnws/event/1/query` | Reports that the ground shook near a modeled fab cluster. Never that a fab stopped. |
| Office of the Federal Register | `federalregister.gov/api/v1/documents.json` | Authoritative for BIS rules and entity-list actions. Publishes rule text, not impact. |
| Webz.io News API Lite | `api.webz.io/newsApiLite` | Where plant halts, fires and shortages actually surface. Silent when `WEBZ_TOKEN` is unset. |

Candidates on record: webz-news 72, federal-register 7, manual 4, usgs 1.

The USGS filter is deliberately generous — proximity to a cluster, not a damage
estimate — because a false positive costs a reviewer a minute and a missed
quake cannot be recovered (`server/src/ingest/usgs.mjs`, `FAB_CLUSTERS`).
`manual` is the fourth route: entered by hand with the real upstream article
when a feed is unavailable, through the identical gate.

## Where the sources come from

163 distinct source strings, by issuing body:

| Body | Distinct sources |
| --- | --- |
| US federal — other agencies and instruments | 21 |
| Bureau of Industry and Security | 20 |
| News organisations and trade press | 15 |
| China — ministries and regulators | 13 |
| Other national authorities and courts | 10 |
| Research and analyst houses | 9 |
| Japan — ministries and agencies | 5 |
| Netherlands and European Union | 3 |
| Company disclosures, filings and announcements | 67 |

Every one is listed in the [source register](SOURCE-REGISTER.md).

## What this does not know

**The event record is a curated sample, not a census, and its density is
uneven.** Recent months are ingested daily; 2017 is a handful of records
written in one pass. Because the index aggregates whatever sits inside the
decay horizon, a well-covered period scores higher than an equally eventful but
thinly covered one — the index measures the dataset as well as the world. The
history panel reports this directly, next to per-year event counts.

Two consequences follow. Cross-year comparisons of the *level* are weak
evidence. And one real event entered several times — one earthquake reported by
six outlets, each approved separately — inflates the index materially, because
simultaneous shocks accumulate through noisy-OR rather than being deduplicated
by the model. The pipeline collapses same-story duplicates at ingest, but that
is a heuristic on headline text, not a guarantee.
