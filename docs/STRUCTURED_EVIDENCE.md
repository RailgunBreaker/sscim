# Structured evidence and prospective operations

Updated September 8, 2026. The application now carries downstream shortage
observations, a prospectively captured revenue forecast and a news-monitoring
baseline. Their evidence and operational status are separate.

[Chain loss accounting](CHAIN_LOSS_ACCOUNTING.md) holds the four accounting
scopes built on top of this ledger: reconciliation of Sony's, Western Digital's,
Nokia's and Renesas's disclosed scopes; supplier allocation across five cost
bases and three named cost-sharing rules; physical production losses that
survive a recovery date; and semiconductor reimbursement follow-up with a
filing-discovery queue. Every one of those evaluators runs in the hourly
workflow described below and exports into the same catalog.

## Downstream disruption losses

`reference/chain-loss-evidence.json` contains six reported outcome measurements
and four earlier issuer forecasts, plus four external sector estimates. These
are measurements, not fourteen independent incidents. The issuer records cover
the 2021 automotive shortage; the sector series extends through H1 2023. Records
retain company or sector scope, period, target, units, denominator, precision,
publication date, review provenance and limitations.

- Ford reported approximately 200,000 lost production units and a 17% production
  reduction in Q1 2021. Its Q2 50% reduction and full-year 1.1 million wholesale
  unit / USD 2.5 billion adjusted-EBIT impacts were forecasts at that disclosure.
  [Ford Q1 2021 Form 10-Q](https://www.sec.gov/Archives/edgar/data/37996/000003799621000026/f-20210331.htm).
- Stellantis reported approximately 600,000 lost production units, or 30% of
  planned production, in Q3 2021.
  [Stellantis Q3 disclosure](https://www.stellantis.com/en/news/press-releases/2021/october/third-quarter-2021-shipments-and-revenues).
- Stellantis retrospectively reported a 20% production reduction for 2021 in its
  2022 annual filing. The ledger retains the February 24, 2023 publication date;
  it does not backdate availability to the production year.
  [Stellantis annual filing](https://www.sec.gov/Archives/edgar/data/1605484/000160548423000020/stellantis-20221231.htm).

Ford's disclosure identifies the Renesas Naka fire as a contributor to its
shortage outlook. The transmission record supports that claim, with no invented
direct shipment edge, intermediary path or allocated loss. Removing this record
removes its attributed downstream evidence from the calculation.

The subtotal API rejects issuer forecasts, percentages, incompatible units or
accounting targets, duplicate records and overlapping periods for one company.
Its example sums Ford Q1 and Stellantis Q3 to approximately 800,000 vehicles.
That is a selected reported subset, not a chain-wide total or a statistical
lower bound. It must not be added to upstream revenue or profit effects: doing
so would mix accounting targets and potentially count the same damage twice.
Company-attributed shortfalls do not independently identify the causal loss
from one supplier. Complete chain loss remains unidentified.

The expanded ledger also retains Renault's Q3 2021 component-shortage estimate
of approximately 170,000 lost units and its earlier full-year forecast of
500,000 units. The cause is tagged as a component shortage; the aggregation
guard prevents automatically pooling it with semiconductor-only claims.
[Renault Q3 disclosure](https://media.renaultgroup.com/third-quarter-2021-priority-given-to-value-over-volume-optimized-revenues-in-a-context-strongly-marked-by-the-semiconductor-crisis/?lang=fra).

### Sector-wide final-output accounts

S&P Global Mobility's July 13, 2023 retrospective analysis estimates global
light-vehicle losses of more than 9.5 million units in 2021, approximately
3.5 million in Q3 2021, 3 million in 2022, and 524,000 in H1 2023. Its method
compares OEM announcements with estimated contemporaneous production plans.
[Publisher's methodology and estimates](https://press.spglobal.com/2023-07-13-S-P-Global-Mobility-The-semiconductor-shortage-is-mostly-over-for-the-auto-industry).

These records have `kind: external_retrospective_estimate`; structured exports
label them `external_estimate`. They are neither direct measurements nor this
application's predictions. The accounting engine preserves qualifiers, rejects
overlapping annual/quarterly estimates and refuses additions of issuer losses
to sector estimates. It also rejects mixed sectors, causes, publishers and
accounting boundaries. Combining approximate figures with a greater-than figure
does not produce a rigorous bound.

This supplies published sector-wide final-output estimates for automotive
manufacturing. It does not fill the missing losses for all semiconductor end
markets or provide upstream plant allocations. The underlying proprietary
counterfactual data is not independently reproduced here.

## Actual prospective capture

The original historical revenue benchmark remains frozen. The current-data
refresh adds original SEC disclosures for January through July 2026, producing
163 monthly observations. August was not yet available at capture.

The September 2026 forecast was recorded at **2026-09-07T23:52:46.734Z**
(September 8 in Tokyo): **TWD 485.68 billion**, with a nominal 80% interval of
TWD 382.88–616.10 billion. This is an experimental two-month-input-lag model,
using data through July. The previous one-month-lag historical pass does not
validate this horizon. Revenue is not a measure of disruption loss.

The record in `prospective/tsmc-revenue-lag2-prospective-v1-2026-09.json` archives
the exact input dataset, protocol and engine source by content hash. The capture
script uses the actual clock, refuses an existing model/month record and offers
no backdating option. Local hashes detect changes relative to the stored digest;
they do not establish an independently attested timestamp. The engine imports
shared helpers from the repository; its archived file is not a self-contained
executable or a complete dependency/environment lock.

The scoring script verifies those hashes before reading outcomes. Pending
outcomes contribute neither zero errors nor successful coverage. As of this
update, **one forecast is captured, zero scored and one pending**. Scores are
separated by model. Twelve scored months trigger review, not automatic approval.

## News operational observation

Monitoring began at **2026-09-07T23:57:08.984Z**. The first actual local pipeline
cycle ingested 75 new physical RSS records published before monitoring began.
Those are backfills, not prospective latency successes; queue deduplication
reported 72 new candidates. There are zero qualifying fresh reports so far.
Classifier accuracy and incident recall remain null without independent labels
and a reference incident census. The run did not invoke AI classification.

The baseline records pre-existing IDs, and the monitor distinguishes later
publications from backfills and missing/invalid timestamps. This is one completed
ingestion cycle and an initialized monitoring workflow. No recurring job was
installed at that initial capture. The subsequent hourly workflow is described
below. Publication-to-ingestion lag alone would not establish disruption
detection latency or recall.

## JSON and SQLite catalog

`artifacts/structured/manifest.json` identifies the current content-addressed JSON
and SQLite files, counts, dataset hashes and actual file hashes. Both formats
represent the same catalog. Rebuild with `node server/scripts/export-structured-evidence.mjs`.

Scope includes all 20 analytical vault tables; all top-level JSON in
`docs/reference`, `docs/benchmarks`, `docs/prospective` and
`docs/operational-monitor`; and current JSON in the computation-demo validation
and real-data-example directories. Superseded `docs/archive` files, duplicate
prospective input archives, generated application bundles, source code, logs
and credentials are not duplicate catalog datasets. Input archives remain
linked from their forecast records. Markdown prose and PDF source documents
are references, not newly extracted claims.

Database tables are read in one transaction. JSON columns are decoded and their
original fields retained; malformed JSON text remains visible. Every dataset
has a namespace, hash and original shape. Every record retains its JSON pointer
and complete payload, including empty containers. Scalar leaves are typed and
queryable, including nulls and booleans. Record counts include repeat
representations across datasets and are not counts of independent evidence.

| SQLite table | Purpose |
| --- | --- |
| `datasets` | Origin, content hash and record count |
| `records` | Dataset/pointer, evidence status, subject, incident, metric, period, availability, numeric value, units and original payload |
| `fields` | Typed scalar leaves with escaped JSON pointers |
| `sources`, `record_sources` | Deduplicated URL references and claim joins |
| `entities` | Company, plant, country and stage identifiers |
| `relationships` | Reported relationships and explicitly assumed legacy edges |

Evidence statuses are `source_reported`, `external_estimate`, `issuer_estimate`, `issuer_forecast`, `model_prediction`,
`assumption`, `evaluation_result`, `unreviewed` or `reference_unverified`.
Status is not blanket verification of every field. A URL is a reference, not
proof; numeric provenance and review limitations remain in original payloads.
Synthetic validation remains evaluation data, never observed physical losses.
Relationship endpoints retain original identifiers; they are not inferred
plant-to-plant routes.

Example queries:

```sql
SELECT subject_id, metric, value_number, units, period_start, period_end,
       epistemic_status, available_at
FROM records
WHERE dataset_id = 'docs/reference/chain-loss-evidence.json'
  AND pointer LIKE '/records/%';

SELECT type, epistemic_status, COUNT(*) AS records
FROM relationships GROUP BY type, epistemic_status;

SELECT r.original_id, s.url
FROM records r
JOIN record_sources rs ON rs.record_id = r.id
JOIN sources s ON s.id = rs.source_id
WHERE r.original_id = 'ford_2021q1_lost_units';
```

## Continue collection and reproduce

Run these commands from the repository root as new disclosures arrive:

```text
node server/scripts/refresh-revenue-current.mjs
node server/scripts/score-prospective-nowcasts.mjs
node server/scripts/pipeline.mjs --local-only --no-ai --no-triage --no-quotes
node server/scripts/monitor-prospective-news.mjs
node server/scripts/evaluate-chain-loss.mjs
node server/scripts/export-structured-evidence.mjs
cd app
npm run snapshot
npm run verify
npm run build
```

For a new target month, run `node server/scripts/capture-prospective-nowcast.mjs`
after refreshing inputs and before the outcome is disclosed. September already
exists and must not be replaced. The news baseline also already exists; do not
restart it with `--start`. New model choices require new protocol/model IDs.
Future outcomes must occur before prospective predictive accuracy can be
measured; additional compatible downstream evidence is needed for broader loss
coverage.

## Repeated collection and scoring

Run `node server/scripts/run-operations.mjs` from any working directory, or
`npm run operations` from `server`. It executes the following local cycle:

1. Refresh original revenue disclosures with retries, retaining observations
   that have left the SEC recent-filings window and refusing changed amounts.
2. Capture the current target once when inputs are available; retain existing
   captures. Score newly available matching outcomes after hash verification.
3. Check loss-source availability and document hashes; flag changes for review.
   A changed webpage is not automatically a changed or newly verified loss.
4. Ingest public news, monitor prospective timing and refresh loss accounts.
5. Export the structured catalog and regenerate the application snapshot.

Reports update atomically. A failed revenue refresh skips dependent scoring;
independent news and loss collection can still proceed. Each step records its
status, attempts and timestamps. The entire run is marked degraded if a required
step fails. The workflow lock prevents two copies of this runner from writing
simultaneously; it does not lock unrelated manually launched scripts.

`server/data/operations/latest.json` is the current run report; timestamped
reports and logs are in `server/data/operations/runs`. These local runtime files
are ignored by Git and are outside the analytical catalog. Scheduled exports
retain the two latest catalog generations to limit disk growth. Forecast
archives are never pruned or replaced. The pipeline runs with `--local-only`,
`--no-ai`, `--no-triage` and `--no-quotes`; it does not publish or approve events.

The separate Windows task is installed with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File server/scripts/install-operations-task.ps1
Get-ScheduledTask -TaskName 'SSCIM evidence operations sscim-1'
Get-ScheduledTaskInfo -TaskName 'SSCIM evidence operations sscim-1'
```

It runs hourly under the current user's interactive login, with a 40-minute
execution limit and no elevated privileges. The computer must be awake and the
user logged in. It does not alter the existing `SSCIM data pipeline` task for
the separate `sscim-backend` checkout. Remove only this new task using the same
installer's `-Remove` switch.

Per-model scoring now includes MAE, baseline MAE, WAPE, baseline improvement,
interval coverage, mean relative interval width and missing capture months.
Pending outcomes contribute no errors. Missing months remain visible, and
twelve scored months only make a complete series eligible for review; they do
not establish operational validity automatically. Classification accuracy and
incident recall still require independent labels and a reference incident set.

The first complete workflow cycle on September 8 succeeded. At its 02:44:56 UTC
news check, 13 post-baseline feed records qualified, with median ingestion lag
1.5983 hours and p95 2.555 hours; 88 backfills were excluded. These are feed
records, not independently adjudicated incidents, and a small initial sample
does not establish an SLA. The hourly task was installed and a scheduler-triggered
run completed successfully with Windows task result 0. September's forecast
remained unchanged. The machine's task status and local run logs
are the authoritative current execution state.
