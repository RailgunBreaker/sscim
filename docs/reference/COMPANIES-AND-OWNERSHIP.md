# Reference — Companies and ownership

*Last updated: 2026-08-22. Part of the [reference library](README.md).*

**109 companies** with within-stage stakes, and **75 shareholder rows**.
Defined in `server/src/seed-data.js`.

## What a company record holds

| Field | Tier | Meaning |
| --- | --- | --- |
| `id`, `name` | — | Identity |
| `country` | C | **Headquarters**, not production geography |
| `domain` | — | Used for the logo only |
| `stakes` | B / C | Within-stage share: `{ stageId: share }` |

**Headquarters is not where the work happens**, and conflating the two is the
most common misreading of any supply-chain map. Country results in this model
are share-weighted stage aggregates — production geography — and headquarters
is displayed separately, labelled "HQ:", never substituted for it. The facility
layer is what actually locates a company's output.

## Three company numbers, never blended

The interface reports three separate figures because they answer different
questions, and a single blended score would move for incompatible reasons:

| Number | Question | Property |
| --- | --- | --- |
| **Systemic criticality** | If this company were fully disrupted, how far would it travel? | Share-weighted; normalised against the largest raw value actually achieved |
| **Vulnerability** | How exposed is it right now? | **Share-independent** — two companies in the same stage score the same regardless of size |
| **Contribution** | How much of the current effect runs through it? | **Share-weighted** — market share never cancels out |

Criticality is normalised against the largest score any company actually
reaches, not a theoretical ceiling. Dividing by the unreachable ceiling squashed
every real company into a sliver near zero — the most systemically important
company in the snapshot scored under 2/10, indistinguishable from a minor one.
The rescaling is strictly increasing, so "larger share never reduces
criticality" still holds.

## Ownership — 75 rows

13F filings, annual reports and exchange disclosures (tier C). Used for the
capital board, which ranks shareholders by ownership share × company systemic
criticality, with state-linked capital marked.

**This is the most compliance-sensitive and fastest-ageing dataset here.** A
13F is a quarterly snapshot of a position that may already have changed;
cross-holdings, custodial nominees and beneficial-ownership chains are not
resolved. Treat a shareholder row as "was reported at that filing" rather than
"holds today".

## Evidence notes

Specific figures carry citations in `server/src/data-notes.js` — **14 notes**
(1 tier A, 9 tier B, 4 tier C). Examples, verbatim from the vault:

- `company:tsmc` — TrendForce press release 20260312-12965 (4Q25 top-10 foundry)
- `company:nvidia` — Silicon Analysts, *NVIDIA AI GPU Market Share 2024–2026*
- `company:cxmt` — SemiAnalysis, *China's CXMT Is Set to Challenge DRAM Incumbents*
- `company:ansys` — Synopsys FY2025 disclosures; SemiAnalysis EDA Market Primer
- `owners:intel` — Intel 8-K filings (SEC EDGAR, Aug 18 & Sept 15 2025)
- `owners:tsmc` — TSMC 2025 Annual Report; MarketScreener shareholder data
- `owners:foxconn` — Focus Taiwan / TWSE disclosure (2025-12-02)
- `customer:tsmc->nvidia` — CNBC, *Nvidia set to supplant Apple as TSMC's top customer*
- `customer:skhynix->nvidia` — TrendForce, *NVIDIA drives 27% of SK hynix revenue*

All are listed in the [source register](SOURCE-REGISTER.md).

## What this does not know

- **Evidence-note coverage is thin.** Most companies still have no note
  attached. The audit reports the exact count on every run — currently 105 of
  109 companies have none. That is a real gap, reported rather than hidden.
- **Stakes are share estimates, not capacity.** Company shares within a stage
  can sum above 100% of the modeled sample where disclosure overlaps; the audit
  warns and the computation normalises rather than silently accepting it.
- **The company set is a sample.** 109 companies is the modeled universe, not
  the industry. Anything outside it is invisible to every company-level number,
  including the notable absence of Zeiss SMT and Trumpf from the EUV chain.
- **No financial modelling.** Market quotes are display metadata and never an
  engine input; nothing here estimates revenue, cost or margin impact.
