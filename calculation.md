# SSCIM Complete Calculation Specification

## Data, Variables, Parameters, Equations, Calibration, and Outputs

**Project:** Semiconductor Supply Chain Intelligence Model (SSCIM)  
**Purpose:** Explain exactly what data the model needs, how each variable and parameter is used, how the calculations work mathematically, and what outputs are produced.

---

# 1. Core Idea

SSCIM converts real-world semiconductor supply-chain data into structured risk scores.

The complete pipeline is:

```text
Raw data
  ↓
Data cleaning and normalization
  ↓
Supply-chain graph construction
  ↓
Structural-risk calculation
  ↓
Event-shock calculation
  ↓
Shock propagation through the graph
  ↓
Aggregation by company, stage, country, and shareholder
  ↓
Rankings, indices, trends, and sensitivity results
```

The model combines two fundamentally different input types.

## 1.1 Observed data

Observed data come from the real world.

Examples:

- TSMC foundry market share
- ASML's relationship with leading-edge fabs
- Taiwan's share of advanced-node fabrication
- a factory fire date
- an earthquake severity estimate
- a company's customer concentration
- a country's export-control exposure

Observed data may change when the real world changes.

## 1.2 Model parameters

Model parameters tell the algorithm how to process observed data.

Examples:

- downstream transmission coefficient
- upstream transmission coefficient
- event half-life
- minimum specificity floor
- policy-overlap factor
- structural-score weights
- numerical pruning threshold

These parameters are not automatically facts. In the current model, many are declared priors. Later, they should be calibrated using historical disruptions.

The general model is:

```math
\text{Output}
=
F(\text{Observed Data},\text{Model Parameters})
```

---

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

# 3. Required Data

# 3.1 Company master data

Each company should have at least:

| Variable | Description | Example |
|---|---|---|
| `company_id` | Unique company identifier | `TSMC` |
| `company_name` | Company name | Taiwan Semiconductor Manufacturing Co. |
| `headquarters_country` | HQ country | Taiwan |
| `operating_countries` | Countries with relevant facilities | Taiwan, USA, Japan |
| `supply_chain_stage` | Main stage | Foundry |
| `market_share` | Global or stage-specific market share | 0.62 |
| `annual_revenue` | Revenue used for scaling or validation | USD value |
| `production_capacity` | Capacity measure if available | wafers/month |
| `technology_node` | Technology category | 3 nm, 5 nm |
| `listed_status` | Public/private | Public |
| `ticker` | Market ticker | 2330.TW |

## 3.1.1 Market-share normalization

If company shares in a stage do not sum to one because of missing companies, normalize them as:

```math
\tilde{m}_i
=
\frac{m_i}{\sum_{j\in s}m_j}
```

where $s$ is the relevant supply-chain stage.

Example:

```text
Observed shares:
Company A = 0.50
Company B = 0.25
Company C = 0.15
Total observed = 0.90
```

Then:

```math
\tilde{m}_A
=
\frac{0.50}{0.90}
=
0.556
```

```math
\tilde{m}_B
=
\frac{0.25}{0.90}
=
0.278
```

```math
\tilde{m}_C
=
\frac{0.15}{0.90}
=
0.167
```

---

# 3.2 Supply-chain edge data

Each supplier-customer relationship should contain:

| Variable | Description | Example |
|---|---|---|
| `supplier_id` | Upstream entity | ASML |
| `customer_id` | Downstream entity | TSMC |
| `input_category` | Product or service supplied | EUV tools |
| `dependency_share` | Buyer dependence on this supplier | 0.85 |
| `revenue_share` | Supplier revenue dependence on buyer | 0.12 |
| `substitutability` | Ease of replacing supplier | 0.10 |
| `lead_time_days` | Replacement or delivery lead time | 365 |
| `qualification_time_days` | Time needed to approve substitute | 180 |
| `relationship_confidence` | Confidence in the relationship data | 0.80 |
| `source_date` | Date of source | YYYY-MM-DD |

## 3.2.1 Dependency share

The downstream dependency variable is:

```math
d_{ij}
=
\frac{\text{input volume purchased by buyer }j\text{ from supplier }i}
{\text{total input volume required by buyer }j}
```

If exact purchase volume is unavailable, dependency may be proxied using:

- supplier concentration
- capacity share
- disclosed customer concentration
- technology exclusivity
- analyst estimates

## 3.2.2 Revenue dependence

The upstream revenue-dependence variable is:

```math
r_{ij}
=
\frac{\text{supplier }i\text{ revenue generated from buyer }j}
{\text{total revenue of supplier }i}
```

---

# 3.3 Country and geographic exposure data

Required variables include:

| Variable | Description |
|---|---|
| `country_id` | Country code |
| `entity_id` | Company or stage |
| `production_share` | Share of entity production in country |
| `revenue_share` | Share of revenue associated with country |
| `supplier_share` | Share of critical suppliers in country |
| `facility_count` | Number of relevant facilities |
| `capacity_share` | Share of production capacity |
| `country_risk_score` | External political or operational risk score |

For entity $i$ and country $c$:

```math
\sum_c g_{ic}=1
```

where $g_{ic}$ is the share of entity $i$ exposed to country $c$.

## 3.3.1 Geographic concentration using HHI

A standard concentration measure is the Herfindahl-Hirschman Index:

```math
HHI_i
=
\sum_c g_{ic}^2
```

Properties:

- fully diversified across many countries: lower $HHI_i$
- concentrated in one country: $HHI_i=1$

Example:

```text
Taiwan = 0.70
China = 0.20
Other = 0.10
```

Then:

```math
HHI
=
0.70^2+0.20^2+0.10^2
```

```math
HHI
=
0.49+0.04+0.01
=
0.54
```

---

# 3.4 Event data

Each event should contain:

| Variable | Description | Example |
|---|---|---|
| `event_id` | Unique event ID | TW_EQ_2026_01 |
| `event_type` | Earthquake, fire, policy, strike, flood | Earthquake |
| `start_date` | Event start date | 2026-07-01 |
| `end_date` | Event end or resolution date | optional |
| `country` | Affected country | Taiwan |
| `company_id` | Directly affected company | TSMC |
| `stage_id` | Affected stage | Foundry |
| `severity` | Event severity | 0.80 |
| `coverage` | Share of operations affected | 0.70 |
| `confidence` | Confidence in estimate | 0.90 |
| `source` | Data source | official notice |

## 3.4.1 Initial event shock

