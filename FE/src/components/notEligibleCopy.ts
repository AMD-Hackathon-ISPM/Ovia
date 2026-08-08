// Participant-facing copy for the three ineligible exits.
//
// Held apart from the component so the strings can be reviewed as copy, scanned
// for prohibited vocabulary, and paired with an Indonesian bundle at FE-9.
//
// Rules these strings obey (frontend-architecture.md §4.3, Locked):
//   - never a health judgement, and never about the person
//   - no estimate, band, or figure of any kind
//   - reason given plainly, so the answer that ended the flow is obvious
//   - the way back is a correction route, not a retry of the screening

import type { IneligibleReason } from "@/lib/eligibility";

export interface IneligibleCopy {
  /** Names the scope of the tool, never the participant. */
  title: string;
  /** Why this screening does not apply. One sentence, no hedging. */
  body: string;
  /** Restates the answer, so a mis-tap is easy to spot. */
  answerRecap: string;
  /** Label for the route back to the question that ended the flow. */
  reviewLabel: string;
}

export const INELIGIBLE_COPY: Record<IneligibleReason, IneligibleCopy> = {
  under_18: {
    title: "This screening is designed for ages 18 and above",
    body: "Ovia has only been built for adults, so it cannot screen you at this stage. This is about the scope of the tool, not about your health.",
    answerRecap: "You told us you are under 18.",
    reviewLabel: "Review my age",
  },
  no_ovary: {
    title: "Ovarian screening does not apply here",
    body: "Ovia looks for findings in the ovaries. Without at least one ovary there is nothing for it to screen, and the PCOS assessment also depends on ovarian findings.",
    answerRecap: "You told us you do not currently have at least one ovary.",
    reviewLabel: "Review my answer",
  },
  pregnancy: {
    title: "This screening is not designed for use during pregnancy",
    body: "Ovarian findings are interpreted differently during pregnancy, and Ovia has not been built for that. Using it now could be misleading rather than helpful.",
    answerRecap: "You told us you are currently pregnant.",
    reviewLabel: "Review my answer",
  },
};

/** Shown on all three exits, unchanged. */
export const CLINICIAN_ROUTE = {
  heading: "If you have a concern about your health",
  body: "Speak with a doctor, nurse, or midwife. They can assess your symptoms properly, which Ovia cannot do in any case.",
} as const;
