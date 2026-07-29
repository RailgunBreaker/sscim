[SSCIM calculation specification](README.md) · section 8 of 49

# 8. Substitutability and Effective Specificity

# 8.1 Purpose

A supplier with many substitutes should transmit less disruption than a unique supplier. However, risk should not fall to zero because switching suppliers still requires time, qualification, and logistics.

## 8.2 Substitutability variable

Let:

```math
u_{ij}\in[0,1]
```

where:

- $u_{ij}=0$: no substitute
- $u_{ij}=1$: highly replaceable

## 8.3 Effective specificity

```math
q_{ij}
=
\phi+(1-\phi)(1-u_{ij})
```

Equivalent form:

```math
q_{ij}
=
1-(1-\phi)u_{ij}
```

With:

```math
\phi=0.25
```

boundary cases are:

```math
u_{ij}=0
\Rightarrow
q_{ij}=1
```

```math
u_{ij}=1
\Rightarrow
q_{ij}=0.25
```

## 8.4 Example

Suppose:

```math
u_{ij}=0.60
```

Then:

```math
q_{ij}
=
0.25+(1-0.25)(1-0.60)
```

```math
q_{ij}
=
0.25+0.75\times0.40
```

```math
q_{ij}=0.55
```

---

[← 7. Calculating the Event Half-Life](07-calculating-the-event-half-life.md) · [Contents](README.md) · [9. Calculating the Specificity Floor →](09-calculating-the-specificity-floor.md)
