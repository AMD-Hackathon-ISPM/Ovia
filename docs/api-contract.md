# Ovia submission contract — `ovia-v1`

Status: **draft**. The transport, status mapping, and error envelope are settled.
The two marked PROVISIONAL sections are not, and are quarantined to one frontend
file each so changing them is cheap.

The client implementation is [`FE/src/lib/adapter/`](../FE/src/lib/adapter/).
`wire.ts` is the only module that knows these field names.

---

## 1. Endpoint

```
POST {VITE_OVIA_API_BASE_URL}/v1/screenings
Content-Type: multipart/form-data
Accept: application/json
X-Request-Id: <uuid>          # client correlation id, not a case identifier
X-Ovia-Schema-Version: ovia-v1
```

The client sends **no cookie and no credential** (`credentials: "omit"`). CORS
must allowlist the frontend origin explicitly — never `*` with credentials.

### Parts

| Part | Type | Required | Notes |
|---|---|---|---|
| `payload` | `application/json` | yes | see below |
| `image` | image bytes | no | filename is always the literal `ultrasound`; the participant's original filename is never sent |

```jsonc
{
  "schema_version": "ovia-v1",
  "request_id": "8f14e45f-…",
  "answers": { /* PROVISIONAL — §5 */ },
  "image_attached": true      // lets you tell "skipped" from "upload lost in transit"
}
```

A missing `image` part with `image_attached: true` is a transport failure, not a
skip. Reject it rather than screening as if the participant had opted out.

---

## 2. Success — `200 OK`

```jsonc
{
  "contract_version": "ovia-v1",
  "request_id": "8f14e45f-…",
  "panels": {
    "pcos":          { "status": "success", "result": { … } },
    "ovarian_cyst":  { "status": "not_screened", "reason": "no_image_submitted" },
    "ovarian_tumor": { "status": "unavailable", "code": "inference_failed" }
  },
  "inspection": [ … ]   // optional
}
```

**All three panel keys must always be present.** A missing key is a contract
violation and fails the whole response. The three resolve independently: one
failing must not affect the other two, and there is no combined score field —
the client has no type that could hold one.

If `contract_version` does not equal the client's, the client raises a terminal
`schema_version_mismatch` and renders no output. It never coerces.

### Panel variants

| `status` | Additional fields | Meaning |
|---|---|---|
| `success` | `result` (object) | scored |
| `not_screened` | `reason: "no_image_submitted"` | input for this condition was not supplied. Any other reason string is a contract violation |
| `unavailable` | `code: "inference_failed" \| "signal_unusable"` | this condition failed on its own. An unrecognised code degrades to `inference_failed` |

### `result`

```jsonc
{
  "condition": "pcos",
  "signal_source": "questionnaire",   // or "image"
  "band": "band_2",                   // band_1 | band_2 | band_3
  "value": 0.41,                      // 0..1
  "model_version": "pcos-q-1.2.0",
  "calibration_status": "calibrated"  // or "uncalibrated"
}
```

`band` is a neutral identifier. **Do not send display copy, a colour, a severity
word, a malignancy call, or an O-RADS category** — that vocabulary is locked on
the client and some of it is prohibited outright.

Two client-side rules to be aware of, both in `wire.ts`:

- **There is no `value_withheld` wire field.** The client derives it. If
  `model_version` is absent or `calibration_status` is not `"calibrated"`, the
  client discards both `value` and `band` and renders the card band-less. This is
  deliberate: a backend that forgets a flag cannot push an uncalibrated number in
  front of a participant.
- An unrecognised `band` string becomes `null`, never a guessed band.

### `inspection` — PROVISIONAL, pins on ARCH-4

Optional array. Coordinates are fractions of the image box, `0..1`.

```jsonc
{ "id": "r1", "x": 0.34, "y": 0.28, "width": 0.22, "height": 0.24 }
```

The client **discards any label the server sends** and substitutes a bare ordinal
("Region A"). Until ARCH-4 is signed, no finding name, confidence value, or
category may reach the UI. Malformed entries are dropped individually; the figure
is decorative and never blocks a result.

