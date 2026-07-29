[SSCIM calculation specification](README.md) · section 23 of 49

# 23. Market Dominance Score

The simplest market score is normalized market share:

```math
MKT_i=m_i
```

A nonlinear version may emphasize dominant firms:

```math
MKT_i=m_i^{\gamma}
```

where:

```math
0<\gamma<1
```

compresses differences, while:

```math
\gamma>1
```

emphasizes the largest firms.

For a stage-level concentration score:

```math
MKT_s^{conc}
=
\sum_{i\in s}m_i^2
```

---

[← 22. Substitutability Risk Score](22-substitutability-risk-score.md) · [Contents](README.md) · [24. Current Shock Score →](24-current-shock-score.md)