The simplest initial shock is:

```math
S_{i,e,0}
=
sev_e\times cov_{ie}
```

If data confidence is explicitly included:

```math
S_{i,e,0}^{\mathrm{adj}}
=
sev_e\times cov_{ie}\times conf_e
```

Example:

```math
sev_e=0.90
```

```math
cov_{ie}=0.80
```

```math
conf_e=0.90
```

Then:

```math
S_{i,e,0}^{\mathrm{adj}}
=
0.90\times0.80\times0.90
=
0.648
```

---

# 3.5 Policy data

Each policy record should contain:

| Variable | Description |
|---|---|
| `policy_id` | Unique identifier |
| `policy_type` | Export control, tariff, investment restriction, subsidy condition |
| `issuing_country` | Jurisdiction creating policy |
| `target_country` | Target country |
| `target_company` | Target company, if applicable |
| `target_stage` | Affected supply-chain stage |
| `intensity` | Normalized policy intensity |
| `start_date` | Effective date |
| `end_date` | End date, if applicable |
| `scope` | Share of business affected |
| `enforcement_probability` | Probability of effective enforcement |
| `confidence` | Data confidence |

A basic policy exposure for entity $i$ under policy $p$ may be:

```math
p_{ip}
=
intensity_p
\times
scope_{ip}
\times
enforcement_p
\times
confidence_p
```

---

# 3.6 Shareholder and capital data

Required variables include:

| Variable | Description |
|---|---|
| `investor_id` | Shareholder identifier |
| `company_id` | Investee company |
| `ownership_share` | Percentage ownership |
| `voting_share` | Percentage voting control |
| `investor_country` | Country of investor |
| `investor_type` | Government, institution, strategic, retail |
| `date` | Ownership snapshot date |

Ownership concentration can be calculated as:

```math
OWNHHI_i
=
\sum_h o_{hi}^2
```

where $o_{hi}$ is shareholder $h$'s ownership share in company $i$.

---

# 4. Model Parameters and Their Current Role

| Parameter | Symbol | Current prior | Role |
|---|---:|---:|---|
| Downstream transmission | $f_{\mathrm{down}}$ | 0.55 | Supplier shock transmitted to buyer |
| Upstream transmission | $f_{\mathrm{up}}$ | 0.30 | Buyer demand shock transmitted to supplier |
| Event half-life | $H$ | 12 days | Speed of event decay |
| Specificity floor | $\phi$ | 0.25 | Minimum remaining dependency despite substitutability |
| Additional-policy factor | $\lambda$ | 0.40 | Reduced marginal effect of overlapping policies |
| Contribution tolerance | $\tau$ | $10^{-4}$ | Stops propagation of negligible paths |
| Sensitivity range | $\delta$ | $\pm30\%$ | Tests robustness of prior choices |
| Network weight | $w_{NI}$ | 0.25 | Importance of network centrality |
| Geographic weight | $w_{GEO}$ | 0.20 | Importance of geographic concentration |
| Policy weight | $w_{POL}$ | 0.20 | Importance of policy exposure |
| Substitutability weight | $w_{SUBST}$ | 0.15 | Importance of replacement difficulty |
| Shock weight | $w_{SHOCK}$ | 0.10 | Importance of current event impact |
| Market weight | $w_{MKT}$ | 0.10 | Importance of market dominance |

The current values are best understood as transparent engineering priors, not proven universal constants.

---

# 5. Data Normalization

Different variables use different units. Before combining them, SSCIM should normalize them to a common scale.

## 5.1 Min-max normalization

For variable $x_i$:

```math
\tilde{x}_i
=
\frac{x_i-x_{\min}}{x_{\max}-x_{\min}}
```

This produces:

```math
\tilde{x}_i\in[0,1]
```

## 5.2 Reverse normalization

When lower raw values imply greater risk, use:

```math
\tilde{x}_i^{\mathrm{risk}}
=
1-
\frac{x_i-x_{\min}}{x_{\max}-x_{\min}}
```

Example: fewer substitute suppliers imply higher risk.

## 5.3 Winsorized normalization

To prevent extreme values from dominating, cap values at lower and upper percentiles before normalization.

Let:

```math
x_i^{*}
=
\min\left(
\max(x_i,Q_{0.05}),
Q_{0.95}
\right)
```

Then normalize $x_i^{*}$ instead of $x_i$.

---

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

# 9. Calculating the Specificity Floor

The specificity floor can be estimated from historical supplier-switching cases.

Let:

```math
Y_e
=
\frac{\text{observed disruption after substitution}}
{\text{counterfactual disruption without substitution}}
```

Predicted residual disruption is:

```math
\hat{Y}_e
=
\phi+(1-\phi)(1-u_e)
```

Estimate:

```math
\hat{\phi}
=
\arg\min_{\phi\in[0,1]}
\sum_e
\left[
Y_e-
\left(
\phi+(1-\phi)(1-u_e)
\right)
\right]^2
```

Interpretation:

- low $\phi$: substitution removes most disruption
- high $\phi$: substantial friction remains even with substitutes

---

# 10. Downstream Shock Propagation

# 10.1 Purpose

Estimate how a supplier-side disruption affects downstream customers.

## 10.2 Edge-level equation

For supplier $i$ and buyer $j$:

```math
\Delta S_{j\leftarrow i}^{\mathrm{down}}
=
S_i
\times
d_{ij}
\times
q_{ij}
\times
f_{\mathrm{down}}
```

where:

- $S_i$ is shock at supplier $i$
- $d_{ij}$ is buyer dependence on supplier $i$
- $q_{ij}$ is effective specificity
- $f_{\mathrm{down}}$ is base downstream transmission

## 10.3 Current parameter

```math
f_{\mathrm{down}}=0.55
```

## 10.4 Worked example: ASML to TSMC

Suppose:

```math
S_{ASML}=0.90
```

```math
d_{ASML,TSMC}=0.80
```

```math
u_{ASML,TSMC}=0.10
```

```math
\phi=0.25
```

First calculate specificity:

```math
q_{ASML,TSMC}
=
0.25+0.75(1-0.10)
```

```math
q_{ASML,TSMC}=0.925
```

Then:

```math
\Delta S_{TSMC\leftarrow ASML}
=
0.90\times0.80\times0.925\times0.55
```

```math
\Delta S_{TSMC\leftarrow ASML}
=
0.3663
```

The propagated shock is approximately:

```math
36.63\%
```

