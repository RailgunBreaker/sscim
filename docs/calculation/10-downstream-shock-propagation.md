[SSCIM calculation specification](README.md) · section 10 of 49

# 10. Downstream Shock Propagation

# 10.1 Purpose

Estimate how a supplier-side disruption affects downstream customers.

## 10.2 Edge-level equation

For supplier $i$ and buyer $j$:

```math
\Delta S_{j\leftarrow i}^{\mathrm{down}}
=
S_i
\times
d_{ij}
\times
q_{ij}
\times
f_{\mathrm{down}}
```

where:

- $S_i$ is shock at supplier $i$
- $d_{ij}$ is buyer dependence on supplier $i$
- $q_{ij}$ is effective specificity
- $f_{\mathrm{down}}$ is base downstream transmission

## 10.3 Current parameter

```math
f_{\mathrm{down}}=0.55
```

## 10.4 Worked example: ASML to TSMC

Suppose:

```math
S_{ASML}=0.90
```

```math
d_{ASML,TSMC}=0.80
```

```math
u_{ASML,TSMC}=0.10
```

```math
\phi=0.25
```

First calculate specificity:

```math
q_{ASML,TSMC}
=
0.25+0.75(1-0.10)
```

```math
q_{ASML,TSMC}=0.925
```

Then:

```math
\Delta S_{TSMC\leftarrow ASML}
=
0.90\times0.80\times0.925\times0.55
```

```math
\Delta S_{TSMC\leftarrow ASML}
=
0.3663
```

The propagated shock is approximately:

```math
36.63\%
```

---

[← 9. Calculating the Specificity Floor](09-calculating-the-specificity-floor.md) · [Contents](README.md) · [11. Calculating the Downstream Transmission Parameter →](11-calculating-the-downstream-transmission-parameter.md)
