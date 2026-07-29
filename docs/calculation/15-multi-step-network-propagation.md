[SSCIM calculation specification](README.md) · section 15 of 49

# 15. Multi-Step Network Propagation

For a path:

```math
p=(v_0,v_1,\ldots,v_L)
```

the path contribution is:

```math
C_p
=
S_{v_0}
\prod_{\ell=1}^{L}
T_{v_{\ell-1},v_{\ell}}
```

For a downstream edge:

```math
T_{ij}^{\mathrm{down}}
=
d_{ij}q_{ij}f_{\mathrm{down}}
```

For an upstream edge:

```math
T_{ji}^{\mathrm{up}}
=
r_{ij}f_{\mathrm{up}}
```

Total shock at node $j$ is aggregated over all valid paths ending at $j$:

```math
S_j
=
\mathcal{A}
\left(
\{C_p:p\rightarrow j\}
\right)
```

where $\mathcal{A}$ is the selected aggregation rule.

---

[← 14. Combining Multiple Incoming Shocks](14-combining-multiple-incoming-shocks.md) · [Contents](README.md) · [16. Contribution Tolerance →](16-contribution-tolerance.md)
