# Ovia production integration backend

Rust/Axum service for the four already-trained Ovia models. It validates immutable artifacts at startup, keeps ONNX sessions warm, executes deterministic preprocessing/inference/postprocessing, and optionally asks a Featherless-compatible LLM to explain relationships between model outputs. The LLM never receives the image and cannot replace numeric evidence.

> Investigational screening support only. This repository is not a diagnostic device and is not clinically validated.

## Integrated models

| Model | Responsibility | Runtime output |
|---|---|---|
| BiomedCLIP | Polycystic ovarian morphology visibility screening | sigmoid probability and source threshold |
| ConvNeXt-Tiny | Five-class ovarian ultrasound appearance research classifier | temperature-calibrated class probabilities |
| XGBoost | Structured clinical PCOS screening | raw probability, external Platt probability, source threshold |
| U-Net++ / ResNet34 | Candidate ovarian lesion segmentation | transparent PNG mask and original-coordinate geometry |

These tasks remain independent. Ovia does not average their probabilities and U-Net++ is not a tumor, pathology, malignancy, or cancer classifier.

## Local setup

1. Copy `.env.example` to `.env`; keep `LLM_PROVIDER=disabled` unless valid Featherless-compatible settings are available.
2. Verify `models/manifest.json` and all four ONNX files are present.
3. On Linux, run `cargo run --release --bin ovia-backend`.
4. On Windows, install a compatible ONNX Runtime 1.27+ DLL and set `ORT_DYLIB_PATH`, then run the same command.
5. In `../FE`, copy `.env.example` to `.env.local`, set `VITE_OVIA_ADAPTER=live`, then run `npm run dev`.

The service fails before binding if a SHA-256, metadata file, required model ID, input name, or output name does not match the manifest. Sessions are created and warmed only once.

### CPU and CUDA

CPU is the default and requires `ORT_EXECUTION_PROVIDER=cpu`. CUDA support is opt-in:

```text
cargo run --release --features cuda --bin ovia-backend
```

Set `ORT_EXECUTION_PROVIDER=auto` to fall back honestly to CPU, or `cuda` to fail startup when CUDA cannot initialize. `/api/v1/models` reports the provider actually selected for each model. XGBoost intentionally uses CPU.

## Featherless-compatible orchestration

Set `LLM_PROVIDER=featherless`, `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL`. `LLM_BASE_URL` is deliberately not invented or hardcoded. The client appends `/chat/completions`, requests a JSON object, retries an invalid structure once, then returns deterministic evidence with `orchestration.status=invalid_response` or `unavailable`.

Post-response validation rejects unknown/unavailable model sources, any generated numeric text, and prohibited diagnostic/pathology language. API keys, authorization headers, images, and raw request bodies are not logged.

## API

- `GET /api/v1/health` — readiness, manifest, runtime API, actual providers, LLM configuration state.
- `GET /api/v1/models` — IDs, versions, tasks, hashes, tensor names, providers.
- `POST /api/v1/analyze` — primary multipart endpoint (`payload` JSON and optional `image`).
- `POST /v1/screenings` — compatibility alias for older frontend builds.

See [docs/api.md](docs/api.md) and [docs/architecture.md](docs/architecture.md).

## Tests and parity

```text
cargo test --lib
cargo test --test e2e
python scripts/generate_python_golden.py
BENCHMARK_ITERATIONS=8 cargo run --bin benchmark
```

Tests do not make paid/live LLM calls. The E2E test loads every real ONNX artifact and exercises multipart parsing, all preprocessing, mock orchestration, structured response output, and segmentation geometry. `python_golden.json` is generated with the original source-pipeline preprocessing modules.

On Windows, set `ORT_DYLIB_PATH` for tests. Frontend checks are `npm run build` and `npx tsc --noEmit`.

## Docker

```text
docker compose --profile cpu up --build
docker compose --profile gpu up --build
```

Both profiles mount `./models` read-only, run with a read-only root filesystem, and do not bake `.env` or secrets into an image. The GPU image requires a host/NVIDIA Container Toolkit compatible with the configured CUDA runtime base.

## Privacy and limitations

Uploads are decoded and processed in memory; no endpoint writes them to disk. Frontend health inputs are memory-only and disappear on reset/reload. This is a single-public-dataset research prototype, preprocessing libraries can introduce small interpolation differences, CUDA was not available in the recorded local verification, Featherless was tested through mocks only, and none of the model outputs establishes a diagnosis.
