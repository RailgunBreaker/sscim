[SSCIM calculation specification](README.md) · section 42 of 49

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

[← 41. Calibration Framework](41-calibration-framework.md) · [Contents](README.md) · [43. Expected Outputs →](43-expected-outputs.md)
