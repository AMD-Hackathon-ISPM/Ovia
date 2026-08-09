// Wire <-> domain translation. The ONLY module that knows the backend's field
// names (frontend-architecture.md §7).
//
// Everything here is defensive on purpose. A response is untrusted input: an
// unknown enum member, a missing panel, or a number where a string belongs is a
// contract violation, never something to coerce into a plausible-looking result.
// The three panels stay independent -- nothing in this file combines them.
//
// PROVISIONAL: the request `answers` shape pins on ARCH-1 and the server
// rejection codes pin on ARCH-2. Both are quarantined to this file.

import type {
  Band,
  CalibrationStatus,
  ConditionId,
  ConditionResult,
  InspectionRegion,
  ImageModelEvidence,
  ClinicalEvidence,
  SegmentationEvidence,
  OviaEvidence,
  OrchestrationResult,
  OviaError,
  PanelState,
  ResultPanels,
  ServerImageRejectionCode,
  SignalSource,
} from "./types";

/** Client contract version, sent on every request and checked on every reply. */
export const CONTRACT_VERSION = "ovia-v1";

/**
 * Raised when a 2xx body does not match the contract. Callers map this to a
 * terminal error: a malformed success is not retryable, because retrying cannot
 * change a version skew or a field rename.
 */
export class ContractViolation extends Error {
  constructor(detail: string) {
    super(`Contract violation: ${detail}`);
    this.name = "ContractViolation";
  }
}

