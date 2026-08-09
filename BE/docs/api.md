# API contract

Base contract version: `ovia-v1`. Success responses use JSON. Errors use `{ "error": { "code", "message", "details" } }` and never include stack traces.

## `GET /api/v1/health`

```json
{
  "status": "ok",
  "service": "ovia-backend",
  "contract_version": "ovia-v1",
  "manifest_version": "1.0.0",
  "models_ready": 4,
  "onnxruntime_api": "1.27.x (ort 2.0.0-rc.13)",
  "execution_providers": ["cpu"],
  "llm_configured": false
}
```

## `GET /api/v1/models`

Returns `manifest_version`, a `models` array, and non-secret LLM configuration status. Each model includes `model_id`, `model_family`, `model_version`, `task`, `sha256`, `execution_provider`, declared input/output names, and `ready`.

## `POST /api/v1/analyze`

Content type is `multipart/form-data` with exactly:

- `payload`: JSON, required once.
- `image`: PNG/JPEG/WebP bytes, optional once. Bytes are decoded; MIME and filename are not trusted.

```json
{
  "schema_version": "ovia-v1",
  "request_id": "50c82684-14ea-4d09-91cb-102dfb14f608",
  "image_attached": true,
  "answers": {
    "age_years": 29,
    "weight_kg": 68,
    "height_cm": 163,
    "cycle_regularity_code": 4,
    "cycle_length_days": 42,
    "hair_growth": 1
  }
}
```

`request_id` is a client correlation UUID. The server independently creates `analysis_id`. Supported clinical fields are defined by `contracts/request.rs` and `models/metadata/xgboost_frontend_input_schema.json`; unknown JSON fields are rejected. Binary indicators accept only zero/one and cycle regularity accepts source codes two/four.

The response contains:

- `panels`: backward-compatible independent frontend cards.
- `evidence.image_models`: BiomedCLIP and ConvNeXt typed outputs.
- `evidence.clinical_model`: XGBoost raw/calibrated probability and source threshold.
- `evidence.segmentation`: U-Net++ mask/geometry/area/components.
- `evidence.quality` and deterministic `warnings`.
- `orchestration`: structured narrative or explicit unavailable/invalid state.

An unavailable model has `status` plus null output fields. It never receives a placeholder probability. `mask_png_data_url` is a compact transparent original-size PNG; a pixel matrix is not returned.

### Failure behavior

| HTTP | Example code | Meaning |
|---|---|---|
| 400 | `MISSING_REQUIRED_FIELD` | malformed multipart/JSON or invalid field |
| 409 | `schema_version_mismatch` | incompatible client contract |
| 422 | `UNSUPPORTED_IMAGE_FORMAT` | bytes cannot be decoded or image limit rejected |
| 503 | `MODEL_INFERENCE_FAILED` | request-level inference service failure |
| 500 | `INTERNAL_ERROR` | non-disclosed internal/startup issue |

Most individual model execution failures remain HTTP 200 with that model marked `inference_error`, allowing other evidence to return safely. LLM failure also remains HTTP 200 with deterministic evidence and explicit `orchestration.status`.
