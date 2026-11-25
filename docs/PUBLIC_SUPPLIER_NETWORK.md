# Public supplier network

Updated 2026-11-25. This guide describes the documented supplier network.
It is no longer a workspace of its own: it is the **Network** section of a
company profile, drawn around the company whose profile is open. The public
graph is separate from the propagation model defined in
[Model v7](MODEL_V7_SPEC.md); its connections feed no risk score or index.

## Scope and coverage

| Record | Current count |
| --- | ---: |
| System companies eligible for tracking and centring | 109 |
| Companies with profiles in the public registry | 452 |
| Documented relationships | 612 |
| Public source documents | 141 |
| System companies with a documented connection | 109 |
| System companies reaching level 2 in either direction | 92 |
| System companies reaching level 3 in either direction | 81 |
| System companies with no documented connection | 0 |

All 109 tracked companies now have at least one sourced connection. **This is
not complete three-level coverage**: 17 still lack level 2 in either direction,
and 28 lack level 3. The additional registry companies provide context and
profiles; they do not acquire tracking controls or modeled scores.

| Direction | Level 1 | Level 2 | Level 3 |
| --- | ---: | ---: | ---: |
| Upstream suppliers | 63 | 48 | 36 |
| Downstream customers | 89 | 64 | 61 |
| At least one direction | 109 | 92 | 81 |

Each count is the number of tracked companies with at least one firm at that
exact shortest distance. A company can appear in both directional rows; those
rows must not be added. Walks never reverse direction to find a longer chain.
Multiple legal entities remain separate; the directory selects the entity with
the most documented direct connections for each tracked company.

The authoring pipeline and browser share `supplier-tiers/coverage.mjs`.
`data/coverage.json` contains all 109 companies, separate directional counts,
missing levels, and an example path at each reachable depth. Tests verify every
path against cited edges and compare the ledger with the browser calculation.

### Evidence and remaining research

Missing depths are a research backlog, not proof that longer chains cannot
exist. This pass corrected earlier blanket claims about anonymous disclosures:
Marvell's August 2026 filing names TSMC, and Advanced Energy's 2024 revenue note
names Applied Materials and Lam. Chinese company filings and joint releases also
provide named customers and subcontractors.

Sources include supplier awards, recorded sales, equipment delivery, historical
IP licenses, announced adoption and design-tool certification. Each connection
retains its source date and qualifications. A certified design tool is not a
reported purchase, an announced platform is not a verified delivery, and a
historical customer award does not establish present supply. Company-level paths
can combine different products and years: they do not establish a simultaneous
physical flow or a product bill of materials.

The November 25 pass adds 54 unique relationships and 26 documents. Examples
include Marvell manufacturing, Ibiden customers, Inari testing, Empyrean software,
NSIG wafers, Xingfu chemicals, Torlens components and subcontractors, Arteris IP,
and SK Materials' historical subsidiary supply. All contextual firms have the
standard public-company profile; unresearched ownership remains unknown.

Remaining third-level gaps (in both directions):

AMEC, AT&S, Biren, Cambricon, CEA-Leti, CXMT, Empyrean, HiSilicon (Huawei), Hitachi High-Tech, Hua Hong, IBM Research, Inari Amertron, JCET, Kioxia, KYEC, Luxshare, Microchip, Nanya, NAURA, Nexchip, Nikon, Nova, onsemi, Rapidus, Samsung Electro-Mech, Shinko Electric, SMIC, Sony Semiconductor, Sumitomo Chemical, UNISOC, UTAC, Winbond, YMTC.

## Explore the chain

1. Open the dashboard and choose **Network**. On narrow screens, also select
   the **Map** pane tab if the Industry flow pane is currently open.
2. Find a company in the system directory. Use **Coverage direction** to compare upstream suppliers and downstream
   customers. Level columns show distinct firms at each shortest distance.
   **Missing paths** filters companies without level 2 or level 3 in that
   direction. **Evidence gaps only** finds companies with no connections;
   currently that filter returns none. Customers always counts direct customers.
3. Choose upstream, downstream or both, then Level 1, + Level 2, + Level 3 or
   All. The default is three steps. Large All traversals require a second click.
4. Open a level list and select a firm to read its profile and one shortest
   citation path. Every path connection links to its source. Paths respect the
   current graph filters. A zero count means no recorded path under those settings.
5. Use **Centre company** to change the tracked starting company. A contextual
   supplier can be inspected without changing that centre.

