// Offline, deterministic adapter. No network, no backend.
//
// The delay exists so the processing overlay (FE-4) has something real to sit
// in front of. It is abortable: cancelling the submission rejects with an
// AbortError rather than resolving late with an outcome nobody asked for.

import { buildFixtureOutcome } from "./fixtures";
import { getSelectedOutcome } from "./demoState";
import type { OviaAdapter, SubmitInput, SubmitOutcome } from "./types";

/** Total simulated round trip, milliseconds. */
const FIXTURE_LATENCY_MS = 2400;

function abortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export const fixtureAdapter: OviaAdapter = {
  async submit(
    input: SubmitInput,
    signal: AbortSignal
  ): Promise<SubmitOutcome> {
    await abortable(FIXTURE_LATENCY_MS, signal);
    return buildFixtureOutcome(getSelectedOutcome(), input.requestId);
  },
};
