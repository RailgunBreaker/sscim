[SSCIM calculation specification](README.md) · section 26 of 49

# 26. Structural Score Without Current Shock

If current event shock is excluded, remaining raw weights sum to:

```math
0.25+0.20+0.20+0.15+0.10=0.90
```

Renormalize each remaining weight:

```math
w_k^*
=
\frac{w_k}{0.90}
```

Therefore:

```math
w_{NI}^*=0.2778
```

```math
w_{GEO}^*=0.2222
```

```math
w_{POL}^*=0.2222
```

```math
w_{SUBST}^*=0.1667
```

```math
w_{MKT}^*=0.1111
```

The structural-only score becomes:

```math
R_i^{structural}
=
0.2778NI_i
+
0.2222GEO_i
+
0.2222POL_i
+
0.1667SUBST_i
+
0.1111MKT_i
```

---

[← 25. Structural Risk Score](25-structural-risk-score.md) · [Contents](README.md) · [27. Calculating the Component Weights →](27-calculating-the-component-weights.md)
