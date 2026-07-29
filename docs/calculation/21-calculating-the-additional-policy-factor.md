[SSCIM calculation specification](README.md) · section 21 of 49

# 21. Calculating the Additional-Policy Factor

Suppose realized policy cost is $Y_e$.

Model:

```math
\hat{Y}_e
=
\beta
\left[
p_{1,e}
+
\lambda
\sum_{k=2}^{n_e}p_{k,e}
\right]
```

Estimate:

```math
(\hat{\beta},\hat{\lambda})
=
\arg\min_{\beta,\lambda}
\sum_e
\left[
Y_e-
\beta
\left(
p_{1,e}
+
\lambda
\sum_{k=2}^{n_e}p_{k,e}
\right)
\right]^2
```

subject to:

```math
0\leq\lambda\leq1
```

Interpretation:

- $\lambda=1$: all policies are fully additive
- $\lambda=0$: extra policies add no additional effect
- $\lambda=0.40$: each additional policy contributes 40% of its original independent effect

---

[← 20. Policy Exposure](20-policy-exposure.md) · [Contents](README.md) · [22. Substitutability Risk Score →](22-substitutability-risk-score.md)
