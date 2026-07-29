# SSCIM documentation reference

Use this index when you need the right document quickly.

| Need | Read |
| --- | --- |
| Understand the product | [README](README.md) and [Public guide](PUBLIC_GUIDE.md) |
| Use or change the software | [Developer guide](DEVELOPER_GUIDE.md) |
| Evaluate the model academically | [Academic guide](ACADEMIC_GUIDE.md) and [Calculation specification](calculation.md) |
| Understand topology | [Network architecture](NETWORK_ARCHITECTURE.md) |
| Add or review events | [Data pipeline](computation-demo/DATA_PIPELINE.md) |
| See an example calculation | [Computation demo](computation-demo/COMPUTATION_DEMO.md) |
| See known model gaps | [Model roadmap](MODEL_ROADMAP.md) |
| Read the validation boundary | [Validation note](validation/MLE_VALIDATION.md) |

## Terms used consistently

- **Evidence:** a source-backed statement kept with a URL/date or primary record.
- **Assumption / prior:** an explicit model choice not fitted to outcome data.
- **Derived value:** a computation from the snapshot and priors.
- **Event:** a dated, human-reviewed disruption record.
- **Scenario:** a hypothetical input, always labeled simulated.
- **Functional centre:** a derived `country × stage` node in the topology view.

When documents disagree, code and `app/src/engine/priors.js` are authoritative for implemented behavior. The static snapshot is authoritative for what the public site currently displays.
