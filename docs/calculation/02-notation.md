[SSCIM calculation specification](README.md) · section 2 of 49

# 2. Notation

## 2.1 Entities

Let:

- $i,j,k$ denote companies, supply-chain stages, countries, or network nodes.
- $e$ denote an event.
- $t$ denote time in days.
- $p$ denote a network path.

## 2.2 Main symbols

| Symbol | Meaning | Typical range |
|---|---|---:|
| $S_{i,t}$ | Shock affecting entity $i$ at time $t$ | $[0,1]$ |
| $S_{i,0}$ | Initial shock before decay | $[0,1]$ |
| $d_{ij}$ | Downstream dependency of buyer $j$ on supplier $i$ | $[0,1]$ |
| $r_{ij}$ | Supplier $i$ revenue dependence on buyer $j$ | $[0,1]$ |
| $u_{ij}$ | Substitutability of supplier $i$ for buyer $j$ | $[0,1]$ |
| $q_{ij}$ | Effective specificity after substitutability adjustment | $[\phi,1]$ |
| $m_i$ | Company or country market share | $[0,1]$ |
| $g_{ic}$ | Share of entity $i$ exposed to country $c$ | $[0,1]$ |
| $sev_e$ | Event severity | $[0,1]$ |
| $cov_{ie}$ | Operational coverage of event $e$ for entity $i$ | $[0,1]$ |
| $f_{\mathrm{down}}$ | Downstream transmission coefficient | $[0,1]$ |
| $f_{\mathrm{up}}$ | Upstream transmission coefficient | $[0,1]$ |
| $H$ | Event half-life in days | $>0$ |
| $\phi$ | Specificity floor | $[0,1]$ |
| $\lambda$ | Additional-policy factor | $[0,1]$ |
| $\tau$ | Contribution tolerance | $>0$ |
| $w_k$ | Weight of risk component $k$ | $[0,1]$ |

---

[← 1. Core Idea](01-core-idea.md) · [Contents](README.md) · [3. Required Data →](03-required-data.md)
