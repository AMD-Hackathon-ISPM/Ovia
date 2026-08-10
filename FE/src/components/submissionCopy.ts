// Copy for the processing overlay and the error taxonomy (FE-4).
//
// Held apart from the components so it can be prohibited-vocabulary scanned and
// paired with an Indonesian bundle at FE-9.
//
// Rule (frontend-architecture.md §9): no "saved" or "upload complete" claim
// before acknowledgement. Every stage label below describes the client's own
// work in progress, and none of them asserts a completed or secured transfer.

import type { SubmitStage } from "@/context/SubmissionContext";
import type { OviaError } from "@/lib/adapter";

export const STAGE_COPY: Record<SubmitStage, string> = {
  preparing: "Preparing your answers",
  uploading: "Uploading ultrasound",
  image: "Analyzing image evidence",
  clinical: "Analyzing clinical evidence",
  segmenting: "Segmenting a candidate lesion region",
  synthesizing: "Synthesizing evidence",
  slow: "Still analysing — this is taking longer than usual",
};

export interface ErrorCopy {
  title: string;
  body: string;
  /** Null when no retry is offered. Terminal errors are never retried. */
  primaryLabel: string | null;
}

const RETRYABLE_COPY: Record<string, ErrorCopy> = {
  timeout: {
    title: "That took too long",
    body: "The analysis did not come back in time. Nothing has been assessed, and no result was produced. You can send your answers again.",
    primaryLabel: "Try again",
  },
  network: {
    title: "Could not reach the service",
    body: "Your connection dropped before the analysis finished. Nothing has been assessed, and no result was produced. You can send your answers again.",
    primaryLabel: "Try again",
  },
  upstream_unavailable: {
    title: "The service is unavailable right now",
    body: "The analysis service did not respond. Nothing has been assessed, and no result was produced. You can send your answers again.",
    primaryLabel: "Try again",
  },
};

const IMAGE_REJECTION_COPY: Record<string, ErrorCopy> = {
  insufficient_quality: {
    title: "That image could not be used",
    body: "The scan was not clear enough to analyse. Your answers have been kept. You can attach a different image, or continue without one.",
    primaryLabel: null,
  },
  unrecognised_view: {
    title: "That image could not be used",
    body: "The scan does not appear to show the view this tool expects. Your answers have been kept. You can attach a different image, or continue without one.",
    primaryLabel: null,
  },
  obscured_field: {
    title: "That image could not be used",
    body: "Too much of the scan was obscured to analyse it. Your answers have been kept. You can attach a different image, or continue without one.",
    primaryLabel: null,
  },
};

const TERMINAL_COPY: Record<string, ErrorCopy> = {
  schema_version_mismatch: {
    title: "Ovia cannot run safely right now",
    body: "This version of the app and the analysis service do not agree on the data format. Ovia will not guess at the difference, so it has stopped. No result was produced. Please try again after the app updates.",
    primaryLabel: null,
  },
  contract_error: {
    title: "Ovia cannot run safely right now",
    body: "The analysis service rejected the request in a way this app cannot interpret. Ovia has stopped rather than continue on unreliable data. No result was produced.",
    primaryLabel: null,
  },
};

export function errorCopy(error: OviaError): ErrorCopy {
  switch (error.class) {
    case "retryable_error":
      return RETRYABLE_COPY[error.code];
    case "image_rejected_server":
      return IMAGE_REJECTION_COPY[error.code];
    case "terminal_error":
      return TERMINAL_COPY[error.code];
  }
}
