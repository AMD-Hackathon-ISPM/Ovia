import { useEffect, useRef } from "react";
import { HelpCircle } from "../lib/icons";
import { useFormContext } from "../context/FormContext";
import { Button } from "./ui/button";
import { evaluateEligibility, REASON_STEP } from "../lib/eligibility";
import { CLINICIAN_ROUTE, INELIGIBLE_COPY } from "./notEligibleCopy";

const TEXT_COLOR = "#535861";
const BRAND_COLOR = "#D6697C";

/**
 * The three reason-specific ineligible exits (FE-2).
 *
 * The reason is derived from the answers rather than stored, so this screen can
 * never disagree with the answer that produced it. No estimate is rendered here
 * under any condition -- there is nothing in scope to render one from.
 */
export default function NotEligible() {
  const { state, dispatch, goToStep } = useFormContext();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const outcome = evaluateEligibility(state.data);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Defensive: reaching this step without a disqualifying answer means the
  // participant navigated back to a corrected answer. Return them to the flow.
  if (outcome.status !== "ineligible") {
    return (
      <div className="w-full px-6 pt-8">
        <Button
          onClick={() => goToStep("eligibility-ovary")}
          variant="outline"
          className="w-full h-12 rounded-xl font-bold"
        >
          Back to the eligibility questions
        </Button>
      </div>
    );
  }

  const copy = INELIGIBLE_COPY[outcome.reason];
  const reviewStep = REASON_STEP[outcome.reason];

  return (
    <div className="w-full flex flex-col min-h-screen">
      <div className="flex flex-col items-center gap-4 pt-8 pb-2 px-6">
        <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center">
          <HelpCircle
            className="w-10 h-10"
            style={{ color: BRAND_COLOR }}
            aria-hidden="true"
          />
        </div>
        <p
          className="text-sm font-bold tracking-widest uppercase"
          style={{ color: BRAND_COLOR }}
        >
          Eligibility Check
        </p>
      </div>

      <div className="flex flex-col gap-4 px-6 pt-4">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-bold text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-sm"
          style={{ color: TEXT_COLOR }}
        >
          {copy.title}
        </h1>

        <p
          className="text-sm text-left leading-relaxed"
          style={{ color: TEXT_COLOR }}
        >
          {copy.body}
        </p>

        <p
          className="text-sm text-left leading-relaxed"
          style={{ color: TEXT_COLOR, opacity: 0.58 }}
        >
          {copy.answerRecap} If that is not right, you can change it.
        </p>

        <Button
          onClick={() => goToStep(reviewStep)}
          className="w-full h-14 text-base rounded-xl font-bold mt-2
                     text-white border-none shadow-none ring-0"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          {copy.reviewLabel}
        </Button>

        <section
          aria-labelledby="clinician-route-heading"
          className="mt-2 rounded-xl border p-4 text-left"
          style={{ borderColor: `${TEXT_COLOR}33` }}
        >
          <h2
            id="clinician-route-heading"
            className="text-sm font-bold"
            style={{ color: TEXT_COLOR }}
          >
            {CLINICIAN_ROUTE.heading}
          </h2>
          <p
            className="text-sm mt-1 leading-relaxed"
            style={{ color: TEXT_COLOR, opacity: 0.75 }}
          >
            {CLINICIAN_ROUTE.body}
          </p>
        </section>

        <Button
          onClick={() => dispatch({ type: "RESET" })}
          variant="ghost"
          className="w-full h-12 text-sm rounded-xl"
          style={{ color: TEXT_COLOR }}
        >
          Start over
        </Button>
      </div>

      <div className="mt-auto px-8 pb-6 pt-8">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Ovia is a screening research prototype. It does not diagnose or rule
          out PCOS or any other ovaries-related conditions. Every participant
          should receive confirmatory evaluation.
        </p>
      </div>
    </div>
  );
}
