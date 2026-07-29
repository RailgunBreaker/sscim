[SSCIM calculation specification](README.md) · section 32 of 49

# 32. Country Risk

Let companies or facilities exposed to country $c$ be indexed by $i$.

A capacity-weighted country risk is:

```math
R_c
=
\frac{
\sum_i cap_{ic}R_i
}
{
\sum_i cap_{ic}
}
```

where $cap_{ic}$ is entity $i$'s relevant capacity in country $c$.

A systemic-country score may include global share:

```math
SYSCOUNTRY_c
=
R_c\times GlobalShare_c
```

---

[← 31. Stage-Level Risk](31-stage-level-risk.md) · [Contents](README.md) · [33. Shareholder Influence →](33-shareholder-influence.md)
