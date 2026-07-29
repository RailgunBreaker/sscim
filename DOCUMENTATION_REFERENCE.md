# SSCIM documentation reference

This short reference complements the project README and calculation notes. It is for readers interpreting results, contributors adding evidence, and maintainers publishing updates.

## Reading a result

Start with the question being asked. A stage, company, or country may be prominent for different reasons:

- **Structural vulnerability** is time-invariant sensitivity in the current model snapshot.
- **Operational impact** is the modeled effect of a selected event or scenario.
- **Contribution** is how much a country or company accounts for in an aggregate model effect.
- **Topology metrics** describe graph position or hypothetical removal sensitivity. They are not automatically risk scores.

Use the explanation, assumptions, confidence label, and source alongside every number. A high value is a prompt for research, not a prediction of a commercial outcome.

## Glossary

| Term | Meaning in SSCIM |
| --- | --- |
| Stage | One modeled semiconductor production or end-market function. |
| Functional centre | A derived `country × stage` entity with a positive country share in the snapshot. |
| Event | A dated, source-backed disruption record with a human-reviewed classification. |
| Scenario | A user-created hypothetical input, clearly marked simulated. |
| Propagation | The model's downstream transmission of a shock through declared stage dependencies. |
| Prior | A declared parameter or assumption, not a parameter fitted to observed outcomes. |
| Snapshot | The versioned data export used by the public static site. |

## Evidence and publishing checklist

Prefer primary sources: company disclosures, government notices, official incident statements, and original research. Retain the original URL, publication date, and the exact claim the source supports. Record uncertainty instead of filling gaps with inference.

1. Check whether the underlying disruption is already represented in event history.
2. Confirm the source, date, affected stages, and classification rationale.
3. Build the static snapshot and run data audits and tests.
4. Publish only a passing snapshot; keep the last known-good static site available if an audit fails.

## Static availability and live operations

The public dashboard is a static Pages deployment and remains viewable when the maintainer's computer is offline. The review workflow and live administrative API depend on the maintainer's local backend and are intentionally unavailable when that backend is offline.
