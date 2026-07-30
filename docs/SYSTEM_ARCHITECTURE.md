# SSCIM system architecture

## The shape of the system in one idea

One machine owns the data and is the only writer. It fetches, drafts, verifies, and pushes. GitHub Pages serves a static site built from what it pushed. **Nothing accepts an inbound connection** — no port forwarding, no dynamic DNS, no public service on a desktop.

The consequence worth internalising: **if the writer machine is off, the site keeps working.** Persistence is git, not a running process, so the last pushed commit serves indefinitely. Data simply stops getting fresher.

## Components

```text
      feeds (USGS · Federal Register · news)
                    │
                    ▼
          candidate queue  ──►  AI draft (proposal only)
                    │
                    ▼
             human review  ─── approve / reject
                    │
                    ▼
     SQLite vault (server/data/sscim.db)   ◄── the single source of truth
                    │
        ┌───────────┴────────────┐
        ▼                        ▼
  read + admin API        static snapshot builder
  (local, :8787)                 │
                                 ▼
                   app/src/data/vault-snapshot.json
                                 │
                     audit + tests  ── the gate
                                 ▼
                   React/Vite build → GitHub Pages
```

## Frontend

`app/` is a Vite multi-page React application with five entry points:

| Page | Purpose |
| --- | --- |
| `index.html` | public landing page |
| `intro.html` | introduction and user guide |
| `sscim-app.html` | the dashboard — map, flow graph, topology, events, scenarios, and a link to the canonical methodology document |
| `docs.html` | generated Markdown documentation reader |
| `admin.html` | authenticated operations console; deliberately not linked from public navigation |

`app/src/engine/` contains the deterministic model — priors, graph construction, mathematics, event assumptions, index and history, topology analysis, model assembly — and is free of UI and I/O so it can be tested directly.

`app/src/data/vault-snapshot.json` is generated from the vault at build time and is the public site's offline data source. It is a build artifact and is gitignored; the committed database is what actually travels.

### How the frontend gets data

`VaultContext.jsx` attempts the configured API first (`VITE_API_BASE_URL`, default `http://localhost:8787`) and falls back to the bundled snapshot when nothing is reachable. On the public deployment that fallback is the only path, by design — the footer says so.

The one exception is market quotes. They are the only dataset that goes stale on its own, so against a live backend the dashboard polls `/api/quotes` and the server refreshes from upstream when its stored values age past fifteen minutes. On the static deployment quotes are as of the last build, and the timestamp is always displayed. Quotes are display metadata and never an engine input, so a failed refresh degrades to slightly older prices, never to a wrong score.

## Backend

`server/` owns the SQLite vault and is the only writer. It provides public read routes, token-protected administration and review routes, ingestion scripts, AI proposal helpers, audit logic, and publication commands.

The backend is local by design. It can be exposed through a tunnel for administration if needed, while the public Pages site continues to serve its latest static snapshot regardless.

### Host layout

The run scripts live *outside* the repository clone on purpose, so they never appear as untracked files in its git status or get committed by accident:

```
sscim-backend\            never committed anywhere
  .env                    real secrets: ADMIN_TOKEN, ANTHROPIC_API_KEY
  config.ps1              shared paths and env loading
  logs\                   pipeline logs, pruned after 30 days
  repo\                   git clone: backend code + the live database
```

A separate editing checkout is used for code changes; it runs nothing. Code flows editing checkout → push → `git pull` inside `repo\`.

## Publication boundary

The public frontend is static. It does not write data and does not require the backend for ordinary viewing.

A reviewed change becomes public only after **all** of: vault update → snapshot generation → audit → tests → commit → push → Pages build. If the audit or the test suite fails, nothing is committed and the previous deployment stays live. A failed run cannot corrupt the published site; it can only fail to improve it.

Review decisions are recorded in the vault the moment they are made, but publication is a separate step. It is also automatic: each decision arms an idle timer, and the batch commits and pushes once the reviewer stops deciding or the queue empties. So a review session still produces one commit — not one per click, and one rewrite of a binary database per click — but nobody has to remember to trigger it. The explicit *Publish* action remains as the "now" override, and `REVIEW_AUTOPUBLISH=off` restores manual-only behaviour.

The failure mode this replaced is worth naming, because it is silent: publication used to run a plain `git pull --rebase`, which aborts if the vault clone has any unrelated working-tree drift. The commit succeeded, the push did not, the task exited non-zero, and the deployed site simply stopped getting fresher while every individual decision looked fine in the database. Both publication paths now rebase with `--autostash`.

## Key design constraints

- Preserve a clean separation between source evidence, analyst assumptions, and derived model fields. Every displayed number must be traceable to one of the three.
- Treat the static snapshot as a versioned publication artifact, not a cache.
- Keep all numerical priors in one object so documentation and code cannot silently diverge.
- Never expose secrets in frontend code or documentation.
- Keep the last known-good static site available when an ingest, audit, or test fails.
- Prefer failing loudly at build time over degrading quietly at run time.

## Further reading

- [Developer guide](DEVELOPER_GUIDE.md) — setup, commands, and code layout.
- [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md) — provenance and meaning.
- [Data pipeline](computation-demo/DATA_PIPELINE.md) — the evidence-to-publication process in detail.
- [Network architecture](NETWORK_ARCHITECTURE.md) — the topology layer's graph design.
