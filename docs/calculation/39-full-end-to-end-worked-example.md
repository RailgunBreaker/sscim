[SSCIM calculation specification](README.md) · section 39 of 49

# 39. Full End-to-End Worked Example

## Scenario

A fire affects ASML. The disruption propagates to TSMC and then NVIDIA.

```text
ASML
  ↓
TSMC
  ↓
NVIDIA
```

## Step 1: Direct event shock

Suppose:

```math
sev_e=0.90
```

```math
cov_{ASML,e}=0.80
```

Then:

```math
S_{ASML,0}
=
0.90\times0.80
```

```math
S_{ASML,0}=0.72
```

## Step 2: Time decay

Suppose the event is five days old.

```math
t=5
```

```math
H=12
```

Decay multiplier:

```math
D(5)
=
\left(
\frac{1}{2}
\right)^{5/12}
```

```math
D(5)\approx0.749
```

Current ASML shock:

```math
S_{ASML}
=
0.72\times0.749
```

```math
S_{ASML}\approx0.539
```

## Step 3: ASML to TSMC

Suppose:

```math
d_{ASML,TSMC}=0.85
```

```math
u_{ASML,TSMC}=0.10
```

```math
\phi=0.25
```

Specificity:

```math
q_{ASML,TSMC}
=
0.25+0.75(1-0.10)
```

```math
q_{ASML,TSMC}=0.925
```

Transmission:

```math
f_{\mathrm{down}}=0.55
```

TSMC shock:

```math
S_{TSMC}
=
0.539\times0.85\times0.925\times0.55
```

```math
S_{TSMC}\approx0.233
```

## Step 4: TSMC to NVIDIA

Suppose:

```math
d_{TSMC,NVIDIA}=0.90
```

```math
u_{TSMC,NVIDIA}=0.15
```

Specificity:

```math
q_{TSMC,NVIDIA}
=
0.25+0.75(1-0.15)
```

```math
q_{TSMC,NVIDIA}=0.8875
```

NVIDIA shock:

```math
S_{NVIDIA}
=
0.233\times0.90\times0.8875\times0.55
```

```math
S_{NVIDIA}\approx0.102
```

## Step 5: NVIDIA structural score

Suppose:

```math
NI=0.85
```

```math
GEO=0.70
```

```math
POL=0.45
```

```math
SUBST=0.75
```

```math
SHOCK=0.102
```

```math
MKT=0.80
```

Then:

```math
R_{NVIDIA}
=
0.25(0.85)
+
0.20(0.70)
+
0.20(0.45)
+
0.15(0.75)
+
0.10(0.102)
+
0.10(0.80)
```

```math
R_{NVIDIA}
=
0.2125+0.1400+0.0900+0.1125+0.0102+0.0800
```

```math
R_{NVIDIA}=0.6452
```

Final score:

```math
Score_{NVIDIA}=64.52
```

---

[← 38. Dataset Snapshot Date](38-dataset-snapshot-date.md) · [Contents](README.md) · [40. Parameter Provenance: Where the Current Numbers Actually Came From →](40-parameter-provenance-where-the-current-numbers-actually-came-from.md)
