[SSCIM calculation specification](README.md) · section 44 of 49

# 44. Example Output Objects

## 43.1 Company output

```json
{
  "company_id": "NVIDIA",
  "as_of": "2026-07-29",
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

[← 43. Expected Outputs](43-expected-outputs.md) · [Contents](README.md) · [45. What the Current Numbers Mean →](45-what-the-current-numbers-mean.md)