// ── Primitive narrowing ───────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function readFiniteNumber(
  source: Record<string, unknown>,
  key: string
): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readMember<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T | null {
  const value = source[key];
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

const BANDS: readonly Band[] = ["band_1", "band_2", "band_3"];
const SIGNAL_SOURCES: readonly SignalSource[] = ["questionnaire", "image"];
const CALIBRATION_STATUSES: readonly CalibrationStatus[] = [
  "calibrated",
  "uncalibrated",
];
const IMAGE_REJECTION_CODES: readonly ServerImageRejectionCode[] = [
  "insufficient_quality",
  "unrecognised_view",
  "obscured_field",
];

// ── Request ───────────────────────────────────────────────────────

/**
 * JSON part of the multipart request body. snake_case so a Rust struct with
 * default serde naming deserialises it without rename attributes.
 */
export interface WireSubmitPayload {
  schema_version: string;
  request_id: string;
  /** Opaque to the transport. Shape pins on ARCH-1. */
  answers: Record<string, unknown>;
  /** Lets the server distinguish "skipped" from "upload dropped in transit". */
  image_attached: boolean;
}

export function buildRequestBody(
  answers: Record<string, unknown>,
  image: Blob | null,
  requestId: string,
  schemaVersion: string
): FormData {
  const payload: WireSubmitPayload = {
    schema_version: schemaVersion,
    request_id: requestId,
    answers,
    image_attached: image !== null,
  };

  const body = new FormData();
  body.append(
    "payload",
    new Blob([JSON.stringify(payload)], { type: "application/json" })
  );
  if (image) {
    // Extension-less filename: the participant's original name is never sent.
    body.append("image", image, "ultrasound");
  }
  return body;
}

// ── Success response ──────────────────────────────────────────────

/** Panel keys as they appear on the wire, paired with their domain field. */
const PANEL_KEYS = [
  { wire: "pcos", domain: "pcos", condition: "pcos" },
  { wire: "ovarian_cyst", domain: "ovarianCyst", condition: "ovarian_cyst" },
  { wire: "ovarian_tumor", domain: "ovarianTumor", condition: "ovarian_tumor" },
] as const satisfies readonly {
  wire: string;
  domain: keyof ResultPanels;
  condition: ConditionId;
}[];

export interface DecodedSuccess {
  requestId: string;
  contractVersion: string;
  panels: ResultPanels;
  inspection?: InspectionRegion[];
  evidence?: OviaEvidence;
  orchestration?: OrchestrationResult;
}

export function decodeSuccess(body: unknown, fallbackRequestId: string): DecodedSuccess {
  if (!isRecord(body)) throw new ContractViolation("response body is not an object");

  const contractVersion = readString(body, "contract_version");
  if (!contractVersion) throw new ContractViolation("contract_version missing");

  const wirePanels = body.panels;
  if (!isRecord(wirePanels)) throw new ContractViolation("panels missing");

  // Built field by field. There is no loop that produces a combined value, and
  // no panel can be derived from another.
  const panels: ResultPanels = {
    pcos: decodePanel(wirePanels, PANEL_KEYS[0].wire, PANEL_KEYS[0].condition),
    ovarianCyst: decodePanel(wirePanels, PANEL_KEYS[1].wire, PANEL_KEYS[1].condition),
    ovarianTumor: decodePanel(wirePanels, PANEL_KEYS[2].wire, PANEL_KEYS[2].condition),
  };

  const inspection = decodeInspection(body.inspection);
  const evidence = body.evidence === undefined ? undefined : decodeEvidence(body.evidence);
  const orchestration = body.orchestration === undefined ? undefined : decodeOrchestration(body.orchestration);

  return {
    requestId: readString(body, "request_id") ?? fallbackRequestId,
    contractVersion,
    panels,
    ...(inspection.length > 0 ? { inspection } : {}),
    ...(evidence ? { evidence } : {}),
    ...(orchestration ? { orchestration } : {}),
  };
}

function decodePanel(
  wirePanels: Record<string, unknown>,
  key: string,
  condition: ConditionId
): PanelState<ConditionResult> {
  const panel = wirePanels[key];
  if (!isRecord(panel)) throw new ContractViolation(`panel ${key} missing`);

  const status = readString(panel, "status");

  switch (status) {
    case "success": {
      const result = panel.result;
      if (!isRecord(result)) {
        throw new ContractViolation(`panel ${key} success without result`);
      }
      return { status: "success", data: decodeResult(result, condition, key) };
    }

    case "not_screened": {
      // One reason exists today. An unrecognised one is a contract violation
      // rather than a silent relabel, because the card copy is reason-specific.
      if (readString(panel, "reason") !== "no_image_submitted") {
        throw new ContractViolation(`panel ${key} has unknown not_screened reason`);
      }
      return { status: "not_screened", reason: "no_image_submitted" };
    }

    case "unavailable": {
      const code = readMember(panel, "code", [
        "inference_failed",
        "signal_unusable",
      ] as const);
      // An unavailable panel with an unfamiliar code still renders as
      // unavailable -- degrading to a known code is safe here, because every
      // unavailable card says the same thing: this one did not produce output.
      return { status: "unavailable", code: code ?? "inference_failed" };
    }

    default:
      throw new ContractViolation(`panel ${key} has unknown status ${String(status)}`);
  }
}

function decodeResult(
  result: Record<string, unknown>,
  condition: ConditionId,
  key: string
): ConditionResult {
  const signalSource = readMember(result, "signal_source", SIGNAL_SOURCES);
  if (!signalSource) {
    throw new ContractViolation(`panel ${key} has unknown signal_source`);
  }

  const modelVersion = readString(result, "model_version");
  const calibrationStatus = readMember(
    result,
    "calibration_status",
    CALIBRATION_STATUSES
  );
  // Unknown band strings become null rather than a guessed band.
  const band = readMember(result, "band", BANDS);
  const value = readFiniteNumber(result, "value");

  return applyWithholdRule({
    condition,
    signalSource,
    band,
    value,
    modelVersion,
    calibrationStatus,
  });
}

/**
 * §7.1 `metadata_missing`, enforced client-side.
 *
 * `value_withheld` is deliberately NOT a wire field. A backend that forgets to
 * set a flag cannot cause an uncalibrated number to reach a participant, because
 * the frontend decides from the metadata it can see.
 *
 * JUDGEMENT CALL, easy to relax: an explicitly `uncalibrated` result is treated
 * the same as missing metadata -- no number and no band. An uncalibrated score
 * is not on a scale the band copy describes, so showing either would imply a
 * precision that is not there.
 */
function applyWithholdRule(
  result: Omit<ConditionResult, "valueWithheld">
): ConditionResult {
  const trustworthy =
    result.modelVersion !== null && result.calibrationStatus === "calibrated";

  if (!trustworthy) {
    return { ...result, band: null, value: null, valueWithheld: true };
  }
  return { ...result, valueWithheld: result.value === null };
}

/**
 * Localisation output is optional and decorative: a malformed region is dropped
 * rather than failing the whole submission, since the figure below the
 * recommendation can render empty without changing anything above it.
 */
function decodeInspection(raw: unknown): InspectionRegion[] {
  if (!Array.isArray(raw)) return [];

  const regions: InspectionRegion[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!isRecord(entry)) continue;

    const x = readFiniteNumber(entry, "x");
    const y = readFiniteNumber(entry, "y");
    const width = readFiniteNumber(entry, "width");
    const height = readFiniteNumber(entry, "height");
    if (x === null || y === null || width === null || height === null) continue;
    if (width <= 0 || height <= 0) continue;

    regions.push({
      id: readString(entry, "id") ?? `region-${index}`,
      // PROVISIONAL (ARCH-4): a bare ordinal. Any finding name the server sends
      // is discarded here, so no imaging vocabulary can leak into the UI before
      // that vocabulary is signed off.
      label: `Region ${String.fromCharCode(65 + index)}`,
      x: clampFraction(x),
      y: clampFraction(y),
      width: clampFraction(width),
      height: clampFraction(height),
    });
  }
  return regions;
}

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const MODEL_STATUSES=["success","unavailable","invalid_input","inference_error"] as const;
function requiredRecord(parent:Record<string,unknown>,key:string):Record<string,unknown>{const value=parent[key];if(!isRecord(value))throw new ContractViolation(`${key} missing`);return value}
function requiredString(parent:Record<string,unknown>,key:string):string{const value=readString(parent,key);if(!value)throw new ContractViolation(`${key} missing`);return value}
function requiredNumber(parent:Record<string,unknown>,key:string):number{const value=readFiniteNumber(parent,key);if(value===null)throw new ContractViolation(`${key} missing`);return value}
function nullableNumber(parent:Record<string,unknown>,key:string):number|null{if(parent[key]===null)return null;return requiredNumber(parent,key)}
function nullableBoolean(parent:Record<string,unknown>,key:string):boolean|null{const value=parent[key];if(value===null)return null;if(typeof value!=="boolean")throw new ContractViolation(`${key} must be boolean or null`);return value}
function strings(value:unknown):string[]{if(!Array.isArray(value)||!value.every(v=>typeof v==="string"))throw new ContractViolation("expected a string array");return value}
function modelStatus(value:Record<string,unknown>){const status=readMember(value,"status",MODEL_STATUSES);if(!status)throw new ContractViolation("unknown model status");return status}
function probabilities(value:unknown):Record<string,number>{if(!isRecord(value))throw new ContractViolation("class_probabilities missing");const out:Record<string,number>={};for(const [key,item] of Object.entries(value)){if(typeof item!=="number"||!Number.isFinite(item))throw new ContractViolation("invalid class probability");out[key]=item}return out}
function imageEvidence(value:unknown):ImageModelEvidence{if(!isRecord(value))throw new ContractViolation("image evidence missing");return{modelId:requiredString(value,"model_id"),modelVersion:requiredString(value,"model_version"),task:requiredString(value,"task"),status:modelStatus(value),probability:nullableNumber(value,"probability"),decisionThreshold:nullableNumber(value,"decision_threshold"),thresholdMet:nullableBoolean(value,"threshold_met"),predictedLabel:value.predicted_label===null?null:requiredString(value,"predicted_label"),classProbabilities:probabilities(value.class_probabilities),warnings:strings(value.warnings)}}
function clinicalEvidence(value:unknown):ClinicalEvidence{if(!isRecord(value))throw new ContractViolation("clinical evidence missing");return{modelId:requiredString(value,"model_id"),modelVersion:requiredString(value,"model_version"),status:modelStatus(value),suppliedFeatureCount:requiredNumber(value,"supplied_feature_count"),rawProbability:nullableNumber(value,"raw_probability"),calibratedProbability:nullableNumber(value,"calibrated_probability"),screeningThreshold:requiredNumber(value,"screening_threshold"),screeningThresholdMet:nullableBoolean(value,"screening_threshold_met"),warnings:strings(value.warnings)}}
function segmentationEvidence(value:unknown):SegmentationEvidence{if(!isRecord(value))throw new ContractViolation("segmentation evidence missing");return{modelId:requiredString(value,"model_id"),modelVersion:requiredString(value,"model_version"),status:modelStatus(value),segmentationAvailable:value.segmentation_available===true,maskWidth:nullableNumber(value,"mask_width"),maskHeight:nullableNumber(value,"mask_height"),foregroundFraction:nullableNumber(value,"foreground_fraction"),connectedComponentCount:nullableNumber(value,"connected_component_count"),maskPngDataUrl:value.mask_png_data_url===null?null:requiredString(value,"mask_png_data_url"),threshold:requiredNumber(value,"threshold"),warnings:strings(value.warnings)}}
function decodeEvidence(value:unknown):OviaEvidence{if(!isRecord(value))throw new ContractViolation("evidence missing");const images=requiredRecord(value,"image_models");return{imageModels:{biomedclip:imageEvidence(images.biomedclip),convnextTiny:imageEvidence(images.convnext_tiny)},clinicalModel:clinicalEvidence(value.clinical_model),segmentation:segmentationEvidence(value.segmentation),warnings:strings(value.warnings)}}
function decodeOrchestration(value:unknown):OrchestrationResult{if(!isRecord(value))throw new ContractViolation("orchestration missing");const agreement=requiredRecord(value,"agreement");const status=readMember(value,"status",["success","unavailable","invalid_response"]as const);const agreementStatus=readMember(agreement,"status",["concordant","mixed","insufficient"]as const);if(!status||!agreementStatus)throw new ContractViolation("invalid orchestration status");const narrative=value.evidence;if(!Array.isArray(narrative))throw new ContractViolation("orchestration evidence missing");return{status,provider:requiredString(value,"provider"),model:value.model===null?null:requiredString(value,"model"),summary:value.summary===null?null:requiredString(value,"summary"),evidence:narrative.map(item=>{if(!isRecord(item))throw new ContractViolation("invalid narrative evidence");return{source:requiredString(item,"source"),finding:requiredString(item,"finding"),importance:requiredString(item,"importance")}}),agreement:{status:agreementStatus,explanation:requiredString(agreement,"explanation")},limitations:strings(value.limitations),recommendedNextStep:requiredString(value,"recommended_next_step"),disclaimer:requiredString(value,"disclaimer"),warnings:strings(value.warnings)}}

