[SSCIM calculation specification](README.md) · section 12 of 49

# 12. Upstream Shock Propagation

# 12.1 Purpose

Estimate how a buyer-side demand reduction affects upstream suppliers.

## 12.2 Equation

For buyer $j$ and supplier $i$:

```math
\Delta S_{i\leftarrow j}^{\mathrm{up}}
=
S_j
\times
r_{ij}
\times
f_{\mathrm{up}}
```

where:

- $S_j$ is buyer demand shock
- $r_{ij}$ is supplier revenue dependence on buyer
- $f_{\mathrm{up}}$ is upstream transmission coefficient

## 12.3 Current parameter

```math
f_{\mathrm{up}}=0.30
```

## 12.4 Example: Apple to TSMC

Suppose Apple reduces relevant orders by:

```math
S_{Apple}=0.50
```

TSMC derives:

```math
r_{TSMC,Apple}=0.25
```

of relevant revenue from Apple.

Then:

```math
\Delta S_{TSMC\leftarrow Apple}^{\mathrm{up}}
=
0.50\times0.25\times0.30
```

```math
\Delta S_{TSMC\leftarrow Apple}^{\mathrm{up}}
=
0.0375
```

The upstream effect is:

```math
3.75\%
```

---

[← 11. Calculating the Downstream Transmission Parameter](11-calculating-the-downstream-transmission-parameter.md) · [Contents](README.md) · [13. Calculating the Upstream Transmission Parameter →](13-calculating-the-upstream-transmission-parameter.md)
