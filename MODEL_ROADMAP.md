# MODEL_ROADMAP — Deferred data-layer work

This document describes data and modeling work SSCIM's engine would need
before any of its outputs could be called calibrated. **It describes
deferred work; it does not implement any of it.** See `README.md` §4 for
what the engine currently computes, and §9 for the full "Model status and
limitations" statement.

Every item below is a gap between "a transparent, inspectable prior" (what
the current model provides) and "a measured or fitted parameter" (what
would be required to support a real forecasting or loss-estimation claim).

## 1. Dependence-type splits currently collapsed into one proxy

The engine's directional dependence matrices (`README.md` §4.4) are
equal-allocation priors derived only from graph in/out-degree and a single
analyst-judgment substitutability score. A real model would need each of
the following kept as **separate, explicitly labeled measures** rather
than one blended number:

- **Buyer input dependence** — how much of buyer B's *physical input* comes
  from supplier A (a bill-of-materials fact), vs. the current proxy, which
  only encodes "how many declared inputs does B have."
- **Supplier revenue dependence** — how much of supplier A's *revenue*
  comes from buyer B (closer to what `CUSTOMERS`/`U` already approximates,
  but from disclosed sales-share data, not a modeled prior).
- **Qualification dependence** — whether B is technically *qualified* to
  source the same input from an alternative supplier at all, independent
  of current volume splits (a switching-feasibility fact, not a share).
- **Capacity / utilization** — whether a supplier has spare capacity to
  absorb a shift in demand, or is already running near full utilization
  (changes how a shock actually propagates, independent of its share).
- **Inventory days** — how many days of buffer stock sit between a
  disruption at A and a felt effect at B (changes propagation *timing*,
  which the current model does not represent at all — everything is
  instantaneous plus decay from the origin).
- **Time-to-recover (TTR) / time-to-switch (TTS)** — how long a disrupted
  node takes to resume output, and how long a buyer takes to qualify and
  ramp an alternate source — both absent from the current model, which has
  no duration concept beyond the origin event's own decay half-life.
- **Alternative-supplier count** — a count-based substitutability measure,
  distinct from the current 0–10 analyst-judgment `subst` score.

## 2. Geography currently conflated across three distinct concepts

- **Facility geography** — where a company's actual production sites are.
  Not currently modeled at all; the engine only has (a) stage-level country
  *shares* (aggregate production share, not tied to any specific facility)
  and (b) company *headquarters* country. Facility geography cannot be
  inferred from either.
- **Headquarters geography** — currently shown, correctly labeled "HQ:" in
  the UI, but never a substitute for facility geography.
- **Shipping / logistics geography** — physical transit routes and
  chokepoints (straits, ports, airfreight lanes) are not modeled; the
  "Taiwan Strait crisis" scenario simulates a severity shock at Taiwan-
  linked stages, not an actual shipping-route disruption.
- **End-customer geography** — where a stage's *output* is ultimately
  consumed (vs. where it is produced) is not modeled; country scores
  reflect production-side participation only.

## 3. Market-share denominators and units that must not be merged

Several stages in the current snapshot blend measures that a real model
would need to keep as separate series with explicit units and dates:

- **DRAM / NAND / HBM** must not share one denominator — they are
  different products with different supply/demand dynamics and different
  leading suppliers; the current `memory_fab`/`hbm` stages already keep
  HBM separate, but DRAM and NAND remain combined under `memory_fab`.
- **Merchant AI accelerators vs. captive hyperscaler ASICs** are different
  markets (one is a company selling silicon to many buyers; the other is a
  hyperscaler designing chips for its own infrastructure) and should not
  share one "AI accelerator market share" denominator.
- **Advanced-node foundry capacity vs. total foundry revenue** are
  different measures (a foundry can lead one and trail the other); the
  current `adv_fab` stage's shares are a capacity-weighted judgment, not a
  disclosed unit-consistent metric.
- Every named company/stage share should eventually carry an explicit
  **estimate type** (unit shipments, revenue, capacity), **date**,
  **source**, and **evidence tier** (see `README.md` §8) rather than a
  single unlabeled percentage.

## 4. Relationship-percentage semantics

Every named supplier→customer relationship in `CUSTOMERS` must preserve,
explicitly, whether its percentage is a **supplier revenue share** (what
fraction of the supplier's sales this customer represents) or a **buyer
input share** (what fraction of the buyer's input this supplier provides)
— these are different numbers describing the same edge, and the current
dataset only discloses the former. See `README.md` §4.4 and §9.

## 5. Calibration

The propagation priors (`downstreamTransmission`, `upstreamTransmission`,
`halfLifeDays`, `specificityFloor`, and the noisy-OR combination itself —
see `README.md` §4.4–§4.7) are declared, not fit. A calibration pass would
backtest them against documented historical disruption episodes (e.g. the
2021 ABF substrate shortage, the 2023 Ga/Ge licensing action, successive
export-control rounds) with observed downstream effects, and report
goodness-of-fit — not simply pick coefficients that "look directionally
sensible," as the current priors do.
