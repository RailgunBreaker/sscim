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
    review-queue.js          approve / reject / bulk / triage / batched publish
    triage.js                the auto-approve / auto-reject / needs-review rules
    event-admin.js           edit / delete / restore events, recorded as overrides
    event-impact.js          what removing an event does to the index
    history-events.js        curated 2021→2026 events
    decade-events.js         the 2016→2025 backfill that completes the ten-year window
    ingest/                  usgs, federal-register, webz-news, dedupe
    ai/                      candidate drafting (proposals only, never authoritative)
    quotes.js                market-quote refresh, shared by script and API
  scripts/
    pipeline.mjs             the whole fetch → draft → verify → publish run
    review.mjs               review queue CLI
    draft-candidates.mjs     re-draft undrafted candidates without a full pipeline run
    sync-events.mjs          code-defined events → vault, ages re-derived
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
| `timeseries.js` | analysis of the whole index history — peaks, runs, per-event attribution |
| `index.js` | assembles everything into the engine the UI consumes |
| `diagnostics.js` | graph validation — runs before anything else |

`timeseries.js` never re-derives the index: every figure it reports comes from the engine's own `chainIndexAt` / `indexOf`, so the analysis and the history chart cannot disagree. Its per-event attribution is **marginal** — the index on the event's own date minus the same date with that event removed — because propagation combines through a saturating noisy-OR, so standalone magnitudes do not sum. Both numbers are reported; the gap between them is the overlap with everything else active at the time.

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
cd ..\server
npm run api:restart  # API on :8787 (reads server/.env)
```

The public site remains static. The local API is the only writer, and is needed only for administration, review, and live quotes.

## How data flows

```
feeds ──► candidate queue ──► AI draft (proposal only)
                                       │
                                       ▼
                                    triage
                                       │
              ┌────────────────────────┬────────────────────────┐
              ▼                        ▼                        ▼
         auto-reject             human review             auto-approve
           (noise)                (ambiguous)                   │
                                       │                        │
                                    approve                     │
                                       │                        │
                                       └───────┬────────────────┘
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

## Administering the historical record

The review queue decides what enters the index. The admin *Events* tab decides what stays in it — every event in the vault, editable and deletable, with the one number that decision actually turns on.

### Δ-if-removed, not severity

Severity says how bad an event was. It does not say what deleting it does to the published index, and the gap between the two is large:

- Effects **decay**. A severity-9 export control from 2022 moves today's reading by nothing.
- Overlapping events **saturate**. Propagation combines through a noisy-OR (`engine/math.js` `combineSigned`), so five near-identical earthquake records each contribute far less than any one of them would alone.

So the screen shows what the engine says: the index with the event, the index without it, and the difference. `server/src/event-impact.js` computes this from `buildBundle()` → `buildVaultData()` → `buildEngine()` — the same path the dashboard renders — and never re-derives an index of its own. That is the rule `engine/timeseries.js` follows, and it is what stops this screen and the published number from disagreeing.

Two figures are reported per event, and they answer different questions:

| | |
| --- | --- |
| `removalDelta` | what **today's** index does if this event is deleted — the number you are deciding on |
| `marginal` | what the event contributed **on its own date** — the historical attribution the dashboard's history panel shows |

An old event with a large `marginal` and a zero `removalDelta` mattered then and does not now.

**Selecting several events previews them as a set**, because the combined delta is not the sum of the individual ones. Clearing four duplicate Kumamoto records from the current vault moves the index 0.74, while the four individual deltas sum to 0.59. The screen shows both, so the saturation reads as the model behaving correctly rather than as an arithmetic error.

### Why an edit needs an override table

Events reach the vault two ways, and they do not behave the same under edit:

- **code-defined** — `history-events.js`, `decade-events.js`, `seed-data.js`. `scripts/sync-events.mjs` upserts every one of them on every pipeline run.
- **vault-only** — added through the review queue or the admin API. Nothing re-creates these.

Deleting a code-defined event straight out of the `events` table is therefore not a delete, it is a delay: the next run puts it back, and an edited severity reverts to the value in the source file, silently, with the index moving back and nothing reporting why.

So every edit and deletion is also recorded in `event_overrides`, and `sync-events.mjs` consults it — a tombstoned id is never re-inserted, a patched one is re-patched after the upsert, and the run logs both. The source file stays the *definition* of the event; the override table is the record of the *human decision* about it.

