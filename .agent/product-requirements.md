# Ovia · Product Requirements Document

**Document type:** Product requirements
**Audience:** Frontend, ML, design, QA, reviewers
**Status:** Active · reconciled against the Figma prototype (2026-08-04). Two safety conflicts open — see [`figma-reconciliation.md`](figma-reconciliation.md) §3.
**Owner:** Frontend/design lead (behavior and safety) · ML engineer (model semantics)
**Updated:** 2026-08-04
**Canonical for:** User-visible behavior, medical-safety rules, feature requirements, acceptance criteria
**Companion documents:** [`frontend-architecture.md`](frontend-architecture.md), [`design-guidelines.md`](design-guidelines.md), [`figma-reconciliation.md`](figma-reconciliation.md), [`evidence-register.md`](evidence-register.md)

## How to read this document

This document controls what Ovia does and what it must never do. It does not choose a stack or a visual system. **Medical safety, cohort limits, eligibility, and user-facing risk meaning may not be deferred to implementation.**

## 1. Scope language

`[MVP]` required · `[V1]` documented, not built now · `[Stretch]` only after every P0 criterion passes · `[OUT]` prohibited.

### 1.1 Non-negotiable invariants

1. Ovia is an **investigational screening research prototype**, not a diagnostic device and not a substitute for clinical assessment or imaging interpretation.
2. The documented cohort is **adults aged 18+ who have at least one ovary and are not currently pregnant**.
3. **Every participant is directed to clinician review regardless of any output.**
4. Ovia produces **three independent outputs** — PCOS, Ovarian Cyst, Ovarian Tumor — from **two input sources**: the clinical questionnaire (PCOS) and the ultrasound image (Cyst and Tumor). The three outputs are **never fused, averaged, ranked against each other, or presented as one score.**
5. No output may state or imply a **malignancy determination**, a benign/malignant call, or an **O-RADS category**.
6. Personal health inputs are processed **transiently**: not retained, not persisted client-side, not request-body logged.
7. Uploaded images must be **de-identified before upload**, with an explicit acknowledgement.
8. Published evidence and Ovia's own results are labelled separately.
9. Saliency and heatmaps are **model inspection**, not reasoning or causal explanation.
10. No accuracy, calibration, or performance figure appears anywhere until it traces to a reproducible recorded run.

### 1.2 Prohibited output vocabulary — **Locked**

diagnosis · diagnosed · **identified** · **detected** · confirmed · positive · negative · normal · healthy · clear · cleared · benign · malignant · cancer · ruled out · excluded · **validated** · "no follow-up needed" · **"continue routine checkups as usual"** · any O-RADS category · any single combined Ovia score.

The bolded entries are present in the current prototype copy and must be removed (`figma-reconciliation.md` §3).

## 2. Users and roles

Ovia is **participant-facing self-screening**. The person answering the questions is the person the result is about.

| Role | MVP need | MVP capability |
|---|---|---|
| Participant (primary user) | Understand what this is, complete it on a phone, and know the next step without being frightened or falsely reassured | Eligibility check, questionnaire, optional image upload, review and consent, three-condition result, clinician-review instruction |
| Ineligible participant | Be excluded without being made to feel judged or dismissed | A reason-specific exit that offers a route back to their answers and a route to a clinician |
| Demo operator | Show the full workflow safely | Synthetic fixtures for every outcome, reset with no retained data |
| Reviewer | Inspect scope and limits | Model versions, calibration status, cohort, limitations, inspection meaning |

Accounts, saved history, dashboards, and clinician-side workflows are `[V1]`.

## 3. MVP feature specification

### 3.1 Eligibility · PRD-01 `[MVP]`

**Behavior:** three sequential questions with a 3-step progress indicator — age; whether the participant currently has at least one ovary; whether the participant is currently pregnant. Neither answer is pre-selected on any binary question. The persistent prototype-disclaimer footer is present on every screen including this one.

**Failure states:** any disqualifying answer routes to a reason-specific exit screen. That screen states the reason plainly, **explicitly says it is not a health judgement**, offers "review my answers" (returning to eligibility with answers intact, for mis-taps), and offers a route to a clinician. It shows no estimate and no partial result.

