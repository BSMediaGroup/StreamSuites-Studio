import { publicStudioConfig } from "../config/env";
import type { SafeApiError } from "./contracts";

export interface RuntimeVersion {
  readonly version: string;
  readonly build: string | null;
  readonly source: "runtime";
}

export type RuntimeVersionResult =
  | { readonly ok: true; readonly value: RuntimeVersion }
  | { readonly ok: false; readonly error: SafeApiError };

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function parseRuntimeVersion(payload: unknown): RuntimeVersion | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.version !== "string" ||
    !VERSION_PATTERN.test(candidate.version) ||
    candidate.source !== "runtime"
  ) {
    return null;
  }

  return {
    version: candidate.version,
    build: typeof candidate.build === "string" ? candidate.build : null,
    source: "runtime",
  };
}

export async function fetchRuntimeVersion(
  signal?: AbortSignal,
): Promise<RuntimeVersionResult> {
  if (!publicStudioConfig.runtimeVersionUrl) {
    return {
      ok: false,
      error: {
        code: "runtime_version_not_configured",
        message: "Runtime version hydration has not been configured for Studio.",
        retryable: false,
      },
    };
  }

  try {
    const response = await fetch(publicStudioConfig.runtimeVersionUrl, { signal });
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: "runtime_version_unavailable",
          message: "The runtime version export is unavailable.",
          status: response.status,
          retryable: response.status >= 500,
        },
      };
    }

    const version = parseRuntimeVersion(await response.json());
    if (!version) {
      return {
        ok: false,
        error: {
          code: "runtime_version_invalid",
          message: "The runtime version export did not match the confirmed contract.",
          retryable: false,
        },
      };
    }

    return { ok: true, value: version };
  } catch {
    return {
      ok: false,
      error: {
        code: "runtime_version_request_failed",
        message: "The runtime version export could not be requested.",
        retryable: true,
      },
    };
  }
}
