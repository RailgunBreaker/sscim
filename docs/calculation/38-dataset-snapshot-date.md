[SSCIM calculation specification](README.md) · section 38 of 49

# 38. Dataset Snapshot Date

Let:

```math
T_{snapshot}
```

be the date on which the database is frozen.

Event age is:

```math
Age_e
=
T_{snapshot}-T_{event,e}
```

The current event effect is:

```math
S_e(T_{snapshot})
=
S_{0,e}
\left(
\frac{1}{2}
\right)^{Age_e/H}
```

This ensures reproducibility.

---

[← 37. Replacing the Fixed 30% Range with Statistical Uncertainty](37-replacing-the-fixed-30-range-with-statistical-uncertainty.md) · [Contents](README.md) · [39. Full End-to-End Worked Example →](39-full-end-to-end-worked-example.md)