**Acceptance:** cannot reach the questionnaire with any disqualifying answer; no binary question ships a pre-selected or visually favoured answer; the age hint does **not** use the word "validated"; each of the three ineligible reasons has its own tested screen.

### 3.2 Clinical questionnaire · PRD-02 `[MVP]`

**Behavior:** renders **only** schema-defined fields, grouped as Demographics, Menstrual and reproductive history, and Current symptoms. Units are visible. BMI is derived from height and weight, displayed, and never entered directly. Validation on blur and on submit-attempt; a focusable error summary on failure; values preserved on error.

**Acceptance:** an unsupported or hard-coded field never reaches the payload; a field error never clears its value; the error summary is reachable and announced; the derived BMI never carries a judgemental label beyond the plain clinical range term.

### 3.3 Ultrasound upload · PRD-03 `[MVP]`

**Behavior:** the image is **optional**. Accept PNG/JPEG/WebP; enforce the client gate in `frontend-architecture.md` §6.2; re-encode through canvas to strip metadata; show a preview with the **de-identification acknowledgement**; allow replace; allow skip, with a caution banner stating plainly that Ovarian Cyst and Ovarian Tumor cannot be screened without it.

**Acceptance:** original file bytes are never uploaded; a rejected file preserves a previously accepted one; skipping yields two `not_screened` cards; DICOM is rejected with an explanation; the de-identification acknowledgement is an explicit control, not a tooltip.

### 3.4 Image quality gate · PRD-04 `[MVP]`

**Behavior:** the client gate rejects unusable files locally; the server gate may reject after upload with a reason code mapped to actionable guidance. A rejected image is **never scored**.

**Acceptance:** every reason code has guidance copy in every active locale; a server rejection returns the participant to the upload step with the questionnaire intact; no output is shown for a rejected image.

> **OWNER INPUT REQUIRED — ML engineer — `ARCH-2`** — closed set of server quality-gate reason codes and meanings. **Blocks:** PRD-04 acceptance and the guidance strings.

### 3.5 Review and submission · PRD-05 `[MVP]`

**Behavior:** the review screen shows exactly what will be sent — summary chips, history bullets, reported symptoms, and the attached image or an explicit "no image attached" — with an edit route back to each section. A **consent checkbox gates Submit and is unchecked by default.** Duplicate submission is prevented while in flight; stages are `preparing → uploading → processing`; cancel returns to Review with state intact; retry is explicit.

**Acceptance:** Submit is unavailable until consent is checked, with the reason exposed; progress never claims completion before server acknowledgement; a retryable error returns to Review showing no stale output; a schema-version mismatch is terminal and the payload is never coerced; reported symptoms are labelled as reported, never as findings.

### 3.6 Result · PRD-06 `[MVP]`

**Required content, in order:** title and "not a diagnosis" subtitle → **recommendation panel carrying the clinician-review instruction** → three condition cards (PCOS, Ovarian Cyst, Ovarian Tumor, fixed order) → optional model inspection → collapsed metadata and limitations.

**Per card:** condition name, band (**Lower / Intermediate / Higher model-estimated likelihood**), the likelihood value **only if the artifact is genuinely calibrated**, calibration status in words, and one reason line describing the **inputs used**, never a cause.

**Safety behavior — Locked:**

- **No traffic-light colour scale and no green anywhere on a result surface.** Bands use the ramp in `design-guidelines.md` §3.4, carried redundantly by label, position, and fill.
- A Lower band never uses checkmarks, reassurance, or copy that discourages review.
- No output uses any word in §1.2.
- If calibration or model metadata is missing, **withhold the value** and say so.
- The recommendation panel is identical in wording and prominence for every band combination and every failure state, and **never** tells the participant that routine care is sufficient.
- Recommendation text is assembled from deterministic locale strings keyed by the band values. It is never model-generated prose.

**Acceptance:** an automated scan finds no prohibited word in any locale bundle; the clinician-review string is byte-identical across every band combination; the value is never rendered at hero scale; a card whose model failed shows `unavailable` with no output and does not affect the others.

> **OWNER INPUT REQUIRED — ML engineer — `ARCH-3`** — band thresholds, their derivation, and whether each shipped artifact is calibrated and by what method. Until closed, the UI renders `calibration: uncalibrated` and **withholds every numeric value**.

