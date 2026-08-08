import { useEffect, useRef } from "react";
import { useSubmission } from "@/context/SubmissionContext";
import { STAGE_COPY } from "./submissionCopy";

const BRAND = "#D6697C";
const TEXT_COLOR = "#535861";

/**
 * Blocking overlay shown while a submission is in flight (FE-4, PRD-05).
 *
 * It covers the flow so no earlier screen stays interactive underneath, offers
 * cancel at every stage, and never claims the transfer has completed.
 */
export default function ProcessingOverlay() {
  const { state, cancel } = useSubmission();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const submitting = state.status === "submitting";

  useEffect(() => {
    if (submitting) cancelRef.current?.focus();
  }, [submitting]);

  useEffect(() => {
    if (!submitting) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") cancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [submitting, cancel]);

  if (state.status !== "submitting") return null;

  const label = STAGE_COPY[state.stage];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Analysis in progress"
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-background px-8"
    >
      <div
        aria-hidden="true"
        className="h-12 w-12 rounded-full border-4 border-current/20 animate-spin motion-reduce:animate-none"
        style={{ borderTopColor: BRAND, color: TEXT_COLOR }}
      />

      <p
        aria-live="polite"
        className="text-center text-base font-bold"
        style={{ color: TEXT_COLOR }}
      >
        {label}
      </p>

      <p
        className="max-w-xs text-center text-sm leading-relaxed"
        style={{ color: TEXT_COLOR, opacity: 0.58 }}
      >
        Keep this screen open. Your answers are not stored, so leaving now ends
        the session.
      </p>

      <button
        ref={cancelRef}
        type="button"
        onClick={cancel}
        className="h-12 w-full max-w-xs rounded-xl border text-base font-bold
                   focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        style={{ borderColor: TEXT_COLOR, color: TEXT_COLOR }}
      >
        Cancel
      </button>
    </div>
  );
}
