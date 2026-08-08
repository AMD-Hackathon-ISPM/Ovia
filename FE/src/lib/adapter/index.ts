// The adapter swap point (frontend-architecture.md §7).
//
// Only this module decides which implementation the flow talks to. Every
// consumer calls `getAdapter().submit(...)` and nothing else, so moving between
// fixtures and the Rust backend is an env change, not a code change.

import { readHttpConfig } from "./config";
import { fixtureAdapter } from "./fixtureAdapter";
import { createHttpAdapter } from "./httpAdapter";
import type { OviaAdapter } from "./types";

export type AdapterMode = "fixture" | "live";

export function getAdapterMode(): AdapterMode {
  return import.meta.env.VITE_OVIA_ADAPTER === "live" ? "live" : "fixture";
}

/**
 * Built once, on first use rather than at import time, so a missing base URL
 * surfaces when a submission is attempted instead of blanking the whole app.
 */
let liveAdapter: OviaAdapter | null = null;

export function getAdapter(): OviaAdapter {
  if (getAdapterMode() === "fixture") return fixtureAdapter;
  if (!liveAdapter) liveAdapter = createHttpAdapter(readHttpConfig());
  return liveAdapter;
}

export * from "./types";
export { createHttpAdapter } from "./httpAdapter";
export { readHttpConfig, type HttpAdapterConfig } from "./config";
export { CONTRACT_VERSION } from "./wire";
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
