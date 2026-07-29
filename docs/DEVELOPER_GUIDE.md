# SSCIM developer guide

Local setup, code layout, the data flow, and the rules that keep the published site honest.

## Repository layout

```
app/                       Vite/React static frontend and the model implementation
  index.html                 landing page          → NewsTicker, positioning
  intro.html                 introduction & guide
  sscim-app.html             the dashboard
  docs.html                  generated Markdown documentation reader
  admin.html                 authenticated operations console (not publicly linked)
  scripts/
    build-vault-snapshot.mjs   SQLite vault → src/data/vault-snapshot.json
    audit-snapshot.mjs         read-only data diagnostics; the publication gate
    build-doc-library.mjs      scans repo .md → bundled fallback + runtime manifest
  src/
    engine/                  the deterministic model (see below)
    components/              dashboard UI
    data/VaultContext.jsx    fetches the API, falls back to the snapshot
    landing/ intro/ docs/ admin/   the other four entry points
server/                    Express API, SQLite vault, ingestion, review, publication
  data/sscim.db              the vault — committed, and the only source of truth
  src/
    routes/public.js         read routes consumed by the frontend
    routes/admin.js          token-protected write + review routes
    review-queue.js          approve / reject / batched publish
    ingest/                  usgs, federal-register, webz-news, dedupe
    ai/                      candidate drafting (proposals only, never authoritative)
    quotes.js                market-quote refresh, shared by script and API
  scripts/
    pipeline.mjs             the whole fetch → draft → verify → publish run
    review.mjs               review queue CLI
    fetch-quotes.mjs         batch quote refresh
docs/                      Markdown rendered by docs.html
```

### The engine

`app/src/engine/` is the model, and it is deliberately free of UI and I/O:

| File | Responsibility |
| --- | --- |
| `priors.js` | every numerical coefficient, in one frozen object |
| `math.js` | decay, clamping, noisy-OR combination, HHI, topological sort |
| `graph.js` | adjacency, the `D`/`U` dependence matrices, propagation, pathfinding |
| `event-assumptions.js` | the hand-curated per-event classification table |
| `index.js` | assembles everything into the engine the UI consumes |
| `diagnostics.js` | graph validation — runs before anything else |

## Local development

```powershell
cd app
npm install
npm run dev
```

`npm run dev` first rebuilds the static vault snapshot and the documentation library, so a fresh clone works without the backend running. Other commands:

```powershell
npm run build        # production build into dist-app/
npm test             # vitest suite
npm run snapshot     # re-export vault-snapshot.json from the vault
npm run audit:data   # read-only data diagnostics (the publication gate)
npm run docs         # rebuild the documentation library
```

For review or API work, start the backend separately:

```powershell
cd ..
.\start-api.ps1      # API on :8787
```

The public site remains static. The local API is the only writer, and is needed only for administration, review, and live quotes.

## How data flows

```
feeds ──► candidate queue ──► AI draft (proposal only) ──► human review
                                                              │
                                    approve ──────────────────┘
                                       │
                                       ▼
                              SQLite vault (server/data/sscim.db)
                                       │
                          build-vault-snapshot.mjs
                                       ▼
                          app/src/data/vault-snapshot.json
                                       │
                            audit + tests (the gate)
                                       ▼
                              commit → push → Pages build
```

Nothing skips the gate. If the audit or tests fail, nothing is committed and the last good deployment stays live.

## Model and data changes

Keep data, assumptions, and formulas separate:

- **Numerical priors** belong in `app/src/engine/priors.js`. Nowhere else should contain a magic coefficient — the methodology document and the code use that one object, which is what stops them from drifting apart.
- **Event classifications** belong in `app/src/engine/event-assumptions.js`. They are hand-curated and must never be inferred at runtime from event text.
- **Data changes** flow through the vault and the snapshot scripts, never by hand-editing `vault-snapshot.json` — it is a generated artifact and is gitignored.

Update tests whenever behaviour changes. The suite covers the engine's mathematics, propagation, company metrics, and a full dashboard mount.

## Reviewing candidates

Candidates arrive from the ingest feeds and wait for a human. Either interface works:

```powershell
.\review.ps1 list                     # what is pending
.\review.ps1 show <id>                # proposal + raw upstream record
.\review.ps1 approve <id> --sev=7 --direction=adverse --channel=both
.\review.ps1 reject  <id> --reason="routine notice, no supply-chain effect"
```

