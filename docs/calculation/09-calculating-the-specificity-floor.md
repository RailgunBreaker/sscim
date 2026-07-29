[SSCIM calculation specification](README.md) · section 9 of 49

# 9. Calculating the Specificity Floor

The specificity floor can be estimated from historical supplier-switching cases.

Let:

```math
Y_e
=
\frac{\text{observed disruption after substitution}}
{\text{counterfactual disruption without substitution}}
```

Predicted residual disruption is:

```math
\hat{Y}_e
=
\phi+(1-\phi)(1-u_e)
```

Estimate:

```math
\hat{\phi}
=
\arg\min_{\phi\in[0,1]}
\sum_e
\left[
Y_e-
\left(
\phi+(1-\phi)(1-u_e)
\right)
\right]^2
```

Interpretation:

- low $\phi$: substitution removes most disruption
- high $\phi$: substantial friction remains even with substitutes

---

[← 8. Substitutability and Effective Specificity](08-substitutability-and-effective-specificity.md) · [Contents](README.md) · [10. Downstream Shock Propagation →](10-downstream-shock-propagation.md)
