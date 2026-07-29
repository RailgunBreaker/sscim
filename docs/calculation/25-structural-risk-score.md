[SSCIM calculation specification](README.md) · section 25 of 49

# 25. Structural Risk Score

The current weighted score is:

```math
R_i
=
0.25NI_i
+
0.20GEO_i
+
0.20POL_i
+
0.15SUBST_i
+
0.10SHOCK_i
+
0.10MKT_i
```

The weights satisfy:

```math
0.25+0.20+0.20+0.15+0.10+0.10=1
```

## 25.1 Worked example

Suppose:

```math
NI_i=0.90
```

```math
GEO_i=0.80
```

```math
POL_i=0.70
```

```math
SUBST_i=0.50
```

```math
SHOCK_i=0.40
```

```math
MKT_i=0.60
```

Then:

```math
R_i
=
0.25(0.90)
+
0.20(0.80)
+
0.20(0.70)
+
0.15(0.50)
+
0.10(0.40)
+
0.10(0.60)
```

```math
R_i
=
0.225+0.160+0.140+0.075+0.040+0.060
```

```math
R_i=0.700
```

On a 0-100 scale:

```math
Score_i=100R_i=70
```

---

[← 24. Current Shock Score](24-current-shock-score.md) · [Contents](README.md) · [26. Structural Score Without Current Shock →](26-structural-score-without-current-shock.md)
