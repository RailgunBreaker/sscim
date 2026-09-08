# Chain loss accounting

Updated September 9, 2026. Four accounting scopes now sit over the same
disruption record, and this page holds all four. They were previously four
separate pages; the text below is the same evidence, gathered so that the
boundaries between the scopes are readable in one place.

| Scope | What it covers | What it cannot do |
| --- | --- | --- |
| [Reconciliation across disclosed scopes](#reconciliation-across-disclosed-scopes) | 20 structured records and five reconciliation checks over Sony, Western Digital, Nokia and Renesas accounts | Identify a global economic loss across all firms and end markets |
| [Supplier allocation](#supplier-allocation-beyond-existing-scopes) | Five cost bases and three named cost-sharing rules, with explicit unknown attribution | Establish semiconductor causality for battery and vehicle recalls |
| [Physical production losses](#physical-production-losses-beyond-recovery-dates) | Four issuer estimates of production lost around reviewed recovery milestones | Convert normalized production days into money or allocate them to customers |
| [Semiconductor follow-up](#semiconductor-reimbursement-and-downstream-follow-up) | Insurance and recovery accounting, confounded customer outcomes, and a filing-discovery queue | Name a material supplier's reimbursement share or isolate a customer's causal loss |

**These scopes are not additive.** They use different currencies, fiscal
periods, accounting targets and reporting entities, and several of them
describe the same underlying damage from different angles. No cross-account
total is emitted anywhere in the code, because independence between the
scopes has not been established. Unknown quantities stay null; a missing firm
is never assigned a loss of zero.

The automotive ledger that these scopes extend, the prospective forecast
capture and the hourly workflow that reruns every evaluator here are described
in [structured evidence and prospective operations](STRUCTURED_EVIDENCE.md).
The recovery milestones that section three depends on are fitted separately in
[recovery duration calibration](RECOVERY_CALIBRATION.md).

## Reconciliation across disclosed scopes

As of September 8, 2026, this scope holds 20 structured records and
five reconciliation checks beyond the automotive ledger. It closes arithmetic
and disclosed-scope coverage for specific issuer accounts. It does not identify
a complete global economic loss across all firms and end markets.

### Sony: a complete disclosed consolidated scope

Sony's FY2016 table reports an estimated JPY 52.8 billion reduction in operating
income from the Kumamoto earthquakes, before insurance recoveries. It spans
semiconductors, imaging and corporate costs. The rendered table was checked
against the extraction, including units, annual/quarterly columns and footnotes.
[Sony FY2016 results, slide 5](https://www.sony.com/SonyInfo/IR/library/presen/er/16q4_sonypre.pdf).

| Disclosed segment | Adverse impact, JPY billion |
| --- | ---: |
| Semiconductors | 38.8 |
| Imaging | 10.5 |
| Corporate | 3.5 |
| Consolidated | 52.8 |

The same parent amount reconciles by cost type: 16.7 physical damage, 1.8 recovery
expenses/other and 34.3 opportunity losses. Four quarterly totals also reconcile.
The semiconductor subtotal reconciles to its three component categories. These
are alternative partitions of the same disclosed effect, not extra observations
to add together. Opportunity losses include idle facility costs and foregone
profit; corporate amounts include unallocated fixed costs. This is an issuer's
retrospective estimate, not independent causal measurement.

### Western Digital: charges and recovery transfers

The FY2022 filing records USD 207 million of contamination-related charges in
cost of revenue. It separately discloses USD 68 million of FY2020 charges from a
2019 power outage and recoveries of USD 75 million in FY2021 and USD 7 million
in FY2022. The latter series yields a net recognized cost of **negative USD
14 million**, a credit. The engine retains that result rather than flooring it
at zero or reporting it as a negative social loss. Insurance/utility recoveries
are transfers; company accounting and resource losses have different boundaries.
[Western Digital FY2022 filing, Flash Ventures note](https://www.sec.gov/Archives/edgar/data/106040/000010604022000055/wdc-20220701.htm).

That filing also describes Western Digital's rolling wafer-purchase forecast as
generally half of Flash Ventures output, plus obligations for half of fixed
costs. The historical contractual relationship is structured separately.
It does not license doubling the recorded contamination charges to estimate
the joint ventures' total, or allocating loss to downstream device makers.

### Nokia: delayed sales are not permanent loss

Nokia reports an approximately EUR 200 million FY2020 net sales impact from
factory closures, mainly at Alcatel Submarine Networks. It expected most sales
to move into future periods. The ledger records this as a retrospective
revenue-timing estimate, with permanent loss and observed recovery unresolved.
Its cause is COVID-related factory closures, not a proven semiconductor-only
shortage. [Nokia FY2020 disclosure](https://www.nokia.com/newsroom/nokia-corporation-financial-report-for-q4-and-full-year-2020/).

### Renesas: retain rounding differences

The existing Naka-fire records provide a JPY 18.7 billion gross shipment impact,
JPY 6.0 billion recovered through countermeasures and JPY 12.6 billion reported
net revenue impact. The arithmetic yields 12.7, leaving a 0.1 residual. It is
consistent with the combined 0.15 source-rounding tolerance; the engine retains
the residual instead of rewriting a source amount. Countermeasures include
several actions, not an identified inventory-only effect.
[Renesas Q2 2021 presentation](https://www.renesas.com/en/document/ppt/2021-2q-presentation-material).

### Accounting rules and scope

Each record specifies company, incident, period, currency/unit, metric,
accounting basis, cause and economic components represented. Components are
labels for the source's accounting partition, not inferred shipment routes.

- Parent totals cannot be added to their children, nor annual totals to
  overlapping quarters. Currency, incident, company and metric mismatches fail.
- A bridge must cover every parent component and its whole reporting period
  exactly once. Equal numbers alone cannot pass a missing-partition check.
- Explicit forecasts cannot enter retrospective reconciliation. Issuer estimates
  remain `issuer_estimate` in the structured catalog; booked charges remain
  `source_reported`. Neither status verifies every field independently.
- Missing components, time gaps and incompatible selections remain failures.
  Residuals are tested against published rounding precision, not fitted away.
- The application displays reconciliation status and source links by company.
  Permanent global loss remains null; no missing firm is assigned zero loss.

The default data includes four Sony bridges with matching totals and one
Renesas bridge consistent with rounding. Those five checks concern two
incidents; they are not five independent prediction tests. The Western Digital
net figure is a derived accounting subtotal, without a separate reported parent
total to validate it against.

### Files and automation

- `docs/reference/loss-reconciliations.json`: records, source hash, relationships
  and declared partitions.
- `docs/benchmarks/loss-reconciliation-evaluation.json`: complete check results.
- `app/src/engine/lossReconciliation.js`: selection and reconciliation engine.
- `server/scripts/import-loss-reconciliations.mjs`: reproducible curated import.
- `server/scripts/evaluate-loss-reconciliations.mjs`: offline evaluator.

The existing hourly operations task now evaluates these accounts and monitors
their primary sources, including PDFs. Failed retrieval remains visible and
never creates replacement values. The structured export includes the new data
and benchmark automatically. See [workflow instructions](STRUCTURED_EVIDENCE.md)
for run logs and scheduling controls.

## Supplier allocation beyond existing scopes

As of September 8, 2026, the evidence workspace holds five cost bases
and three named supplier allocations, with machine-readable provenance and
explicit remaining scope gaps. These are historical disclosures, not current
balances or independent estimates of total economic damage.

| Cost boundary | Disclosed base | Named supplier allocation | Arithmetic remainder |
| --- | ---: | ---: | ---: |
| GM Bolt recall, October 2021 disclosure | USD 2,000 million charges | Estimated recovery of USD 1,900 million from LG Electronics | USD 100 million |
| Combined LG Bolt reimbursement estimate | KRW 1,400 billion | KRW 700 billion for LG Energy Solution, calculated using the disclosed equal split | KRW 700 billion |
| Hyundai battery replacement estimate | Approximately KRW 1,000 billion | Approximately KRW 700 billion for LG Energy Solution | Approximately KRW 300 billion |
| Kioxia FY2021 contamination charge | JPY 33.2 billion | Unknown | Unknown |
| Western Digital FY2022 contamination charge | USD 207 million | Unknown | Unknown |

[GM's announcement](https://news.gm.com/home.detail.html/Pages/news/us/en/2021/oct/1012-boltev.html)
supports the first partition. Its recovery was estimated; the dataset does not
assert a cash receipt. The residual is the charges less that estimated recovery.

[LG Energy Solution's June 24, 2024 circular, printed pages 13–14](https://links.sgx.com/FileOpen/LGES%202024%20-%20Final%20Offering%20Circular%20%28dd%2024.06.24%29.ashx?App=Prospectus&FileID=63194)
describes the historical Bolt estimate and July 2022 equal-sharing agreement,
and an approximately 70% share of Hyundai replacement costs agreed in March
2021. The derived amounts apply those rules to their disclosed estimates.
Hyundai payments were described as monthly, without a cumulative paid amount.
The LG evidence is available to this dataset from June 2024; agreement dates
are not substituted for disclosure dates. The KRW Bolt estimate is not converted
to, or added to, GM's overlapping USD view. Battery recalls extend sector
coverage without establishing semiconductor disruption causality.

[Kioxia's May 13, 2022 results, page 3](https://www.kioxia-holdings.com/content/dam/kioxia-hd/en-jp/about/asset/Financial-Results-FY2021-4Q-en.pdf)
report the contamination-related operating-income charge for the fiscal year
ending March 2022. Its table and footnote were visually checked. The linked
[Western Digital FY2022 disclosure](https://www.sec.gov/Archives/edgar/data/106040/000010604022000055/wdc-20220701.htm)
uses cost of revenue and a different fiscal year and currency. Neither provides
an identified material supplier's reimbursement share. The existing wafer
purchase/production share cannot fill that gap.

### Implementation

- `docs/reference/supplier-loss-allocations.json` stores entities, bases, rules,
  reviewed sources, dates, accounting boundaries, and incident-specific unknowns.
  Western Digital references its existing record rather than adding new evidence.
- `app/src/engine/supplierLossAllocation.js` binds rules to exact incident, metric,
  cost boundary, currency, period, perspective and disclosure snapshot. It rejects
  unsupported share types, duplicate supplier recoveries, over-allocation,
  unavailable sources and inconsistent inputs. A rejected rule invalidates that
  base's allocation rather than silently making its residual appear larger.
- Supplier allocations and the residual conserve the original base. They are
  not added to gross charges. Unknown allocations are null, not zero. No
  cross-account total is emitted because independence has not been established.
- The API, offline snapshot, evidence workspace, JSON/SQLite catalog, hourly
  source collector and operations evaluator all include the new records. Reviewed
  PDF hashes anchor their first collection; subsequent changes require review.

Rebuild reviewed inputs with
`node server/scripts/import-supplier-loss-allocations.mjs`. Evaluate using
`npm --prefix server run losses:allocate`; the output is
`docs/benchmarks/supplier-loss-allocation-evaluation.json`.

### Remaining measurement work

The scope-gap register identifies final settlements, consumer losses, additional
production interruption, legal costs outside the selected bases, upstream
material-supplier attribution and downstream customer losses. No percentage of
global loss coverage is reported without a known denominator. These gaps require
additional disclosures or data; arithmetic allocation alone cannot resolve them.
Future predictive performance remains governed by the separate
[prospective validation protocol](PREDICTIVE_VALIDATION.md).

## Physical production losses beyond recovery dates

As of September 9, 2026, four issuer estimates connect physical
production losses to reviewed factory recovery milestones. They close a
missing accounting distinction: restoring the capacity to start wafers does
not restore work-in-process destroyed earlier or make up missed production.

| Scope | Reported gross loss | Full wafer-input recovery |
| --- | --- | --- |
| Naka 200mm line, March 2022 earthquake | Approximately 14 normal-production days | March 26 |
| Naka 300mm line, same earthquake | Approximately 21 normal-production days | March 26 |
| Takasaki, same earthquake | Approximately 10 normal-production days | March 23 |
| Kawashiri, July 2022 voltage drop | Approximately 7 normal-production days | July 11 |

Renesas attributes the Naka figures to damaged work-in-process and reduced
production and says it was working to recover the shortfalls. Its full
wafer-input capacity was already restored.
[March 26 final disclosure](https://www.renesas.com/en/about/newsroom/update-4-final-impact-march-16-earthquake-coast-fukushima-prefecture-renesas-operation-1).
The earlier notice similarly reports Takasaki's ten-day shortfall after
wafer-input restoration.
[March 23 disclosure](https://www.renesas.com/en/about/newsroom/update-3-impact-march-16-earthquake-coast-fukushima-prefecture-renesas-operation).
Kawashiri's updated assessment reduces the earlier preliminary two-week
maximum to approximately one week; the dataset uses the later estimate and
does not add both versions.
[July 11 final disclosure](https://www.renesas.com/en/about/newsroom/update-2-final-impact-instantaneous-voltage-drop-operation-kawashiri-factory).

These are retrospective issuer assessments, not exact independently measured
volumes. One production-equivalent day has a different denominator for each
line or factory. The engine therefore does not sum 14, 21, 10 and 7, convert
them into revenue, or allocate them to unspecified customers.

### Accounting treatment

The appropriate accounting structure is gross missed production plus ruined
work-in-process, with subsequent verified catch-up recorded separately.
The disclosures combine the first two components; they do not identify their
individual magnitudes. Catch-up, permanent loss, downstream losses and
supplier allocations remain null rather than zero.

The diagnostic integrates a hypothetical zero-to-full linear restoration
curve between the reported restart and completion dates. For Naka it gives
5.5 equivalent days, much smaller than either reported gross shortfall.
This is a model-boundary diagnostic, not a fitted WIP estimate or a validated
mapping from wafer input to finished output. It explicitly assumes a constant
local baseline and input-to-output equivalence. The latter is precisely why
it cannot explain pipeline inventories and gross lost output by itself.

A verified completion supersedes an assumed date **only for that factory's
wafer-input status**. It does not clear the accumulated-loss balance. The
seven global defaults are not thereby calibrated.

### Reproduction

Run `npm --prefix server run losses:physical`. Inputs are
[physical-losses.json](reference/physical-losses.json) and
[recovery-durations.json](reference/recovery-durations.json). The output is
[physical-loss-evaluation.json](benchmarks/physical-loss-evaluation.json).
The evaluator rejects forecasts, duplicate scopes, incompatible units,
withdrawn evidence and joins to another facility or incident. The hourly
workflow refreshes source retrieval checks, evaluates the ledger and exports
its structured records; the evidence workspace shows the results.

These four records cover two incidents. They improve the physical part of
chain-loss accounting but do not identify a complete all-company economic
loss or customer-level transmission. Monetary charges, insurance recoveries
and automotive shortfalls remain in their existing separate accounting scopes.

## Semiconductor reimbursement and downstream follow-up

As of September 8, 2026, the evidence workspace tracks semiconductor
charges, subsequent recoveries, customer outcomes and unresolved attribution
questions in `reference/semiconductor-loss-followup.json`.

### New measured accounting scope

Western Digital's FY2024 filing reports a USD 37 million contamination recovery
in its segment reconciliation, while the Flash Ventures note identifies USD 36
million received from insurance carriers and recorded in cost of revenue.
The original charge was USD 207 million. The selected accounting calculation is
therefore **207 - 37 = USD 170 million**, with the insurer receipt shown as an
included component. It is not 207 - 37 - 36. The payer of the difference is not
inferred. The filing says further recoveries could not then be estimated.
[FY2024 10-K, segment reconciliation and Flash Ventures](https://www.sec.gov/Archives/edgar/data/106040/000010604024000031/wdc-20240628.htm).

This calculation covers the cited charge and recoveries, not the final claim
balance, all cash payments or total economic damage. No insurer is labeled as a
material supplier. Later filings by Western Digital and Sandisk are monitored;
the latter matters because the flash business was
[subsequently separated](https://www.sec.gov/Archives/edgar/data/2023554/000162828026057406/sndk-20260703.htm).

TSMC's filing records an estimated **TWD 3,400 million** photoresist-related loss
recognized in Q1 2019 cost of revenue. The dataset retains the April 14, 2022
publication date of the reviewed filing that repeats the historical charge.
It does not infer a named chemical supplier or compensation amount.
[TSMC significant operation losses](https://www.sec.gov/Archives/edgar/data/1046179/000119312522104891/R40.htm).

### Customer outcomes and causal attribution

Nikon's imaging business reported year-over-year sales and operating-income
declines of **JPY 137.4 billion** and **JPY 18 billion** for the year ending March
2017. Its slide identifies several drivers, including earthquake effects and
market decline, alongside currency, product mix and cost control. These are
structured financial observations with **unidentified incident and supplier
components**. Neither the full decline nor zero is used as a disruption-loss
label. The observed decline is not a justified upper bound either: other
effects can offset an incident's damage.
[Nikon May 11, 2017 results, slide 14](https://www.nikon.com/company/ir/ir_library/result/pdf/2017/17_all_e.pdf).

### Collection and review workflow

`npm --prefix server run losses:discover` fetches SEC recent submissions and
checks the latest four annual/quarterly primary filings each for Western Digital
and Sandisk, plus three TSMC annual primary filings. It also checks one known
historical recovery filing as a collection/parser reference. This is a bounded
watch list, not a complete search of historical filings, interim exhibits,
non-US issuers or confidential agreements.

Material-incident and recovery/downstream terminology must occur together in a
paragraph to create a candidate. One short excerpt, filing date, source URL,
content hash and first-seen time are retained. A keyword match never supplies a
numeric loss, party identity or calibration label. No match does not mean zero
loss. Changed normalized visible document text reopens review; script-only
changes retain review while recording the changed source hash. Historical references remain
identified as backfills.

`docs/operational-monitor/loss-filing-candidates.json` preserves the queue and
checks. The source collector separately watches the reviewed disclosures,
including byte hashes for PDFs; a PDF URL returning HTML is rejected.

After inspecting a candidate and adding properly scoped reviewed claim records,
link them with:

```text
node server/scripts/review-loss-filing.mjs --id=<candidate> --decision=linked --sha256=<reviewed-hash> --claims=<claim-id,claim-id> --reason=<review-reason>
```

The command requires exact source agreement with existing reviewed claims and
the candidate hash, and takes the operations lock to avoid concurrent writes.
Other decisions are `irrelevant` and `needs_data`. Candidate discovery itself
remains unreviewed as a numerical label even after reviewed claims are linked.
Current claim linking supports the semiconductor follow-up dataset.

The hourly operations task now runs filing discovery and follow-up accounting
before export. The API, offline snapshot, default evidence workspace and
JSON/SQLite catalog expose the new data. Evaluate with
`npm --prefix server run losses:followup`.

### Fundamental issues still open

The question register records the missing supplier identities, settlements and
customer attribution inputs, with sources already inspected and next actions.
Absence from the reviewed sources is not proof that no reimbursement exists.
The seven global propagation parameters remain assumptions. A confidential
settlement or an undisclosed customer counterfactual cannot be reconstructed
uniquely from aggregate revenue alone. Those require new observations or a
separately justified identification design and independent outcome validation;
these accounting improvements do not establish that validation.

## Commands

| Command | What it produces |
| --- | --- |
| `npm --prefix server run losses:reconcile` | [loss-reconciliation-evaluation.json](benchmarks/loss-reconciliation-evaluation.json) |
| `npm --prefix server run losses:allocate` | [supplier-loss-allocation-evaluation.json](benchmarks/supplier-loss-allocation-evaluation.json) |
| `npm --prefix server run losses:physical` | [physical-loss-evaluation.json](benchmarks/physical-loss-evaluation.json) |
| `npm --prefix server run losses:followup` | [semiconductor-loss-followup-evaluation.json](benchmarks/semiconductor-loss-followup-evaluation.json) |
| `npm --prefix server run losses:collect` | Source availability and document hashes for the reviewed disclosures |
| `npm --prefix server run losses:discover` | [loss-filing-candidates.json](operational-monitor/loss-filing-candidates.json) |
| `npm --prefix server run losses:review-filing` | A reviewed decision linking a candidate to existing claims |
| `npm --prefix server run evaluate:chain-loss` | The automotive ledger evaluation described in [structured evidence](STRUCTURED_EVIDENCE.md) |

Curated inputs are rebuilt by the matching `server/scripts/import-*.mjs`
scripts. The hourly operations task runs the four evaluators, the source
collector and filing discovery before exporting the structured catalog; the
evidence workspace in the application displays their results. A failed source
retrieval stays visible and never produces a replacement value.
