import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormContext } from "@/context/FormContext";
import {
  FIXTURE_OUTCOMES,
  getSelectedOutcome,
  setSelectedOutcome,
  subscribeToOutcome,
  type FixtureOutcomeId,
} from "@/lib/adapter";

/**
 * Operator surface for the fixture adapter (FE-5).
 *
 * Not a participant screen. It is deliberately styled apart from the flow so
 * it can never be mistaken for part of the screening, and it is stripped from
 * production builds entirely.
 */
export default function DemoDrawer() {
  const [open, setOpen] = useState(false);
  const { dispatch } = useFormContext();
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const selected = useSyncExternalStore(
    subscribeToOutcome,
    getSelectedOutcome,
    getSelectedOutcome
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  function handleReset() {
    dispatch({ type: "RESET" });
    setOpen(false);
    toggleRef.current?.focus();
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="group"
          aria-label="Demo controls"
          className="w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-slate-300 bg-white p-3 text-slate-900 shadow-lg outline-none focus-visible:ring-3 focus-visible:ring-slate-400/50"
        >
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Demo mode — synthetic data
          </p>

          <fieldset className="mt-3">
            <legend className="text-sm font-medium">Next result</legend>
            <div className="mt-2 space-y-1">
              {FIXTURE_OUTCOMES.map((outcome) => (
                <label
                  key={outcome.id}
                  className="flex cursor-pointer gap-2 rounded-md p-1.5 text-sm hover:bg-slate-100 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-slate-400/50"
                >
                  <input
                    type="radio"
                    name="fixture-outcome"
                    value={outcome.id}
                    checked={selected === outcome.id}
                    onChange={() =>
                      setSelectedOutcome(outcome.id as FixtureOutcomeId)
                    }
                    className="mt-0.5 shrink-0 accent-slate-700"
                  />
                  <span>
                    <span className="block leading-snug">{outcome.label}</span>
                    <span className="block text-xs leading-snug text-slate-500">
                      {outcome.note}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="button"
            onClick={handleReset}
            className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-400/50 focus-visible:outline-none"
          >
            Reset session
          </button>
        </div>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-slate-400/50 focus-visible:outline-none"
      >
        Demo
      </button>
    </div>
  );
}
