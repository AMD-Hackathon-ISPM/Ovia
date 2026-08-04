# Ovia · Frontend Architecture

**Document type:** Frontend architecture
**Audience:** Frontend implementers, design, QA, and the ML engineer consuming the client contract
**Status:** Active · signed by the frontend lead, reconciled against the Figma prototype (2026-08-04). Server-side contracts remain open and isolated behind §7.
**Owner:** Frontend/design lead
**Updated:** 2026-08-04
**Canonical for:** Frontend stack, module boundaries, routing, state machine, session model, data flow, client validation, media handling, error taxonomy, performance budget, client privacy behavior, testing contract
**Companion documents:** [`design-guidelines.md`](design-guidelines.md), [`product-requirements.md`](product-requirements.md), [`figma-reconciliation.md`](figma-reconciliation.md), [`../contracts/openapi/ovia-v1.yaml`](../contracts/openapi/ovia-v1.yaml)

## How to read this document

Sections marked **Locked** are product or safety constraints. Everything else is a signed engineering decision: implement it as written or propose a change here first. Visual detail lives in `design-guidelines.md`; this document owns **structure and behavior**.

Server-side contracts are **not** settled. Any field, code, or status named here is the **frontend's proposal**, pinned in `contracts/openapi/ovia-v1.yaml` for the ML engineer's `ARCH-1`–`ARCH-4` sign-off. The adapter boundary in §7 exists so a change to the real contract touches one module, not the flow.

---

## 1. Architectural principles

1. **The clinician-review instruction is structural.** The recommendation panel renders unconditionally, before any fetch resolves and outside any animation gate. It cannot be hidden by a failed request, a skipped animation, a paused tab, or a collapsed section.
2. **Three independent outputs, one layout, no fusion.** PCOS, Ovarian Cyst, and Ovarian Tumor each resolve on their own, render in their own card, and fail on their own. **There is no combined "Ovia score" type anywhere in the codebase, and no function takes more than one result and returns a single value.** Card order is fixed and never re-ranks by band.
3. **Two input sources feed three outputs, asymmetrically.** The clinical questionnaire alone produces the PCOS estimate. The ultrasound image is required for Cyst and Tumor. Skipping the image therefore yields one scored card and two `not_screened` cards — a first-class state, never an omission or a blank.
4. **The participant is the user.** Ovia is self-serve: someone answers about their own body and reads their own result, often alone. Copy, error states, and the ineligible path are written for that person, not for an operator.
5. **Patient data is memory-only and short-lived.** No `localStorage`, `sessionStorage`, `IndexedDB`, service-worker cache, cookie, or analytics payload ever contains an answer, an image, or a result. Enforced by lint and test (§9).
6. **The client validates for the person; the server validates for correctness.** The client never coerces a payload to make a rejected request succeed.
7. **The flow degrades, it does not break.** Reduced motion, 320 px, 200% zoom, a slow connection, a denied file picker, and an ineligible answer each have a defined path.
8. **One place to change one thing.** Copy in the locale bundle, tokens in CSS variables, step order in the machine, wire format in the adapter.

---

## 2. Stack decisions (signed)