---

# 11. Calculating the Downstream Transmission Parameter

From one historical supplier-customer event:

```math
S_j
=
S_i d_{ij}q_{ij}f_{\mathrm{down}}
```

Rearrange:

```math
f_{\mathrm{down}}
=
\frac{S_j}{S_i d_{ij}q_{ij}}
```

Example:

```math
S_i=0.80
```

```math
S_j=0.30
```

```math
d_{ij}=0.75
```

```math
q_{ij}=0.90
```

Then:

```math
f_{\mathrm{down}}
=
\frac{0.30}
{0.80\times0.75\times0.90}
```

```math
f_{\mathrm{down}}
=
0.556
```

## 11.1 Multiple-event calibration

Define:

```math
X_e
=
S_{i,e}d_{ij,e}q_{ij,e}
```

```math
Y_e
=
S_{j,e}
```

Then estimate:

```math
\hat{f}_{\mathrm{down}}
=
\frac{\sum_eX_eY_e}
{\sum_eX_e^2}
```

or explicitly:

```math
\hat{f}_{\mathrm{down}}
=
\frac{
\sum_e
\left(S_{i,e}d_{ij,e}q_{ij,e}\right)S_{j,e}
}
{
\sum_e
\left(S_{i,e}d_{ij,e}q_{ij,e}\right)^2
}
```

subject to:

```math
0\leq f_{\mathrm{down}}\leq1
```

---

# 12. Upstream Shock Propagation

# 12.1 Purpose

Estimate how a buyer-side demand reduction affects upstream suppliers.

## 12.2 Equation

For buyer $j$ and supplier $i$:

```math
\Delta S_{i\leftarrow j}^{\mathrm{up}}
=
S_j
\times
r_{ij}
\times
f_{\mathrm{up}}
```

where:

- $S_j$ is buyer demand shock
- $r_{ij}$ is supplier revenue dependence on buyer
- $f_{\mathrm{up}}$ is upstream transmission coefficient

## 12.3 Current parameter

```math
f_{\mathrm{up}}=0.30
```

## 12.4 Example: Apple to TSMC

Suppose Apple reduces relevant orders by:

```math
S_{Apple}=0.50
```

TSMC derives:

```math
r_{TSMC,Apple}=0.25
```

of relevant revenue from Apple.

Then:

```math
\Delta S_{TSMC\leftarrow Apple}^{\mathrm{up}}
=
0.50\times0.25\times0.30
```

```math
\Delta S_{TSMC\leftarrow Apple}^{\mathrm{up}}
=
0.0375
```

The upstream effect is:

```math
3.75\%
```

---

# 13. Calculating the Upstream Transmission Parameter

From one historical case:

```math
f_{\mathrm{up}}
=
\frac{S_i^{\mathrm{up}}}
{S_jr_{ij}}
```

Example:

```math
S_j=0.50
```

```math
r_{ij}=0.40
```

```math
S_i^{\mathrm{up}}=0.06
```

Then:

```math
f_{\mathrm{up}}
=
\frac{0.06}{0.50\times0.40}
```

```math
f_{\mathrm{up}}=0.30
```

For multiple observations:

```math
\hat{f}_{\mathrm{up}}
=
\frac{
\sum_e
\left(S_{j,e}r_{ij,e}\right)S_{i,e}^{\mathrm{up}}
}
{
\sum_e
\left(S_{j,e}r_{ij,e}\right)^2
}
```

subject to:

```math
0\leq f_{\mathrm{up}}\leq1
```

---

# 14. Combining Multiple Incoming Shocks

A company may receive shocks from several suppliers and events.

## 14.1 Simple additive aggregation

```math
S_j^{\mathrm{raw}}
=
\sum_i\Delta S_{j\leftarrow i}
```

This may exceed one.

## 14.2 Capped additive aggregation

```math
S_j
=
\min\left(1,\sum_i\Delta S_{j\leftarrow i}\right)
```

## 14.3 Probabilistic union aggregation

A smoother alternative is:

```math
S_j
=
1-
\prod_i
\left(1-\Delta S_{j\leftarrow i}\right)
```

Example:

```math
\Delta S_1=0.30
```

```math
\Delta S_2=0.20
```

Then:

```math
S_j
=
1-(1-0.30)(1-0.20)
```

```math
S_j
=
1-(0.70)(0.80)
```

```math
S_j=0.44
```

This avoids simple double counting.

---

# 15. Multi-Step Network Propagation

For a path:

```math
p=(v_0,v_1,\ldots,v_L)
```

the path contribution is:

```math
C_p
=
S_{v_0}
\prod_{\ell=1}^{L}
T_{v_{\ell-1},v_{\ell}}
```

For a downstream edge:

```math
T_{ij}^{\mathrm{down}}
=
d_{ij}q_{ij}f_{\mathrm{down}}
```

For an upstream edge:

```math
T_{ji}^{\mathrm{up}}
=
r_{ij}f_{\mathrm{up}}
```

Total shock at node $j$ is aggregated over all valid paths ending at $j$:

```math
S_j
=
\mathcal{A}
\left(
\{C_p:p\rightarrow j\}
\right)
```

where $\mathcal{A}$ is the selected aggregation rule.

---

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

# 17. Calculating the Contribution Tolerance

The tolerance is chosen through convergence testing.

Let:

```math
R(\tau)
```

be the output vector calculated using tolerance $\tau$.

Use a very small benchmark tolerance $\tau_{ref}$, for example:

```math
\tau_{ref}=10^{-8}
```

Choose the largest efficient tolerance satisfying:

```math
\frac{
\left\|R(\tau)-R(\tau_{ref})\right\|_1
}
{
\left\|R(\tau_{ref})\right\|_1
}
<\epsilon
```

For example:

```math
\epsilon=0.001
```

means the approximation changes total results by less than $0.1\%$.

---

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

# 19. Geographic Risk

A geographic-risk score can combine concentration and external country risk.

## 19.1 Concentration-only measure

```math
GEO_i^{conc}
=
\sum_cg_{ic}^2
```

## 19.2 Exposure-weighted country risk

Let $CR_c$ be normalized country risk.

```math
GEO_i^{country}
=
\sum_cg_{ic}CR_c
```

## 19.3 Combined geographic score

```math
GEO_i
=
\eta\,GEO_i^{conc}
+
(1-\eta)GEO_i^{country}
```

where:

```math
0\leq\eta\leq1
```

Example:

