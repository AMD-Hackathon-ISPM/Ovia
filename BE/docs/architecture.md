# Architecture

## System

```mermaid
flowchart LR
  FE[Existing React frontend] -->|multipart /api/v1/analyze| API[Axum API]
  API --> V[Validation and in-memory decode]
  V --> P[Deterministic evidence pipeline]
  P --> B[BiomedCLIP]
  P --> C[ConvNeXt-Tiny]
  P --> X[XGBoost]
  P --> U[U-Net++]
  B & C & X & U --> E[Typed OviaEvidence]
  E --> R[Clinical guard/rule layer]
  R --> L[Optional Featherless-compatible LLM]
  L --> G[Post-LLM anti-hallucination guard]
  G --> RESP[Structured response]
  E --> RESP
```

Rust is authoritative. No image is sent to the LLM. Numeric evidence is serialized from ONNX/postprocessing fields, never from generated prose.

## Production container topology

```mermaid
flowchart LR
  Browser --> Gateway[Nginx gateway]
  Gateway --> Frontend[Static React container]
  Gateway --> API[Stateless Axum API]
  API -->|independent timed HTTP call| B[BiomedCLIP worker]
  API -->|independent timed HTTP call| C[ConvNeXt worker]
  API -->|independent timed HTTP call| X[XGBoost worker]
  API -->|independent timed HTTP call| U[U-Net++ worker]
```

Only the gateway publishes a host port. The API and frontend share the edge network; the API and model workers share a separate internal network. The API container has no ONNX mount, and every worker mounts only its own artifact plus shared immutable metadata. Local mode retains the in-process registry for development and parity tests.

## Inference flow

```mermaid
sequenceDiagram
  participant A as Analyze handler
  participant I as Image decoder
  participant M as Warm ONNX sessions
  participant E as Evidence builder
  A->>I: Decode bytes once with size/pixel limits
  par independent worker
    I->>M: BiomedCLIP 224 tensor
  and independent worker
    I->>M: ConvNeXt 224 tensor
  and independent worker
    I->>M: U-Net++ 512 tensor + geometry
  and independent worker
    A->>M: XGBoost 68-feature tensor
  end
  M-->>E: Typed successes or per-model failure status
  E-->>A: Evidence without substituted values
```

In local mode, sessions are protected individually because ONNX Runtime session execution is not generally safe through concurrent mutable calls. In production, process/container isolation is the primary boundary. Independent request deadlines turn an unreachable or stuck worker into one model-specific `inference_error`; evidence from responsive workers is still returned. The recorded CPU benchmark found ONNX internal-thread contention made sequential inference faster, so container CPU limits remain hardware-tunable.

## Evidence orchestration

```mermaid
flowchart TD
  E[OviaEvidence] --> Q{Rule validation}
  Q -->|missing, mixed, low confidence| W[Deterministic warnings]
  Q --> S[Sanitized categorical evidence]
  S --> F{LLM configured?}
  F -->|no/error| D[Deterministic fallback]
  F -->|yes| J[Structured JSON request]
  J --> V{Schema and claim validation}
  V -->|valid| N[Narrative fields]
  V -->|invalid| Retry[One corrective retry]
  Retry --> V2{Valid?}
  V2 -->|no| D
  V2 -->|yes| N
  E --> Final[Final API response]
  W --> Final
  D --> Final
  N --> Final
```

## U-Net++ geometry

```mermaid
flowchart LR
  O[Original W x H RGB] --> S[scale=min 512/W 512/H]
  S --> Z[half-up resized dimensions]
  Z --> P[asymmetric-safe zero letterbox]
  P --> N[ImageNet normalization / NCHW]
  N --> U[raw 512 x 512 logits]
  U --> T[sigmoid >= 0.30]
  T --> C[remove recorded padding]
  C --> R[nearest resize to original W x H]
  R --> M[transparent PNG mask]
  R --> D[area bbox components]
```

The returned mask has the original native dimensions. The frontend puts the original image and mask in the same `object-contain` coordinate box, and the normalized bounding rectangle uses the same original dimensions. Portrait, wide, narrow, and the locked 959×537 inverse fixture share this path.

## Frontend lifecycle

```mermaid
sequenceDiagram
  participant U as Participant
  participant FE as React state
  participant API as Rust API
  participant ORT as ONNX sessions
  participant LLM as Featherless-compatible provider
  U->>FE: Enter supported fields / optional image
  FE->>FE: Validate and keep data in memory only
  FE->>API: payload + metadata-stripped blob
  API->>ORT: Deterministic inference
  ORT-->>API: Typed numeric evidence
  API->>LLM: Sanitized structured evidence only
  LLM-->>API: Structured narrative or failure
  API-->>FE: Evidence + orchestration state + mask
  FE-->>U: Separate Model output and LLM interpretation
```
