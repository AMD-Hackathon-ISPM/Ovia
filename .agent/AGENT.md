# AGENT.md — Ovia Project Router

**Document type:** Repository task router
**Audience:** All contributors and coding agents
**Status:** Active · frontend contracts signed and reconciled against the Figma prototype (2026-08-04); ML/backend contracts open
**Updated:** 2026-08-04
**Canonical for:** Repository navigation, source precedence, working rules, ownership, and current status
**Companion documents:** [`.agent/product-requirements.md`](.agent/product-requirements.md), [`.agent/frontend-architecture.md`](.agent/frontend-architecture.md), [`.agent/design-guidelines.md`](.agent/design-guidelines.md), [`.agent/implementation-plan.md`](.agent/implementation-plan.md)

## How to read this document

Start here, choose the task row in §1, then follow the source precedence in §2. Owner blocks are intentional integration gates, not placeholders — do not infer a missing contract, and do not implement past one. Historical rationale belongs in `.agent/context-dump.md`, not here.

Ovia is a **patient-facing**, web-based, **investigational** screening-support prototype for **adults aged 18+ who have at least one ovary and are not currently pregnant**. A person answers a structured questionnaire about themselves and optionally uploads a de-identified pelvic ultrasound still. Three **independent** models return a risk assessment each:

| Screening | Input | Output |
|---|---|---|
| **PCOS** | questionnaire | Low / Moderate / High model-estimated risk + rationale |
| **Ovarian cyst** | ultrasound image | Low / Moderate / High model-estimated risk + rationale |
| **Ovarian tumor** | ultrasound image | Low / Moderate / High model-estimated risk + rationale |

Without an image, the cyst and tumor screenings return **not screened** — never a low or absent result.

**The three results are never fused into one score.** Ovia does not diagnose PCOS, does not identify or exclude ovarian cysts or tumors, does not assess malignancy, and does not assign an O-RADS category. **Every participant is directed to confirmatory evaluation regardless of any result.**

## 1. Document router

| Need | Canonical document |
|---|---|
| Product thesis, users, positioning, phased scope, demo narrative | [`.agent/product-brief.md`](.agent/product-brief.md) |
| User-visible behavior, safety rules, feature requirements, acceptance criteria | [`.agent/product-requirements.md`](.agent/product-requirements.md) |
| **Frontend system design, routes, state machine, data flow, module boundaries, performance and privacy contracts** | [`.agent/frontend-architecture.md`](.agent/frontend-architecture.md) |
| Prototype reconciliation and the open Figma conflicts | [`.agent/figma-reconciliation.md`](.agent/figma-reconciliation.md) |
| Design tokens, components, states, motion, localization, accessibility | [`.agent/design-guidelines.md`](.agent/design-guidelines.md) |
| Verified external facts and citations | [`.agent/evidence-register.md`](.agent/evidence-register.md) |
| Tickets, dependencies, milestones, merge order, fallbacks | [`.agent/implementation-plan.md`](.agent/implementation-plan.md) |
| Frontend-proposed API shape awaiting ML sign-off | [`contracts/openapi/ovia-v1.yaml`](contracts/openapi/ovia-v1.yaml) |
| Model, dataset, training, calibration, evaluation | **`.agent/data-evaluation-plan.md` — not yet authored. Owned by the ML engineer (§4).** |
| Backend service topology, inference serving, deployment | **`.agent/project-architecture.md` — not yet authored. Owned by the ML/backend engineer (§4).** |
| Decision history and ruled-out ideas | [`.agent/context-dump.md`](.agent/context-dump.md) |
| Chronological documentation changes | [`.agent/log.md`](.agent/log.md) |
| Reusable planning standard | [`.agent/plan-template.md`](.agent/plan-template.md) |

**First read:** `AGENT.md` → `product-brief.md` → `product-requirements.md` → your owned architecture document.

## 2. Source precedence

Precedence is responsibility-specific, not one global ordering:

1. `evidence-register.md` controls external facts and cited numbers.
2. `product-requirements.md` controls product behavior, medical-safety copy, and MVP scope.
3. `frontend-architecture.md` controls frontend structure, state, and client contracts.
4. `design-guidelines.md` controls visual system and interaction states.
5. `data-evaluation-plan.md` and `project-architecture.md` control model and server implementation **once authored and signed by their owner**.
6. `implementation-plan.md` controls sequence and ownership but may not override the PRD or evidence.
7. `product-brief.md` and `README.md` summarize the canonical documents.
8. `context-dump.md` and `log.md` are historical and may contain explicitly marked superseded decisions.

When two current documents disagree, add a visible contradiction block (§5), stop the affected implementation, and resolve the canonical source first.

## 3. Scope and safety rules

- **[MVP]** is the demonstrable end-to-end loop.
- **[V1]** is documented for later; not built now.
- **[Stretch]** starts only after every P0 acceptance criterion passes.
- **[OUT]** must not be implemented.
- The MVP has **three co-equal, independent screenings**: PCOS (questionnaire), ovarian cyst (image), ovarian tumor (image). **Never fuse them, never average them, never rank them, never show a single combined "Ovia score."** No dataset justifies a fused claim.
- **Ineligibility is a designed terminal state, not an error.** Failing any of the three eligibility criteria runs no screening at all.
- Ovia is **screening support, not diagnosis**. Prohibited output words are listed in `product-requirements.md` §1.2.
- The imaging screenings must never output, imply, or rank **malignancy probability** or an **O-RADS category**. Those are clinician and radiologist determinations. See `product-requirements.md` §3.7.
- A **low** risk assessment is never presented as a rule-out, a clean result, or a reason to skip evaluation. Green is not in the palette.
- Uploaded images and questionnaire answers are **processed transiently**: no persistence, no request-body logging, no browser storage, no analytics payloads.
- Uploaded images must be **de-identified before upload**; the client blocks obvious identifiers where detectable and always shows the de-identification instruction.
- Saliency, heatmap, and attention artifacts are **model inspection**, never causal explanation or clinical reasoning.
- All factual and medical claims must trace to `evidence-register.md`.

