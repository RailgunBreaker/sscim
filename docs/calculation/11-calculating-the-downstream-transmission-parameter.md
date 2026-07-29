[SSCIM calculation specification](README.md) · section 11 of 49

# 11. Calculating the Downstream Transmission Parameter

From one historical supplier-customer event:

```math
S_j
=
S_i d_{ij}q_{ij}f_{\mathrm{down}}
```

Rearrange:

```math
f_{\mathrm{down}}
=
\frac{S_j}{S_i d_{ij}q_{ij}}
```

Example:

```math
S_i=0.80
```

```math
S_j=0.30
```

```math
d_{ij}=0.75
```

```math
q_{ij}=0.90
```

Then:

```math
f_{\mathrm{down}}
=
\frac{0.30}
{0.80\times0.75\times0.90}
```

```math
f_{\mathrm{down}}
=
0.556
```

## 11.1 Multiple-event calibration

Define:

```math
X_e
=
S_{i,e}d_{ij,e}q_{ij,e}
```

```math
Y_e
=
S_{j,e}
```

Then estimate:

```math
\hat{f}_{\mathrm{down}}
=
\frac{\sum_eX_eY_e}
{\sum_eX_e^2}
```

or explicitly:

```math
\hat{f}_{\mathrm{down}}
=
\frac{
\sum_e
\left(S_{i,e}d_{ij,e}q_{ij,e}\right)S_{j,e}
}
{
\sum_e
\left(S_{i,e}d_{ij,e}q_{ij,e}\right)^2
}
```

subject to:

```math
0\leq f_{\mathrm{down}}\leq1
```

---

[← 10. Downstream Shock Propagation](10-downstream-shock-propagation.md) · [Contents](README.md) · [12. Upstream Shock Propagation →](12-upstream-shock-propagation.md)
