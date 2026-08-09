// Live transport. Speaks HTTP; knows nothing about screens, copy, or bands.
//
// Deliberately absent:
//  - automatic retry. §7.1 locks retries to an explicit participant action, so
//    a backoff loop here would resubmit clinical answers nobody re-consented to.
//  - credentials. `credentials: "omit"` is explicit: no cookie is attached, so a
//    misconfigured CORS allowlist cannot turn into a cross-origin session leak.
//  - any path that returns a partial or stale outcome. Every failure resolves to
//    a `status: "error"` outcome carrying no panels.

import type { HttpAdapterConfig } from "./config";
import type { OviaAdapter, OviaError, SubmitInput, SubmitOutcome } from "./types";
import {
  buildRequestBody,
  ContractViolation,
  CONTRACT_VERSION,
  decodeErrorResponse,
  decodeSuccess,
} from "./wire";

const SUBMIT_PATH = "/api/v1/analyze";

/**
 * Combines the caller's cancel signal with a per-attempt timeout.
 *
 * Written by hand rather than with `AbortSignal.any` so the two causes stay
 * distinguishable: a timeout must surface as a retryable error, while a
 * participant cancelling is not an error at all.
 */
function withTimeout(
  signal: AbortSignal,
  timeoutMs: number
): { signal: AbortSignal; timedOut: () => boolean; dispose: () => void } {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);

  function onAbort() {
    controller.abort(signal.reason);
  }

  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    },
  };
}

/** A body that will not parse is a contract failure, not an empty response. */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorOutcome(requestId: string, error: OviaError): SubmitOutcome {
  return { status: "error", requestId, error };
}

export function createHttpAdapter(config: HttpAdapterConfig): OviaAdapter {
  return {
    async submit(input: SubmitInput, signal: AbortSignal): Promise<SubmitOutcome> {
      const attempt = withTimeout(signal, config.requestTimeoutMs);

      try {
        const response = await fetch(`${config.baseUrl}${SUBMIT_PATH}`, {
          method: "POST",
          // Content-Type is intentionally unset: the browser must add the
          // multipart boundary itself.
          headers: {
            Accept: "application/json",
            "X-Request-Id": input.requestId,
            "X-Ovia-Schema-Version": input.schemaVersion,
          },
          body: buildRequestBody(
            input.answers,
            input.image,
            input.requestId,
            input.schemaVersion
          ),
          credentials: "omit",
          cache: "no-store",
          signal: attempt.signal,
        });

        const body = await readJson(response);

        if (!response.ok) {
          return errorOutcome(
            input.requestId,
            decodeErrorResponse(response.status, body)
          );
        }

        const decoded = decodeSuccess(body, input.requestId);

        // A version skew is terminal and never coerced: an older client cannot
        // know which field meanings changed underneath it.
        if (decoded.contractVersion !== CONTRACT_VERSION) {
          return errorOutcome(input.requestId, {
            class: "terminal_error",
            code: "schema_version_mismatch",
          });
        }

        return {
          status: "ok",
          requestId: decoded.requestId,
          receivedAt: Date.now(),
          contractVersion: decoded.contractVersion,
          panels: decoded.panels,
          ...(decoded.inspection ? { inspection: decoded.inspection } : {}),
          ...(decoded.evidence ? { evidence: decoded.evidence } : {}),
          ...(decoded.orchestration ? { orchestration: decoded.orchestration } : {}),
        };
      } catch (cause) {
        // Participant cancelled. Rethrown so the caller returns to idle rather
        // than rendering a failure the participant already resolved.
        if (signal.aborted) throw cause;

        if (attempt.timedOut()) {
          return errorOutcome(input.requestId, {
            class: "retryable_error",
            code: "timeout",
          });
        }

        if (cause instanceof ContractViolation) {
          return errorOutcome(input.requestId, {
            class: "terminal_error",
            code: "contract_error",
          });
        }

        // DNS failure, refused connection, CORS rejection, offline.
        return errorOutcome(input.requestId, {
          class: "retryable_error",
          code: "network",
        });
      } finally {
        attempt.dispose();
      }
    },
  };
}