| Concern | Decision | Why this, not the alternative |
|---|---|---|
| Framework | **Next.js (App Router) + React, TypeScript strict** | File routing matches the fixed step sequence; RSC only for static shells — every capture surface is a client component because all state is in memory. |
| Rendering | **Client-rendered flow, statically shelled** | No SSR of patient data is possible or wanted. |
| Styling | **Tailwind CSS 4 over CSS custom properties** | Tokens declared once (`design-guidelines.md` §3.3) and consumed through Tailwind, so the design system survives a component-library swap. |
| Components | **shadcn/ui (Radix), copied into the repo** | Accessible dialog, select, radio group, checkbox, accordion without a runtime dependency we cannot patch. Semantic shadcn variables **map to** Ovia tokens. |
| Icons | **Tabler**, plus the Ovia wordmark and the four step glyphs exported from Figma as SVG | The step icons (heart-pulse, probe, review, document) are prototype-specific and must be exported, not approximated. |
| Illustrations | Exported from Figma as SVG, `aria-hidden` | The uterus/ovary illustrations on the result cards are decorative; they must not be the only cue for which condition a card describes. |
| State | **Zustand, single memory-only store**, no `persist` | Cross-route session state; the absence of `persist` is a privacy control, not a preference. |
| Step logic | **Explicit `useReducer` machine in `lib/flow/machine.ts`** | The step graph is a product and safety artifact (§4), pure and unit-testable — not scattered `router.push` calls. |
| Server state | **TanStack Query, `gcTime: 0`, retries off** | Zero cache time is deliberate: a result must never be re-served after a reset. |
| Forms | **React Hook Form + Zod**, one schema source | Drives client validation, TS types, and fixtures. |
| Image handling | **Canvas 2D + `createImageBitmap`**, no library | Re-encoding through a canvas **drops EXIF**, which is a privacy requirement (§9), not an optimization. |
| Charts | **None** | Three bands and a track are CSS. |
| i18n | Own typed dictionary, build-time key completeness check | Two languages, one namespace. Pending the decision in `figma-reconciliation.md` §4. |
| Testing | Vitest + Testing Library, Playwright, axe, MSW | §10. |

**Explicitly rejected:** any state library with persistence enabled; a component kit shipping its own opaque theme; runtime translation of safety copy; any analytics SDK on the eligibility, clinical, ultrasound, review, or result routes.

---

## 3. Module and folder structure

```text
frontend/
├── app/
│   ├── layout.tsx                   # locale provider, tokens, skip link, live regions, footer disclaimer
│   ├── page.tsx                     # /                splash (2s hard cap)
│   ├── eligibility/page.tsx         # /eligibility     3-question sub-flow
│   ├── not-eligible/page.tsx        # /not-eligible    reason-parameterised exit
│   ├── clinical/page.tsx            # /clinical        questionnaire
│   ├── ultrasound/page.tsx          # /ultrasound      optional upload + client gate
│   ├── review/page.tsx              # /review          summary + consent + submit
│   ├── result/page.tsx              # /result          recommendation + three cards
│   ├── about/page.tsx               # /about           scope, limitations, versions
│   └── error.tsx, not-found.tsx
├── components/
│   ├── ui/                          # shadcn primitives re-skinned to Ovia tokens
│   ├── flow/                        # StepIndicator, EligibilityDots, StepShell, BackGuard,
│   │                                #   ResetDialog, ProcessingOverlay, FooterDisclaimer
│   ├── eligibility/                 # BinaryAnswer, AgeField, IneligibleCard
│   ├── clinical/                    # Section, NumericField, DerivedBmi, SelectField,
│   │                                #   SegmentedChoice, SymptomRow, ErrorSummary
│   ├── ultrasound/                  # Dropzone, DeidentificationNotice, AttachedFileCard,
│   │                                #   SkipCaution, ImageViewer
│   ├── result/                      # RecommendationPanel, ConditionCard, RiskTrack,
│   │                                #   NotScreenedCard, UnavailableCard, InspectionFigure,
│   │                                #   AboutThisResult
│   └── system/                      # LanguageToggle, LiveRegion, PageError, InlineError
├── lib/
│   ├── flow/machine.ts              # step reducer + guards (pure)
│   ├── flow/eligibility.ts          # eligibility rules → eligible | ineligible(reason)
│   ├── session/store.ts             # Zustand memory-only store (4 slices)
│   ├── schema/clinical.ts           # Zod: fields, units, ranges, requiredness ← pins on ARCH-1
│   ├── schema/result.ts             # Zod parse of the response              ← pins on ARCH-1
│   ├── clinical/bmi.ts              # derived value, pure
│   ├── media/image.ts               # decode, EXIF-strip re-encode, downscale, gates
│   ├── api/client.ts                # fetch wrapper: timeout, abort, request-id, error taxonomy
│   ├── api/adapter.ts               # ← THE SWAP POINT: fixture ↔ live (§7)
│   ├── a11y/announce.ts             # single polite/assertive live-region controller
│   └── i18n/                        # provider, typed keys, formatters
├── locales/{en,id}.ts               # paired strings; build fails on a missing key (UX-1)
├── fixtures/                        # synthetic answers + phantom sonogram + canned responses
├── styles/tokens.css                # design-guidelines.md §3.3
└── tests/{unit,component,e2e,a11y}
```

