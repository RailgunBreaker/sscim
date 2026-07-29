[SSCIM calculation specification](README.md) · section 4 of 49

# 4. Model Parameters and Their Current Role

| Parameter | Symbol | Current prior | Role |
|---|---:|---:|---|
| Downstream transmission | $f_{\mathrm{down}}$ | 0.55 | Supplier shock transmitted to buyer |
| Upstream transmission | $f_{\mathrm{up}}$ | 0.30 | Buyer demand shock transmitted to supplier |
| Event half-life | $H$ | 12 days | Speed of event decay |
| Specificity floor | $\phi$ | 0.25 | Minimum remaining dependency despite substitutability |
| Additional-policy factor | $\lambda$ | 0.40 | Reduced marginal effect of overlapping policies |
| Contribution tolerance | $\tau$ | $10^{-4}$ | Stops propagation of negligible paths |
| Sensitivity range | $\delta$ | $\pm30\%$ | Tests robustness of prior choices |
| Network weight | $w_{NI}$ | 0.25 | Importance of network centrality |
| Geographic weight | $w_{GEO}$ | 0.20 | Importance of geographic concentration |
| Policy weight | $w_{POL}$ | 0.20 | Importance of policy exposure |
| Substitutability weight | $w_{SUBST}$ | 0.15 | Importance of replacement difficulty |
| Shock weight | $w_{SHOCK}$ | 0.10 | Importance of current event impact |
| Market weight | $w_{MKT}$ | 0.10 | Importance of market dominance |

The current values are best understood as transparent engineering priors, not proven universal constants.

---

[← 3. Required Data](03-required-data.md) · [Contents](README.md) · [5. Data Normalization →](05-data-normalization.md)
