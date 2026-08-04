# Ovia · Implementation Plan and Ticket Board

**Document type:** Implementation plan
**Audience:** Frontend implementers, ML engineer, QA, PM
**Status:** Active · frontend tickets ready; ML tickets are owner-blocked stubs
**Owner:** Frontend/design lead (frontend sequence) · ML engineer (model sequence)
**Updated:** 2026-08-04
**Canonical for:** Tickets, dependencies, merge order, milestones, fallbacks
**Companion documents:** [`frontend-architecture.md`](frontend-architecture.md), [`product-requirements.md`](product-requirements.md), [`design-guidelines.md`](design-guidelines.md)

## How to read this document

Tickets sequence work; they never override the PRD or the evidence register. **Frontend tickets are deliberately written so that none of them blocks on the model.** Everything server-dependent is isolated behind the adapter in `frontend-architecture.md` §7, so the flow is buildable and demonstrable before a single weight is trained.

## 1. Ownership

| Prefix | Owner | Scope |
|---|---|---|
| `FE-*` | Frontend lead + implementer | Routes, state, components, media, a11y, i18n |
| `UX-*` | Frontend lead | Design system, copy, Figma reconciliation |
| `QA-*` | Whoever is free; reviewed by the frontend lead | Tests, a11y, privacy, responsive |
| `ARCH-*` | **ML engineer** | Contracts and model semantics — blocking handoffs |
| `ML-*` | **ML engineer** | Data, training, calibration, evaluation, serving |
| `PM-*` | PM | Evidence sign-off, demo, submission |

## 2. Blocking owner handoffs (ML engineer)

These are the only things the frontend genuinely cannot invent. Each is stated in full in `AGENT.md` §4 and at its point of use.

| ID | Required output | Blocks | Frontend fallback until closed |
|---|---|---|---|
| `ARCH-1` | Questionnaire feature vector, request/response schema, `schema_version`, missing-value representation | `FE-2`, `FE-6`, contract tests | Provisional Zod schema marked in code; fixture adapter; **no validated claim** |
| `ARCH-2` | Image preprocessing, accepted formats/resolution, server quality-gate reason codes | `FE-3`, `FE-4` | Client gate only; provisional reason-code map |
| `ARCH-3` | PCOS screening band thresholds, calibration method and status | `FE-7` value display | Band-less card, `calibration: uncalibrated`, value withheld |
| `ARCH-4` | imaging screening finding vocabulary, confidence semantics, whether localization output exists | `FE-8` | Provisional vocabulary, excluded from all demo claims |
| `ARCH-5` | Transient-processing guarantee, logging/redaction, security profile | Public deployment | Local demo only; not publicly exposed |

**Rule:** the frontend proposes in `contracts/openapi/ovia-v1.yaml`; the ML engineer signs or replaces. A silent divergence between the served API and the pinned contract is a `terminal_error`, by design.

## 3. Frontend tickets

Each ticket: **Owner · Depends on · Covers · Deliverable · Acceptance · Fallback.**

### FE-0 · Scaffold and token layer `[MVP] P0`
**Depends on:** none · **Covers:** PRD-10, PRD-12
**Deliverable:** Next.js + TS app, Tailwind 4 wired to `styles/tokens.css`, shadcn primitives re-skinned, fonts loaded, locale provider with typed keys, live-region host, lint rules for the storage ban and the layer-dependency rule.
**Acceptance:** a blank route renders in both locales; a missing key fails the build; a `localStorage` call fails lint; bundle gate is active in CI.
**Fallback:** none — everything depends on this.

### FE-1 · Flow machine, session store, guards `[MVP] P0`
**Depends on:** FE-0 · **Covers:** PRD-01, PRD-05, PRD-09
**Deliverable:** `lib/flow/machine.ts` reducer with all guards, Zustand memory-only store with three slices, `BackGuard`, `ResetDialog`, session timeout with warning countdown.
**Acceptance:** unit tests cover every transition and guard; reset clears every slice and revokes object URLs; back/refresh raises the guard; timeout resets; store invariants (no fusion, no stale data) are asserted.
**Fallback:** none.