*Restore* drops the override and lets the code definition win again on the next sync. Nothing here ever rewrites `history-events.js` or `decade-events.js`, so an admin edit can always be undone from the source of truth. A vault-only event has no definition to fall back on, and the restore response says so rather than pretending.

```powershell
# everything an admin has changed
sqlite3 server/data/sscim.db "SELECT event_id, deleted, patch_json, reason FROM event_overrides"
```

### The endpoints

| | |
| --- | --- |
| `GET /api/admin/events/admin` | every event + origin + override + impact |
| `GET /api/admin/events/impact` | impacts alone |
| `POST /api/admin/events/removal-preview` | `{ ids }` — combined effect of removing a set |
| `PUT /api/admin/events/:id` | edit; `reason` is metadata, everything else must be an editable column |
| `DELETE /api/admin/events/:id` | delete + tombstone |
| `POST /api/admin/events/:id/restore` | drop the override |
| `GET /api/admin/events/overrides` | the full audit trail |
| `POST /api/admin/events/publish` | rebuild snapshot → audit → commit → push |

Editable columns are `title`, `summary`, `sev`, `type`, `conf`, `dateISO`, `stages`, `countries`, `first`, `second`, `watch`, `detail`, `source`. Not `id` — it is the join key for assumptions, overrides and candidates. Not `days_ago` — it is derived from `dateISO`, and editing the date recomputes it so the two cannot disagree.

### Committing

*Commit changes* runs `POST /events/publish`, which regenerates the static snapshot and runs the audit **before** committing. That ordering is the point: a set of edits that breaks the data fails the gate and never reaches the deployed site, exactly as `pipeline.mjs` step 6 enforces. Your edits stay in the vault either way — the database is the record, the commit is only its distribution.

This is deliberately not the review queue's idle auto-publish. Editing the historical record is not a queue you work through, and a timer that pushed a half-finished set of deletions would be the wrong default.

## Model and data changes

Keep data, assumptions, and formulas separate:

- **Numerical priors** belong in `app/src/engine/priors.js`. Nowhere else should contain a magic coefficient — the methodology document and the code use that one object, which is what stops them from drifting apart.
- **Event classifications** belong in `app/src/engine/event-assumptions.js`. They are hand-curated and must never be inferred at runtime from event text.
- **Data changes** flow through the vault and the snapshot scripts, never by hand-editing `vault-snapshot.json` — it is a generated artifact and is gitignored.

Update tests whenever behaviour changes. The suite covers the engine's mathematics, propagation, company metrics, the index time-series analysis, and a full dashboard mount.

### Adding historical events

Code-defined events live in three files, all with the same contract: `seed-data.js` (the sample set), `history-events.js` (curated 2021→2026), and `decade-events.js` (the 2016→2025 backfill). `dateISO` is authoritative — `daysAgo` is always derived from it against the vault's snapshot date, never hand-maintained.

```powershell
cd server
node scripts/sync-events.mjs      # upsert every code-defined event, re-derive ages
cd ../app
npm run snapshot && npm run audit:data && npm test
```

`sync-events.mjs` refuses to run if any code-defined event has no entry in `event-assumptions.js`. That is not pedantry: an unclassified id falls back to `operational: false` and is displayed while being **silently** excluded from the scored index, which is very hard to notice afterwards. The same script also rejects duplicate ids across the three sets.

Because the backfilled events are years old and the half-life is 12 days, adding them does not move the current index at all — they exist for the historical series. The dashboard's Layer 3 **HISTORY** tab (`components/DecadeHistory.jsx`) is where that series is read: the decade replay, per-event marginal attribution, and per-year and per-type breakdowns.

## Reviewing candidates

Candidates arrive from the ingest feeds and wait for a human. Either interface works:

```powershell
.\review.ps1 list                     # what is pending
.\review.ps1 show <id>                # proposal + raw upstream record
.\review.ps1 approve <id> --sev=7 --direction=adverse --channel=both
.\review.ps1 reject  <id> --reason="routine notice, no supply-chain effect"
.\review.ps1 publish                  # commit + push the batch now
```

or `admin.html` against a running API. Both front ends call the same `src/review-queue.js`, so an approval records the event **and** its classification either way.

### Automatic triage

Most of what the news feed delivers is not a supply-chain event. A typical day is stock commentary, analyst ratings, earnings reactions, and product announcements, and every one of them used to be a row somebody opened and rejected by hand. Triage reads the fields the AI draft already produced — `relevant` and `confidence` — and acts on the clear-cut ones, so the queue a person opens holds only what is genuinely undecided.

