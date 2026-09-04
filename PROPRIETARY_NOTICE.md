# Proprietary Notice — SSCIM

> **⚠ PRELIMINARY ENGINEERING DRAFT. NOT LEGAL ADVICE, AND NOT READY FOR
> COMMERCIAL LAUNCH.**
>
> This notice was drafted by an engineer to make the repository's intended
> status explicit and to stop an open-source licence being added by
> accident. It has **not been reviewed by a lawyer**, and it must be
> reviewed before any commercial release, public launch, investor
> disclosure, or external distribution.
>
> Every `[PLACEHOLDER]` below marks a fact this repository does not know
> and must not invent.

---

## 1. Owner

**Copyright © [YEAR] [LEGAL OWNER — placeholder].** All rights reserved.

The legal owner has **not been confirmed** in this repository. No company
name, legal entity, trading name, address, or jurisdiction has been
inserted, because inventing one would be worse than leaving it blank: it
would create a false record of ownership. The owner must replace
`[LEGAL OWNER]` and `[YEAR]` before this notice has any effect.

| Field | Value |
| --- | --- |
| Legal owner | `[PLACEHOLDER — to be supplied by the owner]` |
| Jurisdiction | `[PLACEHOLDER]` |
| Contact for licensing | `[PLACEHOLDER]` |
| First publication year | `[PLACEHOLDER]` |

## 2. What is claimed

All rights are reserved in the following, to the extent they are the
owner's to reserve:

- the **source code** of the application, engine, server, scripts and tests;
- the **model implementation** — the v7.1 formulation, its parameter
  registry, its curated event model, and the specific constructions
  documented in `docs/MODEL_V7_SPEC.md`;
- the **documentation** written for this project;
- **datasets created by this project**: the curated stage graph, the
  analyst judgements (severity, stage exposure, persistence classification,
  non-substitutability, market importance, facility significance ordinals),
  the evidence notes, and the compiled vault database;
- **branding**, naming and visual design;
- **compiled and generated assets**, including the built site and generated
  benchmark artefacts.

## 3. What is NOT claimed

This is the more important section, and it is deliberately specific.

**No ownership is claimed over:**

- **Third-party facts.** Company names, plant locations, production stages,
  regulatory actions and market events are facts about the world. The
  *selection, arrangement and judgement* applied to them may attract
  protection; the underlying facts do not, and no attempt is made to claim
  them.
- **Public-domain and government material**, including US Federal Register
  rule texts, BIS/METI/MOFCOM publications, and other official documents
  cited in `docs/reference/SOURCE-REGISTER.md`.
- **Cited research.** The academic works referenced in the source register
  belong to their authors and publishers. This project cites them for
  concepts and functional forms; it does not reproduce them and claims
  nothing in them.
- **Third-party datasets** consulted or cited, including market-share and
  capacity estimates attributed to their originators.
- **Third-party software dependencies**, which remain under their own
  licences — see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
- **Map tiles and geographic data**, which are © OpenStreetMap contributors
  and © CARTO, under their own terms.
- **Market quote data**, which is display metadata retrieved from a
  third-party source and is never a model input.

## 4. No licence is granted

Possession of, or access to, this repository — including by fork, clone,
archive, or any other means — **does not grant permission** to:

- copy or reproduce it, in whole or in part;
- modify it or create derivative works;
- redistribute, publish, or sublicense it;
- use it commercially or offer it as a service;
- use its data, model, or branding in another product.

No open-source licence applies. No implied licence is granted by
publication, by the presence of this file, or by the availability of a
public demonstration.

Both `package.json` manifests declare `"license": "UNLICENSED"` and
`"private": true`. `UNLICENSED` is npm's and SPDX's marker for proprietary
software; it grants nothing and is not an open-source licence. It is
recorded there so that tooling reads the same position as this file.

## 5. Repository visibility

**Recommendation: keep the source repository private** until the owner has
confirmed the licensing position and completed legal review.

The repository is currently public-capable and deploys a public site. If a
public demonstration is intended while the source remains proprietary, the
recommended arrangement is: private source repository, public build output
only, with this notice and the public-facing documents in section 6 served
alongside it.

## 6. Public-facing documents required before launch

If the application is publicly accessible, the following must exist and be
linked from the interface. They are **drafts or placeholders** here and
none has been reviewed.

| Document | Status |
| --- | --- |
| Terms of Use | `[PLACEHOLDER — not drafted]` |
| Privacy Policy | `[PLACEHOLDER — not drafted]` — note the app stores watchlists in the visitor's browser only and runs no account system |
| Data and methodology disclaimer | Substantially covered by `docs/MODEL_V7_SPEC.md` §1 and §9; needs a short public-facing summary |
| Copyright / proprietary notice | This file |
| Contact | `[PLACEHOLDER]` |

**Required statement, to appear wherever outputs are displayed:**

> SSCIM outputs are **analytical estimates produced by an uncalibrated
> research model**. They are bounded comparative exposure scores, not
> probabilities, monetary losses, forecasts, or measured trade flows. They
> are **not financial, investment, operational, or legal advice**, and must
> not be relied upon as such.

## 7. Pre-launch checklist

- [ ] Legal owner and jurisdiction confirmed and substituted for every `[PLACEHOLDER]`.
- [ ] This notice reviewed by a qualified lawyer.
- [ ] Repository visibility decided (recommendation: private).
- [ ] Terms of Use drafted and reviewed.
- [ ] Privacy Policy drafted and reviewed.
- [ ] Dependency licences reviewed against commercial distribution — see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
- [ ] Third-party data redistribution rights confirmed (map tiles, market quotes, market-share estimates).
- [ ] Confirm no third-party dataset is redistributed beyond fair citation.
- [ ] Trademark position on the name "SSCIM" checked.
- [ ] The analytical-estimates statement in §6 present on every public surface that displays a score.
- [ ] Confirm no secrets, credentials, or private commercial data in the repository history.

## 8. Relationship to other files

- [`docs/RELEASE_BLOCKERS.md`](docs/RELEASE_BLOCKERS.md) — the open decisions blocking release.
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — dependency and third-party data attribution.
- [`docs/MODEL_V7_SPEC.md`](docs/MODEL_V7_SPEC.md) §9 — what has and has not been validated.

**No `LICENSE` file granting open-source rights exists in this repository,
and none should be added without an explicit decision by the owner.**
