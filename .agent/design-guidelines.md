# Ovia · Design Guidelines

**Document type:** Design guidelines
**Audience:** Frontend, design, product, QA, reviewers
**Status:** Active · reconciled against the Figma prototype (2026-08-04). Two safety conflicts are open — see [`figma-reconciliation.md`](figma-reconciliation.md) §3.
**Owner:** Frontend/design lead
**Updated:** 2026-08-04
**Canonical for:** Visual direction, tokens, typography, spacing, component anatomy and states, safety microcopy, band presentation, ultrasound treatment, motion, localization, accessibility
**Companion documents:** [`frontend-architecture.md`](frontend-architecture.md), [`product-requirements.md`](product-requirements.md), [`figma-reconciliation.md`](figma-reconciliation.md), [`implementation-plan.md`](implementation-plan.md)

## How to read this document

Sections marked **Locked** are product or safety constraints and may not be redesigned away. Everything else is signed against the prototype. Structure and behavior live in `frontend-architecture.md`; this document owns appearance and interaction detail.

**Where this document and the Figma disagree:** the Figma wins on visual axes (palette, type, layout, card structure). This document wins on the four safety axes — result vocabulary, band colour semantics, the clinician-review instruction, and what an unscreened or unavailable panel may say. Both conflicts are recorded in `figma-reconciliation.md` §3 and must be fixed **in the Figma**.

---

## 1. Design direction

Ovia is a **participant-facing** screening tool. Someone answers questions about their own body, uploads their own scan, and reads their own result, often alone and often worried. The direction the prototype establishes is **soft, warm, and unhurried** — rose and blush on white, generous vertical space, one question or one decision per screen, large centred controls.

That softness is a deliberate counterweight, not decoration: the subject matter is frightening, and a clinical-grey interface would make it more so. But **softness must never become reassurance.** The palette can be gentle; the words and the band semantics cannot be. This is the tension the whole design has to hold, and every conflict in `figma-reconciliation.md` §3 is a place where the prototype let softness win over honesty.

The most information-dense element is the **grayscale sonogram**, so it appears on `--surface-inverse` with no filter, no enhancement, and no chroma competing with it.

**Avoid:** traffic-light result colours; celebratory or reassuring states; medical-scan theatrics, sweep lines, neon; glass and blur as decoration; gradient text; dense dashboards; stock photography of people; anything that makes a lower band look like good news.

---

## 2. Locked voice and safety language

- Plain, direct, warm, second person ("your", "you"). Sentence case in body; the prototype's letter-spaced small caps are reserved for the eligibility title and step labels.
- No hype, no emoji, no exclamation marks, no celebratory language.
- Preferred vocabulary: **model-estimated likelihood**, **screening**, **finding**, **clinician review**, **model inspection**, **research prototype**.
- **Never** say: diagnosis, diagnosed, identified, detected, confirmed, positive, negative, normal, healthy, clear, cleared, benign, malignant, cancer, ruled out, excluded, validated, "no follow-up needed", "routine checkups as usual", or any O-RADS category.
- Every result state carries the **same** clinician-review instruction, worded identically and given identical prominence.
- Heatmaps and saliency are **model inspection**, never reasoning, cause, or explanation.

### 2.1 Locked copy patterns

| Context | Required meaning | Prototype status |
|---|---|---|
| Persistent footer | Ovia is a screening research prototype. It does not diagnose or rule out PCOS or any other ovary-related condition. Every participant should receive confirmatory evaluation. | **Keep as-is.** The prototype's footer is correct and should stay on every screen. |
| Eligibility age hint | This screening is only designed for ages 18 and above | Fix: prototype says "validated" |
| Pregnancy hint | Ovarian findings are interpreted differently during pregnancy | Fix: prototype sentence is truncated |
| Ineligible screen | This is not a judgement about your health; this specific tool does not apply to your situation, and a clinician can still assess any symptoms you are concerned about | **Keep.** The prototype's wording here is genuinely good. |
| Lower band | A lower model-estimated likelihood does not exclude this condition | Fix: prototype implies clearance |
| Higher band | Prioritize clinician review; this remains a model estimate, not a diagnosis | Fix: prototype says "identified" |
| Not screened (no image) | This condition was not screened because no ultrasound image was submitted. No estimate was produced. | **Keep the concept**, tighten wording |
| Panel unavailable | No estimate was produced for this condition. Retry, or proceed with clinician review. | Not in prototype |
| Recommended action | Always ends with the clinician-review instruction. **Never** ends by telling the participant routine care is sufficient. | Fix |
| De-identification | Confirm no name, medical record number, date of birth, or facility label is visible in the image | Not in prototype — must be added |

