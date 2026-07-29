[SSCIM calculation specification](README.md) · section 16 of 49

# 16. Contribution Tolerance

# 16.1 Purpose

The model should stop following paths whose contribution becomes negligible.

Current value:

```math
\tau=10^{-4}
```

Propagation stops when:

```math
|C_p|<\tau
```

## 16.2 Example

If every edge transmits $0.55$:

```math
C_L=0.55^L
```

Then:

```math
C_{15}=0.55^{15}\approx0.000128
```

```math
C_{16}=0.55^{16}\approx0.000070
```

Because:

```math
0.000070<10^{-4}
```

the path is pruned after approximately 16 equal-transmission steps.

---

[← 15. Multi-Step Network Propagation](15-multi-step-network-propagation.md) · [Contents](README.md) · [17. Calculating the Contribution Tolerance →](17-calculating-the-contribution-tolerance.md)
