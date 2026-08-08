// Which fixture outcome the next submission returns.
//
// Operator state only. It holds no answer, no image, and no result, so it is
// outside the patient-data privacy rules -- and it is never persisted anyway.

import {
  DEFAULT_FIXTURE_OUTCOME,
  type FixtureOutcomeId,
} from "./fixtures";

let selected: FixtureOutcomeId = DEFAULT_FIXTURE_OUTCOME;

const listeners = new Set<() => void>();

export function getSelectedOutcome(): FixtureOutcomeId {
  return selected;
}

export function setSelectedOutcome(id: FixtureOutcomeId): void {
  if (id === selected) return;
  selected = id;
  listeners.forEach((fn) => fn());
}

export function subscribeToOutcome(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