---

## 3. Errors

Envelope, on every non-2xx:

```jsonc
{ "error": { "code": "insufficient_quality",
             "message": "…",
             "details": { "guidance_key": "image.rejected.insufficient_quality" } } }
```

`message` is **read and discarded** by the client. Server prose is unlocalised,
unreviewed, and outside the locked vocabulary, so it is never shown to a
participant. Put anything the participant should see behind `guidance_key`, which
resolves to client-side copy.

| Status | `code` | Client class | Participant sees |
|---|---|---|---|
| `422` | `insufficient_quality`, `unrecognised_view`, `obscured_field` | `image_rejected_server` | returns to the ultrasound step with retake guidance; questionnaire untouched |
| `422` | anything else | `terminal_error` / `contract_error` | terminal screen, no retry |
| `409` | `schema_version_mismatch` | `terminal_error` | terminal screen, no retry |
| `408`, `504` | any | `retryable_error` / `timeout` | "Try again" button |
| `429`, `502`, `503`, other `5xx` | any | `retryable_error` / `upstream_unavailable` | "Try again" button |
| other `4xx` | any | `terminal_error` / `contract_error` | terminal screen, no retry |
| — | transport failure, DNS, CORS, offline | `retryable_error` / `network` | "Try again" button |

Status is the primary signal and `code` refines it, so an unfamiliar code still
lands in the right class.

**Never leak a stack trace, SQL, or an internal path in `message`.** Rate-limit
this endpoint: it is expensive and unauthenticated. Fail closed.

The image rejection code set is **PROVISIONAL, pins on ARCH-2**.

### Retries

The client **never retries automatically**. Every retry is an explicit
participant action on a rendered error. Do not design around client backoff.

`POST /v1/screenings` is therefore not idempotent-by-key today. If you want
dedup, honour `X-Request-Id` — the client reuses the same id across a retry of
the same submission.

---

## 4. Rust sketch (axum + serde)

Field names match serde defaults, so no `#[serde(rename)]` is needed.

```rust
#[derive(Deserialize)]
struct SubmitPayload {
    schema_version: String,
    request_id: String,
    answers: serde_json::Value,   // until ARCH-1 pins the shape
    image_attached: bool,
}

#[derive(Serialize)]
struct SubmitResponse {
    contract_version: &'static str,
    request_id: String,
    panels: Panels,
    #[serde(skip_serializing_if = "Option::is_none")]
    inspection: Option<Vec<Region>>,
}

#[derive(Serialize)]
struct Panels {
    pcos: Panel,
    ovarian_cyst: Panel,
    ovarian_tumor: Panel,
}

#[derive(Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
enum Panel {
    Success { result: ConditionResult },
    NotScreened { reason: NotScreenedReason },
    Unavailable { code: UnavailableCode },
}

#[derive(Serialize)]
struct ConditionResult {
    condition: ConditionId,
    signal_source: SignalSource,
    band: Option<Band>,
    value: Option<f32>,
    model_version: Option<String>,
    calibration_status: Option<CalibrationStatus>,
}
```

Remaining enums (`ConditionId`, `Band`, `SignalSource`, `CalibrationStatus`,
`NotScreenedReason`, `UnavailableCode`) are `#[serde(rename_all = "snake_case")]`
and mirror §2 exactly.

---

## 5. Open — `answers`, PROVISIONAL, pins on ARCH-1

The client currently sends whatever the questionnaire holds:

```jsonc
{ "age": "28", "cycleLength": "…", "…": "…" }
```

camelCase, all strings, keys following the form state. **This is the one part of
the contract that should change before you build against it** — it is the
questionnaire's internal shape leaking onto the wire, not a designed payload.

Settling it means agreeing a flat, snake_case, typed answer object with an
explicit "not answered" representation. Everything else here can be implemented
today.

---

## 6. Switching the client on

```bash
cp FE/.env.example FE/.env.local
# VITE_OVIA_ADAPTER=live
# VITE_OVIA_API_BASE_URL=http://127.0.0.1:8080
```

`fixture` (the default) needs no backend and is what the demo drawer drives.
