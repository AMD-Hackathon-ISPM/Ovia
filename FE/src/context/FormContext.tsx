import { createContext, useContext, useReducer, useEffect, type ReactNode } from "react";

// ── Step definitions ──────────────────────────────────────────────
export type Step =
  | "splash"
  | "eligibility-ovary"
  | "eligibility-pregnancy"
  | "eligibility-age"
  | "not-eligible"
  | "clinical"
  | "ultrasound"
  | "review"
  | "results"
  // Terminal technical failure (frontend-architecture.md §7.1). Reached only
  // by explicit transition, never by goToNextStep, and renders no output.
  | "error";

export interface ClinicalData {
  heightCm: string;
  weightKg: string;
  pregnancies: string;
  births: string;
  menopausalStatus: string;
  ageMenarche: string;
  cycleRegularity: string;
  hormonalUse: string;
  familyHistory: boolean;
  symptoms: string[];
}

export interface FormData {
  hasOvary: boolean | null;
  isPregnant: boolean | null;
  age: string;
  clinical: ClinicalData;
  ultrasoundImage: string | null; // data URL
  consentGiven: boolean;
}

const defaultClinical: ClinicalData = {
  heightCm: "",
  weightKg: "",
  pregnancies: "",
  births: "",
  menopausalStatus: "",
  ageMenarche: "",
  cycleRegularity: "",
  hormonalUse: "",
  familyHistory: false,
  symptoms: [],
};

const defaultFormData: FormData = {
  hasOvary: null,
  isPregnant: null,
  age: "",
  clinical: { ...defaultClinical },
  ultrasoundImage: null,
  consentGiven: false,
};

// ── State ─────────────────────────────────────────────────────────
interface FormState {
  step: Step;
  data: FormData;
}

// ── Actions ───────────────────────────────────────────────────────
type Action =
  | { type: "GO_TO_STEP"; step: Step }
  | { type: "SET_HAS_OVARY"; value: boolean }
  | { type: "SET_IS_PREGNANT"; value: boolean }
  | { type: "SET_AGE"; value: string }
  | { type: "SET_CLINICAL"; value: Partial<ClinicalData> }
  | { type: "SET_SYMPTOMS"; value: string[] }
  | { type: "SET_ULTRASOUND_IMAGE"; value: string | null }
  | { type: "SET_CONSENT"; value: boolean }
  | { type: "RESET" };

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "GO_TO_STEP":
      return { ...state, step: action.step };
    case "SET_HAS_OVARY":
      return { ...state, data: { ...state.data, hasOvary: action.value } };
    case "SET_IS_PREGNANT":
      return { ...state, data: { ...state.data, isPregnant: action.value } };
    case "SET_AGE":
      return { ...state, data: { ...state.data, age: action.value } };
    case "SET_CLINICAL":
      return {
        ...state,
        data: {
          ...state.data,
          clinical: { ...state.data.clinical, ...action.value },
        },
      };
    case "SET_SYMPTOMS":
      return {
        ...state,
        data: {
          ...state.data,
          clinical: { ...state.data.clinical, symptoms: action.value },
        },
      };
    case "SET_ULTRASOUND_IMAGE":
      return { ...state, data: { ...state.data, ultrasoundImage: action.value } };
    case "SET_CONSENT":
      return { ...state, data: { ...state.data, consentGiven: action.value } };
    case "RESET":
      return { step: "eligibility-ovary", data: { ...defaultFormData } };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────
interface FormContextType {
  state: FormState;
  dispatch: React.Dispatch<Action>;
  goToNextStep: () => void;
  goToStep: (step: Step) => void;
  currentStepIndex: number;
  totalSteps: number;
}

const FormContext = createContext<FormContextType | null>(null);

const STORAGE_KEY = "ovia-form-state";

function loadFromStorage(): FormState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

function saveToStorage(state: FormState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

// ── Provider ──────────────────────────────────────────────────────
export function FormProvider({ children }: { children: ReactNode }) {
  const saved = loadFromStorage();
  const [state, dispatch] = useReducer(
    reducer,
    saved ?? { step: "splash", data: { ...defaultFormData } }
  );

  // Persist to session storage on every change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const visibleSteps: Step[] = [
    "splash",
    "eligibility-ovary",
    "eligibility-pregnancy",
    "eligibility-age",
    "clinical",
    "ultrasound",
    "review",
    "results",
  ];

  const currentStepIndex = visibleSteps.indexOf(state.step);
  const totalSteps = visibleSteps.length - 1; // exclude results from count

  const goToNextStep = () => {
    const idx = visibleSteps.indexOf(state.step);
    if (idx < visibleSteps.length - 1) {
      dispatch({ type: "GO_TO_STEP", step: visibleSteps[idx + 1] });
    }
  };

  const goToStep = (step: Step) => {
    dispatch({ type: "GO_TO_STEP", step });
  };

  return (
    <FormContext.Provider
      value={{ state, dispatch, goToNextStep, goToStep, currentStepIndex, totalSteps }}
    >
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("useFormContext must be used within FormProvider");
  return ctx;
}