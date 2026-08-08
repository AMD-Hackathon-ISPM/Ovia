// Eligibility rules (frontend-architecture.md §4.3).
//
// Pure. No React, no state, no side effects -- so the rule set can be tested
// on its own and can never drift from what the screens render.
//
// Locked: an ineligible exit is never framed as a health judgement, never
// shows any estimate, always offers a route back to review the answer (in case
// of a mis-tap), and always offers a clinician route.

import type { FormData, Step } from "../context/FormContext";

export type IneligibleReason = "under_18" | "no_ovary" | "pregnancy";

export type EligibilityOutcome =
  | { status: "pending" }
  | { status: "eligible" }
  | { status: "ineligible"; reason: IneligibleReason };

/** The question each reason came from, so "review my answers" returns there. */
export const REASON_STEP: Record<IneligibleReason, Step> = {
  no_ovary: "eligibility-ovary",
  pregnancy: "eligibility-pregnancy",
  under_18: "eligibility-age",
};

/**
 * Evaluated in the order the questions are asked. The first disqualifying
 * answer wins, because later questions are never reached.
 */
export function evaluateEligibility(data: FormData): EligibilityOutcome {
  if (data.hasOvary === null) return { status: "pending" };
  if (data.hasOvary === false) {
    return { status: "ineligible", reason: "no_ovary" };
  }

  if (data.isPregnant === null) return { status: "pending" };
  if (data.isPregnant === true) {
    return { status: "ineligible", reason: "pregnancy" };
  }

  const age = Number.parseInt(data.age, 10);
  if (data.age === "" || Number.isNaN(age)) return { status: "pending" };
  if (age < 18) {
    return { status: "ineligible", reason: "under_18" };
  }

  return { status: "eligible" };
}