// ── Error response ────────────────────────────────────────────────

/** Handbook §5 envelope: `{ error: { code, message, details } }`. */
interface DecodedEnvelope {
  code: string | null;
  guidanceKey: string | null;
}

function decodeEnvelope(body: unknown): DecodedEnvelope {
  if (!isRecord(body) || !isRecord(body.error)) {
    return { code: null, guidanceKey: null };
  }
  const error = body.error;
  const details = isRecord(error.details) ? error.details : null;

  // `message` is read but never returned. Server prose is not participant copy:
  // it is unlocalised, unreviewed, and outside the locked vocabulary.
  return {
    code: readString(error, "code"),
    guidanceKey: details ? readString(details, "guidance_key") : null,
  };
}

/**
 * HTTP status + envelope -> domain error.
 *
 * Status is the primary signal and the code refines it, so an unfamiliar code
 * still lands in the right class rather than falling through to terminal.
 */
export function decodeErrorResponse(status: number, body: unknown): OviaError {
  const { code, guidanceKey } = decodeEnvelope(body);

  if (status === 422) {
    const rejection = IMAGE_REJECTION_CODES.find((c) => c === code);
    if (rejection) {
      return {
        class: "image_rejected_server",
        code: rejection,
        guidanceKey: guidanceKey ?? `image.rejected.${rejection}`,
      };
    }
    // 422 without a recognised image code means the server rejected the
    // submission on grounds the client cannot explain. Not retryable.
    return { class: "terminal_error", code: "contract_error" };
  }

  if (status === 409 || code === "schema_version_mismatch") {
    return { class: "terminal_error", code: "schema_version_mismatch" };
  }

  if (status === 408 || status === 504) {
    return { class: "retryable_error", code: "timeout" };
  }

  if (status === 429 || status === 502 || status === 503 || status >= 500) {
    return { class: "retryable_error", code: "upstream_unavailable" };
  }

  return { class: "terminal_error", code: "contract_error" };
}
