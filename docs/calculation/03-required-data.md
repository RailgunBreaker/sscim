[SSCIM calculation specification](README.md) · section 3 of 49

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

[← 2. Notation](02-notation.md) · [Contents](README.md) · [4. Model Parameters and Their Current Role →](04-model-parameters-and-their-current-role.md)
