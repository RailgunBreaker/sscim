[SSCIM calculation specification](README.md) · section 18 of 49

# 18. Network Importance

Network importance measures whether an entity occupies a structurally critical position.

Possible components include degree centrality, betweenness centrality, eigenvector centrality, PageRank, and flow centrality.

## 18.1 Degree centrality

For node $i$:

```math
DC_i
=
\frac{deg(i)}{N-1}
```

## 18.2 Weighted degree centrality

```math
WDC_i
=
\sum_j a_{ij}w_{ij}
```

where $a_{ij}$ indicates whether an edge exists.

## 18.3 Betweenness centrality

```math
BC_i
=
\sum_{s\neq i\neq t}
\frac{\sigma_{st}(i)}{\sigma_{st}}
```

where:

- $\sigma_{st}$ is the number of shortest paths from $s$ to $t$
- $\sigma_{st}(i)$ is the number passing through $i$

## 18.4 Eigenvector centrality

```math
x_i
=
\frac{1}{\lambda}
\sum_jA_{ij}x_j
```

or:

```math
Ax=\lambda x
```

## 18.5 Composite network importance

After normalization:

```math
NI_i
=
\alpha_1\widetilde{DC}_i
+
\alpha_2\widetilde{BC}_i
+
\alpha_3\widetilde{EC}_i
```

with:

```math
\alpha_1+\alpha_2+\alpha_3=1
```

---

[← 17. Calculating the Contribution Tolerance](17-calculating-the-contribution-tolerance.md) · [Contents](README.md) · [19. Geographic Risk →](19-geographic-risk.md)
