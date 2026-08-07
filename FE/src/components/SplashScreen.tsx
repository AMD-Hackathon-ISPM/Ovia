// SplashScreen.tsx
import { useEffect, useState } from "react";
import { useFormContext } from "../context/FormContext";

export default function SplashScreen() {
  const { goToNextStep } = useFormContext();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsVisible(false), 1800);
    const nextTimer = setTimeout(() => goToNextStep(), 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(nextTimer);
    };
  }, [goToNextStep]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex flex-col items-center" aria-hidden="true">
        <div
          className="w-32 h-24 rounded-full"
          style={{ backgroundColor: "#FFC0CB", opacity: 0.6 }}
        />
        <div
          className="w-32 h-24 rounded-full -mt-12"
          style={{ backgroundColor: "#FFC0CB", opacity: 0.8 }}
        />
        <div
          className="w-32 h-24 rounded-full -mt-12"
          style={{ backgroundColor: "#FFC0CB", opacity: 1 }}
        />
      </div>

      <h1
        className="text-4xl font-light tracking-[0.3em] pl-[0.3em]"
        style={{ color: "#FFC0CB" }}
      >
        OVIA
      </h1>
    </div>
  );
}