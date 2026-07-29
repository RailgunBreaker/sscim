[SSCIM calculation specification](README.md) · section 6 of 49

# 6. Event Decay

# 6.1 Purpose

Older events should gradually lose influence.

## 6.2 Decay equation

```math
S_{i,e,t}
=
S_{i,e,0}
\left(
\frac{1}{2}
\right)^{t/H}
```

Equivalent exponential form:

```math
S_{i,e,t}
=
S_{i,e,0}e^{-kt}
```

where:

```math
k
=
\frac{\ln2}{H}
```

## 6.3 Current parameter use

For:

```math
H=12
```

we obtain:

| Days after event | Remaining multiplier |
|---:|---:|
| 0 | 1.000 |
| 6 | 0.707 |
| 12 | 0.500 |
| 24 | 0.250 |
| 36 | 0.125 |

## 6.4 Example

Initial shock:

```math
S_0=0.80
```

Event age:

```math
t=5
```

Half-life:

```math
H=12
```

Then:

```math
S_5
=
0.80
\left(
\frac{1}{2}
\right)^{5/12}
```

```math
S_5
\approx
0.80\times0.749
```

```math
S_5
\approx
0.599
```

---

[← 5. Data Normalization](05-data-normalization.md) · [Contents](README.md) · [7. Calculating the Event Half-Life →](07-calculating-the-event-half-life.md)