---

## 3. Color system

### 3.1 Locked semantic rules

- Colour never communicates likelihood, validity, completion, or error **alone**. Always paired with text, icon, or position.
- **No green anywhere on a result surface.** A lower band is not clearance.
- **No traffic-light ramp.** See §3.4 and the conflict in `figma-reconciliation.md` §3.
- Error, warning, and success remain distinguishable under common colour-vision deficiencies.
- Text and controls meet WCAG 2.2 AA.
- The sonogram is never tinted; overlays use a single perceptually ordered hue with a text alternative.

### 3.2 Theme

**Light only for `[MVP]`.** Dark mode is `[V1]`; dark selectors stay class-gated and inactive.

### 3.3 Tokens

Extracted from the prototype. Values marked *verify* must be confirmed against the Figma styles before `FE-0`.

```css
:root {
  /* surfaces */
  --canvas:          #FFFFFF;
  --surface:         #FFFFFF;
  --surface-sunken:  #F5F5F5;   /* quote block, disabled fill */
  --surface-inverse: #111111;   /* sonogram stage only */

  /* brand — rose family, from Color_Pallete.png */
  --brand:           #D06A78;   /* verify: primary button, active step, headings-accent */
  --brand-hover:     #B85764;
  --brand-pressed:   #A24C58;
  --brand-tint:      #FADDE1;   /* verify: chips, icon circles, dropzone fill, selected row */
  --brand-tint-soft: #FFC0CB;   /* verify: wordmark, illustration */
  --on-brand:        #FFFFFF;

  /* line */
  --border-subtle:   #E2E8F0;   /* decorative dividers, inactive step connector */
  --border-strong:   #4A5568;   /* essential control outlines (secondary button, inputs) */

  /* text */
  --ink:             #3D4759;   /* verify: headings and body, slate */
  --ink-muted:       #8A94A6;   /* verify: hints, placeholders, inactive step labels */
  --ink-footer:      #4A5568;   /* persistent disclaimer */

  /* status (process, never clinical) */
  --warning:         #7A5B12;  --warning-surface: #FAEBC8;  /* the skip/caution banner */
  --error:           #8C2F2A;  --error-surface:   #FBE9E7;
  --error-strong:    #B3261E;
  --info:            #2C4C7A;  --info-surface:    #E8EFF9;
  --neutral-step:    #D9D9D9;  /* inactive step circle */
  --focus:           #A24C58;  /* 2px ring + 1px offset */

  /* likelihood ramp — rose, monotonic lightness, NOT traffic-light */
  --band-lower:      #F3D3D8;   /* pale blush — reinforcement only */
  --band-mid:        #D98C8C;   /* dusty rose */
  --band-higher:     #8E3B47;   /* deep wine */

  /* inspection overlay — single sequential hue */
  --insp-1: #FDF0D5;  --insp-2: #F2C48A;  --insp-3: #D9884F;  --insp-4: #8E4A2A;
}
```

`--brand` carries **actions and wayfinding only** (buttons, active step, section headings). It never appears as a band fill, so a result can never borrow the brand's positive tone.

### 3.4 Band presentation — **Locked, and the prototype must change**

Three bands per condition: **Lower**, **Intermediate**, **Higher model-estimated likelihood**.

The prototype renders `LOW` in green and `MODERATE` in amber. That is a traffic-light scale and it is prohibited: green reads as clearance, and Ovia cannot exclude PCOS, a cyst, or a tumour. Replace with:

| Band | Token | Rendering |
|---|---|---|
| Lower | `--band-lower` | Pale blush fill in a three-segment outlined track, segment 1 filled |
| Intermediate | `--band-mid` | Dusty rose, segment 2 |
| Higher | `--band-higher` | Deep wine, segment 3. Not an alarm colour — this is prioritization |

Every band is carried by **three redundant cues**: the band named in words, its position in the track, and the fill. Text never sits on a band fill. Lower carries **no** green, no checkmark, no reassurance, and no different motion from Higher.

### 3.5 Not-screened and unavailable panels

The prototype's grey "couldn't be screened without an ultrasound image" card (`Opt_21`) is the right idea: **desaturated, an em-dash in place of the band, and a plain reason.** Keep it. Extend the same treatment to `unavailable` (the model failed) with its own wording. Neither state uses a band colour, and neither may read as an absence of risk.

### 3.6 Contrast evidence (WCAG 2.2)

Run `design/contrast.mjs` on the §3.3 values and paste the ratios here before `QA-2`. Required: body ≥ 4.5:1, large/UI ≥ 3:1, graphical ≥ 3:1.

