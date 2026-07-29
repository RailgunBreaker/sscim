[SSCIM calculation specification](README.md) · section 35 of 49

# 35. Historical Trend Calculation

For date $t$:

```math
Index_t
=
100
\sum_i\omega_{i,t}R_{i,t}
```

Daily change:

```math
\Delta Index_t
=
Index_t-Index_{t-1}
```

Percentage change:

```math
Growth_t
=
\frac{Index_t-Index_{t-1}}
{Index_{t-1}}
```

Rolling average:

```math
MA_t^{(n)}
=
\frac{1}{n}
\sum_{k=0}^{n-1}Index_{t-k}
```

---

[← 34. Overall Semiconductor Supply-Chain Index](34-overall-semiconductor-supply-chain-index.md) · [Contents](README.md) · [36. Sensitivity Analysis →](36-sensitivity-analysis.md)