### 3.7 Imaging conditions — Ovarian Cyst and Ovarian Tumor · PRD-07 `[MVP]`

**Behavior:** both are screened **only** from the uploaded image. Without an image, both render `not_screened` with the reason stated and no estimate.

**Safety behavior — Locked:**

- Output describes **image features the model responded to**, never an identified, classified, or excluded cyst or tumour.
- **No malignancy probability, no benign/malignant call, no O-RADS category, no severity ranking, no colour-coded severity.**
- A `not_screened` or `unavailable` card never reads as normal, clear, or an absence of risk.
- Any inspection overlay is labelled model inspection and can be hidden without changing the next step.

> **OWNER INPUT REQUIRED — ML engineer — `ARCH-4`** — for each imaging condition: the output vocabulary, confidence semantics and scale, and whether any localization or measurement is genuinely produced. Until closed, the frontend uses a provisional vocabulary marked in code and excluded from every demo claim.

### 3.8 Non-fusion · PRD-08 `[MVP]` — **Locked**

The three outputs are never combined, averaged, weighted, re-ranked, or presented as one score, and no copy may suggest that one confirms, supports, or contradicts another.

**Acceptance:** an automated check finds no function returning a cross-condition aggregate; no string in any locale bundle refers to a combined score; card order is fixed and independent of band values.

### 3.9 Privacy and reset · PRD-09 `[MVP]`

No personal health data in browser persistence, analytics, or request logs; in-memory only for the active session; reset, acknowledgement, and session timeout each clear answers, image, preview URLs, result, and request-id.

**Acceptance:** automated checks find no input in any storage surface after a complete run; error reports contain only request-id, route, and error code; fixtures and screenshots contain no real patient data.

### 3.10 Localization · PRD-10 `[MVP]`

English plus Bahasa Indonesia, complete and human-reviewed, with a one-tap toggle; switching preserves the step and every value; safety, eligibility, consent, and result copy are deterministic; a missing mandatory translation fails the build.

> **OPEN DECISION** — the prototype is English-only. See `figma-reconciliation.md` §4. If bilingual is demoted to `[V1]`, this requirement changes and every layout constraint sized for the longer language is relaxed; that decision must be recorded in `log.md` before `UX-1` starts.

### 3.11 Demo fixtures · PRD-11 `[MVP]`

Synthetic answers and a synthetic or phantom sonogram only. Selectable paths: all three scored; image skipped; one card unavailable; each ineligible reason; quality rejection; retryable timeout; terminal mismatch; missing calibration metadata. **Real patient data is `[OUT]` in every fixture, screenshot, video, and commit.**

### 3.12 Accessibility · PRD-12 `[MVP]`

WCAG 2.2 AA; keyboard-operable; 320 px and 200% zoom; reduced motion; text alternatives for the sonogram, overlay, and band track; decorative illustrations `aria-hidden`; errors persist until resolved; one primary action per screen.

## 4. Out of MVP

**[V1]:** accounts and history; DICOM ingest; multi-frame or cine ultrasound; report export; clinician-side workflow; provider directory integration behind "find a nearby provider"; dark mode; offline mode; prospective validation; regulatory and ethics work.

**[OUT]:** diagnosis or exclusion of any condition; malignancy classification; O-RADS assignment; treatment, medication, or fertility advice; a fused score; retention of participant data; real patient data in demos; any accuracy claim without a reproducible run.

## 5. MVP acceptance summary

1. A case completes end to end on a phone-width viewport in every active locale.
2. Every eligibility rule blocks progress and routes to its own exit screen.
3. Every error, rejection, timeout, and partial-failure path resolves to a defined screen with no stale output.
4. The clinician-review instruction is present, identical, and dominant on every result state including total failure.
5. No prohibited word appears in any locale bundle.
6. No combined score exists in code or copy; card order is fixed.
7. No green appears on any result surface.
8. No participant data survives a run in any storage surface.
9. Axe passes on every route in every active locale; keyboard traversal is complete.
10. Every displayed number traces to the evidence register or a recorded reproducible run.

## 6. Traceability

Every `[MVP]` feature forms: **evidence or product decision → PRD requirement → architecture or interface → implementation ticket → acceptance criterion → verification result.**