**Known risks to check first:** `--ink-muted` on white for the hint text under form fields; white on `--brand` for the primary button; `--warning` on `--warning-surface` in the skip banner; `--band-lower` against white (exempt from the 3:1 fill rule **only** because the track outline and the word label carry it — record the exemption).

**Prohibited combinations:** any text on a band fill; `--border-subtle` as the sole boundary of an essential control; placeholder lighter than `--ink-muted`; green on any result surface; a disabled control whose only affordance is reduced opacity.

---

## 4. Typography

### 4.1 Locked constraints

Body ≥ 16 CSS px · every numeric labelled with a unit or scale · touch targets ≥ 44 × 44 px with ≥ 8 px between · critical copy usable at 320 px and 200% zoom.

### 4.2 Families

The prototype uses a single geometric sans with a tall x-height, double-storey `a`, and generous counters, at three weights (regular, semibold, bold) plus a letter-spaced small-caps treatment.

> **OPEN — frontend lead, before `FE-0`:** export the exact family and weights from the Figma text styles and record them here. If the prototype family is not OFL-licensed or not available via `next/font`, substitute **Poppins** or **Figtree**, both of which match the geometry and ship free.

**Numerics:** the prototype sets numbers in the same family (the 42 / 26.6 review chips). Keep one family, but apply `font-variant-numeric: tabular-nums` to every measurement, BMI, age, likelihood value, version string, and file size so figures align and do not jitter as they update.

Loading: `next/font`, Latin subset, `font-display: swap`, system fallback declared so first paint is legible.

### 4.3 Type scale (fixed rem)

| Step | Size / line-height | Weight |
|---|---|---|
| Eligibility title (small caps) | `1.5rem` / 1.2, `+0.12em`, uppercase | 700 · `--brand` |
| Screen title (Results, Review, Ultrasound) | `1.75rem` / 1.2 | 700 · `--ink` |
| Question heading | `1.375rem` / 1.3 | 700 · `--ink` |
| Section heading (Demographics, Current Symptoms) | `1.125rem` / 1.3 | 700 · `--brand` |
| Card title (PCOS, Ovarian Cyst) | `1rem` / 1.25, `+0.06em` | 700 · `--on-brand` |
| Band name | `1.375rem` / 1.2, `+0.04em`, uppercase | 700 |
| Body | `1rem` (16 px floor) / 1.55 | 400 |
| Label | `1rem` / 1.5 | 600 |
| Hint | `0.9375rem` / 1.45 | 400 · `--ink-muted`, non-critical only |
| Review chip value | `1.5rem` / 1.1, tabular | 700 · `--brand` |
| Footer disclaimer | `0.875rem` / 1.5, centred | 400 · `--ink-footer` |

Cap prose at 65–75 ch. `text-wrap: balance` on headings, `text-wrap: pretty` on prose.

---

## 5. Spacing, radius, layout

- **Spacing scale (4 px base):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80. The prototype's defining trait is *generous vertical space* around a single decision — preserve it; do not compress screens to fill the viewport.
- **Radius:** 12 px cards and panels; 10 px inputs, buttons, and banners; 8 px chips; 4 px track segments; pill for step connectors and tags. No other radii.
- **Content width:** single centred column, max `26rem` (416 px) on phone, `34rem` on tablet+. The result grid widens to `56rem` at ≥ 900 px. Prose caps at 70 ch.
- **Breakpoints:** 320 floor, `sm` 480, `md` 768, result grid 900, `lg` 1120. Mobile-first.
- **Safe area:** `env(safe-area-inset-*)` for the footer disclaimer, which is pinned to the bottom of the content flow, not fixed over content.
- **Density:** one primary action per screen. The eligibility and ineligible screens stack two full-width buttons with the **primary lowest** (thumb reach) — keep that, but see §6 on the destructive default.
- **Elevation:** one soft low shadow on raised cards max. Never a 1 px border plus a ≥ 16 px blur on the same element.
- **z-index:** base 0 · dropdown 100 · sticky 200 · backdrop 300 · modal 400 · toast 500 · tooltip 600.

### 5.1 At 320 px

Single column throughout. The four-step indicator keeps its icons but drops to `0.6875rem` labels and may scroll horizontally rather than truncate. The three result cards **stack vertically** below 640 px — they must not shrink to unreadable thirds. Review chips wrap to two rows. The footer disclaimer wraps to five lines and is never truncated.

### 5.2 Result grid at ≥ 900 px

Three equal-width cards in one row, then the recommendation panel full width beneath. **The recommendation panel is the visually dominant block** and, per §8, moves above the cards.

