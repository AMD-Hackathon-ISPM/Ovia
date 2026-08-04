# Ovia · Product Brief

**Document type:** Product brief
**Audience:** Team, reviewers, prospective clinical partners
**Status:** Active
**Owner:** Frontend/design lead (pending PM assignment)
**Updated:** 2026-08-03
**Canonical for:** Product thesis, users, positioning, phased scope, demo narrative
**Companion documents:** [`product-requirements.md`](product-requirements.md), [`frontend-architecture.md`](frontend-architecture.md), [`design-guidelines.md`](design-guidelines.md), [`evidence-register.md`](evidence-register.md)

## How to read this document

This brief explains why Ovia should exist and how it is positioned. It does not define clinical authorization, feature acceptance, or implementation. Use the PRD for behavior and safety, the evidence register for facts, and the architecture documents for implementation.

## 1. One-sentence pitch

> **Ovia is an investigational, web-based screening research prototype that pairs a structured clinical questionnaire with an independent ultrasound-image model, returning three separate model-estimated likelihood bands — PCOS, Ovarian Cyst, Ovarian Tumor — that help a person understand what to raise with a clinician, while routing every participant to clinician review.**

## 2. Problem

Polycystic ovary syndrome is common in reproductive-aged women, frequently under-recognized, and diagnosed through a combination of clinical, biochemical, and imaging criteria rather than a single test. Adnexal findings on ultrasound require expert interpretation that is unevenly available. Both facts point at the same product question.

> **Evidence gate:** every prevalence, under-diagnosis, and access figure used in the pitch must exist in [`evidence-register.md`](evidence-register.md) with a primary source before it appears in a slide, README, or the UI. This section currently states the shape of the problem, not quantified claims.

**Product problem:** can a transparent, reproducible questionnaire-plus-imaging workflow help study accessible PCOS screening support, while making calibration, cohort limits, and the mandatory clinical next step impossible to miss?

## 3. Product

One loop:

1. Check eligibility: 18+, at least one ovary, not currently pregnant. A disqualifying answer ends the flow on a non-judgemental exit screen.
2. Complete the structured clinical questionnaire.
3. Optionally upload a de-identified ultrasound still; run the client quality gate.
4. Review exactly what will be sent, consent, and submit for transient inference.
5. Return **three independent bands** — PCOS from the questionnaire, Ovarian Cyst and Ovarian Tumor from the image — with limitations and model-inspection artifacts. Without an image, the two imaging screenings return an explicit "not screened".
6. Direct the participant to clinician review regardless of any band.

Ovia does not diagnose PCOS, does not identify or exclude ovarian cysts or tumours, does not assess malignancy or assign an O-RADS category, and does not decide who deserves imaging or treatment.

## 4. Phased scope

| Phase | Included | Explicit boundary |
|---|---|---|
| **[MVP]** | Three-question eligibility gate with a designed exit screen; structured questionnaire; optional de-identified image upload with quality gate; transient inference; three independent result cards never fused or re-ranked; explicit not-screened state; model inspection; limitations; mandatory clinician-review copy; synthetic demo fixtures | Research prototype only; no real patient-care use |
| **[Stretch]** | Richer generated limitation explanation; result-reveal polish; demo drawer | Deterministic safety copy remains default; no unsupported claim |
| **[V1]** | Prospective validation plan; DICOM ingest; accounts and case history; report export; audit trail; deployment hardening; privacy, ethics, regulatory work | Requires partners, representative data, and review |
| **[OUT]** | Diagnosis; malignancy classification; O-RADS; treatment advice; fused score; data retention; real-patient demo | Must not be implemented |

## 5. Users and customer hypothesis

**MVP user:** the participant themselves, on their own phone. They need an understandable flow, clear rejection and exclusion guidance that does not feel like a verdict, and an unambiguous next step.

**Initial customer hypothesis:** an Indonesian clinic network, women's health programme, or research group studying PCOS case-finding. The programme, not the patient, evaluates whether the workflow improves reach, consistency, or prioritization. This remains a hypothesis until interviews exist.

**Adoption gate:** representative prospective evidence, clinical governance, privacy review, integration planning, and any applicable regulatory clearance.

## 6. Differentiation

Ovia's defensible claim is **not** "AI detects PCOS from an ultrasound." Existing work already applies ML to PCOS questionnaires and to ovarian ultrasound.

The claim is: **three honestly separated screenings, visible calibration status, a cohort boundary stated in the interface, a transient-by-construction privacy model, and a mandatory clinical next step that the layout cannot hide.** Most student and commercial health demos fuse everything into one confident number. Ovia's refusal to do that is the product position.

Any competitor comparison must resolve to the evidence register before it is stated publicly.

## 7. Research-to-product boundary

The build demonstrates a technical and UX hypothesis. It does not demonstrate safety, effectiveness, or clinical validity. Moving past prototype status requires representative prospective data from the intended context, pre-registered performance and subgroup evaluation, human-factors testing, privacy and ethics review, integration with confirmatory pathways, and monitoring for drift, bias, and harm.

## 8. Demo narrative (5 minutes)

| Time | Beat |
|---|---|
| 0:00–0:40 | The problem and the cohort boundary, using only evidence-register claims |
| 0:40–1:10 | The safety posture stated up front: screening support, two separate signals, clinician review for every case |
| 1:10–2:10 | Complete eligibility and the questionnaire; upload an image; show a **rejected** file and the retry guidance |
| 2:10–3:10 | Submit; reveal both panels; show that the next-step panel outranks both outputs |
| 3:10–3:50 | Show the skip-image path: PCOS scored, the two imaging cards explicitly not screened, next step unchanged |
| 3:50–4:30 | Show limitations, calibration status, and what model inspection does and does not mean |
| 4:30–5:00 | Close on the validation path and what would have to be true to deploy |

If real metrics are unavailable, the demo says so plainly. Published external results may be shown **only** when labelled as external evidence.

## 9. Closing thesis

The strongest story is not that a model can screen for PCOS. It is that a small team built a screening-support prototype where uncertainty, cohort limits, and the next clinical step are structural features rather than fine print.
