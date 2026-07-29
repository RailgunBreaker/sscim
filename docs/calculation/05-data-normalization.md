[SSCIM calculation specification](README.md) · section 5 of 49

# 5. Data Normalization

Different variables use different units. Before combining them, SSCIM should normalize them to a common scale.

## 5.1 Min-max normalization

For variable $x_i$:

```math
\tilde{x}_i
=
\frac{x_i-x_{\min}}{x_{\max}-x_{\min}}
```

This produces:

```math
\tilde{x}_i\in[0,1]
```

## 5.2 Reverse normalization

When lower raw values imply greater risk, use:

```math
\tilde{x}_i^{\mathrm{risk}}
=
1-
\frac{x_i-x_{\min}}{x_{\max}-x_{\min}}
```

Example: fewer substitute suppliers imply higher risk.

## 5.3 Winsorized normalization

To prevent extreme values from dominating, cap values at lower and upper percentiles before normalization.

Let:

```math
x_i^{*}
=
\min\left(
\max(x_i,Q_{0.05}),
Q_{0.95}
\right)
```

Then normalize $x_i^{*}$ instead of $x_i$.

---

[← 4. Model Parameters and Their Current Role](04-model-parameters-and-their-current-role.md) · [Contents](README.md) · [6. Event Decay →](06-event-decay.md)