```math
GEO_i^{conc}=0.54
```

```math
GEO_i^{country}=0.70
```

```math
\eta=0.50
```

Then:

```math
GEO_i
=
0.50\times0.54
+
0.50\times0.70
```

```math
GEO_i=0.62
```

---

# 20. Policy Exposure

# 20.1 Single-policy exposure

For entity $i$ and policy $p$:

```math
p_{ip}
=
intensity_p
\times
scope_{ip}
\times
enforcement_p
\times
confidence_p
```

## 20.2 Multiple overlapping policies

Sort policies so $p_{i1}$ is the primary exposure.

Then:

```math
POL_i^{raw}
=
p_{i1}
+
\lambda
\sum_{k=2}^{n_i}p_{ik}
```

Current parameter:

```math
\lambda=0.40
```

If all policy scores equal one:

```math
POL_i^{raw}
=
1+0.40(n_i-1)
```

For three policies:

```math
POL_i^{raw}
=
1+0.40(3-1)
```

```math
POL_i^{raw}=1.80
```

## 20.3 Normalization

If the maximum expected number of policy instruments is $N_{max}$:

```math
POL_i
=
\frac{
1+\lambda(n_i-1)
}
{
1+\lambda(N_{max}-1)
}
```

For:

```math
n_i=3
```

```math
N_{max}=5
```

```math
\lambda=0.40
```

Then:

```math
POL_i
=
\frac{1.8}{2.6}
```

```math
POL_i=0.6923
```

---

# 21. Calculating the Additional-Policy Factor

Suppose realized policy cost is $Y_e$.

Model:

```math
\hat{Y}_e
=
\beta
\left[
p_{1,e}
+
\lambda
\sum_{k=2}^{n_e}p_{k,e}
\right]
```

Estimate:

```math
(\hat{\beta},\hat{\lambda})
=
\arg\min_{\beta,\lambda}
\sum_e
\left[
Y_e-
\beta
\left(
p_{1,e}
+
\lambda
\sum_{k=2}^{n_e}p_{k,e}
\right)
\right]^2
```

subject to:

```math
0\leq\lambda\leq1
```

Interpretation:

- $\lambda=1$: all policies are fully additive
- $\lambda=0$: extra policies add no additional effect
- $\lambda=0.40$: each additional policy contributes 40% of its original independent effect

---

# 22. Substitutability Risk Score

For company or stage $i$, calculate average effective specificity across critical inputs.

Weighted formulation:

```math
SUBST_i
=
\frac{
\sum_j\omega_{ij}q_{ij}
}
{
\sum_j\omega_{ij}
}
```

where $\omega_{ij}$ may be purchase share, dependency share, or criticality weight.

If $q_{ij}$ is already a risk score, higher $SUBST_i$ means lower substitutability and higher risk.

---

# 23. Market Dominance Score

The simplest market score is normalized market share:

```math
MKT_i=m_i
```

A nonlinear version may emphasize dominant firms:

```math
MKT_i=m_i^{\gamma}
```

where:

```math
0<\gamma<1
```

compresses differences, while:

```math
\gamma>1
```

emphasizes the largest firms.

For a stage-level concentration score:

```math
MKT_s^{conc}
=
\sum_{i\in s}m_i^2
```

---

# 24. Current Shock Score

An entity may have multiple direct and propagated shocks.

A capped additive version is:

```math
SHOCK_i
=
\min\left(
1,
\sum_eS_{i,e,t}
+
\sum_j\Delta S_{i\leftarrow j}
\right)
```

A probabilistic-union version is:

```math
SHOCK_i
=
1-
\prod_h(1-z_{ih})
```

where each $z_{ih}$ is one direct or propagated shock contribution.

---

# 25. Structural Risk Score

The current weighted score is:

```math
R_i
=
0.25NI_i
+
0.20GEO_i
+
0.20POL_i
+
0.15SUBST_i
+
0.10SHOCK_i
+
0.10MKT_i
```

The weights satisfy:

```math
0.25+0.20+0.20+0.15+0.10+0.10=1
```

## 25.1 Worked example

Suppose:

```math
NI_i=0.90
```

```math
GEO_i=0.80
```

```math
POL_i=0.70
```

```math
SUBST_i=0.50
```

```math
SHOCK_i=0.40
```

```math
MKT_i=0.60
```

Then:

```math
R_i
=
0.25(0.90)
+
0.20(0.80)
+
0.20(0.70)
+
0.15(0.50)
+
0.10(0.40)
+
0.10(0.60)
```

```math
R_i
=
0.225+0.160+0.140+0.075+0.040+0.060
```

```math
R_i=0.700
```

On a 0-100 scale:

```math
Score_i=100R_i=70
```

---

# 26. Structural Score Without Current Shock

If current event shock is excluded, remaining raw weights sum to:

```math
0.25+0.20+0.20+0.15+0.10=0.90
```

Renormalize each remaining weight:

```math
w_k^*
=
\frac{w_k}{0.90}
```

Therefore:

```math
w_{NI}^*=0.2778
```

```math
w_{GEO}^*=0.2222
```

```math
w_{POL}^*=0.2222
```

```math
w_{SUBST}^*=0.1667
```

```math
w_{MKT}^*=0.1111
```

The structural-only score becomes:

```math
R_i^{structural}
=
0.2778NI_i
+
0.2222GEO_i
+
0.2222POL_i
+
0.1667SUBST_i
+
0.1111MKT_i
```

---

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

# 28. Company Vulnerability

Company vulnerability may combine structural risk and current shock.

A simple formulation is already the weighted score:

```math
VULN_i=R_i
```

A multiplicative alternative is:

```math
VULN_i
=
1-
(1-R_i^{structural})(1-SHOCK_i)
```

Example:

```math
R_i^{structural}=0.60
```

```math
SHOCK_i=0.40
```

Then:

```math
VULN_i
=
1-(1-0.60)(1-0.40)
```

```math
VULN_i
=
1-(0.40)(0.60)
```

```math
VULN_i=0.76
```

---

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

# 30. Systemic Criticality

A possible systemic criticality score combines market share, network importance, and propagated effect.

```math
CRIT_i
=
\rho_1MKT_i
+
\rho_2NI_i
+
\rho_3PROP_i
```

where:

```math
\rho_1+\rho_2+\rho_3=1
```

$PROP_i$ may be defined as total downstream shock generated by a unit shock at $i$:

```math
PROP_i
=
\sum_{j\neq i}S_j
\quad\text{given}\quad
S_i=1
```

