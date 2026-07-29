[SSCIM calculation specification](README.md) · section 31 of 49

# 31. Stage-Level Risk

Let stage $s$ contain companies $i\in s$.

A market-share-weighted stage risk is:

```math
R_s
=
\sum_{i\in s}
\tilde{m}_{i|s}R_i
```

where:

```math
\tilde{m}_{i|s}
=
\frac{m_i}{\sum_{j\in s}m_j}
```

A concentration-adjusted version is:

```math
R_s^{adj}
=
R_s\left(1+\kappa HHI_s\right)
```

where:

```math
HHI_s=\sum_{i\in s}m_i^2
```

and $\kappa$ controls concentration amplification.

---

[← 30. Systemic Criticality](30-systemic-criticality.md) · [Contents](README.md) · [32. Country Risk →](32-country-risk.md)
