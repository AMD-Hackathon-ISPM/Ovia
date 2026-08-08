import { useMemo } from "react";
import { useFormContext } from "../context/FormContext";
import { evaluateRisks, type RiskResult } from "../lib/riskLogic";
import { useSubmission } from "@/context/SubmissionContext";
import InspectionFigure from "./InspectionFigure";

const BRAND = "#D6697C";
const TEXT_COLOR = "#535861";
const GRAY_HEADER = "#B9BCC0";
const GRAY_TEXT = "#9CA3AF";

const RISK_LEVEL_COLOR: Record<string, string> = {
  Low: "#4CAF6D",
  Moderate: "#E8A93A",
  Higher: "#E15B4F",
};

function UterusIcon({ color }: { color: string }) {
  return (
    <svg width="72" height="60" viewBox="0 0 72 60" fill="none">
      <path
        d="M28 18 C18 14, 10 16, 8 24 C6 30, 10 34, 14 32"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="9" cy="30" r="4" fill={color} opacity="0.5" />

      <path
        d="M44 18 C54 14, 62 16, 64 24 C66 30, 62 34, 58 32"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="63" cy="30" r="4" fill={color} opacity="0.5" />

      <path
        d="M28 18 C28 30, 24 34, 24 42 C24 50, 30 54, 36 54 C42 54, 48 50, 48 42 C48 34, 44 30, 44 18 C44 14, 40 12, 36 12 C32 12, 28 14, 28 18 Z"
        fill={color}
        opacity="0.35"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

const CONDITION_TITLE: Record<string, string> = {
  "ovarian-cyst": "Ovarian Cyst",
  pcos: "PCOS",
  "ovarian-tumor": "Ovarian Tumor",
};

export default function Results() {
  const { state } = useFormContext();
  const { state: submission } = useSubmission();
  const { clinical } = state.data;

  const results = useMemo(() => evaluateRisks(clinical), [clinical]);

  return (
    <div className="space-y-6" aria-live="polite">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: TEXT_COLOR }}>
          Results
        </h1>
        <p
          className="text-sm mt-1"
          style={{ color: TEXT_COLOR, opacity: 0.58 }}
        >
          A risk score with the reasoning behind it. Not a diagnosis.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {results.map((result) => (
          <RiskCard key={result.id} result={result} />
        ))}
      </div>

      <RecommendedAction results={results} />

      {/* FE-8. Rendered after the recommendation, and optional: hiding or
          removing it changes nothing above it. */}
      {state.data.ultrasoundImage && submission.status === "success" && (
        <InspectionFigure
          src={state.data.ultrasoundImage}
          regions={submission.outcome.inspection ?? []}
        />
      )}
    </div>
  );
}

function RiskCard({ result }: { result: RiskResult }) {
  const isAvailable = result.level === "Low" || result.level === "Moderate" || result.level === "Higher";
  const title = CONDITION_TITLE[result.id] || result.title;
  const headerColor = isAvailable ? BRAND : GRAY_HEADER;
  const iconColor = isAvailable ? BRAND : "#D1D5DB";
  const levelColor = isAvailable ? RISK_LEVEL_COLOR[result.level] : GRAY_TEXT;

  return (
    <div
      className="rounded-2xl border overflow-hidden flex flex-col"
      style={{ borderColor: isAvailable ? BRAND : "#E5E5E5" }}
    >
      <div className="px-3 py-3" style={{ backgroundColor: headerColor }}>
        <h3 className="text-xs font-bold text-white text-center leading-tight">
          {title}
        </h3>
      </div>

      <div className="flex flex-col items-center gap-2 p-3 flex-1">
        <div className="py-1">
          <UterusIcon color={iconColor} />
        </div>

        <div className="text-center">
          <p
            className="text-[10px] uppercase tracking-wider"
            style={{ color: isAvailable ? BRAND : GRAY_TEXT, opacity: isAvailable ? 1 : 0.7 }}
          >
            Risk assessment:
          </p>
          <p
            className="text-lg font-bold uppercase"
            style={{ color: levelColor }}
          >
            {isAvailable ? result.level : "–"}
          </p>
        </div>

        <p
          className="text-xs leading-relaxed text-center"
          style={{ color: isAvailable ? TEXT_COLOR : GRAY_TEXT }}
        >
          {result.explanation}
        </p>
      </div>
    </div>
  );
}

function RecommendedAction({ results }: { results: RiskResult[] }) {
  const hasHigher = results.some((r) => r.level === "Higher");
  const hasModerate = results.some((r) => r.level === "Moderate");
  const unavailable = results.filter(
    (r) => r.level !== "Low" && r.level !== "Moderate" && r.level !== "Higher"
  );

  let boldLead: string;
  let rest: string;

  if (hasHigher) {
    boldLead = "Higher risk identified.";
    rest =
      "We recommend consulting a gynecologist or endocrinologist for further evaluation. Bringing a record of your symptoms and this summary to your appointment may be helpful.";
  } else if (hasModerate) {
    boldLead = "Moderate risk of PCOS identified.";
    rest =
      "We recommend consulting a gynecologist or endocrinologist for further evaluation, which may include hormone panel testing (LH, FSH, testosterone) to confirm.";
  } else {
    boldLead = "Low risk based on your reported symptoms and cycle history.";
    rest = "Continue monitoring your cycle regularly.";
  }

  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: BRAND }}>
      <h3 className="text-base font-bold mb-2" style={{ color: BRAND }}>
        Recommended Action
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: TEXT_COLOR }}>
        <span className="font-bold">{boldLead}</span> {rest}
      </p>

      {unavailable.length > 0 && (
        <p className="text-sm leading-relaxed mt-3" style={{ color: TEXT_COLOR }}>
          {unavailable.map((r) => CONDITION_TITLE[r.id] || r.title).join(" and ")}{" "}
          could not be screened. {unavailable.length > 1 ? "These conditions" : "This condition"}{" "}
          require{unavailable.length === 1 ? "s" : ""} an ultrasound image for
          assessment. We recommend adding an ultrasound scan to complete your
          screening.
        </p>
      )}
    </div>
  );
}