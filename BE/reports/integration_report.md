# Ovia production integration report

Generated 2026-08-09 (Asia/Jakarta) from the completed local build and verification run.

1. **Backend architecture.** Rust/Axum API with immutable startup-validated model registry, model-specific deterministic preprocessing/postprocessing, typed `OviaEvidence`, deterministic guard rules, provider-neutral LLM interface, post-LLM validation, and compatibility/frontend response mapping. Sessions are shared and loaded once.

2. **Rust version.** `rustc 1.90.0 (1159e78c4 2025-09-14)`; Cargo 1.90.0; crate edition 2024 with MSRV declared as 1.88.

3. **Important dependencies.** Axum 0.8.9, Tokio 1.53.x resolved, Serde/serde_json, Tower/Tower HTTP, `ort` 2.0.0-rc.13, image 0.25.10, reqwest 0.12.x with rustls, tracing, UUID, SHA-2. Lockfile is committed.

4. **ONNX Runtime version.** Local and container verification used ONNX Runtime 1.27.0 through API 1.27 and `ort` 2.0.0-rc.13. Dynamic loading avoids host C++ ABI coupling; the Docker dependency stage pins 1.27.0.

5. **Execution providers.** CPU was actually exercised on Windows and in the Linux container. `--features cuda` compiles CUDA support; `auto` falls back with an explicit log, while `cuda` fails startup if unavailable. `/health` and `/models` report actual providers. XGBoost remains CPU. No CUDA hardware was available for a real GPU run.

6. **Every integrated model.** BiomedCLIP PCOS morphology screening; ConvNeXt-Tiny five-class ovarian appearance classifier; XGBoost clinical PCOS screening; U-Net++/ResNet34 lesion segmentation. Responsibilities and outputs remain separate.

7. **Source artifact paths.** `Models/BiomedCLIPPipeline/artifacts/biomedclip_pcos.onnx`; `Models/ConvNeXt-TinyPipeline/artifacts/convnext_tiny_ovarian.onnx`; `Models/XGBoostPipeline/artifacts/xgboost_clinical.onnx`; `Models/U-NetPipeline/artifacts/unetpp_otu2d.onnx`.

8. **Copied artifact paths.** `BE/models/biomedclip.onnx`; `BE/models/convnext_tiny.onnx`; `BE/models/xgboost.onnx`; `BE/models/unetpp_otu2d.onnx`. Originals were copied, not moved or edited.

9. **SHA-256 verification.** BiomedCLIP `c339ba162f22348288aba3d6a675c5e8b6bd85262e28ce6df78c7a15919a5329`; ConvNeXt `a1254dfce0698889bd10c11c7ca3487ebf86ea83e1c29b83cb89bd465ee64e31`; XGBoost `0b5c368e62990a1a076a05c708dcefd97a494cc8a21841943ae26140458e835a`; U-Net++ `3a930c9b7cb946379f0286a053d8b1378439e2635f4d9aed04d626d9dd53bd96`. Startup recomputes each digest and fails closed on mismatch.

10. **Input contract per model.** BiomedCLIP float32 NCHW `[batch,3,224,224]`, CLIP normalization after bicubic shortest-edge/center crop. ConvNeXt float32 NCHW `[batch,3,224,224]`, audited dark-border trim/2% inset/center square/256 resize/224 crop/ImageNet normalization. XGBoost float32 `[batch,68]` from 34 ordered base features plus 34 missing indicators and source medians/rules. U-Net++ float32 NCHW `[batch,3,512,512]` from RGB, half-up aspect letterbox, black pad, ImageNet normalization. Startup validates input dtype/rank/fixed dimensions.

11. **Output contract per model.** BiomedCLIP `logit [batch]`, sigmoid, threshold 0.16885695214168317. ConvNeXt `logits [batch,5]`, class order HEALTHY/DOMINANT_FOLLICLE/POLYCYSTIC_OVARY/SIMPLE_CYST/COMPLEX_CYST, softmax temperature 0.8087205716282806. XGBoost `label` and `probabilities [batch,2]`, class-one probability followed by Platt coefficient 1.287716202909563/intercept -0.4671930270008069 and threshold 0.14692185644838315. U-Net++ `logits [batch,1,512,512]`, sigmoid and threshold 0.30 with no morphological postprocessing.

12. **Backend endpoints.** `GET /api/v1/health`, `GET /api/v1/models`, primary `POST /api/v1/analyze`, and compatibility alias `POST /v1/screenings`. The frontend uses the primary endpoint.

13. **Parallel inference strategy.** Four independent model jobs use separate warm sessions and blocking workers with `tokio::join!`; a session mutex prevents unsafe concurrent calls to the same ORT session. The CPU benchmark showed internal-thread contention (concurrent slower than sequential), so CPU scheduling is a documented tuning opportunity rather than a claimed speedup.