Levels are relative to the selected company, which is Level 0. A supplier may
be Level 2 from NVIDIA but Level 1 from TSMC. The engine retains its original
focal-set tier index for dataset analysis; the visible graph uses traversal
distance instead. In Both mode, upstream and downstream walks have independent
visited sets, so cycles cannot prevent exploration in the other direction.

## Graph legend and interaction

- Arrows point **supplier → customer**, including service and IP supply.
  They describe a documented relationship, not necessarily physical goods.
- Dot size reflects the number of drawn documented connections, not volume or
  importance. Colours represent level or chain position. Rings identify firms
  with further connections beyond the selected depth.
- The legend has reserved space beside the graph and stacks below it on narrow
  screens. Selected-company summaries do not replace the legend.
- Scroll or use +/− to zoom; drag the background to pan. Fit resets the viewport
  transform. Labels are withheld when they would overlap; zoom reveals more.
- Drag a node to pin it. Connected nodes respond **during** the drag and settle
  after release. The held node and camera stay steady. Previously pinned nodes
  remain fixed; Release frees them. Reduced-motion preferences suppress the
  continuous animation.
- Click a firm to inspect it; double-click or Enter centres a system company.
  Outside firms open a contextual profile instead. Space selects a neighbourhood.
  Keyboard +/− zoom, arrow keys pan, and 0 resets the viewport transform.

## Company profiles

Every registry company uses the standard profile structure: identity,
introduction, control, record, modeled footprint where applicable, documented
counterparties, source dates and limitations. Profiles are accessible from graph
nodes, level lists, relationship-table names and other profiles.

System-company profiles retain the established control records, modeled roles
and Track control. Contextual profiles explicitly mark ownership/control as
unresearched and have no Track control, modeled share or criticality rank.
The profile template is complete; unknown facts are not filled with guesses.

Modeled and documented chains remain separate. Historical supplier awards are
labelled with their years. Proposed contracts and announced platform adoption
retain their qualification and are not presented as verified shipments today.

Recent additions include NVIDIA/AMD/MediaTek manufacturing counterparties,
announced Blackwell adopters, gas suppliers, GlobalWafers, Siltronic, SK Siltron,
Entegris and Wacker. An example three-step path is
**Wacker → Siltronic → Micron → NVIDIA**; each edge has its own disclosure date.
Chaining disclosures from different years does not establish simultaneous trade.

## Authoring and implementation

| File | Responsibility |
| --- | --- |
| `supplier-tiers/author-dataset.mjs` | Original company, relationship and source tables; writes generated datasets |
| `supplier-tiers/expand-system.mjs` | Adds the system-company registry and researched extensions without importing modeled links |
| `supplier-tiers/expand-filings.mjs` | Relationships named in annual securities filings and company releases; resolves firms by normalised name so a second spelling cannot create a duplicate node |
| `supplier-tiers/data/company-crosswalk.json` | Reviewed mapping from public legal entities to system IDs |
| `supplier-tiers/expand-coverage.mjs` | November 25 primary-source expansion and explicit historical/announced relationship qualifications |
| `supplier-tiers/expand-renesas.mjs` | One company in both directions: the Renesas pass, ten of whose fourteen edges are downstream |
| `supplier-tiers/coverage.mjs` | Shared directional coverage and example-path calculation |
| `supplier-tiers/data/{companies,edges,sources,coverage}.json` | Generated research outputs and all-company coverage ledger |
| `app/src/data/publicSupplierTiers.json` | Generated application dataset |
| `company-control/author-control.mjs` | Established system-company control records |
| `app/src/engine/supplierTiers.js` | Indexing, directional traversal, coverage and shortest citation paths |
| `app/src/engine/supplierForce.js` | Deterministic force simulation, pinning and cooling |
| `app/src/engine/companyProfile.js` | Standard system and public-company profiles; tracking eligibility |
| `app/src/components/SupplierTierExplorer.jsx` | Directory, controls, legend, profiles, level lists and complete relationship table |
| `app/src/components/SupplierTierGraph.jsx` | SVG arrows, zoom/pan, node dragging and animation loop |

The drag loop uses one requestAnimationFrame chain, reheats while a node is held
and cools after release. It cancels the initial settling loop on drag, preserves
the viewBox during interaction, and cancels stale animation work when the layout
changes or the component unmounts.

Regenerate supplier data from the repository root after updating the authoring
tables or crosswalk (ensure `app/src/data/vault-snapshot.json` exists first):

