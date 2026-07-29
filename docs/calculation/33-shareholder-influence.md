[SSCIM calculation specification](README.md) · section 33 of 49

# 33. Shareholder Influence

For shareholder $h$ and company $i$:

```math
DirectInfluence_{hi}
=
o_{hi}\times R_i
```

where $o_{hi}$ is ownership share.

Total portfolio influence:

```math
PortfolioInfluence_h
=
\sum_i o_{hi}R_i
```

A network-adjusted version is:

```math
PortfolioInfluence_h^{net}
=
\sum_i o_{hi}CRIT_i
```

---

[← 32. Country Risk](32-country-risk.md) · [Contents](README.md) · [34. Overall Semiconductor Supply-Chain Index →](34-overall-semiconductor-supply-chain-index.md)