---

## 6. Component patterns

Every interactive component defines default, hover, focus, active, disabled, loading, and error.

| Family | Anatomy / variants | Key states and rules |
|---|---|---|
| **Buttons** | primary (`--brand` fill, white), secondary (white + `--border-strong` outline), destructive (`--error-strong`) | ≥ 44 px; `--focus` ring 2 px + 1 px offset; disabled uses `--surface-sunken` fill + `--ink-muted` text **and** `aria-disabled` — never opacity alone |
| **Binary answer pair** (Yes / No) | two stacked full-width buttons | **The prototype styles "No" as the filled primary on every eligibility question. Do not ship that** — it pre-suggests an answer on a medical question. Both options render as equal-weight secondary buttons until one is chosen |
| **Step indicator** | 4 circles with icons + labels, connectors between | active = `--brand-tint` circle with `--brand` glyph and `--ink` label; complete = same with a filled connector; inactive = `--neutral-step` circle, `--ink-muted` label. `aria-current="step"`; not a link before its step is reachable |
| **Eligibility progress** | 3 rose dashes | filled = answered, `--border-subtle` = pending; announced as "question 2 of 3" |
| **Form field** | label + input + hint + error | 10 px radius, `--border-subtle` at rest, `--brand` on focus, `--error` + `--error-surface` + `aria-invalid` + `aria-describedby` on error; **value preserved on error**; numeric fields use `inputMode` and tabular numerals |
| **Auto-derived value** (BMI) | italic hint under the pair | recomputes live, announced politely; renders a neutral em-dash until both inputs are valid, and **never** labels a range judgementally beyond the plain clinical term |
| **Select** | native-backed listbox with an optional sub-label per option | selected row uses `--brand-tint` + check glyph; the "surgical / induced" style sub-label pattern is kept for options that need an example |
| **Symptom checkbox row** | full-width row, checkbox + label | checked row fills `--brand-tint`; the checkbox itself carries the state so colour is not the only cue |
| **Segmented choice** (Cycle regularity) | two adjacent options | selected uses `--brand-tint` + `--brand` border; `role="radiogroup"` |
| **Dropzone** | dashed `--brand` border on `--brand-tint`, title + hint | the browse **button** is the real control (keyboard-operable); drop is an enhancement; decoding, accepted, and rejected states required |
| **Attached-file card** | thumbnail + filename + size + Change | filename and size in tabular numerals; Change is a real button, not the whole card |
| **Caution banner** | `--warning-surface`, `!` glyph, body text | used for the skip warning; never used to carry a result meaning |
| **Review chip** | big value + small unit label on `--brand-tint` | value tabular; unit always visible |
| **Flagged-symptom row** | `--warning-surface` pill | "flagged" means reported, not abnormal — the copy must not imply the model judged it |
| **Consent checkbox** | gates Submit | unchecked is the **default** (`Opt_20`); Submit disabled with `aria-disabled` and a reason exposed |
| **Result card** | brand header bar + illustration + "Risk assessment:" + band + one-line reason | header bar `--brand` when scored, `--neutral-step` when not screened; band per §3.4; the reason line describes inputs, never causes |
| **Recommendation panel** | outlined `--brand` panel, heading + body | **dominant block, rendered first (§8), identical clinician-review sentence in every state** |
| **Inline / page error** | field-level and screen-level + retry | error summary focusable (`tabIndex={-1}`, `role="alert"`); errors persist until resolved |
| **Reset dialog** | native `<dialog>` | states exactly what clears; confirm wipes session state |

- **Loading uses skeletons**, not a centred spinner in content.
- **Empty and first-run states teach the step**, never "nothing here."
- **Reusable:** buttons, fields, select, checkbox row, step indicator, error patterns, dialog. **Screen-specific:** eligibility pair, dropzone, attached-file card, review chips, result card, recommendation panel, image viewer.

---

## 7. Splash and ultrasound treatment

**Splash:** the wordmark centred, a single fade-in ≤ 400 ms, and a **hard 2-second cap** — it dismisses on app-ready or on the cap, whichever comes first. It never gates on a network call. With reduced motion it renders statically. It carries no loading claim and no percentage.

**Sonogram — Locked:** displayed unmodified at its accepted resolution, letterboxed on `--surface-inverse`. No filter, no contrast enhancement, no false colour, no "enhance" control. The inspection overlay uses `--insp-*` at reduced opacity, **default off**, with an opacity slider and a persistent caption reading model inspection, not a clinical explanation. It is never labelled a segmentation, boundary, lesion outline, or measurement unless the model genuinely produces one and `ARCH-4` says so in writing. The viewer exposes an accessible name and the figure has a short text summary. No sweep line, pulse, or reticle.

