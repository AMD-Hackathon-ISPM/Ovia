import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormContext } from "./FormContext";
import { getAdapter, type OviaError, type SubmitOutcome } from "@/lib/adapter";
import type { ClinicalData } from "./FormContext";

/**
 * Submission state and the error taxonomy routing (FE-4).
 *
 * Deliberately separate from FormContext: this holds no answer and no image,
 * only the state of one in-flight request. It is never persisted.
 *
 * Rule (frontend-architecture.md §7.1): no error path may leave a previously
 * rendered output visible. Enforced here by clearing `outcome` at the start of
 * every attempt and never setting it on an error.
 */

export type SubmitStage = "preparing" | "uploading" | "image" | "clinical" | "segmenting" | "synthesizing" | "slow";

export type SubmissionState =
  | { status: "idle" }
  | { status: "submitting"; stage: SubmitStage }
  | { status: "success"; outcome: Extract<SubmitOutcome, { status: "ok" }> }
  | { status: "error"; error: OviaError };

/** Stage labels advance on a timer; they describe the client's own progress and
 *  never claim the server has accepted anything. */
const STAGE_SCHEDULE: ReadonlyArray<{ at: number; stage: SubmitStage }> = [
  { at: 0, stage: "preparing" },
  { at: 400, stage: "uploading" },
  { at: 1200, stage: "image" },
  { at: 2600, stage: "clinical" },
  { at: 3900, stage: "segmenting" },
  { at: 5600, stage: "synthesizing" },
];

/** §7: 45 s soft (stage label changes), 90 s hard abort -> retryable error. */
const SOFT_TIMEOUT_MS = 45_000;
const HARD_TIMEOUT_MS = 90_000;

interface SubmissionContextType {
  state: SubmissionState;
  submit: () => void;
  cancel: () => void;
  /** Clears the error without resubmitting. Retries are never automatic. */
  dismissError: () => void;
}

const SubmissionContext = createContext<SubmissionContextType | null>(null);

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

function finite(value:string):number|undefined{const parsed=Number(value);return value!==""&&Number.isFinite(parsed)?parsed:undefined}
function modelAnswers(age:string,clinical:ClinicalData):Record<string,number>{
  const entries:Record<string,number|undefined>={
    age_years:finite(age),height_cm:finite(clinical.heightCm),weight_kg:finite(clinical.weightKg),
    cycle_regularity_code:clinical.cycleRegularity==="regular"?2:clinical.cycleRegularity==="irregular"?4:undefined,
    cycle_length_days:finite(clinical.cycleLengthDays),systolic_bp_mmhg:finite(clinical.systolicBp),diastolic_bp_mmhg:finite(clinical.diastolicBp),
    fsh_miu_ml:finite(clinical.fshMiuMl),lh_miu_ml:finite(clinical.lhMiuMl),tsh_miu_l:finite(clinical.tshMiuL),amh_ng_ml:finite(clinical.amhNgMl),
    weight_gain:Number(clinical.weightGain),hair_growth:Number(clinical.hairGrowth),skin_darkening:Number(clinical.skinDarkening),hair_loss:Number(clinical.hairLoss),
    pimples:Number(clinical.pimples),fast_food:Number(clinical.fastFood),regular_exercise:Number(clinical.regularExercise),
  };
  return Object.fromEntries(Object.entries(entries).filter((entry):entry is [string,number]=>entry[1]!==undefined));
}

export function SubmissionProvider({ children }: { children: ReactNode }) {
  const { state: formState, goToStep } = useFormContext();
  const [state, setState] = useState<SubmissionState>({ status: "idle" });

  const controllerRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  const inFlightRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      controllerRef.current?.abort();
    };
  }, [clearTimers]);

  const routeError = useCallback(
    (error: OviaError) => {
      setState({ status: "error", error });
      switch (error.class) {
        case "image_rejected_server":
          // Questionnaire stays intact; only the image step is revisited.
          goToStep("ultrasound");
          break;
        case "retryable_error":
          goToStep("review");
          break;
        case "terminal_error":
          goToStep("error");
          break;
      }
    },
    [goToStep]
  );

  const submit = useCallback(() => {
    // Duplicate guard. A second press while a request is in flight is ignored.
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const controller = new AbortController();
    controllerRef.current = controller;

    // Any prior result is discarded before the attempt begins, so a failure
    // cannot leave the previous output on screen.
    setState({ status: "submitting", stage: "preparing" });

    clearTimers();
    STAGE_SCHEDULE.forEach(({ at, stage }) => {
      if (at === 0) return;
      timersRef.current.push(
        window.setTimeout(() => {
          setState((prev) =>
            prev.status === "submitting" ? { ...prev, stage } : prev
          );
        }, at)
      );
    });
    timersRef.current.push(
      window.setTimeout(() => {
        setState((prev) =>
          prev.status === "submitting" ? { ...prev, stage: "slow" } : prev
        );
      }, SOFT_TIMEOUT_MS)
    );
    timersRef.current.push(
      window.setTimeout(() => {
        controller.abort(new DOMException("Timed out", "TimeoutError"));
      }, HARD_TIMEOUT_MS)
    );

    void (async () => {
      try {
        const { data } = formState;
        const image = data.ultrasoundImage
          ? await dataUrlToBlob(data.ultrasoundImage)
          : null;

        const outcome = await getAdapter().submit(
          {
            answers: modelAnswers(data.age,data.clinical),
            image,
            requestId: crypto.randomUUID(),
            schemaVersion: "ovia-v1",
          },
          controller.signal
        );

        clearTimers();
        inFlightRef.current = false;

        if (outcome.status === "ok") {
          setState({ status: "success", outcome });
          goToStep("results");
        } else {
          routeError(outcome.error);
        }
      } catch (err) {
        clearTimers();
        inFlightRef.current = false;

        // A cancel is a return to idle, not an error. A hard timeout is a
        // retryable error the participant chose nothing about.
        if (err instanceof DOMException && err.name === "TimeoutError") {
          routeError({ class: "retryable_error", code: "timeout" });
          return;
        }
        if (controller.signal.aborted) {
          setState({ status: "idle" });
          return;
        }
        routeError({ class: "retryable_error", code: "network" });
      }
    })();
  }, [formState, clearTimers, goToStep, routeError]);

  const cancel = useCallback(() => {
    clearTimers();
    inFlightRef.current = false;
    controllerRef.current?.abort();
    setState({ status: "idle" });
  }, [clearTimers]);

  const dismissError = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  return (
    <SubmissionContext.Provider
      value={{ state, submit, cancel, dismissError }}
    >
      {children}
    </SubmissionContext.Provider>
  );
}

export function useSubmission() {
  const ctx = useContext(SubmissionContext);
  if (!ctx) {
    throw new Error("useSubmission must be used within SubmissionProvider");
  }
  return ctx;
}