---

# 31. Stage-Level Risk

Let stage $s$ contain companies $i\in s$.

A market-share-weighted stage risk is:

```math
R_s
=
\sum_{i\in s}
\tilde{m}_{i|s}R_i
```

where:

```math
\tilde{m}_{i|s}
=
\frac{m_i}{\sum_{j\in s}m_j}
```

A concentration-adjusted version is:

```math
R_s^{adj}
=
R_s\left(1+\kappa HHI_s\right)
```

where:

```math
HHI_s=\sum_{i\in s}m_i^2
```

and $\kappa$ controls concentration amplification.

---

# 32. Country Risk

Let companies or facilities exposed to country $c$ be indexed by $i$.

A capacity-weighted country risk is:

```math
R_c
=
\frac{
\sum_i cap_{ic}R_i
}
{
\sum_i cap_{ic}
}
```

where $cap_{ic}$ is entity $i$'s relevant capacity in country $c$.

A systemic-country score may include global share:

```math
SYSCOUNTRY_c
=
R_c\times GlobalShare_c
```

---

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

# 34. Overall Semiconductor Supply-Chain Index

Let stage weights be $\pi_s$.

```math
\sum_s\pi_s=1
```

Then:

```math
SSCIMIndex
=
100
\sum_s\pi_sR_s
```

A company-based version is:

```math
SSCIMIndex
=
100
\sum_i\omega_iR_i
```

where $\omega_i$ may be market-share, revenue, capacity, or systemic-importance weights.

---

# 35. Historical Trend Calculation

For date $t$:

```math
Index_t
=
100
\sum_i\omega_{i,t}R_{i,t}
```

Daily change:

```math
\Delta Index_t
=
Index_t-Index_{t-1}
```

Percentage change:

```math
Growth_t
=
\frac{Index_t-Index_{t-1}}
{Index_{t-1}}
```

Rolling average:

```math
MA_t^{(n)}
=
\frac{1}{n}
\sum_{k=0}^{n-1}Index_{t-k}
```

---

# 36. Sensitivity Analysis

Current scenario range:

```math
\delta=30\%
```

For parameter $\theta$:

```math
\theta_{low}
=
\theta(1-0.30)
```

```math
\theta_{high}
=
\theta(1+0.30)
```

Example:

```math
f_{\mathrm{down}}=0.55
```

Then:

```math
f_{\mathrm{down}}^{low}
=
0.55\times0.70
=
0.385
```

```math
f_{\mathrm{down}}^{high}
=
0.55\times1.30
=
0.715
```

For entity $i$:

```math
R_i^{low}=R_i(\theta_{low})
```

```math
R_i^{base}=R_i(\theta)
```

```math
R_i^{high}=R_i(\theta_{high})
```

Sensitivity range:

```math
\Delta_i
=
R_i^{high}-R_i^{low}
```

Relative sensitivity:

```math
Sensitivity_i
=
\frac{R_i^{high}-R_i^{low}}
{R_i^{base}}
```

---

# 37. Replacing the Fixed 30% Range with Statistical Uncertainty

Suppose:

```math
\hat{f}_{\mathrm{down}}=0.55
```

and:

```math
SE(\hat{f}_{\mathrm{down}})=0.08
```

Approximate 95% confidence interval:

```math
0.55\pm1.96(0.08)
```

```math
0.55\pm0.157
```

Therefore:

```math
[0.393,0.707]
```

This interval can replace the arbitrary $\pm30\%$ range after calibration.

---

# 38. Dataset Snapshot Date

Let:

```math
T_{snapshot}
```

be the date on which the database is frozen.

Event age is:

```math
Age_e
=
T_{snapshot}-T_{event,e}
```

The current event effect is:

```math
S_e(T_{snapshot})
=
S_{0,e}
\left(
\frac{1}{2}
\right)^{Age_e/H}
```

This ensures reproducibility.

---

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

# 40. Parameter Provenance: Where the Current Numbers Actually Came From

## 40.1 Audit conclusion

After checking `app/src/engine/priors.js`, `MODEL_ROADMAP.md`, and `computation-demo/validation/MLE_VALIDATION.md`, the correct conclusion is:

> **The current parameter values were not calculated from real historical semiconductor outcomes. They were manually declared as transparent sensitivity priors.**

The repository explicitly says that nothing in `MODEL_PRIORS` has been fitted to observed disruption episodes. The values exist to make the demonstration reproducible, inspectable, and directionally sensible. SSCIM therefore must not describe `0.55`, `0.30`, `12`, or `0.25` as empirical estimates.

The current parameter vector is:

```math
\theta_0
=
\begin{bmatrix}
f_{\mathrm{down}} \\
f_{\mathrm{up}} \\
H \\
\phi
\end{bmatrix}
=
\begin{bmatrix}
0.55 \\
0.30 \\
12 \\
0.25
\end{bmatrix}
```

The repository's MLE validation does not discover these values from reality. It creates synthetic observations using the same values as known ground truth and tests whether the estimator recovers them. This validates the estimation machinery, not the real-world truth of the starting numbers.

---

## 40.2 Why `downstreamTransmission = 0.55` was selected

### Current rationale

`0.55` is a hand-set midpoint prior. It represents the judgment that a material supplier disruption should pass **more than half**, but not all, of its remaining effect to a dependent buyer after inventories, alternate sourcing, scheduling flexibility, and spare capacity absorb part of the shock.

It also encodes the qualitative assumption:

```math
f_{\mathrm{down}}>f_{\mathrm{up}}
```

because a critical physical-input shortage is assumed to propagate more strongly forward than a demand reduction propagates backward. No real event dataset was used to solve for exactly `0.55`.

### How it should be calculated from real data

For each historical supplier-to-buyer observation $n$, collect:

- supplier shock $S_{i,n}$;
- buyer shock $S_{j,n}$;
- buyer input dependence $d_{ij,n}$;
- effective specificity $q_{ij,n}$;
- event age $t_n$;
- half-life $H$.

Define the decayed, edge-adjusted supplier exposure:

```math
X_n
=
S_{i,n}
\left(\frac{1}{2}\right)^{t_n/H}
d_{ij,n}q_{ij,n}
```

The observation equation is:

```math
S_{j,n}=f_{\mathrm{down}}X_n+\varepsilon_n
```

Estimate the coefficient by constrained least squares, equivalent to Gaussian maximum likelihood:

```math
\hat f_{\mathrm{down}}
=
\arg\min_{0\leq f\leq1}
\sum_{n=1}^{N}
\left(S_{j,n}-fX_n\right)^2
```

For this one-parameter linear case:

```math
\hat f_{\mathrm{down}}
=
\min\left(1,
\max\left(0,
\frac{\sum_{n=1}^{N}X_nS_{j,n}}
{\sum_{n=1}^{N}X_n^2}
\right)\right)
```

`0.55` should remain only until a real event panel produces this estimate.

---

## 40.3 Why `upstreamTransmission = 0.30` was selected

### Current rationale

`0.30` is a hand-set weaker upstream-echo prior. It assumes that a buyer's demand reduction affects its suppliers, but suppliers may partly redirect sales, reduce utilization, draw down inventories, or serve other customers. It was not calculated from disclosed buyer-supplier outcomes.

### How it should be calculated

For each buyer-to-supplier observation $n$, collect buyer demand shock $D_{j,n}$, supplier revenue dependence $r_{ij,n}$, and observed supplier effect $S^{\mathrm{up}}_{i,n}$.

Define:

```math
Z_n=D_{j,n}r_{ij,n}
```

Then:

```math
S^{\mathrm{up}}_{i,n}=f_{\mathrm{up}}Z_n+\varepsilon_n
```

Estimate:

```math
\hat f_{\mathrm{up}}
=
\arg\min_{0\leq f\leq1}
\sum_{n=1}^{N}
\left(S^{\mathrm{up}}_{i,n}-fZ_n\right)^2
```

with closed form:

```math
\hat f_{\mathrm{up}}
=
\min\left(1,
\max\left(0,
\frac{\sum_{n=1}^{N}Z_nS^{\mathrm{up}}_{i,n}}
{\sum_{n=1}^{N}Z_n^2}
\right)\right)
```

---

## 40.4 Why `halfLifeDays = 12` was selected

### Current rationale

`12` is a manually selected short-run demonstration timescale. It means modeled event influence halves roughly every two weeks:

```math
S(t)=S_0 2^{-t/12}
```

Therefore:

```math
S(12)=0.5S_0,
\qquad
S(24)=0.25S_0,
\qquad
S(36)=0.125S_0
```

The repository contains no historical recovery panel from which twelve days was derived.

### How it should be calculated

For event observations $(t_k,S_k)$:

```math
S_k=S_0e^{-\kappa t_k}+\varepsilon_k
```

with:

```math
H=\frac{\ln 2}{\kappa}
```

For positive observations, log-linearization gives:

```math
\ln\left(\frac{S_k}{S_0}\right)=-\kappa t_k+\eta_k
```

A simple slope estimate is:

```math
\hat\kappa
=
-\frac{\sum_k t_k\ln(S_k/S_0)}
{\sum_k t_k^2}
```

and:

```math
\hat H=\frac{\ln 2}{\hat\kappa}
```

More correctly, all dynamic parameters should be fitted jointly by running the full engine inside the objective:

```math
(\hat f_{\mathrm{down}},\hat f_{\mathrm{up}},\hat H)
=
\arg\min_{f_d,f_u,H}
\sum_{e,s,t}
\left[
Y_{e,s,t}-\widehat Y_{e,s,t}(f_d,f_u,H)
\right]^2
```

---

## 40.5 Why `specificityFloor = 0.25` was selected

### Current rationale

The floor prevents a nominally substitutable input from transmitting exactly zero disruption. The transformation is:

```math
q_{ij}=\phi+(1-\phi)(1-u_{ij})
```

With $\phi=0.25$:

```math
u_{ij}=0 \Rightarrow q_{ij}=1
```

```math
u_{ij}=1 \Rightarrow q_{ij}=0.25
```

The 25% residual represents qualification, contracting, logistics, switching, and ramp-up friction. The exact number was manually chosen and is not a measured average.

### How it should be calculated

For each substitution episode, define residual disruption:

```math
R_n
=
\frac{\text{realized disruption after substitution}}
{\text{counterfactual disruption without substitution}}
```

The model predicts:

```math
\widehat R_n(\phi)=\phi+(1-\phi)(1-u_n)
```

Estimate:

```math
\hat\phi
=
\arg\min_{0\leq\phi\leq1}
\sum_{n=1}^{N}
\left[
R_n-\left(\phi+(1-\phi)(1-u_n)\right)
\right]^2
```

Let:

```math
A_n=R_n-(1-u_n),
\qquad
B_n=u_n
```

Then $A_n=\phi B_n+\varepsilon_n$, so:

```math
\hat\phi
=
\min\left(1,
\max\left(0,
\frac{\sum_n B_nA_n}{\sum_n B_n^2}
\right)\right)
```

---

## 40.6 Why `contributionTolerance = 10^{-4}` was selected

This is a numerical pruning rule rather than an economic coefficient. Recursive path expansion stops when:

```math
|C_p|<\tau,
\qquad
\tau=10^{-4}
```

The repository explains its purpose but does not provide a benchmark proving that $10^{-4}$ is optimal.

To select it empirically, use a near-zero reference tolerance such as:

```math
\tau_{\mathrm{ref}}=10^{-10}
```

For each candidate tolerance, calculate relative output error:

```math
E(\tau)
=
\frac{\lVert R(\tau)-R(\tau_{\mathrm{ref}})\rVert_1}
{\lVert R(\tau_{\mathrm{ref}})\rVert_1}
```

Select the largest tolerance satisfying an accuracy requirement:

```math
\hat\tau
=
\max\left\{
\tau:E(\tau)\leq\epsilon
\right\}
```

For example, use $\epsilon=10^{-3}$ if less than 0.1% aggregate output error is acceptable.

---

## 40.7 Why the component weights are `0.25/0.20/0.20/0.15/0.10/0.10`

The current vector is:

```math
w_0
=
\begin{bmatrix}
0.25 & 0.20 & 0.20 & 0.15 & 0.10 & 0.10
\end{bmatrix}^{\top}
```

for chokepoint, geography, policy, substitutability, current shock, and market components.

The weights encode the analyst priority ordering:

```math
\text{chokepoint}
>
\text{geography}\approx\text{policy}
>
\text{substitutability}
>
\text{shock}\approx\text{market}
```

They are normalized because:

```math
0.25+0.20+0.20+0.15+0.10+0.10=1
```

No regression or documented expert-elicitation procedure in the repository derives these exact percentages.