**Dependency rule (lint-enforced):** `app/` may import `components/`, `lib/`, `locales/`. `components/` may import `lib/`, `locales/`. `lib/` imports neither. `lib/api/*` is the **only** place that knows the wire format; no component references a wire field name directly.

---

## 4. Routing and the flow state machine — **Locked step order**

Routes are a convenience. The logical order is fixed and enforced by reducer guards, not by the router. Note the two-tier structure the prototype establishes: **eligibility is a gate before the flow**, and the four-step indicator only appears once eligibility passes.

### 4.1 Step graph

```text
[splash] ──ready or 2s cap──▶ [eligibility]
                                   │  q1 age · q2 at least one ovary · q3 currently pregnant
                                   │
                    ┌── any disqualifying answer ──▶ [not-eligible(reason)] ──▶ review answers │ find a provider
                    │                                        │
                    │                                   (back to eligibility, answers preserved)
                    ▼
                              ┌──── language toggle (orthogonal; preserves step + values) ────┐
                              ▼                                                                │
   [clinical] ──schema valid──▶ [ultrasound] ──attach or skip──▶ [review] ──consent + submit──▶ [submitting]
      ▲  back                      ▲  back                          ▲  back                       preparing
      │                            │  client gate:                  │  consent unchecked =        uploading
      │                            │  accepted | rejected(reason)    │  Submit disabled            processing
      │                            │  rejected keeps prior image     │                                │
      │                            └─────────────────────────────────┘                                ▼
      │                                                                                          [result]
      │        retryable_error ──▶ [review] (retry offered, no stale output)
      │        terminal_error  ──▶ [error]  (technical, no output)
      └──────── reset · session timeout · leaving result ◀── clears answers, image, result, request-id ─┘
```

### 4.2 Screen map

| # | Route | Purpose | PRD |
|---|---|---|---|
| — | `/` | Splash, wordmark, 2 s hard cap, no loading claim | — |
| 0 | `/eligibility` | Age, at least one ovary, currently pregnant; 3-dot progress | PRD-01 |
| — | `/not-eligible` | Reason-specific exit; non-judgemental framing; review answers or find a provider | PRD-01 |
| 1 | `/clinical` | Questionnaire: demographics, reproductive history, current symptoms | PRD-02 |
| 2 | `/ultrasound` | Optional de-identified upload, client gate, skip caution | PRD-03, PRD-04 |
| 3 | `/review` | Chips + bullets + flagged symptoms + attached image + consent checkbox + Submit | PRD-05 |
| 4 | Processing (overlay on Review) | `preparing → uploading → processing`, cancel, duplicate guard | PRD-05 |
| 5 | `/result` | Recommendation panel + three condition cards + inspection + metadata | PRD-06, PRD-07 |
| — | `/about` | Scope, cohort, limitations, model versions | PRD-09 |
| — | Error / Reset (overlay) | Retryable and terminal errors, reset confirmation | PRD-05, PRD-09 |

### 4.3 Eligibility rules (`lib/flow/eligibility.ts`, pure)

| Question | Disqualifying answer | Ineligible reason | Required framing |
|---|---|---|---|
| Age | < 18, or non-numeric | `under_18` | This screening is only designed for ages 18 and above |
| At least one ovary | No | `no_ovary` | Ovarian screening does not apply; PCOS assessment also depends on ovarian findings |
| Currently pregnant | Yes | `pregnancy` | Ovarian findings are interpreted differently during pregnancy and this tool is not designed for that |

