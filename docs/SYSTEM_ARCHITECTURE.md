# SSCIM system architecture

## Components

```text
Curated data + reviewed events
          │
          ▼
SQLite vault (server/data/sscim.db)
          │
          ├── review API and local admin operations
          └── static snapshot builder
                     │
                     ▼
React/Vite public site → GitHub Pages
```

## Frontend

`app/` is a Vite multi-page React application.

- `index.html` — public landing page.
- `intro.html` — introduction and user guide.
- `sscim-app.html` — interactive map, graph, topology, events, scenarios, and methodology overlay.
- `docs.html` — generated Markdown documentation reader.
- `admin.html` — authenticated operations interface; it is intentionally not linked from public navigation.

`app/src/engine/` contains the deterministic model: priors, graph construction, mathematics, event assumptions, index/history, topology analysis, and model assembly. `app/src/data/vault-snapshot.json` is generated from the vault during builds and is the public site’s offline fallback.

## Backend

`server/` owns the SQLite vault and is the only writer. It provides public read routes, protected administration/review routes, ingestion scripts, AI proposal helpers, audit logic, and publication commands. The backend is local by design; it can be exposed securely through a tunnel for administration, while the public Pages site continues to work from its latest static snapshot when the computer is offline.

## Publication boundary

The public frontend is static. It does not write data and does not require the local backend for ordinary viewing. A reviewed change becomes public only after the vault update, snapshot generation, audit, tests, commit, push, and Pages build succeed.

## Key design constraints

- Preserve a clean separation between source evidence, analyst assumptions, and derived model fields.
- Treat the static snapshot as a versioned publication artifact.
- Never expose secrets in frontend code or documentation.
- Keep the last known-good static site available when an ingest, audit, or test fails.
