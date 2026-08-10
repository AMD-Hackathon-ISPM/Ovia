import { useEffect, useRef } from "react";
import { AlertCircle } from "../lib/icons";
import { useFormContext } from "../context/FormContext";
import { useSubmission } from "@/context/SubmissionContext";
import { Button } from "./ui/button";
import { errorCopy } from "./submissionCopy";

const TEXT_COLOR = "#535861";

/**
 * Terminal technical screen (frontend-architecture.md §7.1).
 *
 * No output, no partial result, no retry. A version mismatch is terminal by
 * design: the client never coerces or downgrades a payload to make a rejected
 * request succeed. Reset is the only way forward.
 */
export default function TerminalError() {
  const { dispatch } = useFormContext();
  const { state, dismissError } = useSubmission();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const copy =
    state.status === "error" && state.error.class === "terminal_error"
      ? errorCopy(state.error)
      : {
          title: "Ovia cannot run safely right now",
          body: "Something went wrong that this app cannot interpret. No result was produced.",
          primaryLabel: null,
        };

  function handleReset() {
    dismissError();
    dispatch({ type: "RESET" });
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div className="flex flex-col items-center gap-4 px-6 pt-8 pb-2">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <AlertCircle
            className="h-10 w-10 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 pt-4">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="rounded-sm text-left text-lg font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          style={{ color: TEXT_COLOR }}
        >
          {copy.title}
        </h1>

        <p
          className="text-left text-sm leading-relaxed"
          style={{ color: TEXT_COLOR }}
        >
          {copy.body}
        </p>

        <p
          className="text-left text-sm leading-relaxed"
          style={{ color: TEXT_COLOR, opacity: 0.58 }}
        >
          If you have a concern about your health, speak with a doctor, nurse,
          or midwife.
        </p>

        <Button
          onClick={handleReset}
          variant="outline"
          className="mt-2 h-14 w-full rounded-xl text-base font-bold"
          style={{ borderColor: TEXT_COLOR, color: TEXT_COLOR }}
        >
          Start over
        </Button>
      </div>
    </div>
  );
}
