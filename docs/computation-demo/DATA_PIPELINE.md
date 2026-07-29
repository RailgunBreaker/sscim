# SSCIM as a product — automated data pipeline design

**Question answered here:** if the CSVs (i.e. the input tables `02`–`10` behind them) should be fetched/updated automatically, *what sources feed each table, and how is each one generated?*

Two facts frame everything:

1. **Only tables 01–10 are source data.** CSVs `11`–`18` are pure derivations — the "update" for them is simply re-running `buildEngine()` (a CI job, seconds). Automating the product means automating `02`–`10`.
2. **A working proof of the automatable core is in [`auto-fetch/fetch-sources.mjs`](auto-fetch/fetch-sources.mjs)** — run `node fetch-sources.mjs` and it stages live candidates from the Federal Register and SEC EDGAR into `auto-fetch/out/` (it did so on 2026-07-12: 3 BIS rule candidates, 16 revenue anchors across ASML/TSMC/NVIDIA/Micron/AMAT).

---

## 1. Source map — every input table, its feed, and its automation ceiling

**Legend:** 🟢 fully automatable (free API) · 🟡 automatable with licensed data or scraping+review · 🔴 human judgment by design (assist, never auto-write)

| CSV / table | Field(s) | Source | Access method | Update cadence | Ceiling |
|---|---|---|---|---|---|
| `01` priors | all | `priors.js` — model constants | version control only | on model release | 🔴 by design |
| `02` stages | `value` ($B) | SEC EDGAR XBRL (vendor revenue roll-ups); WSTS/SIA & SEMI market stats (press releases free, data service licensed) | `data.sec.gov/api/xbrl/companyfacts/CIK{n}.json` (free, keyless, UA required, ~10 req/s) + report ingestion | quarterly (filings), annual (market totals) | 🟢/🟡 |
| `02` stages | `subst`, `market` | analyst rubric | review UI | annual re-score | 🔴 |
| `03` country shares | shares per stage | TrendForce / Gartner / TechInsights / IDC (licensed); SEMI; **or computed** from vendor revenues × vendor country where a stage is vendor-concentrated (litho = ASML/Nikon/Canon works today from filings alone) | licensed API/report ingestion; EDGAR + IR PDFs for the computable stages | quarterly | 🟡 |
| `04` edges | graph structure | CSET/SIA/BCG supply-chain studies — domain knowledge | change-controlled PR + DAG validation | rare | 🔴 |
| `05` policies | instrument, dates, text | **Federal Register API** (BIS/OFAC), **EUR-Lex web service** (EU), METI / MOFCOM announcement pages (scrape + translate) | free APIs / scrapers | **daily scan** | 🟢 discovery |
| `05` policies | `sev`, `stages` | analyst reading of rule text | review queue (LLM-assisted draft allowed, human approves) | per instrument | 🔴 |
| `06` events | occurrence, date, source text | Federal Register API; **EDGAR full-text search** (`efts.sec.gov/LATEST/search-index?q=…` for 8-K/6-K disclosures); GDELT (free, noisy); licensed newswires (Reuters/Bloomberg/Nikkei) for production quality | APIs + dedup/entity-match | daily–hourly | 🟢/🟡 discovery |
| `06` events | `sev`, direction/channel/`operational` | analyst classification | review queue, versioned like `event-assumptions.js` | per event | 🔴 — proven by the H200 case: an "export control" headline that was actually an *easing* |
| `07`/`08` companies & stakes | financials, segments | EDGAR XBRL (US-listed + ADR issuers: TSMC, ASML, SK hynix via reports); TWSE/KRX/JPX filings for non-US listings | free APIs (EDGAR structured; others semi-structured) | quarterly | 🟢/🟡 |
| `07`/`08` | within-stage share | tracker estimates (licensed) reconciled with segment revenue | ingestion + reconciliation report | quarterly | 🟡 |
| `09` customers | supplier→customer % | 10-K/20-F customer-concentration notes (**prose, not XBRL** — confirmed: TSMC tags no concentration concept) via EDGAR full-text search + extraction; Bloomberg SPLC / FactSet Revere (licensed) for coverage | NLP extraction **with mandatory review**, or licensed dataset | annual (filings) | 🟡 |
| `10` owners | stakes | **SEC 13F** (structured XML on EDGAR since 2013, quarterly, 45-day lag); 13D/G; AFM & other national registers; annual-report shareholder tables | free API parse (13F is genuinely machine-readable) | quarterly | 🟢 for 13F universe; 🔴 for state-linked flagging |
| `11`–`18` | everything | `buildEngine(snapshot)` | CI job | on any input change | 🟢 total |

---

## 2. Pipeline architecture — how the tables get generated

The repo already has every seam this needs: the writable vault API (`server/routes/admin.js`, bearer-token), the citation ledger (`data_notes` table + `server/src/data-notes.js`), the integrity gate (`npm run audit:data`), the snapshot builder (`build-vault-snapshot.mjs`), and CI (`.github/workflows/static.yml`). The pipeline is those pieces plus fetchers and a review queue:

