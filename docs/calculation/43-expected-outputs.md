[SSCIM calculation specification](README.md) · section 43 of 49

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

[← 42. Historical Data Needed for Calibration](42-historical-data-needed-for-calibration.md) · [Contents](README.md) · [44. Example Output Objects →](44-example-output-objects.md)
