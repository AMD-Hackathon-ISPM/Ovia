import { Pencil, Upload } from "../lib/icons";
import { useFormContext } from "../context/FormContext";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";

const BRAND = "#D6697C";
const BRAND_LIGHT = "#FADADD";
const TEXT_COLOR = "#535861";
const DISABLED_COLOR = "#76787B";

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal weight";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

const MENOPAUSAL_LABEL: Record<string, string> = {
  pre: "Pre-Menopausal",
  "post-natural": "Post-Menopausal (natural)",
  "post-surgical": "Post-Menopausal (surgical/induced)",
};

export default function ReviewConsent() {
  const { state, dispatch, goToStep, goToNextStep } = useFormContext();
  const { data } = state;
  const { clinical } = data;

  const heightM = parseFloat(clinical.heightCm) / 100;
  const weightKg = parseFloat(clinical.weightKg);
  const bmiVal =
    heightM > 0 && weightKg > 0
      ? (weightKg / (heightM * heightM)).toFixed(1)
      : null;

  const flaggedSymptoms = clinical.symptoms;

  return (
    <div className="w-full space-y-5">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: TEXT_COLOR }}>
          Review
        </h2>
        <p className="text-sm mt-1" style={{ color: TEXT_COLOR, opacity: 0.58 }}>
          Check that every entry is accurate — this is what the model will
          use.
        </p>
      </div>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: BRAND }}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ backgroundColor: BRAND }}
        >
          <h3 className="text-sm font-bold text-white">
            Clinical Information
          </h3>
          <button
            type="button"
            onClick={() => goToStep("clinical")}
            aria-label="Edit clinical information"
          >
            <Pencil className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div
              className="rounded-2xl p-4 text-center"
              style={{ backgroundColor: BRAND_LIGHT }}
            >
              <p className="text-xl font-bold" style={{ color: BRAND }}>
                {data.age || "—"}
              </p>
              <p className="text-xs" style={{ color: BRAND }}>
                years old
              </p>
            </div>

            <div
              className="rounded-2xl p-4 text-center"
              style={{ backgroundColor: BRAND_LIGHT }}
            >
              <p className="text-xl font-bold" style={{ color: BRAND }}>
                {bmiVal || "—"}
              </p>
              <p className="text-xs" style={{ color: BRAND }}>
                BMI
              </p>
            </div>

            <div
              className="rounded-2xl p-4 text-center flex items-center justify-center"
              style={{ backgroundColor: BRAND_LIGHT }}
            >
              <p
                className="text-sm font-bold leading-tight"
                style={{ color: BRAND }}
              >
                {MENOPAUSAL_LABEL[clinical.menopausalStatus] ||
                  clinical.menopausalStatus ||
                  "—"}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm" style={{ color: TEXT_COLOR }}>
              <span
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: BRAND }}
              />
              <span>
                Menarche at {clinical.ageMenarche || "—"} ·{" "}
                {clinical.cycleRegularity === "regular"
                  ? "Regular"
                  : clinical.cycleRegularity === "irregular"
                  ? "Irregular"
                  : "—"}{" "}
                cycles
              </span>
            </li>

            <li className="flex items-start gap-2 text-sm" style={{ color: TEXT_COLOR }}>
              <span
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: BRAND }}
              />
              <span>
                {clinical.hormonalUse && clinical.hormonalUse !== "none"
                  ? `Hormonal use: ${clinical.hormonalUse.replace(/-/g, " ")}`
                  : "No hormonal contraceptive or HRT use"}
              </span>
            </li>

            {clinical.pregnancies && parseInt(clinical.pregnancies) > 0 && (
              <li className="flex items-start gap-2 text-sm" style={{ color: TEXT_COLOR }}>
                <span
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: BRAND }}
                />
                <span>
                  {clinical.pregnancies} pregnancy
                  {parseInt(clinical.pregnancies) > 1 ? "ies" : "y"}
                  {clinical.births && parseInt(clinical.births) > 0
                    ? `, ${clinical.births} birth${
                        parseInt(clinical.births) > 1 ? "s" : ""
                      }`
                    : ""}
                </span>
              </li>
            )}

            {clinical.familyHistory && (
              <li className="flex items-start gap-2 text-sm" style={{ color: TEXT_COLOR }}>
                <span
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: BRAND }}
                />
                <span>Family history of ovarian or breast cancer</span>
              </li>
            )}
          </ul>

          {flaggedSymptoms.length > 0 && (
            <div>
              <h4
                className="text-sm font-bold mb-3"
                style={{ color: BRAND }}
              >
                Symptoms Flagged
              </h4>
              <div className="space-y-2">
                {flaggedSymptoms.map((s) => (
                  <div
                    key={s}
                    className="rounded-xl px-4 py-3 text-sm"
                    style={{ backgroundColor: "#F5EEDA", color: TEXT_COLOR }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl border p-4 flex items-center justify-between gap-3"
        style={{ borderColor: BRAND }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {data.ultrasoundImage ? (
            <img
              src={data.ultrasoundImage}
              alt="Ultrasound"
              className="w-16 h-16 rounded-lg object-cover shrink-0 bg-muted"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: TEXT_COLOR }}>
              Ultrasound
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {data.ultrasoundImage ? "Image uploaded" : "No image uploaded"}
            </p>
          </div>
        </div>
        <Button
          onClick={() => goToStep("ultrasound")}
          className="h-9 px-4 text-xs rounded-full font-bold text-white border-none shrink-0"
          style={{ backgroundColor: BRAND }}
        >
          Change
        </Button>
      </div>

      <div className="flex items-start gap-3 bg-muted rounded-xl p-4">
        <Checkbox
          id="consent"
          checked={data.consentGiven}
          onCheckedChange={(v) =>
            dispatch({ type: "SET_CONSENT", value: v === true })
          }
          className="mt-0.5 h-5 w-5 shrink-0"
        />
        <Label
          htmlFor="consent"
          className="text-sm italic leading-relaxed text-muted-foreground"
        >
          I confirm the information above is accurate and consent to proceed
          with analysis.
        </Label>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => goToStep("ultrasound")}
          className="flex-1 h-12 text-base rounded-xl font-bold text-white border-none"
          style={{ backgroundColor: BRAND }}
        >
          Back
        </Button>
        <Button
          onClick={() => goToNextStep()}
          disabled={!data.consentGiven}
          className="flex-1 h-12 text-base rounded-xl font-bold text-white border-none"
          style={{
            backgroundColor: data.consentGiven ? BRAND : DISABLED_COLOR,
            opacity: data.consentGiven ? 1 : 0.37,
          }}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}