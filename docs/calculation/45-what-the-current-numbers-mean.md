[SSCIM calculation specification](README.md) · section 45 of 49

# 45. What the Current Numbers Mean

The current parameters should be described honestly.

| Parameter | Current meaning | Is it directly calculated now? | Future method |
|---|---|---|---|
| $H=12$ | Event effect halves every 12 days | No | Fit historical recovery curves |
| $f_{down}=0.55$ | 55% base downstream transmission | No | Estimate from supplier-customer disruptions |
| $f_{up}=0.30$ | 30% base upstream transmission | No | Estimate from buyer-demand shocks |
| $\phi=0.25$ | At least 25% specificity remains | No | Fit supplier-substitution cases |
| $\lambda=0.40$ | Extra policy adds 40% incremental effect | No | Fit overlapping-policy outcomes |
| $\tau=10^{-4}$ | Ignore very small path contributions | Engineering choice | Convergence and runtime testing |
| weights | Relative importance of risk dimensions | Expert prior | Constrained regression or AHP |
| $\pm30\%$ | Sensitivity range | Scenario choice | Replace with confidence intervals |
| snapshot date | Data freeze date | Yes | Set directly from database |

---

[← 44. Example Output Objects](44-example-output-objects.md) · [Contents](README.md) · [46. Minimum Viable Product Data Requirements →](46-minimum-viable-product-data-requirements.md)
