[SSCIM calculation specification](README.md) · section 22 of 49

# 22. Substitutability Risk Score

For company or stage $i$, calculate average effective specificity across critical inputs.

Weighted formulation:

```math
SUBST_i
=
\frac{
\sum_j\omega_{ij}q_{ij}
}
{
\sum_j\omega_{ij}
}
```

where $\omega_{ij}$ may be purchase share, dependency share, or criticality weight.

If $q_{ij}$ is already a risk score, higher $SUBST_i$ means lower substitutability and higher risk.

---

[← 21. Calculating the Additional-Policy Factor](21-calculating-the-additional-policy-factor.md) · [Contents](README.md) · [23. Market Dominance Score →](23-market-dominance-score.md)
