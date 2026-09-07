# Public-release blockers

*Model version: `sscim-model-v7.1-exposure-robustness`. Application version
`0.7.2` (pre-release). Canonical model specification:
[`docs/MODEL_V7_SPEC.md`](MODEL_V7_SPEC.md).*

Things that must be decided or completed before this project can be
presented as a release.

---

## 1. BLOCKER - licensing and ownership are not settled

**Status: open. Requires an owner decision.**

**The project is being prepared as a PROPRIETARY commercial product.** No
open-source licence has been added and none should be:
[`PROPRIETARY_NOTICE.md`](../PROPRIETARY_NOTICE.md) states all-rights-reserved
terms, and [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) records what
is third-party and therefore *not* the project's to reserve.

What remains open is not *which* licence, but the facts the notice needs:

| Open item | Why it blocks release |
| --- | --- |
| **Legal owner and jurisdiction** | Every ownership claim in the proprietary notice is a `[PLACEHOLDER]`. No company name, entity or address has been invented, because a false ownership record is worse than a blank one. |
| **Legal review** | The proprietary notice is an engineering draft. It has not been reviewed by a lawyer and must be before any commercial launch. |
| **Repository visibility** | The GitHub API reports this repository already **public** (checked 2026-09-06), with no recognized license. This differs from the prior private-source recommendation. Visibility and proprietary notices were left unchanged; the owner must reconcile their intended public-disclosure policy. |
| **Terms of Use / Privacy Policy** | Not drafted. Required if the application is publicly accessible. |
| **Third-party data redistribution** | Market quotes, market-share estimates and basemap terms need confirmation for commercial use. See `THIRD_PARTY_NOTICES.md` section 3.3. |
| **Trademark** | The name "SSCIM" has not been checked. |

### What is already settled

- **Dependency licences are clean for commercial use.** 251 installed
  packages, all permissive (MIT, ISC, Apache-2.0, BSD, MIT-0, Unlicense,
  CC-BY-4.0). **Zero copyleft or reciprocal licences.** Checked, not assumed.
- **No secrets, credentials or `.env` files** are present in the tree.
- **No accidental open-source licence language** anywhere in the repository.

---

## 2. Analytical limitations - blockers for operational deployment

These limitations block dependable operational risk claims. Documenting them
does not resolve them. The source-backed dataset, calculation changes and actual
validation results are tracked in [Observed data](OBSERVED_DATA.md); unresolved
coverage and predictive validity remain release blockers for operational use.

| Limitation | Where it is documented and quantified |
| --- | --- |
| No parameter is calibrated; all are `status: assumption` | [spec section 5](MODEL_V7_SPEC.md#5-parameter-register) |
| Revenue nowcast passes its historical benchmark; chain-wide loss and prospective operational validation remain absent | [Predictive validation](PREDICTIVE_VALIDATION.md) |
| **Parameter uncertainty** - tested registry ranges | `docs/benchmarks/v7-sensitivity-public-review.json` |
| **Model-form uncertainty** - tested discrete combinations | same file, separately reported |
| **Event-curation uncertainty** - baseline, per incident, opposing signs, profile combinations | `docs/benchmarks/v7-curation-uncertainty-public-review.json` |
| **Data coverage** - unresolved historical claims are excluded, not assumed safe | `docs/benchmarks/v7-legacy-fallback-public-review.json` |
| Research stage-edge allocations remain assumed; documented company input shares are a separate calculation | [Observed data](OBSERVED_DATA.md#calculation-changes) |
| Facility `scale` is an analyst ordinal, not capacity | [spec section 3.3](MODEL_V7_SPEC.md#33-modeled-facility-footprint--enginefacilitiesjs) |
| Country shares are partly undisclosed; concentration is an interval | [spec section 3.8](MODEL_V7_SPEC.md#38-structural-components--engineindexjs-enginepolicyjs-enginemathjs) |
| Evidence-note coverage is thin for most stages and companies | [EVIDENCE-COVERAGE.md](reference/EVIDENCE-COVERAGE.md) |
| Exposure uncertainty bands are assumed and separate from factual claim verification | `docs/benchmarks/v7-curation-uncertainty-public-review.json` |

**The honest public description remains: an exploratory decision-support
and research prototype.** Nothing in this pass changes that, and section 3
says what would.

---

## 3. What would be needed to make a stronger claim

Ranked by what each would unlock.

1. **Representative, matching incident outcomes** - the public ledger now
   contains 16 recovery observations and 16 financial outcomes. The external
   recovery fit fails its baseline comparison; the financial records represent
   five incidents with distinct accounting targets. More data and a defensible
   matching-target model are needed before promoting a global parameter.
2. **Measured edge allocations** - 14 disclosed company relationships, two
   product-scoped input shares and one reported manufacturing route now support
   separate evidence-based calculations. Complete plant shipment allocations,
   inventories, qualification constraints and substitution remain unavailable.
3. **Curation of the 49 legacy incidents** - would remove the largest
   single source of uncertainty in the historical series.
4. **Individual evidence grading for the remaining 20 curated incidents** -
   would narrow curation uncertainty and replace a default band with a
   judgement.
5. **Representative held-out and prospective validation** - the frozen news
   incident holdout achieved 11/12 operational classifications (5/6 recall).
   Its narrow paraphrased inputs and AI-assisted labels do not establish feed
   accuracy. Historical queue lags do not establish a prospective latency SLA.
   The separate TSMC revenue nowcast passes a 24-month chronological test with
   verified original disclosure vintages; this does not close the chain-wide
   disruption or prospective performance requirements.

---

## 4. Closing item 1

1. Owner confirms legal entity, jurisdiction and contact.
2. Substitute every `[PLACEHOLDER]` in `PROPRIETARY_NOTICE.md`.
3. Legal review of that notice.
4. Decide repository visibility (recommendation: private).
5. Draft Terms of Use and Privacy Policy.
6. Confirm the third-party data items in `THIRD_PARTY_NOTICES.md` section 3.3.
7. Work the pre-launch checklist in `PROPRIETARY_NOTICE.md` section 7.

Until step 1 happens, **treat everything in this repository as
all-rights-reserved**, and do not distribute it.


## Research preview decision after this correction

The scope of a research preview is narrower than commercial release above. GO only for the explicitly evidence-limited, assumption-based comparison environment described in [PUBLIC_RESEARCH_REVIEW.md](PUBLIC_RESEARCH_REVIEW.md). Unresolved records are excluded and retained visibly; published numbers must carry coverage and data-revision labels. NO-GO for comprehensive factual risk monitoring, production-loss forecasts, empirical company-capacity rankings or commercial-launch claims. Ownership placeholders and the public/private policy inconsistency remain owner decisions; no visibility or licensing changes were made.
