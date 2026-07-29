# SSCIM data pipeline

## Purpose

The pipeline discovers possible events, but publication requires human review. This prevents an article, model draft, or feed error from automatically becoming public model data.

## Flow

```text
source feeds → candidate queue → optional AI draft → human review
→ vault update → snapshot build → audit and tests → commit and publish
```

Candidate feeds can include official incident/policy sources and news. AI may summarize and propose a classification, but it cannot approve an event.

## Reviewer checklist

- Is the source credible and accessible?
- Is this a new disruption rather than another article about an existing one?
- Does the evidence support the date, stages, direction, severity, and confidence?
- Is uncertainty recorded?

An approved change updates the local SQLite vault and event-assumption source, rebuilds the snapshot, audits it, and publishes only on success. If a gate fails, the last good static site stays deployed.
