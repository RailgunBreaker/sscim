# SSCIM Complete Calculation Specification

## Data, Variables, Parameters, Equations, Calibration, and Outputs

**Project:** Semiconductor Supply Chain Intelligence Model (SSCIM)  
**Purpose:** Explain exactly what data the model needs, how each variable and parameter is used, how the calculations work mathematically, and what outputs are produced.

This specification is split into one file per section so each part can be linked to directly.

## Contents

1. [Core Idea](01-core-idea.md)
2. [Notation](02-notation.md)
3. [Required Data](03-required-data.md)
4. [Model Parameters and Their Current Role](04-model-parameters-and-their-current-role.md)
5. [Data Normalization](05-data-normalization.md)
6. [Event Decay](06-event-decay.md)
7. [Calculating the Event Half-Life](07-calculating-the-event-half-life.md)
8. [Substitutability and Effective Specificity](08-substitutability-and-effective-specificity.md)
9. [Calculating the Specificity Floor](09-calculating-the-specificity-floor.md)
10. [Downstream Shock Propagation](10-downstream-shock-propagation.md)
11. [Calculating the Downstream Transmission Parameter](11-calculating-the-downstream-transmission-parameter.md)
12. [Upstream Shock Propagation](12-upstream-shock-propagation.md)
13. [Calculating the Upstream Transmission Parameter](13-calculating-the-upstream-transmission-parameter.md)
14. [Combining Multiple Incoming Shocks](14-combining-multiple-incoming-shocks.md)
15. [Multi-Step Network Propagation](15-multi-step-network-propagation.md)
16. [Contribution Tolerance](16-contribution-tolerance.md)
17. [Calculating the Contribution Tolerance](17-calculating-the-contribution-tolerance.md)
18. [Network Importance](18-network-importance.md)
19. [Geographic Risk](19-geographic-risk.md)
20. [Policy Exposure](20-policy-exposure.md)
21. [Calculating the Additional-Policy Factor](21-calculating-the-additional-policy-factor.md)
22. [Substitutability Risk Score](22-substitutability-risk-score.md)
23. [Market Dominance Score](23-market-dominance-score.md)
24. [Current Shock Score](24-current-shock-score.md)
25. [Structural Risk Score](25-structural-risk-score.md)
26. [Structural Score Without Current Shock](26-structural-score-without-current-shock.md)
27. [Calculating the Component Weights](27-calculating-the-component-weights.md)
28. [Company Vulnerability](28-company-vulnerability.md)
29. [Company Contribution to System Risk](29-company-contribution-to-system-risk.md)
30. [Systemic Criticality](30-systemic-criticality.md)
31. [Stage-Level Risk](31-stage-level-risk.md)
32. [Country Risk](32-country-risk.md)
33. [Shareholder Influence](33-shareholder-influence.md)
34. [Overall Semiconductor Supply-Chain Index](34-overall-semiconductor-supply-chain-index.md)
35. [Historical Trend Calculation](35-historical-trend-calculation.md)
36. [Sensitivity Analysis](36-sensitivity-analysis.md)
37. [Replacing the Fixed 30% Range with Statistical Uncertainty](37-replacing-the-fixed-30-range-with-statistical-uncertainty.md)
38. [Dataset Snapshot Date](38-dataset-snapshot-date.md)
39. [Full End-to-End Worked Example](39-full-end-to-end-worked-example.md)
40. [Parameter Provenance: Where the Current Numbers Actually Came From](40-parameter-provenance-where-the-current-numbers-actually-came-from.md)
41. [Calibration Framework](41-calibration-framework.md)
42. [Historical Data Needed for Calibration](42-historical-data-needed-for-calibration.md)
43. [Expected Outputs](43-expected-outputs.md)
44. [Example Output Objects](44-example-output-objects.md)
45. [What the Current Numbers Mean](45-what-the-current-numbers-mean.md)
46. [Minimum Viable Product Data Requirements](46-minimum-viable-product-data-requirements.md)
47. [Validation Tests](47-validation-tests.md)
48. [Final Interpretation](48-final-interpretation.md)
49. [One-Sentence Summary](49-one-sentence-summary.md)

---

*Previously a single `docs/calculation.md`. Content is unchanged; only the file boundaries are new.*
