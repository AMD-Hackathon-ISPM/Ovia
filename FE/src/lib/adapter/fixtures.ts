// The seven fixture outcomes (frontend-architecture.md §7).
//
// Synthetic only. No real patient data, no real sonogram, no recorded run.
// None of these values may be cited as accuracy, sensitivity, or performance.

import type {
  ConditionResult,
  InspectionRegion,
  PanelState,
  ResultPanels,
  SubmitOutcome,
} from "./types";

export type FixtureOutcomeId =
  | "all_scored"
  | "image_skipped"
  | "one_unavailable"
  | "server_quality_rejection"
  | "retryable_timeout"
  | "terminal_version_mismatch"
  | "missing_calibration";

export interface FixtureOutcomeMeta {
  id: FixtureOutcomeId;
  /** Operator-facing label. Not participant copy. */
  label: string;
  /** What the flow should do when this outcome is selected. */
  note: string;
}

/** Fixed order, shown as-is in the demo drawer. */
export const FIXTURE_OUTCOMES: readonly FixtureOutcomeMeta[] = [
  {
    id: "all_scored",
    label: "All three conditions scored",
    note: "Happy path with an image attached.",
  },
  {
    id: "image_skipped",
    label: "Image skipped",
    note: "PCOS scored; cyst and tumour render as not screened.",
  },
  {
    id: "one_unavailable",
    label: "One condition unavailable",
    note: "Tumour path fails; the other two and the recommendation are untouched.",
  },
  {
    id: "server_quality_rejection",
    label: "Server quality rejection",
    note: "Returns to the upload step with mapped guidance; answers intact.",
  },
  {
    id: "retryable_timeout",
    label: "Retryable timeout",
    note: "Returns to review with an explicit retry. No partial output.",
  },
  {
    id: "terminal_version_mismatch",
    label: "Terminal version mismatch",
    note: "Terminal technical screen. No output. Never coerced.",
  },
  {
    id: "missing_calibration",
    label: "Missing calibration metadata",
    note: "Values withheld, cards render band-less, limitations still shown.",
  },
] as const;

export const DEFAULT_FIXTURE_OUTCOME: FixtureOutcomeId = "all_scored";

const CONTRACT_VERSION = "ovia-v1";

// ── Result builders ───────────────────────────────────────────────

function scored(
  condition: ConditionResult["condition"],
  signalSource: ConditionResult["signalSource"],
  band: NonNullable<ConditionResult["band"]>,
  value: number
): PanelState<ConditionResult> {
  return {
    status: "success",
    data: {
      condition,
      signalSource,
      band,
      value,
      valueWithheld: false,
      modelVersion: "fixture-0.0.0",
      calibrationStatus: "calibrated",
    },
  };
}

function withheld(
  condition: ConditionResult["condition"],
  signalSource: ConditionResult["signalSource"]
): PanelState<ConditionResult> {
  return {
    status: "success",
    data: {
      condition,
      signalSource,
      band: null,
      value: null,
      valueWithheld: true,
      modelVersion: null,
      calibrationStatus: null,
    },
  };
}

const notScreened: PanelState<ConditionResult> = {
  status: "not_screened",
  reason: "no_image_submitted",
};

const unavailable: PanelState<ConditionResult> = {
  status: "unavailable",
  code: "inference_failed",
};

/** Synthetic regions. Labels are bare ordinals until ARCH-4 is signed. */
const FIXTURE_INSPECTION: readonly InspectionRegion[] = [
  { id: "r1", label: "Region A", x: 0.34, y: 0.28, width: 0.22, height: 0.24 },
  { id: "r2", label: "Region B", x: 0.58, y: 0.52, width: 0.16, height: 0.15 },
] as const;

function ok(
  requestId: string,
  panels: ResultPanels,
  inspection?: readonly InspectionRegion[]
): SubmitOutcome {
  return {
    status: "ok",
    requestId,
    receivedAt: Date.now(),
    contractVersion: CONTRACT_VERSION,
    panels,
    ...(inspection ? { inspection: [...inspection] } : {}),
  };
}

// ── The seven ────────────────────────────────────────────────────

export function buildFixtureOutcome(
  id: FixtureOutcomeId,
  requestId: string
): SubmitOutcome {
  switch (id) {
    case "all_scored":
      return ok(
        requestId,
        {
          pcos: scored("pcos", "questionnaire", "band_2", 0.41),
          ovarianCyst: scored("ovarian_cyst", "image", "band_1", 0.12),
          ovarianTumor: scored("ovarian_tumor", "image", "band_3", 0.68),
        },
        FIXTURE_INSPECTION
      );

    case "image_skipped":
      return ok(requestId, {
        pcos: scored("pcos", "questionnaire", "band_2", 0.37),
        ovarianCyst: notScreened,
        ovarianTumor: notScreened,
      });

    case "one_unavailable":
      return ok(requestId, {
        pcos: scored("pcos", "questionnaire", "band_1", 0.09),
        ovarianCyst: scored("ovarian_cyst", "image", "band_2", 0.44),
        ovarianTumor: unavailable,
      });

    case "missing_calibration":
      return ok(requestId, {
        pcos: withheld("pcos", "questionnaire"),
        ovarianCyst: withheld("ovarian_cyst", "image"),
        ovarianTumor: withheld("ovarian_tumor", "image"),
      });

    case "server_quality_rejection":
      return {
        status: "error",
        requestId,
        error: {
          class: "image_rejected_server",
          code: "insufficient_quality",
          guidanceKey: "image.guidance.insufficient_quality",
        },
      };

    case "retryable_timeout":
      return {
        status: "error",
        requestId,
        error: { class: "retryable_error", code: "timeout" },
      };

    case "terminal_version_mismatch":
      return {
        status: "error",
        requestId,
        error: {
          class: "terminal_error",
          code: "schema_version_mismatch",
        },
      };
  }
}