## 4. Visible owner-input blocks

Every block uses this structure:

> **OWNER INPUT REQUIRED — Name — due YYYY-MM-DD**
>
> **Blocks:** the ticket or interface that cannot proceed
>
> **Required output:** the exact decisions or artifacts the owner must provide
>
> **Affected documents:** every canonical document that must be synchronized
>
> **Completion rule:** replace this block with the signed decision and update the affected documents and `log.md`

Owners in the current revision:

- **Frontend/design lead (you):** frontend architecture, screen and state map, API-to-UI mapping, design system, responsive behavior, accessibility, motion, client-side privacy behavior. **Status: signed** — see `frontend-architecture.md` and `design-guidelines.md`.
- **ML engineer (your teammate):** datasets, model selection, training, calibration, evaluation protocol, inference contract, serving, backend topology, security, observability. **Status: open** — every block below is theirs:
  - `ARCH-1` — inference request/response contract (`implementation-plan.md` §3)
  - `ARCH-2` — image preprocessing, accepted formats, and quality-gate reason codes
  - `ARCH-3` — calibration status and risk-band thresholds for all three screenings
  - `ARCH-4` — the rationale-string vocabulary each model can support (the one-line reason under each risk word)
  - `ARCH-5` — security, transient-processing guarantee, and observability profile

Do not use unowned `TODO`, `TBD`, ellipses, or vague instructions such as "handle errors."

## 5. Contradiction blocks

> **CONTRADICTION — BLOCKS IMPLEMENTATION**
>
> **Conflict:** the two incompatible statements
>
> **Canonical documents affected:** paths
>
> **Owner / due:** one accountable resolver and date
>
> **Resolution rule:** implementation resumes only after all affected documents agree

Known factual errors are corrected directly rather than preserved as contradiction blocks.

## 6. Team boundaries

| Person | Role | Owns |
|---|---|---|
| *(you)* | Frontend / design lead | Frontend architecture, design system, accessibility, UX safety copy placement, client privacy behavior, final polish |
| *(teammate)* | ML engineer / backend | Datasets, models, training, evaluation, inference API, serving, deployment |
| *(unassigned)* | Frontend implementer | Builds capture and result flows from the signed frontend specification |
| *(unassigned)* | PM / submission | Schedule, evidence-to-pitch consistency, slides, demo, submission completeness |

No one implements a blocked interface before its owner block is completed. **The frontend does not wait on the backend to progress**: it develops against the fixture adapter in `frontend-architecture.md` §7.

## 7. Working rules

1. Read this router and the canonical document before editing.
2. Keep diffs minimal; do not change unrelated files.
3. Respect `[MVP]`, `[V1]`, `[Stretch]`, `[OUT]` labels.
4. Record changed decisions in `context-dump.md` and append a dated line to `log.md`.
5. Update `evidence-register.md` before repeating a changed factual claim anywhere else.
6. Bump a document's `Updated` date whenever its current specification changes.
7. A task is done only when its acceptance criteria **and** documentation-synchronization checks pass.

## 8. Current status and first tasks

Locked: product name, cohort boundary (18+, at least one ovary, not currently pregnant), the three-screening non-fusion rule, screening-not-diagnosis posture, transient-processing privacy model, frontend stack and state machine, and the design token system now derived from the Figma prototype.

**Reconciled 2026-08-04.** The prototype settled the palette (rose on white), the type direction, the four-step model, the eligibility sub-flow, and the three-card result layout. [`figma-reconciliation.md`](.agent/figma-reconciliation.md) records every change in both directions.

**Two safety conflicts are open and block `FE-7`:**

1. The prototype renders **LOW in green and MODERATE in amber** — a traffic-light scale that reads as clearance. Must change to the non-traffic-light ramp in `design-guidelines.md` §3.4.
2. The prototype's result copy says a risk was **"identified"**, calls the imaging screenings **"low risk"**, and closes with **"continue routine gynecological checkups as usual"** — which actively discourages the follow-up that the same screen's footer requires. Must be rewritten to `design-guidelines.md` §2.1.

Two lower-severity fixes: the eligibility hint claims the tool is **"validated"** for 18+, and the de-identification acknowledgement is missing from the upload screen.

Also not yet true:

- No inference contract is signed. The frontend consumes `contracts/openapi/ovia-v1.yaml`, a **frontend proposal**, through a swappable fixture adapter.
- No model exists, so no calibration claim, threshold, or performance number may appear anywhere. Every card renders `calibration: uncalibrated` and withholds numeric values until `ARCH-3` closes.
- The bilingual requirement is undecided against an English-only prototype (`figma-reconciliation.md` §4).

Immediate tasks:

- **Frontend lead:** close the safety conflicts in the Figma (`UX-2`); make the bilingual call; export the typeface and step icons; run the contrast script; then `UX-1`.
- **ML engineer:** close `ARCH-1` and `ARCH-2` first — the clinical field list and the image preprocessing/reason codes block more downstream frontend work than anything else you own.
