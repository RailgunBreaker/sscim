# Public supplier network

Updated 2026-11-23. This guide describes the current **Network** workspace.
The public graph is separate from the propagation model defined in
[Model v7](MODEL_V7_SPEC.md); its connections feed no risk score or index.

## Scope and coverage

| Record | Current count |
| --- | ---: |
| System companies eligible for tracking and centring | 109 |
| Companies with profiles in the public registry | 407 |
| Documented supplier-to-customer relationships | 491 |
| Public source documents | 69 |
| System companies with a documented connection | 87 |
| System companies with a second documented level | 68 |
| System companies with a third documented level | 60 |
| System companies with no documented connection | 22 |

Registration is not evidence of a supplier relationship. All 109 system
companies are selectable, including those with evidence gaps. Other firms
provide chain context and have profiles, but cannot become additional tracked
companies or receive modeled scores. Multiple legal entities may map to one
system company; their public relationships remain separate.

These counts describe the curated dataset, not the semiconductor industry.
The level counts are generated, not asserted: `meta.documentedLevels` in
`publicSupplierTiers.json` is computed from the edges at authoring time, and
`supplierTiers.test.js` holds floors under each figure so coverage cannot
regress unnoticed. Levels are counted upstream and downstream together,
because a buyer's chain runs upstream and a materials supplier's runs
downstream.

### Why the third level stops where it does

Twenty-two system companies have no documented counterparty, and 49 reach a
second level but not a third. That shortfall is mostly structural, not a
backlog:

- **Brands and hyperscalers end the chain.** Apple, Volkswagen and Alibaba
  Cloud buy; nothing public records them selling components onward, so their
  graph runs in one direction only.
- **Materials, metrology and equipment firms start it.** Nothing publishes who
  supplies a metrology-tool maker. The lithography branch reaches a real third
  level only because ASML's 20-F discloses Carl Zeiss SMT as its sole supplier
  of optics under an exclusive arrangement — a disclosure with no parallel
  elsewhere in this dataset.
- **Disclosure thresholds hide the middle.** A filing names a customer when it
  passes roughly 10% of revenue. Photronics reports "Customer A, B and C";
  Teradyne, MKS, Advanced Energy and Kulicke & Soffa also disclose
  concentration without names.
- **Export controls close one region.** YMTC, CXMT, Hua Hong, NAURA, AMEC,
  Cambricon, Biren, UNISOC, Empyrean and NSIG have no documented counterparty
  here. Microchip's 10-K states the shape of the hole precisely: "Some of our
  products are manufactured at SMIC, and some of our suppliers buy products
  manufactured at YMTC." The first clause names a pair and became an edge; the
  second discloses a dependence on YMTC without naming which supplier, so it
  could not.

Two firms are absent for a plainer reason: Marvell's and STMicroelectronics'
newsrooms refuse automated fetches (HTTP 403 and 473), so releases that would
document their foundry relationships could not be read and were not cited from
memory. Marvell's own 10-K names no foundry, saying only "independent
foundries" and subcontractors "primarily located in Taiwan, Canada, Korea,
Singapore and China".

## Explore the chain

1. Open the dashboard and choose **Network**. On narrow screens, also select
   the **Map** pane tab if the Industry flow pane is currently open.
2. Find a company in the system directory. Its Level 1, 2 and 3 columns show
   distinct upstream firms at each shortest distance; Customers counts direct
   documented customers. The evidence-gap filter finds companies with no links.
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
| `supplier-tiers/data/{companies,edges,sources}.json` | Generated research outputs |
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
