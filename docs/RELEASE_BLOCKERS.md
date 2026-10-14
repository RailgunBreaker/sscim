# Public-release blockers

*Model version: `sscim-model-v7.1-exposure-robustness`. Application version
`0.7.1` (pre-release). Canonical model specification:
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
| **Repository visibility** | Recommendation: **keep the source private**. A proprietary product with a public source repository is a decision, not a default, and it has not been made. |
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

## 2. Scientific limitations - not blockers, but they bound the claims

These are **documented properties of the model**, not defects to fix before
release. They are listed so an honest limitation is never mistaken for an
unresolved decision, and so no public claim outruns them.

| Limitation | Where it is documented and quantified |
| --- | --- |
| No parameter is calibrated; all are `status: assumption` | [spec section 5](MODEL_V7_SPEC.md#5-parameter-register) |
| No external validation exists, and none is claimed | [spec section 9](MODEL_V7_SPEC.md#9-validation-status) |
| **Parameter uncertainty** - headline envelope width about 1.3 index points | `docs/benchmarks/v7-sensitivity.json` |
| **Model-form uncertainty** - envelope width about 1.1 index points | `docs/benchmarks/v7-sensitivity.json` (reported separately) |
| **Event-curation uncertainty** - headline width about 0.72, historical peak about 1.01 | `docs/benchmarks/v7-curation-uncertainty.json` |
| **Legacy fallback dependence** - 49 uncurated incidents; no effect on today, but about 1.03 index points on the pre-curation peak | `docs/benchmarks/v7-legacy-fallback.json` |
| No evidence-based edge allocations exist; every one is an equal split | counted by `npm run audit:data` |
| Facility `scale` is an analyst ordinal, not capacity | [spec section 3.3](MODEL_V7_SPEC.md#33-modeled-facility-footprint--enginefacilitiesjs) |
| Country shares are partly undisclosed; concentration is an interval | [spec section 3.8](MODEL_V7_SPEC.md#38-structural-components--engineindexjs-enginepolicyjs-enginemathjs) |
| Evidence-note coverage is thin for most stages and companies | [EVIDENCE-COVERAGE.md](reference/EVIDENCE-COVERAGE.md) |
| 20 of 30 curated incidents are not individually evidence-graded | `docs/benchmarks/v7-curation-uncertainty.json` |

**The honest public description remains: an exploratory decision-support
and research prototype.** Nothing in this pass changes that, and section 3
says what would.

---

## 3. What would be needed to make a stronger claim

Ranked by what each would unlock.

1. **Real incident outcomes** - a dated, attributed dataset of observed
   disruption outcomes. Without it no parameter can leave
   `status: assumption`, and every envelope stays an assumption envelope
   rather than a confidence interval.
2. **Evidence-based edge allocations** - bills of materials or qualified
   supplier lists. Every dependency coefficient currently rests on an equal
   split.
3. **Curation of the 49 legacy incidents** - would remove the largest
   single source of uncertainty in the historical series.
4. **Individual evidence grading for the remaining 20 curated incidents** -
   would narrow curation uncertainty and replace a default band with a
   judgement.
5. **Out-of-sample validation on held-out incidents** - the only thing that
   would justify the word "validated", which is currently used nowhere.

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
