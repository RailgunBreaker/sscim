[SSCIM calculation specification](README.md) · section 20 of 49

# 20. Policy Exposure

# 20.1 Single-policy exposure

For entity $i$ and policy $p$:

```math
p_{ip}
=
intensity_p
\times
scope_{ip}
\times
enforcement_p
\times
confidence_p
```

## 20.2 Multiple overlapping policies

Sort policies so $p_{i1}$ is the primary exposure.

Then:

```math
POL_i^{raw}
=
p_{i1}
+
\lambda
\sum_{k=2}^{n_i}p_{ik}
```

Current parameter:

```math
\lambda=0.40
```

If all policy scores equal one:

```math
POL_i^{raw}
=
1+0.40(n_i-1)
```

For three policies:

```math
POL_i^{raw}
=
1+0.40(3-1)
```

```math
POL_i^{raw}=1.80
```

## 20.3 Normalization

If the maximum expected number of policy instruments is $N_{max}$:

```math
POL_i
=
\frac{
1+\lambda(n_i-1)
}
{
1+\lambda(N_{max}-1)
}
```

For:

```math
n_i=3
```

```math
N_{max}=5
```

```math
\lambda=0.40
```

Then:

```math
POL_i
=
\frac{1.8}{2.6}
```

```math
POL_i=0.6923
```

---

[← 19. Geographic Risk](19-geographic-risk.md) · [Contents](README.md) · [21. Calculating the Additional-Policy Factor →](21-calculating-the-additional-policy-factor.md)
