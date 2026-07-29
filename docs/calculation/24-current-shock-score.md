[SSCIM calculation specification](README.md) · section 24 of 49

# 24. Current Shock Score

An entity may have multiple direct and propagated shocks.

A capped additive version is:

```math
SHOCK_i
=
\min\left(
1,
\sum_eS_{i,e,t}
+
\sum_j\Delta S_{i\leftarrow j}
\right)
```

A probabilistic-union version is:

```math
SHOCK_i
=
1-
\prod_h(1-z_{ih})
```

where each $z_{ih}$ is one direct or propagated shock contribution.

---

[← 23. Market Dominance Score](23-market-dominance-score.md) · [Contents](README.md) · [25. Structural Risk Score →](25-structural-risk-score.md)