```powershell
node supplier-tiers/author-dataset.mjs
```

From `app/`, regenerate the docs library, run checks and build:

```powershell
npm run docs
npm run docs:verify
npm run audit:data
npm test
npm run build
```

With the dev server running, run the drag regression from `app/`:

```powershell
node scripts/supplier-drag-smoke.mjs
```

It uses installed Chrome, defaulting to `http://127.0.0.1:5173` (override with
`PREVIEW_URL`). It checks movement before pointer release, the held node's fixed
position, camera stability, eventual settling and browser errors. Engine tests
also cover all-company profile coverage, the 109-company tracking boundary,
three-step citation paths, cycles and depth limits.

## Profile and customer navigation

Every company profile offers Suppliers, Customers and Full network actions.
They set the direction on the network drawn inside that same profile and move
the page to it, including when the profile belongs to an untracked contextual
firm. Embedded in a profile the graph opens at **one** documented step — the
firms that company is itself named with — and the depth control walks further;
on its own page it still opens at three. One step rather than three because at
three steps a profile stops being about its company: Renesas has 37 named
counterparties and 163 firms within three documented steps, and almost every
firm at its second upstream step arrives through one of those 37 — TSMC, whose
own published supplier list is 72 firms long. On small screens the Intel tab
opens automatically. The tracked-company directory
remains accessible above an open graph; each row also opens the company profile.
Choosing a company in the directory respects its upstream/downstream filter.

The downstream expansion adds 19 distinct connections from three primary
disclosures: AMD's Q4 2024 presentation, NVIDIA's January 2025 DRIVE announcement,
and Infineon's May 2025 Rivian R2 supply announcement. Named adopters include
cloud providers, server manufacturers, enterprise users and vehicle makers.
Enterprise adoption does not establish a direct chip purchase; future vehicle
programs remain labeled as announcements. Eight new contextual companies have
profiles without expanding the 109-company tracked set. Toyota Motor is kept
separate from the model's Toyota / Denso grouping.

This expansion increases downstream breadth; it does not close the remaining
second- and third-level coverage gaps reported above.

## Directional zero audit: 2026-11-25

A targeted primary-source pass added 14 relationships, eight contextual firms
and nine documents. Zero-supplier counts among the 109 tracked companies fell
from 50 to 46; zero-customer counts fell from 27 to 20.

- Newly documented upstream counterparties: Ansys, ASM International, SUMCO,
  Synopsys.
- Newly documented downstream counterparties: Alibaba Cloud, Amazon, Google,
  Marvell, MediaTek, Microsoft, Tower Semiconductor.

Evidence includes buyer specifications, named supplier awards, a filed supply
agreement, cloud deployment architecture and recognition of actual wafer
shipments. AWS-to-Marvell and Azure-to-Synopsys links describe cloud services;
they are not reverse flows of physical chips. Anthropic capacity expansion
remains a plan alongside evidence of existing cloud use. Awards describe their
historical disclosure period. Missing evidence remains zero rather than being
filled from sector similarity, unnamed customers or inferred purchasing chains.

Third-level coverage increased from 76 to 81 tracked companies in at least one
direction. This still leaves 28 without a documented third-level path.

## Single-company pass: Renesas, 2026-11-25

A pass covering **one company in both directions**, which is a different
exercise from the breadth passes above and was done because breadth had left a
specific distortion behind.

Renesas had 74 documented firms upstream and **one** downstream. That is not a
finding about Renesas. The earlier passes grew out of buyer-published supplier
lists — Apple's, Intel's, TSMC's award announcements — so every firm they
reached arrived as somebody's *supplier*: 70 of those 74 were inherited from
TSMC's own list, two steps away, and the side where an MCU and SoC maker
actually trades was empty.

Four passes, each finding a kind of counterparty the previous one could not
see, added 22 firms, 35 relationships and 34 documents, every document fetched
and read on 2026-11-25. Renesas now carries **10 documented suppliers and 27
documented customers**.

- Upstream: Wolfspeed (150mm SiC bare and epitaxial wafers, ten-year
  agreement), GlobalFoundries (FD-SOI, BCD and feature-rich CMOS capacity,
  announced February 2026 with tape-outs stated for mid-2026), four IP vendors
  — Arm (Cortex-A720AE and Cortex-R52 in the R-Car X5H), Andes and SiFive
  (RISC-V CPU cores) and Imagination (the IMG BXS GPU in R-Car Gen 5) — two EDA
  vendors, Synopsys and Cadence, and two newer documents on the existing TSMC
  pair naming the N3A automotive process.
