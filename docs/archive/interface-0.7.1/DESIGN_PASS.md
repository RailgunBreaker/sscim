# Interface design pass — before and after

> **WARNING - HISTORICAL DOCUMENT - INTERFACE PASS 0.7.1**
>
> This page records a completed interface pass against application `0.7.1`
> and dataset `2026-09-04`. It is kept for the record and must not be read as
> a description of the current interface, dataset or output digest. The digest
> quoted below is the one that was current at the time; the current model is
> `sscim-model-v7.1-exposure-robustness` and its live digest is recorded in
> [`MODEL_ARCHIVE.md`](../../MODEL_ARCHIVE.md).

Application `0.7.1`, model `sscim-model-v7.1-exposure-robustness`, dataset
`2026-09-04`.

**No model output changed.** The output digest is identical before and after
(`sha256:9b0feb59…`, `npm run digest`), and a test asserts it against the value
recorded in [`MODEL_ARCHIVE.md`](../../MODEL_ARCHIVE.md). That digest covers the
declared parameters, the structural weights, the headline index and envelope,
every stage's structural and network terms, all 109 company criticality scores,
every country score and the whole computed history.

## Screenshots

Captured by `npm run shots`, which drives the built artifact at four viewports
with animation disabled, so two runs of one build produce the same images.
The theme is pinned rather than inherited from the harness — these are the
dark theme, which is what the product falls back to when the operating
system states no preference; `npm run shots -- --scheme light` captures the
light record.

| | Before | After |
| --- | --- | --- |
| Landing | [`before/landing-1366x936.png`](screenshots/before/landing-1366x936.png) | [`after/landing-1366x936.png`](screenshots/after/landing-1366x936.png) |
| Dashboard | [`before/dashboard-1920x1080.png`](screenshots/before/dashboard-1920x1080.png) | [`after/dashboard-1920x1080.png`](screenshots/after/dashboard-1920x1080.png) |
| Events | [`before/events-1366x936.png`](screenshots/before/events-1366x936.png) | [`after/events-1366x936.png`](screenshots/after/events-1366x936.png) |
| Network | [`before/network-1366x936.png`](screenshots/before/network-1366x936.png) | [`after/network-1366x936.png`](screenshots/after/network-1366x936.png) |
| Facilities, initial | [`before/playground-start-1366x936.png`](screenshots/before/playground-start-1366x936.png) | [`after/playground-start-1366x936.png`](screenshots/after/playground-start-1366x936.png) |
| TSMC Fab 18, three hops | [`before/playground-tsmc-3hop-1920x1080.png`](screenshots/before/playground-tsmc-3hop-1920x1080.png) | [`after/playground-tsmc-3hop-1920x1080.png`](screenshots/after/playground-tsmc-3hop-1920x1080.png) |
| Mobile facility detail | [`before/mobile-facility-detail-375x812.png`](screenshots/before/mobile-facility-detail-375x812.png) | [`after/mobile-facility-detail-375x812.png`](screenshots/after/mobile-facility-detail-375x812.png) |

Every scene is also captured at 375×812, 768×1024, 1366×936 and 1920×1080.

## The eight changes that account for most of the difference

### 1. The map was broken, and had been for some time

Every tile carried **"API KEY REQUIRED · carto.com/basemaps/apikey"**
diagonally across it. CARTO began watermarking unkeyed basemap requests, and
because the watermarked tile still returns HTTP 200, Leaflet reported a
successful `tileload` and the OpenStreetMap fallback never fired. The map
rendered, and every tile carried the notice.

The parameter is `key`. `api_key` and `apikey` are both accepted by the CDN
and both ignored — they return the watermarked tile with a 200, which is how
this went unnoticed. Measured, not assumed: unkeyed and `?api_key=` return the
same 10,861-byte watermarked tile; `?key=` returns a clean 9,761-byte one.

### 2. The header advertised a version that did not exist

`v4 · OSM MAP · COMPANY SPREAD` sat beside the logo in 10px caps with 2px of
letter-spacing — two model versions and one application version out of date,
and unmistakably an internal build label. Beside it: the full product name,
three unlabelled counts (`24 · 109 · 16`), a host-only count, the dataset date
and a freshness string. Twelve competing elements at 10 to 11.5px.

The bar now carries identity, one status, search, and the three actions a
reader came to use. Counts, the model identifier and the application version
moved into an **About** disclosure — and the application version is now read
from `package.json` at build time, so it cannot drift again.

### 3. Two different kinds of choice were drawn identically

