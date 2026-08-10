import { ShieldCheck } from "../lib/icons";
import { useState } from "react";
import { useFormContext } from "../context/FormContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import ProgressIndicator from "./ProgressIndicator";

const BRAND_COLOR = "#D6697C";

export default function EligibilityAge() {
  const { dispatch, goToNextStep } = useFormContext();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleContinue = () => {
    const num = parseInt(value, 10);
    if (!value || isNaN(num)) {
      setError("Please enter your age.");
      return;
    }
    if (num < 18) {
      dispatch({ type: "SET_AGE", value });
      dispatch({ type: "GO_TO_STEP", step: "not-eligible" });
      return;
    }
    setError("");
    dispatch({ type: "SET_AGE", value });
    goToNextStep();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleContinue();
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
        <p className="text-lg text-foreground font-bold text-left">
          What is your age?
        </p>

        <div>
          <Input
            type="number"
            min={0}
            max={130}
            placeholder="e.g. 25"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            className="text-left text-base h-14 rounded-lg px-4
                       border border-foreground/30
                       shadow-none focus-visible:ring-1"
            style={{ ["--tw-ring-color" as string]: BRAND_COLOR }}
          />
          {error && (
            <p className="text-sm text-destructive mt-1 text-left">{error}</p>
          )}
        </div>

        <p className="text-sm text-muted-foreground text-left" 
           style={{  opacity: 0.58 }}
        >
          This screening tool is designed for ages 18 and above
        </p>

        <Button
          onClick={handleContinue}
          className="w-full h-14 text-base rounded-xl font-bold mt-2
                     text-white border-none shadow-none ring-0
                     disabled:opacity-50"
          style={{ backgroundColor: BRAND_COLOR }}
          disabled={!value}
        >
          Done
        </Button>
      </div>
    </div>
  );
}