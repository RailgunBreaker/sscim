[SSCIM calculation specification](README.md) · section 19 of 49

# 19. Geographic Risk

A geographic-risk score can combine concentration and external country risk.

## 19.1 Concentration-only measure

```math
GEO_i^{conc}
=
\sum_cg_{ic}^2
```

## 19.2 Exposure-weighted country risk

Let $CR_c$ be normalized country risk.

```math
GEO_i^{country}
=
\sum_cg_{ic}CR_c
```

## 19.3 Combined geographic score

```math
GEO_i
=
\eta\,GEO_i^{conc}
+
(1-\eta)GEO_i^{country}
```

where:

```math
0\leq\eta\leq1
```

Example:

```math
GEO_i^{conc}=0.54
```

```math
GEO_i^{country}=0.70
```

```math
\eta=0.50
```

Then:

```math
GEO_i
=
0.50\times0.54
+
0.50\times0.70
```

```math
GEO_i=0.62
```

---

[← 18. Network Importance](18-network-importance.md) · [Contents](README.md) · [20. Policy Exposure →](20-policy-exposure.md)
