# SSCIM documentation reference

Use this index when you need the right document quickly.

| Need | Read |
| --- | --- |
| Understand the product | [README](README.md) and [Public guide](PUBLIC_GUIDE.md) |
| Understand the model | [Model v7 specification](MODEL_V7_SPEC.md) — canonical — plus the [methodology](METHODOLOGY.md) for the reasoning and the [calculation walkthrough](calculation.md) for the steps in order |
| Understand the application | [System architecture](SYSTEM_ARCHITECTURE.md) |
| Understand data flow | [Data sources, inputs, and outputs](DATA_SOURCES_AND_OUTPUTS.md) |
| Check where a specific figure came from | [Reference library](reference/README.md) |
| Use or change the software | [Developer guide](DEVELOPER_GUIDE.md) |
| Evaluate the model academically | [Academic guide](ACADEMIC_GUIDE.md) and [Model v7 specification](MODEL_V7_SPEC.md) |
| Understand topology | [Network architecture](NETWORK_ARCHITECTURE.md) |
| Add or review events | [Data pipeline](computation-demo/DATA_PIPELINE.md) |
| See an example calculation | [Computation demo](computation-demo/COMPUTATION_DEMO.md) |
| See known model gaps | [Model roadmap](MODEL_ROADMAP.md) |
| Read the validation boundary | [Validation status](MODEL_V7_SPEC.md#9-validation-status), then [synthetic parameter recovery](computation-demo/validation/SYNTHETIC_PARAMETER_RECOVERY.md) |
| See the historical revenue test and the pending prospective forecast | [Predictive validation](PREDICTIVE_VALIDATION.md) |
| See what the hourly workflow collects, scores and exports | [Structured evidence and prospective operations](STRUCTURED_EVIDENCE.md) |
| Trace a disclosed loss through its accounting scope | [Chain loss accounting](CHAIN_LOSS_ACCOUNTING.md) |
| Check the recovery-duration fit against the global default | [Recovery duration calibration](RECOVERY_CALIBRATION.md) |
| See what blocks operational use | [Release blockers](RELEASE_BLOCKERS.md) |

## Terms used consistently

- **Evidence:** a source-backed statement kept with a URL/date or primary record.
- **Assumption / prior:** an explicit model choice not fitted to outcome data.
- **Derived value:** a computation from the snapshot and priors.
- **Event:** a dated, human-reviewed disruption record.
- **Scenario:** a hypothetical input, always labeled simulated.
- **Functional centre:** a derived `country × stage` node in the topology view.

When documents disagree, code and `app/src/engine/priors.js` are authoritative for implemented behavior. The static snapshot is authoritative for what the public site currently displays.