**Locked:** an ineligible exit is never framed as a health judgement, never shows any estimate, always offers a route back to review the answer (in case of a mis-tap), and always offers a clinician route. The three questions never pre-select an answer — the prototype's filled-primary "No" is removed (`design-guidelines.md` §6).

### 4.4 Navigation rules

- **Back** is allowed `eligibility ↔ clinical ↔ ultrasound ↔ review` and preserves every entered value. Forward past an incomplete step is blocked by a guard, not by a disabled button alone.
- **Browser back/refresh** maps to step-back through `BackGuard`; anything that would drop in-memory state raises the reset confirmation first.
- **Leaving `/result`** always requires the reset confirmation.
- **Ultrasound is skippable.** Skipping sets Cyst and Tumor to `not_screened` — rendered explicitly, never omitted.
- **Session timeout:** 15 min idle → warning with a 60 s countdown → automatic reset. The countdown is announced once, not per second.
- **Reset, timeout, and result acknowledgement** each clear answers, decoded image, object URLs (revoked), result, request-id, and error state.

### 4.5 Guards

| Guard | Condition |
|---|---|
| `canEnterEligibility` | splash resolved |
| `canEnterClinical` | all three eligibility answers present **and** none disqualifying |
| `canEnterUltrasound` | clinical Zod parse succeeds for all required fields |
| `canEnterReview` | `canEnterUltrasound` **and** (image accepted **or** explicitly skipped) |
| `canSubmit` | `canEnterReview` **and** consent checked **and** no submission in flight |
| `canEnterResult` | a parsed response exists with at least one condition resolved |

---

## 5. Session model

Four slices in one memory-only store. **No `persist`, no serializing middleware.**

```ts
type SessionState = {
  meta:       { locale: 'en' | 'id'; step: Step; requestId: string | null;
                startedAt: number; lastInteractionAt: number };
  eligibility:{ age: number | null; hasOvary: boolean | null; pregnant: boolean | null;
                outcome: 'pending' | 'eligible' | { ineligible: IneligibleReason } };
  clinical:   { values: Partial<ClinicalValues>; touched: Set<keyof ClinicalValues>;
                errors: Record<string, ClinicalErrorCode>; consent: boolean };
  media:      { status: 'empty' | 'decoding' | 'accepted' | 'rejected' | 'skipped';
                file: File | null;          // post-strip re-encoded blob only
                previewUrl: string | null;  // object URL; revoked on clear
                dimensions: { w: number; h: number } | null;
                deidentificationAcknowledged: boolean;
                rejectionReason: ImageRejectionCode | null };
  result:     { pcos: PanelState<ConditionResult>;
                ovarianCyst: PanelState<ConditionResult>;
                ovarianTumor: PanelState<ConditionResult>;
                recommendation: string | null;   // deterministic, locale-keyed, never model prose
                receivedAt: number | null };
};

type PanelState<T> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; data: T }
  | { status: 'not_screened'; reason: 'no_image_submitted' }
  | { status: 'unavailable'; code: PanelErrorCode };   // never carries partial or stale data
```

**Invariants, asserted in tests:**

- The three condition results are never merged, averaged, compared, or reduced to one value, and no selector returns a cross-condition aggregate.
- Transitioning a condition to `unavailable` or `not_screened` **discards** its previous `data`.
- `recommendation` is assembled from deterministic locale strings keyed by the three band values. It is **never** free text from a model, and it always ends with the clinician-review sentence.
- `reset()` returns the store to its initial object, revokes `previewUrl`, aborts any in-flight request, clears the request-id.
- `meta.requestId` is a client UUID used only to correlate an error report with a server log line. It is not a case identifier and is cleared on reset.

---

## 6. Client-side validation and media handling

### 6.1 Clinical questionnaire

