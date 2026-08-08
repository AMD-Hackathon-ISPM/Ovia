// The adapter swap point (frontend-architecture.md §7).
//
// Only this module decides which implementation the flow talks to. When FE-6
// lands, HttpAdapter is added here and nothing else in the app changes.

import { fixtureAdapter } from "./fixtureAdapter";
import type { OviaAdapter } from "./types";

export type AdapterMode = "fixture" | "live";

export function getAdapterMode(): AdapterMode {
  // Only "fixture" is implemented. HttpAdapter is FE-6, blocked on ARCH-1.
  return "fixture";
}

export function getAdapter(): OviaAdapter {
  return fixtureAdapter;
}

export * from "./types";
export {
  FIXTURE_OUTCOMES,
  DEFAULT_FIXTURE_OUTCOME,
  type FixtureOutcomeId,
  type FixtureOutcomeMeta,
} from "./fixtures";
export {
  getSelectedOutcome,
  setSelectedOutcome,
  subscribeToOutcome,
} from "./demoState";