`VIEW [Geographic | Topology | Split | ⇄ Facility Playground]` and
`LENS [Structural | Operational | Hazard Δ | Selected share]` sat in one row,
in identical chips, with 9px shouted group labels. They read as one list of
eight peers. They are not peers: the first picks a **workspace**, the second
picks a **measurement** shown inside it.

Now: **Map · Network · Facilities** as the primary control, with the metric
lens visibly subordinate under the label "Shading". Split view is not removed —
it is a *Side by side* toggle on the two graph workspaces, which is what it
actually is.

`LAYER 1` / `LAYER 2` / `LAYER 3` are gone from the interface. They were the
internal architecture, and they remain in the developer documentation, where
they are accurate and useful. Panes are now named for what they show, with the
modelled-not-measured qualification as a separate line rather than welded to
the title.

### 4. The headline number was the smallest thing in its own row

The status bar read, left to right: a shouted 9px source badge, the same
source again at 8.5px, the dataset date at 9px, `WHAT CHANGED` in copper, a
sparkline, an event count, and finally — last, at 15px — the chain index the
whole product exists to report.

It now answers three questions in order: what the reading is (index first, at
26px), what moved it, and where the numbers came from (a quiet badge).

### 5. Essential content was set at 8.5–11px

A mechanical pass raised **366 font sizes** to a 12px floor across 38 files and
removed **91 letter-spacing declarations**. SVG graph annotations keep an 11px
floor, because a label there competes with the drawing for room and the drawing
wins. A test walks the source and fails on any violation, so the floor holds.

The `.mono` class named a monospace family and then set a sans-serif one. What
every call site actually wanted was figures that line up in a column — a font
*feature*, not a family. It now sets only that.

### 6. `faint` failed WCAG AA and was carrying essential text

`#5A6478` scored **2.89:1** on the panel background — below AA for normal text —
while carrying 9–10px metadata across the whole dashboard. It is now `#79849A`:
the same hue and saturation, lightened until it passes (5.02:1 on the page,
4.57:1 on a panel). Sixteen contrast assertions cover every text colour on
every surface, and one of them asserts the *old* value fails, so it cannot
return unnoticed.

### 7. Supplier names in the facility graph were clipped mid-word

Left-column labels are drawn `textAnchor="end"`, so they run left of their node
and out of a viewBox that started at `x=0`. "ASML — Veldhoven, Netherlands"
rendered as "dhoven, Netherlands". The names are the content, so the box now
includes them. Compare the two three-hop screenshots: every supplier and
customer name is legible in the after set.

### 8. The event detail panel showed a v6 formula next to a v7 number

The panel printed:

> ENGINE · s₀ = clamp(sev/10,0,1) × 2^(−age/12) = 0.152

That is the **v6** model — one universal 12-day half-life for every event. v7
replaced it with five per-incident persistence profiles, and the value at the
end of the line already came from the v7 engine, so the formula and its own
result disagreed on screen. For the Kumamoto earthquake the printed formula
evaluates to **0.078** against a printed result of **0.152**; for the memory-price
event, **0.000024** against **0.038**. A reader checking our arithmetic would have
found that it did not check out.

It survived the v7.1 documentation sweep because that sweep scans a list of UI
files which did not include this one. The panel now states the profile that
actually ran and the factors that actually produced the magnitude, with the
formula behind a *How this is calculated* disclosure. `Detail.jsx`,
`FacilityConnectionDetail.jsx` and `CentreDetail.jsx` are now on the scanned
list.

## Borders, cards and progressive disclosure

- **Country list**: sixteen bordered rectangles in a grid, each carrying a full
  border whether selected or not, became a ranked list separated by hairlines.
  A border now means *selected*.
- **Event history**: all 167 events rendered at once, each in its own bordered
  card, pushing the page past 9,000px. Now 25 rows with an explicit
  *Show 50 more*, separated by dividers rather than boxed.
- **Map legend**: three permanent lines of 8.5–9.5px shape, colour and ring
  definitions became a *What the plant symbols mean* disclosure. The colour
  scale stays visible, because that one is needed to read the map at all.
- **Timeline caveat**: three permanent lines above the graph became *How to
  read this timeline*. At 375px the chrome reached 780 of 812 pixels before any
  content; this was its largest single contributor.
- **Landing formulas**: the two governing equations sat high on the page, open,
  at 11.5px. They are one click away, at a readable size, after the page has
  said what the product is for.

Nothing was deleted. Every caveat and every formula is still present.