Rendered **from the Zod schema**, not hand-written per field, so a schema change cannot orphan an input. Each field declares key, type, unit, range, requiredness, `inputMode`, EN/ID label and hint keys, and an error-code map.

Provisional field set, taken from the prototype (`Opt_14`, `Opt_15`) and marked `// PROVISIONAL — pins on ARCH-1`:

| Group | Fields |
|---|---|
| Demographics | height_cm, weight_kg, **bmi (derived, not an input)**, pregnancies, births, menopausal_status (`pre` / `post_natural` / `post_surgical`), family_history_ovarian_or_breast_cancer |
| Menstrual & reproductive | age_at_menarche, cycle_regularity (`regular` / `irregular`), hormonal_contraceptive_or_hrt (7 options incl. `not_sure`) |
| Current symptoms (multi-select) | irregular_or_absent_cycles, excess_hair_or_persistent_acne, pelvic_pain_or_bloating_over_3_weeks, early_satiety_or_appetite_loss, unexplained_weight_gain, unexplained_weight_loss |

Behavior: validate on blur and again for the whole form on submit-attempt; a failed submit-attempt moves focus **once** to a focusable error summary (`role="alert"`, `tabIndex={-1}`) listing each error as an in-page link, with every field carrying `aria-invalid` + `aria-describedby`. **Values are never cleared by an error.** Fields not in the schema never reach the payload, and the client never invents a default for an unanswered optional field.

**Conditional display:** `cycle_regularity` and `age_at_menarche` are shown for all statuses but the copy adapts for post-menopausal participants; `menopausal_status = post_surgical` must not silently imply ovary removal, since eligibility already asked that separately. **BMI is derived, displayed, and sent as height/weight — never entered directly, and never labelled with a judgemental adjective beyond the plain clinical range term.**

> **OWNER INPUT REQUIRED — ML engineer — `ARCH-1`**
>
> **Blocks:** `lib/schema/clinical.ts`, `FE-2`, `FE-6`, and the request half of `contracts/openapi/ovia-v1.yaml`
>
> **Required output:** which of the fields above the PCOS model actually consumes, their exact names, types, units, ranges, categorical encodings, requiredness, and the **missing-value representation** (omitted key vs. explicit null vs. sentinel). State which fields are model inputs and which are display-only context. Confirm whether BMI is sent derived or as raw height/weight.
>
> **Affected documents:** `frontend-architecture.md`, `product-requirements.md`, `contracts/openapi/ovia-v1.yaml`, `implementation-plan.md`
>
> **Completion rule:** replace this block with the signed field table; the frontend regenerates the schema and fixtures in one change and appends a line to `log.md`.

No provisional field may be described as validated or model-backed in the UI or the pitch.

### 6.2 Ultrasound image

Client pipeline, in order:

1. **Accept** `image/png`, `image/jpeg`, `image/webp`. Reject DICOM at the client with an explanation — DICOM carries identifiers in its headers and is `[V1]`, pending `ARCH-2`.
2. **Size gate:** reject > 15 MB before decode.
3. **Decode** via `createImageBitmap`; reject on decode failure.
4. **Dimension gate:** reject if either edge < 256 px, or the aspect ratio is implausible for a sonogram frame.
5. **Re-encode through canvas** at max edge 1024 px, PNG. This **strips EXIF and all metadata by construction**; the original `File` is discarded and never uploaded.
6. **De-identification acknowledgement** beside the preview: the participant confirms no name, medical record number, date of birth, or facility label is visible. This is an explicit control, not a tooltip — burned-in banner text is the common identifier leak in sonogram stills, and the prototype's own sample scan demonstrates it. No client-side check can be trusted to catch it.
7. **Accepted** → store re-encoded blob + preview object URL. **Rejected** → keep any previously accepted image, show the reason inline, offer replace. **Skipped** → set `media.status = 'skipped'` and surface the caution banner explaining that Cyst and Tumor cannot be screened.

