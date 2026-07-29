[SSCIM calculation specification](README.md) · section 36 of 49

# 36. Sensitivity Analysis

Current scenario range:

```math
\delta=30\%
```

For parameter $\theta$:

```math
\theta_{low}
=
\theta(1-0.30)
```

```math
\theta_{high}
=
\theta(1+0.30)
```

Example:

```math
f_{\mathrm{down}}=0.55
```

Then:

```math
f_{\mathrm{down}}^{low}
=
0.55\times0.70
=
0.385
```

```math
f_{\mathrm{down}}^{high}
=
0.55\times1.30
=
0.715
```

For entity $i$:

```math
R_i^{low}=R_i(\theta_{low})
```

```math
R_i^{base}=R_i(\theta)
```

```math
R_i^{high}=R_i(\theta_{high})
```

Sensitivity range:

```math
\Delta_i
=
R_i^{high}-R_i^{low}
```

Relative sensitivity:

```math
Sensitivity_i
=
\frac{R_i^{high}-R_i^{low}}
{R_i^{base}}
```

---

[← 35. Historical Trend Calculation](35-historical-trend-calculation.md) · [Contents](README.md) · [37. Replacing the Fixed 30% Range with Statistical Uncertainty →](37-replacing-the-fixed-30-range-with-statistical-uncertainty.md)
