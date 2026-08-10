import { ShieldCheck } from "../lib/icons";
import { useFormContext } from "../context/FormContext";
import { Button } from "./ui/button";
import ProgressIndicator from "./ProgressIndicator";

const TEXT_COLOR = "#535861";
const BRAND_COLOR = "#D6697C";

export default function EligibilityOvary() {
  const { dispatch, goToNextStep } = useFormContext();

  const handleAnswer = (value: boolean) => {
    dispatch({ type: "SET_HAS_OVARY", value });
    if (value) {
      goToNextStep();
    } else {
      dispatch({ type: "GO_TO_STEP", step: "not-eligible" });
    }
  };

  return (
    <div className="w-full text-center flex flex-col min-h-screen">
      <div className="flex flex-col items-center gap-4 pt-8 pb-2 px-6">
        <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center">
          <ShieldCheck className="w-10 h-10" style={{ color: BRAND_COLOR }} />
        </div>
        <h1
          className="text-sm font-bold tracking-widest uppercase"
          style={{ color: BRAND_COLOR }}
        >
          Eligibility Check
        </h1>

        <div className="w-full">
          <ProgressIndicator />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-6 pt-4">
        <p
          className="text-lg font-bold text-left"
          style={{ color: TEXT_COLOR }}
        >
          Do you currently have at least one ovary?
        </p>
        <p
          className="text-sm text-left mb-4"
          style={{ color: TEXT_COLOR, opacity: 0.58 }}
        >
          This determines whether ovarian screening applies to you.
        </p>

        <Button
          onClick={() => handleAnswer(true)}
          className="w-full h-12 text-base rounded-xl font-bold bg-white"
          variant="outline"
          style={{ borderColor: TEXT_COLOR, color: TEXT_COLOR }}
        >
          Yes
        </Button>
        {/* Locked (frontend-architecture.md §4.3): neither answer is
            pre-selected or visually favoured. Yes and No are identical. */}
        <Button
          onClick={() => handleAnswer(false)}
          className="w-full h-12 text-base rounded-xl font-bold bg-white"
          variant="outline"
          style={{ borderColor: TEXT_COLOR, color: TEXT_COLOR }}
        >
          No
        </Button>
      </div>
    </div>
  );
}