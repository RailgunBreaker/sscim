[SSCIM calculation specification](README.md) · section 41 of 49

# 41. Calibration Framework

Let all unknown parameters be collected in:

```math
\theta
=
\left[
H,
f_{\mathrm{down}},
f_{\mathrm{up}},
\phi,
\lambda,
w_1,\ldots,w_K
\right]
```

For historical event $e$, let observed outcome be:

```math
Y_e
```

and model prediction be:

```math
\hat{Y}_e(\theta)
```

General calibration:

```math
\hat{\theta}
=
\arg\min_{\theta}
\sum_{e=1}^{E}
L\left(
Y_e,
\hat{Y}_e(\theta)
\right)
```

## 40.1 Mean squared error

```math
MSE(\theta)
=
\frac{1}{E}
\sum_{e=1}^{E}
\left(
Y_e-
\hat{Y}_e(\theta)
\right)^2
```

## 40.2 Mean absolute error

```math
MAE(\theta)
=
\frac{1}{E}
\sum_{e=1}^{E}
\left|
Y_e-
\hat{Y}_e(\theta)
\right|
```

## 40.3 Ranking loss

If the model is mainly used for ranking:

```math
L_{rank}
=
1-\rho_s
```

where $\rho_s$ is Spearman rank correlation between predicted and observed rankings.

## 40.4 Combined objective

```math
L_{total}
=
\alpha MSE
+
\beta MAE
+
\gamma(1-\rho_s)
```

with:

```math
\alpha+\beta+\gamma=1
```

---

[← 40. Parameter Provenance: Where the Current Numbers Actually Came From](40-parameter-provenance-where-the-current-numbers-actually-came-from.md) · [Contents](README.md) · [42. Historical Data Needed for Calibration →](42-historical-data-needed-for-calibration.md)