Client rejection codes are a client enum mapped to guidance strings. **Server quality-gate codes are a separate enum owned by `ARCH-2`**; the adapter maps them into UI guidance. The two enums are not conflated.

> **OWNER INPUT REQUIRED — ML engineer — `ARCH-2`**
>
> **Blocks:** `FE-3`, the image half of the contract, retry-guidance strings
>
> **Required output:** accepted formats and colour space at inference; expected input resolution and preprocessing; whether client downscaling to 1024 px is lossy for the model; and the closed set of server quality-gate reason codes with a one-line meaning each.
>
> **Affected documents:** `frontend-architecture.md`, `design-guidelines.md`, `product-requirements.md`, `contracts/openapi/ovia-v1.yaml`
>
> **Completion rule:** replace with the signed preprocessing and reason-code table; frontend updates `lib/media/image.ts` and the guidance strings in one change.

---

## 7. API boundary and the fixture adapter

`lib/api/adapter.ts` exports one interface. Nothing else knows whether a response came from a server or a fixture.

```ts
export interface OviaAdapter {
  submit(input: SubmitInput, signal: AbortSignal): Promise<SubmitOutcome>;
}
// MODE=fixture → FixtureAdapter (synthetic, deterministic, offline)
// MODE=live    → HttpAdapter    (POST /api/v1/screening, multipart)
```

- `SubmitInput` and `SubmitOutcome` are **frontend domain types**, not wire types. `HttpAdapter` alone translates wire ↔ domain and parses with `lib/schema/result.ts`. When `ARCH-1` lands, only `HttpAdapter` and the Zod parsers change.
- `FixtureAdapter` covers, selectable from the demo drawer: all three conditions scored; image skipped (PCOS scored, two `not_screened`); one condition unavailable; server quality rejection; retryable timeout; terminal version mismatch; missing calibration metadata.
- Every request carries a client `X-Request-Id` and a `schema_version`. **A version mismatch is terminal** — the client never coerces or downgrades a payload.
- Timeout: 45 s soft (stage label changes), 90 s hard abort → retryable error.
- Retries are **not** automatic. Resubmitting personal health data is an explicit action.

### 7.1 Error taxonomy → UI behavior

| Class | Trigger | UI behavior |
|---|---|---|
| `client_validation` | local schema failure | inline field errors + focusable summary; no request sent |
| `image_rejected_client` | §6.2 gate | inline on the upload card; prior accepted image preserved |
| `image_rejected_server` | server quality gate | return to `/ultrasound` with mapped guidance; questionnaire intact |
| `retryable_error` | timeout, 502/503/504, network loss | return to `/review`, offer retry, **never show a stale or partial output** |
| `panel_unavailable` | one condition path fails | that card renders `unavailable`; other cards and the recommendation panel unaffected |
| `terminal_error` | schema/version mismatch, 4xx contract error | terminal technical screen, no output, reset offered |
| `metadata_missing` | response lacks model version or calibration status | **withhold the numeric value**, render the card band-less, keep the recommendation and limitations |

**Rule: no error path may leave a previously rendered output visible.** Tested explicitly.

---

## 8. Result composition — **Locked order**

`/result` renders in this DOM order, as a layout constant:

1. Screen title and the "not a diagnosis" subtitle.
2. **Recommendation panel** carrying the clinician-review instruction — rendered immediately and unconditionally, before any fetch resolves, outside any animation gate. *(This inverts the prototype, which places it last; see `figma-reconciliation.md` §3.)*
3. The three condition cards — **PCOS, Ovarian Cyst, Ovarian Tumor, in that fixed order**, equal width, equal header weight. Never re-ranked by band, never sorted by severity.
4. Optional model-inspection figure, collapsible, labelled non-causal. Hiding it must not change the next step.
5. Collapsed "About this result": signal source per condition, model versions, contract version, cohort, calibration status, limitations.

**Structural safety rules:**

