# Ovia · Evidence Register

**Document type:** Evidence register
**Audience:** Everyone. Nothing factual is stated publicly without an entry here.
**Status:** Active · **skeleton.** Rows below are unverified candidates, not approved claims.
**Owner:** PM (unassigned) · verified jointly with the ML engineer for model and dataset rows
**Updated:** 2026-08-03
**Canonical for:** Every external factual, medical, dataset, market, and competitive claim
**Companion documents:** [`product-brief.md`](product-brief.md), [`product-requirements.md`](product-requirements.md)

## How to read this document

Use the claim ID whenever a fact is repeated in a document, the UI, a slide, or the README. Prefer the canonical wording and carry the limitation with it.

**Rules:**

1. A new factual claim is added here **before** it appears anywhere else.
2. Link a primary source; record the publication date, access date, and the exact claim supported.
3. Published results and Ovia's own results are recorded separately and never merged.
4. Controlled-access datasets are distinguished from public downloads, with access conditions documented.
5. No market estimate, benchmark, or clinical claim is used without a resolved entry.
6. If evidence changes, update this register first, then every dependent document in the same change.

**Status values:** `UNVERIFIED` (candidate, do not use) · `VERIFIED` (checked against the primary source, usable) · `REJECTED` (checked and not supported).

## 1. Clinical background — **all UNVERIFIED**

| ID | Candidate claim | Where to verify | Status | Limitation once verified |
|---|---|---|---|---|
| PCOS-01 | PCOS prevalence among reproductive-aged women | WHO PCOS fact sheet; a current systematic review | `UNVERIFIED` | Prevalence varies substantially by diagnostic criteria used; state which criteria the figure assumes |
| PCOS-02 | A substantial share of cases go undiagnosed | WHO fact sheet or a cited review | `UNVERIFIED` | Do not round up or restate as "most women"; quote the source's own framing |
| PCOS-03 | PCOS is diagnosed by combined criteria (e.g. Rotterdam), not a single test | International evidence-based PCOS guideline | `UNVERIFIED` | **This entry is load-bearing for safety:** it is why Ovia cannot claim diagnosis |
| PCOS-04 | Ultrasound morphology alone is not sufficient for diagnosis, and criteria differ for adolescents | International PCOS guideline | `UNVERIFIED` | Supports the 18+ cohort boundary |
| ADNX-01 | Adnexal masses are risk-stratified by trained readers using a structured system (e.g. O-RADS) | ACR O-RADS US documentation | `UNVERIFIED` | **Why imaging screening must not output an O-RADS category** |
| ADNX-02 | Incidental adnexal findings are common and mostly not malignant | Peer-reviewed review | `UNVERIFIED` | Must never be phrased in-product as reassurance |
| ID-01 | Indonesian context: access to gynaecological ultrasound interpretation | Ministry of Health or peer-reviewed source | `UNVERIFIED` | Do not assert a national statistic without an official source |

## 2. Datasets — **owned by the ML engineer**

| ID | Candidate claim | Status | Notes |
|---|---|---|---|
| DATA-01 | Questionnaire training dataset: source, size, cohort, licence, access conditions | `UNVERIFIED` | Must state whether it is public, controlled-access, or scraped. **Scraped or unlicensed data is `[OUT]`.** |
| DATA-02 | Ultrasound image dataset: source, size, imaging protocol, labelling procedure, licence | `UNVERIFIED` | Must state who labelled it and against what reference standard |
| DATA-03 | Cohort and geography of both datasets versus Ovia's intended Indonesian context | `UNVERIFIED` | Generalization risk must be stated in-product |
| DATA-04 | Redistribution restrictions | `UNVERIFIED` | If controlled-access, **no data or derived samples in this repository** |

> **OWNER INPUT REQUIRED — ML engineer — `ML-0`**
>
> **Blocks:** any dataset statement in the README, pitch, or UI limitations copy
>
> **Required output:** for each dataset — source URL, licence, access conditions, size, cohort description, label provenance, and the exact redistribution restriction accepted
>
> **Affected documents:** `evidence-register.md`, `product-brief.md`, `product-requirements.md`
>
> **Completion rule:** replace with dated `VERIFIED` rows and append a line to `log.md`

## 3. Ovia's own results — **empty by design**

No Ovia metric exists. When one does, it is recorded in `data-evaluation-plan.md` (ML-owned), **not here**, and only after a reproducible run with a recorded manifest.

Until then, the UI reports `calibration: uncalibrated` and no accuracy, sensitivity, specificity, AUROC, or confidence figure appears in any artifact.

## 4. Prohibited claims — **Locked**

Do not state, in the product, README, slides, or video:

- "Validated," "clinically validated," or "accurate" in any form.
- Any accuracy, sensitivity, specificity, or AUROC number not traced to a recorded Ovia run.
- "Detects PCOS," "detects ovarian cysts," "detects tumours," "detects cancer."
- Any benign/malignant determination or O-RADS category.
- "Replaces an ultrasound," "no doctor needed," "no lab needed."
- A single combined Ovia score.
- "The heatmap shows why the model decided."
- Any dataset described as public without a verified `DATA-*` row.
