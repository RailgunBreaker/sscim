# SSCIM validation note

SSCIM does not currently have an outcome dataset suitable for maximum-likelihood estimation of its transmission coefficients. Therefore it does not claim fitted parameters, statistical confidence intervals, or predictive accuracy.

What can be validated today:

- graph and arithmetic unit tests;
- deterministic reproducibility from a fixed snapshot and scenario;
- data audits for structural consistency;
- sensitivity analysis across declared low/base/high priors;
- qualitative review of documented historical cases.

What cannot yet be claimed:

- calibrated probability of disruption;
- expected loss or recovery time;
- causal impact estimate;
- confidence interval around a result.

A future validation program needs dated events, independently observed outcomes, a target metric, a fitting protocol, and out-of-sample tests. See [Model roadmap](../MODEL_ROADMAP.md).
