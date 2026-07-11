# SSCIM Multilayer Network Playground — Architecture & Technology Decision

_Status: living document. Phase 1 (shared graph foundation) landed; later phases build on it._

This document records the architecture and the visualization-technology decision for turning SSCIM's world map from **bilateral country↔country** links into an **interactive multilayer functional-centre network** (spec §4–§8, §41.4/5/7/8).

Everything here runs **entirely in the browser over the existing static snapshot**. No API, backend, database, remote fetch, or data-layer file is added or modified. No supply-chain facts (facilities, shipment routes, trade volumes, BOM coefficients, probabilities, causal effects) are invented — every derived value comes from existing snapshot fields and the existing propagation priors.

---

## 1. The old bilateral map (what we're replacing as the primary view)

The world map aggregated company supplier/customer relationships up to the **headquarters countries** of the companies, producing `Country A ↔ Country B` arcs. That representation cannot express _which semiconductor function_ a country performs, _which production stage_ connects two countries, whether a link is upstream or downstream, or how several countries chain into one route. It also reads as if the chain were fundamentally bilateral, which it is not.

This HQ view is **kept**, but demoted to a secondary map mode labeled **"Modeled HQ supplier–customer relationships"** (§12). It is never deleted and never the primary structure.

## 2. The new functional-centre network (primary structure)

The primary analytical entity becomes a **functional supply centre = `country × stage`**, derived _only_ where the country already participates in that stage in the snapshot. Connections are mediated by the existing industry-stage edges:

```
Country A · Materials → Country B · Equipment → Country C · Fabrication
   → Country D · Packaging → Country E · Systems
```

labeled **modeled stage-mediated connectivity**, explicitly _not_ a verified shipment itinerary.

### Connection-weight formula (§6)

For every existing directed stage edge `a → b`, and every source country `i` with a share in `a` and destination country `j` with a share in `b`:

```
W(i,a → b,j) = share(i,a) × D[b][a] × share(j,b)
              = sourceShare × stageEdgePrior × targetShare
```

- `share(i,a)` — country `i`'s existing snapshot share of stage `a`.
- `D[b][a]` — the existing engine dependence prior for the stage edge (an **unvalidated propagation prior**, not a measured input-output coefficient).
- `rawDisplayWeight` is preserved; `normalizedDisplayWeight` is a display-only rescale (`raw / maxRaw`) and never overwrites the raw value.

This is a **modeled stage-mediated connection weight** — not bilateral trade volume, shipment value, measured dependence, probability, or causal effect.

On the real snapshot this yields **126 centres** and **1030 valid connections** across **7 tiers / 16 countries**; the strongest connections (JP photoresist → NL lithography, TW advanced-fab → US AI-logic, KR memory-fab → KR HBM) are structurally sensible.

## 3. Immutable graph architecture (§7)

```
baseGraph      = buildBaseGraph(snapshot, engine)        // deep-frozen, immutable
playgroundState= { selected, hovered, expanded, removedNodes, removedEdges,
                   scenarioSources, pinnedRoutes, comparison, history }
analysisGraph  = deriveGraph(baseGraph, playgroundState) // per-interaction, cheap
metrics        = calculateNetworkMetrics(analysisGraph, options) // on demand
```

The base graph is `Object.freeze`d (deep) so playground state derives views without ever mutating the baseline or the snapshot. Renderers display analytical state; they are never the source of truth. Implemented in `app/src/engine/network.js` (`buildFunctionalCentres`, `buildCentreConnections`, `buildBaseGraph`) with unit tests in `network.test.js`.

## 4. Visualization technology decision

**Decision: extend the existing stack — Leaflet (geographic mode) + inline SVG (topology mode) — driven by a new pure-JS multilayer graph + graph-algorithm engine. Do _not_ add deck.gl, MapLibre GL, Cytoscape.js, or Sigma.js.**

### Rationale
- **Scale doesn't require GPU.** The whole network is ~126 nodes / ~1030 edges, and display is aggressively filtered (top-N, neighborhood-only). SVG/Canvas handles this at interactive rates; deck.gl's GPU ArcLayer solves a problem (10⁴–10⁶ arcs) we don't have.
- **Bundle & static-Pages cost.** The app is a static GitHub Pages deploy; the current dashboard bundle is ~110 kB gzip. deck.gl + MapLibre (~200–300 kB+ gzip) or Cytoscape.js (~130 kB gzip) would multiply that for capability we can meet without them.
- **Algorithms are ours anyway.** Weighted degree, reachability, betweenness, pathfinding (DAG-DP / Dijkstra / widest-path / Yen K-paths), and node/edge-removal sensitivity are implemented deterministically in pure JS over the frozen graph — fully unit-testable and independent of any renderer. A rendering library would not compute these for us in the form the spec's guardrails require.
- **Accessibility & consistency.** SVG + real DOM lists give us focusable nodes/edges, aria-labels, and textual route descriptions for free; the existing FlowGraph is already SVG, so topology mode stays visually and behaviorally consistent. Canvas/WebGL renderers (Cytoscape, Sigma, deck.gl) would require a parallel accessibility layer.
- **Migration risk.** Reusing Leaflet (already integrated, with the tooltip/flyTo/overlay work from prior phases) avoids a basemap migration. Topology mode is additive SVG, not a rewrite.

### Alternatives considered
| Option | Role it would play | Why not now |
| --- | --- | --- |
| **MapLibre GL + deck.gl** | GPU geographic arcs/paths, animated propagation | Large bundle; GPU unnecessary at this scale; basemap migration risk |
| **Cytoscape.js** | Topology layouts, pathfinding, centrality, interactions | ~130 kB gzip; Canvas a11y gap; we need our own metric semantics anyway |
| **Sigma.js + Graphology** | High-perf WebGL topology + algorithms | Overkill at 126 nodes; a11y gap; extra dep |
| **D3** | Fully custom viz | High implementation/a11y burden; we already have SVG idioms |
| **Leaflet + SVG (chosen)** | Geographic + topology, shared React state | Meets requirements with ~0 new bundle and no migration |

_Revisit trigger:_ if a future dataset pushes displayed elements past ~5–10k, reconsider deck.gl for the geographic layer behind the same graph engine (the engine is renderer-agnostic by design, so that swap would not touch analysis code).

### GitHub Pages / performance / accessibility implications
- **Pages:** no new runtime; still a static build. ✓
- **Performance:** base graph + metrics memoized; hot paths (hover/playback) update dedicated overlay layers, never rebuilding the main renderer (established in prior phases). Expensive metrics computed on demand; stale calculations cancelled.
- **Accessibility:** SVG nodes/edges are focusable with aria-labels; every route has a textual description; no essential action is hover-only.

## 5. Renderer-agnostic engine

`network.js` produces plain data (frozen POJOs + adjacency indices). Geographic mode (Leaflet), topology mode (SVG), the industry graph, and the intelligence panel all read the **same** derived graph + selection state, so a future renderer swap is localized to a view component.

## 6. Phase status
- **Phase 1 — shared graph foundation:** ✅ immutable base graph, functional centres, derived connections + weight formula, technology decision (this doc). Centralized interaction state already exists (`interaction/`) and is extended per phase.
- **Phases 2–6** (playground modes, routes, scenario play over centres, network analysis, production refinement): built on this foundation, each kept green and deployable.
