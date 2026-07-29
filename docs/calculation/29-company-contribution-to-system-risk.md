[SSCIM calculation specification](README.md) · section 29 of 49

# 29. Company Contribution to System Risk

A company's contribution can be calculated by removing it from the system and measuring the change.

Let total system risk be:

```math
SYS(G)
```

where $G$ is the complete graph.

Remove company $i$:

```math
G_{-i}
```

Then contribution is:

```math
CONTRIB_i
=
SYS(G)-SYS(G_{-i})
```

Normalize:

```math
CONTRIB_i^{norm}
=
\frac{CONTRIB_i}
{\sum_jCONTRIB_j}
```

This measures how much system risk is attributable to the presence or failure of company $i$.

---

[← 28. Company Vulnerability](28-company-vulnerability.md) · [Contents](README.md) · [30. Systemic Criticality →](30-systemic-criticality.md)