- The recommendation panel is the dominant block for **every** band combination and **every** failure state, with the identical clinician-review sentence.
- The three cards are siblings with independent state. No wrapper computes anything across them.
- If all three are `unavailable`, the page still renders the title, the recommendation panel, and the limitations. Total model failure is never a blank screen.
- A `not_screened` card states why, and never reads as an absence of risk.
- The fully revealed layout is the **default DOM**; motion is an enhancement.

---

## 9. Client privacy behavior — **Locked**

| Control | Implementation | Verification |
|---|---|---|
| No persistence of patient data | Zustand without `persist`; ESLint bans `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` in `app/`, `components/`, `lib/session`, `lib/media` | lint + Playwright storage assertion after a full run |
| No service-worker caching of requests | SW scoped to static assets; API routes excluded | SW config test |
| EXIF/metadata removal | canvas re-encode discards the original `File` (§6.2) | unit test on a GPS-EXIF fixture |
| Object-URL hygiene | every `createObjectURL` has a matching revoke on clear, replace, reset, unmount | unit test + no-leak E2E |
| No analytics on patient routes | no analytics SDK installed; if added later, route-excluded and payload-allowlisted | CI dependency check |
| No patient data in error reports | reporter sends `requestId`, route, error code only | unit test on the reporter |
| Transient upload | one multipart request, no client queue, no "saved" or "upload complete" claim before acknowledgement | copy review + E2E |
| Real data never in fixtures | synthetic answers and a phantom sonogram only; CI blocks image files outside `fixtures/` | CI path rule |

The UI exposes no persistence affordance — no save, no history, no download in `[MVP]`. Adding one reopens the privacy model.

---

## 10. Performance budget and testing contract

**Budget** (mid-range Android, 4× CPU throttle, Slow 4G): route JS ≤ 120 KB gzip per capture route (result may exceed by 30 KB for the inspection figure) · LCP ≤ 2.5 s on `/` and `/clinical` · INP ≤ 200 ms · CLS ≤ 0.1 · image decode + re-encode of a 4 MP source ≤ 800 ms, off the interaction path, with a decoding state · one font family, subset, `font-display: swap`. CI enforces the bundle gate.

**Test matrix:**

| Layer | Covers |
|---|---|
| Unit | machine guards and transitions; eligibility rules for all three reasons; store invariants (no fusion, no stale data, reset completeness); `image.ts` gates and EXIF strip; BMI derivation; Zod round-trip |
| Component | every component's default/hover/focus/active/disabled/loading/error states; error-summary focus; consent-gated Submit; language switch preserving values |
| Contract | MSW against `ovia-v1.yaml` for all seven fixture outcomes |
| E2E | full path; skip-image path; each ineligible reason and the return-to-answers path; client rejection + replace; server rejection; retryable timeout + retry; terminal mismatch; single-card failure; reset; session timeout; back-guard |
| Accessibility | axe on every route in every active locale; keyboard-only traversal; 320 px and 200% zoom; reduced-motion run; screen-reader audit of the step indicator, eligibility pair, symptom rows, band track, and image viewer |
| Privacy | post-run storage assertion; object-URL leak check; error-reporter payload assertion |
| Safety | prohibited-vocabulary scan across every locale bundle; assertion that the clinician-review string is identical across all band combinations; assertion that no green token appears on a result surface |

**Definition of done for any frontend ticket:** acceptance criteria pass; every active locale renders without a missing key; axe clean; keyboard traversal complete; 320 px legible; privacy assertions pass; `design-guidelines.md` and this document updated if behavior changed.

---

## 11. Open frontend items

- The two safety conflicts in `figma-reconciliation.md` §3 must be closed in the Figma before `FE-7`.
- `UX-1` — final string table, including the rewritten recommendation copy.
- Bilingual decision (`figma-reconciliation.md` §4).
- Typeface family and weights exported from Figma (`design-guidelines.md` §4.2).
- Provisional clinical schema is replaced, not extended, when `ARCH-1` closes.
- Demo drawer specified but unbuilt.
