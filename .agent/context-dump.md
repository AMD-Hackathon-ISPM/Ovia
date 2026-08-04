# Ovia · Context Dump

**Document type:** Decision history and rationale
**Audience:** Anyone asking "why is it like this?"
**Status:** Historical · may contain explicitly marked superseded decisions
**Updated:** 2026-08-04
**Canonical for:** Nothing. Use it to understand reasoning, never to justify current behavior.

## How to read this document

Current behavior lives in the canonical documents (`AGENT.md` §1). This file records why decisions were made and which ideas were ruled out, so nobody re-proposes them. A superseded decision is preserved and marked, not deleted:

```md
> **SUPERSEDED — current decision:** [replacement, reason, link]
```

## 1. Decisions index

| # | Decision | Reason |
|---|---|---|
| D-01 | Three independent outputs, never fused or re-ranked | No paired dataset justifies a combined score, and a fused number would hide which input drove it. Also the clearest differentiator from typical student health demos. |
| D-02 | Cohort limited to adults 18+ | PCOS diagnostic criteria differ for adolescents; the prototype has no basis for that population. |
| D-03 | Ultrasound upload is optional | The questionnaire path must work where imaging is unavailable, which is exactly the setting the product is aimed at. |
| D-04 | The imaging screenings never output malignancy or O-RADS | Adnexal risk stratification is a trained-reader determination. An unvalidated model implying it is the single most harmful thing this product could do. |
| D-05 | Memory-only session state, no persistence layer | Privacy is easier to guarantee by construction than by policy. It also removes an entire class of compliance questions from the prototype. |
| D-06 | Canvas re-encode of every uploaded image | Strips EXIF by construction rather than by a library call that could be removed later. |
| D-07 | Fixture adapter as a first-class module | Lets the frontend reach a complete, demonstrable product before the model exists. Learned from prior projects where UI work stalled waiting on a backend contract. |
| D-08 | No green anywhere in the palette | Removes the possibility of a "clear" reading by removing the material. |
| D-09 | Next-step panel rendered outside the animation and before any fetch | Safety content must survive a skipped animation, a background tab, and a failed request. |
| D-10 | English default with a one-tap Bahasa Indonesia toggle | Reviewers read English; the deployment context is Indonesian. Both bundles are complete, so neither is a second-class language. |
| D-11 | Rose-on-white palette, generous vertical space, one decision per screen | Inherited from the Figma prototype. The softness is a deliberate counterweight to frightening subject matter for someone reading their result alone — but it must never leak into the words or the band semantics. |
| D-12 | Recommendation panel moved above the three cards | The prototype put it last. The clinician-review instruction has to be the first thing the eye lands on, not a footnote under three risk words. |
| D-13 | Eligibility exit is a designed screen, not an error | Being told a tool does not apply to you is a vulnerable moment; the prototype's "this isn't a health judgement about you" framing was the right instinct and is now a locked requirement. |
| D-14 | `not_screened` is a first-class state | The alternative — defaulting an unscreened condition to low — is a silent false-reassurance bug. |

## 2. Set-aside ideas

| Idea | Why not |
|---|---|
| A single "Ovia risk score" combining questionnaire and image | Unsupportable and unsafe. See D-01. **Do not re-propose.** |
| Traffic-light risk colors | Green reads as clearance. See D-08. Present in the current prototype and being removed — `figma-reconciliation.md` §3. |
| Malignancy probability or O-RADS output from imaging screening | See D-04. `[OUT]`, permanently, at prototype scope. |
| Patient-facing self-screening mode | Different product, different safety model, different regulatory posture. `[V1]` at the earliest. |
| Case history and saved reports | Breaks the transient privacy model (D-05). `[V1]`. |
| DICOM upload | Carries identifiers in headers; needs a de-identification pipeline the prototype does not have. `[V1]`. |
| Chatbot explaining the result | Safety copy must be deterministic. A generated explanation of a medical output is the highest-risk feature available. `[Stretch]` at most, and never for mandatory copy. |
| Dark mode | Shared clinic devices, variable light, screenshot-safe demo. `[V1]`. |

## 3. Glossary

| Term | Meaning |
|---|---|
| **Screening** | One of the three independent outputs: PCOS (from the questionnaire), Ovarian Cyst, Ovarian Tumor (both from the image) |
| **Not screened** | A condition that produced no estimate because no image was submitted. Not a low result. |
| **Band** | Lower / Intermediate / Higher model-estimated likelihood; a relative prioritization label, never a clinical category |
| **Finding** | A described image feature the imaging screening model responded to; not a diagnosis |
| **Model inspection** | A saliency or overlay artifact showing where a model focused; not an explanation |
| **Calibration status** | Whether the shipped artifact's probabilities were fitted against held-out data; `uncalibrated` until proven otherwise |
| **Fixture adapter** | The swappable module that serves synthetic responses so the frontend never blocks on the model |
| **Transient processing** | Data exists only for the duration of the request and the active session; nothing is stored |
