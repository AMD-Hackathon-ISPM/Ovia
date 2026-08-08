import { HeartPulse, Scan, Search, FileText } from "../lib/icons";
import { useFormContext, type Step } from "../context/FormContext";

const ELIGIBILITY_STEPS: Step[] = [
  "eligibility-ovary",
  "eligibility-pregnancy",
  "eligibility-age",
];

const MAIN_STEPS: { step: Step; icon: typeof HeartPulse; label: string }[] = [
  { step: "clinical", icon: HeartPulse, label: "Clinical" },
  { step: "ultrasound", icon: Scan, label: "Ultrasound" },
  { step: "review", icon: Search, label: "Review" },
  { step: "results", icon: FileText, label: "Results" },
];

export default function ProgressIndicator() {
  const { state } = useFormContext();
  const { step } = state;

  if (ELIGIBILITY_STEPS.includes(step)) {
    const currentIdx = ELIGIBILITY_STEPS.indexOf(step);

    return (
      <div className="flex justify-center items-center gap-2 w-full mb-2">
        {ELIGIBILITY_STEPS.map((_, i) => {
          const isActiveOrDone = i <= currentIdx;
          return (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full transition-all duration-300"
              style={{
                backgroundColor: isActiveOrDone ? "#D6697C" : "#E9E9E9",
              }}
            />
          );
        })}
      </div>
    );
  }

  if (step === "not-eligible") return null;

  const currentMainIdx = MAIN_STEPS.findIndex((s) => s.step === step);
  if (currentMainIdx < 0) return null;

  return (
    <div className="flex items-center justify-center mb-8">
      {MAIN_STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = i === currentMainIdx;
        const isDone = i < currentMainIdx;
        const isActiveOrDone = isActive || isDone;

        return (
          <div key={s.step} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  backgroundColor: isActiveOrDone ? "#FADADD" : "#E9E9E9",
                  color: isActiveOrDone ? "#D6697C" : "#C8C4C4",
                }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span
                className="text-xs font-medium transition-colors duration-300"
                style={{
                  color: isActiveOrDone ? "#1F2937" : "#9CA3AF",
                }}
              >
                {s.label}
              </span>
            </div>
            {i < MAIN_STEPS.length - 1 && (
              /* The sibling column is icon (40px) + gap (6px) + label, so
                 items-center would sink the rule below the icons. Pin it to the
                 icon's own centre line: 20px - 1px for the rule's height. */
              <div
                className="w-8 h-0.5 mx-1 self-start mt-4.75 transition-colors duration-300"
                style={{
                  backgroundColor: isDone ? "#D6697C" : "#E9E9E9",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}