- Downstream: Honda, VinFast, Audi, Great Wall Motor, Nevs, Inventec, Nidec,
  Nullmax and Tata Elxsi, alongside the existing Apple supplier-list entry; the
  tier ones — Toyota/Denso, Robert Bosch, Continental and ZF — plus Nissan;
  the memory-module business, Samsung and Micron; the distribution channel,
  Avnet, Future Electronics and WT Microelectronics; buyers who awarded Renesas
  supplier prizes, Panasonic, BYD and HARMAN; and the small, unlisted end —
  emtrion, BFG Engineering, Rochester Electronics and Flip Electronics.

Each pass is a different kind of document, and that is the lesson of doing one
company properly. A **partnership release** is what a chipmaker publishes when
it wants a name beside its own, and searching for those found nine firms. A
**design win** is announced as a product, which is where the tier ones and the
carmakers were. A **part launch** carries its customer in a quote near the
bottom, which is where the memory-module business was — Samsung and Micron, a
line of work with nothing to do with cars. And the **distribution channel**
appears in none of those, because a distributor is not a design win; it took a
document about the channel itself.

The three distributor edges are the weakest customers in this dataset and say
so on themselves: a distributor buys to resell, so the edge records where the
parts go next and nothing about who finally uses them. The fourth distributor
in that 2020 announcement, WPI Group, is deliberately absent — the only thing
the document says about it is that the relationship ended.

The tier ones came from a second pass over the same company, because the first
pass had a bias of its own. Partnership releases are what a chipmaker publishes
when it wants a name beside its own; a design win is announced as a product.
Searching for partnerships found nine firms and missed the four companies that
actually put Renesas parts into boxes and ship them to carmakers. The RAV4
release is the strongest downstream document on this company in the whole
dataset: a named part (R-Car V4H), in a named unit (the Toyota Safety Sense
control unit), in a named vehicle, with Denso named as the unit's supplier.

Two of those tier ones, Toyota/Denso and Bosch, are also the two customers the
**modeled** chain already carried for Renesas, at 20% and 8% supplier-revenue
share. Until this pass the modeled chain and the documented chain named none of
the same firms on this company. The two datasets share no inputs and are built
to be independent, so the overlap is agreement found rather than agreement
arranged — and it is the only point on this company where either can be
checked against the other.

Three things were deliberately left out. Cadence published a March 2023 release
on Renesas using Verisium, and Mouser publishes releases calling itself an
authorized Renesas distributor; neither page could be read (403 and repeated
timeouts), and the rule is a document that was read, not one believed to exist.
The third is a stronger case: the CG Power / Renesas / Stars Microelectronics
OSAT joint venture in India, announced 2024-03-01, **was** read, and it
describes a joint venture and an equity split of 92.3 / 6.8 / 0.9 while stating
nothing about the facility assembling or testing anything for Renesas. A
shareholding is not a supply relationship. Renesas still has no documented
packaging or test supplier, and that hole is left visible.

After two passes the demand side was exactly one step deep: not one documented
customer had a documented customer of its own. The memory-module work changed
that, and only there — Renesas now reaches Qualcomm, NVIDIA and AMD at two
steps, through Samsung and Micron, because DRAM makers' customers are
themselves disclosed. The automotive side is still one step deep: tier ones do
not publish their carmakers, and the Continental release is explicit about it
— its Body HPC was "already going into production at a global vehicle
manufacturer" who is never named.

### 中小企業 and 非上場企業: the end this lens sees worst

Everything the first three passes found shares a property nobody chose: it is
**large and listed**. That is not a fact about supply chains, it is a fact
about disclosure. Documents exist because a firm is obliged to publish, or big
enough that publishing is worth doing, so a graph assembled out of documents is
a graph of large listed firms with a hole where everyone else works.

The fourth pass went after that hole deliberately. It is hard in three distinct
ways, and each one is worth recording because each is a different kind of
blindness:

1. **They do not file.** A GmbH or an S.r.l. publishes no annual report naming
   its customers, so a small firm enters this dataset only if a large one names
   it. Every small firm here arrived through somebody else's award: emtrion
   GmbH (Renesas European Alliance Partner of the Year 2017) and BFG
   Engineering, a development house in Vicenza with more than sixty customised
   designs for Renesas customers (2018). Rochester Electronics and Flip
   Electronics appear only on a Renesas support page as authorized resellers of
   end-of-life products — undated, so those two edges carry no year at all.
