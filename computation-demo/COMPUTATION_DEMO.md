# SSCIM — Step-by-Step Computation Demonstration

**Generated:** 2026-07-12, by running the actual engine (`app/src/engine/`) against the actual frozen snapshot (`app/src/data/vault-snapshot.json`, dataset as-of **2026-07-06**).
Every number in this document is the engine's real output (or a hand-recomputation of it shown digit-for-digit) — nothing is illustrative or rounded away from what the code produces.

**All data referenced here is exported as CSV in [`csv/`](csv/)** — see §6 for the file index. Machine-readable worked-example values are in [`worked-example.json`](worked-example.json).

**To reproduce:** the same numbers appear in the running app (dashboard → Methodology overlay shows the same formulas); the CSVs were produced by loading `buildEngine(vault-snapshot)` in Node and dumping every input/intermediate/output table.

---

## 1. Source — where the code and data live, and how the data was collected

### 1.1 Computation source code

| File | Role |
|---|---|
| `app/src/engine/priors.js` | `MODEL_PRIORS` — the single source of truth for **every** numerical coefficient (§2.1) |
| `app/src/engine/math.js` | Primitives: half-life decay, bounded noisy-OR combination, HHI with residual, Kahn topological sort, log1p weight normalization |
| `app/src/engine/graph.js` | Dependence matrices **D**/**U** and all-reachable-paths propagation |
| `app/src/engine/diagnostics.js` | Graph validation (no dangling edges, no duplicates, acyclic) |
| `app/src/engine/event-assumptions.js` | Hand-curated event semantics (direction / channel / operational) — never inferred from text |
| `app/src/engine/index.js` | `buildEngine(data)` — composes everything below into the derived model |

### 1.2 Data source and collection

The dataset is a **frozen, curated demonstration snapshot**, not a live feed:

- **Master source:** `server/src/seed-data.js` (hand-curated tables) → exported by `app/scripts/build-vault-snapshot.mjs` → committed as `app/src/data/vault-snapshot.json`. The public app loads this snapshot; the engine never mutates it.
- **How the values were collected** (README §8–§9): a best-effort real-data research pass over public sources — company 10-K/20-F/annual-report filings, TrendForce/TechInsights/Gartner market-share tracking, SIA/BCG and CSET industry studies, and named trade press. Headline corrections carry citations in `server/src/data-notes.js` (16 data notes in this snapshot) and are surfaced by `npm run audit:data`.
- **Evidence tiers** (A academic / B institutional / C official filings / D analyst judgment): figures **without** a data-note entry are carried-over **Tier-D analyst judgment** — the audit currently reports 20/24 stages and 105/109 companies with no evidence note. Two stage fields (`subst`, `market`) are *declared analyst judgments by design*.
- **All propagation coefficients are declared, unvalidated sensitivity priors** (§2.1) — chosen for reproducible, inspectable behavior, **not** fitted to any observed disruption episode.

### 1.3 Input tables in the snapshot (exact counts)

| Table | Count | CSV |
|---|---|---|
| Stages (supply-chain production stages, DAG nodes) | 24 | `02_stages.csv`, `03_stage_country_shares.csv` |
| Flow edges (directed stage→stage dependencies) | 34 | `04_flow_edges.csv` |
| Countries | 16 | (columns of `03`, `16`) |
| Companies | 109 (139 stage stakes) | `07_companies.csv`, `08_company_stakes.csv` |
| Customer relationships (supplier→customer revenue share) | 243 | `09_customers.csv` |
| Shareholder records | 75 rows across ~25 companies | `10_owners.csv` |
| Policy instruments | 7 | `05_policies.csv` |
| Events | 6 | `06_events.csv` |

---

## 2. Input data (exact values)

### 2.1 Model parameters — `MODEL_PRIORS` (CSV: `01_model_priors.csv`)

| Parameter | Value | Meaning / how obtained |
|---|---|---|
| `halfLifeDays` (H) | **12** | Event-shock decay half-life: `decay(age,H) = 2^(−age/H)`. Declared Tier-D prior (uncalibrated). |
| `downstreamTransmission` (f↓) | **0.55** | Supplier→buyer transmission coefficient in the input-dependence matrix D. Declared prior. |
| `upstreamTransmission` (f↑) | **0.30** | Buyer→supplier revenue-echo coefficient in matrix U. Declared prior. |
| `specificityFloor` (φ) | **0.25** | Floor of the specificity multiplier — a fully substitutable input still transmits 25% of the base effect. Declared prior. |
| `contributionTolerance` (τ) | **1e-4** | Propagation truncates once a contribution's magnitude falls below τ (instead of a fixed hop count). |
| `datasetAsOf` | **2026-07-06** | Frozen snapshot date; every event `daysAgo` is relative to this, never the visitor's clock. |
| `componentWeights` | choke 0.25, geo 0.20, policy 0.20, subst 0.15, shock 0.10, market 0.10 | Raw structural-score weights. `shock` is dropped (event-driven, not structural) and the rest renormalized — see Step 6. |
| Sensitivity presets | low = base × 0.7, high = base × 1.3 | Applied to f↓, f↑, H only — a deterministic sensitivity envelope, **not** a confidence interval. |

### 2.2 Stages — 24 DAG nodes (CSV: `02_stages.csv` + `03_stage_country_shares.csv`)

Per-stage fields: `value` = sample global stage value in $B (Tier B/D estimate); `subst` = substitutability score 0–10 (**analyst judgment**; by dataset convention *high = hard to substitute*, i.e. high specificity); `market` = market-sensitivity score 0–10 (**analyst judgment**); `shares` = country market shares (sum ≤ 1; any shortfall is an explicit unmodeled "Other" residual).

| id | Name | Value $B | subst | market | Country shares |
|---|---|---|---|---|---|
| `research` | Research / IP | 20 | 6.5 | 3 | us 30%, uk 20%, be 15%, de 10%, jp 10%, cn 10%, fr 5% |
| `eda` | EDA software | 15 | 9 | 5 | us 63%, de 13%, cn 6%, jp 2% |
| `design` | Chip design | 250 | 6 | 9 | us 50%, tw 15%, cn 15%, kr 7%, jp 5%, il 5%, uk 3% |
| `wafers` | Silicon wafers | 15 | 7.5 | 4 | jp 55%, tw 15%, kr 10%, de 10%, cn 6% |
| `resist` | Photoresists | 3 | 8.5 | 3.5 | jp 76%, us 10%, kr 5%, cn 5% |
| `gases` | Specialty gases / chem | 8 | 7 | 3.5 | jp 22%, de 22%, fr 18%, us 18%, cn 10%, kr 10% |
| `substrates` | IC substrates (ABF) | 12 | 7.5 | 4.5 | jp 38%, tw 32%, kr 14%, de 8%, cn 8% |
| `litho` | Lithography (EUV/DUV) | 30 | 9.8 | 7 | nl 90%, jp 9% |
| `depo` | Deposition | 20 | 7.5 | 6 | us 40%, jp 28%, nl 12%, kr 6%, cn 14% |
| `etch` | Etch & clean | 22 | 7.5 | 6 | us 48%, jp 28%, cn 14%, kr 5% |
| `cmp` | CMP & slurries | 6 | 6.5 | 4 | us 55%, jp 35%, kr 5%, fr 5% |
| `metro` | Metrology / inspection | 13 | 8 | 5.5 | us 68%, jp 12%, nl 8%, il 6%, de 6% |
| `adv_fab` | Advanced fab (≤7nm) | 120 | 9.5 | 8.5 | tw 62%, kr 20%, us 12%, jp 4%, ie 2% |
| `mature_fab` | Mature-node fab | 90 | 5 | 6 | cn 30%, tw 28%, us 10%, jp 10%, de 7%, kr 6%, sg 4%, il 3%, fr 2% |
| `memory_fab` | Memory fab (DRAM/NAND) | 130 | 6.5 | 8.5 | kr 60%, us 18%, jp 9%, cn 7%, sg 2%, tw 4% |
| `logic_ai` | Logic & AI accelerators | 300 | 6.5 | 9.5 | us 68%, tw 13%, cn 9%, kr 10% |
| `analog` | Analog / power / RF | 90 | 5 | 6 | us 38%, jp 17%, de 15%, cn 13%, fr 7%, il 1% |
| `hbm` | HBM | 25 | 8.5 | 9 | kr 74%, us 26% |
| `adv_pkg` | Advanced packaging | 45 | 8 | 7.5 | tw 50%, us 15%, kr 15%, cn 10%, my 5%, sg 5% |
| `osat` | OSAT / test | 40 | 4.5 | 5 | tw 40%, cn 26%, my 13%, us 7%, sg 6%, ph 4%, vn 4% |
| `systems` | Final systems (ODM/EMS) | 500 | 3.5 | 6.5 | cn 40%, tw 18%, us 12%, my 10%, vn 10%, de 5%, sg 5% |
| `m_ai` | AI data centers | 350 | 3 | 9 | us 62%, cn 13%, de 10%, jp 10%, sg 5% |
| `m_auto` | Automotive / industrial | 90 | 3.5 | 6 | cn 30%, jp 20%, us 22%, de 13%, kr 10%, fr 5% |
| `m_consumer` | Consumer / mobile | 250 | 3 | 6.5 | cn 40%, us 25%, kr 20%, jp 10%, vn 5% |

**34 directed edges** (`04_flow_edges.csv`), e.g. `litho → adv_fab`, `adv_fab → logic_ai`, `systems → m_ai`. The graph is validated as a DAG before anything runs (this snapshot: **valid**, no cycles/dangling/duplicate edges).

### 2.3 Policies — 7 instruments (CSV: `05_policies.csv`)

Each policy = `{severity 0–10, affected stages}`; collected from official rule texts (BIS/METI/MOFCOM, CHIPS/EU Chips Act — Tier C).

| id | Name | Severity | Affected stages |
|---|---|---|---|
| `bis` | U.S. BIS AI-chip & SME export controls | 9 | logic_ai, hbm, adv_fab, litho, depo, etch, metro |
| `nl` | Dutch lithography export licensing | 8 | litho |
| `meti` | Japan METI equipment & material controls | 6 | depo, etch, resist, metro |
| `cnmat` | China Ga/Ge/graphite export licensing | 7 | gases, analog, wafers |
| `chips` | CHIPS Act / EU Chips Act incentives | 4 | adv_fab, mature_fab, memory_fab |
| `twp` | Taiwan core-technology protection rules | 5 | adv_fab, adv_pkg |
| `tariff` | Section-301 / retaliatory tariffs | 4 | mature_fab, systems, m_consumer, m_auto |

### 2.4 Events — 6 in the snapshot (CSV: `06_events.csv`)

Each event carries severity (0–10), `daysAgo` (relative to 2026-07-06), confidence (metadata only — **never** multiplied into magnitude), affected stages, and a **hand-curated semantic assumption** (`event-assumptions.js`): direction (adverse/mitigating/mixed), channel (downstream/upstream/both), and whether it counts toward the scored operational aggregate.

| id | Title | sev | daysAgo | Stages | Direction | Channel | Operational? |
|---|---|---|---|---|---|---|---|
| `e1` | U.S. expands AI-chip export-control rules | 8 | 3 | logic_ai, hbm, adv_fab, adv_pkg | adverse | both | **yes** |
| `e2` | TSMC accelerates CoWoS capacity expansion | 4 | 4 | adv_pkg, logic_ai | mitigating | downstream | **yes** |
| `e3` | Elevated military activity, Taiwan Strait | 6 | 6 | adv_fab, adv_pkg, osat | adverse | downstream | no (hazard signal only — its own text says no disruption occurred) |
| `e4` | China tightens Ga/Ge licensing | 7 | 9 | gases, analog | adverse | downstream | **yes** |
| `e5` | Major memory maker trims 2026 capex | 5 | 11 | memory_fab, depo, etch | mixed | downstream | no (reallocative: winners and losers) |
| `e6` | Japan approves Rapidus funding tranche | 3 | 12 | adv_fab, depo, resist | adverse | downstream | no (long-term strategic signal) |

### 2.5 Companies, customers, owners

- **109 companies** (`07_companies.csv`), each with HQ country and **stakes** = within-stage market shares, e.g. TSMC = `{adv_fab: 0.85, mature_fab: 0.20, adv_pkg: 0.35}`.
- **243 supplier→customer revenue relationships** (`09_customers.csv`), e.g. ASML → TSMC 0.35 (= 35% *of ASML's sales*, not TSMC's input dependence — the two are deliberately kept distinct).
- **75 ownership records** (`10_owners.csv`), e.g. TSMC: Taiwan NDF (gov) 6.38%, BlackRock 5.1%, GIC 3.2%, Vanguard 3.9%. State-linked capital is flagged by pattern `/gov|SOE|METI/`.

---

## 3. Processing — the algorithm, step by step

Pipeline order inside `buildEngine()` (each step consumes only earlier steps):

```
validate graph → topological order            (Step 1)
economic weights EW                           (Step 2)
dependence matrices D, U                      (Step 3)
network influence NI (unit-shock propagation) (Step 4)
geographic concentration HHI                  (Step 5)
policy exposure POL                           (Step 6)
structural vulnerability (static layer)       (Step 7)
event magnitude + decay                       (Step 8)
all-paths propagation + noisy-OR combining    (Step 9)
operational index / chain index / envelope    (Step 10)
company vulnerability/contribution/criticality(Step 11)
capital power                                 (Step 12)
country aggregation                           (Step 13)
21-day history replay + movers                (Step 14)
```

### Step 1 — Graph validation and topological order

**Input:** 24 stage ids, 34 edges. **Algorithm:** check every edge endpoint exists, no duplicate edges; Kahn's-algorithm topological sort (`math.js: topologicalSort`); `hasCycle = (order length ≠ node count)`.
**Output:** `graphValid = true`; topological order (used for downstream passes; reversed for upstream):

```
research, wafers, resist, gases, substrates, cmp, metro, eda, litho, depo, etch,
design, memory_fab, adv_fab, mature_fab, hbm, logic_ai, analog, adv_pkg, osat,
systems, m_ai, m_auto, m_consumer
```

### Step 2 — Economic weight `EW` (log-compressed turnover proxy)

**Formula:** `EW_n = ln(1 + value_n) / max_m ln(1 + value_m)` — compresses the skewed $B values into 0–1 without a hand-picked cap.

**Worked example (litho):** largest stage value is `systems` = 500.
`EW_litho = ln(31) / ln(501) = 3.433987 / 6.216606 = 0.552389` ✔ (engine: 0.552389)
`EW_systems = 1.0` (the max), `EW_logic_ai = ln(301)/ln(501) = 0.918043`.

**Output:** column `economic_weight_0_1` in `12_stage_metrics.csv`.

### Step 3 — Directional dependence matrices D and U (CSV: `11_dependence_matrices.csv`)

For every edge `a → b` (a supplies b):

```
specificity(a) = clamp(subst_a / 10, 0, 1)
D[b][a] = f↓ · (1/indeg(b)) · (φ + (1−φ)·specificity(a))     ← input-dependence proxy
U[a][b] = f↑ / outdeg(a)                                      ← revenue-echo proxy
```

- `1/indeg(b)` = equal-allocation prior over b's declared inputs (no bill-of-materials data exists — this is declared, not measured).
- The specificity term means harder-to-substitute inputs transmit more strongly; the floor φ=0.25 keeps even a fully substitutable input transmitting 25% of base.

**Worked example (`litho → adv_fab`):** `adv_fab` has **7** in-edges (design, wafers, litho, depo, etch, cmp, metro); litho `subst` = 9.8 → specificity 0.98; litho has **3** out-edges (adv_fab, mature_fab, memory_fab).

```
D[adv_fab][litho] = 0.55 × (1/7) × (0.25 + 0.75×0.98)
                  = 0.0785714 × 0.985 = 0.0773929   ✔ engine: 0.077393
U[litho][adv_fab] = 0.30 / 3 = 0.100000             ✔ engine: 0.100000
```

All 34 edge coefficient pairs are in `11_dependence_matrices.csv`.

### Step 4 — Network influence `NI` (Leontief-style sensitivity proxy)

**Algorithm:** for each stage *j*: inject a **unit adverse shock** (+1) at *j*, propagate **downstream** over all reachable paths (Step 9 mechanics), weight each affected stage's absolute contribution by `EW`, sum; then normalize the 24 sums to 0–10 against the largest.

```
NI_j = 10 · Σ_n EW_n·|field_j(n)|  /  max_k Σ_n EW_n·|field_k(n)|
```

**Worked example (unit shock at `litho`, downstream):** the propagated field (engine output, nonzero entries):

| stage | contribution | stage | contribution |
|---|---|---|---|
| litho | 1.000000 | analog | 0.046557 |
| adv_fab | 0.077393 (= 1 × D[adv_fab][litho]) | hbm | 0.054937 |
| mature_fab | 0.135437 | adv_pkg | 0.014429 |
| memory_fab | 0.135437 | osat | 0.035251 |
| logic_ai | 0.040970 (= noisy-OR of adv_fab path) | systems | 0.009049 |
| m_ai / m_auto / m_consumer | 0.002551 each | | |

The EW-weighted sum of these, normalized against the largest such sum (achieved by `systems`, which scores NI = 10), gives **NI_litho = 5.592**. Full ranking in `12_stage_metrics.csv`; top values: systems 10.0, adv_fab 7.73, memory_fab 7.21, design 6.16, logic_ai 6.13.

### Step 5 — Geographic concentration (HHI with explicit residual)

```
residual = max(0, 1 − Σ shares);  HHI = Σ share_i² + residual²;  GEO = 10 · HHI
```
(If shares sum to > 1 they are normalized and a diagnostic is flagged.)

**Worked example (litho):** shares nl 0.90, jp 0.09 → residual = 0.01.
`HHI = 0.90² + 0.09² + 0.01² = 0.81 + 0.0081 + 0.0001 = 0.8182` → **GEO_litho = 8.182** ✔

### Step 6 — Policy exposure

For each stage, collect severities of all policies naming it, sort descending:
```
POL = clamp10( sev₁ + 0.4 · Σ remaining sevs )
```

**Worked example (litho):** hit by `bis` (9) and `nl` (8) → `9 + 0.4×8 = 12.2` → clamped → **POL_litho = 10** ✔

### Step 7 — Structural vulnerability (static layer)

From `componentWeights`, drop `shock` (0.10, event-driven — not structural), keep the rest and renormalize to sum 1:

| Component | Raw weight | Renormalized | Source |
|---|---|---|---|
| Network influence (was "choke") | 0.25 | **0.277778** | GRAPH/DATA (Step 4) |
| Geographic concentration | 0.20 | **0.222222** | GRAPH/DATA (Step 5) |
| Policy exposure | 0.20 | **0.222222** | GRAPH/DATA (Step 6) |
| Substitutability | 0.15 | **0.166667** | ANALYST (input) |
| Market sensitivity | 0.10 | **0.111111** | ANALYST (input) |

**Worked example (litho):**
```
struct = 0.277778×5.592036 + 0.222222×8.182 + 0.222222×10 + 0.166667×9.8 + 0.111111×7
       = 1.553343 + 1.818222 + 2.222222 + 1.633333 + 0.777778
       = 8.004899   ✔ engine: 8.004899
```

### Step 8 — Event magnitude: severity × true half-life decay

```
decay(age, H) = 2^(−age/H),  H = 12 days
magnitude = sign · clamp(sev/10, 0, 1) · decay(daysAgo, 12)
```
`sign` comes from the hand-curated assumption (+1 adverse, −1 mitigating), **never** from severity. Confidence is metadata only — never a multiplier.

**All six events (engine output):**

| Event | sev | daysAgo | decay = 2^(−age/12) | magnitude | In score? |
|---|---|---|---|---|---|
| e1 | 8 | 3 | 0.840896 | **+0.672717** | yes |
| e2 | 4 | 4 | 0.793701 | **−0.317480** (mitigating) | yes |
| e3 | 6 | 6 | 0.707107 | +0.424264 | no (hazard) |
| e4 | 7 | 9 | 0.594604 | **+0.416222** | yes |
| e5 | 5 | 11 | 0.529732 | +0.264866 | no (mixed) |
| e6 | 3 | 12 | 0.500000 | +0.150000 | no (strategic) |

**Hand-check (e1):** `2^(−3/12) = 2^(−0.25) = 0.840896`; `+1 × (8/10) × 0.840896 = +0.672717` ✔

### Step 9 — All-reachable-paths propagation with bounded noisy-OR

**Algorithm** (`graph.js: propagateFromSource`): inject `magnitude` at the source stage. One forward pass in topological order applies D coefficients (downstream); one backward pass in reverse order applies U (upstream); at each node, all incoming contributions are combined with **bounded noisy-OR** and dropped below tolerance τ = 1e-4:

```
combinePositive(v₁…v_k) = 1 − Π(1 − v_i)          e.g. combine(0.4, 0.5) = 0.7
combineSigned: noisy-OR positives and negatives separately, net, clamp to [−1, 1]
```
Properties: a second adverse shock can only add, never subtract; the combined value never exceeds 1 (unlike naive sum) and never discards contributions (unlike max).

For a **multi-stage event**, one full field is propagated per affected stage, then the per-source fields are noisy-OR combined node-by-node.

**Worked example — event e1** (magnitude +0.672717 injected at logic_ai, hbm, adv_fab, adv_pkg; channel both). The engine's final value at `adv_fab` is **0.754584**. Hand-derivation of the three contributions reaching adv_fab:

```
own injection at adv_fab:                                       0.672717
upstream echo from logic_ai:  0.672717 × U[adv_fab][logic_ai]
                            = 0.672717 × 0.30                 = 0.201815
upstream echo from adv_pkg (2 hops: adv_pkg→logic_ai→adv_fab):
                              0.672717 × 0.30 × 0.30          = 0.060545

noisy-OR: 1 − (1−0.672717)(1−0.201815)(1−0.060545)
        = 1 − 0.327283 × 0.798185 × 0.939455 = 0.754584   ✔ engine: 0.754584
```

The full 79-row per-event propagated fields (6 events × reached stages) are in `13_event_propagated_fields.csv`.

**Baseline operational field:** noisy-OR combination of the fields of the three *operational* events only (e1 adverse, e2 mitigating, e4 adverse) — e3/e5/e6 are displayed individually but excluded from the score. Result per stage: column `baseline_operational_field_signed` in `12_stage_metrics.csv` (e.g. adv_fab +0.760112, hbm +0.740868, gases +0.442067).

### Step 10 — Operational chain index and sensitivity envelope

```
operationalIndex = clamp[−1,1]( Σ_n EW_n·field_n / Σ_n EW_n )
displayIndex     = 5 + 5 × operationalIndex          (5 = neutral)
```

**Snapshot result:** signed index **+0.227145** → chain index **6.136** (net adverse).
**Sensitivity envelope** (re-run at ±30% on f↓, f↑, H — a model-sensitivity bound, *not* a confidence interval): low 5.874 / base 6.136 / high 6.408.

### Step 11 — Company metrics: three separately-labeled numbers (CSV: `14_company_metrics.csv`)

Company input: `stakes` = within-stage shares. Worked example throughout: **TSMC** `{adv_fab: 0.85, mature_fab: 0.20, adv_pkg: 0.35}`, using the baseline field from Step 9.

**(a) Vulnerability — share-independent** (average adverse impact over occupied stages):
```
vuln = 10 × mean( max(0, field_s) )
     = 10 × (0.760112 + 0.019821 + 0.401766)/3 = 3.938994   ✔ engine: 3.938994
```

**(b) Contribution — share-weighted** (share never cancels; shares normalized only if a stage's company shares sum > 1 — flagged, e.g. logic_ai sums to 1.051):
```
contrib = Σ share_c,s × max(0, field_s) × EW_s
        = 0.85×0.760112×0.771448 + 0.20×0.019821×0.725614 + 0.35×0.401766×0.615873
        = 0.498428 + 0.002877 + 0.086601 = 0.587908          ✔ engine: 0.587908
```

**(c) Systemic criticality — "if this company were fully disrupted":** inject a shock at every stage the company occupies, sized to its within-stage share (0.85 at adv_fab, 0.20 at mature_fab, 0.35 at adv_pkg), propagate **both directions**, noisy-OR combine, then take the NI-weighted mean of adverse impact:
```
raw_c = Σ_n max(0, field_n)·NI_n / Σ_n NI_n
criticality_c = 10 × raw_c / max over all 109 companies
```
TSMC has the largest raw value in the snapshot → **criticality = 10.0** (the normalization anchor). Top 10: TSMC 10.0, NVIDIA 5.17, ASML 4.68, Samsung 4.02, Foxconn 3.87, SK hynix 3.19, ASE 2.97, Applied Materials 2.73, Micron 1.95, Quanta 1.93.

### Step 12 — Capital power (CSV: `15_capital_power.csv`)

```
CapitalPower_owner = Σ_companies ownership_share × criticality_company
```
**Hand-check:** Taiwan NDF holds 6.38% of TSMC (criticality 10) and nothing else → `0.0638 × 10 = 0.638` ✔ engine: 0.638.
Top 5: BlackRock 2.854, Vanguard 2.757, SoftBank Group 1.441, Lee family & affiliates 0.723, SK Square 0.654. State-linked flags: Taiwan NDF, Korea NPS, etc.

### Step 13 — Country aggregation (CSV: `16_country_metrics.csv`)

Per country: share-weighted mean of the stage-level structural components over every stage the country participates in (production geography, **not** company HQ), re-scored with the Step-7 weights; operational = share-weighted mean of the baseline field, noisy-OR combined with any direct country-tagged operational event magnitudes. Nothing is hand-set at country level.

### Step 14 — Computed history and movers (CSVs: `17`, `18`)

The 21-day sparkline **re-runs the whole Step 8–10 computation** at each past day by shifting every event's `daysAgo` by +t (t = 21…0) — never `Date.now()`, never scenario-adjusted. Result rises from **5.391** (21 days before snapshot) to **6.136** (snapshot date) as the recent events' decay terms grow. Movers-7D = per-stage display-index change vs 7 days prior (top mover: `gases`, driven by e4).

---

## 4. Output data (final computed tables)

### 4.1 Stage-level outputs (full table = `12_stage_metrics.csv`)

Top 8 by structural vulnerability:

| Stage | NI | GEO | POL | subst | market | **Structural 0–10** | Baseline op. field | Op. display |
|---|---|---|---|---|---|---|---|---|
| litho | 5.59 | 8.18 | 10.0 | 9.8 | 7.0 | **8.005** | +0.104 | 5.52 |
| adv_fab | 7.73 | 4.41 | 10.0 | 9.5 | 8.5 | **7.877** | +0.760 | 8.80 |
| logic_ai | 6.13 | 4.97 | 9.0 | 6.5 | 9.5 | **6.948** | +0.516 | 7.58 |
| hbm | 4.01 | 6.15 | 9.0 | 8.5 | 9.0 | **6.897** | +0.741 | 8.70 |
| metro | 3.83 | 4.90 | 10.0 | 8.0 | 5.5 | **6.319** | +0.153 | 5.76 |
| etch | 4.09 | 3.33 | 10.0 | 7.5 | 6.0 | **6.016** | +0.289 | 6.45 |
| depo | 4.15 | 2.76 | 10.0 | 7.5 | 6.0 | **5.904** | +0.303 | 6.52 |
| memory_fab | 7.21 | 4.07 | 4.0 | 6.5 | 8.5 | **5.825** | +0.145 | 5.73 |

### 4.2 Headline scalar outputs

| Output | Value |
|---|---|
| Baseline operational chain index (0–10, 5 = neutral) | **6.136** (signed +0.227145) |
| Sensitivity envelope (low / base / high) | 5.874 / 6.136 / 6.408 |
| Most systemically critical company | TSMC (10.0) |
| Largest capital-power holder | BlackRock (2.854) |
| Chain index 21 days before snapshot | 5.391 |

### 4.3 Company & capital rankings

Full 109-company table in `14_company_metrics.csv` (criticality, vulnerability, contribution — three separately-labeled numbers, never blended); 31 owners in `15_capital_power.csv`; 16 countries in `16_country_metrics.csv`; 22-point history in `17_history_chain_index.csv`.

---

## 5. Diagnostics the run emitted

- Graph validation: **passed** (24 nodes, 34 edges, acyclic).
- Warning (`company-share`): stage `logic_ai` company shares sum to **1.051** (> 1) — normalized for the contribution computation and flagged "within modeled sample" rather than silently accepted.

---

## 6. CSV file index (all in [`csv/`](csv/))

| # | File | Contents | Rows |
|---|---|---|---|
| 01 | `01_model_priors.csv` | Every model parameter + meaning | 13 |
| 02 | `02_stages.csv` | Stage inputs (value, subst, market, share sums) | 24 |
| 03 | `03_stage_country_shares.csv` | Country share per stage (long format) | 126 |
| 04 | `04_flow_edges.csv` | The 34 directed DAG edges | 34 |
| 05 | `05_policies.csv` | Policy instruments | 7 |
| 06 | `06_events.csv` | Events incl. curated assumptions | 6 |
| 07 | `07_companies.csv` | Companies (HQ, domain, stakes) | 109 |
| 08 | `08_company_stakes.csv` | Company×stage shares (long format) | 139 |
| 09 | `09_customers.csv` | Supplier→customer revenue shares | 243 |
| 10 | `10_owners.csv` | Ownership records + state-linked flag | 75 |
| 11 | `11_dependence_matrices.csv` | D and U coefficients per edge (with indeg/outdeg/specificity) | 34 |
| 12 | `12_stage_metrics.csv` | All stage intermediates & outputs (EW, HHI, GEO, POL, NI, structural, operational) | 24 |
| 13 | `13_event_propagated_fields.csv` | Per-event propagated contribution at every reached stage | 79 |
| 14 | `14_company_metrics.csv` | Criticality / vulnerability / contribution, ranked | 109 |
| 15 | `15_capital_power.csv` | Owner capital-power ranking | 31 |
| 16 | `16_country_metrics.csv` | Country structural/operational aggregates | 16 |
| 17 | `17_history_chain_index.csv` | 22-day baseline chain-index replay | 22 |
| 18 | `18_movers_7d.csv` | Per-stage 7-day display-index change | 24 |

---

## 7. Honest-labeling notes (what these numbers are NOT)

- Every transmission coefficient (0.55 / 0.30 / 0.25 / 12-day half-life) is a **declared, unvalidated Tier-D sensitivity prior** — not calibrated against any historical disruption episode.
- D/U are equal-allocation graph priors — **not** measured input–output coefficients, bills of materials, or trade flows.
- Scores support **comparison and sensitivity ranking within this snapshot only** — no number here is a predicted financial loss, probability, or forecast.
- The sensitivity envelope bounds model sensitivity to three parameters; it is **not** a confidence interval.
- ~20/24 stages and ~105/109 companies carry no per-figure evidence citation yet (see `npm run audit:data`).
