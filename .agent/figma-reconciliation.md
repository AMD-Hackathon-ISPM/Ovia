# Ovia · Figma Reconciliation Record

**Document type:** Reconciliation record
**Audience:** Frontend lead, ML engineer, PM
**Status:** Active · steps 1–5 complete; two conflicts require a decision
**Owner:** Frontend/design lead
**Updated:** 2026-08-04
**Canonical for:** What changed in the doc set to match the prototype, and what the prototype must change to match the safety rules
**Companion documents:** [`design-guidelines.md`](design-guidelines.md), [`frontend-architecture.md`](frontend-architecture.md), [`product-requirements.md`](product-requirements.md)

## How to read this document

This records the reconciliation described in the previous `design-guidelines.md` §13. **Where the prototype pinned a visual axis, the prototype won and the docs changed** — palette, type, step model, screen inventory, card layout. **Where the prototype conflicts with a locked medical-safety rule, the doc wins and the prototype must change** (§3). Both directions are logged.

## 1. What the prototype settled, and what changed in the docs

| Prototype fact | Previous doc assumption | Resolution |
|---|---|---|
| Brand is pink / rose (`Color_Pallete.png`, all screens) | Indigo accent, mauve ramp, "no pink" | **Docs changed.** `design-guidelines.md` §3 rewritten to the prototype palette. |
| Name renders as **Ovia** in body copy, **OVIA** in the wordmark | "OVIA" everywhere | **Docs changed.** Product name is Ovia; OVIA is the wordmark lockup only. |
| **Three** result conditions: PCOS, Ovarian Cyst, Ovarian Tumor | Two named signals (Kirana / Citra) | **Docs changed.** The invented codenames are dropped. Three independent outputs from two input sources. |
| PCOS is scored from clinical inputs alone; Cyst and Tumor require the image | Image optional, imaging = one signal | **Docs changed.** Confirmed and made explicit — the "couldn't be screened without an ultrasound image" state is now a first-class panel state. |
| Steps are **Clinical · Ultrasound · Review · Results**, with a separate pre-flow **Eligibility check** carrying its own 3-dot progress | Gate → intake → ultrasound → review → result | **Docs changed.** Eligibility is a distinct 3-question sub-flow *before* the step indicator appears. |
| Eligibility asks: age, at least one ovary, currently pregnant | One combined gate screen with three acknowledgements | **Docs changed.** These are screening-eligibility *questions*, not consent acknowledgements. Consent moved to the Review checkbox, where the prototype actually puts it. |
| A dedicated **ineligible** screen with "Review my answers" + "Find a nearby provider" | Not specified | **Docs changed.** New route and required copy. |
| Splash / preloading screen with the wordmark | Not specified | **Docs changed.** Added as a route with a hard time cap. |
| Review shows chips (42 / 26.6 BMI / Pre-Menopausal), bullets, flagged symptoms, image thumbnail with Change, a consent checkbox gating Submit | Generic review summary | **Docs changed.** Component specs now match; the disabled-Submit state in `Opt_20.png` is the specified default. |
| Clinical form fields: height, weight, auto-BMI, pregnancies, births, menopausal status, family history, menarche, cycle regularity, contraceptive/HRT, symptom checkboxes | Provisional PCOS-only schema | **Docs changed.** Provisional schema replaced with the prototype's field set — still pinned on `ARCH-1`. |
| The prototype's sample ultrasound has burned-in text (`OVARY`, `FOLLICLE`, device banner) | De-identification acknowledgement required | **Unchanged and reinforced.** This is exactly the leak the acknowledgement exists for. |
| No language toggle appears anywhere | EN + ID bilingual required | **Open decision (§4).** |

## 2. Screen inventory → route map

| Figma frame | Route / state |
|---|---|
| `Preloading` | `/` splash |
| `Opt_1` (age) | `/eligibility` step 1 of 3 |
| `Opt_11` (at least one ovary) | `/eligibility` step 2 of 3 |
| `Opt_12` (pregnant) | `/eligibility` step 3 of 3 |
| `Opt_13` (ineligible — pregnancy) | `/not-eligible?reason=pregnancy` |
| `Opt_14`, `Opt_15` (clinical form, dropdowns open) | `/clinical` |
| `Opt_16` (empty dropzone) | `/ultrasound` — `empty` |
| `Opt_17` (file attached) | `/ultrasound` — `accepted` |
| `Opt_18` (consent checked, Submit enabled) | `/review` — `ready` |
| `Opt_20` (consent unchecked, Submit disabled) | `/review` — `blocked` (default) |
| `Opt_19` (all three scored) | `/result` — full |
| `Opt_21` (cyst + tumor unscreened) | `/result` — image skipped |
| Recommended-action text block | `/result` — recommendation panel content |

