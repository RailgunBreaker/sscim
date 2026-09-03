# Public-release blockers

*Model version: `sscim-model-v7-exposure-robustness`. Canonical model
specification: [`docs/MODEL_V7_SPEC.md`](MODEL_V7_SPEC.md).*

Things that must be decided or completed by the repository owner before this
project can be presented as a public release. Each is stated with what is
blocked, why, and what a resolution would look like — none of them is resolved
here, because none of them is a decision this codebase can make on its own
behalf.

---

## 1. BLOCKER — no repository licence has been chosen

**Status: open. Requires an owner decision. Nothing else can unblock it.**

There is no `LICENSE` file in this repository, and none has been invented.
Without one, **default copyright applies**: the source is readable, and no
reuse, modification, redistribution or derivative-work rights are granted to
anyone.

### What this actually blocks

| Activity | Blocked? | Why |
| --- | --- | --- |
| Reading the code and documentation on GitHub | No | Public visibility is granted by the GitHub Terms of Service, and by nothing else. |
| Forking on GitHub | Partly | GitHub's terms permit forking within GitHub. They grant nothing beyond it. |
| Cloning and running it locally | **Yes** | No copying right is granted. |
| Reusing any part of the engine, the data, or the documentation | **Yes** | All rights reserved by default. |
| Citing SSCIM outputs in a paper or report | Ambiguous | Citation is normally fair use, but a reader cannot verify a result they may not lawfully run. |
| Accepting an outside contribution | **Yes** | With no licence and no CLA there is no basis on which a contributor can grant rights, and none on which they can be accepted. |
| Distributing a built artefact (the Pages deploy included) | **Yes, as a question** | The deploy is public today. Whether the owner intends that to convey any rights is exactly the undecided question. |

### Why it has not been resolved here

Choosing a licence assigns rights the repository owner holds, and it is
irreversible in practice: a permissive licence, once published, cannot be
withdrawn from copies already made under it. It also interacts with two things
this repository does not know — how the owner intends to commercialise the
briefing product described in the documentation, and whether any curated data in
`server/src/seed-data.js` carries obligations from the sources it was compiled
from.

**A licence has therefore not been added, invented, or implied.** That is
deliberate and is not an oversight to be corrected by a future contributor
without the owner's explicit instruction.

### What a resolution looks like

The owner picks one and adds it as `LICENSE` at the repository root:

| If the intent is… | The usual choice | What it means here |
| --- | --- | --- |
| Anyone may use it, including commercially, with attribution | **MIT** or **Apache-2.0** | Apache-2.0 additionally grants patent rights and requires change notices. |
| Anyone may use it, but derivatives of the *service* must stay open | **AGPL-3.0** | Relevant because the natural deployment is a hosted dashboard. |
| Read-only reference; all rights reserved | **No licence, stated explicitly** | The status quo — but say so on purpose, and keep this page. |
| The **code** and the **curated dataset** should carry different terms | A code licence plus a separate data licence (for example CC BY-SA 4.0 for `server/data/` and `docs/`) | The dataset is a compiled work of curated judgements and is arguably the more sensitive half. |

Two further decisions travel with it, and are just as much the owner's:

1. **The dataset's terms.** Severity scores, stage exposures, temporal profiles
   and the facility table are curated analyst judgements compiled from public
   sources. Whether they are licensed with the code or separately is a distinct
   choice from the code licence.
2. **Contributions.** If outside contributions are ever wanted, a `CONTRIBUTING`
   file and a stated inbound licence (commonly "inbound = outbound") are needed
   before the first one arrives, not after.

---

## 2. Not blockers, but stated so they are not mistaken for one

These are **limitations of the model**, fully documented and not defects to be
fixed before release. They are listed here only so a reader does not confuse an
honest limitation with an unresolved decision.

| Limitation | Where it is documented |
| --- | --- |
| No parameter has been calibrated against observed disruption outcomes; every one is `status: assumption` | [spec §5](MODEL_V7_SPEC.md#5-parameter-register), [spec §11](MODEL_V7_SPEC.md#11-limitations-and-calibration-roadmap) |
| No external validation exists, and none is claimed | [spec §9](MODEL_V7_SPEC.md#9-validation-status) |
| This snapshot supplies no evidence-based edge allocations; every one is the equal-split fallback | [spec §6](MODEL_V7_SPEC.md#6-fallback-and-missing-data-rules), and counted in `npm run audit:data` |
| Facility `scale` is an analyst ordinal, not capacity | [spec §3.3](MODEL_V7_SPEC.md#33-modeled-facility-footprint--enginefacilitiesjs) |
| Country shares are partly undisclosed, so concentration is published as an interval | [spec §3.8](MODEL_V7_SPEC.md#38-structural-components--engineindexjs-enginepolicyjs-enginemathjs) |
| Evidence-note coverage is thin for most stages and companies | [EVIDENCE-COVERAGE.md](reference/EVIDENCE-COVERAGE.md) |

---

## 3. How to close item 1

1. The repository owner decides, using the table above.
2. Add `LICENSE` at the repository root with the unmodified text of the chosen
   licence.
3. Update the **License** section of [`README.md`](../README.md) to name it.
4. If the dataset is licensed separately, add `docs/DATA_LICENSE` and say so in
   both places.
5. Delete section 1 of this page, leaving section 2 in place.

Until step 1 happens, **treat everything in this repository as
all-rights-reserved.**
