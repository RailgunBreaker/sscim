# SSCIM with REAL data — end-to-end example (no seed/dummy data used)

**Generated 2026-07-12.** This document replaces the demonstration snapshot entirely: a 6-stage mini supply chain is built **from scratch** out of real, named, external sources — two of them fetched live via public APIs during this session — and then run through the **unmodified** SSCIM engine (`app/src/engine/buildEngine`). The seed file (`server/src/seed-data.js`) and `vault-snapshot.json` are never loaded.

Files in [`real-data-example/`](real-data-example/):
- `real-mini-dataset.json` — the assembled real-data input (exactly what was fed to `buildEngine`)
- `real-mini-results.json` — the engine's complete output on it

**Snapshot as-of date chosen: 2026-01-31** (manual choice — every event's `daysAgo` is measured against it).

---

## 1. The three kinds of data, and where each comes from

| Kind | How it enters the model | Examples in this exercise |
|---|---|---|
| **A. Machine-fetched (API)** | Scripted HTTP fetch, reproducible, citable to the byte | SEC EDGAR XBRL company facts (ASML/TSMC/NVIDIA revenue); Federal Register API (BIS export-control rules → policy + event records) |
| **B. Manually extracted from published sources** | A person reads a filing/report/press release and types the number in, with citation + date (this is what `data-notes.js` records) | TSMC 20-F customer-concentration note; TrendForce HBM vendor shares; SEMI silicon-wafer shipment revenue; TSMC quarterly node-mix; Nikon/Canon litho revenue; Yole advanced-packaging market size |
| **C. Analyst judgment (manual by design)** | Set against a written rubric; labeled Tier D; no external source can provide them | `subst` (substitutability 0–10), `market` (market sensitivity 0–10), policy `sev`, event `sev`, event classification (direction/channel/operational), the graph edges themselves, the as-of date |

The propagation coefficients (0.55 / 0.30 / 0.25 / half-life 12d) stay **declared priors** regardless of data source — real input data does not make them calibrated.

---

## 2. The live fetches (what was actually retrieved today)

### 2.1 SEC EDGAR XBRL API — company revenue (Kind A)

EDGAR exposes every XBRL-tagged filing fact as JSON. No key needed; a descriptive `User-Agent` is required.

```bash
curl -H "User-Agent: SSCIM research you@example.com" \
  "https://data.sec.gov/api/xbrl/companyfacts/CIK0000937966.json"   # ASML
```

Fetched this session (form 20-F / 10-K annual facts):

| Company | CIK | XBRL concept | Fetched values |
|---|---|---|---|
| ASML | 0000937966 | `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax` | CY2023 **€27.558B** · CY2024 **€28.263B** · CY2025 **€32.667B** |
| TSMC | 0001046179 | `ifrs-full:Revenue` | CY2024 **NT$2,894.31B = US$88.27B** (dual-tagged in the 20-F) |
| NVIDIA | 0001045810 | `us-gaap:Revenues` | FY ending 2025-01-26 **$130.50B** · FY ending 2026-01-25 **$215.94B** |

Two practical lessons the fetch surfaced (typical of real EDGAR work):
- ASML tags under **US-GAAP**, not IFRS — the naive `ifrs-full/Revenue` query 404s; you discover the right concept from `companyfacts`.
- NVIDIA switched tags after 2022 (`RevenueFromContractWithCustomer…` → `Revenues`) — pipelines must handle concept drift.

### 2.2 Federal Register API — policy instruments and events (Kind A)

```bash
curl "https://www.federalregister.gov/api/v1/documents.json?conditions[term]=high-bandwidth+memory+export+control&per_page=3"
curl "https://www.federalregister.gov/api/v1/documents/2026-00789.json"
```

Fetched this session:

| Document | Published | What it is | Used as |
|---|---|---|---|
| **2024-28270** — "Foreign-Produced Direct Product Rule Additions, and Refinements to Controls for Advanced Computing and Semiconductor Manufacturing Items" (89 FR 96790) | 2024-12-05 | BIS interim final rule: first HBM export controls + SME/FDP additions | Policy record `bis_2024_28270` **and** an (aged-out) event |
| **2026-00789** — "Revision to License Review Policy for Advanced Computing Commodities" (91 FR 1684) | 2026-01-15 (effective same day) | BIS revises license review for H200-class exports to China from **presumption of denial to case-by-case** | The live event `fr_2026_00789` |

Fetched abstract of 2026-00789 (verbatim excerpt):

> "The Bureau of Industry and Security (BIS) is revising its license review policy for exports of certain semiconductors to China and Macau — changing it from a presumption of denial to a case-by-case review. The semiconductors covered by this rule are the Nvidia H200 and its equivalents…"

**Why this event is the best possible demonstration of manual classification (Kind C):** its *topic* is "export control", but its *effect* is an **easing**. A keyword/sentiment classifier would assign the wrong sign. The human classification recorded in the dataset is `direction: mitigating, channel: downstream, operational: true` — and the engine consequently moves the chain index **below** neutral (Step 8 below). This is exactly why SSCIM's `event-assumptions` table is hand-curated and never inferred from prose.

### 2.3 Manually extracted published figures (Kind B) — entered with citation, must be re-verified against the source before production use

| Figure | Value entered | Source (public) |
|---|---|---|
| Silicon-wafer industry revenue 2024 | **$11.5B** | SEMI silicon shipment/revenue press release (Feb 2025) |
| TSMC advanced-node (≤7nm) share of wafer revenue 2024 | **69%** (3nm 18% + 5nm 34% + 7nm 17%) | TSMC 4Q24 quarterly management report (public PDF) |
| HBM vendor shares | SK hynix **52.5%**, Samsung **42.4%**, Micron **5.1%** | TrendForce HBM market tracking press release |
| HBM market size 2024 | **≈$16B** | TrendForce estimate |
| ≤7nm foundry country split | TW ≈90%, KR ≈8%, US ≈2% | TrendForce foundry tracking / CSIS chokepoints analysis |
| Nikon + Canon litho revenue | **≈$3.4B combined** | Nikon Precision Equipment & Canon Industrial segment reports (IR PDFs) |
| Advanced-packaging market 2024 | **≈$43B** | Yole Group advanced-packaging monitor |
| NVIDIA data-center segment FY2025 | **$115.2B** | NVIDIA FY2025 10-K segment note (prose/segment table — not a simple XBRL concept) |
| TSMC customer concentration | largest customer ≈25% of revenue; second >10% | TSMC 2024 Form 20-F "major customers" note (not XBRL-tagged — confirmed by checking the fetched companyfacts: no concentration concept exists) |
| TSMC major shareholder | National Development Fund (gov) **6.38%** | TSMC Form 20-F shareholder table |
| ASML major shareholder | BlackRock **≈7.9%** | AFM substantial-holdings register / ASML annual report |
| EUR→USD conversion for ASML | ×**1.082** (2024 average) | ECB reference rate |

---

## 3. Assembling the model inputs from those sources

### 3.1 Stages (6-node mini chain)

| Stage | `value` $B — derivation | `shares` — derivation | `subst`/`market` |
|---|---|---|---|
| `wafers` | **11.5** ← SEMI (B) | jp 0.53, tw 0.16, de 0.12, kr 0.11, cn 0.05 ← vendor shares (Shin-Etsu/SUMCO jp, GlobalWafers tw, Siltronic de, SK Siltron kr) mapped to country (B) — sums to 0.97, residual 0.03 handled explicitly | 7.5 / 4 (C) |
| `litho` | **34** ← ASML €28.263B (A, EDGAR) × 1.082 (B, ECB) ≈ $30.6B, + Nikon/Canon ≈ $3.4B (B) | nl 0.90 = 30.6/34; jp 0.10 = 3.4/34 — **computed from revenues** | 9.8 / 7 (C — sole-supplier EUV rubric) |
| `adv_fab` | **66** ← TSMC $88.27B (A, EDGAR) × 69% node mix (B) ≈ $60.9B, + Samsung ≈ $5B (B) | tw 0.90, kr 0.08, us 0.02 (B) | 9.5 / 8.5 (C) |
| `hbm` | **16** ← TrendForce (B) | kr 0.95 (= SK hynix 52.5 + Samsung 42.4), us 0.05 (= Micron 5.1) (B) | 8.5 / 9 (C) |
| `logic_ai` | **150** ← NVIDIA DC $115.2B (B, from A-fetched filing) + AMD DC $12.6B + Intel DCAI ≈ $12.8B + others (B) | us 0.87, cn 0.08, tw 0.05 (B/C composite) | 6.5 / 9.5 (C) |
| `adv_pkg` | **43** ← Yole (B) | tw 0.55, kr 0.13, us 0.12, cn 0.12, residual 0.08 (B) | 8 / 7.5 (C) |

### 3.2 Everything else

- **Edges (Kind C — structure is knowledge, not a feed):** `wafers→adv_fab`, `wafers→hbm`, `litho→adv_fab`, `litho→hbm`, `adv_fab→logic_ai`, `hbm→adv_pkg`, `logic_ai→adv_pkg`.
- **Policies (A + C):** `bis_2024_28270` sev **9** (severity manual) on hbm/adv_fab/logic_ai/litho; `nl_litho` sev **8** on litho.
- **Events (A + C):** `fr_2026_00789` — sev 4 (C), daysAgo **16** (= 2026-01-31 − 2026-01-15, pure date arithmetic on fetched `publication_date`), mitigating/downstream/operational (C). `fr_2024_28270` — sev 8, daysAgo **422**, adverse/both/operational.
- **Companies (A/B):** ASML litho stake 0.90 (computed); TSMC adv_fab 0.90 (B) + adv_pkg 0.30 (C estimate); SK hynix hbm 0.525, Samsung hbm 0.424 + adv_fab 0.08, Micron hbm 0.051 (B); NVIDIA logic_ai 0.77 (= 115.2/150, derived).
- **Customers (B):** `tsmc → [nvidia 0.11]` from the 20-F concentration note (the 25% customer isn't in this 6-company set).
- **Owners (B):** TSMC ← NDF (gov) 6.38%; ASML ← BlackRock 7.9%.

Full JSON: [`real-data-example/real-mini-dataset.json`](real-data-example/real-mini-dataset.json).

---

## 4. Step-by-step computation on the real data

All numbers below are the engine's actual output on this dataset (`real-mini-results.json`); each is also hand-derived so you can follow the arithmetic. Graph validation passed (6 nodes, 7 edges, acyclic); topological order: `wafers, litho, adv_fab, hbm, logic_ai, adv_pkg`.

### Step 1 — Economic weights `EW = ln(1+v)/ln(1+v_max)`, v_max = 150 (logic_ai)

```
EW_litho   = ln(35)/ln(151)  = 3.555348/5.017280 = 0.708621
EW_adv_fab = ln(67)/ln(151)  = 0.838042      EW_hbm    = 0.564691
EW_wafers  = 0.503406        EW_logic_ai = 1     EW_adv_pkg = 0.754231
```

### Step 2 — Dependence matrices from the real graph

`adv_fab` has indeg 2 (wafers, litho); litho subst 9.8 → specificity 0.98; litho outdeg 2:

```
D[adv_fab][litho] = 0.55 × (1/2) × (0.25 + 0.75×0.98) = 0.275 × 0.985 = 0.270875
D[adv_fab][wafers] = 0.275 × (0.25 + 0.75×0.75)       = 0.275 × 0.8125 = 0.223438
D[logic_ai][adv_fab] = 0.55 × (1/1) × (0.25+0.75×0.95) = 0.529375
D[adv_pkg][hbm] = 0.55 × (1/2) × (0.25+0.75×0.85)      = 0.244063
U[litho][adv_fab] = 0.30 / 2 = 0.15        U[adv_fab][logic_ai] = 0.30 / 1 = 0.30
```

### Step 3 — Geographic concentration (real shares → HHI)

```
litho:   0.90² + 0.10²                       = 0.8200 → GEO 8.20
adv_fab: 0.90² + 0.08² + 0.02²               = 0.8168 → GEO 8.17
hbm:     0.95² + 0.05²                       = 0.9050 → GEO 9.05   ← most concentrated
wafers:  0.53²+0.16²+0.12²+0.11²+0.05²+0.03² = 0.3364 → GEO 3.36   (0.03 = explicit residual)
```
Real-data observation: HBM's Korea concentration (SK hynix + Samsung = 94.9%) makes it the most geographically concentrated stage — a conclusion that comes straight from TrendForce's vendor shares, not from any modeling choice.

### Step 4 — Policy exposure (real instruments, manual severities)

```
litho:    hit by bis_2024_28270 (9) and nl_litho (8): 9 + 0.4×8 = 12.2 → clamp → 10
adv_fab / hbm / logic_ai: hit by bis_2024_28270 only → 9
wafers / adv_pkg: 0
```

### Step 5 — Network influence (unit downstream shock per stage, EW-weighted, normalized)

`adv_fab` scores the max (NI = 10 — it feeds the two largest-EW stages through the strongest coefficient); litho 8.99, logic_ai 7.96, wafers 6.86, adv_pkg 5.21, hbm 5.17.

### Step 6 — Structural vulnerability (weights 0.2778/0.2222/0.2222/0.1667/0.1111)

```
adv_fab: 0.277778×10 + 0.222222×8.168 + 0.222222×9 + 0.166667×9.5 + 0.111111×8.5
       = 2.777778 + 1.815111 + 2.000000 + 1.583333 + 0.944444 = 9.120667
Ranking: adv_fab 9.12 > litho 8.95 > logic_ai 8.05 > hbm 7.86 > adv_pkg 4.40 > wafers 4.35
```

### Step 7 — Event magnitudes (real dates → decay)

```
fr_2026_00789 (mitigating, sev 4, 16 days old):
  decay = 2^(−16/12) = 0.396850
  magnitude = −1 × (4/10) × 0.396850 = −0.158740      ← NEGATIVE: an easing

fr_2024_28270 (adverse, sev 8, 422 days old):
  decay = 2^(−422/12) = 2.7e−11 → contributions fall below τ=1e−4 → field ≡ 0
```
Real-data observation: the December 2024 HBM-controls shock has **fully decayed out** by January 2026 — the engine treats it as history, while it still contributes statically through the *policy* table (Step 4). Same source document, two different roles.

### Step 8 — Propagation and chain index

The only live field is the H200-easing event, injected at `logic_ai` (−0.158740), downstream:

```
adv_pkg: −0.158740 × D[adv_pkg][logic_ai] = −0.158740 × 0.202813 = −0.032194
operationalIndex = (1×(−0.158740) + 0.754231×(−0.032194)) / (Σ EW = 4.368991)
                 = −0.183023 / 4.368991 = −0.041891
chainIndex = 5 + 5×(−0.041891) = 4.791    (below 5 = net mitigating)
Sensitivity envelope (±30% on f↓,f↑,H): 4.730 / 4.791 / 4.865
```

### Step 9 — Company metrics (real stakes)

Criticality ("if fully disrupted", both directions, NI-weighted, normalized to observed max):

| Company | Stakes (real-derived) | Criticality |
|---|---|---|
| TSMC | adv_fab 0.90, adv_pkg 0.30 | **10.00** (the max) |
| ASML | litho 0.90 | **7.38** |
| NVIDIA | logic_ai 0.77 | **5.46** |
| Samsung | hbm 0.424, adv_fab 0.08 | 2.84 |
| SK hynix | hbm 0.525 | 2.58 |
| Micron | hbm 0.051 | 0.25 |

Vulnerability and contribution are **0.000 for every company** in this snapshot — correct behavior, not a bug: the only active operational field is *mitigating* (negative), and both metrics count adverse impact only (`max(0, field)`). Under a net-easing news state, no company carries adverse exposure.

### Step 10 — Capital power (real ownership)

```
National Development Fund (gov): 0.0638 × 10.00     = 0.638   ← state-linked flag
BlackRock:                       0.079  × 7.383262  = 0.583
```

---

## 5. What must stay manual, and why

| Manual field | Why no feed can provide it | Discipline applied |
|---|---|---|
| `subst`, `market` per stage | "How replaceable is EUV lithography?" is a judgment about qualification time, alternatives, and switching cost — no vendor sells this number | Written rubric (e.g. subst 9–10 = sole supplier, >3y qualification; 5 = second source exists at cost), Tier-D label, data-note per figure |
| Policy / event `sev` | Rule texts don't carry a 0–10 intensity | Rubric anchored to scope (sev 9 = category-wide license requirement; 4 = narrow/administrative) |
| Event classification (direction/channel/operational) | Proven above: FR 2026-00789 is titled like a restriction but *is* an easing — sign requires reading | Versioned lookup table, one entry per event id, with a written reason; unclassified → displayed but excluded from the score |
| Graph edges | The chain's structure (litho equips fabs; fabs feed accelerators) is domain knowledge from CSET/SIA-style supply-chain studies | Change-controlled; validated as a DAG on every build |
| As-of date & FX | A snapshot needs a declared clock and currency basis | Stated in `MODEL_PRIORS.datasetAsOf`; ECB reference rate cited |
| Transmission priors (0.55/0.30/0.25/12d) | Would require backtesting against documented episodes (2021 ABF shortage, 2023 Ga/Ge) to calibrate | Declared priors + sensitivity envelope until then |

## 6. Reproducing / extending

- Re-run the engine on this dataset: load `real-data-example/real-mini-dataset.json` and call `buildEngine(...)` from `app/src/engine/index.js` — results match `real-mini-results.json`.
- Refresh the fetched figures: the two `curl` patterns in §2 are the whole API surface used (EDGAR `companyfacts` per CIK; Federal Register `documents.json` search + per-document). Both are free, keyless, JSON.
- Scale up: the same source map extends to the full 24-stage model — EDGAR covers every US-listed and US-cross-listed issuer (TSMC, ASML, SK hynix ADR…); Federal Register covers all US policy; METI/EU equivalents are website-published (Kind B); market-share trackers (TrendForce/Gartner/TechInsights/SEMI/Yole) remain Kind B manual entries with citations, which is exactly what `server/src/data-notes.js` + `npm run audit:data` are designed to track.

**Caveat:** Kind-B values above were entered from the named public sources as known to the author of this run; before any production use, re-verify each against the cited document and record it as a data note. Kind-A values are verbatim from the fetched API responses of 2026-07-12.