| Draft says | Verdict |
| --- | --- |
| not relevant, confidence above Low | **auto-reject** |
| not relevant, confidence Low | review — dropping a real disruption is the expensive error |
| relevant, confidence High, no duplicate flag | **auto-approve** |
| relevant, confidence Medium or Low | review |
| flagged `possible duplicate`, or no draft at all | review, whatever else it says |

The rules are in `server/src/triage.js` and nowhere else. They are pure — no database, no side effects — so the preview the admin UI groups by and the action the *Run triage* button takes cannot disagree. `app/src/admin/triage.test.js` pins every boundary.

It runs as step 2b of `pipeline.mjs`, straight after drafting, so a scheduled run leaves a queue that is already triaged. `--no-triage` skips it for one run.

**On auto-approval.** It writes to `events` and appends to `event-assumptions.js` with no human in the loop, which is a real qualification of the hand-curated property described in README 4.8. It is bounded — High confidence only, never a flagged duplicate, never an undrafted record — and it is auditable and reversible:

```powershell
# everything triage decided unattended
sqlite3 server/data/sscim.db "SELECT id, status, event_id FROM event_candidates WHERE reviewed_by='auto-triage'"
```

or `GET /api/admin/review/auto`. `POST /api/admin/review/auto/<id>/undo` deletes the event the approval created and returns the candidate to the queue; the matching `event-assumptions.js` entry is reported rather than rewritten, because silently editing a reviewed source file from an undo path is how that file gets corrupted.

Set `SSCIM_TRIAGE_AUTO_APPROVE=off` to keep the auto-reject half only, or `SSCIM_TRIAGE_AUTO_REJECT=off` for the reverse. Both default to on.

### Bulk decisions

`POST /api/admin/review/bulk` takes `{ ids, action, reason }`. The admin UI groups the queue by triage verdict, gives each group a *Select all*, and posts the selection here. Per-item failures are reported individually and never abort the batch — one candidate whose event id collides must not strand the other twenty.

Both bulk and triage route through the same `approveCandidate` / `rejectCandidate` as a single decision. That matters: approve is not a status flip. It inserts the event, derives its id, appends the assumption, and rolls the whole thing back if that append fails. A bulk path that wrote `status='approved'` itself would leave approved candidates with no event behind them.

### Re-drafting a stuck queue

Drafting is step 2 of seven. When it fails — the batch times out, the binary errors — candidates sit pending and undrafted, and the review UI can do nothing with them (`approveCandidate` refuses a candidate with no draft). Redoing that one step no longer means re-running the whole pipeline:

```powershell
cd server
npm run draft                        # draft every undrafted pending candidate
node scripts/draft-candidates.mjs --limit=5   # a few at a time
node scripts/draft-candidates.mjs --dry-run   # list what would be drafted
```

It writes only `proposed_json` / `ai_model` / `ai_notes`. It never touches `events`, never commits, never pushes.

Candidates are analyzed in chunks (`SSCIM_AI_CHUNK`, default 8) rather than one call for everything. Claude Code carries a large system context, so per-candidate calls are the wrong shape — but a single call for the whole queue is all-or-nothing, and one timeout used to leave every pending record undrafted. Each chunk is persisted as it lands, so an interrupted run keeps what it already paid for.

### Publication after review

A decision is written to the vault the instant it is made. Turning that into a commit is separate, and it happens on its own:

- **Admin API / console.** Each decision arms an idle timer. When you stop deciding for `REVIEW_AUTOPUBLISH_IDLE_MS` (default 90s), or as soon as the queue empties, the batch is committed and pushed once. The response and the *Operations* tab both show when the next automatic publish is due. A failure retries with a doubling delay, three attempts, then leaves the decisions for the next pipeline run.
- **CLI.** A command exits before any timer could fire, so it publishes synchronously once the queue is empty instead. `--no-publish` holds it back; `publish` sends it later.
- **Either way, one commit per review session.** Publishing per decision produced one binary-database commit per click, which is what this replaced. Set `REVIEW_AUTOPUBLISH=off` to require the button.

Publishing runs `git pull --rebase --autostash` before pushing. The `--autostash` matters more than it looks: without it, any unrelated working-tree drift in the vault clone aborts the rebase, the push fails, and reviewed data sits committed-but-unpushed while the reviewer sees only "publish failed" — the deployed site silently stops updating. The database is committed before the pull, so it is never what gets stashed.

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
