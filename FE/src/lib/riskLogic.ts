import type { ClinicalData } from "../context/FormContext";

// ── Risk level type ───────────────────────────────────────────────
export type RiskLevel = "Low" | "Moderate" | "Higher";

// ── Risk card result ──────────────────────────────────────────────
export interface RiskResult {
  id: string;
  title: string;
  level: RiskLevel;
  explanation: string;
  relevantSymptoms: string[];
  criteria: string; // shown in doctor mode
}

// ── Symptom reference list ────────────────────────────────────────
const SYMPTOM_MAP: Record<string, string> = {
  "Irregular or absent menstrual cycles": "irregular-cycles",
  "Excess hair growth or persistent acne": "hair-acne",
  "Pelvic pain or bloating lasting over 3 weeks": "pelvic-bloating",
  "Early satiety or unexplained appetite loss": "early-satiety",
  "Unexplained weight gain": "weight-gain",
  "Unexplained weight loss": "weight-loss",
};

// ── Helpers ───────────────────────────────────────────────────────
function isPostmenopausal(status: string): boolean {
  return status === "post-natural" || status === "post-surgical";
}

// ── Risk logic ────────────────────────────────────────────────────
export function evaluateRisks(clinical: ClinicalData): RiskResult[] {
  const symptoms = clinical.symptoms.map((s) => SYMPTOM_MAP[s] || s);
  const symptomSet = new Set(symptoms);

  const postmenopausal = isPostmenopausal(clinical.menopausalStatus);
  const isIrregular = clinical.cycleRegularity === "irregular";
  const hasFamilyHistory = clinical.familyHistory;

  return [
    evaluateOvarianCyst(symptomSet, postmenopausal, hasFamilyHistory, clinical),
    evaluatePCOS(symptomSet, isIrregular, clinical),
    evaluateOvarianTumor(symptomSet, postmenopausal, hasFamilyHistory, clinical),
  ];
}

// ── Ovarian Cyst ──────────────────────────────────────────────────
function evaluateOvarianCyst(
  symptomSet: Set<string>,
  _isPostmenopausal: boolean,
  _hasFamilyHistory: boolean,
  clinical: ClinicalData
): RiskResult {
  const relevant = ["pelvic-bloating", "early-satiety"];
  const matched = relevant.filter((s) => symptomSet.has(s));
  const matchedSymptoms = clinical.symptoms.filter((s) =>
    relevant.includes(SYMPTOM_MAP[s])
  );

  let level: RiskLevel;
  let explanation: string;
  let criteria: string;

  if (matched.length >= 2 && _isPostmenopausal) {
    level = "Higher";
    explanation =
      "Your symptoms, combined with post-menopausal status, suggest a higher likelihood of ovarian cysts. A follow-up ultrasound is recommended.";
    criteria =
      "≥2 relevant symptoms (pelvic pain/bloating, early satiety) AND post-menopausal status → Higher risk.";
  } else if (matched.length >= 2) {
    level = "Higher";
    explanation =
      "Multiple symptoms commonly associated with ovarian cysts have been reported. Consider discussing this with your clinician.";
    criteria =
      "≥2 relevant symptoms (pelvic pain/bloating, early satiety) → Higher risk.";
  } else if (matched.length >= 1) {
    level = "Moderate";
    explanation =
      "You have reported some symptoms that can be associated with ovarian cysts. Monitor your symptoms and consult a healthcare professional if they persist.";
    criteria =
      "1 relevant symptom → Moderate risk.";
  } else {
    level = "Low";
    explanation =
      "No symptoms commonly associated with ovarian cysts were reported. Maintain regular check-ups as part of your routine health care.";
    criteria =
      "0 relevant symptoms → Low risk.";
  }

  return {
    id: "ovarian-cyst",
    title: "Ovarian Cyst",
    level,
    explanation,
    relevantSymptoms: matchedSymptoms,
    criteria,
  };
}

// ── PCOS ──────────────────────────────────────────────────────────
function evaluatePCOS(
  symptomSet: Set<string>,
  _isIrregular: boolean,
  clinical: ClinicalData
): RiskResult {
  const relevant = ["irregular-cycles", "hair-acne", "weight-gain", "weight-loss"];
  const matched = relevant.filter((s) => symptomSet.has(s));
  const matchedSymptoms = clinical.symptoms.filter((s) =>
    relevant.includes(SYMPTOM_MAP[s])
  );

  let level: RiskLevel;
  let explanation: string;
  let criteria: string;

  const pcosIndicators = (_isIrregular ? 1 : 0) + matched.length;

  if (pcosIndicators >= 3) {
    level = "Higher";
    explanation =
      "Multiple indicators commonly associated with PCOS have been identified. These include cycle irregularity and related symptoms. A consultation with a healthcare professional is recommended.";
    criteria =
      "Cycle irregularity AND ≥2 relevant symptoms (irregular cycles, hair/acne, weight changes) → Higher risk.";
  } else if (pcosIndicators >= 2) {
    level = "Moderate";
    explanation =
      "Some indicators associated with PCOS are present. Consider tracking your cycle and symptoms, and discussing them with a clinician.";
    criteria =
      "Cycle irregularity OR 2 relevant symptoms → Moderate risk.";
  } else {
    level = "Low";
    explanation =
      "No significant indicators of PCOS were identified from the information provided.";
    criteria =
      "Fewer than 2 indicators (cycle irregularity + relevant symptoms) → Low risk.";
  }

  return {
    id: "pcos",
    title: "PCOS",
    level,
    explanation,
    relevantSymptoms: matchedSymptoms,
    criteria,
  };
}

// ── Ovarian Tumor ─────────────────────────────────────────────────
function evaluateOvarianTumor(
  symptomSet: Set<string>,
  _isPostmenopausal: boolean,
  _hasFamilyHistory: boolean,
  clinical: ClinicalData
): RiskResult {
  const relevant = ["pelvic-bloating", "early-satiety", "weight-gain", "weight-loss"];
  const matched = relevant.filter((s) => symptomSet.has(s));
  const matchedSymptoms = clinical.symptoms.filter((s) =>
    relevant.includes(SYMPTOM_MAP[s])
  );

  let level: RiskLevel;
  let explanation: string;
  let criteria: string;

  // Higher: persistent symptoms + postmenopausal or family history
  if (matched.length >= 3 && (_isPostmenopausal || _hasFamilyHistory)) {
    level = "Higher";
    explanation =
      "A combination of ongoing symptoms and risk factors suggests that further evaluation is warranted. Please consult a healthcare professional promptly.";
    criteria =
      "≥3 persistent symptoms (pelvic pain/bloating, early satiety, weight changes) AND (post-menopausal OR family history) → Higher risk.";
  } else if (matched.length >= 3) {
    level = "Moderate";
    explanation =
      "You have reported several symptoms that may warrant further discussion with a healthcare professional. Keeping a symptom diary could be helpful.";
    criteria =
      "≥3 persistent symptoms → Moderate risk.";
  } else if (matched.length >= 1) {
    level = "Moderate";
    explanation =
      "Some symptoms that could be associated with ovarian changes have been noted. It is advisable to monitor these and consult a clinician if they persist.";
    criteria =
      "1–2 relevant symptoms → Moderate risk.";
  } else {
    level = "Low";
    explanation =
      "No symptoms commonly associated with ovarian changes were reported. Continue with routine health monitoring.";
    criteria =
      "0 relevant symptoms → Low risk.";
  }

  return {
    id: "ovarian-tumor",
    title: "Ovarian Tumor",
    level,
    explanation,
    relevantSymptoms: matchedSymptoms,
    criteria,
  };
}