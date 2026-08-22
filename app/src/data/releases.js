/* ====================================================================
   releases.js — what changed, and when.

   The single source for the public updates page (updates.html) and the
   release history in docs/MODEL_ROADMAP.md. Dates are the real dates the
   work landed in the repository, not marketing dates: every `date` here
   corresponds to commits you can go and read.

   TWO RULES FOR ENTRIES, because a changelog is the easiest place in a
   project to start overclaiming:

     1. Say what was BUILT, not what it means. "244 named sites with
        coordinates and stage mapping" — not "comprehensive global
        coverage". The second sentence is the one a reader would later
        find to be false.

     2. Carry the limitation with the feature. Every entry that adds a
        capability also states what that capability still does not know.
        A reader who only ever reads this page should come away with an
        accurate sense of what the tool can and cannot do.

   `kind` drives the badge colour on the page:
     added / changed / removed / data / fixed
   ==================================================================== */

export const RELEASES = [
  {
    id: 'live-first',
    date: '2026-08-22',
    version: 'v0.6',
    title: 'Live-first: history review, watchlists, and plant icons',
    lede: 'The dashboard stopped offering ways to invent events and started offering the two things the record can actually support: what the chain looked like in the past, and what you personally need to watch.',
    changes: [
      { kind: 'removed', text: 'Scenario authoring is gone — the four preset crises, the draft composer, the scenario builder and the propagation playback controls. A tool whose claim is that its events are dated, sourced and human-reviewed should not spend its main interface on made-up ones.' },
      { kind: 'added', text: 'History review: drag a slider to any past date and the whole model re-derives — map, stage fields, country readings, index — through the engine\'s own back-dating rule. A reviewed date is a real past state of the record, not a relabelled version of today.' },
      { kind: 'added', text: 'An event timeline under the slider. Each marker is sized by that event\'s MARGINAL contribution to the index on its own day — the index with it, minus the same day without it — because propagation saturates and standalone magnitudes do not add up.' },
      { kind: 'added', text: 'Watchlist (追蹤清單): follow specific companies, products (chain stages), plants, or a route through the chain, so your daily view is your own supply base rather than the whole world. Stored in your browser only, and deliberately never placed in a shared link.' },
      { kind: 'changed', text: 'Plant markers now carry function in their SHAPE (fab, assembly, materials, equipment, R&D, datacentre) and live effect in their COLOUR — and only when something is actually happening. At rest the map reads as geography instead of a wall of red bubbles, and the layer stays legible without colour vision.' },
      { kind: 'changed', text: 'The one hypothesis left is the hazard tool: place an epicentre on the map, set a radius and a severity, and it runs one bounded shock through the identical propagation engine every recorded event uses. It is shown in amber, labelled, and clears in one click.' },
    ],
    limits: 'History review is bounded by the event record, which is a curated sample and thins out badly before 2020 — a quiet year on the slider may be a quiet year or a thinly covered one, and the history panel reports which. The hazard tool is a screening circle: it models no shaking intensity, no building standards and no fab hardening.',
  },
  {
    id: 'site-layer',
    date: '2026-08-22',
    version: 'v0.5',
    title: 'The site layer: 244 plants and a network between them',
    lede: 'A country marker cannot answer the question an earthquake asks, because a hazard happens at a point. This release put the plants on the map.',
    changes: [
      { kind: 'added', text: '244 named production and R&D sites covering all 109 modeled companies across 16 countries — operator, coordinates, what the plant makes, the stages it feeds, and whether it is operating, ramping or still under construction.' },
      { kind: 'added', text: 'A hazard footprint tool: drop an epicentre, set a radius, and the readout names the plants inside it and the share of each stage\'s modeled sites they carry. A 150 km circle over Pyeongtaek/Icheon holds 94% of the modeled HBM sites; that contrast is the point.' },
      { kind: 'added', text: 'A standardized profile for every site, generated from the same fields by the same code rather than written 244 times — so two profiles differ only where the sites differ, not where the authors did.' },
      { kind: 'added', text: 'A derived site-to-site network, composed from the company customer table and the stage flow graph. Toggle it on the map, or pin a plant to see only its own connections.' },
      { kind: 'added', text: 'Selecting an event now lists the modeled plants in its footprint — which works for an export rule as well as for a quake, since neither carries coordinates in the event table.' },
    ],
    limits: 'The site layer knows where plants are and what they make. It does not know how much they make: significance is a 1–5 analyst ordinal, not wafer starts, so every share it reports is a share of the modeled sample and never of world capacity. Coordinates are approximate to a few kilometres. The network is a modeled link set, not a shipment route — no dataset here records which plant ships to which plant.',
  },
  {
    id: 'reviewed-vault',
    date: '2026-07-30',
    version: 'v0.4',
    title: 'The reviewed vault and the publication gate',
    lede: 'The snapshot became a publication workflow: evidence arrives automatically, a human decides, and nothing reaches the public site until the audit and the tests pass.',
    changes: [
      { kind: 'added', text: 'A SQLite evidence vault and an API for events, companies, relationships, policies, ownership, computed history and briefings.' },
      { kind: 'added', text: 'A scheduled candidate pipeline that fetches source material, drafts structured proposals, checks for duplicates, and sends candidates to human review. A candidate is never an event until someone approves it.' },
      { kind: 'added', text: 'An audit-and-test publication gate: approved changes regenerate the snapshot and are committed only when validation succeeds. If the machine that owns the vault goes down, the site keeps serving the last good commit.' },
      { kind: 'added', text: 'An operations dashboard for reviewing, approving, rejecting and publishing candidates.' },
      { kind: 'added', text: 'Ten years of computed index history, seven chart windows, and a briefing archive backed by the vault rather than hard-coded page copy.' },
      { kind: 'added', text: 'A documentation reader with a document tree, in-document heading navigation, automatic Markdown discovery and rendered equations.' },
    ],
    limits: 'Automation ends at discovery. Severity, direction and whether an event counts toward the score are human decisions recorded by hand, and the AI step only ever drafts a proposal.',
  },
  {
    id: 'topology',
    date: '2026-07-29',
    version: 'v0.3',
    title: 'Topology workspace and multi-layer network analysis',
    lede: 'The chain became something you can interrogate rather than only look at.',
    changes: [
      { kind: 'added', text: 'A functional-centre network view — country × stage nodes with stage-mediated connections — alongside the world map, or side by side with it.' },
      { kind: 'added', text: 'Route explanation between two points in the chain, connection inspection, side-by-side comparison of pinned centres, and network-analysis metrics.' },
      { kind: 'added', text: 'A reversible playground: temporarily remove nodes or edges to see what the rest of the chain does without them, with undo, redo and reset over an immutable base graph.' },
      { kind: 'changed', text: 'Lens control unified across every panel, so the map and the flow graph always answer the same question at the same time.' },
    ],
    limits: 'Every edge weight is a declared prior derived from graph structure and one analyst judgement, not a measured input–output coefficient. There is no bill of materials behind any of it.',
  },
  {
    id: 'foundation',
    date: '2026-07-08',
    version: 'v0.1',
    title: 'Foundation: the model and the public interface',
    lede: 'The first release established the research model and made the method reproducible.',
    changes: [
      { kind: 'added', text: 'A versioned supply-chain snapshot: 24 production stages and 34 directed dependencies, validated acyclic.' },
      { kind: 'added', text: 'A deterministic propagation engine shared by historical events and company-disruption analysis — the same code path for every question the tool answers.' },
      { kind: 'added', text: 'Structural vulnerability and operational impact kept as two separate, separately-labelled numbers, because blending them hides which one moved.' },
      { kind: 'added', text: 'Declared and inspectable priors, including the 12-day half-life, plus methodology, worked calculations and data audits.' },
      { kind: 'added', text: 'A static publication that stays readable when the author\'s machine and the live API are offline.' },
    ],
    limits: 'At this stage updating the evidence meant editing data by hand, and the interface did not clearly separate reviewed source material from generated proposals. Both are what the next two releases addressed.',
  },
];

export const KIND_LABEL = Object.freeze({
  added: 'ADDED',
  changed: 'CHANGED',
  removed: 'REMOVED',
  data: 'DATA',
  fixed: 'FIXED',
});

/* Colour per kind. `removed` deliberately reads as neutral rather than as an
   error: taking a feature out because it encouraged a misreading is good
   news, and colouring it red would say the opposite. */
export const KIND_COLOR = Object.freeze({
  added: '#4FA97F',
  changed: '#C98A3F',
  removed: '#8C96A8',
  data: '#DFA83D',
  fixed: '#8A6230',
});

export const LATEST_RELEASE = RELEASES[0];
