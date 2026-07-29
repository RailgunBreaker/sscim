[SSCIM calculation specification](README.md) · section 27 of 49

# 27. Calculating the Component Weights

Current weights are expert priors. They can later be calibrated.

## 27.1 Constrained regression

Let realized historical disruption be $Y_i$.

Let:

```math
X_i
=
\begin{bmatrix}
NI_i\\
GEO_i\\
POL_i\\
SUBST_i\\
SHOCK_i\\
MKT_i
\end{bmatrix}
```

Then:

```math
\hat{Y}_i=X_i^Tw
```

Estimate:

```math
\hat{w}
=
\arg\min_w
\sum_i
\left(
Y_i-X_i^Tw
\right)^2
```

subject to:

```math
w_k\geq0
```

and:

```math
\sum_kw_k=1
```

## 27.2 Expert pairwise comparison

Construct matrix:

```math
A
=
\begin{bmatrix}
1&a_{12}&\cdots&a_{1n}\\
1/a_{12}&1&\cdots&a_{2n}\\
\vdots&\vdots&\ddots&\vdots\\
1/a_{1n}&1/a_{2n}&\cdots&1
\end{bmatrix}
```

Find the principal eigenvector:

```math
Aw=\lambda_{max}w
```

Normalize:

```math
w_k^*
=
\frac{w_k}{\sum_jw_j}
```

---

[← 26. Structural Score Without Current Shock](26-structural-score-without-current-shock.md) · [Contents](README.md) · [28. Company Vulnerability →](28-company-vulnerability.md)
