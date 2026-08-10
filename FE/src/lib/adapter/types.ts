// Domain types for the Ovia submission boundary.
//
// These are FRONTEND domain types, not wire types. Only HttpAdapter (FE-6)
// translates wire <-> domain. No component references a wire field name.
//
// Invariant (frontend-architecture.md §1.2): three independent outputs, no
// fusion. Nothing in this file combines conditions, and no function here takes
// more than one result and returns a single value.

export type ConditionId = "pcos" | "ovarian_cyst" | "ovarian_tumor";

/**
 * Neutral band identifiers. Display copy is locale-keyed elsewhere so that no
 * judgement vocabulary is baked into the transport layer.
 */
export type Band = "band_1" | "band_2" | "band_3";

export type SignalSource = "questionnaire" | "image";

export type CalibrationStatus = "calibrated" | "uncalibrated";

export interface ConditionResult {
  condition: ConditionId;
  signalSource: SignalSource;
  /**
   * Null when calibration metadata is absent. Per §7.1 `metadata_missing`, the
   * card then renders band-less rather than guessing a band.
   */
  band: Band | null;
  /** Null when withheld. Never a placeholder number. */
  value: number | null;
  /** True when the response lacked model version or calibration status. */
  valueWithheld: boolean;
  modelVersion: string | null;
  calibrationStatus: CalibrationStatus | null;
}

/** Why a condition was not screened. Currently only one cause exists. */
export type NotScreenedReason = "no_image_submitted";

/** Why a single condition path failed while the others succeeded. */
export type PanelErrorCode = "inference_failed" | "signal_unusable";

/**
 * Per-condition state. Transitioning to `not_screened` or `unavailable`
 * discards any previous `data` -- these variants cannot carry stale results.
 */
export type PanelState<T> =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success"; data: T }
  | { status: "not_screened"; reason: NotScreenedReason }
  | { status: "unavailable"; code: PanelErrorCode };

/**
 * The three panels as independent siblings. Deliberately an object of three
 * named fields rather than an array, so nothing can map/reduce across them.
 */
export interface ResultPanels {
  pcos: PanelState<ConditionResult>;
  ovarianCyst: PanelState<ConditionResult>;
  ovarianTumor: PanelState<ConditionResult>;
}

// ── Errors (frontend-architecture.md §7.1) ────────────────────────
// `client_validation` and `image_rejected_client` are raised before a request
// is sent and therefore never originate here.

/** Server quality-gate codes. A separate enum from the client gate; ARCH-2 owns
 *  the real set. PROVISIONAL -- pins on ARCH-2. */
export type ServerImageRejectionCode =
  | "insufficient_quality"
  | "unrecognised_view"
  | "obscured_field";

export type RetryableErrorCode = "timeout" | "network" | "upstream_unavailable";

export type TerminalErrorCode = "schema_version_mismatch" | "contract_error";

export type OviaError =
  | {
      class: "image_rejected_server";
      code: ServerImageRejectionCode;
      /** Guidance key, resolved to copy by the UI. Never raw server prose. */
      guidanceKey: string;
    }
  | { class: "retryable_error"; code: RetryableErrorCode }
  | { class: "terminal_error"; code: TerminalErrorCode };

// ── Submission ────────────────────────────────────────────────────

export interface SubmitInput {
  /** Answers as the participant entered them. Shape pins on ARCH-1. */
  answers: Record<string, unknown>;
  /** Re-encoded, metadata-stripped image. Null when the step was skipped. */
  image: Blob | null;
  /** Client-generated correlation id. Not a case identifier. */
  requestId: string;
  /** Client's contract version. A mismatch is terminal and never coerced. */
  schemaVersion: string;
}

/**
 * A region of the submitted image the model attended to.
 *
 * PROVISIONAL -- pins on ARCH-4, which owns the imaging finding vocabulary,
 * the confidence semantics, and the question of whether localisation output
 * exists at all. `label` is therefore deliberately a bare ordinal: no finding
 * name may be shown until ARCH-4 is signed.
 *
 * Coordinates are fractions of the image box (0..1), so the overlay scales with
 * zoom without touching the sonogram itself.
 */
export interface InspectionRegion {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ModelStatus = "success" | "unavailable" | "invalid_input" | "inference_error";
export interface ImageModelEvidence {
  modelId:string; modelVersion:string; task:string; status:ModelStatus;
  probability:number|null; decisionThreshold:number|null; thresholdMet:boolean|null;
  predictedLabel:string|null; classProbabilities:Record<string,number>; warnings:string[];
}
export interface ClinicalEvidence {
  modelId:string; modelVersion:string; status:ModelStatus; suppliedFeatureCount:number;
  rawProbability:number|null; calibratedProbability:number|null; screeningThreshold:number;
  screeningThresholdMet:boolean|null; warnings:string[];
}
export interface SegmentationEvidence {
  modelId:string; modelVersion:string; status:ModelStatus; segmentationAvailable:boolean;
  maskWidth:number|null; maskHeight:number|null; foregroundFraction:number|null;
  connectedComponentCount:number|null; maskPngDataUrl:string|null; threshold:number; warnings:string[];
}
export interface OviaEvidence {
  imageModels:{biomedclip:ImageModelEvidence;convnextTiny:ImageModelEvidence};
  clinicalModel:ClinicalEvidence; segmentation:SegmentationEvidence; warnings:string[];
}
export interface NarrativeEvidence {source:string;finding:string;importance:string}
export interface OrchestrationResult {
  status:"success"|"unavailable"|"invalid_response";provider:string;model:string|null;summary:string|null;
  evidence:NarrativeEvidence[];agreement:{status:"concordant"|"mixed"|"insufficient";explanation:string};
  limitations:string[];recommendedNextStep:string;disclaimer:string;warnings:string[];
}

export type SubmitOutcome =
  | {
      status: "ok";
      requestId: string;
      receivedAt: number;
      contractVersion: string;
      panels: ResultPanels;
      /** Deterministic, authoritative backend model evidence. */
      evidence?: OviaEvidence;
      /** Optional interpretation. This never replaces deterministic evidence. */
      orchestration?: OrchestrationResult;
      /** Absent when the model produced no localisation output. */
      inspection?: InspectionRegion[];
    }
  | {
      status: "error";
      requestId: string;
      error: OviaError;
    };

/**
 * The swap point. `FixtureAdapter` today, `HttpAdapter` at FE-6. Changing the
 * real contract touches one module, not the flow.
 */
export interface OviaAdapter {
  submit(input: SubmitInput, signal: AbortSignal): Promise<SubmitOutcome>;
}
