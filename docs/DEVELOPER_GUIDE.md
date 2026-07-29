# SSCIM developer guide

## Repository layout

- `app/` — Vite/React static frontend and model implementation.
- `server/` — Express API, SQLite vault, ingestion, review, and publication scripts.
- `docs/` — Markdown rendered by `docs.html`.

## Local development

```powershell
cd app
npm install
npm run dev
```

`npm run dev` first rebuilds the static vault snapshot and documentation library. Use `npm run build` for the production build and `npm test` for the test suite.

For local review/API work, start the backend separately:

```powershell
cd ..
.\start-api.ps1
```

The public site remains static. The local API is the only writer and is needed only for administration and review.

## Model and data changes

Keep data, assumptions, and formulas separate. Numerical priors belong in `app/src/engine/priors.js`; event classifications belong in `app/src/engine/event-assumptions.js`; data changes flow through the vault and snapshot scripts. Update tests whenever behavior changes.

## Documentation

Add Markdown anywhere outside ignored dependency/build folders. `npm run docs` scans the repository and builds the documentation library automatically. Use relative `.md` links; the documentation reader resolves them inside the page.

## Safe publication

Run the snapshot build, audit, and tests before publishing. The backend pipeline does this gate before committing and pushing. Never commit secrets; use `server/.env` for local credentials.
