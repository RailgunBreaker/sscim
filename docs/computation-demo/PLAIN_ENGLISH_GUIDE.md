# SSCIM from zero — plain-English guide (no math background needed)

This document explains how the whole thing works **from scratch**, then answers the five open questions, honestly. Companion docs: [COMPUTATION_DEMO.md](COMPUTATION_DEMO.md) (exact formulas & numbers), [REAL_DATA_EXAMPLE.md](REAL_DATA_EXAMPLE.md) (real-source example), [DATA_PIPELINE.md](DATA_PIPELINE.md) (automation design).

---

## Part 0 — Where things honestly stand today

The assessment in the team chat is correct, with one correction:

- ✅ Correct: **almost all data in the app is hand-typed demo data** (`server/src/seed-data.js` → frozen into `vault-snapshot.json`). It was improved with a research pass (some figures have citations), but it is not live.
- ✅ Correct: **there is no automated processing pipeline.** The two fetch scripts in `computation-demo/` are one-off demonstrations, not scheduled jobs. Nothing they fetch flows into the app automatically. The missing machinery (scheduler → staging → validation → human review → write to database → recompute) is designed in [DATA_PIPELINE.md](DATA_PIPELINE.md) §2 but **not built**.
- ⚠️ Small correction: what gets fetched dynamically is company **revenue** (营收, from annual reports via the SEC's free API), not market cap (市值). Market cap is not used anywhere in the model.
- ⚠️ Clarification on "Federal Register 是写死的 URL": the demo actually calls the Federal Register's **search API** with query parameters (agency = BIS, keyword = semiconductor, newest first), so it finds *new* documents too — but it only runs when someone runs it by hand. What's missing is scheduling + processing, not the URL.

---

## Part 1 — How the system works, from zero

### 1.1 What the product is trying to answer

Three questions, continuously:
1. **Which parts of the chip supply chain are fragile by construction?** (Even on a quiet news day.)
2. **What did today's news/policy actually change, and how far does the damage spread?**
3. **Which companies/countries/investors are most exposed to all of that?**

### 1.2 The world model: boxes and arrows

Think of the global chip industry as **24 boxes connected by arrows**.

- A **box** ("stage") is one job in the industry: "make silicon wafers", "make lithography machines", "run advanced factories", "design AI chips", "package chips", "sell AI data centers"…
- An **arrow** from box A to box B means "A's output is an input for B". Lithography machines → advanced factories → AI chips → packaging → finished servers. There are 34 arrows.
- Arrows only point forward (nothing supplies its own supplier), which technically makes the picture a "DAG" — that's all that word means: a one-way flow chart with no loops.

Each box carries a few numbers:
- **How big it is** (rough global revenue of that activity, in $B).
- **Which countries do this work**, in percentages (the Netherlands does ~90% of lithography machines; Korea ~95% of HBM memory).
- Two **expert opinions** (0–10): how hard the box's output is to substitute, and how price/demand-sensitive it is.

Separately there is a list of **109 companies**, each tagged with "which boxes it works in and what share of that box it owns" (TSMC = 85% of the advanced-factory box), plus who its customers are, plus who its shareholders are. And a list of **7 policy regimes** (export controls etc.) and **6 news events**.

### 1.3 The two kinds of scores (never mixed)

**Structural score** = "how fragile is this box, by construction?" It combines: how central the box is in the flow chart, how geographically concentrated it is, how many export-control regimes touch it, and the two expert opinions. This number **ignores the news completely** — it changes only if the world's structure changes.

**Operational score** = "what is today's news doing to this box?" This starts at neutral and moves only when events fire. The two are shown side by side and never blended, so a scary headline can never quietly rewrite "what the industry is".

### 1.4 How a shock spreads (the core trick, no formulas)

Imagine pouring **dye into one box** and watching it flow along the arrows:

1. **The pour** = an event. Its strength = how severe the event is (0–10 → 0–1) × how fresh it is. Freshness **halves every 12 days** — a 12-day-old story hits half as hard, a two-month-old story is basically water.
2. **Each hop dilutes.** When dye flows from "lithography" into "advanced factories", it gets multiplied by a small number (≈0.27 in the current setup). That number is bigger when the receiving box has few other inputs, and bigger when the sending box is hard to replace. Flowing *backwards* (my customer died, so my sales drop) also happens, but weaker.
3. **Dye keeps flowing hop after hop** until it's too diluted to matter (below 0.01% — then we stop chasing it).
4. **When two streams of dye hit the same box**, they combine like risks, not like sums: two 40% problems make a 64% problem, not an 80% one — and never more than 100%. (This is the "noisy-OR" you see in the docs; that's the entire idea.)
5. Some events are **good news** (a capacity expansion, an export-control *easing*) — negative dye that cancels positive dye.

### 1.5 A toy example you can do in your head

Three boxes: **Machines → Factory → Chips**. Say the Factory depends on Machines with strength 0.3, Chips on Factory with strength 0.5.

News: "Machine exports restricted", severity 6/10, happened today → pour strength **0.6** into Machines.
- Factory receives 0.6 × 0.3 = **0.18**.
- Chips receives 0.18 × 0.5 = **0.09**.
- Twelve days later the same story only pours 0.3, so Factory feels 0.09, Chips 0.045.

Now add a second, older problem hitting Factory directly at 0.10. Factory's total isn't 0.18 + 0.10 = 0.28; it's 1 − (1−0.18)(1−0.10) = **0.262** — slightly less than the sum, because overlapping troubles overlap. That's the whole engine; everything else is bookkeeping over 24 boxes instead of 3.

### 1.6 From box scores to headline outputs

- **Chain index**: take every box's current shock level, weight big boxes more (on a log scale so the $500B box doesn't drown the $3B chokepoint), average → map to 0–10 where **5 = calm**, above 5 = net bad news, below 5 = net good news.
- **Company scores**: three separate numbers per company — "how exposed is the *type* of business it's in", "how much of *today's* shock actually flows through it (size-weighted)", and "if this company vanished tomorrow, how badly would the whole chart hurt" (run the dye simulation with the company itself as the pour). That last one is the headline ranking; TSMC tops it.
- **Capital power**: shareholder's stake × company's headline score, summed — "who owns the most critical capacity".
- **Country scores**: roll box scores up by each country's share of each box.
- **History**: replay the whole computation as of yesterday, the day before, … 21 days back (just age every event by +1 day each time). No stored time series; it's recomputed.

---

## Part 2 — The five questions (原问题 + answers)

### Q1. 具体需要哪些 data？ — Exactly what data does the product need?

Nine kinds. Status column = what it is **today**:

| # | Data | Used for | Today |
|---|---|---|---|
| 1 | **Stage market sizes** ($B per box) | weighting big vs small boxes | hand-typed estimates |
| 2 | **Country market shares per stage** (NL 90% of litho…) | concentration scores, country scores | hand-typed from research pass |
| 3 | **Company revenue / segment revenue** | anchors sizes & shares | ✅ fetchable free via SEC EDGAR (demo works) |
| 4 | **Company within-stage market shares** (TSMC 85% of adv fab) | company scores | hand-typed (TrendForce-style numbers) |
| 5 | **Customer relationships** (ASML sells 35% to TSMC) | spread trees, country links | hand-typed; partially disclosed in filings |
| 6 | **Shareholders** (BlackRock 5.1% of TSMC) | capital-power ranking | hand-typed; 13F filings make it fetchable |
| 7 | **Policy instruments** (export-control rules) | policy-exposure score | hand-typed list of 7; discoverable free via Federal Register/EUR-Lex |
| 8 | **News events** (what happened, when, how bad) | the entire operational layer | 6 hand-written samples |
| 9 | **Expert judgments** (substitutability, market sensitivity, severities, event classification) | scores & shock sizes | hand-set — and stays that way *by design* (see Q4) |

### Q2. 从哪里 fetch，怎么收费？ — Where to fetch each, and what does it cost?

(Prices are ballpark; verify current pricing before committing.)

| Source | Covers | Cost | Notes |
|---|---|---|---|
| **SEC EDGAR APIs** (`data.sec.gov`) | #3 revenue/segments, #6 via 13F filings, #5 partially (customer-concentration notes in 10-K/20-F text) | **Free**, no key | Works today (demo fetched ASML/TSMC/NVIDIA/Micron/AMAT). Covers any company traded in the US, incl. ADRs |
| **Federal Register API** | #7 US export controls, #8 US policy events | **Free**, no key | Works today. Search by agency=BIS |
| **EUR-Lex API** | #7 EU (Chips Act, dual-use) | Free | |
| **METI / MOFCOM websites** | #7 Japan/China measures | Free (scraping + translation) | No API; needs a scraper and human check |
| **GDELT** | #8 global news firehose | Free | Very noisy; fine for prototype discovery |
| **newsdata.io** | #8 news | Free tier (~200 credits/day, delayed); paid roughly $150–400/mo | Reasonable prototype tier before wire licenses |
| **NewsAPI.org / Bing-class news APIs** | #8 | ~$0–450/mo | Similar tier |
| **Reuters / Bloomberg / Nikkei wires** | #8 production-grade, low latency | Enterprise $$$ (five figures/yr+) | Only when the briefing becomes a paid product |
| **TrendForce / Gartner / TechInsights / IDC / Yole** | #1, #2, #4 — the market shares | Subscription reports, roughly $5k–$30k+/yr per coverage area | **The only real source for shares.** Free fallback: their press releases (partial, delayed) + computing shares from public vendor revenues where one stage = a few listed firms (works for litho: ASML/Nikon/Canon) |
| **SEMI / WSTS-SIA** | #1 equipment & industry totals | Membership/subscription; headline numbers free in press releases | |
| **Bloomberg SPLC / FactSet Revere** | #5 supply-chain links at scale | Enterprise ($25k+/yr class) | Only if customer-graph coverage becomes a priority |

Sensible spend order: start 100% free (EDGAR + Federal Register + EUR-Lex + press releases), then one tracker subscription (TrendForce covers foundry/HBM/DRAM — the highest-value shares), then news wires.

### Q3. 供应链信息从哪里来？写死 / 自动 / 定期？ — Where does the supply-chain structure come from; hardcoded, auto, or periodic?

Split it into three different things with three different answers:

1. **The boxes-and-arrows structure** (which 24 stages exist, who feeds whom — the [§2.2 table](COMPUTATION_DEMO.md#22-stages--24-dag-nodes-csv-02_stagescsv--03_stage_country_sharescsv) skeleton): **hardcoded on purpose, changed by code review.** This is industry knowledge distilled from studies (CSET "The Semiconductor Supply Chain", SIA/BCG reports) — it changes over *years* (e.g., HBM becoming its own stage), not weeks. Auto-updating structure would mean letting a scraper redesign your world model. Review it maybe twice a year.
2. **The numbers attached to the structure** (stage sizes, country shares, company shares): **periodic scheduled update — quarterly** — because their sources publish quarterly/annually (filings, tracker reports). Each update should flow through the review pipeline with a citation attached, not be edited in code.
3. **Policies and events**: **continuous automatic discovery** (daily cron against Federal Register/EUR-Lex/news APIs) with **human classification before publishing** (see Q4 for why).

So: structure = hardcoded + reviewed · quantities = quarterly refresh · news = daily automatic discovery + human sign-off. That trio is exactly the pipeline in [DATA_PIPELINE.md](DATA_PIPELINE.md) §2 — none of it is built yet.

### Q4. 现在的算法是否正确？参数是什么意思？ — Is the algorithm correct, and what do the parameters mean?

Two different senses of "correct":

**Internally correct — yes, with evidence.** The building blocks are standard (HHI concentration index, topological-order graph propagation, noisy-OR combination, true half-life decay); the engine has a unit-test suite; and in [COMPUTATION_DEMO.md](COMPUTATION_DEMO.md) every step was recomputed **by hand** and matched the code digit-for-digit. Several real bugs from the earlier version are documented as fixed (a fake "half-life" that wasn't, confidence multiplied into impact size, market share cancelling out of company scores). It also behaves sensibly on real inputs: fed the January 2026 BIS *easing*, the index correctly went below neutral.

**Predictively correct — unproven, and the docs say so loudly.** No parameter has been calibrated against a real historical disruption. The model is a *consistent ranking machine* ("A is more exposed than B, under these declared assumptions"), not a forecaster ("TSMC will lose $X"). Treat every output as relative, not absolute. The planned fix is backtesting against documented episodes (2021 substrate shortage, 2023 gallium licensing) — roadmap, not done.

**The parameters in plain words** (full detail: [COMPUTATION_DEMO.md §2.1](COMPUTATION_DEMO.md#21-model-parameters--model_priors-csv-01_model_priorscsv)) — all hand-picked judgment calls living in one file (`priors.js`):

| Parameter | Plain meaning | Why this value |
|---|---|---|
| half-life = 12 days | news loses half its punch every 12 days | "a story stops changing operations after ~2 months" — judgment |
| downstream = 0.55 | losing a supplier passes ~55% of the pain to the buyer per hop | >50% so supply shocks matter; <100% so they fade with distance |
| upstream = 0.30 | losing a customer passes ~30% back to the supplier | weaker: suppliers can resell elsewhere more easily than buyers can re-qualify inputs |
| specificity floor = 0.25 | even an easily-replaced input passes ≥25% | switching suppliers is never instant |
| tolerance = 1e-4 | stop tracking dye below 0.01% | pure computational cutoff |
| component weights | fragility recipe: network position 25% > geography 20% = policy 20% > substitutability 15% > market 10% | the *ordering* is the claim; exact values are round numbers |
| ±30% envelope | recompute with all of the above 30% higher/lower | shows how much the answer depends on the guesses |

And the reason judgment fields (severity, event direction) stay human: the standing example is Federal Register doc 2026-00789 — titled like an export restriction, actually an **easing**. A keyword classifier flips the sign; a human reader doesn't.

### Q5. 最后要算出来的 output 是什么？ — What does the system ultimately output?

Seven things, all recomputed from scratch on every data change:

1. **Chain index** — one number, 0–10, 5 = calm. "How bad is the supply-chain news environment right now?" Plus a low/base/high band showing parameter sensitivity. (Snapshot: 6.14, mildly adverse.)
2. **Per-stage scoreboard** — every box's structural fragility (static) next to its current shock level (dynamic). (Snapshot: lithography most fragile structurally at 8.0; advanced fab most shocked at 8.8.)
3. **Company criticality ranking** — "whose disappearance would hurt the chain most", all 109 ranked. (TSMC 10.0, NVIDIA 5.2, ASML 4.7…) Plus the two supporting per-company numbers (exposure, current-shock flow-through).
4. **Capital-power ranking** — which shareholders control the most critical capacity, state-linked owners flagged. (BlackRock 2.85, Vanguard 2.76, …)
5. **Country risk board** — structural + operational score per country, derived from production shares.
6. **Movers & history** — which stages changed most in 7 days, and the 21-day index curve.
7. **The GP briefing** — a generated daily text summary ("what changed, who is most exposed, what to watch") composed from items 1–6. This is the intended first commercial product.

The intended user action: an analyst/investor/policy person opens the dashboard (or reads the briefing) and immediately sees *what changed, how far it spreads, and who is exposed* — with every number traceable back through the docs above to a formula, a parameter, and (eventually) a cited source.
