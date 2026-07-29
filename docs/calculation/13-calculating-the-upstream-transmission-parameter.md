[SSCIM calculation specification](README.md) · section 13 of 49

# 13. Calculating the Upstream Transmission Parameter

From one historical case:

```math
f_{\mathrm{up}}
=
\frac{S_i^{\mathrm{up}}}
{S_jr_{ij}}
```

Example:

```math
S_j=0.50
```

```math
r_{ij}=0.40
```

```math
S_i^{\mathrm{up}}=0.06
```

Then:

```math
f_{\mathrm{up}}
=
\frac{0.06}{0.50\times0.40}
```

```math
f_{\mathrm{up}}=0.30
```

For multiple observations:

```math
\hat{f}_{\mathrm{up}}
=
\frac{
\sum_e
\left(S_{j,e}r_{ij,e}\right)S_{i,e}^{\mathrm{up}}
}
{
\sum_e
\left(S_{j,e}r_{ij,e}\right)^2
}
```

subject to:

```math
0\leq f_{\mathrm{up}}\leq1
```

---

[← 12. Upstream Shock Propagation](12-upstream-shock-propagation.md) · [Contents](README.md) · [14. Combining Multiple Incoming Shocks →](14-combining-multiple-incoming-shocks.md)