### FE-2 · Eligibility and clinical questionnaire `[MVP] P0`
**Depends on:** FE-1, UX-1 · **Blocked-shape by:** ARCH-1
**Covers:** PRD-01, PRD-02
**Deliverable:** splash with a 2 s cap; three-question eligibility sub-flow with a 3-dot indicator and no pre-selected answers; reason-specific `/not-eligible` screens for under-18, no-ovary, and pregnancy, each offering "review my answers" and a clinician route; schema-driven questionnaire with sections, units, ranges, derived BMI, "not sure" answers, blur + submit validation, and a focusable error summary.
**Acceptance:** any disqualifying eligibility answer blocks the questionnaire and routes to its own tested screen; no binary question ships a pre-selected or visually favoured answer; the age hint never says "validated"; cannot reach `/ultrasound` without a valid parse; errors never clear values; unsupported fields never enter the payload.
**Fallback:** ship against the provisional schema, clearly marked; **no claim that fields are model-validated.**

### FE-3 · Ultrasound upload and client quality gate `[MVP] P0`
**Depends on:** FE-1 · **Blocked-detail by:** ARCH-2 · **Covers:** PRD-03, PRD-04, PRD-09
**Deliverable:** dropzone (keyboard-first), format/size/dimension gates, canvas re-encode with EXIF strip, preview, de-identification acknowledgement, replace, skip-with-confirmation.
**Acceptance:** original bytes never uploaded (unit test on an EXIF/GPS fixture); rejection preserves a prior accepted image; DICOM rejected with an explanation; skip yields two `not_screened` cards; object URLs revoked.
**Fallback:** client gate alone; server-reason guidance is provisional.

### FE-4 · Review, submission, and resilient states `[MVP] P0`
**Depends on:** FE-2, FE-3 · **Covers:** PRD-05
**Deliverable:** review summary of the exact payload, single submit with duplicate guard, processing overlay with stages and cancel, error taxonomy from `frontend-architecture.md` §7.1, explicit retry.
**Acceptance:** every error class resolves to its defined screen; no stale output survives any error; progress never claims secure completion before acknowledgement; a version mismatch is terminal and uncoerced.
**Fallback:** deterministic fixture responses; live integration deferred.

### FE-5 · Fixture adapter and demo mode `[MVP] P0`
**Depends on:** FE-1 · **Covers:** PRD-11
**Deliverable:** `OviaAdapter` interface, `FixtureAdapter` with all seven outcomes, synthetic questionnaire and phantom image fixtures, operator drawer to select an outcome and reset.
**Acceptance:** every outcome reachable without a backend; fixtures contain no real patient data; CI blocks image files added outside `fixtures/`.
**Fallback:** none — this is what unblocks the whole frontend.

### FE-6 · Live HTTP adapter `[MVP] P1`
**Depends on:** FE-5, **ARCH-1** · **Covers:** PRD-05
**Deliverable:** `HttpAdapter` with multipart submit, abort, timeouts, `X-Request-Id`, `schema_version`, Zod response parsing, wire↔domain translation.
**Acceptance:** contract tests pass against `ovia-v1.yaml` for all outcomes; a malformed response is a terminal error, never a partial render.
**Fallback:** stay on the fixture adapter for the demo and say so.

### FE-7 · Result: recommendation panel and three condition cards `[MVP] P0`
**Depends on:** FE-4, UX-1, **UX-2 (the two safety conflicts must be closed first)** · **Blocked-value by:** ARCH-3 · **Covers:** PRD-06, PRD-08
**Deliverable:** locked result composition with the recommendation panel **above** the cards; three fixed-order condition cards (PCOS, Ovarian Cyst, Ovarian Tumor) with band name + three-segment non-traffic-light track, input-based rationale line, calibration status; explicit `not_screened` and `unavailable` card treatments; collapsed "About this result".
**Acceptance:** the recommendation panel renders unconditionally before any fetch resolves; the clinician-review string is byte-identical across every band combination; values are withheld without calibration metadata; card order never changes with band values; no green token appears on a result surface; a `not_screened` card never reads as low or absent risk; one card failing leaves the other two and the recommendation untouched.
**Fallback:** band-less card stating calibration status.