Given normalized component vector $x_n$ and realized outcome $Y_n$, estimate them by constrained regression:

```math
\widehat Y_n=x_n^{\top}w
```

```math
\hat w
=
\arg\min_w
\sum_{n=1}^{N}
\left(Y_n-x_n^{\top}w\right)^2
```

subject to:

```math
w_k\geq0,
\qquad
\sum_kw_k=1
```

Validation must hold out complete events rather than random rows:

```math
\hat w^{(-e)}
=
\arg\min_w
\sum_{n:\operatorname{event}(n)\neq e}
\left(Y_n-x_n^{\top}w\right)^2
```

---

## 40.8 Why the sensitivity range is `±30%`

The current deterministic scenarios are:

```math
\theta_{\mathrm{low}}=0.7\theta_0
```

```math
\theta_{\mathrm{high}}=1.3\theta_0
```

The 30% band is explicitly a robustness envelope, not a confidence interval. It asks whether conclusions survive materially different plausible assumptions.

After real calibration, replace it with statistical uncertainty:

```math
CI_{95\%,k}
=
\hat\theta_k\pm1.96\,SE(\hat\theta_k)
```

or jointly sample:

```math
\theta^{(b)}
\sim
\mathcal N(\hat\theta,\widehat\Sigma_{\theta})
```

---

## 40.9 What the synthetic MLE validation proves

The validation creates stage-level synthetic observations at:

```math
t\in\{0,3,6,9,12,15\}
```

across 24 stages, giving:

```math
24\times6=144
```

observations per replication. It generates them using assumed truth:

```math
\theta^{*}=(0.55,0.30,12)
```

and Gaussian noise:

```math
\varepsilon\sim\mathcal N(0,0.02^2)
```

The estimator minimizes:

```math
RSS(\theta)
=
\sum_{n=1}^{144}
\left[Y_n-\widehat Y_n(\theta)\right]^2
```

with profiled variance:

```math
\hat\sigma^2=\frac{RSS(\hat\theta)}{N}
```

This establishes that the three dynamic parameters are identifiable under this observation design and that the estimator can recover known synthetic values. It does **not** establish:

```math
(0.55,0.30,12)
=
\text{true real-world semiconductor parameters}
```

---

## 40.10 Required real calibration dataset

| Field | Meaning |
|---|---|
| `event_id` | Historical disruption identifier |
| `event_date` | Event start date |
| `observation_date` | Date impact was measured |
| `origin_node` | Initially affected company, stage, or country |
| `target_node` | Node where an effect was observed |
| `direction` | Downstream or upstream |
| `origin_impact` | Measured origin production or demand loss |
| `target_impact` | Measured target production, revenue, or delivery effect |
| `buyer_input_share` | $d_{ij}$ |
| `supplier_revenue_share` | $r_{ij}$ |
| `substitutability` | $u_{ij}$ |
| `inventory_days` | Buffer before disruption is felt |
| `time_to_switch` | Substitute qualification and ramp time |
| `time_to_recover` | Origin recovery time |
| `capacity_utilization` | Available capacity slack |
| `measurement_uncertainty` | Confidence level or standard error |

The roadmap proposes episodes such as the 2021 ABF substrate shortage, the 2023 gallium/germanium licensing action, and successive export-control rounds. These still require a structured outcome panel before empirical calibration can occur.

---

## 40.11 Final provenance table

| Parameter | Current value | How the current value was obtained | Defensible future estimator |
|---|---:|---|---|
| $f_{\mathrm{down}}$ | 0.55 | Hand-set directionally sensible prior | Constrained MLE/least squares on supplier-to-buyer outcomes |
| $f_{\mathrm{up}}$ | 0.30 | Hand-set weaker upstream-echo prior | Constrained MLE/least squares on buyer-to-supplier outcomes |
| $H$ | 12 days | Hand-set roughly two-week decay prior | Nonlinear decay fit or joint full-engine MLE |
| $\phi$ | 0.25 | Hand-set residual switching-friction floor | Fit residual loss in substitution episodes |
| $\tau$ | $10^{-4}$ | Numerical pruning choice | Convergence-error and runtime benchmark |
| Component weights | 0.25/0.20/0.20/0.15/0.10/0.10 | Analyst priority judgment | Constrained regression or documented expert elicitation |
| Sensitivity band | ±30% | Deterministic robustness scenario | Empirical covariance and confidence intervals |
| `datasetAsOf` | 2026-07-06 | Snapshot freeze date | Direct metadata; not estimated |

The scientifically correct statement is:

> SSCIM currently uses transparent, reproducible priors. The formulas for estimating them are ready, and synthetic tests show that the three main dynamic parameters are recoverable, but no real-world calibration has yet produced the current numerical values.

---

# 41. Calibration Framework

Let all unknown parameters be collected in:

```math
\theta
=
\left[
H,
f_{\mathrm{down}},
f_{\mathrm{up}},
\phi,
\lambda,
w_1,\ldots,w_K
\right]
```

For historical event $e$, let observed outcome be:

```math
Y_e
```

and model prediction be:

```math
\hat{Y}_e(\theta)
```

General calibration:

```math
\hat{\theta}
=
\arg\min_{\theta}
\sum_{e=1}^{E}
L\left(
Y_e,
\hat{Y}_e(\theta)
\right)
```

## 40.1 Mean squared error

```math
MSE(\theta)
=
\frac{1}{E}
\sum_{e=1}^{E}
\left(
Y_e-
\hat{Y}_e(\theta)
\right)^2
```

## 40.2 Mean absolute error

```math
MAE(\theta)
=
\frac{1}{E}
\sum_{e=1}^{E}
\left|
Y_e-
\hat{Y}_e(\theta)
\right|
```

## 40.3 Ranking loss

If the model is mainly used for ranking:

```math
L_{rank}
=
1-\rho_s
```

where $\rho_s$ is Spearman rank correlation between predicted and observed rankings.

## 40.4 Combined objective

```math
L_{total}
=
\alpha MSE
+
\beta MAE
+
\gamma(1-\rho_s)
```

with:

```math
\alpha+\beta+\gamma=1
```

---

# 42. Historical Data Needed for Calibration

To estimate the parameters empirically, each historical disruption should contain:

