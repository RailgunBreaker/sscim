# Reference — Supply-chain structure

*Last updated: 2026-08-22. Part of the [reference library](README.md).*

The graph everything else is computed over: **24 stages**, **34 directed
edges**, **243 company-to-company relationships**, and a derived **site network
of ~890 links**.

## Stages — the 24 steps

Defined in `server/src/seed-data.js`. From research and EDA through wafers,
chemicals, five equipment categories, three fab types, chip products,
packaging, and end markets.

| Field | Tier | Meaning |
| --- | --- | --- |
| `id`, `name`, `x`, `y` | — | Identity and layout position |
| `value` | B | Annual economic value, US$B — feeds the log-compressed economic weight |
| `shares` | B | Country production shares; the undisclosed remainder is kept as an **explicit residual**, not dropped |
| `subst` | **D** | Substitutability 0–10. By this dataset's convention a HIGH value means *hard to substitute* |
| `market` | **D** | Market sensitivity 0–10 |

The residual treatment matters: ignoring it understates concentration whenever
disclosed shares do not sum to 1, which is the common case. Shares summing to
materially more than 1 are normalised for computation and flagged as a
diagnostic rather than silently accepted.

## Flow edges — the 34 dependencies

Curated from published process-flow descriptions and **validated acyclic** on
every build. A cycle, a dangling edge or a duplicate surfaces as an explicit
diagnostic rather than silently propagating arbitrary values — a topological
order has to exist for propagation to be defined at all.

## Customer relationships — 243 edges

Disclosed customer concentration plus trade-press estimates, **top customers
only**. Tier C where a filing states it, B where the press estimates it.

**This is supplier-revenue share, which is not buyer input-dependence.** The
two directions are different quantities and are modeled separately. ASML → TSMC
at some percentage of ASML's sales does not mean TSMC is that percentage
dependent on ASML for EUV, where the real dependence is closer to complete.

Coverage is deliberately partial: 80 of 80 suppliers disclose under 100% of
customer revenue, because the sample lists top customers only. The audit
reports the exact figure per supplier on every run.

## The derived site network — ~890 links

Composed in `app/src/engine/facilityNetwork.js` from the company customer table
and the stage flow graph. **Derived, never an input.**

A link exists when the two operators have a customer edge, their stages relate
in the flow graph, and both sites carry exposure weight. Weight is

```
companyShare × siteShare(supplier) × siteShare(customer) × reach
```

where `reach` is the engine's own downstream propagation — so the network
introduces no coefficient that is not already declared.

### Three relationship classes, each found the hard way

| Class | When | Drawn |
| --- | --- | --- |
| `forward` | The supplier's stage reaches the customer's downstream | solid |
| `service` | The customer's stage reaches the supplier's — the die flows *toward* the supplier and back, as when an OSAT packages a fabless firm's silicon | dashed |
| `co-input` | Neither reaches the other, but both feed a common downstream stage | dotted |

Each was added because its absence was deleting real relationships:

- **Reachability, not adjacency.** JSR sells photoresist to TSMC, but the graph
  routes resist → litho → adv_fab. A direct-edge test silently dropped 130 of
  243 company edges — most of the upstream half of the chain.
- **Commercial direction is not physical direction.** ASE "supplies" NVIDIA,
  but packaging sits downstream of design. Those links are kept and marked,
  not relabelled or dropped.
- **Siblings are a third case.** Unimicron and Ibiden make the ABF substrates
  NVIDIA's packages are built on, but substrates and logic_ai both feed
  advanced packaging and neither reaches the other. A forward-or-backward rule
  scored one of the most watched constraints in the industry at zero, and
  dropped 12 real company relationships with it. Co-input links are weighted by
  the **weaker** of the two paths to the meeting stage, because the coupling is
  only as strong as its weaker leg.

### What the network is not

**It is not a shipment route.** No dataset here records which plant ships to
which plant. Two sites of the same company pair receive links in proportion to
their significance ordinals, which is an allocation assumption and exactly as
strong as those ordinals. The label used throughout the interface is "modeled
site-to-site link".

The displayed strength is a **relative ordering**, not a volume — and in the
per-plant graph it is normalised against that plant's own strongest link, since
a global scale rounds almost every link to zero.

## What this does not know

- **56 of 275 sites have no modeled link.** Their operators have no customer
  edge in the sample at all — Alibaba, Ansys, Biren, Cambricon, Empyrean, HP,
  Lenovo, Winbond, Nanya and others. That is a coverage gap in the customers
  table, not a rule gap, and no graph logic fixes it.
- **The dependence matrices are equal-allocation priors** derived from graph
  degree and one analyst input, not measured input–output coefficients. No
  bill-of-materials or facility-level flow dataset exists here to build one.
- **The display cap.** The map draws the strongest few hundred links; every
  built link stays in the per-site index, and both figures are shown.
