// Adapter configuration, read from Vite env at module scope.
//
// No secret belongs here. Anything in a VITE_ variable is compiled into the
// bundle and is public. The base URL is public by nature; an API key is not,
// and must never appear in this file or any other file under src/.

export interface HttpAdapterConfig {
  /** Origin + optional prefix, no trailing slash. e.g. https://api.ovia.test */
  baseUrl: string;
  /** Per-attempt ceiling. The flow's own soft/hard timeouts sit above this. */
  requestTimeoutMs: number;
}

/** Below the SubmissionContext hard timeout (90s) so this fires first. */
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function readHttpConfig(): HttpAdapterConfig {
  const baseUrl = import.meta.env.VITE_OVIA_API_BASE_URL;

  if (typeof baseUrl !== "string" || baseUrl === "") {
    throw new Error(
      "VITE_OVIA_API_BASE_URL is required when VITE_OVIA_ADAPTER=live. " +
        "Copy FE/.env.example to FE/.env.local and set it."
    );
  }

  const rawTimeout = Number(import.meta.env.VITE_OVIA_REQUEST_TIMEOUT_MS);
  const requestTimeoutMs =
    Number.isFinite(rawTimeout) && rawTimeout > 0
      ? rawTimeout
      : DEFAULT_REQUEST_TIMEOUT_MS;

  return { baseUrl: trimTrailingSlash(baseUrl), requestTimeoutMs };
}