## Landing page

| | Before | After |
| --- | --- | --- |
| Headline | "Static maps show where the chip supply chain *is*. SSCIM shows how a shock would *move* through it." | "Trace disruption through the semiconductor supply chain." |
| Sub-headline claim | "Questions that today take an analyst a week of digging" | Removed — unsupportable, and never measured |
| Identity | Logo + all-caps product name + "SSCIM INTELLIGENCE" badge | Logo + one plain subtitle |
| Calls to action | Three (header CTA, Documentation, hero CTA) | Two: **Open SSCIM**, **View methodology** |
| Hero right half | Empty | A real dashboard screenshot, captured from the current build by the same run that writes the screenshot record |
| Limitations | Footer | Beside the first methodological claim on the page |
| Cards | Four independent bordered boxes, each lifting and glowing on hover | One boundary, hairline-separated, no motion |

Scope figures were already generated from the snapshot and remain so.

## What was deliberately not changed

- Every model formula, parameter, event value, propagation result and
  sensitivity figure. Verified by digest.
- Graph topology and layout algorithms. Only the viewBox gutter changed, and
  only so that existing labels are visible.
- The three-hop facility default, upstream/downstream/both traversal,
  flow-direction animation, reduced-motion behaviour, facility selection,
  connection detail, URL state and browser navigation. Each has a regression
  test.
- All four languages. The two renamed actions were translated in all of them;
  a test asserts every language has both and that neither carries a decorative
  glyph.
- The dark navy and copper identity. One palette value moved, for contrast.

## Verification

| Check | Result |
| --- | --- |
| Unit tests | **978 across 50 files** (baseline 888/47) |
| Browser smoke | **173/173** (baseline 172; one check added for the side-by-side modifier) |
| Horizontal overflow | none at 375, 768, 1366 or 1920 |
| Model output digest | unchanged |
| Typography floor | no essential text below 12px; no graph annotation below 11px |
| Contrast | every text colour passes AA on all three surfaces |

## Remaining interface issues, ranked by user impact

Ranked by how many readers hit them and how much they cost, not by how hard
they are to fix.

**1. Mobile still spends most of the first screen on chrome.** At 375×812 the
header, status bar, timeline, workspace bar and pane tabs consume roughly 750
of 812 pixels, so a visitor's first screen is almost entirely controls. Moving
the timeline caveat behind a disclosure recovered about 30px; the structural
fix is to collapse the timeline itself behind the status bar on small
viewports, which is a layout change rather than a styling one.

**2. The intelligence panel's left column is a single long scroll.** The event
detail can run to several thousand pixels — background, timeline, engine
readout, company contributions, hop trees, site footprint, first-order and
second-order notes. It is all worth having, and none of it is grouped. It wants
the same treatment the map legend got: named sections, most of them collapsed.

**3. Three graph legends still sit permanently below their graphs.** The
facility graph, the network graph and the flow graph each carry two or three
lines of explanatory text under them. The map's version is now a disclosure;
these are not, and they are the largest remaining block of small permanent
text.

**4. The Network workspace's toolbar row is still undifferentiated.** Undo,
Redo and Reset to baseline sit beside a "Copy analysis link" action and a
sentence of instructions, in one row, all styled alike. The Facilities
workspace got this treatment; the Network workspace did not.

**5. `Chip.jsx`, `HazardPanel.jsx` and the network panels do not use the
primitives.** They were left as they were because the brief scoped the
refactor to the landing page, header, navigation, primary controls and the
intelligence shell. They are consistent in size and case after the mechanical
pass, but they still build their own buttons.

**6. No visible distinction yet between measured, modelled and inferred
relationships.** The prose says clearly and repeatedly that plant-to-plant
links are modelled rather than measured, and the graph draws service links
dashed and co-inputs dotted. But there is no encoding that separates *modelled*
from *inferred reachability* at a glance — a reader has to read the legend.
Since every relationship in the shipped dataset is modelled, nothing is
currently misrepresented; this becomes a defect the moment a measured
relationship is added.

**7. The dark basemap is very low contrast.** CARTO's `dark_all` renders
country outlines close to the page background, so at low zoom the map reads as
markers floating on near-black. A lighter dark style would help; it is a
one-line change gated on how it interacts with the marker palette.

**8. Focus order across the three panes has not been audited end to end.** Each
control is individually reachable and every focusable element has a visible
ring, but nobody has tabbed from the header to the intelligence panel and
checked that the order matches the reading order at each breakpoint.