| Variable | Description |
|---|---|
| event date | start and recovery dates |
| event type | fire, earthquake, export restriction, strike |
| affected entity | company, facility, country, stage |
| initial production loss | direct event effect |
| customer production loss | downstream observed outcome |
| supplier revenue loss | upstream observed outcome |
| recovery path | daily or weekly recovery observations |
| dependency shares | customer reliance on supplier |
| revenue shares | supplier reliance on buyer |
| substitute availability | replacement options |
| policy overlap | number and intensity of policy instruments |
| market reaction | optional validation signal |
| shipment changes | operational validation |
| lead-time changes | operational validation |

Possible historical cases include:

- major semiconductor plant fires
- Taiwan earthquakes
- COVID-19 shutdowns
- automotive semiconductor shortages
- export-control announcements
- port closures
- energy shortages
- geopolitical restrictions

---

# 43. Expected Outputs

## 42.1 Company-level outputs

| Output | Meaning |
|---|---|
| `company_risk_score` | Combined risk score |
| `structural_risk_score` | Risk excluding current event shock |
| `current_shock_score` | Current direct and propagated event impact |
| `network_importance` | Structural network role |
| `geographic_risk` | Concentration and country exposure |
| `policy_exposure` | Policy-related risk |
| `substitutability_risk` | Difficulty of replacement |
| `market_dominance` | Market concentration contribution |
| `systemic_criticality` | Potential system-wide importance |
| `system_contribution` | Change in system risk if company is removed |

## 42.2 Stage-level outputs

- stage risk score
- stage concentration score
- stage current shock
- most critical company in the stage
- most exposed country
- top event driver

## 42.3 Country-level outputs

- country semiconductor risk
- country systemic importance
- exposed global capacity share
- policy exposure
- concentration by stage

## 42.4 Event-level outputs

- direct impact
- decayed current impact
- downstream propagated impact
- upstream propagated impact
- affected companies
- affected stages
- affected countries
- total system impact

## 42.5 Overall outputs

- SSCIM composite index
- historical trend
- top movers
- top risk contributors
- scenario comparison
- sensitivity range
- parameter robustness

---

# 44. Example Output Objects

## 43.1 Company output

```json
{
  "company_id": "NVIDIA",
  "as_of": "2026-07-06",
  "risk_score": 64.52,
  "structural_score": 70.41,
  "current_shock": 10.20,
  "network_importance": 85.00,
  "geographic_risk": 70.00,
  "policy_exposure": 45.00,
  "substitutability_risk": 75.00,
  "market_dominance": 80.00,
  "top_event": "ASML_FACTORY_FIRE",
  "confidence": 0.78
}
```

## 43.2 Event propagation output

```json
{
  "event_id": "ASML_FACTORY_FIRE",
  "initial_shock": 0.72,
  "event_age_days": 5,
  "decay_multiplier": 0.749,
  "current_direct_shock": 0.539,
  "affected_entities": [
    {
      "entity_id": "TSMC",
      "path": ["ASML", "TSMC"],
      "propagated_shock": 0.233
    },
    {
      "entity_id": "NVIDIA",
      "path": ["ASML", "TSMC", "NVIDIA"],
      "propagated_shock": 0.102
    }
  ]
}
```

---

# 45. What the Current Numbers Mean

The current parameters should be described honestly.

| Parameter | Current meaning | Is it directly calculated now? | Future method |
|---|---|---|---|
| $H=12$ | Event effect halves every 12 days | No | Fit historical recovery curves |
| $f_{down}=0.55$ | 55% base downstream transmission | No | Estimate from supplier-customer disruptions |
| $f_{up}=0.30$ | 30% base upstream transmission | No | Estimate from buyer-demand shocks |
| $\phi=0.25$ | At least 25% specificity remains | No | Fit supplier-substitution cases |
| $\lambda=0.40$ | Extra policy adds 40% incremental effect | No | Fit overlapping-policy outcomes |
| $\tau=10^{-4}$ | Ignore very small path contributions | Engineering choice | Convergence and runtime testing |
| weights | Relative importance of risk dimensions | Expert prior | Constrained regression or AHP |
| $\pm30\%$ | Sensitivity range | Scenario choice | Replace with confidence intervals |
| snapshot date | Data freeze date | Yes | Set directly from database |

---

# 46. Minimum Viable Product Data Requirements

The MVP does not need every possible variable. The minimum useful dataset is:

## Required

1. company master table
2. stage classification
3. supplier-customer edge list
4. dependency weight
5. substitutability score
6. company market share
7. country production exposure
8. event list
9. event severity
10. event operational coverage
11. policy exposure table
12. declared model priors
13. snapshot date

## Strongly recommended

1. supplier revenue dependence
2. capacity data
3. historical recovery curves
4. source confidence
5. shareholder data
6. facility-level geolocation
7. actual shipment and revenue impacts

---

# 47. Validation Tests

## 46.1 Range tests

All normalized variables should satisfy:

```math
0\leq x_i\leq1
```

## 46.2 Weight-sum test

```math
\sum_kw_k=1
```

## 46.3 Market-share test

Within each stage:

```math
\sum_{i\in s}\tilde{m}_i=1
```

## 46.4 Geographic-share test

For each entity:

```math
\sum_cg_{ic}=1
```

## 46.5 Monotonicity tests

Holding everything else constant:

```math
sev_e\uparrow
\Rightarrow
S_i\uparrow
```

```math
d_{ij}\uparrow
\Rightarrow
\Delta S_j\uparrow
```

```math
u_{ij}\uparrow
\Rightarrow
q_{ij}\downarrow
```

```math
H\uparrow
\Rightarrow
\text{slower decay}
```

## 46.6 Zero-shock test

If:

```math
S_{i,0}=0
```

then all propagated contributions should be:

```math
0
```

---

# 48. Final Interpretation

SSCIM should not be described as a system that predicts exact financial losses with certainty.

It is better understood as a transparent supply-chain stress and vulnerability model.

Its logic is:

```math
\text{Observed data}
+
\text{Declared or calibrated parameters}
```

```math
\Downarrow
```

```math
\text{Network and event calculations}
```

```math
\Downarrow
```

```math
\text{Company, stage, country, and system risk outputs}
```

The key development priority is to replace the current declared priors with empirically estimated parameters using historical semiconductor disruptions.

Until that calibration is completed, the current values remain transparent, editable assumptions that make the model operational and explainable.

---

# 49. One-Sentence Summary

```math
\boxed{
\text{SSCIM}
=
\text{Real-world semiconductor data}
+
\text{Model priors}
+
\text{Graph propagation}
+
\text{Risk aggregation}
}
```
