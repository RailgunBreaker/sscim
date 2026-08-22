/* ====================================================================
   siteMapLinks.js — the one list of everything this site publishes.

   Consumed by TWO renderers: the React footer (SiteMap.jsx) on the
   landing, guide, updates, dashboard and documentation-index pages, and
   the static HTML generator (scripts/build-doc-pages.mjs) that emits the
   individual document pages. Keeping the list here means a page added to
   one renderer cannot go missing from the other — which is the exact way
   a site map rots.

   Paths are relative to the site root. A renderer serving from a
   subdirectory (the generated document pages live under /docs/) passes
   its own `prefix`; external links are never prefixed.
   ==================================================================== */

export const SITE_SECTIONS = [
  {
    heading: 'Explore',
    links: [
      { href: 'index.html', id: 'home', label: 'Home', note: 'What SSCIM is, in one page' },
      { href: 'sscim-app.html', id: 'dashboard', label: 'Dashboard', note: 'The live map, flow graph and intelligence panel' },
      { href: 'intro.html', id: 'intro', label: 'Guide & methodology', note: 'How to read it without misreading it' },
      { href: 'updates.html', id: 'updates', label: 'Updates', note: 'What changed, and when' },
    ],
  },
  {
    heading: 'Understand the model',
    links: [
      { href: 'docs/PUBLIC_GUIDE.md.html', label: 'Public guide', note: 'Plain-language walkthrough' },
      { href: 'docs/METHODOLOGY.md.html', label: 'Methodology', note: 'Every formula and declared prior' },
      { href: 'docs/calculation.md.html', label: 'Worked calculations', note: 'The arithmetic, step by step' },
      { href: 'docs/MODEL_ROADMAP.md.html', label: 'Roadmap & release history', note: 'Delivered, planned, and the gates between' },
    ],
  },
  {
    heading: 'Data & limits',
    links: [
      { href: 'docs/DATA_SOURCES_AND_OUTPUTS.md.html', label: 'Data sources and outputs', note: 'What is sourced, what is judged' },
      { href: 'docs/ACADEMIC_GUIDE.md.html', label: 'Academic guide', note: 'How to cite it, and what not to claim' },
      { href: 'docs/NETWORK_ARCHITECTURE.md.html', label: 'Network architecture', note: 'The multi-layer graph' },
      { href: 'docs.html', id: 'docs', label: 'Full document library →', note: 'Every document, searchable' },
    ],
  },
  {
    heading: 'Build & operate',
    links: [
      { href: 'docs/SYSTEM_ARCHITECTURE.md.html', label: 'System architecture', note: 'How the pieces fit together' },
      { href: 'docs/DEVELOPER_GUIDE.md.html', label: 'Developer guide', note: 'Running and extending it' },
      { href: 'docs/DOCUMENTATION_REFERENCE.md.html', label: 'Documentation reference', note: 'Which document answers what' },
      { href: 'https://github.com/RailgunBreaker/sscim', label: 'Source repository ↗', note: 'Every figure is checkable', external: true },
    ],
  },
];

export const SITE_MAP_FOOTNOTE =
  'SSCIM · a GP News product · map data © OpenStreetMap contributors · '
  + 'supply-chain sensitivity and comparison analysis — not a calibrated, causal or probabilistic forecast, and not investment advice.';
