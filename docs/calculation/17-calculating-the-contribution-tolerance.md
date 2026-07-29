[SSCIM calculation specification](README.md) · section 17 of 49

# 17. Calculating the Contribution Tolerance

The tolerance is chosen through convergence testing.

Let:

```math
R(\tau)
```

be the output vector calculated using tolerance $\tau$.

Use a very small benchmark tolerance $\tau_{ref}$, for example:

```math
\tau_{ref}=10^{-8}
```

Choose the largest efficient tolerance satisfying:

```math
\frac{
\left\|R(\tau)-R(\tau_{ref})\right\|_1
}
{
\left\|R(\tau_{ref})\right\|_1
}
<\epsilon
```

For example:

```math
\epsilon=0.001
```

means the approximation changes total results by less than $0.1\%$.

---

[← 16. Contribution Tolerance](16-contribution-tolerance.md) · [Contents](README.md) · [18. Network Importance →](18-network-importance.md)