or `admin.html` against a running API.

**Decisions do not publish.** They are recorded in the vault immediately, and publishing is a separate explicit step — the *Publish* button in the admin console, or the next scheduled pipeline run. This is deliberate: publishing per decision produced one binary-database commit per click. Work the whole queue, then publish once.

Duplicate handling is automatic at ingest. An identical restatement of a story already in the queue is collapsed and marked; a near-duplicate is left pending but flagged `possible duplicate of <id>`, because a one-token difference can be two genuinely different export-control rules.

## Documentation

Every Markdown file in the repository is published as its own page, at the same path with `.html` appended:

```
docs/PUBLIC_GUIDE.md              →  /docs/PUBLIC_GUIDE.md.html
docs/computation-demo/DATA_PIPELINE.md →  /docs/computation-demo/DATA_PIPELINE.md.html
```

Because the output tree mirrors the source tree, documents keep ordinary repo-relative links and they resolve correctly in both places — on GitHub as Markdown, and on the site once `.html` is appended. Write `[Public guide](PUBLIC_GUIDE.md)` and it works in both.

- **Adding a document:** drop a `.md` file anywhere outside the ignored dependency and build folders. Discovery is a filesystem walk (`app/scripts/lib/find-markdown.mjs`), so the next build publishes it, lists it on `/docs.html`, and indexes it at `/docs/` with nothing to register. Pushing to `main` triggers the Pages workflow, so it goes live on its own.
- **Cache-safe discovery:** the build writes both a bundled fallback and `/docs-manifest.json`. The documentation landing page requests that manifest with cache bypass, so an older cached `docs.html` shell can still show documents from the newest deployment. If the request fails, the complete bundled list remains available.
- **Reading order:** the first several documents are ordered by the `PRIORITY` list in `app/scripts/lib/find-markdown.mjs`; everything else is alphabetical.
- **Link targets that are not documents** — source files, CSVs, directories — are rewritten to GitHub blob URLs rather than to paths this static host does not serve.
- **Heading anchors** are generated from the heading text, GitHub-style, so `METHODOLOGY.md#operational-layer` works.

### Mathematics

Equations are rendered with KaTeX at build time, in both notations GitHub accepts:

````markdown
```math
S_{i,e,t} = S_{i,e,0}e^{-kt}
```
````

and `$$…$$` for display, `$…$` for inline. Both render identically on GitHub and on the site.

Extraction runs on the Markdown *before* marked and substitutes the rendered HTML back afterwards, so KaTeX's markup is never re-parsed. Fenced and inline code are skipped — `echo $PATH` in a shell snippet is not an equation — as is currency in prose. A malformed equation renders as its own source with a warning colour rather than failing the build. KaTeX's stylesheet and `.woff2` fonts are copied to `/vendor/katex/`.

### Tags

Each document carries tags that drive the filter on `/docs.html`. Declare them with an HTML comment anywhere in the file:

```markdown
<!-- tags: methodology, math -->
```

An HTML comment is invisible wherever Markdown renders, including on GitHub, so tagging costs the document nothing — YAML front matter would have appeared there as a stray table. Untagged documents fall back to a path rule in `app/src/docs/docTags.js`, so the filter is complete from the first build rather than covering only what someone remembered to annotate. Selecting several tags widens the result (union), which is what browsing by interest wants.

Commands:

```powershell
npm run docs         # rebuild the index consumed by docs.html
npm run docs:pages   # render the standalone pages into dist-app/ (runs automatically after build)
```

`docs:pages` runs as `postbuild` because Vite empties the output directory; running it earlier would have its output deleted.

## Safe publication

Run the snapshot build, audit, and tests before publishing; the backend pipeline enforces exactly this gate before committing and pushing. Never commit secrets — `server/.env` holds local credentials and is gitignored, and the backend run scripts deliberately live outside the repository clone so they cannot be committed by accident.

## Further reading

- [System architecture](SYSTEM_ARCHITECTURE.md) — components, deployment, and the publication boundary.
- [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md) — what enters the model and what each output means.
- [Data pipeline](computation-demo/DATA_PIPELINE.md) — the evidence-to-publication process and its automation ceiling.
- [Methodology](METHODOLOGY.md) — what the engine actually computes.
