[SSCIM calculation specification](README.md) · section 14 of 49

# 14. Combining Multiple Incoming Shocks

A company may receive shocks from several suppliers and events.

## 14.1 Simple additive aggregation

```math
S_j^{\mathrm{raw}}
=
\sum_i\Delta S_{j\leftarrow i}
```

This may exceed one.

## 14.2 Capped additive aggregation

```math
S_j
=
\min\left(1,\sum_i\Delta S_{j\leftarrow i}\right)
```

## 14.3 Probabilistic union aggregation

A smoother alternative is:

```math
S_j
=
1-
\prod_i
\left(1-\Delta S_{j\leftarrow i}\right)
```

Example:

```math
\Delta S_1=0.30
```

```math
\Delta S_2=0.20
```

Then:

```math
S_j
=
1-(1-0.30)(1-0.20)
```

```math
S_j
=
1-(0.70)(0.80)
```

```math
S_j=0.44
```

This avoids simple double counting.

---

[← 13. Calculating the Upstream Transmission Parameter](13-calculating-the-upstream-transmission-parameter.md) · [Contents](README.md) · [15. Multi-Step Network Propagation →](15-multi-step-network-propagation.md)
