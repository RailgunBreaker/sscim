[SSCIM calculation specification](README.md) · section 47 of 49

# 47. Validation Tests

## 46.1 Range tests

All normalized variables should satisfy:

```math
0\leq x_i\leq1
```

## 46.2 Weight-sum test

```math
\sum_kw_k=1
```

## 46.3 Market-share test

Within each stage:

```math
\sum_{i\in s}\tilde{m}_i=1
```

## 46.4 Geographic-share test

For each entity:

```math
\sum_cg_{ic}=1
```

## 46.5 Monotonicity tests

Holding everything else constant:

```math
sev_e\uparrow
\Rightarrow
S_i\uparrow
```

```math
d_{ij}\uparrow
\Rightarrow
\Delta S_j\uparrow
```

```math
u_{ij}\uparrow
\Rightarrow
q_{ij}\downarrow
```

```math
H\uparrow
\Rightarrow
\text{slower decay}
```

## 46.6 Zero-shock test

If:

```math
S_{i,0}=0
```

then all propagated contributions should be:

```math
0
```

---

[← 46. Minimum Viable Product Data Requirements](46-minimum-viable-product-data-requirements.md) · [Contents](README.md) · [48. Final Interpretation →](48-final-interpretation.md)