**States the prototype does not show, now specified in the docs:** field validation errors, error summary, image rejected (client and server), processing/submitting, retryable error, terminal error, one-panel-unavailable, reset confirmation, session timeout, 320 px layout, reduced motion, and the ineligible variants for age and no-ovary. `Opt_21`'s empty Recommended Action box is treated as an unfinished frame, not a state.

## 3. Conflicts — the prototype must change

> **CONTRADICTION — BLOCKS IMPLEMENTATION**
>
> **Conflict:** `Opt_19` / `Opt_21` render **LOW in green** and **MODERATE in amber** — a traffic-light scale. `product-requirements.md` §1.2 and `design-guidelines.md` §3.1 prohibit green on a result surface, because green reads as clearance and this tool cannot exclude PCOS, a cyst, or a tumour. A green LOW next to "Continue routine gynecological checkups as usual" is a false-reassurance state, and it is the single highest-risk element in the prototype.
>
> **Canonical documents affected:** `design-guidelines.md` §3.4, `product-requirements.md` §3.6–3.7
>
> **Owner / due:** Frontend lead, before `FE-7`
>
> **Resolution rule:** implementation resumes once the bands use the non-traffic-light rose ramp in `design-guidelines.md` §3.4 and the Figma is updated to match. The band label, its position in the three-segment track, and an icon carry the meaning; colour only reinforces.

> **CONTRADICTION — BLOCKS IMPLEMENTATION**
>
> **Conflict:** the result copy sample reads "**Moderate risk of PCOS identified**", "Ovarian Cyst and Ovarian Tumor screenings show **low risk based on current findings**", and "**Continue routine gynecological checkups as usual.**" Three problems: *identified* asserts a finding; *low risk* on the imaging panels states a conclusion the model cannot support; and the closing line is an active recommendation **against** follow-up, which contradicts the footer disclaimer on the same screen.
>
> **Canonical documents affected:** `product-requirements.md` §1.2, §3.6, §3.7; `design-guidelines.md` §2
>
> **Owner / due:** Frontend lead (`UX-1`), before `FE-7`
>
> **Resolution rule:** every recommendation string is rewritten to the patterns in `design-guidelines.md` §2.1, keeps the clinician-review instruction identical across all bands, and never tells a participant that routine checkups are sufficient.

**Two lower-severity notes:**

- The eligibility hint reads "This screening tool is **validated** for ages 18 and above." Nothing about this tool is validated. Change to: this screening is only designed for ages 18 and above.
- `Opt_12`'s hint reads "Pelvis findings are interpreted during pregnancy" — the sentence is truncated and reads as a non-sequitur. Change to: ovarian findings are interpreted differently during pregnancy.

## 4. Open decision — bilingual

The prototype is English-only. The doc set requires EN + Bahasa Indonesia. Options: (a) keep the bilingual requirement and add a toggle to the eligibility and results screens — cost is a full ID string pass plus layouts sized for the longer language; (b) demote bilingual to `[V1]` and ship English-only. **Recommendation: (a) if any Indonesian participant will ever self-screen with this, since the safety copy is the whole point of the product and it cannot do its job in a language the reader does not have.** Decide before `UX-1` starts.

## 5. Still open after reconciliation

- `ARCH-1` — the clinical field list in `Opt_14`/`Opt_15` is now the provisional schema, but the ML engineer must confirm which of those fields the model actually consumes.
- `ARCH-2` — server image quality-gate reason codes.
- `ARCH-3`/`ARCH-4` — band thresholds and calibration status for all three outputs.
- Computed contrast ratios for the new palette (`design-guidelines.md` §3.6).
- Typeface confirmation: the prototype uses a geometric sans with a double-storey `a` and a tall x-height. Export the exact family and weights from the Figma text styles before `FE-0`.