**Burned-in identifiers:** the prototype's own sample scan carries a device banner and `OVARY` / `FOLLICLE` labels. This is exactly why the de-identification acknowledgement (§2.1) sits beside the preview and must be added to `/ultrasound`.

---

## 8. Result composition — **Locked hierarchy**

The prototype orders the result as: title → three cards → recommendation. **Invert the last two.** The recommendation panel carries the mandatory clinician-review instruction and must be the first thing the eye lands on, above the three cards:

1. Screen title and the "not a diagnosis" subtitle.
2. **Recommendation panel**, containing the clinician-review instruction — rendered immediately and unconditionally, before any fetch resolves and outside any animation.
3. The three condition cards (PCOS, Ovarian Cyst, Ovarian Tumor), equal width and equal header weight, in a fixed order that never re-ranks by band.
4. Optional model-inspection figure, collapsible.
5. Collapsed "About this result": signal, model version, contract version, cohort, calibration status, limitations.

**Motion:** exactly one reveal — the three cards fade and translate up 8 px, `ease-out` ~320 ms, 60 ms stagger. The title and recommendation panel are outside it. Everything else uses 150–250 ms transitions. A Lower band uses the **same** reveal as a Higher band.

**Reduced motion:** crossfade or instant, no translate.

**Screenshot-safe:** the fully revealed layout is the default DOM; with animation disabled the result is complete and legible in one still frame.

**Failure:** if calibration or model metadata is missing, withhold the value, keep the card, and state why. The recommendation panel and limitations always render — including when all three cards are unavailable.

---

## 9. Accessibility — **Locked floor**

WCAG 2.2 AA · keyboard-operable end to end with visible focus · programmatic labels, descriptions, error associations, and step announcements · text alternatives for the sonogram, overlay, track, and result illustrations (which are decorative and should be `aria-hidden`) · one polite live region for status and one assertive for errors · **no automatic focus moves** except the deliberate, announced error-summary focus · errors persist until resolved · touch targets ≥ 44 px · tested at 320 px, 200% zoom, keyboard-only, and with a screen reader.

**Specific to this prototype:** the eligibility Yes/No pair, the symptom checkbox rows, and the result band all currently rely partly on fill colour — each needs its redundant text or icon cue verified in `QA-2`.

---

## 10. Localization

The prototype is English-only. The requirement is EN + Bahasa Indonesia, with the decision open in `figma-reconciliation.md` §4. If bilingual is kept:

- One-tap toggle on the eligibility and result screens; switching preserves the step and every entered value.
- Strings keyed and versioned; no text baked into images.
- **Size every layout for the longer language** — Indonesian generally runs longer, and the footer disclaimer and recommendation panel are the two blocks most at risk of clipping.
- Safety, consent, eligibility, and result copy are deterministic and human-reviewed, never machine-generated at runtime.
- A missing mandatory translation **fails the build**.

---

## 11. Motion inventory

| Moment | Motion | Reduced-motion |
|---|---|---|
| Splash | fade-in ≤ 400 ms, hard 2 s cap | static |
| Step transition | 180 ms opacity + 6 px translate | opacity only |
| Field error | 150 ms opacity, no movement | identical |
| Dropdown open | 160 ms, origin at the control | instant |
| Image decode → preview | 200 ms crossfade from skeleton | instant |
| Processing stage change | 150 ms text crossfade | instant |
| Result reveal | §8 | crossfade or instant |
| Dialog | 160 ms scale 0.98 → 1 + fade | fade only |

Nothing animates longer than 400 ms. No looping ambient motion.

---

## 12. Completion checklist

- [x] Direction and palette reconciled to the prototype.
- [x] Screen inventory mapped to routes (`figma-reconciliation.md` §2).
- [x] Components list all interaction, error, loading, and accessibility states.
- [x] Not-screened and unavailable panel treatments specified.
- [ ] **Band colours changed from traffic-light to the §3.4 rose ramp — in the Figma.**
- [ ] **Result and recommendation copy rewritten to §2.1 — in the Figma and in `UX-1`.**
- [ ] Yes/No default-primary removed from eligibility questions.
- [ ] Recommendation panel moved above the cards.
- [ ] Typeface family and weights exported and recorded (§4.2).
- [ ] Computed contrast ratios pasted into §3.6.
- [ ] Bilingual decision made (`figma-reconciliation.md` §4).
- [ ] De-identification acknowledgement added to `/ultrasound`.
