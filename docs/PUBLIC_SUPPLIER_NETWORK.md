# Public supplier network

Updated 2026-11-25. This guide describes the current **Network** workspace.
The public graph is separate from the propagation model defined in
[Model v7](MODEL_V7_SPEC.md); its connections feed no risk score or index.

## Scope and coverage

| Record | Current count |
| --- | ---: |
| System companies eligible for tracking and centring | 109 |
| Companies with profiles in the public registry | 414 |
| Documented relationships | 545 |
| Public source documents | 95 |
| System companies with a documented connection | 109 |
| System companies reaching level 2 in either direction | 92 |
| System companies reaching level 3 in either direction | 76 |
| System companies with no documented connection | 0 |

All 109 tracked companies now have at least one sourced connection. **This is
not complete three-level coverage**: 17 still lack level 2 in either direction,
and 33 lack level 3. The additional registry companies provide context and
profiles; they do not acquire tracking controls or modeled scores.

| Direction | Level 1 | Level 2 | Level 3 |
| --- | ---: | ---: | ---: |
| Upstream suppliers | 59 | 46 | 34 |
| Downstream customers | 82 | 59 | 49 |
| At least one direction | 109 | 92 | 76 |

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
