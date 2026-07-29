[SSCIM calculation specification](README.md) · section 7 of 49

# 7. Calculating the Event Half-Life

The current value $H=12$ is a prior. It can be calibrated using observed recovery data.

## 7.1 One-observation estimate

Starting from:

```math
S_t
=
S_0
\left(
\frac{1}{2}
\right)^{t/H}
```

Divide by $S_0$:

```math
\frac{S_t}{S_0}
=
\left(
\frac{1}{2}
\right)^{t/H}
```

Take natural logarithms:

```math
\ln\left(
\frac{S_t}{S_0}
\right)
=
\frac{t}{H}
\ln\left(
\frac{1}{2}
\right)
```

Since:

```math
\ln\left(
\frac{1}{2}
\right)
=
-\ln2
```

then:

```math
H
=
-\frac{t\ln2}
{\ln(S_t/S_0)}
```

Example:

```math
S_0=0.80
```

```math
S_{10}=0.40
```

Then:

```math
H
=
-\frac{10\ln2}
{\ln(0.40/0.80)}
```

```math
H
=
-\frac{10\ln2}
{\ln0.5}
```

```math
H=10
```

## 7.2 Multiple-observation estimate

Given observations $(t_n,S_n)$, choose:

```math
\hat{H}
=
\arg\min_H
\sum_{n=1}^{N}
\left[
S_n
-
S_0
\left(
\frac{1}{2}
\right)^{t_n/H}
\right]^2
```

This fits the half-life that best matches the historical recovery curve.

---

[← 6. Event Decay](06-event-decay.md) · [Contents](README.md) · [8. Substitutability and Effective Specificity →](08-substitutability-and-effective-specificity.md)