14. **Featherless configuration.** Generic OpenAI-compatible `/chat/completions` client configured only by `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, timeout, temperature, and max tokens. No endpoint/key is invented or committed; images are never included.

15. **LLM model configured.** None in the verification environment. `LLM_PROVIDER=disabled` was exercised, and mock structured providers covered success, timeout, HTTP-like unavailability, invalid references, malformed JSON, numeric hallucination, and prohibited claims. Enabling a live model requires real values in an ignored `.env`.

16. **Structured evidence schema.** Strong Rust structs cover per-model ID/version/task/status/duration, model-appropriate raw/interpreted values, segmentation mask/geometry, quality facts, warnings, independent legacy panels, and a separate structured orchestration object.

17. **Anti-hallucination safeguards.** The system prompt treats embedded data as untrusted, excludes images and direct numeric scores from LLM input, requires structured JSON, retries invalid structure once, permits references only to successful known source IDs, rejects all generated numeric text and pathology/confirmed-cancer/O-RADS claims, and never allows narrative to overwrite evidence fields.

18. **Failure isolation behavior.** Each model reports `success`, `unavailable`, `invalid_input`, or `inference_error`. No `0`, `0.5`, `normal`, replacement score, or cross-model proxy is introduced. Missing image still permits clinical inference; missing clinical data still permits all image models. LLM failure returns authoritative evidence plus explicit fallback state.

19. **U-Net++ inverse geometry validation.** The locked 959×537 fixture reproduced resized 512×287 and pads left/right/top/bottom 0/0/112/113 exactly. Unit tests validate original dimensions, bounding box, connected components, thresholding, and compact transparent PNG output. E2E verified a returned 640×480 mask. Python/Rust synthetic mask area differed by less than the recorded 0.01 absolute foreground-fraction tolerance due to low-level interpolation rounding; geometry/dimensions are exact.

20. **Frontend files modified.** `.env.example`, `package.json`/lockfile, `FormContext`, `SubmissionContext`, `ClinicalForm`, `ReviewConsent`, `UltrasoundUpload`, `Results`, `InspectionFigure`, `submissionCopy`, adapter `types`, `wire`, `httpAdapter`, and Playwright live-flow coverage; obsolete local `riskLogic.ts` was removed. Existing routing/component architecture was preserved.

21. **Frontend/backend mapping.** Eligibility age maps to `age_years`; supported form fields map explicitly to snake-case XGBoost inputs; booleans map to zero/one; regular/irregular maps to verified source codes two/four; optional blanks are omitted. Browser state and data URL are memory-only. The adapter strictly decodes typed evidence/orchestration and retains fixture mode for offline demonstrations.

22. **Segmentation overlay implementation.** Backend returns a compact original-size transparent rose PNG and normalized bounding box. The existing zoom/pan viewer renders original and mask in the same `object-contain` transform, defaults overlay off, provides opacity and show/hide controls, draws a boundary, and persistently states that segmentation does not establish pathology/malignancy/cancer.

23. **Docker status.** CPU and GPU multi-stage targets plus Compose profiles exist. Compose config validation passed for both profiles. CPU image `ovia-backend:test` built successfully after resolving a caught static C++ ABI issue with pinned dynamic ORT; its health endpoint became ready with four warmed models and a real containerized image analysis succeeded. Models mount read-only; root FS is read-only in Compose; test containers were removed. GPU image/config compile path exists but was not runtime-tested without NVIDIA hardware.

24. **Unit test results.** `cargo test --lib`: 13 passed, 0 failed. Coverage includes request enums/UUID, exact XGBoost ordering/indicators/outliers, image decode, shapes/normalization, letterbox/inverse/mask geometry, LLM JSON and validation guards, and mock failure fallback.

25. **Integration test results.** `cargo test --test e2e`: 1 passed, 0 failed. It loaded and warmed all four real artifacts, checked health secrecy/readiness, sent multipart image plus clinical fields through Axum, and asserted all four evidence statuses.

26. **Golden ONNX parity results.** `scripts/generate_python_golden.py` uses original BiomedCLIP, ConvNeXt, and U-Net preprocessing modules plus ORT 1.27. BiomedCLIP Rust logit is checked within 0.005; XGBoost raw and externally calibrated probabilities within 1e-6; U-Net original dimensions and foreground fraction within 0.01. The generated fixture records Python runtime and raw reference values. ConvNeXt preserved the same highest class on the fixture and observed class probabilities were within roughly 0.002 absolute during manual comparison.

27. **End-to-end test results.** Representative 640×480 synthetic ultrasound + clinical fields → Rust preprocessing → four real ONNX models → typed evidence → mock structured LLM → guarded final response passed. Containerized deterministic-only flow also passed with expected partial-evidence behavior. A live Playwright flow then navigated the existing React form, called the container, rendered real XGBoost evidence plus the separate LLM-unavailable state, and confirmed `sessionStorage` contains no Ovia form state: 1 passed, 0 failed. This test caught and drove a fix for two missing custom headers in the narrow CORS allowlist.

28. **Per-model latency.** Warm CPU inference-only, six measured samples: BiomedCLIP median 204.71 ms / p95 221.87 ms; ConvNeXt median 83.74 / p95 99.67 ms; XGBoost median 0.29 / p95 0.98 ms; U-Net++ median 701.94 / p95 785.42 ms. Synthetic fixture, local Windows machine; preprocessing/API/LLM excluded.

29. **Combined inference latency.** Warm CPU inference-only: sequential median 1054.02 ms / p95 1096.34 ms; concurrent median 1148.96 ms / p95 1274.26 ms, six samples after two warmups. Live Featherless latency was not measured because no key/model was configured; mock/deterministic orchestration overhead was negligible relative to ONNX and full backend image requests completed in about a few seconds in debug/container checks.

30. **Remaining limitations.** No clinical validation or external-site validation; source pipelines rely primarily on public datasets; no live Featherless or CUDA runtime verification; model calibration/tasks are heterogeneous and intentionally not fused; CPU concurrency needs hardware-specific tuning; Pillow/OpenCV versus Rust interpolation has small measurable differences despite exact geometry; no tumor/malignancy classifier exists; API is stateless with no durable audit database; rate limiting/authentication/TLS are expected at a deployment gateway; the new backend and browser E2E commands are not yet wired into hosted CI.
