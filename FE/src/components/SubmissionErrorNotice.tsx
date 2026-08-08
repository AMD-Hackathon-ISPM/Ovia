import { useEffect, useRef } from "react";
import { AlertCircle } from "../lib/icons";
import { useSubmission } from "@/context/SubmissionContext";
import { errorCopy } from "./submissionCopy";

const TEXT_COLOR = "#535861";

/**
 * In-place notice for the two non-terminal error classes (FE-4).
 *
 * Rendered above the step the participant was returned to -- review for a
 * retryable error, upload for a server image rejection. It carries no result
 * data of any kind, and retrying is always an explicit press.
 */
export default function SubmissionErrorNotice({
  forClass,
}: {
  forClass: "retryable_error" | "image_rejected_server";
}) {
  const { state, submit, dismissError } = useSubmission();
  const ref = useRef<HTMLDivElement>(null);

  const visible = state.status === "error" && state.error.class === forClass;

  useEffect(() => {
    if (visible) ref.current?.focus();
  }, [visible]);

  if (state.status !== "error" || state.error.class !== forClass) return null;

  const copy = errorCopy(state.error);

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4 outline-none
                 focus-visible:ring-3 focus-visible:ring-destructive/30"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-sm font-bold" style={{ color: TEXT_COLOR }}>
            {copy.title}
          </h2>
          <p
            className="mt-1 text-sm leading-relaxed"
            style={{ color: TEXT_COLOR, opacity: 0.75 }}
          >
            {copy.body}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {copy.primaryLabel && (
              <button
                type="button"
                onClick={submit}
                className="h-9 rounded-lg border px-3 text-sm font-bold
                           focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                style={{ borderColor: TEXT_COLOR, color: TEXT_COLOR }}
              >
                {copy.primaryLabel}
              </button>
            )}
            <button
              type="button"
              onClick={dismissError}
              className="h-9 rounded-lg px-3 text-sm font-medium underline underline-offset-4
                         focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              style={{ color: TEXT_COLOR }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