2. **Their own sites cannot be read.** Checked on 2026-11-25: emtrion.com
   failed with a TLS internal error, bfgengineering.com did not resolve,
   rocelec.com/about-us returned 404, and flipelectronics.com returned HTTP 200
   with an empty body. Four firms, four different failures. A listed company's
   investor-relations page is a maintained asset; a small firm's "about us" is
   not.
3. **The obvious source disqualifies itself.** Renesas runs a partner directory
   full of exactly these firms, and it states that a listing there "does not
   constitute any legal agency, joint venture, endorsement, or other formal
   relationship." A company saying its own page is not evidence of a
   relationship is a company telling you not to build edges from it, so none
   are. (Its names are also rendered by JavaScript and are not in the HTML.)

Company records now carry an optional `listing` field recording what the
**documents** establish, never a claim about the firm:

| Value | Meaning |
| --- | --- |
| `ticker-printed` | a cited document prints its exchange ticker |
| `legal-form-private` | a cited document prints a form that cannot be exchange-listed, such as GmbH |
| absent | no document here says either way |

Of Renesas' 37 named counterparties, 5 are `ticker-printed`, 2 are
`legal-form-private` and **30 say nothing either way**. The profile states that
count in the network section, because it measures the lens rather than the
chain.

Two cautions are built into the field. It is **not a size proxy**: Robert Bosch
GmbH is one of the largest suppliers in the industry and has no listing to
print, which is why its basis line says so explicitly. And 中小企業 status is
**never asserted**: no document read here gives a headcount or a capital
figure, so the dataset cannot certify anybody as a small or medium enterprise.
What it can show is which firms exist here only because a larger counterparty
named them.

### What is still missing

What four passes did not find is as informative as what they did. There is no
packaging or test supplier, and no wafer or equipment supplier for Renesas' own
fabs. The industrial customer base is nearly invisible: searches for Omron,
Yaskawa, Mitsubishi Electric and Fanuc returned product pages and no document
naming a pair, and Panasonic is here only through a 2016 award. Roughly half of
this company's units are said to go to industrial, IoT and infrastructure
markets, and this dataset can see almost none of it.

Each downstream edge carries its own qualification on the edge itself, because
they are not equally strong and the reader has to see which is which without
opening the source. VinFast is the strongest: Renesas states its SoCs, R-Car
and analog products are *already implemented* in two named vehicle models.
Honda is an agreement to develop a chiplet SoC for vehicles late in the 2020s,
not a shipment. Inventec and Nidec are proofs of concept. Nullmax and Tata
Elxsi are design-ins by software and services houses that are not stated to buy
silicon. Audi (2015), Nevs (2015) and Great Wall (2017) name no part and no
volume, and the oldest is eleven years old at the date checked.

Where a joint release exists on both companies' sites, the copy hosted by
whichever party is the **buyer** is the one cited, so the evidence class states
who disclosed what about whom. The Honda announcement is therefore two sources:
the Honda-hosted copy evidences Renesas→Honda, and the Renesas-hosted copy
evidences TSMC→Renesas, where Renesas is the buyer naming its foundry.

Directional coverage across the 109 tracked companies is unchanged by this
pass: Renesas already reached all three levels upstream. What changed is that
its profile no longer presents one customer as the whole of its demand side.

The drawn result is recorded at
[`after/company-renesas-1366x936.png`](screenshots/after/company-renesas-1366x936.png):
six firms to the left of Renesas, ten to the right.

## Profile audit: 2026-11-25

All 447 public-network company records resolve to a profile with a name,
introduction and relationship source references. The 110 mapped registry nodes
represent exactly 109 distinct tracked system companies; the other 337 profiles
provide contextual supplier/customer information. Every tracked company has a
control record. Contextual profiles have no modeled exposure, control record or
tracking eligibility: profile availability does not mean ownership research is
complete. The all-company tests in `companyProfile.test.js` check these boundaries.
The separate vault evidence-note audit covers only 4 of 109 companies; that
measures dedicated evidence notes, not availability of network relationship
citations. The profile count must not be presented as fully researched dossiers.

Current chain-depth coverage: 92 tracked companies reach a second
level and 81 reach a third level in at least one direction. Profiles for all
companies do not imply that every company has a documented three-level chain.