```
┌───────────────────────────────  FETCH LAYER (scheduled)  ───────────────────────────────┐
│ daily:    Federal Register API · EUR-Lex · METI/MOFCOM scrapers · EDGAR full-text (8-K)  │
│ quarterly: EDGAR XBRL companyfacts · 13F parses · tracker report ingestion (licensed)     │
│ annual:   WSTS/SEMI totals · 20-F/10-K customer-concentration extraction                  │
└──────────────────────────────────────────┬───────────────────────────────────────────────┘
                                           ▼
                     STAGING (append-only, per-record: source URL, fetch date,
                     raw payload hash — exactly the auto-fetch/out/*.csv shape)
                                           ▼
                     DIFF vs current vault  →  no change: stop
                                           ▼
                     VALIDATION (schema; shares sum ≤ 1 else flag; DAG check;
                     unit/currency normalization; outlier bounds)
                                           ▼
        ┌────────────── REVIEW QUEUE (the 🔴 gate — human approves) ──────────────┐
        │ • new policy/event: analyst sets sev, stage mapping, direction/channel/  │
        │   operational (LLM may DRAFT these; publishing without approval is       │
        │   forbidden — the H200 easing would have shipped with the wrong sign)    │
        │ • share/stake changes: approve + data_note citation auto-attached        │
        │ • pure financial anchors (XBRL values): auto-approve allowed, logged     │
        └───────────────────────────────────┬──────────────────────────────────────┘
                                           ▼
                     WRITE to vault via existing admin API (PUT/POST, bearer)
                     + data_notes row per changed figure (source, date, tier)
                                           ▼
                     REBUILD: build-vault-snapshot.mjs → audit:data → npm test
                     → buildEngine → regenerate csv/11–18 → deploy (existing CI)
```

Design rules that keep it honest:

- **Staging is append-only and cited.** Every candidate row carries `fetched_on`, `source`, and the document identifier (accession number / FR citation) — the demo CSVs show the shape.
- **Judgment fields can be drafted by a model, never published by one.** The Federal Register demo run staged the January 2025 "AI Diffusion Framework" and the December 2024 HBM rule with `REVIEW_REQUIRED` in `sev`/`stages`/`direction` — that is the product behavior, not a placeholder hack.
- **Auto-approve is allowed only for verbatim structured facts** (an XBRL revenue value from a signed filing). Anything interpreted — a share estimate, a mapping to stages, a sign — goes through the queue.
- **Every write regenerates everything derived.** There is no path where `14_company_metrics.csv` is edited; it only ever falls out of `buildEngine`.

---

## 3. Concrete feeds and their mechanics

### 3.1 Free, keyless, production-usable today (🟢)

| Feed | Endpoint | Feeds table | Notes (learned from the live runs) |
|---|---|---|---|
| SEC EDGAR XBRL | `data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json` | 02 values, 07/08 financial anchors | Descriptive User-Agent mandatory; **concept drift is real** — ASML tags US-GAAP despite being Dutch, NVIDIA switched revenue tags in 2022 (the demo script's probe-list + "rows-found" guard handles both) |
| SEC EDGAR full-text | `efts.sec.gov/LATEST/search-index?q="..."&dateRange=...` | 06 events (8-K/6-K), 09 customers (concentration notes) | Returns filings, not facts — needs extraction + review |
| SEC 13F/13D/G | EDGAR quarterly XML | 10 owners | Structured; 45-day lag; covers institutional holders of US-traded securities incl. ADRs |
| Federal Register | `federalregister.gov/api/v1/documents.json` | 05 policies, 06 events | Filter by agency `industry-and-security-bureau`, type `RULE`; abstracts included; effective dates included |
| EUR-Lex | SPARQL/REST web service | 05 (EU Chips Act, dual-use regs) | Free; multilingual |
| ECB reference rates | `ecb.europa.eu` daily XML | currency normalization | For EUR/TWD/JPY/KRW → USD conversion of anchors |

### 3.2 Scraping / semi-structured with review (🟡)

METI and MOFCOM announcement pages (translation + review), TWSE/KRX/JPX filings for non-US-listed issuers (SK hynix, Samsung detail beyond ADR level), company IR pages for segment PDFs (Nikon Precision, Canon Industrial), SEMI/WSTS press releases (headline totals are published free quarterly).

### 3.3 Licensed (the coverage you cannot get free) (🟡)

- **Market-share trackers** — TrendForce, Gartner, TechInsights, IDC, Yole: the only source of within-stage vendor shares at production quality (their press releases give free but partial/lagged snapshots). Feeds `03` and `08`.
- **Supply-chain relationship datasets** — Bloomberg SPLC, FactSet Revere: supplier→customer link coverage far beyond what concentration notes disclose. Feeds `09`.
- **Newswires** — Reuters/Bloomberg/Nikkei APIs for event discovery latency better than daily.

### 3.4 Never automated (🔴) — and why

`subst`/`market` rubric scores, policy/event severities, event direction/channel/operational, the stage taxonomy and edges, state-linked-capital flags, and every propagation prior. Each is a judgment with no ground-truth feed; the pipeline's job is to *queue and version* these decisions (as `event-assumptions.js` already does), not to guess them. The standing counterexample for anyone tempted: Federal Register doc **2026-00789** is titled like a restriction and is actually an easing — auto-classification by keyword would have inverted the sign of the chain index.

---

## 4. Rollout order (pragmatic)

1. **Now (free, ~days of work):** schedule `fetch-sources.mjs`-style jobs (GitHub Actions cron) for Federal Register + EDGAR XBRL + 13F; wire staging → review → admin API; auto-rebuild snapshot & CSVs on vault change. This alone keeps policies, events, financial anchors, and ownership current.
2. **Next:** EDGAR full-text extraction for customer-concentration notes and 8-K event discovery, with the review queue.
3. **Then (budget-dependent):** one tracker license (TrendForce covers foundry/HBM/DRAM/NAND — the highest-value shares) to automate `03`/`08` refresh; SPLC/Revere if `09` coverage becomes a product priority.
4. **Throughout:** every automated write lands a `data_notes` citation, so `npm run audit:data`'s "uncited figures" count becomes the pipeline's coverage KPI (today: 20/24 stages, 105/109 companies uncited).
