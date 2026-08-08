/// <reference types="vite/client" />

// Typed build-time env. Everything here is compiled into the public bundle --
// no key, token, or credential may be added to this list.
interface ImportMetaEnv {
  /** "live" talks to the backend. Anything else (or unset) uses fixtures. */
  readonly VITE_OVIA_ADAPTER?: "fixture" | "live";
  /** Backend origin, no trailing slash. Required when VITE_OVIA_ADAPTER=live. */
  readonly VITE_OVIA_API_BASE_URL?: string;
  /** Per-attempt timeout in milliseconds. Defaults to 60000. */
  readonly VITE_OVIA_REQUEST_TIMEOUT_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
