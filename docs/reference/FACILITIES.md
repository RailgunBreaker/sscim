# Reference — Facilities

*Model version: `sscim-model-v7.1-exposure-robustness`. How a facility footprint
becomes a stage exposure is defined in
[`docs/MODEL_V7_SPEC.md` §3.3](../MODEL_V7_SPEC.md#33-modeled-facility-footprint--enginefacilitiesjs).*

**Two things about the `scale` field, stated before any number on this page.**

1. It is an **analyst ordinal on 1–5**. Ratios of its values are not observed
   production capacity, and no output derived from it may be described as a
   capacity share. The mapping from the ordinal to a site weight is a declared
   model form with three options (`equal`, `linear`, `convex`), reported
   separately in sensitivity.
2. A hazard's effect on a stage is **continuous in the modeled facility
   footprint** inside the radius: zero footprint gives exactly zero, more
   footprint never gives less, and a 5% footprint does not give what a 100%
   footprint gives. The 5% line that appears in the interface is a **display
   threshold** and gates nothing the model computes.


*Last updated: 2026-08-22. Part of the [reference library](README.md).*

**275 named sites** across 24 countries, covering all 109 modeled companies.
Defined in `server/src/facilities-data.js`, synced by
`server/scripts/sync-facilities.mjs`.

## Why the layer exists

A country marker cannot answer the question an earthquake asks, because a
hazard happens at a point, not in a country. The M7.1 Kumamoto event hit
Kyushu; Kyushu is JASM, Sony CIS and Renesas Kawashiri, and it is not Naka or
Yokkaichi. The site layer resolves a coordinate into named plants, what they
make, and the chain steps they feed.

## What a facility record holds — and the split inside it

This is the part that matters. A single record mixes sourced fact with analyst
judgement, and the two are never merged:

| Field | Tier | Origin |
| --- | --- | --- |
| `company`, `name`, `country` | **C** | Public company site listings and programme announcements |
| `lat`, `lng` | **C** | Site- or city-level, approximate to a few kilometres |
| `output` — what it makes | **C** | The same listings, compressed to one line |
| `node`, `waferSize` | **C** | Company disclosures where stated; omitted where not |
| `status`, `since` | **C** | operating / ramping / construction / idle |
| `kind` | **D** | fab, assembly, materials, equipment, rnd, datacenter |
| `stages` | **D** | Analyst mapping onto the 24 modeled stages |
| **`scale` — 1–5** | **D** | **Analyst ordinal. The only field the impact maths uses.** |
| `source` | — | Per-record citation; 134 distinct publishers |

## There is no capacity data

`scale` is **not** wafer starts, revenue, or floor area. It is a 1–5 judgement
of a site's significance within the stages it feeds, discounted by operating
status: a site under construction carries zero weight because it has no output
to lose.

Mixing a published wafer-start figure for the ten fabs that report one with a
guess for the other 265 would produce a number that *reads* as measured and is
not. So the model uses the ordinal alone, and **every share the layer produces
is a share of the modeled site sample, never of world capacity** — labelled
that way everywhere it surfaces.

## Composition

| Kind | Sites | | Status | Sites |
| --- | --- | --- | --- | --- |
| Wafer fab | 95 | | Operating | 249 |
| Assembly & test | 63 | | Ramping | 20 |
| Materials | 45 | | Construction | 6 |
| R&D / design | 37 | | | |
| Equipment | 30 | | | |
| Datacentre | 5 | | | |

Fabless designers, EDA vendors and cloud buyers have sites too — design
campuses and datacentres. They make no wafers, and their `scale` reflects
significance to the stage they occupy, not manufacturing output. Every
generated profile says so: a design site "produces no physical output", a
datacentre "is a demand site, not a production site".

## Profiles are generated, not written

All 275 introductions come from the same fields through the same code
(`app/src/engine/facilityProfile.js`). Hand-writing 275 would drift — the tenth
would mention capacity and the fiftieth would not, one plant would be
"critical" and an identical one "significant" — and a reader comparing two
sites would be comparing two authors. Generated, they differ only where the
sites differ. The only free prose in a profile is the record's own one-line
`output`.

## Countries: scoring versus hosting

Sixteen of the 24 countries carry stage shares and participate in the index.
Eight are **host-only** — Austria, Italy, Czechia, India, Thailand, Canada,
Switzerland, Poland. They carry no stage share, contribute nothing to any
score, and exist so that real plants can be mapped at all.

Before that split, one list was doing two jobs — deciding what gets scored and
deciding what can be drawn — and Infineon Villach, ST Agrate and Catania,
onsemi Rožnov, Micron Sanand and every Indian design centre were simply absent.

## Sources

134 distinct publishers, almost all of the form *"<Company> facility listings /
site disclosures; scale is an analyst judgement."* Every one is listed in the
[source register](SOURCE-REGISTER.md), with the number of sites resting on it.

## What this does not know

- **How much any plant makes.** No capacity, no utilisation, no wafer starts.
- **Where a building is.** Coordinates are approximations good to a few
  kilometres — enough to decide whether a plant sits inside a 200 km hazard
  radius, not enough to site anything.
- **Everything that exists.** Coverage is a curated sample, not a census. There
  are several thousand semiconductor-related plants worldwide; this is ~275 of
  the ones whose loss would move a modeled stage. **An empty hazard radius
  means no site in this sample, never no site.**
- **Damage.** A hazard radius is a screening circle. It models no shaking
  intensity, no building standards, and no fab hardening.

### Named omissions

- **Zeiss SMT and Trumpf are absent.** Both are effectively single points of
  failure for EUV. Adding them means adding companies with stage stakes, which
  re-normalises every criticality score — a model change, not a map change, and
  one that should be made deliberately.
- **Sites outside the 24 modeled countries** are omitted, including real plants
  in Spain, Sweden, Hungary, Brazil and elsewhere.
