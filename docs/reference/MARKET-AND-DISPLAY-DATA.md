# Reference — Market and display data

*Last updated: 2026-08-22. Part of the [reference library](README.md).*

Everything the interface shows but never computes with. Each item here is on
the page because it helps a reader orient; none of it can move a score.

## Market quotes

| | |
| --- | --- |
| **Source** | Yahoo Finance quote API, `query1.finance.yahoo.com/v7/finance/quote` |
| **Coverage** | 92 of 109 companies — the 17 without a public listing have no row, by design |
| **Fields** | Price, currency, day change %, trailing and forward P/E, market cap, timestamp |
| **Refresh** | Polled every 60s when a live vault is reachable; otherwise as of the last build |
| **Status** | **Display metadata only. Never an engine input.** |

The ticker map is curated in `server/src/tickers.js`; quotes land in their own
table and are read by exactly one component. A price cannot reach the
propagation engine, so refreshing quotes cannot alter any score — which is why
the quote poller deliberately does not rebuild the engine.

This is a deliberate boundary rather than an omission. A model that let market
prices feed a supply-chain risk score would be circular: the score would move
because the market moved, and then be read as evidence about the market.

## Basemap tiles

| | |
| --- | --- |
| **Primary** | CARTO dark basemap, `basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` |
| **Fallback** | OpenStreetMap standard, `tile.openstreetmap.org/{z}/{x}/{y}.png` |
| **Attribution** | © OpenStreetMap contributors © CARTO |

The fallback is automatic: if CARTO tiles fail, the map switches to OSM and
applies a filter so the light tiles read against the dark interface. If both
fail, a notice says so and the markers stay interactive — the geography is
decoration, the data is not.

## Company logos

Resolved from each company's `domain` field in the vault. Presentation only;
absence of a logo means no domain is recorded, never anything about the
company.

## Briefings

Generated from the vault at each pipeline run and archived by date — **5 on
record**. A briefing is a derived readout of that day's state, not a source:
everything in it comes from rows described elsewhere in this library. The
archive exists so that "what the model said on this date" is a record rather
than something only reconstructable by checking out an old commit.

Recent bodies ship with the static build so the deployed site can open them
with no backend; older entries stay listed and are fetched from the API when
one is reachable.

## What this does not know

- **Quotes are as-of, not real-time.** The static deploy carries whatever the
  last build fetched. The interface shows the timestamp; read it before reading
  the price.
- **No corporate actions.** Splits, listings changes and ticker migrations are
  not tracked. A stale ticker yields a missing quote, not a wrong one.
- **Nothing here is investment advice**, and the model that ignores these
  numbers is the same model that produces every risk figure on the site.