### FE-8 · Ultrasound viewer and model inspection `[MVP] P0`
**Depends on:** FE-4, UX-1 · **Blocked-vocabulary by:** ARCH-4 · **Covers:** PRD-07, PRD-08
**Deliverable:** image viewer with zoom/pan on an inverse stage, default-off inspection overlay with an opacity slider, persistent non-causal caption, and a text alternative.
**Acceptance:** the sonogram is never filtered, tinted, or enhanced; the overlay defaults off and is labelled model inspection; hiding it does not change the next step; no malignancy or O-RADS wording appears anywhere.
**Fallback:** finding list without the overlay.

### FE-9 · Localization completion `[MVP] P0`
**Depends on:** UX-1 · **Covers:** PRD-10
**Deliverable:** complete paired EN/ID bundles, locale-aware number and unit formatting, layouts sized for the longer language.
**Acceptance:** build fails on a missing key; switching language at every step preserves values and step; no safety string is truncated at 320 px in either language.
**Fallback:** none — bilingual is a PRD requirement.

### UX-1 · Copy and string table `[MVP] P0`
**Owner:** frontend lead · **Covers:** PRD-01, PRD-06, PRD-07, PRD-10
**Deliverable:** every mandatory string in EN and ID, human-reviewed, with the prohibited-vocabulary check applied to both.
**Acceptance:** no word from PRD §1.2 appears in either bundle; meaning is equivalent across languages.

### UX-2 · Close the Figma safety conflicts `[MVP] P0`
**Owner:** frontend lead · **Depends on:** none · **Blocks:** FE-7
**Deliverable:** in the Figma — replace the green/amber traffic-light bands with the `design-guidelines.md` §3.4 ramp; rewrite the recommendation copy to §2.1; remove the pre-selected primary "No" on eligibility questions; move the recommendation panel above the cards; fix the "validated" age hint and the truncated pregnancy hint; add the de-identification acknowledgement to the upload screen.
**Acceptance:** every item in `figma-reconciliation.md` §3 is closed and the outcome is dated in `log.md`. `FE-7` does not start until this passes.

### QA-1 · Contract and E2E suite `[MVP] P0`
Covers the full E2E matrix in `frontend-architecture.md` §10. **Acceptance:** all listed paths pass; failure blocks release.

### QA-2 · Accessibility and responsive review `[MVP] P0`
**Acceptance:** axe clean on every route in both locales; keyboard traversal complete; 320 px and 200% zoom verified; reduced-motion run verified; computed contrast ratios pasted into `design-guidelines.md` §3.6.

### QA-3 · Privacy review `[MVP] P0`
**Acceptance:** post-run storage assertion clean; EXIF strip verified; object-URL leak check clean; error-reporter payload contains only request-id, route, and code; no real data in `fixtures/` or git history.

## 4. Milestones

| Milestone | Closes | Not blocked by the model? |
|---|---|---|
| M1 · Shell | FE-0, FE-1 | yes |
| M2 · Capture | FE-2, FE-3, UX-1 | yes |
| M3 · Loop | FE-4, FE-5 | yes |
| M4 · Result | UX-2, FE-7, FE-8, FE-9 | yes (fallback states) |
| M5 · Integration | FE-6 + ARCH-1/2 | **no** |
| M6 · Hardening | QA-1, QA-2, QA-3, UX-2 | yes |

M1–M4 and M6 are fully demonstrable on fixtures. If the model slips, the demo runs on fixtures and **says so on screen**.

## 5. Merge and shared-file rules

- Shared files: `styles/tokens.css`, `locales/*`, `lib/schema/*`, `contracts/openapi/ovia-v1.yaml`. One owner edits per branch; changes announced before merge.
- Merge order follows contract dependencies, not convenience: `FE-0 → FE-1 → {FE-2, FE-3, FE-5} → FE-4 → {FE-7, FE-8} → FE-9 → FE-6 → QA-*`.
- A ticket touching `product-requirements.md` behavior must update the PRD in the same change and append a line to `log.md`.

## 6. Definition of done

Acceptance criteria pass · both locales complete · axe clean · keyboard traversal complete · 320 px legible · privacy assertions pass · affected canonical documents updated and `Updated` dates bumped · a dated line appended to `log.md`.
