import { useState } from "react";
import { useFormContext } from "../context/FormContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import ProgressIndicator from "./ProgressIndicator";

const BRAND = "#D6697C";
const BRAND_LIGHT = "#F9DCE2";
const BRAND_LIGHT_HOVER = "#F5CBD3";
const TEXT_COLOR = "#535861";

const SYMPTOMS = [
  "Irregular or absent menstrual cycles",
  "Excess hair growth or persistent acne",
  "Pelvic pain or bloating lasting over 3 weeks",
  "Early satiety or unexplained appetite loss",
  "Unexplained weight gain",
  "Unexplained weight loss",
];

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal weight";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export default function ClinicalForm() {
  const { state, dispatch, goToNextStep } = useFormContext();
  const { clinical } = state.data;
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    dispatch({ type: "SET_CLINICAL", value: { [field]: value || "" } });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const toggleFamilyHistory = () => {
    dispatch({
      type: "SET_CLINICAL",
      value: { familyHistory: !clinical.familyHistory },
    });
  };

  const toggleSymptom = (symptom: string) => {
    const current = clinical.symptoms;
    const updated = current.includes(symptom)
      ? current.filter((s) => s !== symptom)
      : [...current, symptom];
    dispatch({ type: "SET_SYMPTOMS", value: updated });
  };

  const heightM = parseFloat(clinical.heightCm) / 100;
  const weightKg = parseFloat(clinical.weightKg);
  const bmi =
    heightM > 0 && weightKg > 0
      ? (weightKg / (heightM * heightM)).toFixed(1)
      : null;
  const bmiCat = bmi ? bmiCategory(parseFloat(bmi)) : null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!clinical.heightCm) newErrors.heightCm = "Height is required";
    if (!clinical.weightKg) newErrors.weightKg = "Weight is required";
    if (!clinical.pregnancies) newErrors.pregnancies = "Required";
    if (!clinical.births) newErrors.births = "Required";
    if (!clinical.menopausalStatus) newErrors.menopausalStatus = "Please select";
    if (!clinical.ageMenarche) newErrors.ageMenarche = "Required";
    if (!clinical.cycleRegularity) newErrors.cycleRegularity = "Please select";
    if (!clinical.hormonalUse) newErrors.hormonalUse = "Please select";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      goToNextStep();
    }
  };

  return (
    <div className="w-full flex flex-col">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: TEXT_COLOR }}>
            Clinical Information
          </h2>
          <p
            className="text-sm mt-1"
            style={{ color: TEXT_COLOR, opacity: 0.58 }}
          >
            Only fields supported by the approved model contract are
            collected.
          </p>
        </div>

        {/* ═══════════════ Demographics ═══════════════ */}
        <SectionTitle>Demographics</SectionTitle>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="heightCm"
              className="font-semibold"
              style={{ color: TEXT_COLOR }}
            >
              Height (cm)
            </Label>
            <Input
              id="heightCm"
              type="number"
              min={0}
              step="0.1"
              placeholder="e.g. 165"
              value={clinical.heightCm}
              onChange={(e) => update("heightCm", e.target.value)}
              className="h-12 rounded-lg border-foreground/20"
            />
            {errors.heightCm && (
              <p className="text-xs text-destructive">{errors.heightCm}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="weightKg"
              className="font-semibold"
              style={{ color: TEXT_COLOR }}
            >
              Weight (kg)
            </Label>
            <Input
              id="weightKg"
              type="number"
              min={0}
              step="0.1"
              placeholder="e.g. 65"
              value={clinical.weightKg}
              onChange={(e) => update("weightKg", e.target.value)}
              className="h-12 rounded-lg border-foreground/20"
            />
            {errors.weightKg && (
              <p className="text-xs text-destructive">{errors.weightKg}</p>
            )}
          </div>
        </div>

        {bmi && bmiCat && (
          <p className="text-sm italic text-muted-foreground -mt-2">
            BMI calculated automatically: {bmi} — {bmiCat.toLowerCase()} range.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="pregnancies"
              className="font-semibold"
              style={{ color: TEXT_COLOR }}
            >
              Number of Pregnancies
            </Label>
            <Input
              id="pregnancies"
              type="number"
              min={0}
              placeholder="0"
              value={clinical.pregnancies}
              onChange={(e) => update("pregnancies", e.target.value)}
              className="h-12 rounded-lg border-foreground/20"
            />
            {errors.pregnancies && (
              <p className="text-xs text-destructive">{errors.pregnancies}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="births"
              className="font-semibold"
              style={{ color: TEXT_COLOR }}
            >
              Number of Births
            </Label>
            <Input
              id="births"
              type="number"
              min={0}
              placeholder="0"
              value={clinical.births}
              onChange={(e) => update("births", e.target.value)}
              className="h-12 rounded-lg border-foreground/20"
            />
            {errors.births && (
              <p className="text-xs text-destructive">{errors.births}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="menopausalStatus"
            className="font-semibold"
            style={{ color: TEXT_COLOR }}
          >
            Menopausal Status
          </Label>
          <Select
            value={clinical.menopausalStatus}
            onValueChange={(v) => update("menopausalStatus", v ?? "")}
          >
            <SelectTrigger
              id="menopausalStatus"
              className="h-12 rounded-lg w-full"
              style={{ borderColor: BRAND }}
            >
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="pre"
                className="data-[state=checked]:font-semibold"
                style={
                  clinical.menopausalStatus === "pre"
                    ? { backgroundColor: BRAND_LIGHT, color: BRAND }
                    : undefined
                }
              >
                Pre-Menopausal
              </SelectItem>
              <SelectItem
                value="post-natural"
                style={
                  clinical.menopausalStatus === "post-natural"
                    ? { backgroundColor: BRAND_LIGHT, color: BRAND }
                    : undefined
                }
              >
                Post-Menopausal (natural)
              </SelectItem>
              <SelectItem
                value="post-surgical"
                style={
                  clinical.menopausalStatus === "post-surgical"
                    ? { backgroundColor: BRAND_LIGHT, color: BRAND }
                    : undefined
                }
              >
                Post-Menopausal (surgical / induced)
                <span className="block text-xs text-muted-foreground italic">
                  e.g. bilateral oophorectomy, chemotherapy, pelvic radiation
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {errors.menopausalStatus && (
            <p className="text-xs text-destructive">{errors.menopausalStatus}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="familyHistory"
            checked={clinical.familyHistory}
            onCheckedChange={toggleFamilyHistory}
            className="h-5 w-5"
            style={
              clinical.familyHistory
                ? { backgroundColor: BRAND, borderColor: BRAND }
                : undefined
            }
          />
          <Label htmlFor="familyHistory" className="text-sm font-normal">
            Family history of ovarian or breast cancer
          </Label>
        </div>

        {/* ═══════════════ Menstrual & Reproductive History ═══════════════ */}
        <SectionTitle>Menstrual &amp; Reproductive History</SectionTitle>

        <div className="space-y-2">
          <Label
            htmlFor="ageMenarche"
            className="font-semibold"
            style={{ color: TEXT_COLOR }}
          >
            Age at Menarche (years)
          </Label>
          <Input
            id="ageMenarche"
            type="number"
            min={0}
            max={25}
            placeholder="e.g. 13"
            value={clinical.ageMenarche}
            onChange={(e) => update("ageMenarche", e.target.value)}
            className="h-12 rounded-lg border-foreground/20"
          />
          {errors.ageMenarche && (
            <p className="text-xs text-destructive">{errors.ageMenarche}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="font-semibold" style={{ color: TEXT_COLOR }}>
            Cycle Regularity
          </Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => update("cycleRegularity", "irregular")}
              className="flex-1 h-12 rounded-lg text-sm font-semibold border transition-colors duration-150 cursor-pointer"
              style={
                clinical.cycleRegularity === "irregular"
                  ? { backgroundColor: BRAND_LIGHT, borderColor: BRAND, color: BRAND }
                  : { backgroundColor: "white", borderColor: "#E5E5E5", color: "#374151" }
              }
            >
              Irregular
            </button>
            <button
              type="button"
              onClick={() => update("cycleRegularity", "regular")}
              className="flex-1 h-12 rounded-lg text-sm font-semibold border transition-colors duration-150 cursor-pointer"
              style={
                clinical.cycleRegularity === "regular"
                  ? { backgroundColor: BRAND_LIGHT, borderColor: BRAND, color: BRAND }
                  : { backgroundColor: "white", borderColor: "#E5E5E5", color: "#374151" }
              }
            >
              Regular
            </button>
          </div>
          {errors.cycleRegularity && (
            <p className="text-xs text-destructive">{errors.cycleRegularity}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="hormonalUse"
            className="font-semibold"
            style={{ color: TEXT_COLOR }}
          >
            Hormonal contraceptive or HRT use
          </Label>
          <Select
            value={clinical.hormonalUse}
            onValueChange={(v) => update("hormonalUse", v ?? "")}
          >
            <SelectTrigger
              id="hormonalUse"
              className="h-12 rounded-lg w-full"
              style={{ borderColor: BRAND }}
            >
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="combined-oral">Combined oral</SelectItem>
              <SelectItem value="progestin-only">
                Progestin-only (pill, injection, or implant)
              </SelectItem>
              <SelectItem value="hormonal-iud">Hormonal IUD</SelectItem>
              <SelectItem value="hrt-current">
                Hormone replacement therapy (HRT) — current
              </SelectItem>
              <SelectItem value="hrt-past">
                Hormone replacement therapy (HRT) — past, discontinued
              </SelectItem>
              <SelectItem value="not-sure">Not sure</SelectItem>
            </SelectContent>
          </Select>
          {errors.hormonalUse && (
            <p className="text-xs text-destructive">{errors.hormonalUse}</p>
          )}
        </div>

        {/* ═══════════════ Current Symptoms ═══════════════ */}
        <SectionTitle>Current Symptoms</SectionTitle>

        <div className="space-y-2">
          {SYMPTOMS.map((symptom) => {
            const isChecked = clinical.symptoms.includes(symptom);
            return (
              <div
                key={symptom}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors duration-150"
                style={
                  isChecked
                    ? { backgroundColor: BRAND, borderColor: BRAND }
                    : { backgroundColor: "white", borderColor: "#E5E5E5" }
                }
              >
                <Checkbox
                  id={`symptom-${symptom}`}
                  checked={isChecked}
                  onCheckedChange={() => toggleSymptom(symptom)}
                  className="h-5 w-5 shrink-0 bg-white"
                  style={
                    isChecked
                      ? { backgroundColor: "white", color: BRAND, borderColor: "white" }
                      : { borderColor: "#D1D5DB" }
                  }
                />
                <Label
                  htmlFor={`symptom-${symptom}`}
                  className="text-sm font-medium leading-relaxed cursor-pointer"
                  style={{ color: isChecked ? "white" : "#374151" }}
                >
                  {symptom}
                </Label>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            className="h-12 px-10 text-base rounded-xl font-bold text-white border-none shadow-md"
            style={{ backgroundColor: BRAND }}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold" style={{ color: BRAND }}>
      {children}
    </h3>
  );
}